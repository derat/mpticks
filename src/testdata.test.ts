// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { testCounts, testRoute, testTick } from './testdata';

import { getRegion } from '@/convert';
import { getDayOfWeek, parseDate } from '@/dateutil';
import { truncateLatLong } from '@/geoutil';
import { countsVersion, isCleanTickStyle } from '@/models';

describe('testCounts', () => {
  it('correctly counts ticks', () => {
    const rid = 1;
    const tid = 11;
    const loc = ['Alabama', 'Some place'];
    const r = testRoute(rid, [tid], loc);
    const t = testTick(tid, rid);

    expect(testCounts(new Map([[rid, r]]))).toEqual({
      version: countsVersion,
      datePitches: { [t.date]: t.pitches },
      dateTicks: { [t.date]: 1 },
      dayOfWeekPitches: { [getDayOfWeek(parseDate(t.date))]: t.pitches },
      dayOfWeekTicks: { [getDayOfWeek(parseDate(t.date))]: 1 },
      gradeCleanTicks: isCleanTickStyle(t.style) ? { [r.grade]: 1 } : {},
      gradeTicks: { [r.grade]: 1 },
      latLongTicks: { [truncateLatLong(r.lat, r.long)]: 1 },
      pitchesTicks: { [t.pitches]: 1 },
      regionTicks: { [getRegion(loc)]: 1 },
      routeTicks: { [`${rid}|${r.name}`]: 1 },
      routeTypeTicks: { [r.type]: 1 },
      tickStyleTicks: { [t.style]: 1 },
    });
  });
});
