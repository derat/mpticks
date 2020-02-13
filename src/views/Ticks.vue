<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <!-- TODO: Display a hint pointing the user at the import view if no ticks are
       present. -->
  <!-- I'm not sure why, but v-row adds a negative margin that v-col then seems
       to cancel out with padding. All of this seems to result in the page being
       horizontally scrollable on mobile, so just zero everything out. -->
  <v-row v-if="ready && haveTicks" class="ma-0">
    <v-col cols="12" lg="8" class="pa-0">
      <v-treeview dense :items="items" :load-children="loadItem" open-on-click>
        <template v-slot:prepend="{ item }">
          <v-icon class="tree-icon">{{ item.icon }} </v-icon>
        </template>
        <template v-slot:label="{ item }">
          <div v-if="item.tickId">
            <div>
              <span>{{ item.tickDate }}</span>
              <span class="tick-style" :class="item.tickStyleClass">{{
                item.tickStyle
              }}</span>
              <span class="tick-pitches">{{ item.tickPitches }}</span>
            </div>
            <div class="tick-notes">{{ item.tickNotes }}</div>
          </div>
          <div v-if="item.routeId">
            <span>{{ item.routeName }}</span>
            <span class="route-grade">{{ item.routeGrade }}</span>
            <a
              class="route-link"
              :href="`https://www.mountainproject.com/route/${item.routeId}`"
              target="_blank"
              @click.stop=""
              ><v-icon :size="18">info</v-icon></a
            >
          </div>
          <span v-else>{{ item.areaName }}</span>
        </template>
      </v-treeview>
    </v-col>
  </v-row>
  <NoTicks v-else-if="ready && !haveTicks" class="ma-3" />
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
  TickStyle,
  TickStyleToString,
} from '@/models';
import NoTicks from '@/components/NoTicks.vue';
import Spinner from '@/components/Spinner.vue';

// Interface for items in the v-treeview.
interface Item {
  readonly id: string; // default 'item-key' property for v-treeview
  readonly icon: string;

  // v-treeview will call loadItem(), which calls loadChildren(), if the
  // |children| property contains an empty array. If it's undefined, the item
  // has no children.
  readonly children: Item[] | undefined;

  // Called to dynamically populate |children| when the item is clicked.
  loadChildren(): Promise<void>;
}

class TickItem implements Item {
  readonly id: string;
  readonly icon = 'check';
  readonly children = undefined;

  readonly tickId: TickId;
  readonly tick: Tick;

  constructor(parentId: string, tickId: TickId, tick: Tick) {
    this.id = `${parentId}|tick-${tickId}`;
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
  get tickStyleClass() {
    return {
      clean:
        [
          TickStyle.SOLO,
          TickStyle.LEAD,
          TickStyle.LEAD_ONSIGHT,
          TickStyle.LEAD_FLASH,
          TickStyle.LEAD_REDPOINT,
          TickStyle.LEAD_PINKPOINT,
          TickStyle.SEND,
          TickStyle.FLASH,
        ].indexOf(this.tick.style) != -1,
      fell:
        [TickStyle.LEAD_FELL_HUNG, TickStyle.ATTEMPT].indexOf(
          this.tick.style
        ) != -1,
    };
  }
  get tickPitches(): string {
    return this.tick.pitches == 1 ? '1 pitch' : `${this.tick.pitches} pitches`;
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
  readonly icon = 'view_list';
  children: Item[] = []; // initially empty to force dynamic loading of ticks

  readonly routeId: RouteId;
  readonly routeSummary: RouteSummary;

  constructor(parentId: string, routeId: RouteId, summary: RouteSummary) {
    this.id = `${parentId}|${routeId}`;
    this.routeId = routeId;
    this.routeSummary = summary;
  }

  get routeName() {
    return this.routeSummary.name;
  }
  get routeGrade() {
    return this.routeSummary.grade;
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
          .sort(
            (a, b) =>
              b.tickDate.localeCompare(a.tickDate) || b.tickId - a.tickId
          );
      });
  }
}

class AreaItem implements Item {
  readonly id: string;
  readonly icon = 'photo';
  children: Item[]; // dynamically updated after loading the area doc

  readonly areaId?: AreaId; // only set if this area contains routes
  readonly areaName: string;
  readonly childAreas: AreaItem[];

  constructor(parentId: string, map: AreaMap, name: string) {
    this.id = parentId + (parentId ? '|' : '') + name;
    this.areaId = map.areaId;
    this.areaName = name;

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
            .sort((a, b) => a.routeName.localeCompare(b.routeName))
        );
      });
  }
}

@Component({ components: { NoTicks, Spinner } })
export default class Ticks extends Vue {
  items: Item[] = [];

  ready = false;
  haveTicks = false;

  mounted() {
    areaMapRef()
      .get()
      .then(snap => {
        this.ready = true;
        if (!snap.exists) return;
        this.haveTicks = true;
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
  background-color: #c5cae9; /* indigo.lighten-4 */
  border: solid 1px #9fa8da; /* indigo.lighten-3 */
  border-radius: 8px;
  font-size: 11px;
  margin-left: 6px;
  padding: 2px 5px 1px 5px;
  vertical-align: middle;
}
.tick-style.clean {
  background-color: #c8e6c9; /* green.lighten-4 */
  border-color: #a5d6a7; /* green.lighten-3 */
}
.tick-style.fell {
  background-color: #ffcdd2; /* red.lighten-4 */
  border-color: #ef9a9a; /* red.lighten-3 */
}
.tick-pitches {
  font-size: 11px;
  margin-left: 6px;
  opacity: 0.8;
  vertical-align: middle;
}
.tick-notes {
  white-space: pre-wrap;
  font-size: 12px;
}

.route-grade {
  margin-left: 6px;
  opacity: 0.5;
}
.route-link {
  margin-left: 8px;
  opacity: 0.6;
}
</style>
