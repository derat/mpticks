<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div v-if="ready">
    <Alert :text.sync="errorMsg" class="mx-3 mb-3" />

    <!-- I'm not sure why, but v-row adds a negative margin that v-col then seems
       to cancel out with padding. All of this seems to result in the page being
       horizontally scrollable on mobile, so just zero everything out. -->
    <v-row v-if="haveTicks" class="ma-0">
      <v-col cols="12" lg="8" class="pa-0">
        <v-treeview
          dense
          :items="items"
          :load-children="loadItemChildren"
          :open.sync="openIds"
          open-on-click
        >
          <template v-slot:prepend="{ item }">
            <v-icon class="tree-icon">{{ item.icon }} </v-icon>
          </template>
          <template v-slot:label="{ item }">
            <div v-if="item.tick">
              <div class="tick-label">
                <span>{{ item.tickDate }}</span>
                <span class="tick-style" :class="item.tickStyleClass">{{
                  item.tickStyle
                }}</span>
                <span class="tick-pitches">{{ item.tickPitches }}p</span>
                <v-icon
                  class="tick-delete-icon"
                  :size="18"
                  @click.stop="onDeleteIconClick(item.tickId, item.routeId)"
                  >delete</v-icon
                >
              </div>
              <div class="tick-notes">{{ item.tickNotes }}</div>
            </div>
            <div v-if="item.routeSummary" :id="`route-${item.routeId}`">
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
    <NoTicks v-else class="ma-3" />

    <v-dialog ref="deleteDialog" :value="deleteDialogShown" max-width="320px">
      <v-card>
        <v-card-title class="title grey lighten-2 px-4" primary-title>
          Delete tick
        </v-card-title>
        <v-card-text class="px-4 py-3">
          Are you sure that you want to permanently remove this tick from this
          app? You won't be able to import it again.
        </v-card-text>
        <v-card-actions>
          <v-btn
            text
            ref="deleteCancelButton"
            @click="onDeleteCancel"
            :disabled="deleting"
            >Cancel</v-btn
          >
          <v-spacer />
          <v-btn
            text
            color="error"
            ref="deleteConfirmButton"
            @click="onDeleteConfirm"
            :disabled="deleting"
            >{{ deleting ? 'Deleting...' : 'Delete' }}</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
  <Spinner v-else />
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import Alert from '@/components/Alert.vue';
import NoTicks from '@/components/NoTicks.vue';
import Spinner from '@/components/Spinner.vue';

import app from '@/firebase';
import { areaMapRef, areaRef, countsRef, routeRef } from '@/docs';
import {
  Area,
  AreaId,
  AreaMap,
  compareTicks,
  Counts,
  Route,
  RouteId,
  RouteSummary,
  TickId,
  Tick,
  TickStyle,
  TickStyleToString,
} from '@/models';
import { addTicksToCounts } from '@/stats';

// Interface for items in the v-treeview.
interface Item {
  readonly id: string; // default 'item-key' property for v-treeview
  readonly icon: string;

  // v-treeview will call loadItemChildren(), which calls loadChildren(), if the
  // |children| property contains an empty array. If it's undefined, the item
  // has no children.
  readonly children: Item[] | undefined;

  // Called to dynamically populate |children| when the item is clicked.
  loadChildren(): Promise<void>;

  // Removes the tick identified by |tickId| from |children|. Returns true if
  // the tick was present in this item or in one of its descendents.
  removeTick(tickId: TickId): boolean;
}

class TickItem implements Item {
  readonly id: string;
  readonly icon = 'check';
  readonly children = undefined;

  readonly tickId: TickId;
  readonly tick: Tick;
  readonly routeId: RouteId;

  constructor(parentId: string, tickId: TickId, tick: Tick, routeId: RouteId) {
    this.id = `${parentId}|tick-${tickId}`;
    this.tickId = tickId;
    this.tick = tick;
    this.routeId = routeId;
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
  get tickPitches(): number {
    return this.tick.pitches;
  }
  get tickNotes(): string {
    return this.tick.notes || '';
  }

  loadChildren(): Promise<void> {
    // Not reached since |children| is undefined.
    throw new Error('Ticks have no children');
  }

  removeTick(tickId: TickId) {
    return false;
  }
}

class RouteItem implements Item {
  readonly id: string;
  readonly icon = 'view_list';
  children: TickItem[] = []; // initially empty to force dynamic loading

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
        this.children = Object.entries(route.ticks)
          .map(
            ([tickId, tick]) =>
              new TickItem(this.id, parseInt(tickId), tick, this.routeId)
          )
          .sort((a, b) => compareTicks(a.tickId, a.tick, b.tickId, b.tick))
          .reverse();
      });
  }

  removeTick(tickId: TickId) {
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].tickId == tickId) {
        this.children.splice(i, 1);
        return true;
      }
    }
    return false;
  }
}

class AreaItem implements Item {
  readonly id: string;
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

  get icon() {
    return this.childAreas.length ? 'burst_mode' : 'photo';
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

  removeTick(tickId: TickId) {
    for (const c of this.children) if (c.removeTick(tickId)) return true;
    return false;
  }
}

@Component({ components: { Alert, NoTicks, Spinner } })
export default class Ticks extends Vue {
  // If set, the supplied route will be initially opened.
  @Prop(Number) readonly initialRouteId?: RouteId;

  ready = false;
  haveTicks = false;
  errorMsg = '';

