<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <!-- TODO: Display a hint pointing the user at the import view if no ticks are
       present. -->
  <v-treeview
    dense
    :items="items"
    :load-children="loadItem"
    open-on-click
    v-if="ready"
  >
    <template v-slot:prepend="{ item }">
      <v-icon class="tree-icon">{{ item.icon }} </v-icon>
    </template>
    <template v-slot:label="{ item }">
      <div v-if="item.tickDate">
        <div>
          <span class="tick-date">{{ item.tickDate }}</span>
          <span class="tick-style">{{ item.tickStyle }}</span>
        </div>
        <div class="tick-notes">{{ item.tickNotes }}</div>
      </div>
      <span v-else>{{ item.name }}</span>
    </template>
  </v-treeview>
  <Spinner v-else />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { areaMapRef, areaRef, routeRef } from '@/docs';
import {
  Area,
  AreaId,
  AreaMap,
  Route,
  RouteId,
  RouteSummary,
  TickId,
  Tick,
  TickStyleToString,
} from '@/models';
import Spinner from '@/components/Spinner.vue';

// Interface for items in the v-treeview.
interface Item {
  readonly id: string; // default 'item-key' property for v-treeview
  readonly name: string;
  readonly icon: string;

  readonly tickDate?: string;
  readonly tickStyle?: string;
  readonly tickNotes?: string;

  // v-treeview will call loadItem(), which calls loadChildren(), if the
  // |children| property contains an empty array. If it's undefined, the item
  // has no children.
  readonly children: Item[] | undefined;

  // Called to dynamically populate |children| when the item is clicked.
  loadChildren(): Promise<void>;
}

class TickItem implements Item {
  readonly id: string;
  readonly name: string;
  readonly icon = 'check';
  readonly isTick = true;
  readonly children = undefined;

  readonly tickId: TickId;
  readonly tick: Tick;

  constructor(parentId: string, tickId: TickId, tick: Tick) {
    this.id = `${parentId}|tick-${tickId}`;
    this.name = tick.date;
    this.isTick = true;
    this.tickId = tickId;
    this.tick = tick;
  }

  get tickDate(): string {
    const year = this.tick.date.substring(0, 4);
    const month = this.tick.date.substring(4, 6);
    const day = this.tick.date.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  get tickStyle(): string {
    return TickStyleToString(this.tick.style);
  }
  get tickNotes(): string {
    return this.tick.notes || '';
  }

  loadChildren(): Promise<void> {
    // Not reached since |children| is undefined.
    throw new Error('Ticks have no children');
  }
}

class RouteItem implements Item {
  readonly id: string;
  readonly name: string;
  readonly icon = 'view_list';
  children: Item[] = []; // initially empty to force dynamic loading of ticks

  readonly routeId: RouteId;

  constructor(parentId: string, routeId: RouteId, summary: RouteSummary) {
    this.id = `${parentId}|${routeId}`;
    this.name = `${summary.name} (${summary.grade})`;
    this.routeId = routeId;
  }

  loadChildren(): Promise<void> {
    return routeRef(this.routeId)
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
  readonly icon = 'photo';
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

  loadChildren(): Promise<void> {
    return areaRef(this.areaId!)
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

@Component({ components: { Spinner } })
export default class Ticks extends Vue {
  items: Item[] = [];

  ready = false;

  mounted() {
    areaMapRef()
      .get()
      .then(snap => {
        this.ready = true;
        if (!snap.exists) return;
        const map = snap.data() as AreaMap;
        this.items = Object.entries(map.children || {})
          .sort()
          .map(([name, child]) => new AreaItem('', child, name));
      });
  }

  loadItem(item: Item): Promise<void> {
    return item.loadChildren();
  }
}
</script>

<style scoped>
>>> .v-treeview-node__content {
  align-items: flex-start;
}
.tree-icon {
  opacity: 0.8;
}
.tick-style {
  background-color: #eee;
  border: solid 1px #ddd;
  border-radius: 8px;
  font-size: 11px;
  margin-left: 6px;
  padding: 2px 5px;
  vertical-align: middle;
}
.tick-notes {
  white-space: normal;
  font-size: 12px;
}
</style>
