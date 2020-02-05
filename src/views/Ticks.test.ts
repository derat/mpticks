// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MockFirebase } from '@/firebase/mock';

import firebase from 'firebase/app';
import 'firebase/firestore';

import { mount, Wrapper } from '@vue/test-utils';
import {
  setUpVuetifyTesting,
  newVuetifyMountOptions,
  deepCopy,
  getValue,
} from '@/testutil';
import Vue from 'vue';
import flushPromises from 'flush-promises';
import {
  makeAreaId,
  Route,
  RouteId,
  RouteType,
  Tick,
  TickId,
  TickStyle,
} from '@/models';
import { makeRoute, makeRouteSummary, makeTick } from '@/testdata';

import Ticks from './Ticks.vue';

const tickId1: TickId = 11;
const tick1: Tick = makeTick(tickId1);
const tickId2: TickId = 12;
const tick2: Tick = makeTick(tickId2);
const tickId3: TickId = 13;
const tick3: Tick = makeTick(tickId3);
const tickId4: TickId = 14;
const tick4: Tick = makeTick(tickId4);

const area1 = 'California';
const subArea1 = 'Yosemite';
const areaId1 = makeAreaId([area1, subArea1]);

const area2 = 'Colorado';
const areaId2 = makeAreaId([area2]);

const routeId1: RouteId = 1;
const route1: Route = makeRoute(routeId1, [tickId1], [area1, subArea1]);
const routeId2: RouteId = 2;
const route2: Route = makeRoute(routeId2, [tickId2, tickId3], [area2]);
const routeId3: RouteId = 3;
const route3: Route = makeRoute(routeId3, [tickId4], [area2]);

setUpVuetifyTesting();

describe('Ticks', () => {
  let wrapper: Wrapper<Vue>;

  beforeEach(async () => {
    MockFirebase.reset();
    MockFirebase.setDoc('users/default/areas/map', {
      children: {
        [area1]: {
          children: {
            [subArea1]: { children: {}, areaId: areaId1 },
          },
        },
        [area2]: { children: {}, areaId: areaId2 },
      },
    });
    MockFirebase.setDoc(`users/default/areas/${areaId1}`, {
      routes: { [routeId1]: makeRouteSummary(routeId1) },
    });
    MockFirebase.setDoc(`users/default/areas/${areaId2}`, {
      routes: {
        [routeId2]: makeRouteSummary(routeId2),
        [routeId3]: makeRouteSummary(routeId3),
      },
    });
    MockFirebase.setDoc(`users/default/routes/${routeId1}`, route1);
    MockFirebase.setDoc(`users/default/routes/${routeId2}`, route2);
    MockFirebase.setDoc(`users/default/routes/${routeId3}`, route3);

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
      tick2.date,
      tick3.date,
      routeLabel(route3),
    ]);
  });
});
