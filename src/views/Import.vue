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

        <p class="data-note caption">
          This information is only used to fetch your ticks and routes. In fact,
          it goes directly from your browser to Mountain Project's servers and
          isn't sent to this website.
        </p>
      </v-col>
    </v-row>

    <v-form v-model="valid" @submit.prevent>
      <v-row>
        <v-col cols="12" md="6" class="py-0">
          <v-text-field
            ref="emailField"
            label="Email address"
            v-model="email"
            :rules="emailRules"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="6" class="py-0">
          <v-text-field
            ref="keyField"
            label="API key"
            v-model="key"
            :rules="keyRules"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="8">
          <v-checkbox
            label="Remember email and key in browser"
            v-model="remember"
            dense
            hide-details
            class="mt-0"
          />
        </v-col>
      </v-row>
    </v-form>

    <v-row>
      <v-col class="pb-1">
        <v-btn
          ref="importButton"
          color="primary"
          :disabled="!valid || importing"
          @click="onImportClick"
          >{{ importButtonLabel }}</v-btn
        >
      </v-col>
    </v-row>

    <v-row v-if="logMessages.length">
      <v-col cols="12" md="8">
        <v-textarea
          id="log-textarea"
          label="Log"
          :value="logMessages.join('\n')"
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
  TickStats,
  TickStyle,
  User,
} from '@/models';
import { parseDate, getDayOfWeek } from '@/dateutil';

@Component
export default class Import extends Vue {
  // Models for UI components.
  email = '';
  key = '';
  remember = false;
  logMessages: string[] = [];

  // Whether the form contains valid input.
  valid = false;

  // Whether an import is in progress.
  importing = false;

  // Rules for input fields.
  emailRules = [(v: string) => !!v || 'Email address must be supplied'];
  keyRules = [(v: string) => !!v || 'Private key must be supplied'];

  // localStorage item names.
  readonly emailItem = 'importEmail';
  readonly keyItem = 'importKey';

  get importButtonLabel() {
    return this.importing ? 'Importing...' : 'Import';
  }

  mounted() {
    const email = window.localStorage.getItem(this.emailItem);
    if (email) this.email = email;
    const key = window.localStorage.getItem(this.keyItem);
    if (key) this.key = key;
    if (email || key) this.remember = true;
  }

  log(msg: string, isErr = false) {
    this.logMessages.push(msg);
    if (isErr) console.error(msg);

    // Scroll the log messages down.
    // I have no idea why, but the element seems to be missing in tests.
    const textarea = document.getElementById('log-textarea');
    if (textarea) textarea.scrollTop = textarea.scrollHeight;
  }

