<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-treeview dense :items="items" :load-children="loadRoute" open-on-click />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Location, Route, RouteId } from '@/models';
import firebase from '@/firebase';

interface Item {
  id: string; // default 'item-key' property for v-treeview
  name: string;
  children?: Item[];
  routeId?: RouteId;
}

@Component
export default class Ticks extends Vue {
  items: Item[] = [];

  mounted() {
    // TODO: Bind the document and compute this dynamically instead.
    firebase
      .firestore()
      .collection('users')
      .doc('default') // FIXME: user ID
      .collection('locations')
      .doc('root')
      .get()
      .then(snap => {
        if (snap.exists) this.items = makeItems(snap.data() as Location);
      });
  }

  loadRoute(item: Item) {
    if (!item.routeId) return;

    return firebase
      .firestore()
      .collection('users')
      .doc('default')
      .collection('routes')
      .doc(item.routeId!.toString())
      .get()
      .then(snap => {
        if (!snap.exists) return;
        const route = snap.data() as Route;
        item.children = Object.keys(route.ticks).map(id => {
          const tickId = parseInt(id);
          const tick = route.ticks[tickId];
          return {
            id: `tick-${tickId}`,
            name: `${tick.date}`,
          };
        });
        console.log(this.items);
      });
  }
}

function makeItems(root: Location, prefix = ''): Item[] {
  // First, add child locations.
  const infos: Item[] = Object.keys(root.children)
    .sort()
    .map(name => ({
      id: prefix + name,
      name: name,
      children: makeItems(root.children[name], prefix + name + '-'),
    }));

  // Next, add the routes that are in the location.
  // TODO: Sort these.
  Object.keys(root.routes)
    .map(id => parseInt(id))
    .forEach(routeId => {
      infos.push({
        id: `route-${routeId}`,
        name: root.routes[routeId],
        routeId: routeId,
        children: [], // triggers dynamic loading when item is clicked
      });
    });

  return infos;
}
</script>
