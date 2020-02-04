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

import Ticks from './Ticks.vue';

const tickId1: TickId = 101;
const tick1: Tick = {
  date: '2020-01-01',
  pitches: 1,
  style: TickStyle.LEAD_ONSIGHT,
  notes: 'got it!',
  stars: -1,
  grade: '',
};
const tickId2: TickId = 102;
const tick2: Tick = {
  date: '2019-07-01',
  pitches: 2,
  style: TickStyle.FOLLOW,
  notes: 'fun route',
  stars: 2,
  grade: '5.9',
};
const tickId3: TickId = 103;
const tick3: Tick = {
  date: '2019-10-31',
  pitches: 2,
  style: TickStyle.LEAD,
  notes: '',
  stars: 2,
  grade: '5.9',
};
const tickId4: TickId = 104;
const tick4: Tick = {
  date: '2019-02-28',
  pitches: 1,
  style: TickStyle.LEAD_FELL_HUNG,
  notes: 'whoops',
  stars: 4,
  grade: '',
};

const area1 = 'Colorado';
const subArea1 = 'Boulder';
const areaId1 = makeAreaId([area1, subArea1]);

const area2 = 'California';
const areaId2 = makeAreaId([area2]);

const routeId1: RouteId = 11;
const route1: Route = {
  name: 'First Route',
  type: RouteType.SPORT,
  location: [area1, subArea1],
  grade: '5.10c',
  pitches: 1,
  ticks: { [tickId1]: tick1 },
};
const routeId2: RouteId = 12;
const route2: Route = {
  name: 'Second Route',
  type: RouteType.TRAD,
  location: [area2],
  grade: '5.9+',
  pitches: 2,
  ticks: { [tickId2]: tick2, [tickId3]: tick3 },
};
const routeId3: RouteId = 13;
const route3: Route = {
  name: 'Third Route',
  type: RouteType.OTHER,
  location: [area2],
  grade: '5.7',
  pitches: 1,
  ticks: { [tickId4]: tick4 },
};

setUpVuetifyTesting();

describe('Ticks', () => {
  let wrapper: Wrapper<Vue>;

  beforeEach(async () => {
    MockFirebase.reset();
    MockFirebase.setDoc('users/default/areas/map', {
      children: {
        [area1]: {
          children: {
            [subArea1]: {
              children: {},
              areaId: areaId1,
            },
          },
        },
        [area2]: {
          children: {},
          areaId: areaId2,
        },
      },
    });
    MockFirebase.setDoc(`users/default/areas/${areaId1}`, {
      routes: { [routeId1]: { name: route1.name, grade: route1.grade } },
    });
    MockFirebase.setDoc(`users/default/areas/${areaId2}`, {
      routes: {
        [routeId2]: { name: route2.name, grade: route2.grade },
        [routeId3]: { name: route3.name, grade: route3.grade },
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

    expect(labels()).toEqual([area2, area1]);
    await toggle(0);

    expect(labels()).toEqual([
      area2,
      routeLabel(route2),
      routeLabel(route3),
      area1,
    ]);
    await toggle(3);

    expect(labels()).toEqual([
      area2,
      routeLabel(route2),
      routeLabel(route3),
      area1,
      subArea1,
    ]);
    await toggle(4);

    expect(labels()).toEqual([
      area2,
      routeLabel(route2),
      routeLabel(route3),
      area1,
      subArea1,
      routeLabel(route1),
    ]);
    await toggle(1);

    expect(labels()).toEqual([
      area2,
      routeLabel(route2),
      tick2.date,
      tick3.date,
      routeLabel(route3),
      area1,
      subArea1,
      routeLabel(route1),
    ]);
  });
});