  onImportClick() {
    if (this.remember) {
      window.localStorage.setItem(this.emailItem, this.email);
      window.localStorage.setItem(this.keyItem, this.key);
    } else {
      window.localStorage.removeItem(this.emailItem);
      window.localStorage.removeItem(this.keyItem);
    }

    let user: User = { maxTickId: 0 };
    //let user: User = { maxTickId: 118294181 };
    const routes = new Map<RouteId, Route>();
    const routeTicks = new Map<RouteId, Map<TickId, Tick>>();
    const batch = firebase.firestore().batch();

    this.importing = true;

    this.log('Loading user doc to see where we left off...');
    this.userRef
      .get()
      .then(snap => {
        if (snap.exists) {
          user = snap.data() as User;
          this.log(`Last tick was ${user.maxTickId}.`);
        } else {
          this.log('No user doc; will import all ticks.');
        }
        this.log('Getting new ticks from Mountain Project...');
        return getTicks(this.email, this.key, user.maxTickId + 1);
      })
      .then(apiTicks => {
        this.log(`Got ${apiTicks.length} new tick(s).`);
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
            this.log(`Skipping invalid tick ${apiTick}: ${err}`, true);
          }
        }

        const routeIds = Array.from(routeTicks.keys());
        this.log(`Loading ${routeIds.length} route(s) from Firestore...`);
        return this.loadRoutesFromFirestore(routeIds, routes).then(missing => {
          if (!missing.length) return Promise.resolve();

          // Get the missing routes from the Mountain Project API.
          this.log(
            `Getting ${missing.length} route(s) from Mountain Project...`
          );
          return getRoutes(missing, this.key).then(apiRoutes => {
            // Create the new routes that we got from the API.
            this.log(`Got ${apiRoutes.length} route(s).`);
            const newRoutes = new Map<RouteId, Route>();
            for (const apiRoute of apiRoutes) {
              try {
                const route = createRoute(apiRoute);
                routes.set(apiRoute.id, route);
                newRoutes.set(apiRoute.id, route);
              } catch (err) {
                this.log(`Skipping invalid route ${apiRoute}: ${err}`, true);
              }
            }
            // Load and update Firestore area documents to list the new routes.
            this.log('Updating areas for new routes...');
            return this.saveRoutesToAreas(newRoutes, batch);
          });
        });
      })
      .then(() => this.updateStats(routeTicks, routes, batch))
      .then(() => {
        if (!routeTicks.size) return Promise.resolve();

        // Add the ticks to the routes.
        routeTicks.forEach((ticks: Map<TickId, Tick>, routeId: RouteId) => {
          const route = routes.get(routeId);
          if (!route) {
            this.log(
              `Skipping ${ticks.size} tick(s) for missing route ${routeId}`,
              true
            );
            return;
          }
          ticks.forEach((tick: Tick, tickId: TickId) => {
            route.ticks[tickId] = tick;
          });
        });
        // Write the updated routes to Firestore.
        routes.forEach((route: Route, routeId: RouteId) => {
          batch.set(this.routeRef(routeId), route);
        });
        batch.set(this.userRef, user);
        this.log('Writing updated data to Firestore...');
        return batch.commit();
      })
      .then(() => {
        this.log('Import complete.');
      })
      .catch(err => {
        this.log(`Import failed: ${err}`, true);
      })
      .finally(() => {
        this.importing = false;
      });
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

  // Loads, updates, and writes the stats document to include the ticks in
  // |routeTicks|. |routes| is used to get route information.
  updateStats(
    routeTicks: Map<RouteId, Map<TickId, Tick>>,
    routes: Map<RouteId, Route>,
    batch: firebase.firestore.WriteBatch
  ): Promise<void> {
    if (!routeTicks.size) return Promise.resolve();

    this.log('Updating stats...');

    let stats: TickStats = {
      areas: {},
      dates: {},
      daysOfWeek: {},
      grades: {},
      routes: {},
      routePitches: {},
      routeTypes: {},
      tickPitches: {},
      tickStyles: {},
    };

    return this.statsTicksRef.get().then(snap => {
      if (snap.exists) stats = snap.data()! as TickStats;

      routeTicks.forEach((ticks: Map<TickId, Tick>, routeId: RouteId) => {
        const route = routes.get(routeId);
        if (!route) return;
        const areaId = makeAreaId(route.location);
        ticks.forEach((tick: Tick, tickId: TickId) => {
          const dayOfWeek = getDayOfWeek(parseDate(tick.date));

          // https://stackoverflow.com/a/13298258/6882947
          stats.areas[areaId] = ++stats.areas[areaId] || 1;
          stats.dates[tick.date] = ++stats.dates[tick.date] || 1;
          stats.daysOfWeek[dayOfWeek] = ++stats.daysOfWeek[dayOfWeek] || 1;
          stats.grades[route.grade] = ++stats.grades[route.grade] || 1;
          stats.routes[routeId] = ++stats.routes[routeId] || 1;
          if (typeof route.pitches !== 'undefined') {
            stats.routePitches[route.pitches] =
              ++stats.routePitches[route.pitches] || 1;
          }
          stats.routeTypes[route.type] = ++stats.routeTypes[route.type] || 1;
          if (typeof tick.pitches !== 'undefined') {
            stats.tickPitches[tick.pitches] =
              ++stats.tickPitches[tick.pitches] || 1;
          }
          stats.tickStyles[tick.style] = ++stats.tickStyles[tick.style] || 1;
        });
      });

      batch.set(this.statsTicksRef, stats);
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

  get statsTicksRef() {
    return this.userRef.collection('stats').doc('ticks');
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

  const tick: Tick = {
    date: apiTick.date.replace(/-/g, ''),
    style: getTickStyle(apiTick.style, apiTick.leadStyle),
  };
  if (apiTick.pitches > -1) tick.pitches = apiTick.pitches;
  if (apiTick.notes) tick.notes = apiTick.notes;
  if (apiTick.userStars > -1) tick.stars = apiTick.userStars;
  if (apiTick.userRating) tick.grade = apiTick.userRating;
  return tick;
}

// Converts the |type| value from an ApiRoute object to the RouteType enum used
// by the Route object.
function getRouteType(apiType: string): RouteType {
  if (apiType.indexOf('Sport') != -1) return RouteType.SPORT;
  if (apiType.indexOf('Trad') != -1) return RouteType.TRAD;
  if (apiType.indexOf('Boulder') != -1) return RouteType.BOULDER;
  return RouteType.OTHER;
}

// Creates a Route describing the supplied route returned by the get-routes API
// endpoint. Throws an error if key information is missing.
function createRoute(apiRoute: ApiRoute): Route {
  if (!apiRoute.id) throw new Error('Missing route ID');
  if (!apiRoute.name) throw new Error('Missing name');
  if (!apiRoute.location || !apiRoute.location.length) {
    throw new Error('Missing location');
  }

  const route: Route = {
    name: apiRoute.name,
    type: getRouteType(apiRoute.type || ''),
    location: apiRoute.location,
    grade: apiRoute.rating || '',
    ticks: {},
  };
  if (apiRoute.pitches > 0) route.pitches = apiRoute.pitches;
  return route;
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

<style scoped>
.data-note {
  margin-bottom: 0;
}
#log-textarea {
  scroll-behavior: smooth;
}
</style>
