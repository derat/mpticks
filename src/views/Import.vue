<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div class="mx-3">
    <v-row>
      <v-col cols="12" lg="8">
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
        <v-col cols="12" lg="6" class="py-0">
          <v-text-field
            ref="emailField"
            label="Email address"
            v-model="email"
            :rules="emailRules"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" lg="6" class="py-0">
          <v-text-field
            ref="keyField"
            label="API key"
            v-model="key"
            :rules="keyRules"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" lg="6">
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

import firebase from 'firebase/app';
import app from '@/firebase';

import {
  areaMapRef,
  areaRef,
  countsRef,
  importsRef,
  userRef,
  routeRef,
} from '@/docs';
import { getRoutes, getTicks } from '@/api';
import {
  Area,
  AreaId,
  AreaMap,
  Counts,
  importedRoutesBatchSize,
  importedTicksBatchSize,
  numTopRoutes,
  Route,
  RouteId,
  Tick,
  TickId,
  User,
} from '@/models';
import {
  addAreaToAreaMap,
  createTick,
  createRoute,
  makeAreaId,
  getRegion,
} from '@/convert';
import { parseDate, getDayOfWeek } from '@/dateutil';
import { truncateLatLong } from '@/geoutil';

@Component
export default class Import extends Vue {
  // Models for UI components.
  email = '';
  key = '';
  remember = false;
  logMessages: string[] = [];

  // Whether the form contains valid input.
  valid = false;

  // Time at which the current import started in toISOString() format, e.g.
  // '2020-02-09T13:34:03.195Z'. Empty when not importing.
  importStartTime = '';

  // Rules for input fields.
  emailRules = [(v: string) => !!v || 'Email address must be supplied'];
  keyRules = [(v: string) => !!v || 'Private key must be supplied'];

  // localStorage item names.
  readonly emailItem = 'importEmail';
  readonly keyItem = 'importKey';

  get importing() {
    return !!this.importStartTime;
  }

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

