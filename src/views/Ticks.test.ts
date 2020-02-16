// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MockFirebase, MockUser } from '@/firebase/mock';

import firebase from 'firebase/app';
import 'firebase/firestore';

import { mount, Wrapper } from '@vue/test-utils';
import { setUpVuetifyTesting, newVuetifyMountOptions } from '@/testutil';
import Vue from 'vue';
import flushPromises from 'flush-promises';
import {
  Route,
  RouteId,
  RouteType,
  Tick,
  TickId,
  TickStyle,
  TickStyleToString,
} from '@/models';
import { makeAreaId } from '@/convert';
import { testRoute, testRouteSummary, testTick } from '@/testdata';

import Ticks from './Ticks.vue';

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
    MockFirebase.setDoc(`users/${testUid}/areas/map`, {
      children: {
        [area1]: {
          children: {
            [subArea1]: { children: {}, areaId: areaId1 },
          },
        },
        [area2]: { children: {}, areaId: areaId2 },
      },
    });
    MockFirebase.setDoc(`users/${testUid}/areas/${areaId1}`, {
      routes: { [routeId1]: testRouteSummary(routeId1) },
    });
    MockFirebase.setDoc(`users/${testUid}/areas/${areaId2}`, {
      routes: {
        [routeId2]: testRouteSummary(routeId2),
        [routeId3]: testRouteSummary(routeId3),
      },
    });
    MockFirebase.setDoc(`users/${testUid}/routes/${routeId1}`, route1);
    MockFirebase.setDoc(`users/${testUid}/routes/${routeId2}`, route2);
    MockFirebase.setDoc(`users/${testUid}/routes/${routeId3}`, route3);
  });

  // Mounts the Ticks view and initializes |wrapper|.
  async function mountView(options?: Record<string, any>) {
    wrapper = mount(Ticks, newVuetifyMountOptions(options));
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
    const year = tick.date.substring(0, 4);
    const month = tick.date.substring(4, 6);
    const day = tick.date.substring(6, 8);
    const style = TickStyleToString(tick.style);
    return (
      `${year}-${month}-${day} ${style} ` +
      `${tick.pitches} pitch${tick.pitches == 1 ? '' : 'es'} ` +
      tick.notes
    );
  }

  it('loads and displays data', async () => {
    // The top-level areas should be shown initially.
    await mountView();
    expect(getLabels()).toEqual([area1, area2]);

    // Expand the first area to show its subarea.
    await toggleItem(0);
    expect(getLabels()).toEqual([area1, subArea1, area2]);

    // Expanding the subarea should show its route.
    await toggleItem(1);
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
  });

  it.skip('supports displaying an initial route', async () => {
    jest.useFakeTimers();
    await mountView({ propsData: { initialRouteId: routeId1 } });

    await jest.runTimersToTime(0); // window.setTimeout() in openRoute()
    await flushPromises(); // Firestore read from loadItemChildren()
    await jest.runTimersToTime(0); // window.setTimeout() in loadItemChildren()

    // TODO: At this point, loadItemChildren() ought to be called for the
    // RouteItem. However, this doesn't seem to happen -- regardless of how many
    // times I call jest.runTimersToTime(), flushPromises(), or Vue.nextTick(),
    // I never see the tick get loaded. There seems to be some fishiness with
    // v-treeview's |open| property that may be related:
    // https://github.com/vuetifyjs/vuetify/issues/10583

    await flushPromises(); // Firestore read from loadItemChildren()

    expect(getLabels()).toEqual([
      area1,
      subArea1,
      getRouteLabel(route1),
      getTickLabel(tick1),
      area2,
    ]);
  });
});
