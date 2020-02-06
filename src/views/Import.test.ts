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

import { ApiRoute, ApiTick, getRoutesUrl, getTicksUrl } from '@/api';
import { AreaId, makeAreaId, Route, RouteId, Tick, TickId } from '@/models';
import {
  makeApiRoute,
  makeApiTick,
  makeRoute,
  makeRouteSummary,
  makeTick,
} from '@/testdata';
import { parseDate, getDayOfWeek } from '@/dateutil';

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
  const tickStatsPath = `${userPath}/stats/ticks`;

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
    const routeIds = routes.map(r => r.id).join(',');
    mockAxios
      .onGet(getRoutesUrl, { params: { routeIds, key } })
      .replyOnce(200, { routes, success: true });
  }

  it('fetches and saves new data', async () => {
    handleGetTicks([makeApiTick(tid1, rid1)]);
    handleGetRoutes([makeApiRoute(rid1, loc)]);
    await doImport();

    const r1 = makeRoute(rid1, [tid1], loc);
    const t1 = makeTick(tid1, rid1);
    expect(MockFirebase.getDoc(userPath)).toEqual({ maxTickId: tid1 });
    expect(MockFirebase.getDoc(`${userPath}/routes/${rid1}`)).toEqual(r1);
    expect(MockFirebase.getDoc(`${userPath}/areas/${aid}`)).toEqual({
      routes: { [rid1]: makeRouteSummary(rid1) },
    });
    expect(MockFirebase.getDoc(areaMapPath)).toEqual({
      children: { [loc[0]]: { children: { [loc[1]]: { areaId: aid } } } },
    });
    expect(MockFirebase.getDoc(tickStatsPath)).toEqual({
      areas: { [aid]: 1 },
      dates: { [t1.date]: 1 },
      daysOfWeek: { [getDayOfWeek(parseDate(t1.date))]: 1 },
      grades: { [r1.grade]: 1 },
      routes: { [rid1]: 1 },
      routePitches: { [r1.pitches!]: 1 },
      routeTypes: { [r1.type]: 1 },
      tickPitches: { [t1.pitches!]: 1 },
      tickStyles: { [t1.style]: 1 },
    });
  });

  it('preserves existing data', async () => {
    // Start out with a single route with a single tick.
    const r1 = makeRoute(rid1, [tid1], loc);
    const t1 = makeTick(tid1, rid1);
    MockFirebase.setDoc(userPath, { maxTickId: tid1 });
    MockFirebase.setDoc(`${userPath}/routes/${rid1}`, r1);
    MockFirebase.setDoc(`${userPath}/areas/${aid}`, {
      routes: { [rid1]: makeRouteSummary(rid1) },
    });
    MockFirebase.setDoc(areaMapPath, {
      children: { [loc[0]]: { children: { [loc[1]]: { areaId: aid } } } },
    });
    MockFirebase.setDoc(tickStatsPath, {
      areas: { [aid]: 1 },
      dates: { [t1.date]: 1 },
      daysOfWeek: { [getDayOfWeek(parseDate(t1.date))]: 1 },
      grades: { [r1.grade]: 1 },
      routes: { [rid1]: 1 },
      routePitches: { [r1.pitches!]: 1 },
      routeTypes: { [r1.type]: 1 },
      tickPitches: { [t1.pitches!]: 1 },
      tickStyles: { [t1.style]: 1 },
    });

    // Report a second route in a subarea of the first route's area, and new
    // ticks for both routes.
    const loc2 = [loc[0]];
    const aid2 = makeAreaId(loc2);
    const r2 = makeRoute(rid2, [tid3], loc2);
    const t2 = makeTick(tid2, rid1);
    const t3 = makeTick(tid3, rid2);
    handleGetTicks([makeApiTick(tid2, rid1), makeApiTick(tid3, rid2)]);
    handleGetRoutes([makeApiRoute(rid2, loc2)]);
    await doImport();

    expect(MockFirebase.getDoc(userPath)).toEqual({ maxTickId: tid3 });
    expect(MockFirebase.getDoc(`${userPath}/routes/${rid1}`)).toEqual(
      makeRoute(rid1, [tid1, tid2], loc)
    );
    expect(MockFirebase.getDoc(`${userPath}/routes/${rid2}`)).toEqual(
      makeRoute(rid2, [tid3], loc2)
    );
    expect(MockFirebase.getDoc(`${userPath}/areas/${aid}`)).toEqual({
      routes: { [rid1]: makeRouteSummary(rid1) },
    });
    expect(MockFirebase.getDoc(`${userPath}/areas/${aid2}`)).toEqual({
      routes: { [rid2]: makeRouteSummary(rid2) },
    });
    expect(MockFirebase.getDoc(areaMapPath)).toEqual({
      children: {
        [loc[0]]: { areaId: aid2, children: { [loc[1]]: { areaId: aid } } },
      },
    });
    expect(MockFirebase.getDoc(tickStatsPath)).toEqual({
      areas: { [aid]: 2, [aid2]: 1 },
      dates: { [t1.date]: 1, [t2.date]: 1, [t3.date]: 1 },
      daysOfWeek: {
        [getDayOfWeek(parseDate(t1.date))]: 1,
        [getDayOfWeek(parseDate(t2.date))]: 1,
        [getDayOfWeek(parseDate(t3.date))]: 1,
      },
      grades: { [r1.grade]: 2, [r2.grade]: 1 },
      routes: { [rid1]: 2, [rid2]: 1 },
      routePitches: { [r1.pitches!]: 2, [r2.pitches!]: 1 },
      routeTypes: { [r1.type]: 2, [r2.type]: 1 },
      // TODO: This is hacky and just works because the ticks use route pitches.
      tickPitches: { [r1.pitches!]: 2, [r2.pitches!]: 1 },
      tickStyles: { [t1.style]: 1, [t2.style]: 1, [t3.style]: 1 },
    });
  });
});
