<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-treeview dense :items="items" :load-children="loadItem" open-on-click />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import firebase from '@/firebase';
import {
  Area,
  AreaId,
  AreaMap,
  Route,
  RouteId,
  RouteSummary,
  TickId,
  Tick,
} from '@/models';

// Interface for items in the v-treeview.
interface Item {
  readonly id: string; // default 'item-key' property for v-treeview
  readonly name: string;
  // v-treeview will call loadItem(), which calls loadChildren(), if the
  // |children| property contains an empty array. If it's undefined, the item
  // has no children.
  readonly children: Item[] | undefined;

  // Called to dynamically populate |children| when the item is clicked.
  loadChildren(userRef: firebase.firestore.DocumentReference): Promise<void>;
}

class TickItem implements Item {
  readonly id: string;
  readonly name: string;
  readonly children = undefined;
  readonly tickId: TickId;

  constructor(parentId: string, tickId: TickId, tick: Tick) {
    this.id = `${parentId}|tick-${tickId}`;
    this.name = tick.date;
    this.tickId = tickId;
    // TODO: Collect more information about the tick.
  }

  loadChildren(userRef: firebase.firestore.DocumentReference): Promise<void> {
    // Not reached since |children| is undefined.
    throw new Error('Ticks have no children');
  }
}

class RouteItem implements Item {
  readonly id: string;
  readonly name: string;
  children: Item[] = []; // initially empty to force dynamic loading of ticks

  readonly routeId: RouteId;

  constructor(parentId: string, routeId: RouteId, summary: RouteSummary) {
    this.id = `${parentId}|${routeId}`;
    this.name = `${summary.name} (${summary.grade})`;
    this.routeId = routeId;
  }

  loadChildren(userRef: firebase.firestore.DocumentReference): Promise<void> {
    return userRef
      .collection('routes')
      .doc(this.routeId.toString())
      .get()
      .then(snap => {
        if (!snap.exists) return;
        const route = snap.data() as Route;
        // Sort by descending date and ID.
        this.children = Object.entries(route.ticks)
          .map(
            ([tickId, tick]) => new TickItem(this.id, parseInt(tickId), tick)
          )
          .sort((a, b) => b.name.localeCompare(a.name) || b.tickId - a.tickId);
      });
  }
}

class AreaItem implements Item {
  readonly id: string;
  readonly name: string;
  children: Item[]; // dynamically updated after loading the area doc

  readonly areaId?: AreaId; // only set if this area contains routes
  readonly childAreas: AreaItem[];

  constructor(parentId: string, map: AreaMap, name: string) {
    this.id = parentId + (parentId ? '|' : '') + name;
    this.name = name;
    this.areaId = map.areaId;

    // Construct items for child areas, but if we have an ID (indicating that
    // there are routes in this area), leave |children| empty until we're
    // clicked so we can dynamically load the routes.
    this.childAreas = Object.entries(map.children || {})
      .sort()
      .map(([childName, child]) => new AreaItem(this.id, child, childName));
    this.children = this.areaId ? [] : this.childAreas;
  }

  loadChildren(userRef: firebase.firestore.DocumentReference): Promise<void> {
    return userRef
      .collection('areas')
      .doc(this.areaId!)
      .get()
      .then(snap => {
        if (!snap.exists) return;
        const area = snap.data() as Area;
        this.children = (this.childAreas as Item[]).concat(
          Object.entries(area.routes)
            .map(
              ([routeId, route]) =>
                new RouteItem(this.id, parseInt(routeId), route)
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      });
  }
}

@Component
export default class Ticks extends Vue {
  items: Item[] = [];

  mounted() {
    this.userRef
      .collection('areas')
      .doc('map')
      .get()
      .then(snap => {
        if (!snap.exists) return;
        const map = snap.data() as AreaMap;
        this.items = Object.entries(map.children || {})
          .sort()
          .map(([name, child]) => new AreaItem('', child, name));
      });
  }

  loadItem(item: Item): Promise<void> {
    return item.loadChildren(this.userRef);
  }

  get userRef(): firebase.firestore.DocumentReference {
    return firebase
      .firestore()
      .collection('users')
      .doc(firebase.auth().currentUser!.uid);
  }
}
</script>
