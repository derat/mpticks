// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { getRegion } from '@/convert';
import { formatDateString, getDayOfWeek, parseDate } from '@/dateutil';
import { truncateLatLong } from '@/geoutil';
import {
  compareTicks,
  Counts,
  isCleanTickStyle,
  numTopRoutes,
  Route,
  RouteId,
  Tick,
  TickId,
} from '@/models';

// Updates |counts| to include the ticks in |routeTicks|. |routes| is used to
// get route information, and the ticks in |routeTicks| must already be
// incorporated there.
//
// If |remove| is false, |counts| is decremented for |routeTicks| instead of
// being incremented. The ticks from |routeTicks| should have already been
// removed from |routes| in this case.
export function addTicksToCounts(
  counts: Counts,
  routeTicks: Map<RouteId, Map<TickId, Tick>>,
  routes: Map<RouteId, Route>,
  remove = false
) {
  routeTicks.forEach((ticks: Map<TickId, Tick>, routeId: RouteId) => {
    const route = routes.get(routeId);
    if (!route) return;

    const oldTicks: Record<TickId, Tick> = Object.assign({}, route.ticks);
    if (remove) ticks.forEach((t, id) => (oldTicks[id] = t));
    else ticks.forEach((_, id) => delete oldTicks[id]);

    // Overwrite old per-route counts.
    counts.routeTicks[`${routeId}|${route.name}`] = Object.keys(
      route.ticks
    ).length;

    // Update the date of the route's first tick.
    const oldFirstTickDate = findFirstTickDate(oldTicks);
    const newFirstTickDate = findFirstTickDate(route.ticks);
    if (newFirstTickDate != oldFirstTickDate) {
      if (newFirstTickDate) add(counts.dateFirstTicks, newFirstTickDate, 1);
      if (oldFirstTickDate) add(counts.dateFirstTicks, oldFirstTickDate, -1);
    }

    const latLong = truncateLatLong(route.lat, route.long);
    const region = getRegion(route.location);
    ticks.forEach((tick: Tick, tickId: TickId) => {
      const dayOfWeek = getDayOfWeek(parseDate(tick.date));
      const tickAmount = remove ? -1 : 1;
      const pitchAmount = remove ? -tick.pitches : tick.pitches;

      // |dateFirstTicks| is updated above.
      add(counts.datePitches, tick.date, pitchAmount);
      add(counts.dateTicks, tick.date, tickAmount);
      add(counts.dayOfWeekPitches, dayOfWeek, pitchAmount);
      add(counts.dayOfWeekTicks, dayOfWeek, tickAmount);
      add(
        counts.gradeCleanTicks,
        route.grade,
        isCleanTickStyle(tick.style) ? tickAmount : 0
      );
      add(counts.gradeTicks, route.grade, tickAmount);
      add(counts.latLongTicks, latLong, tickAmount);
      add(
        counts.monthGradeTicks,
        `${formatDateString(tick.date, '%Y%m')}|${route.grade}`,
        tickAmount
      );
      add(counts.pitchesTicks, tick.pitches, tickAmount);
      add(counts.regionTicks, region, tickAmount);
      // |routeTicks| is updated above and below.
      add(counts.routeTypeTicks, route.type, tickAmount);
      add(counts.tickStyleTicks, tick.style, tickAmount);
    });
  });

  // Preserve the top routes. We're able to keep this up-to-date without
  // needing to maintain counts for all routes since all routes with new
  // ticks were added with their updated counts in the above loop over
  // |routeTicks|.
  //
  // This isn't perfect, since ticks can be removed. The counts in the
  // |routeTicks| field will be correct, but some top routes may be missing
  // after repeated removals. |numTopRoutes| is greater than what's shown in the
  // UI, though, so it's probably not a big deal in practice.
  counts.routeTicks = Object.fromEntries(
    Object.entries(counts.routeTicks)
      .filter(e => e[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, numTopRoutes)
  );
}

// Adds |val| to |map|'s entry for |key|.
// Does nothing if |key| or |val| are undefined.
// Deletes the entry if it becomes zero or negative.
function add(
  map: Record<string | number, number>,
  key: string | number | undefined,
  val: number | undefined
) {
  if (typeof key === 'undefined' || typeof val === 'undefined') return;

  if (typeof map[key] === 'undefined') map[key] = 0;
  map[key] += val;
  if (map[key] <= 0) delete map[key];
}

// Returns the date of the earliest tick in |ticks|, or an empty string if no
// ticks are present.
function findFirstTickDate(ticks: Record<TickId, Tick>): string {
  let firstId: TickId = 0;
  let firstTick: Tick | undefined = undefined;
  Object.entries(ticks).forEach(([id, t]) => {
    const tid = parseInt(id);
    if (!firstTick || compareTicks(tid, t, firstId, firstTick) < 0) {
      firstId = tid;
      firstTick = t;
    }
  });
  return firstTick ? firstTick!.date : ''; // seems like a TS bug
}