    // Scroll the log messages down after the new message is added.
    window.setTimeout(() => {
      // I have no idea why, but the element seems to be missing in tests.
      const textarea = document.getElementById('log-textarea');
      if (textarea) textarea.scrollTop = textarea.scrollHeight;
    }, 0);
  }

  onImportClick() {
    if (this.remember) {
      window.localStorage.setItem(this.emailItem, this.email);
      window.localStorage.setItem(this.keyItem, this.key);
    } else {
      window.localStorage.removeItem(this.emailItem);
      window.localStorage.removeItem(this.keyItem);
    }

    const routes = new Map<RouteId, Route>();
    const routeTicks = new Map<RouteId, Map<TickId, Tick>>();
    const batch = app.firestore().batch();

    this.importStartTime = new Date().toISOString();
    this.getTicks(routeTicks, batch)
      .then(() => this.getRoutes(Array.from(routeTicks.keys()), routes, batch))
      .then(() => this.updateRoutes(routeTicks, routes, batch))
      .then(() => this.updateStats(routeTicks, routes, batch))
      .then(() => {
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
        this.importStartTime = '';
      });
  }

  // Requests new ticks from Mountain Project and creates corresponding Tick
  // objects in |routeTicks|. The user doc is updated to contain the new max
  // tick ID and written using |batch|.
  getTicks(
    routeTicks: Map<RouteId, Map<TickId, Tick>>,
    batch: firebase.firestore.WriteBatch
  ): Promise<void> {
    this.log('Loading user doc...');
    return userRef()
      .get()
      .then(snap => {
        let maxTickId = snap.exists ? (snap.data() as User).maxTickId || 0 : 0;
        this.log(`Importing ticks newer than ${maxTickId}...`);
        return getTicks(this.email, this.key, maxTickId + 1).then(apiTicks => {
          this.log(`Got ${apiTicks.length} new tick(s).`);
          if (!apiTicks.length) return;

          for (const apiTick of apiTicks) {
            try {
              const routeId = apiTick.routeId;
              if (!routeTicks.get(routeId)) {
                routeTicks.set(routeId, new Map<TickId, Tick>());
              }
              routeTicks.get(routeId)!.set(apiTick.tickId, createTick(apiTick));
              maxTickId = Math.max(maxTickId, apiTick.tickId);
            } catch (err) {
              this.log(`Skipping invalid tick ${apiTick}: ${err}`, true);
            }
          }
          batch.set(userRef(), { maxTickId }, { merge: true });

          // Save the original data from the API "just in case".
          for (let i = 0; i * importedTicksBatchSize < apiTicks.length; i++) {
            batch.set(importsRef(`${this.importStartTime}.ticks.${i}`), {
              ticks: apiTicks.slice(
                i * importedTicksBatchSize,
                (i + 1) * importedTicksBatchSize
              ),
            });
          }
        });
      });
  }

  // Loads routes identified by |ids| into |routes|. If a route isn't present
  // in Firestore, it is imported from Mountain Project. If routes are imported,
  // their areas are updated using |batch|.
  getRoutes(
    ids: RouteId[],
    routes: Map<RouteId, Route>,
    batch: firebase.firestore.WriteBatch
  ): Promise<void> {
    if (!ids.length) return Promise.resolve();

    return this.loadRoutesFromFirestore(ids, routes).then(missing => {
      if (!missing.length) return Promise.resolve();

      // Get the missing routes from the Mountain Project API.
      this.log(`Importing ${missing.length} route(s) from Mountain Project...`);
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

        // Increment the total route count.
        batch.set(
          userRef(),
          {
            numRoutes: firebase.firestore.FieldValue.increment(newRoutes.size),
          },
          { merge: true }
        );

        // Save the original data from Mountain Project.
        for (let i = 0; i * importedRoutesBatchSize < apiRoutes.length; i++) {
          batch.set(importsRef(`${this.importStartTime}.routes.${i}`), {
            routes: apiRoutes.slice(
              i * importedRoutesBatchSize,
              (i + 1) * importedRoutesBatchSize
            ),
          });
        }

        // Load and update Firestore area documents to list the new routes.
        return this.saveRoutesToAreas(newRoutes, batch);
      });
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
    this.log(`Loading ${ids.length} route(s) from Firestore...`);
    return Promise.all(
      ids.map(id =>
        routeRef(id)
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

    this.log('Updating areas...');

    // Figure out which areas are needed.
    const areaLocations = new Map<AreaId, string[]>();
    for (const r of routes.values()) {
      areaLocations.set(makeAreaId(r.location), r.location);
    }

    const areas = new Map<AreaId, Area>();
    let areaMap: AreaMap = {};

    // Load the area map from Firestore so new areas can be added to it.
    return areaMapRef()
      .get()
      .then(snap => {
        if (snap.exists) areaMap = snap.data() as AreaMap;
      })
      .then(() =>
        // Try to load each area from Firestore.
        Promise.all(
          Array.from(areaLocations).map(([areaId, location]) =>
            areaRef(areaId)
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
        batch.set(areaMapRef(), areaMap);
        areas.forEach((area: Area, areaId: AreaId) => {
          batch.set(areaRef(areaId), area);
        });
      });
  }

  // Records the ticks in |routeTicks| to |routes| and sets the updated data in
  // |batch|.
  updateRoutes(
    routeTicks: Map<RouteId, Map<TickId, Tick>>,
    routes: Map<RouteId, Route>,
    batch: firebase.firestore.WriteBatch
  ) {
    if (!routeTicks.size) return;

    this.log('Updating routes...');

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
      batch.set(routeRef(routeId), route);
    });
  }

  // Loads, updates, and writes the stats document to include the ticks in
  // |routeTicks|. |routes| is used to get route information; the ticks in
  // |routeTicks| should already be incorporated.
  updateStats(
    routeTicks: Map<RouteId, Map<TickId, Tick>>,
    routes: Map<RouteId, Route>,
    batch: firebase.firestore.WriteBatch
  ): Promise<void> {
    if (!routeTicks.size) return Promise.resolve();

    this.log('Updating stats...');
    return countsRef()
      .get()
      .then(snap => {
        const counts: Counts = {
          datePitches: {},
          dateTicks: {},
          dayOfWeekPitches: {},
          dayOfWeekTicks: {},
          gradeTicks: {},
          latLongTicks: {},
          pitchesTicks: {},
          regionTicks: {},
          routeTicks: {},
          routeTypeTicks: {},
          tickStyleTicks: {},
        };
        if (snap.exists) Object.assign(counts, snap.data()!);

        const inc = (
          map: Record<string | number, number>,
          key: string | number | undefined,
          val: number | undefined = 1
        ) => {
          if (typeof key === 'undefined') return;
          // https://stackoverflow.com/a/13298258/6882947
          map[key] = map[key] + val || val;
        };

        routeTicks.forEach((ticks: Map<TickId, Tick>, routeId: RouteId) => {
          const route = routes.get(routeId);
          if (!route) return;

          // Overwrite old per-route counts. These should only increase since we
          // never remove ticks.
          counts.routeTicks[`${routeId}|${route.name}`] = Object.keys(
            route.ticks
          ).length;

          const latLong = truncateLatLong(route.lat, route.long);
          const region = getRegion(route.location);
          ticks.forEach((tick: Tick, tickId: TickId) => {
            const dayOfWeek = getDayOfWeek(parseDate(tick.date));

            inc(counts.datePitches, tick.date, tick.pitches);
            inc(counts.dateTicks, tick.date);
            inc(counts.dayOfWeekPitches, dayOfWeek, tick.pitches);
            inc(counts.dayOfWeekTicks, dayOfWeek);
            inc(counts.gradeTicks, route.grade);
            inc(counts.latLongTicks, latLong);
            inc(counts.pitchesTicks, tick.pitches);
            inc(counts.regionTicks, region);
            // |routeTicks| is updated above and below.
            inc(counts.routeTypeTicks, route.type);
            inc(counts.tickStyleTicks, tick.style);
          });
        });

        // Preserve the top routes. We're able to keep this up-to-date without
        // needing to maintain counts for all routes since all routes with new
        // ticks were added with their updated counts in the above loop over
        // |routeTicks|.
        counts.routeTicks = Object.fromEntries(
          Object.entries(counts.routeTicks)
            .sort((a, b) => b[1] - a[1])
            .slice(0, numTopRoutes)
        );

        batch.set(countsRef(), counts);
      });
  }
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
