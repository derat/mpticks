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

import flushPromises from 'flush-promises';

import {
  ApiRoute,
  ApiTick,
  getApiRoutesUrl,
  getApiTicksUrl,
  maxRoutesPerRequest,
} from '@/api';
import { parseDate, getDayOfWeek } from '@/dateutil';
import {
  areaMapRef,
  areaRef,
  countsRef,
  importsRef,
  userRef,
  routeRef,
} from '@/docs';
import { truncateLatLong } from '@/geoutil';
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
import {
  testApiRoute,
  testApiTick,
  testCounts,
  testRoute,
  testRouteSummary,
  testTick,
} from '@/testdata';
import {
  newVuetifyMountOptions,
  setUpVuetifyTesting,
  stubConsole,
} from '@/testutil';
import { makeAreaId } from '@/update';

import Import from './Import.vue';

setUpVuetifyTesting();

const mockAxios = new MockAdapter(axios);
afterAll(() => {
  mockAxios.restore();
});

describe('Import', () => {
  let wrapper: Wrapper<Vue>;

  const testUid = 'test-uid';
  const email = 'user@example.org';
  const key = 'secret123';

  const rid1: TickId = 1;
  const rid2: TickId = 2;
  const tid1: TickId = 10;
  const tid2: TickId = 11;
  const tid3: TickId = 12;
  const loc = ['A', 'B'];
  const aid = makeAreaId(loc);

  // https://stackoverflow.com/a/57599680/6882947
  let mockTime = new Date(2020, 0, 1).getTime();
  const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => mockTime);

  beforeEach(async () => {
    mockAxios.reset();
    MockFirebase.reset();
    MockFirebase.currentUser = new MockUser(testUid, 'Test User');

    // Disable sync mode since it causes "TypeError: Cannot read property
    // '$scopedSlots' of undefined" errors here. It's apparently permanently
    // removed after @vue/test-utils@1.0.0-beta.29:
    // https://github.com/vuejs/vue-test-utils/issues/1130
    wrapper = mount(Import, newVuetifyMountOptions({ sync: false }));
    await flushPromises();
  });

  // Returns a vue-test-utils Wrapper object for the component under |wrapper|
  // (i.e. the main view) identified by |ref|, which should've been assigned to
  // the element via a 'ref' attribute in the template.
  function findRef(ref: string): Wrapper<Vue> {
    return wrapper.find({ ref });
  }

  async function clickButton(ref: string) {
    const button = findRef(ref);
    expect(button.attributes('disabled')).toBeFalsy();
    button.trigger('click');
    await flushPromises();
  }

  // Fills the form, clicks the import button, and waits for the import to
  // finish.
  async function doImport() {
    findRef('emailField').vm.$emit('input', email);
    findRef('keyField').vm.$emit('input', key);
    await flushPromises(); // validate the form
    await clickButton('importButton');
  }

  function handleGetTicks(ticks: ApiTick[]) {
    mockAxios
      .onGet(getApiTicksUrl, { params: { email, key, startPos: 0 } })
      .replyOnce(200, { hardest: '', average: '', ticks, success: true })
      .onGet(getApiTicksUrl, { params: { email, key, startPos: ticks.length } })
      .replyOnce(200, { hardest: '', average: '', ticks: [], success: true });
  }

  function handleGetRoutes(routes: ApiRoute[]) {
    for (let i = 0; i < routes.length; i += maxRoutesPerRequest) {
      const routesSlice = routes.slice(i, i + maxRoutesPerRequest);
      const routeIds = routesSlice.map(r => r.id).join(',');
      mockAxios
        .onGet(getApiRoutesUrl, { params: { routeIds, key } })
        .replyOnce(200, { routes: routesSlice, success: true });
    }
  }

  it('fetches and saves new data', async () => {
    handleGetTicks([testApiTick(tid1, rid1)]);
    handleGetRoutes([testApiRoute(rid1, loc)]);
    await doImport();

    const r1 = testRoute(rid1, [tid1], loc);
    const t1 = testTick(tid1, rid1);
    expect(MockFirebase.getDoc(userRef())).toEqual({
      maxTickId: tid1,
      numRoutes: 1,
      numImports: 1,
      lastImportTime: new Date(mockTime),
    });
    expect(MockFirebase.getDoc(routeRef(rid1))).toEqual(r1);
    expect(MockFirebase.getDoc(areaRef(aid))).toEqual({
      routes: { [rid1]: testRouteSummary(rid1) },
    });
    expect(MockFirebase.getDoc(areaMapRef())).toEqual({
      children: { [loc[0]]: { children: { [loc[1]]: { areaId: aid } } } },
    });
    expect(MockFirebase.getDoc(countsRef())).toEqual(
      testCounts(new Map([[rid1, r1]]))
    );
  });

  it('preserves existing data', async () => {
    // Start out with a single route with a single tick.
    let r1 = testRoute(rid1, [tid1], loc);
    const t1 = testTick(tid1, rid1);
    MockFirebase.setDoc(userRef(), {
      maxTickId: tid1,
      numRoutes: 1,
      numImports: 10,
      lastImportTime: new Date(2019, 11, 15),
    });
    MockFirebase.setDoc(routeRef(rid1), r1);
    MockFirebase.setDoc(areaRef(aid), {
      routes: { [rid1]: testRouteSummary(rid1) },
    });
    MockFirebase.setDoc(areaMapRef(), {
      children: { [loc[0]]: { children: { [loc[1]]: { areaId: aid } } } },
    });
    MockFirebase.setDoc(countsRef(), testCounts(new Map([[rid1, r1]])));

    // Report a second route in a subarea of the first route's area, and new
    // ticks for both routes.
    const loc2 = [loc[0]];
    const aid2 = makeAreaId(loc2);
    r1 = testRoute(rid1, [tid1, tid2], loc);
    const r2 = testRoute(rid2, [tid3], loc2);
    const ticks = [t1, testTick(tid2, rid1), testTick(tid3, rid2)];
    handleGetTicks([testApiTick(tid2, rid1), testApiTick(tid3, rid2)]);
    handleGetRoutes([testApiRoute(rid2, loc2)]);
    await doImport();

    expect(MockFirebase.getDoc(userRef())).toEqual({
      maxTickId: tid3,
      numRoutes: 2,
      numImports: 11,
      lastImportTime: new Date(mockTime),
    });
    expect(MockFirebase.getDoc(routeRef(rid1))).toEqual(
      testRoute(rid1, [tid1, tid2], loc)
    );
    expect(MockFirebase.getDoc(routeRef(rid2))).toEqual(
      testRoute(rid2, [tid3], loc2)
    );
    expect(MockFirebase.getDoc(areaRef(aid))).toEqual({
      routes: { [rid1]: testRouteSummary(rid1) },
    });
    expect(MockFirebase.getDoc(areaRef(aid2))).toEqual({
      routes: { [rid2]: testRouteSummary(rid2) },
    });
    expect(MockFirebase.getDoc(areaMapRef())).toEqual({
      children: {
        [loc[0]]: { areaId: aid2, children: { [loc[1]]: { areaId: aid } } },
      },
    });
    // prettier-ignore
    expect(MockFirebase.getDoc(countsRef())).toEqual(
      testCounts(new Map([[rid1, r1], [rid2, r2]]))
    );
  });

  it('handles slashes in location components', async () => {
    const weirdLoc = ['A/B', 'C/D'];
    handleGetTicks([testApiTick(tid1, rid1)]);
    handleGetRoutes([testApiRoute(rid1, weirdLoc)]);
    await doImport();

    const weirdAid = makeAreaId(weirdLoc);
    expect(weirdAid).not.toContain('/');

    const r1 = testRoute(rid1, [tid1], weirdLoc);
    const t1 = testTick(tid1, rid1);
    expect(MockFirebase.getDoc(routeRef(rid1))).toEqual(r1);
    expect(MockFirebase.getDoc(areaRef(weirdAid))).toEqual({
      routes: { [rid1]: testRouteSummary(rid1) },
    });
    expect(MockFirebase.getDoc(areaMapRef())).toEqual({
      children: {
        [weirdLoc[0]]: { children: { [weirdLoc[1]]: { areaId: weirdAid } } },
      },
    });
    expect(MockFirebase.getDoc(countsRef())).toEqual(
      testCounts(new Map([[rid1, r1]]))
    );
  });

  it('updates route ticks stat', async () => {
    // Start out with a full set of route counts.
    const routeTicks = Object.fromEntries(
      [...Array(numTopRoutes).keys()].map(i => [`${i + 1}|${i + 1}`, i + 1])
    );
    MockFirebase.setDoc(countsRef(), { routeTicks });

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
    expect(MockFirebase.getDoc(countsRef())!.routeTicks).toEqual(routeTicks);
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
    const routesRegExp = new RegExp(`^${importsRef().path}/.*\.routes`);
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
    const ticksRegExp = new RegExp(`^${importsRef().path}/.*\.ticks`);
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

  it('reimports updated routes', async () => {
    // Perform an initial import.
    const oldApiRoute = testApiRoute(rid1, loc);
    handleGetTicks([testApiTick(tid1, rid1)]);
    handleGetRoutes([oldApiRoute]);
    await doImport();

    // Update the route doc to contain a deleted tick.
    const oldRoute = MockFirebase.getDoc(routeRef(rid1)) as Route;
    oldRoute.deletedTicks = { 1000: testTick(1000, rid1) };
    MockFirebase.setDoc(routeRef(rid1), oldRoute);

    // Simulate the API returning updated data for the route.
    const newLoc = ['C'];
    const newAid = makeAreaId(newLoc);
    const newApiRoute = testApiRoute(rid1, newLoc);
    newApiRoute.name = 'Updated Name';
    newApiRoute.rating = '5.15d';
    handleGetRoutes([newApiRoute]);

    // Trigger a reimport after a second.
    const importTime = new Date(mockTime);
    mockTime += 1000;
    await clickButton('showAdvancedButton');
    await clickButton('reimportRoutesButton');

    const newRoute = testRoute(rid1, [tid1], newLoc);
    newRoute.name = newApiRoute.name;
    newRoute.grade = newApiRoute.rating;
    newRoute.deletedTicks = oldRoute.deletedTicks;

    // The new route should've been written to Firestore, and other docs should
    // also be updated appropriately.
    expect(MockFirebase.getDoc(userRef())).toEqual({
      maxTickId: tid1,
      numRoutes: 1,
      numImports: 1,
      lastImportTime: importTime,
      numReimports: 1,
    });
    expect(MockFirebase.getDoc(routeRef(rid1))).toEqual(newRoute);
    expect(MockFirebase.getDoc(areaRef(newAid))).toEqual({
      routes: { [rid1]: { name: newRoute.name, grade: newRoute.grade } },
    });
    expect(MockFirebase.getDoc(areaMapRef())).toEqual({
      children: { C: { areaId: newAid } },
    });
    expect(MockFirebase.getDoc(countsRef())).toEqual(
      testCounts(new Map([[rid1, newRoute]]))
    );

    // The old and new route data received via the API should've been recorded.
    const routesRegExp = new RegExp(`^${importsRef().path}/.*\.routes`);
    const savedRoutes = MockFirebase.listDocs()
      .filter(p => p.match(routesRegExp))
      .sort()
      .map(p => MockFirebase.getDoc(p)!.routes)
      .flat();
    expect(savedRoutes).toEqual([oldApiRoute, newApiRoute]);
  });

  it('refuses to import ticks using cached data', async () => {
    const userDoc = {
      maxTickId: tid1,
      numRoutes: 1,
      numImports: 10,
      lastImportTime: new Date(2019, 11, 15),
    };
    MockFirebase.setDoc(userRef(), userDoc);

    MockFirebase.serveFromCache = true;
    handleGetTicks([testApiTick(tid1, rid1)]);
    handleGetRoutes([testApiRoute(rid1, loc)]);

    const origConsole = stubConsole();
    await doImport();
    console = origConsole;

    // An error should be displayed and the user doc shouldn't be updated.
    expect(findRef('errorAlert').text()).toContain('Import failed');
    expect(MockFirebase.getDoc(userRef())).toEqual(userDoc);
  });
});
