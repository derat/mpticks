// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MockFirebase, MockUser } from '@/firebase/mock';
import firebase from 'firebase/app';
import 'firebase/firestore';

import Chart from 'chart.js';
jest.mock('chart.js');
import { mocked } from 'ts-jest/utils';
import flushPromises from 'flush-promises';

import Vue from 'vue';
import VueRouter from 'vue-router';
import { mount, Wrapper } from '@vue/test-utils';
import { setUpVuetifyTesting, newVuetifyMountOptions } from '@/testutil';
import Stats from './Stats.vue';
import NoTicks from '@/components/NoTicks.vue';

import { countsRef, userRef, routeRef } from '@/docs';
import {
  Counts,
  countsVersion,
  newCounts,
  numTopRoutes,
  RouteId,
  RouteType,
  RouteTypeToString,
  TickId,
  TickStyle,
  TickStyleToString,
} from '@/models';
import { testCounts, testRoute } from '@/testdata';

setUpVuetifyTesting();

describe('Stats', () => {
  let wrapper: Wrapper<Vue>;

  const testUid = 'test-uid';

  // https://stackoverflow.com/a/57599680/6882947
  let mockTime = new Date(2020, 0, 1).getTime();
  const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => mockTime);

  beforeEach(async () => {
    MockFirebase.reset();
    MockFirebase.currentUser = new MockUser(testUid, 'Test User');

    // See https://github.com/kulshekhar/ts-jest/issues/576.
    mocked(Chart).mockClear();
  });

  async function mountView() {
    // @vue/test-utils@1.0.0-beta.30 and later produce a bogus 'You may have an
    // infinite update loop in a component render function.' warning pointing at
    // v-data-table: https://github.com/vuejs/vue-test-utils/issues/1407
    wrapper = mount(
      Stats,
      newVuetifyMountOptions({
        // Avoids "TypeError: Cannot read property '$scopedSlots' of undefined"
        // in no-stats test.
        sync: false,
        // Avoids 'Unknown custom element: <router-link>' warning from NoRoutes
        // component.
        router: new VueRouter(),
      })
    );
    await flushPromises();
  }

  // Contains a subset of the args passed to the Chart constructor.
  interface ChartInfo {
    labels: string[];
    data: number[][];
  }

  // Returns a map of information about all Chart constructor calls keyed by
  // chart title.
  function getCharts(): Record<string, ChartInfo> {
    return mocked(Chart).mock.calls.reduce((charts, call) => {
      charts[call[1].options!.title!.text! as string] = {
        labels: call[1].data!.labels as string[],
        data: call[1].data!.datasets!.map(d => d.data as number[]),
      };
      return charts;
    }, {} as Record<string, ChartInfo>);
  }

  // Returns rows and cells from the v-data-table with the supplied ref.
  function getDataTableRows(ref: string): string[][] {
    return wrapper
      .find({ ref })
      .findAll('tr')
      .wrappers.map(tr => tr.findAll('td, th').wrappers.map(td => td.text()));
  }

  it('shows the correct stats', async () => {
    // This data doesn't need to be internally consistent.
    MockFirebase.setDoc(userRef(), { maxTickId: 0, numRoutes: 25 });

    const routeTicks: Record<string, number> = {};
    for (let i = 1; i <= numTopRoutes; i++) routeTicks[`${i}|Route ${i}`] = i;

    MockFirebase.setDoc(countsRef(), {
      version: countsVersion,
      dateFirstTicks: {
        20191120: 1,
        20191121: 2,
        20191128: 4,
        20191129: 8,
        20200130: 16,
        20200131: 32,
      },
      datePitches: { 20191120: 3, 20191231: 10, 20200101: 2, 20200102: 4 },
      dateTicks: { 20191120: 2, 20191231: 5, 20200101: 2, 20200102: 1 },
      dayOfWeekPitches: { 1: 2, 3: 8, 7: 5 },
      dayOfWeekTicks: { 1: 1, 3: 4, 7: 3 },
      gradeCleanTicks: {
        '5.10a': 5,
        '5.10a/b': 3,
        ['V-easy']: 3,
        'V1+': 4,
        V10: 1,
      },
      gradeTicks: {
        '5.9+': 2,
        '5.10a': 8,
        '5.10a/b': 3,
        ['V-easy']: 2,
        'V1+': 5,
        V10: 4,
      },
      latLongTicks: { '0,0': 1 },
      pitchesTicks: { 1: 20, 2: 3, 4: 1 },
      regionTicks: { California: 1, Arizona: 20, Canada: 5 },
      routeTicks,
      routeTypeTicks: {
        [RouteType.SPORT]: 5,
        [RouteType.BOULDER]: 4,
        [RouteType.ALPINE]: 1,
      },
      tickStyleTicks: {
        [TickStyle.SOLO]: 1,
        [TickStyle.LEAD_ONSIGHT]: 3,
        [TickStyle.TOP_ROPE]: 2,
        [TickStyle.SEND]: 4,
      },
    });

    mockTime = new Date(2020, 0, 30).getTime();
    await mountView();
    expect(wrapper.find(NoTicks).exists()).toBe(false);

    expect(getCharts()).toEqual({
      'Yearly Pitches': {
        labels: ['2019', '2020'],
        data: [[13, 6]],
      },
      'Monthly Pitches': {
        labels: ['2019-11', '2019-12', '2020-01'],
        data: [[3, 10, 6]],
      },
      'Weekly Pitches': {
        labels: [
          '2019-11-15',
          '2019-11-22',
          '2019-11-29',
          '2019-12-06',
          '2019-12-13',
          '2019-12-20',
          '2019-12-27',
          '2020-01-03',
          '2020-01-10',
          '2020-01-17',
          '2020-01-24',
        ],
        data: [[3, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0]],
      },
      'Pitches by Month': {
        labels: 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),
        data: [[6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 10]],
      },
      'Pitches by Day of Week': {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        data: [[2, 0, 8, 0, 0, 0, 5]],
      },
      'Rock Ticks by Grade': {
        labels: ['5.9', '5.10a'],
        data: [
          [0, 8],
          [2, 11],
        ],
      },
      'Boulder Ticks by Grade': {
        labels: 'VB V0 V1 V2 V3 V4 V5 V6 V7 V8 V9 V10'.split(' '),
        data: [
          [3, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [2, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 4],
        ],
      },
      'Weekly New Routes': {
        labels: [
          '2019-11-15',
          '2019-11-22',
          '2019-11-29',
          '2019-12-06',
          '2019-12-13',
          '2019-12-20',
          '2019-12-27',
          '2020-01-03',
          '2020-01-10',
          '2020-01-17',
          '2020-01-24',
        ],
        data: [[3, 4, 8, 0, 0, 0, 0, 0, 0, 0, 16]],
      },
      'Ticks by Pitches': {
        labels: ['1', '2', '3', '4'],
        data: [[20, 3, 0, 1]],
      },
      'Ticks by Style': {
        // This matches the order in Stats.vue.
        labels: [
          TickStyle.SOLO,
          TickStyle.LEAD_ONSIGHT,
          TickStyle.TOP_ROPE,
          TickStyle.SEND,
        ].map(s => TickStyleToString(s)),
        data: [[1, 3, 2, 4]],
      },
    });

    expect(getDataTableRows('dateTable')).toEqual([
      ['Period', 'Pitches', 'Ticks', 'Days Out'],
      ['Last 30 days', '6', '3', '2'],
      ['Last 90 days', '19', '10', '4'],
      ['Last year', '19', '10', '4'],
      ['Last 5 years', '19', '10', '4'],
      ['All time', '19', '10', '4'],
    ]);
    expect(getDataTableRows('routeTypeTable')).toEqual([
      ['Type', 'Ticks', 'Percent'],
      [RouteTypeToString(RouteType.SPORT), '5', '50.0%'],
      [RouteTypeToString(RouteType.BOULDER), '4', '40.0%'],
      [RouteTypeToString(RouteType.ALPINE), '1', '10.0%'],
    ]);
    expect(getDataTableRows('topRouteTable')).toEqual([
      ['Route', 'Ticks'],
      ...[...Array(10).keys()].map(i => [
        `Route ${numTopRoutes - i}`,
        (numTopRoutes - i).toString(),
      ]),
    ]);
    expect(getDataTableRows('regionTable')).toEqual([
      ['Region', 'Ticks'],
      ['Arizona', '20'],
      ['Canada', '5'],
      ['California', '1'],
    ]);

    expect(wrapper.find('.total-routes').text()).toBe('Total Routes: 25');
  });

  it('points the user at the Import view when there are no stats', async () => {
    await mountView();
    expect(wrapper.find(NoTicks).exists()).toBe(true);
  });

  it("doesn't explode when stats are empty", async () => {
    MockFirebase.setDoc(userRef(), { maxTickId: 0, numRoutes: 1 });
    MockFirebase.setDoc(countsRef(), newCounts());
    await mountView();
  });

  it('rebuilds stale counts doc', async () => {
    const rid: RouteId = 1;
    const loc = ['A'];
    const route = testRoute(rid, [2], loc);
    MockFirebase.setDoc(routeRef(rid), route);
    MockFirebase.setDoc(userRef(), { maxTickId: 0, numRoutes: 25 });
    MockFirebase.setDoc(countsRef(), { version: countsVersion - 1 });
    await mountView();
    expect(MockFirebase.getDoc(countsRef())).toEqual(
      testCounts(new Map([[rid, route]]))
    );

    // The doc should also be rebuilt if it's missing the version field.
    MockFirebase.setDoc(countsRef(), {});
    await mountView();
    expect(MockFirebase.getDoc(countsRef())).toEqual(
      testCounts(new Map([[rid, route]]))
    );
  });
});
