<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div class="mx-3">
    <v-row>
      <v-col cols="12" md="8">
        <p>
          Enter the email address that you use to log in to Mountain Project and
          your private API key displayed at the right side of
          <a target="_blank" href="https://www.mountainproject.com/data"
            >this page</a
          >.
        </p>

        <p>
          This information is only used to fetch your ticks and routes (and in
          fact, it will be sent directly from your browser to Mountain Project's
          servers).
        </p>
      </v-col>
    </v-row>

    <v-divider class="mb-2" />

    <v-form v-model="valid" @submit.prevent>
      <v-row>
        <v-col cols="12" md="6" class="py-0">
          <v-text-field
            label="Email address"
            v-model="email"
            single-line
            :rules="emailRules"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="6" class="py-0">
          <v-text-field
            label="Private key"
            v-model="key"
            single-line
            :rules="keyRules"
          />
        </v-col>
      </v-row>
    </v-form>

    <v-row>
      <v-col class="pb-1">
        <v-btn color="primary" :disabled="!valid" @click="onClick"
          >Import</v-btn
        >
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="8">
        <v-textarea
          v-model="log"
          label="Log"
          outlined
          readonly
          rows="8"
          class="mb-n7"
        />
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import firebase from '@/firebase';
import { ApiRoute, ApiTick, getRoutes, getTicks } from '@/api';
import {
  Area,
  AreaId,
  AreaMap,
  Route,
  RouteId,
  RouteType,
  Tick,
  TickId,
  TickStyle,
} from '@/models';

@Component
export default class Import extends Vue {
  // Models for text fields.
  email = '';
  key = '';

  // Model for textarea.
  log = '';

  // Whether the form contains valid input.
  valid = false;

  emailRules = [(v: string) => !!v || 'Email address must be supplied'];
  keyRules = [(v: string) => !!v || 'Private key must be supplied'];

  onClick() {
    const lastTickId = 118294181; // FIXME: Save this.
    const routes: Record<RouteId, Route> = {};
    const routeTicks: Record<RouteId, Record<TickId, Tick>> = {};
    const batch = firebase.firestore().batch();

    this.addLog(`Getting ticks after ${lastTickId} from MP...`);
    getTicks(this.email, this.key, lastTickId + 1)
      .then(apiTicks => {
        this.addLog(`Got ${apiTicks.length} new tick(s).`);
        const routeIds: Set<RouteId> = new Set();
        for (const apiTick of apiTicks) {
          try {
            const routeId = apiTick.routeId;
            if (!routeTicks[routeId]) routeTicks[routeId] = {};
            routeTicks[routeId][apiTick.tickId] = createTick(apiTick);
            routeIds.add(routeId);
          } catch (err) {
            this.addLog(`Skipping invalid tick ${apiTick}: ${err}`);
          }
        }
        const ids = Array.from(routeIds);
        this.addLog(`Loading ${ids.length} route(s) from Firestore...`);
        return this.loadRoutesFromFirestore(routes, ids);
      })
      .then(missing => {
        // Get the missing routes from the Mountain Project API.
        this.addLog(`Getting ${missing.length} route(s) from MP...`);
        return getRoutes(missing, this.key);
      })
      .then(apiRoutes => {
        // Process the new routes that we got from the API.
        this.addLog(`Got ${apiRoutes.length} route(s).`);
        const newRoutes: Record<RouteId, Route> = {};
        const newRouteComponents: Record<RouteId, string[]> = {};
        for (const r of apiRoutes) {
          routes[r.id] = newRoutes[r.id] = createRoute(r);
          newRouteComponents[r.id] = r.location;
        }
        return this.addRoutesToAreas(newRoutes, newRouteComponents, batch);
      })
      .then(() => {
        // Add the ticks to the routes.
        for (const routeId of Object.keys(routeTicks).map(id => parseInt(id))) {
          const route = routes[routeId];
          const ticks = routeTicks[routeId];
          for (const tickId of Object.keys(ticks).map(id => parseInt(id))) {
            route.ticks[tickId] = ticks[tickId];
          }
        }
        for (const routeId of Object.keys(routes).map(id => parseInt(id))) {
          batch.set(this.getRouteRef(routeId), routes[routeId]);
        }

        return batch.commit();
      })
      .then(() => {
        this.addLog('Import was successful.');
      });
  }

  addLog(msg: string) {
    this.log += (this.log ? '\n' : '') + msg;
  }

  // Tries to load the routes identified by |ids| from Firestore into |routes|.
  // Returns IDs of missing routes (if any).
  loadRoutesFromFirestore(
    routes: Record<RouteId, Route>,
    ids: RouteId[]
  ): Promise<RouteId[]> {
    // Load routes in parallel, returning IDs of missing routes and 0 for
    // success.
    return Promise.all(
      ids.map(id =>
        this.getRouteRef(id)
          .get()
          .then(snap => {
            if (!snap.exists) return id;
            routes[id] = snap.data() as Route;
            return 0;
          })
      )
    ).then(ids => ids.filter(id => !!id));
  }

