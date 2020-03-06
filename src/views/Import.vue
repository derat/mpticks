<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div class="mx-3">
    <Alert ref="errorAlert" :text.sync="errorMsg" />

    <v-row>
      <v-col cols="12" lg="8">
        <p>
          Enter the email address that you use to log in to Mountain Project and
          your private API key displayed at the right side or bottom of
          <a target="_blank" href="https://www.mountainproject.com/data"
            >this page</a
          >.
        </p>
        <p>
          Ticks that were added in Mountain Project since the last time that you
          did an import will be saved to this site.
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
            autocomplete="email"
            name="email"
            type="email"
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
      <v-col>
        <v-btn
          ref="importButton"
          color="primary"
          :disabled="!valid || importing || reimporting"
          @click="onImportClick"
          >{{ importing ? 'Importing...' : 'Import new ticks' }}</v-btn
        >
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" lg="8">
        <v-btn
          ref="showAdvancedButton"
          v-if="!showAdvanced"
          @click="showAdvanced = true"
          small
          >Show advanced</v-btn
        >
        <template v-if="showAdvanced">
          <div class="body-2">
            <p>
              If routes have been updated in Mountain Project since they were
              initially imported (e.g. names, grades, or areas have been
              changed), you can reimport them into this app. Your ticks will not
              be modified.
            </p>

            <p class="reimport-warning">
              Note that this eats up this app's quota and might be slow, and if
              you do it too often Mountain Project may block your account's
              access to their API. Please use it sparingly.
            </p>
          </div>
          <v-btn
            ref="reimportRoutesButton"
            :disabled="!valid || importing || reimporting"
            @click="onReimportRoutesClick"
            small
            >{{ reimporting ? 'Reimporting...' : 'Reimport routes' }}</v-btn
          >
        </template>
      </v-col>
    </v-row>

    <v-row v-if="logMessages.length">
      <v-col cols="12" md="8">
        <v-textarea
          id="log-textarea"
          label="Log"
          :value="logMessages.join('\n')"
          hide-details
          outlined
          readonly
          rows="8"
        />
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import _ from 'lodash';
import { Component, Vue } from 'vue-property-decorator';
import Alert from '@/components/Alert.vue';

import firebase from 'firebase/app';
import app from '@/firebase';

import { importsRef, userRef, routeRef } from '@/docs';
import { ApiRoute, ApiTick, getApiRoutes, getApiTicks } from '@/api';
import {
  Counts,
  importedRoutesBatchSize,
  importedTicksBatchSize,
  Route,
  RouteId,
  Tick,
  TickId,
  User,
} from '@/models';
import { createTick, createRoute } from '@/convert';
import {
  getRouteTicks,
  loadAllRoutes,
  saveRoutesToAreas,
  updateCounts,
} from '@/update';

@Component({ components: { Alert } })
export default class Import extends Vue {
  // Models for UI components.
  errorMsg = '';
  email = '';
  key = '';
  remember = false;
  logMessages: string[] = [];

  // Whether the form contains valid input.
  valid = false;

  // Whether advanced options are shown.
  showAdvanced = false;

  // Time at which the current import started. Null when not importing.
  importStartTime: Date | null = null;

  // Time at which route data reimport started. Null when not reimporting.
  reimportStartTime: Date | null = null;

  // Rules for input fields.
  emailRules = [(v: string) => !!v || 'Email address must be supplied'];
  keyRules = [(v: string) => !!v || 'Private key must be supplied'];

  // localStorage item names.
  readonly emailItem = 'importEmail';
  readonly keyItem = 'importKey';

