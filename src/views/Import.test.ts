// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MockFirebase, MockUser } from '@/firebase/mock';
import firebase from 'firebase/app';
import 'firebase/firestore';

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import Vue from 'vue';
import { mount, Wrapper } from '@vue/test-utils';
import { setUpVuetifyTesting, newVuetifyMountOptions } from '@/testutil';

import flushPromises from 'flush-promises';

import {
  ApiRoute,
  ApiTick,
  getRoutesUrl,
  getTicksUrl,
  maxRoutesPerRequest,
} from '@/api';
import {
  AreaId,
  importedRoutesBatchSize,
  importedTicksBatchSize,
  isCleanTickStyle,
  numTopRoutes,
  Route,
  RouteId,
  Tick,
  TickId,
} from '@/models';
import { makeAreaId } from '@/convert';
import {
  testApiRoute,
  testApiTick,
  testRoute,
  testRouteSummary,
  testTick,
} from '@/testdata';
import { parseDate, getDayOfWeek } from '@/dateutil';
import { truncateLatLong } from '@/geoutil';

import Import from './Import.vue';

setUpVuetifyTesting();

const mockAxios = new MockAdapter(axios);
afterAll(() => {
  mockAxios.restore();
});

describe('Import', () => {
  let wrapper: Wrapper<Vue>;

  const testUid = 'test-uid';
  const userPath = `users/${testUid}`;
  const areaMapPath = `${userPath}/areas/map`;
  const countsPath = `${userPath}/stats/counts`;

  const email = 'user@example.org';
  const key = 'secret123';

  const rid1: TickId = 1;
  const rid2: TickId = 2;
  const tid1: TickId = 10;
  const tid2: TickId = 11;
  const tid3: TickId = 12;
  const loc = ['A', 'B'];
  const aid = makeAreaId(loc);

  beforeEach(async () => {
    mockAxios.reset();
    MockFirebase.reset();
    MockFirebase.currentUser = new MockUser(testUid, 'Test User');
    wrapper = mount(Import, newVuetifyMountOptions());
    await flushPromises();
  });

  // Returns a vue-test-utils Wrapper object for the component under |wrapper|
  // (i.e. the main view) identified by |ref|, which should've been assigned to
  // the element via a 'ref' attribute in the template.
  function findRef(ref: string): Wrapper<Vue> {
    return wrapper.find({ ref });
  }

  // Fills the form, clicks the import button, and waits for the import to
  // finish.
  async function doImport() {
    findRef('emailField').vm.$emit('input', email);
    findRef('keyField').vm.$emit('input', key);
    await flushPromises(); // validate the form

    const button = findRef('importButton');
    expect(button.attributes('disabled')).toBeFalsy();
    button.trigger('click');
    await flushPromises(); // do the import
  }

  function handleGetTicks(ticks: ApiTick[]) {
    mockAxios
      .onGet(getTicksUrl, { params: { email, key, startPos: 0 } })
      .replyOnce(200, { hardest: '', average: '', ticks, success: true })
      .onGet(getTicksUrl, { params: { email, key, startPos: ticks.length } })
      .replyOnce(200, { hardest: '', average: '', ticks: [], success: true });
  }

  function handleGetRoutes(routes: ApiRoute[]) {
    for (let i = 0; i < routes.length; i += maxRoutesPerRequest) {
      const routesSlice = routes.slice(i, i + maxRoutesPerRequest);
      const routeIds = routesSlice.map(r => r.id).join(',');
      mockAxios
        .onGet(getRoutesUrl, { params: { routeIds, key } })
        .replyOnce(200, { routes: routesSlice, success: true });
    }
  }

  // Runs |keyFunc| and |valFunc| on each tick in |ticks| and returns a map from
  // each key to its summed values. If |valFunc| isn't supplied, a value of 1 is
  // used for each tick.
  function makeTickCounts(
    ticks: Tick[],
    keyFunc: (t: Tick) => number | string,
    valFunc?: (t: Tick) => number
  ): Record<string, number> {
    return ticks.reduce((m, t) => {
      const key = keyFunc(t).toString();
      const val = valFunc ? valFunc(t) : 1;
      m[key] = m[key] + val || val;
      return m;
    }, {} as Record<string, number>);
  }

  it('fetches and saves new data', async () => {
    handleGetTicks([testApiTick(tid1, rid1)]);
    handleGetRoutes([testApiRoute(rid1, loc)]);
    await doImport();

    const r1 = testRoute(rid1, [tid1], loc);
    const t1 = testTick(tid1, rid1);
    expect(MockFirebase.getDoc(userPath)).toEqual({
      maxTickId: tid1,
      numRoutes: 1,
    });
    expect(MockFirebase.getDoc(`${userPath}/routes/${rid1}`)).toEqual(r1);
    expect(MockFirebase.getDoc(`${userPath}/areas/${aid}`)).toEqual({
      routes: { [rid1]: testRouteSummary(rid1) },
    });
    expect(MockFirebase.getDoc(areaMapPath)).toEqual({
      children: { [loc[0]]: { children: { [loc[1]]: { areaId: aid } } } },
    });
    expect(MockFirebase.getDoc(countsPath)).toEqual({
      datePitches: { [t1.date]: t1.pitches },
      dateTicks: { [t1.date]: 1 },
      dayOfWeekPitches: { [getDayOfWeek(parseDate(t1.date))]: t1.pitches },
      dayOfWeekTicks: { [getDayOfWeek(parseDate(t1.date))]: 1 },
      gradeCleanTicks: isCleanTickStyle(t1.style) ? { [r1.grade]: 1 } : {},
      gradeTicks: { [r1.grade]: 1 },
      latLongTicks: { [truncateLatLong(r1.lat, r1.long)]: 1 },
      pitchesTicks: { [t1.pitches]: 1 },
      regionTicks: { [loc[0]]: 1 },
      routeTicks: { [`${rid1}|${r1.name}`]: 1 },
      routeTypeTicks: { [r1.type]: 1 },
      tickStyleTicks: { [t1.style]: 1 },
    });
  });

  it('preserves existing data', async () => {
    // Start out with a single route with a single tick.
    const r1 = testRoute(rid1, [tid1], loc);
    const t1 = testTick(tid1, rid1);
    MockFirebase.setDoc(userPath, { maxTickId: tid1, numRoutes: 1 });
    MockFirebase.setDoc(`${userPath}/routes/${rid1}`, r1);
    MockFirebase.setDoc(`${userPath}/areas/${aid}`, {
      routes: { [rid1]: testRouteSummary(rid1) },
    });
    MockFirebase.setDoc(areaMapPath, {
      children: { [loc[0]]: { children: { [loc[1]]: { areaId: aid } } } },
    });

    MockFirebase.setDoc(countsPath, {
      datePitches: { [t1.date]: t1.pitches },
      dateTicks: { [t1.date]: 1 },
      dayOfWeekPitches: { [getDayOfWeek(parseDate(t1.date))]: t1.pitches },
      dayOfWeekTicks: { [getDayOfWeek(parseDate(t1.date))]: 1 },
      gradeTicks: { [r1.grade]: 1 },
      gradeCleanTicks: isCleanTickStyle(t1.style) ? { [r1.grade]: 1 } : {},
      latLongTicks: { [truncateLatLong(r1.lat, r1.long)]: 1 },
      pitchesTicks: { [t1.pitches]: 1 },
      regionTicks: { [loc[0]]: 1 },
      routeTicks: { [`${rid1}|${r1.name}`]: 1 },
      routeTypeTicks: { [r1.type]: 1 },
      tickStyleTicks: { [t1.style]: 1 },
    });

    // Report a second route in a subarea of the first route's area, and new
    // ticks for both routes.
    const loc2 = [loc[0]];
    const aid2 = makeAreaId(loc2);
    const r2 = testRoute(rid2, [tid3], loc2);
    const ticks = [t1, testTick(tid2, rid1), testTick(tid3, rid2)];
    // This is a hack that just works since test ticks have unique dates.
    const dateRoutes = {
      [ticks[0].date]: r1,
      [ticks[1].date]: r1,
      [ticks[2].date]: r2,
    };
    handleGetTicks([testApiTick(tid2, rid1), testApiTick(tid3, rid2)]);
    handleGetRoutes([testApiRoute(rid2, loc2)]);
    await doImport();

    expect(MockFirebase.getDoc(userPath)).toEqual({
      maxTickId: tid3,
      numRoutes: 2,
    });
    expect(MockFirebase.getDoc(`${userPath}/routes/${rid1}`)).toEqual(
      testRoute(rid1, [tid1, tid2], loc)
    );
    expect(MockFirebase.getDoc(`${userPath}/routes/${rid2}`)).toEqual(
      testRoute(rid2, [tid3], loc2)
    );
    expect(MockFirebase.getDoc(`${userPath}/areas/${aid}`)).toEqual({
      routes: { [rid1]: testRouteSummary(rid1) },
    });
    expect(MockFirebase.getDoc(`${userPath}/areas/${aid2}`)).toEqual({
      routes: { [rid2]: testRouteSummary(rid2) },
    });
    expect(MockFirebase.getDoc(areaMapPath)).toEqual({
      children: {
        [loc[0]]: { areaId: aid2, children: { [loc[1]]: { areaId: aid } } },
      },
    });
    expect(MockFirebase.getDoc(countsPath)).toEqual({
      datePitches: makeTickCounts(
        ticks,
        t => t.date,
        t => t.pitches
      ),
      dateTicks: makeTickCounts(ticks, t => t.date),
      dayOfWeekPitches: makeTickCounts(
        ticks,
        t => getDayOfWeek(parseDate(t.date)),
        t => t.pitches
      ),
      dayOfWeekTicks: makeTickCounts(ticks, t =>
        getDayOfWeek(parseDate(t.date))
      ),
      gradeCleanTicks: makeTickCounts(
        ticks,
        t => dateRoutes[t.date].grade,
        t => (isCleanTickStyle(t.style) ? 1 : 0)
      ),
      gradeTicks: { [r1.grade]: 2, [r2.grade]: 1 },
      latLongTicks: {
        [truncateLatLong(r1.lat, r1.long)]: 2,
        [truncateLatLong(r2.lat, r2.long)]: 1,
      },
      pitchesTicks: makeTickCounts(ticks, t => t.pitches),
      regionTicks: { [loc[0]]: 3 },
      routeTicks: { [`${rid1}|${r1.name}`]: 2, [`${rid2}|${r2.name}`]: 1 },
      routeTypeTicks: { [r1.type]: 2, [r2.type]: 1 },
      tickStyleTicks: makeTickCounts(ticks, t => t.style),
    });
  });

  it('updates route ticks stat', async () => {
    // Start out with a full set of route counts.
    const routeTicks = Object.fromEntries(
      [...Array(numTopRoutes).keys()].map(i => [`${i + 1}|${i + 1}`, i + 1])
    );
    MockFirebase.setDoc(countsPath, { routeTicks });

    // Report a new route with a large number of ticks.
    const routeId = 100;
    const numTicks = 30;
    const tickIds = [...Array(numTicks).keys()].map(i => i + 100);
    const route = testRoute(routeId, tickIds, loc);
    handleGetTicks(tickIds.map(id => testApiTick(id, routeId)));
    handleGetRoutes([testApiRoute(routeId, loc)]);
    await doImport();

    // The new route should've pushed out the old route with the least ticks.
    delete routeTicks['1|1'];
    routeTicks[`${routeId}|${route.name}`] = numTicks;
    expect(MockFirebase.getDoc(countsPath)!.routeTicks).toEqual(routeTicks);
  });

  it('saves original data', async () => {
    const numItems = 450;
    const startRouteId = 1;
    const startTickId = 1000;
    const apiRoutes = [...Array(numItems).keys()].map(i =>
      testApiRoute(i + startRouteId, loc)
    );
    const apiTicks = [...Array(numItems).keys()].map(i =>
      testApiTick(i + startTickId, i + startRouteId)
    );
    handleGetTicks(apiTicks);
    handleGetRoutes(apiRoutes);
    await doImport();

    let numSavedRoutes = 0;
    const routesRegExp = new RegExp(`^${userPath}/imports/.*\.routes`);
    MockFirebase.listDocs()
      .filter(p => p.match(routesRegExp))
      .sort()
      .map(p => MockFirebase.getDoc(p)!.routes)
      .forEach((savedRoutes, i) => {
        numSavedRoutes += savedRoutes.length;
        expect(savedRoutes).toEqual(
          apiRoutes.slice(
            i * importedRoutesBatchSize,
            (i + 1) * importedRoutesBatchSize
          )
        );
      });
    expect(numSavedRoutes).toBe(numItems);

    let numSavedTicks = 0;
    const ticksRegExp = new RegExp(`^${userPath}/imports/.*\.ticks`);
    MockFirebase.listDocs()
      .filter(p => p.match(ticksRegExp))
      .sort()
      .map(p => MockFirebase.getDoc(p)!.ticks)
      .forEach((savedTicks, i) => {
        numSavedTicks += savedTicks.length;
        expect(savedTicks).toEqual(
          apiTicks.slice(
            i * importedTicksBatchSize,
            (i + 1) * importedTicksBatchSize
          )
        );
      });
    expect(numSavedTicks).toBe(numItems);
  });
});
