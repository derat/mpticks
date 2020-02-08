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

    wrapper = mount(Ticks, newVuetifyMountOptions());
    await flushPromises();
  });

  it('loads and displays data', async () => {
    const labels = () =>
      wrapper.findAll('.v-treeview-node__label').wrappers.map(w => w.text());
    const toggle = async (index: number) => {
      wrapper
        .findAll('.v-treeview-node__toggle')
        .wrappers[index].trigger('click');
      await flushPromises();
    };
    const routeLabel = (route: Route) => `${route.name} (${route.grade})`;
    const tickLabel = (tick: Tick) => {
      const year = tick.date.substring(0, 4);
      const month = tick.date.substring(4, 6);
      const day = tick.date.substring(6, 8);
      const style = TickStyleToString(tick.style);
      return `${year}-${month}-${day} ${style} ${tick.notes}`;
    };

    // The top-level areas should be shown initially.
    expect(labels()).toEqual([area1, area2]);

    // Expand the first area to show its subarea.
    await toggle(0);
    expect(labels()).toEqual([area1, subArea1, area2]);

    // Expanding the subarea should show its route.
    await toggle(1);
    expect(labels()).toEqual([area1, subArea1, routeLabel(route1), area2]);

    // Expand the second area to show its routes.
    await toggle(3);
    expect(labels()).toEqual([
      area1,
      subArea1,
      routeLabel(route1),
      area2,
      routeLabel(route2),
      routeLabel(route3),
    ]);

    // Click the second area's first route to show its ticks.
    await toggle(4);
    expect(labels()).toEqual([
      area1,
      subArea1,
      routeLabel(route1),
      area2,
      routeLabel(route2),
      tickLabel(tick3),
      tickLabel(tick2),
      routeLabel(route3),
    ]);
  });
});
