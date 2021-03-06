<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div class="mx-3">
    <Alert ref="errorAlert" :text.sync="errorMsg" />
    <v-row>
      <v-col cols="12" lg="8" class="pb-0">
        <p>
          You can download the original ticks and routes that you've imported
          from Mountain Project in
          <a
            href="https://www.digitalocean.com/community/tutorials/an-introduction-to-json"
            target="_blank"
            >JSON format</a
          >.
        </p>

        <p>
          The <code>route.json</code> and <code>tick.json</code> files each
          consist of a JSON array containing all of the objects that have been
          downloaded using the Mountain Project Data API's
          <code>get-routes</code> and <code>get-ticks</code> endpoints,
          respectively. See the
          <a href="https://www.mountainproject.com/data" target="_blank"
            >Data API page</a
          >
          for (marginally) more details. I've also attempted to
          <a
            href="https://github.com/derat/mpticks/blob/master/src/api.ts"
            target="_blank"
            >document the objects' structures</a
          >
          based on what I've seen the API return.
        </p>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-btn
          ref="exportButton"
          color="primary"
          :disabled="exporting || offline"
          @click="onExportClick"
          >{{ exportButtonLabel }}</v-btn
        >
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator';
import Alert from '@/components/Alert.vue';
import NetworkWatcher from '@/mixins/NetworkWatcher.ts';

import { ApiRoute, ApiTick } from '@/api';
import { importsRef } from '@/docs';
import { ImportedRoutes, ImportedTicks } from '@/models';

@Component({ components: { Alert } })
export default class Export extends Mixins(NetworkWatcher) {
  exporting = false; // true while data is being exported
  errorMsg = ''; // data for alert

  get exportButtonLabel(): string {
    return this.exporting ? 'Exporting...' : 'Export';
  }

  onExportClick() {
    this.exporting = true;
    this.errorMsg = '';

    importsRef()
      .get()
      .then(snapshot => {
        if (snapshot.metadata.fromCache) {
          throw new Error("Can't export cached data");
        }
        const routes: ApiRoute[] = [];
        const ticks: ApiTick[] = [];
        snapshot.docs.forEach(doc => {
          if (doc.metadata.fromCache) {
            throw new Error("Can't export cached data");
          }
          if (doc.id.indexOf('.routes.') != -1) {
            routes.push(...((doc.data() as ImportedRoutes).routes || []));
          } else if (doc.id.indexOf('.ticks.') != -1) {
            ticks.push(...((doc.data() as ImportedTicks).ticks || []));
          } else {
            console.log(`Skipping unknown document ${doc.id}`);
          }
        });

        if (!ticks.length && !routes.length) {
          this.errorMsg = 'No ticks or routes found.';
        } else {
          if (ticks.length) this.download('ticks.json', ticks);
          if (routes.length) this.download('routes.json', routes);
        }
      })
      .catch(err => {
        this.errorMsg = `Failed to export data: ${err.message}`;
        console.error(err);
      })
      .finally(() => {
        this.exporting = false;
      });
  }

  // Downloads the JSON representation of |data| as |filename|.
  download(filename: string, obj: Record<string, any>) {
    // https://stackoverflow.com/a/19328891/6882947
    const json = JSON.stringify(obj);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.style.display = 'none';
    link.download = filename;
    link.href = url;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
</script>
