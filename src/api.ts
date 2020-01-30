// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import axios from 'axios';

// A single tick returned by the get-ticks API endpoint.
export interface Tick {
  routeId: number;
  date: string;
  pitches: number;
  notes: string;
  style: string; // 'Solo', 'TR', 'Follow', 'Lead'
  leadStyle: string; // 'Onsight', 'Flash', 'Redpoint', 'Pinkpoint', 'Fell/Hung', ''
  tickId: number;
  userStars: number;
  userRating: string;
}

// The result of a get-ticks API call.
interface GetTicksResult {
  hardest: string;
  average: string;
  ticks: Tick[];
  success: number;
}

// Makes one or more calls to the Mountain Project get-ticks API endpoint to
// fetch all of the ticks belonging to the specified user.
// |ticks| is used to pass along earlier results when recursing.
export function getTicks(
  email: string,
  key: string,
  minTickId: number = 0,
  ticks: Tick[] = []
): Promise<Tick[]> {
  const url =
    'https://www.mountainproject.com/data/get-ticks' +
    `?email=${email}&key=${key}&startPos=${ticks.length}`;
  return axios.get(url).then(response => {
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
interface Route {
  id: number;
  name: string;
  type: string; // comma-separated list of 'Sport', 'Trad', 'TR', 'Other'
  rating: string;
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
  routes: Route[];
  success: number;
}

// Makes a single call to the Mountain Project get-routes API endpoint to return
// information about the specified routes.
export function getRoutes(routeIds: number[], key: string): Promise<Route[]> {
  if (routeIds.length > 200) {
    throw new Error(`Requested ${routeIds.length} routes, but limit is 200`);
  }

  const url =
    'https://www.mountainproject.com/data/get-routes' +
    `?routeIds=${routeIds.join(',')}&key=${key}`;
  console.log(url);
  return axios.get(url).then(response => {
    console.log(response);
    const result = (response.data as unknown) as GetRoutesResult;
    console.log(result);
    if (!result.success) throw new Error('API reported failure');
    return result.routes;
  });
}