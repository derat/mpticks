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
            ref="emailField"
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
            ref="keyField"
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
        <!-- TODO: Disable this while an import is ongoing. -->
        <v-btn
          ref="importButton"
          color="primary"
          :disabled="!valid"
          @click="onClick"
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
  makeAreaId,
  Route,
  RouteId,
  RouteType,
  Tick,
  TickId,
  TickStyle,
  User,
} from '@/models';

@Component
export default class Import extends Vue {
  // Models for UI components.
  email = '';
  key = '';
  log = '';

  // Whether the form contains valid input.
  valid = false;

  emailRules = [(v: string) => !!v || 'Email address must be supplied'];
  keyRules = [(v: string) => !!v || 'Private key must be supplied'];

  onClick() {
    let user: User = { maxTickId: 0 };
    //let user: User = { maxTickId: 118294181 };
    const routes = new Map<RouteId, Route>();
    const routeTicks = new Map<RouteId, Map<TickId, Tick>>();
    const batch = firebase.firestore().batch();

    this.addLog('Loading user doc to find out where we left off...');
    this.userRef
      .get()
      .then(snap => {
        if (snap.exists) {
          this.addLog(`Last tick was ${user.maxTickId}.`);
          user = snap.data() as User;
        } else {
          this.addLog('No user doc; will import all ticks.');
        }
        this.addLog('Getting new ticks from Mountain Project...');
        return getTicks(this.email, this.key, user.maxTickId + 1);
      })
      .then(apiTicks => {
        this.addLog(`Got ${apiTicks.length} new tick(s).`);
        if (!apiTicks.length) return Promise.resolve();

        for (const apiTick of apiTicks) {
          try {
            const routeId = apiTick.routeId;
            if (!routeTicks.get(routeId)) {
              routeTicks.set(routeId, new Map<TickId, Tick>());
            }
            routeTicks.get(routeId)!.set(apiTick.tickId, createTick(apiTick));
            user.maxTickId = Math.max(user.maxTickId, apiTick.tickId);
          } catch (err) {
            console.log(`Skipping invalid tick ${apiTick}: ${err}`);
            this.addLog(`Skipping invalid tick ${apiTick}: ${err}`);
          }
        }

        const routeIds = Array.from(routeTicks.keys());
        this.addLog(`Loading ${routeIds.length} route(s) from Firestore...`);
        return this.loadRoutesFromFirestore(routeIds, routes).then(missing => {
          if (!missing.length) return Promise.resolve();

          // Get the missing routes from the Mountain Project API.
          this.addLog(
            `Getting ${missing.length} route(s) from Mountain Project...`
          );
          return getRoutes(missing, this.key).then(apiRoutes => {
            // Create the new routes that we got from the API.
            this.addLog(`Got ${apiRoutes.length} route(s).`);
            const newRoutes = new Map<RouteId, Route>();
            for (const r of apiRoutes) {
              const route = createRoute(r);
              routes.set(r.id, route);
              newRoutes.set(r.id, route);
            }
            // Load and update Firestore area documents to list the new routes.
            this.addLog('Updating areas for new routes...');
            return this.saveRoutesToAreas(newRoutes, batch);
          });
        });
      })
      .then(() => {
        if (!routeTicks.size) return Promise.resolve();

        // Add the ticks to the routes.
        routeTicks.forEach((ticks: Map<TickId, Tick>, routeId: RouteId) => {
          ticks.forEach((tick: Tick, tickId: TickId) => {
            routes.get(routeId)!.ticks[tickId] = tick;
          });
        });
        // Write the updated routes to Firestore.
        routes.forEach((route: Route, routeId: RouteId) => {
          batch.set(this.routeRef(routeId), route);
        });
        batch.set(this.userRef, user);
        this.addLog('Writing updated data to Firestore...');
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
    ids: RouteId[],
    routes: Map<RouteId, Route>
  ): Promise<RouteId[]> {
    // Load routes in parallel, returning IDs of missing routes and 0 for
    // success.
    return Promise.all(
      ids.map(id =>
        this.routeRef(id)
          .get()
          .then(snap => {
            if (!snap.exists) return id;
            routes.set(id, snap.data() as Route);
            return 0;
          })
      )
    ).then(ids => ids.filter(id => !!id));
  }

  // Loads areas from Firestore and adds each route to the appropriate area.
  saveRoutesToAreas(
    routes: Map<RouteId, Route>,
    batch: firebase.firestore.WriteBatch
  ): Promise<void> {
    if (!routes.size) return Promise.resolve();

    // Figure out which areas are needed.
    const areaLocations = new Map<AreaId, string[]>();
    for (const r of routes.values()) {
      areaLocations.set(makeAreaId(r.location), r.location);
    }

    const areas = new Map<AreaId, Area>();
    let areaMap: AreaMap = {};

    // Load the area map from Firestore so new areas can be added to it.
    return this.areaMapRef
      .get()
      .then(snap => {
        if (snap.exists) areaMap = snap.data() as AreaMap;
      })
      .then(() =>
        // Try to load each area from Firestore.
        Promise.all(
          Array.from(areaLocations).map(([areaId, location]) =>
            this.areaRef(areaId)
              .get()
              .then(snap => {
                if (snap.exists) {
                  areas.set(areaId, snap.data() as Area);
                } else {
                  areas.set(areaId, { routes: {} });
                  addAreaToAreaMap(areaId, location, areaMap);
                }
              })
          )
        )
      )
      .then(() => {
        // Update areas to contain route summaries.
        routes.forEach((route: Route, routeId: RouteId) => {
          areas.get(makeAreaId(route.location))!.routes[routeId] = {
            name: route.name,
            grade: route.grade,
          };
        });
        // Queue up writes.
        batch.set(this.areaMapRef, areaMap);
        areas.forEach((area: Area, areaId: AreaId) => {
          batch.set(this.areaRef(areaId), area);
        });
      });
  }

  get userRef() {
    return firebase
      .firestore()
      .collection('users')
      .doc(firebase.auth().currentUser!.uid);
  }

  routeRef(id: RouteId) {
    return this.userRef.collection('routes').doc(id.toString());
  }

  areaRef(id: AreaId) {
    return this.userRef.collection('areas').doc(id);
  }

  get areaMapRef() {
    return this.areaRef('map');
  }
}

// Converts the |style| and |leadStyle| values from an ApiTick object to the
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

// Creates a Tick describing the supplied tick returned by the get-ticks API
// endpoint. Throws an error if key information is missing.
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

// Converts the |type| value from an ApiRoute object to the RouteType enum used
// by the Route object.
function getRouteType(apiType: string): RouteType {
  if (apiType.startsWith('Sport')) return RouteType.SPORT;
  if (apiType.startsWith('Trad')) return RouteType.TRAD;
  return RouteType.OTHER;
}

// Creates a Route describing the supplied route returned by the get-routes API
// endpoint. Throws an error if key information is missing.
function createRoute(apiRoute: ApiRoute): Route {
  if (!apiRoute.id) throw new Error('Missing route ID');

  return {
    name: apiRoute.name || '',
    type: getRouteType(apiRoute.type || ''),
    location: apiRoute.location,
    grade: apiRoute.rating || '',
    pitches: apiRoute.pitches || -1,
    ticks: {},
  };
}

// Recursively walks |map| in order to add an area identified by |id|.
// |location| contains the area's location components, e.g.
// ['Colorado', 'Boulder', 'Boulder Canyon', 'Castle Rock'].
function addAreaToAreaMap(id: AreaId, location: string[], map: AreaMap) {
  const name = location[0];
  if (!map.children) map.children = {};
  if (!map.children[name]) map.children[name] = {};

  // If we're down to the final component, we're done. Otherwise, recurse.
  if (location.length == 1) map.children[name]!.areaId = id;
  else addAreaToAreaMap(id, location.slice(1), map.children[name]!);
}
</script>