  // Loads areas from Firestore and adds each route to the appropriate area.
  addRoutesToAreas(
    routes: Record<RouteId, Route>,
    routeComponents: Record<RouteId, string[]>,
    batch: firebase.firestore.WriteBatch
  ): Promise<void> {
    if (!Object.keys(routes).length) return Promise.resolve();

    const makeAreaId = function(components: string[]) {
      return components.join('|');
    };

    // Figure out which areas are needed.
    const areaIds: Record<AreaId, string[]> = {};
    for (const components of Object.values(routeComponents)) {
      areaIds[makeAreaId(components)] = components;
    }

    const areas: Record<AreaId, Area> = {};
    let areaMap = { children: {} };

    // Load the area map from Firestore so new areas can be added to it.
    return this.areaMapRef
      .get()
      .then(snap => {
        if (snap.exists) areaMap = snap.data() as AreaMap;
      })
      .then(() =>
        // Try to load each area from Firestore.
        Promise.all(
          Object.keys(areaIds).map(areaId =>
            this.getAreaRef(areaId)
              .get()
              .then(snap => {
                if (snap.exists) {
                  areas[areaId] = snap.data() as Area;
                } else {
                  areas[areaId] = { routes: {} };
                  const components = areaIds[areaId];
                  addAreaToAreaMap(areaId, components, areaMap);
                }
              })
          )
        )
      )
      .then(() => {
        // Update areas to contain routes.
        for (const routeId of Object.keys(routes).map(id => parseInt(id))) {
          const route = routes[routeId];
          const areaId = makeAreaId(routeComponents[routeId]);
          areas[areaId].routes[routeId] = {
            name: route.name,
            grade: route.grade,
          };
        }

        // Queue up writes.
        batch.set(this.areaMapRef, areaMap);
        for (const areaId of Object.keys(areas)) {
          batch.set(this.getAreaRef(areaId), areas[areaId]);
        }
      });
  }

  getRouteRef(id: RouteId) {
    return firebase
      .firestore()
      .collection('users')
      .doc('default') // FIXME: user ID
      .collection('routes')
      .doc(id.toString());
  }

  getAreaRef(id: AreaId) {
    return firebase
      .firestore()
      .collection('users')
      .doc('default') // FIXME: user ID
      .collection('areas')
      .doc(id);
  }

  get areaMapRef() {
    return firebase
      .firestore()
      .collection('users')
      .doc('default') // FIXME: user ID
      .collection('areas')
      .doc('map');
  }
}

// Converts the |style| and |leadStyle| values from an ApiTick object into the
// TickStyle enum used in a Tick object.
function getTickStyle(style: string, leadStyle: string): TickStyle {
  switch (style) {
    case 'Solo':
      return TickStyle.SOLO;
    case 'TR':
      return TickStyle.TOP_ROPE;
    case 'Follow':
      return TickStyle.FOLLOW;
    case 'Lead': {
      switch (leadStyle) {
        case 'Onsight':
          return TickStyle.LEAD_ONSIGHT;
        case 'Flash':
          return TickStyle.LEAD_FLASH;
        case 'Redpoint':
          return TickStyle.LEAD_REDPOINT;
        case 'Pinkpoint':
          return TickStyle.LEAD_PINKPOINT;
        case 'Fell/Hung':
          return TickStyle.LEAD_FELL_HUNG;
        default:
          return TickStyle.LEAD;
      }
    }
    default:
      return TickStyle.UNKNOWN;
  }
}

function createTick(apiTick: ApiTick): Tick {
  if (!apiTick.tickId) throw new Error('Missing tick ID');
  if (!apiTick.routeId) throw new Error('Missing route ID');
  if (
    typeof apiTick.date != 'string' ||
    !apiTick.date.match(/^\d{4}-\d\d-\d\d$/)
  ) {
    throw new Error('Invalid date');
  }

  return {
    date: apiTick.date,
    pitches: apiTick.pitches || -1,
    style: getTickStyle(apiTick.style, apiTick.leadStyle),
    notes: apiTick.notes || '',
    stars: apiTick.userStars || -1,
    grade: apiTick.userRating || '',
  };
}

function getRouteType(apiType: string): RouteType {
  if (apiType.startsWith('Sport')) return RouteType.SPORT;
  if (apiType.startsWith('Trad')) return RouteType.TRAD;
  return RouteType.OTHER;
}

function createRoute(apiRoute: ApiRoute): Route {
  return {
    name: apiRoute.name || '',
    type: getRouteType(apiRoute.type || ''),
    grade: apiRoute.rating || '',
    pitches: apiRoute.pitches || -1,
    ticks: {},
  };
}

function addAreaToAreaMap(id: AreaId, components: string[], map: AreaMap) {
  const name = components[0];
  if (!map.children[name]) map.children[name] = { children: {} };

  // If we're down to the final component, we're done. Otherwise, recurse.
  if (components.length == 1) map.children[name].doc = id;
  else addAreaToAreaMap(id, components.slice(1), map.children[name]);
}
</script>