  get importing() {
    return !!this.importStartTime;
  }
  get reimporting() {
    return !!this.reimportStartTime;
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

    this.importStartTime = new Date(Date.now()); // tests mock Date.now()
    this.errorMsg = '';

    const routes = new Map<RouteId, Route>();
    const routeTicks = new Map<RouteId, Map<TickId, Tick>>();

    const batch = app.firestore().batch();
    batch.set(
      userRef(),
      {
        // Sets the field to 1 if it doesn't exist already.
        numImports: firebase.firestore.FieldValue.increment(1),
        lastImportTime: this.importStartTime,
      },
      { merge: true }
    );

    this.getTicks(routeTicks, batch)
      .then(() => this.getRoutes(Array.from(routeTicks.keys()), routes, batch))
      .then(() => this.updateRoutes(routeTicks, routes, batch))
      .then(
        (): Promise<void | Counts> => {
          if (!routeTicks.size) return Promise.resolve();
          this.log('Updating stats...');
          return updateCounts(routeTicks, routes, false /* overwrite */, batch);
        }
      )
      .then(() => {
        this.log('Writing updated data to Firestore...');
        return batch.commit();
      })
      .then(() => {
        this.log('Import complete.');
      })
      .catch(err => {
        const msg = `Import failed: ${err.message}`;
        this.errorMsg = msg;
        this.log(msg, true);
      })
      .finally(() => {
        this.importStartTime = null;
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
        if (snap.metadata.fromCache) {
          throw new Error("Can't update user doc using cached data");
        }
        let maxTickId = snap.exists ? (snap.data() as User).maxTickId || 0 : 0;
        this.log(`Importing ticks newer than ${maxTickId}...`);
        return getApiTicks(this.email, this.key, maxTickId + 1).then(
          apiTicks => {
            this.log(`Got ${apiTicks.length} new tick(s).`);
            if (!apiTicks.length) return;

            for (const apiTick of apiTicks) {
              try {
                const routeId = apiTick.routeId;
                if (!routeTicks.get(routeId)) {
                  routeTicks.set(routeId, new Map<TickId, Tick>());
                }
                routeTicks
                  .get(routeId)!
                  .set(apiTick.tickId, createTick(apiTick));
                maxTickId = Math.max(maxTickId, apiTick.tickId);
              } catch (err) {
                this.log(`Skipping invalid tick ${apiTick}: ${err}`, true);
              }
            }
            batch.set(userRef(), { maxTickId }, { merge: true });

            // Save the original data from the API "just in case".
            this.saveImportedTicks(this.importStartTime!, apiTicks, batch);
          }
        );
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
      return getApiRoutes(missing, this.key).then(apiRoutes => {
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
        this.saveImportedRoutes(this.importStartTime!, apiRoutes, batch);

        this.log('Updating areas...');
        return saveRoutesToAreas(newRoutes, false /* overwrite */, batch);
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
            if (snap.metadata.fromCache) {
              throw new Error("Can't update routes while offline");
            }
            if (!snap.exists) return id;
            routes.set(id, snap.data() as Route);
            return 0;
          })
      )
    ).then(ids => ids.filter(id => !!id));
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

  // Loads all routes from Firebase and then fetches the corresponding routes
  // from Mountain Project and updates metadata (but not ticks). Area and stats
  // documents are also regenerated.
  onReimportRoutesClick() {
    this.reimportStartTime = new Date(Date.now()); // tests mock Date.now()
    this.errorMsg = '';

    let routes = new Map<RouteId, Route>();
    let updatedApiRoutes: ApiRoute[] = [];

    const batch = app.firestore().batch();
    batch.set(
      userRef(),
      { numReimports: firebase.firestore.FieldValue.increment(1) },
      { merge: true }
    );

    this.log('Loading routes from Firestore...');
    loadAllRoutes()
      .then(oldRoutes => {
        routes = oldRoutes;
        this.log(`Loaded ${routes.size} route(s) from Firestore.`);
        this.log('Fetching route data from Mountain Project...');
        return getApiRoutes(Array.from(routes.keys()), this.key);
      })
      .then(apiRoutes => {
        this.log(`Fetched ${apiRoutes.length} route(s) from Mountain Project.`);
        for (const apiRoute of apiRoutes) {
          const routeId: RouteId = apiRoute.id;
          const newRoute = createRoute(apiRoute);
          const oldRoute = routes.get(routeId);
          if (!oldRoute) continue;

          newRoute.ticks = oldRoute.ticks;
          if (typeof oldRoute.deletedTicks !== 'undefined') {
            newRoute.deletedTicks = oldRoute.deletedTicks;
          }
          if (_.isEqual(newRoute, oldRoute)) continue;

          routes.set(routeId, newRoute);
          batch.set(routeRef(routeId), newRoute);
          updatedApiRoutes.push(apiRoute);
        }

        this.log(`Updated ${updatedApiRoutes.length} route(s).`);
        if (!updatedApiRoutes.length) return Promise.resolve();

        // Save the original updated route data.
        this.saveImportedRoutes(
          this.reimportStartTime!,
          updatedApiRoutes,
          batch
        );

        this.log('Updating areas and regenerating stats...');
        return Promise.all([
          saveRoutesToAreas(routes, true, batch),
          updateCounts(getRouteTicks(routes), routes, true, batch),
        ])
          .then(() => {
            this.log('Writing updated data to Firestore...');
            return batch.commit();
          })
          .then(() => {
            this.log('Reimporting routes complete.');
          });
      })
      .catch(err => {
        const msg = `Reimporting routes failed: ${err.message}`;
        this.errorMsg = msg;
        this.log(msg, true);
      })
      .finally(() => {
        this.reimportStartTime = null;
      });
  }

  // Writes |ticks| to one or more documents in the 'imports' subcollection.
  // The document names are based on |time|.
  saveImportedTicks(
    time: Date,
    ticks: ApiTick[],
    batch: firebase.firestore.WriteBatch
  ) {
    for (let i = 0; i * importedTicksBatchSize < ticks.length; i++) {
      batch.set(importsRef().doc(`${time.toISOString()}.ticks.${i}`), {
        ticks: ticks.slice(
          i * importedTicksBatchSize,
          (i + 1) * importedTicksBatchSize
        ),
      });
    }
  }

  // Writes |routes| to one or more documents in the 'imports' subcollection.
  // The document names are based on |time|.
  saveImportedRoutes(
    time: Date,
    routes: ApiRoute[],
    batch: firebase.firestore.WriteBatch
  ) {
    for (let i = 0; i * importedRoutesBatchSize < routes.length; i++) {
      batch.set(importsRef().doc(`${time.toISOString()}.routes.${i}`), {
        routes: routes.slice(
          i * importedRoutesBatchSize,
          (i + 1) * importedRoutesBatchSize
        ),
      });
    }
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
.reimport-warning {
  font-weight: bold;
}
</style>
