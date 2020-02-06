// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import axios from 'axios';

// Exposed for unit tests.
export const getTicksUrl = 'https://www.mountainproject.com/data/get-ticks';
export const getRoutesUrl = 'https://www.mountainproject.com/data/get-routes';

// A single tick returned by the get-ticks API endpoint.
export interface ApiTick {
  routeId: number;
  date: string; // 'YYYY-MM-DD'
  pitches: number;
  notes: string;
  style: string; // 'Solo', 'TR', 'Follow', 'Lead'
  leadStyle: string; // 'Onsight', 'Flash', 'Redpoint', 'Pinkpoint', 'Fell/Hung', ''
  tickId: number;
  userStars: number; // 1 is 'bomb', 5 is 4-star
  userRating: string; // optional user-supplied grade, e.g. '5.11a'
}

// The result of a get-ticks API call.
interface GetTicksResult {
  hardest: string;
  average: string;
  ticks: ApiTick[];
  success: number;
}

// Makes one or more calls to the Mountain Project get-ticks API endpoint to
// fetch all of the ticks belonging to the specified user. |ticks| is used to
// pass along earlier results when recursing.
export function getTicks(
  email: string,
  key: string,
  minTickId: number = 0,
  ticks: ApiTick[] = []
): Promise<ApiTick[]> {
  return axios
    .get(getTicksUrl, { params: { email, key, startPos: ticks.length } })
    .then(response => {
      const result = (response.data as unknown) as GetTicksResult;
      if (!result.success) throw new Error('API reported failure');

      // If we're at the end of the list, quit.
      if (!result.ticks.length) return ticks;

      for (const tick of result.ticks) {
        // If we got all of the new ticks, quit.
        if (tick.tickId < minTickId) return ticks;
        ticks.push(tick);
      }

      // Recurse to get additional ticks.
      return getTicks(email, key, minTickId, ticks);
    });
}

// A single route returned by the get-routes API endpoint.
export interface ApiRoute {
  id: number;
  name: string;
  type: string; // comma-separated list of 'Sport', 'Trad', 'Boulder', 'TR', 'Other'
  rating: string; // actually the grade, e.g. '5.11a'
  stars: number; // 1 is 'bomb', 5 is 4-star
  starVotes: number;
  pitches: number;
  location: string[];
  url: string;
  imgSqSmall: string;
  imgSmall: string;
  imgSmallMed: string;
  imgMedium: string;
  longitude: number;
  latitude: number;
}

// The result of a get-routes API call.
interface GetRoutesResult {
  routes: ApiRoute[];
  success: number;
}

// The get-routes endpoint is documented as returning at most 200 routes:
// https://www.mountainproject.com/data
// This is exported for unit tests.
export const maxRoutesPerRequest = 200;

// Makes one or more calls to the Mountain Project get-routes API endpoint to
// return information about the specified routes. |routes| is used to pass along
// earlier results when recursing.
export function getRoutes(
  routeIds: number[],
  key: string,
  routes: ApiRoute[] = []
): Promise<ApiRoute[]> {
  if (routeIds.length == 0) return Promise.resolve([]);

  const params = {
    key,
    routeIds: routeIds.slice(0, maxRoutesPerRequest).join(','),
  };
  return axios.get(getRoutesUrl, { params }).then(response => {
    const result = (response.data as unknown) as GetRoutesResult;
    if (!result.success) throw new Error('API reported failure');

    routes = routes.concat(result.routes as ApiRoute[]);
    if (routeIds.length <= maxRoutesPerRequest) return routes;
    return getRoutes(routeIds.slice(maxRoutesPerRequest), key, routes);
  });
}
