<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-treeview dense :items="items" :load-children="loadItem" open-on-click />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
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
import firebase from '@/firebase';

// Interface for items in the v-treeview.
interface Item {
  readonly id: string; // default 'item-key' property for v-treeview
  readonly name: string;
  // v-treeview will call loadItem(), which calls loadChildren(), if the
  // |children| property contains an empty array. If it's undefined, the item
  // has no children.
  readonly children: Item[] | undefined;

  // Called to dynamically populate |children| when the item is clicked.
  loadChildren(firestore: firebase.firestore.Firestore): Promise<void>;
}

class TickItem implements Item {
  readonly id: string;
  readonly name: string;
  readonly children = undefined;

  constructor(parentId: string, tickId: TickId, tick: Tick) {
    this.id = `${parentId}|tick-${tickId}`;
    this.name = tick.date;
    // TODO: Collect more information about the tick.
  }

  loadChildren(firestore: firebase.firestore.Firestore): Promise<void> {
    // Not reached since |children| is undefined.
    throw new Error('Ticks have no children');
  }
}

class RouteItem implements Item {
  readonly id: string;
  readonly name: string;
  children: Item[] = []; // empty to force dynamic loading of ticks

  readonly routeId: RouteId;

  constructor(parentId: string, routeId: RouteId, summary: RouteSummary) {
    this.id = `${parentId}|${routeId}`;
    this.name = `${summary.name} (${summary.grade})`;
    this.routeId = routeId;
  }

  loadChildren(firestore: firebase.firestore.Firestore): Promise<void> {
    return firestore
      .collection('users')
      .doc('default') // FIXME: UID
      .collection('routes')
      .doc(this.routeId.toString())
      .get()
      .then(snap => {
        if (!snap.exists) return;
        const route = snap.data() as Route;
        // TODO: Sort by descending date and ID.
        this.children = Object.keys(route.ticks)
          .map(id => parseInt(id))
          .map(tickId => new TickItem(this.id, tickId, route.ticks[tickId]));
      });
  }
}

class AreaItem implements Item {
  id: string;
  name: string;
  children: Item[];

  areaId?: AreaId; // only set if this area contains routes
  childAreas: AreaItem[];

  constructor(parentId: string, map: AreaMap, name: string) {
    this.id = parentId + (parentId ? '|' : '') + name;
    this.name = name;
    this.areaId = map.doc;

    // Construct items for child areas, but if we have an ID (indicating that
    // there are routes in this area), leave |children| empty until we're
    // clicked so we can dynamically load the routes.
    this.childAreas = Object.keys(map.children)
      .sort()
      .map(
        childName => new AreaItem(this.id, map.children[childName], childName)
      );
    this.children = this.areaId ? [] : this.childAreas;
  }

  loadChildren(firestore: firebase.firestore.Firestore): Promise<void> {
    return firestore
      .collection('users')
      .doc('default') // FIXME: user ID
      .collection('areas')
      .doc(this.areaId!)
      .get()
      .then(snap => {
        if (!snap.exists) return;
        const area = snap.data() as Area;
        this.children = (this.childAreas as Item[]).concat(
          // TODO: Sort routes by ascending name.
          Object.keys(area.routes)
            .map(id => parseInt(id))
            .map(
              routeId => new RouteItem(this.id, routeId, area.routes[routeId])
            )
        );
      });
  }
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
        if (!snap.exists) return;
        const map = snap.data() as AreaMap;
        this.items = Object.keys(map.children).map(
          name => new AreaItem('', map.children[name], name)
        );
      });
  }

  loadItem(item: Item): Promise<void> {
    return item.loadChildren(firebase.firestore());
  }
}
</script>
