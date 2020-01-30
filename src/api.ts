// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import axios from 'axios';

// Style describes the climbing style for a tick returned by the get-ticks API.
export enum Style {
  SOLO = 'Solo',
  TOP_ROPE = 'TR',
  FOLLOW = 'Follow',
  LEAD = 'Lead',
  NONE = '',
}

// LeadStyle describes the leading style (if any) for a tick returned by the
// get-ticks API.
export enum LeadStyle {
  ONSIGHT = 'Onsight',
  FLASH = 'Flash',
  REDPOINT = 'Redpoint',
  PINKPOINT = 'Pinkpoint',
  FELL_HUNG = 'Fell/Hung',
  NONE = '',
}

// Tick represents a single tick returned by the get-ticks API.
export interface Tick {
  routeId: number;
  date: string;
  pitches: number;
  notes: string;
  style: Style;
  leadStyle: LeadStyle;
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

// getTicks makes one or more calls to the Mountain Project get-ticks API
// endpoint to fetch all of the ticks belonging to the specified user.
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
      if (tick.tickId <= minTickId) return ticks;
      ticks.push(tick);
    }

    // Recurse to get additional ticks.
    return getTicks(email, key, minTickId, ticks);
  });
}
