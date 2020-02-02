<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-treeview dense :items="items" :load-children="loadItem" open-on-click />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Area, AreaId, AreaMap, Route, RouteId } from '@/models';
import firebase from '@/firebase';

interface Item {
  id: string; // default 'item-key' property for v-treeview
  name: string;
  children?: Item[];

  areaId?: AreaId;
  areaChildren?: Item[];
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
      .collection('areas')
      .doc('map')
      .get()
      .then(snap => {
        if (snap.exists) this.items = makeItems(snap.data() as AreaMap);
      });
  }

  loadItem(item: Item) {
    if (item.areaId) {
      return firebase
        .firestore()
        .collection('users')
        .doc('default') // FIXME: user ID
        .collection('areas')
        .doc(item.areaId)
        .get()
        .then(snap => {
          if (!snap.exists) return;
          const area = snap.data() as Area;
          item.children = item.areaChildren!.concat(
            Object.keys(area.routes)
              .map(id => parseInt(id))
              .map(routeId => ({
                id: `${item.id}|route-${routeId}`,
                name: area.routes[routeId].name, // TODO: include grade
                children: [], // triggers dynamic loading when item is clicked
                routeId,
              }))
          );
        });
    }

    if (item.routeId) {
      return firebase
        .firestore()
        .collection('users')
        .doc('default') // FIXME: user ID
        .collection('routes')
        .doc(item.routeId.toString())
        .get()
        .then(snap => {
          if (!snap.exists) return;
          const route = snap.data() as Route;
          item.children = Object.keys(route.ticks)
            .map(id => parseInt(id))
            .map(tickId => {
              const tick = route.ticks[tickId];
              return {
                id: `${item.id}|tick-${tickId}`,
                name: `${tick.date}`,
              };
            });
        });
    }
  }
}

function makeItems(map: AreaMap, id = ''): Item[] {
  return Object.keys(map.children)
    .sort()
    .map(name => {
      id += (id ? '|' : '') + name;
      const areaMap = map.children[name];
      const areaChildren = makeItems(areaMap, id);
      return {
        id,
        name,
        children: areaMap.doc ? [] : areaChildren,
        areaId: areaMap.doc,
        areaChildren,
      };
    });
}
</script>
