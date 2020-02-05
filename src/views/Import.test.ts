// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MockFirebase } from '@/firebase/mock';
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
  beforeEach(() => {
    mockAxios.reset();
  });

  let wrapper: Wrapper<Vue>;

  const email = 'user@example.org';
  const key = 'secret123';

  beforeEach(async () => {
    MockFirebase.reset();
    wrapper = mount(Import, newVuetifyMountOptions());
    await flushPromises();
  });

  // Returns a vue-test-utils Wrapper object for the component under |wrapper|
  // (i.e. the main view) identified by |ref|, which should've been assigned to
  // the element via a 'ref' attribute in the template.
  function findRef(ref: string): Wrapper<Vue> {
    return wrapper.find({ ref });
  }

  // Fills the form and clicks the import button.
  async function startImport() {
    findRef('emailField').vm.$emit('input', email);
    findRef('keyField').vm.$emit('input', key);
    await flushPromises();
    const button = findRef('importButton');
    expect(button.attributes('disabled')).toBeFalsy();
    button.trigger('click');
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

  it('fetches and saves data', async () => {
    const routeId1 = 1;
    const tickId1 = 10;
    const location = ['California', 'Yosemite'];
    const areaId = makeAreaId(location);

    handleGetTicks([makeApiTick(tickId1, routeId1)]);
    handleGetRoutes([makeApiRoute(routeId1, location)]);
    startImport();
    await flushPromises();
    // TODO: Needed for the get-routes call. This is super-hacky.
    await flushPromises();

    expect(MockFirebase.getDoc(`users/default/routes/${routeId1}`)).toEqual(
      makeRoute(routeId1, [tickId1], location)
    );
    expect(MockFirebase.getDoc(`users/default/areas/${areaId}`)).toEqual({
      routes: { [routeId1]: makeRouteSummary(routeId1) },
    });
    expect(MockFirebase.getDoc('users/default/areas/map')).toEqual({
      children: { [location[0]]: { children: { [location[1]]: { areaId } } } },
    });
  });
});
