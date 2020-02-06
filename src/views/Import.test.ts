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
import { makeAreaId } from '@/models';
import {
  makeApiRoute,
  makeApiTick,
  makeRoute,
  makeRouteSummary,
} from '@/testdata';

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
  const email = 'user@example.org';
  const key = 'secret123';

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
    await flushPromises(); // flush after get-ticks call
    await flushPromises(); // flush after get-routes call
  }

  function handleGetTicks(ticks: ApiTick[]) {
    mockAxios
      .onGet(getTicksUrl, { params: { email, key, startPos: 0 } })
      .replyOnce(200, { hardest: '', average: '', ticks, success: true })
      .onGet(getTicksUrl, { params: { email, key, startPos: ticks.length } })
      .replyOnce(200, { hardest: '', average: '', ticks: [], success: true });
  }

  function handleGetRoutes(routes: ApiRoute[]) {
    // TODO: Will we have issues with the order not matching when multiple
    // routes are requested?
    const routeIds = routes.map(r => r.id).join(',');
    mockAxios
      .onGet(getRoutesUrl, { params: { routeIds, key } })
      .replyOnce(200, { routes, success: true });
  }

  it('fetches and saves new data', async () => {
    const routeId1 = 1;
    const tickId1 = 10;
    const location = ['California', 'Yosemite'];
    const areaId = makeAreaId(location);

    handleGetTicks([makeApiTick(tickId1, routeId1)]);
    handleGetRoutes([makeApiRoute(routeId1, location)]);
    await doImport();

    expect(MockFirebase.getDoc(userPath)).toEqual({ maxTickId: tickId1 });
    expect(MockFirebase.getDoc(`${userPath}/routes/${routeId1}`)).toEqual(
      makeRoute(routeId1, [tickId1], location)
    );
    expect(MockFirebase.getDoc(`${userPath}/areas/${areaId}`)).toEqual({
      routes: { [routeId1]: makeRouteSummary(routeId1) },
    });
    expect(MockFirebase.getDoc(areaMapPath)).toEqual({
      children: { California: { children: { Yosemite: { areaId } } } },
    });
  });

  it('preserves existing data', async () => {
    // Start out with a single tick.
    const routeId1 = 1;
    const tickId1 = 10;
    const location1 = ['A', 'B'];
    const areaId1 = makeAreaId(location1);
    MockFirebase.setDoc(userPath, { maxTickId: tickId1 });
    MockFirebase.setDoc(
      `${userPath}/routes/${routeId1}`,
      makeRoute(routeId1, [tickId1], location1)
    );
    MockFirebase.setDoc(`${userPath}/areas/${areaId1}`, {
      routes: { [routeId1]: makeRouteSummary(routeId1) },
    });
    MockFirebase.setDoc(areaMapPath, {
      children: {
        [location1[0]]: { children: { [location1[1]]: { areaId: areaId1 } } },
      },
    });

    // Report a second route in a subarea of the first route's area, and new
    // ticks for the first and second routes.
    const routeId2 = 2;
    const tickId2 = 11;
    const tickId3 = 12;
    const location2 = ['A'];
    const areaId2 = makeAreaId(location2);
    handleGetTicks([
      makeApiTick(tickId2, routeId1),
      makeApiTick(tickId3, routeId2),
    ]);
    handleGetRoutes([makeApiRoute(routeId2, location2)]);
    await doImport();

    expect(MockFirebase.getDoc(userPath)).toEqual({ maxTickId: tickId3 });
    expect(MockFirebase.getDoc(`${userPath}/routes/${routeId1}`)).toEqual(
      makeRoute(routeId1, [tickId1, tickId2], location1)
    );
    expect(MockFirebase.getDoc(`${userPath}/routes/${routeId2}`)).toEqual(
      makeRoute(routeId2, [tickId3], location2)
    );
    expect(MockFirebase.getDoc(`${userPath}/areas/${areaId1}`)).toEqual({
      routes: { [routeId1]: makeRouteSummary(routeId1) },
    });
    expect(MockFirebase.getDoc(`${userPath}/areas/${areaId2}`)).toEqual({
      routes: { [routeId2]: makeRouteSummary(routeId2) },
    });
    expect(MockFirebase.getDoc(areaMapPath)).toEqual({
      children: {
        A: { areaId: areaId2, children: { B: { areaId: areaId1 } } },
      },
    });
  });
});