  items: Item[] = [];

  deleting = false; // true while tick is being deleted
  deleteDialogShown = false; // model for delete dialog
  deleteTickId: TickId = 0; // set when delete icon clicked
  deleteRouteId: RouteId = 0; // set when delete icon clicked

  // Synchronously bound to v-treeview to reflect the |id| fields of open items.
  openIds: string[] = [];

  // |id| field of the AreaItem that is the parent to the RouteItem representing
  // |initialRouteId|. Cleared after the route is opened.
  initialRouteParentId = '';

  mounted() {
    const areasPromise = areaMapRef()
      .get()
      .then(snap => {
        if (!snap.exists) return;
        this.haveTicks = true;
        const map = snap.data() as AreaMap;
        this.items = Object.entries(map.children || {})
          .sort()
          .map(([name, child]) => new AreaItem('', child, name));
      });

    // If requested, start loading the initially-open route in parallel with the
    // area map.
    const routePromise = this.initialRouteId
      ? routeRef(this.initialRouteId)
          .get()
          .then(snap => {
            if (snap.exists) return (snap.data() as Route).location;
            throw new Error(`${this.initialRouteId} not found`);
          })
      : Promise.resolve(null);

    // After both the route and area map are loaded, we can open the route.
    Promise.all([routePromise, areasPromise])
      .then(([location]) => {
        if (location) this.openRoute(this.initialRouteId!, location);
      })
      .catch(err => {
        this.errorMsg = `Failed to load ticks: ${err.message}`;
        throw err;
      })
      .finally(() => (this.ready = true));
  }

  // Asynchronously open the RouteItem identified by |routeId|. The hierarchy of
  // AreaItems leading to it (identified by |location|) are opened first.
  openRoute(routeId: RouteId, location: string[]) {
    // Open the area corresponding to each location component.
    let id = '';
    this.openIds.push(...location.map(c => (id += (id ? '|' : '') + c)));

    // We won't be able to open the route until it's present in
    // |this.items|. Save its parent's ID here so we know when that happens.
    this.initialRouteParentId = this.openIds[this.openIds.length - 1];

    // Trying to synchronously open the final area item that contains the route
    // here does nothing. If we open it asynchrously, it works. I suspect that
    // this is tied to its children being dynamically loaded. If that's the
    // case, we may have problems if there are other areas higher in the tree
    // that are also asynchronously loaded because they contain routes.
    window.setTimeout(() => this.openIds.push(this.initialRouteParentId));
  }

  // Callback for an item with an empty |children| array being opened.
  loadItemChildren(item: Item): Promise<void> {
    return item.loadChildren().then(() => {
      if (item.id != this.initialRouteParentId) return;

      // If we just added the route that we initially want to display, then we
      // asynchronously add it to the list of open items.
      const ids = [
        // Repeat the parent ID here since v-treeview seems to fail to add
        // asynchronously-loaded items to the |open| property:
        // https://github.com/vuetifyjs/vuetify/issues/10583
        this.initialRouteParentId,
        `${this.initialRouteParentId}|${this.initialRouteId}`,
      ];
      window.setTimeout(() => {
        // Scroll to the route and expand it.
        const el = document.getElementById(`route-${this.initialRouteId}`);
        if (el) el.scrollIntoView({ block: 'center' });
        this.openIds.push(...ids);
      });

      this.initialRouteParentId = '';
    });
  }

  onDeleteIconClick(tickId: TickId, routeId: RouteId) {
    this.deleteDialogShown = true;
    this.deleteTickId = tickId;
    this.deleteRouteId = routeId;
  }

  onDeleteCancel() {
    this.deleteDialogShown = false;
    this.deleteTickId = 0;
    this.deleteRouteId = 0;
  }

  onDeleteConfirm() {
    this.deleting = true;
    const tickId = this.deleteTickId;
    const routeId = this.deleteRouteId;

    Promise.all([
      routeRef(routeId)
        .get()
        .then(snap => {
          if (!snap.exists) throw new Error(`Can't find route ${routeId}`);
          return snap.data() as Route;
        }),
      countsRef()
        .get()
        .then(snap => {
          if (!snap.exists) throw new Error("Can't find stats");
          return snap.data() as Counts;
        }),
    ])
      .then(([route, counts]) => {
        const tick = route.ticks[tickId];
        if (!tick) throw new Error(`Can't find tick ${tickId}`);

        const batch = app.firestore().batch();

        // This needs to happen before |route| is passed to addTicksToCounts().
        delete route.ticks[tickId];
        (route.deletedTicks = route.deletedTicks || {})[tickId] = tick;
        batch.set(routeRef(routeId), route);

        addTicksToCounts(
          counts,
          new Map([[routeId, new Map([[tickId, tick]])]]),
          new Map([[routeId, route]]),
          true /* remove */
        );
        batch.set(countsRef(), counts);

        return batch.commit();
      })
      .then(() => {
        for (const item of this.items) if (item.removeTick(tickId)) break;
      })
      .catch(err => {
        this.errorMsg = `Failed to delete tick: ${err.message}`;
        throw err;
      })
      .finally(() => {
        this.deleteDialogShown = false;
        this.deleting = false;
        this.deleteTickId = 0;
        this.deleteRouteId = 0;
      });
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

.tick-label {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
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
.tick-delete-icon {
  margin-left: 4px;
  opacity: 0.6;
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
