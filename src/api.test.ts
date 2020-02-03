// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import moxios from 'moxios';
import {
  ApiRoute,
  ApiTick,
  getRoutes,
  getTicks,
  makeGetRoutesUrl,
  makeGetTicksUrl,
  maxRoutesPerRequest,
} from './api';

// Arbitrary data to use in tests.
const email = 'user@example.org';
const apiKey = 'secret123';

describe('getTicks', () => {
  beforeEach(() => {
    moxios.install();
  });
  afterEach(() => {
    moxios.uninstall();
  });

  // Returns |count| ApiTicks starting at the supplied tick ID and counting
  // down. Each tick contains arbitrary but consistent data.
  function createTicks(startId: number, count: number): ApiTick[] {
    // https://stackoverflow.com/a/29559488
    return [...Array(count).keys()].map(i => {
      const id = startId - i;
      return {
        routeId: id + 5,
        date: '2020-01-01',
        pitches: (id % 3) + 1,
        notes: `notes ${id}`,
        style: 'Lead',
        leadStyle: ['Flash', 'Redpoint'][id % 2],
        tickId: id,
        userStars: id % 5,
        userRating: ['5.6', '5.12a'][id % 2],
      };
    });
  }

  // Waits for the next HTTP request. Asserts that it is a get-ticks request
  // with the supplied |startPos| parameter and then returns |count| ticks
  // starting with id |startId|.
  function replyToGetTicks(startPos: number, startId: number, count: number) {
    const req = moxios.requests.mostRecent();
    expect(req.url).toEqual(makeGetTicksUrl(email, apiKey, startPos));
    return req.respondWith({
      status: 200,
      response: {
        hardest: '',
        average: '',
        ticks: createTicks(startId, count),
        success: true,
      },
    });
  }

  it('handles not receiving any ticks', done => {
    getTicks(email, apiKey).then(ticks => {
      expect(ticks).toEqual([]);
      done();
    });
    moxios.wait(() => replyToGetTicks(0, -1, 0));
  });

  it('returns a single set of ticks', done => {
    getTicks(email, apiKey).then(ticks => {
      expect(ticks).toEqual(createTicks(100, 3));
      done();
    });
    moxios.wait(() => {
      replyToGetTicks(0, 100, 3).then(() => replyToGetTicks(3, -1, 0));
    });
  });

  it('aggregates multiple sets of ticks', done => {
    getTicks(email, apiKey).then(ticks => {
      expect(ticks).toEqual(createTicks(100, 7));
      done();
    });
    moxios.wait(() => {
      // Return 3 ticks, then 3 more, and then 1 final tick.
      replyToGetTicks(0, 100, 3)
        .then(() => replyToGetTicks(3, 97, 3))
        .then(() => replyToGetTicks(6, 94, 1))
        .then(() => replyToGetTicks(7, -1, 0));
    });
  });

  it("doesn't return already-seen ticks", done => {
    getTicks(email, apiKey, 97 /* minTickId */).then(ticks => {
      expect(ticks).toEqual(createTicks(100, 4));
      done();
    });
    moxios.wait(() => {
      replyToGetTicks(0, 100, 3).then(() => replyToGetTicks(3, 97, 3));
    });
  });

  it("doesn't return anything if all ticks have been seen", done => {
    getTicks(email, apiKey, 101 /* minTickId */).then(ticks => {
      expect(ticks).toEqual([]);
      done();
    });
    moxios.wait(() => replyToGetTicks(0, 100, 3));
  });
});

describe('getRoutes', () => {
  beforeEach(() => {
    moxios.install();
  });
  afterEach(() => {
    moxios.uninstall();
  });

  // Returns an ApiRoute with supplied route ID and containing arbitrary but
  // consistent data.
  function createRoute(id: number): ApiRoute {
    return {
      id,
      name: `route ${id}`,
      type: ['Sport', 'Trad'][id % 2],
      rating: ['5.6', '5.12a'][id % 2],
      stars: id % 5,
      starVotes: id % 3,
      pitches: (id % 3) + 1,
      location: [`location ${id}`],
      url: `https://example.org/${id}`,
      imgSqSmall: '',
      imgSmall: '',
      imgSmallMed: '',
      imgMedium: '',
      longitude: id,
      latitude: id + 1,
    };
  }

  // Waits for the next HTTP request. Asserts that it is a get-routes request
  // with the supplied |routeIds| parameter and then returns the requested
  // routes.
  function replyToGetRoutes(routeIds: number[]) {
    const req = moxios.requests.mostRecent();
    expect(req.url).toEqual(makeGetRoutesUrl(routeIds, apiKey));
    return req.respondWith({
      status: 200,
      response: {
        routes: routeIds.map(id => createRoute(id)),
        success: true,
      },
    });
  }

  it('returns a single set of routes', done => {
    const ids = [123, 456, 789];
    getRoutes(ids, apiKey).then(routes => {
      expect(routes).toEqual(ids.map(id => createRoute(id)));
      done();
    });
    moxios.wait(() => replyToGetRoutes(ids));
  });

  it('uses a single request when possible', done => {
    const ids = [...Array(maxRoutesPerRequest).keys()].map(i => i + 1);
    getRoutes(ids, apiKey).then(routes => {
      expect(routes).toEqual(ids.map(id => createRoute(id)));
      done();
    });
    moxios.wait(() => replyToGetRoutes(ids));
  });

  it('uses multiple requests when needed', done => {
    const max = maxRoutesPerRequest;
    const ids = [...Array(2 * max + 10).keys()].map(i => i + 1);
    getRoutes(ids, apiKey).then(routes => {
      expect(routes).toEqual(ids.map(id => createRoute(id)));
      done();
    });
    moxios.wait(() => {
      replyToGetRoutes(ids.slice(0, max))
        .then(() => replyToGetRoutes(ids.slice(max, 2 * max)))
        .then(() => replyToGetRoutes(ids.slice(2 * max)));
    });
  });
});
