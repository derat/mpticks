// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import {
  ApiRoute,
  ApiTick,
  getApiRoutes,
  getApiRoutesUrl,
  getApiTicks,
  getApiTicksUrl,
  maxRoutesPerRequest,
} from './api';

import { testApiRoute, testApiTick } from '@/testdata';

// Arbitrary data to use in tests.
const email = 'user@example.org';
const key = 'secret123';

const mockAxios = new MockAdapter(axios);
afterAll(() => {
  mockAxios.restore();
});

describe('getApiTicks', () => {
  beforeEach(() => {
    mockAxios.reset();
  });

  // Returns |count| ApiTicks starting at the supplied tick ID and counting
  // down. Each tick contains arbitrary but consistent data.
  function createTicks(startId: number, count: number): ApiTick[] {
    // https://stackoverflow.com/a/29559488
    return [...Array(count).keys()].map(i => {
      const tickId = startId - i;
      return testApiTick(tickId, 100 + tickId /* routeId */);
    });
  }

  // Sets a response for a get-ticks request with the supplied |startPos|
  // parameter. Will return |count| ticks starting with id |startId|.
  function handleGetTicks(startPos: number, startId: number, count: number) {
    mockAxios
      .onGet(getApiTicksUrl, { params: { email, key, startPos } })
      .replyOnce(200, {
        hardest: '',
        average: '',
        ticks: createTicks(startId, count),
        success: true,
      });
  }

  it('handles not receiving any ticks', done => {
    handleGetTicks(0, -1, 0);
    getApiTicks(email, key).then(ticks => {
      expect(ticks).toEqual([]);
      done();
    });
  });

  it('returns a single set of ticks', done => {
    handleGetTicks(0, 100, 3);
    handleGetTicks(3, -1, 0);
    getApiTicks(email, key).then(ticks => {
      expect(ticks).toEqual(createTicks(100, 3));
      done();
    });
  });

  it('aggregates multiple sets of ticks', done => {
    // Return 3 ticks, then 3 more, and then 1 final tick.
    handleGetTicks(0, 100, 3);
    handleGetTicks(3, 97, 3);
    handleGetTicks(6, 94, 1);
    handleGetTicks(7, -1, 0);
    getApiTicks(email, key).then(ticks => {
      expect(ticks).toEqual(createTicks(100, 7));
      done();
    });
  });

  it("doesn't return already-seen ticks", done => {
    handleGetTicks(0, 100, 3);
    handleGetTicks(3, 97, 3);
    getApiTicks(email, key, 97 /* minTickId */).then(ticks => {
      expect(ticks).toEqual(createTicks(100, 4));
      done();
    });
  });

  it("doesn't return anything if all ticks have been seen", done => {
    handleGetTicks(0, 100, 3);
    getApiTicks(email, key, 101 /* minTickId */).then(ticks => {
      expect(ticks).toEqual([]);
      done();
    });
  });
});

describe('getApiRoutes', () => {
  beforeEach(() => {
    mockAxios.reset();
  });

  // Sets a response for a get-routes request with the supplied |routeIds|
  // parameter. Will return the requested routes.
  function handleGetRoutes(routeIds: number[]) {
    mockAxios
      .onGet(getApiRoutesUrl, { params: { key, routeIds: routeIds.join(',') } })
      .replyOnce(200, {
        routes: routeIds.map(id => testApiRoute(id)),
        success: true,
      });
  }

  it('returns a single set of routes', done => {
    const ids = [123, 456, 789];
    handleGetRoutes(ids);
    getApiRoutes(ids, key).then(routes => {
      expect(routes).toEqual(ids.map(id => testApiRoute(id)));
      done();
    });
  });

  it('uses a single request when possible', done => {
    const ids = [...Array(maxRoutesPerRequest).keys()].map(i => i + 1);
    handleGetRoutes(ids);
    getApiRoutes(ids, key).then(routes => {
      expect(routes).toEqual(ids.map(id => testApiRoute(id)));
      done();
    });
  });

  it('uses multiple requests when needed', done => {
    const max = maxRoutesPerRequest;
    const ids = [...Array(2 * max + 10).keys()].map(i => i + 1);
    handleGetRoutes(ids.slice(0, max));
    handleGetRoutes(ids.slice(max, 2 * max));
    handleGetRoutes(ids.slice(2 * max));
    getApiRoutes(ids, key).then(routes => {
      expect(routes).toEqual(ids.map(id => testApiRoute(id)));
      done();
    });
  });
});
