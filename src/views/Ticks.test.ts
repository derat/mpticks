// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MockFirebase, MockUser } from '@/firebase/mock';

import firebase from 'firebase/app';
import 'firebase/firestore';

import Vue from 'vue';
import VueRouter from 'vue-router';
import { mount, Wrapper } from '@vue/test-utils';
import {
  getValue,
  newVuetifyMountOptions,
  setUpVuetifyTesting,
} from '@/testutil';
import flushPromises from 'flush-promises';

import { makeAreaId } from '@/convert';
import { formatDateString } from '@/dateutil';
import { areaMapRef, areaRef, countsRef, routeRef } from '@/docs';
import {
  Route,
  RouteId,
  RouteType,
  Tick,
  TickId,
  TickStyle,
  TickStyleToString,
} from '@/models';
import { testCounts, testRoute, testRouteSummary, testTick } from '@/testdata';

import NoTicks from '@/components/NoTicks.vue';
import Ticks, { compareNames } from './Ticks.vue';

setUpVuetifyTesting();

describe('Ticks', () => {
  let wrapper: Wrapper<Vue>;

  const testUid = 'test-uid';

  const tickId1: TickId = 11;
  const tickId2: TickId = 12;
  const tickId3: TickId = 13;
  const tickId4: TickId = 14;

  const routeId1: RouteId = 1;
  const routeId2: RouteId = 2;
  const routeId3: RouteId = 3;

  const tick1: Tick = testTick(tickId1, routeId1);
  const tick2: Tick = testTick(tickId2, routeId2);
  const tick3: Tick = testTick(tickId3, routeId2);
  const tick4: Tick = testTick(tickId4, routeId3);

  const area1 = 'California';
  const subArea1 = 'Yosemite';
  const areaId1 = makeAreaId([area1, subArea1]);

  const area2 = 'Colorado';
  const areaId2 = makeAreaId([area2]);

  const route1: Route = testRoute(routeId1, [tickId1], [area1, subArea1]);
  const route2: Route = testRoute(routeId2, [tickId2, tickId3], [area2]);
  const route3: Route = testRoute(routeId3, [tickId4], [area2]);

  beforeEach(async () => {
    MockFirebase.reset();
    MockFirebase.currentUser = new MockUser(testUid, 'Test User');
    MockFirebase.setDoc(areaMapRef(), {
      children: {
        [area1]: {
          children: {
            [subArea1]: { children: {}, areaId: areaId1 },
          },
        },
        [area2]: { children: {}, areaId: areaId2 },
      },
    });
    MockFirebase.setDoc(areaRef(areaId1), {
      routes: { [routeId1]: testRouteSummary(routeId1) },
    });
    MockFirebase.setDoc(areaRef(areaId2), {
      routes: {
        [routeId2]: testRouteSummary(routeId2),
        [routeId3]: testRouteSummary(routeId3),
      },
    });
    MockFirebase.setDoc(routeRef(routeId1), route1);
    MockFirebase.setDoc(routeRef(routeId2), route2);
    MockFirebase.setDoc(routeRef(routeId3), route3);
    MockFirebase.setDoc(
      countsRef(),
      testCounts(
        new Map([
          [routeId1, route1],
          [routeId2, route2],
          [routeId3, route3],
        ])
      )
    );
  });

  // Mounts the Ticks view and initializes |wrapper|.
  async function mountView(propsData?: Record<string, any>) {
    wrapper = mount(
      Ticks,
      newVuetifyMountOptions({
        propsData,
        // Avoids 'Unknown custom element: <router-link>' warning from NoRoutes
        // component.
        router: new VueRouter(),
      })
    );
    await flushPromises();
  }

  // Returns an array containing the text from each item.
  function getLabels(): string[] {
    return wrapper
      .findAll('.v-treeview-node__label')
      .wrappers.map(w => w.text());
  }

  // Toggles the item at zero-based |index|.
  async function toggleItem(index: number) {
    wrapper
      .findAll('.v-treeview-node__toggle')
      .wrappers[index].trigger('click');
    await flushPromises();
  }

  // Returns the label that is used for |route|.
  function getRouteLabel(route: Route) {
    return `${route.name} ${route.grade} info`;
  }

  // Returns the label that is used for |tick|.
  function getTickLabel(tick: Tick) {
    const date = formatDateString(tick.date, '%Y-%m-%d');
    const style = TickStyleToString(tick.style);
    return `${date} ${style} ${tick.pitches}p delete ${tick.notes}`;
  }

  it('loads and displays data', async () => {
    // The top-level areas should be shown initially.
    await mountView();
    expect(wrapper.find(NoTicks).exists()).toBe(false);
    expect(getLabels()).toEqual([area1, area2]);

    // Expand the first area to show its subarea. Its route will also be
    // auto-opened since it has no siblings (but this probably only happens
    // since the test is running in sync mode -- in real life, the route list
    // would be asynchronously loaded, which seems to make it not be reflected
    // properly in v-treeview's list of open IDs).
    await toggleItem(0);
    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      area2,
    ]);

    // Expand the second area to show its routes.
    await toggleItem(3);
    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      area2,
      getRouteLabel(route2),
      getRouteLabel(route3),
    ]);

    // Click the second area's first route to show its ticks.
    await toggleItem(4);
    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      area2,
      getRouteLabel(route2),
      getTickLabel(tick3),
      getTickLabel(tick2),
      getRouteLabel(route3),
    ]);

    // Click the route again to hide its ticks.
    await toggleItem(4);
    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      area2,
      getRouteLabel(route2),
      getRouteLabel(route3),
    ]);
  });

  it('supports displaying an initial route', async () => {
    jest.useFakeTimers();
    await mountView({ initialRouteId: routeId1 });

    await jest.runTimersToTime(0); // window.setTimeout() in openRoute()
    await flushPromises(); // Firestore read from loadItemChildren()
    await jest.runTimersToTime(0); // window.setTimeout() in loadItemChildren()

    // TODO: At this point, loadItemChildren() ought to be called for the
    // RouteItem. However, this doesn't seem to happen -- regardless of how many
    // times I call jest.runTimersToTime(), flushPromises(), or Vue.nextTick(),
    // I never see the tick get loaded. There seems to be some fishiness with
    // v-treeview's |open| property that may be related:
    // https://github.com/vuetifyjs/vuetify/issues/10583
    //
    // When running the test in sync mode, this isn't a problem. However, sync
    // mode was apparently permanently removed after removed after
    // @vue/test-utils@1.0.0-beta.29:
    // https://github.com/vuejs/vue-test-utils/issues/1130
    //
    // Hopefully the v-treeview issue gets resolved before I need to upgrade to
    // a newer version of vue-test-utils. :-/

    await flushPromises(); // Firestore read from loadItemChildren()
    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      getTickLabel(tick1),
      area2,
    ]);
  });

  it('supports deleting ticks', async () => {
    // Show the first route's ticks.
    await mountView();
    await toggleItem(0);
    // The subarea gets opened automatically here. See the comment in the 'loads
    // and displays data' test.
    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      area2,
    ]);
    await toggleItem(2);
    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      getTickLabel(tick1),
      area2,
    ]);

    // Click the first tick's delete icon to display the dialog.
    const dialog = wrapper.find({ ref: 'deleteDialog' });
    expect(getValue(dialog)).toBeFalsy();
    const deleteIcon = wrapper.find('.tick-delete-icon');
    deleteIcon.trigger('click');
    await flushPromises();
    expect(getValue(dialog)).toBeTruthy();

    // Check that the cancel button dismisses the dialog without doing anything.
    wrapper.find({ ref: 'deleteCancelButton' }).trigger('click');
    await flushPromises();
    expect(getValue(dialog)).toBeFalsy();
    expect(MockFirebase.getDoc(routeRef(routeId1))!).toEqual(route1);

    // This time, confirm deleting the tick.
    deleteIcon.trigger('click');
    await flushPromises();
    expect(getValue(dialog)).toBeTruthy();
    wrapper.find({ ref: 'deleteConfirmButton' }).trigger('click');
    await flushPromises();

    // The tick should no longer be displayed.
    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      area2,
    ]);

    // The route document should be updated to reflect the tick's deletion, and
    // the total counts should be updated to exclude the tick as well.
    const newRoute1 = testRoute(routeId1, [], route1.location);
    newRoute1.deletedTicks = { [tickId1]: tick1 };
    expect(MockFirebase.getDoc(routeRef(routeId1))!).toEqual(newRoute1);
    expect(MockFirebase.getDoc(countsRef())!).toEqual(
      testCounts(
        new Map([
          [routeId1, newRoute1],
          [routeId2, route2],
          [routeId3, route3],
        ])
      )
    );
  });

  it('points the user at the Import view when there are no ticks', async () => {
    MockFirebase.reset();
    MockFirebase.currentUser = new MockUser(testUid, 'Test User');
    await mountView();
    expect(wrapper.find(NoTicks).exists()).toBe(true);
  });
});

describe('compareNames', () => {
  it('compares names with and without number prefixes', () => {
    ([
      ['a', 'a', 0],
      ['a', 'b', -1],
      ['b', 'a', 1],
      ['1. a', '1. a', 0],
      ['1. a', '1. b', -1],
      ['1. b', '1. a', 1],
      ['2. a', '1. a', 1],
      ['9. b', '10. a', -1],
    ] as [string, string, number][]).forEach(([a, b, exp]) => {
      expect(Math.sign(compareNames(a, b))).toBe(exp);
    });
  });
});
