// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { getRegion } from '@/convert';
import { parseDate, getDayOfWeek } from '@/dateutil';
import { truncateLatLong } from '@/geoutil';
import {
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
  const add = (
    map: Record<string | number, number>,
    key: string | number | undefined,
    val: number | undefined = 1
  ) => {
    if (typeof key === 'undefined' || typeof val === 'undefined') return;

    if (!remove) map[key] = map[key] + val || val;
    else if (typeof map[key] !== 'undefined') map[key] -= val;

    if (map[key] === 0) delete map[key];
  };

  routeTicks.forEach((ticks: Map<TickId, Tick>, routeId: RouteId) => {
    const route = routes.get(routeId);
    if (!route) return;

    // Overwrite old per-route counts.
    counts.routeTicks[`${routeId}|${route.name}`] = Object.keys(
      route.ticks
    ).length;

    const latLong = truncateLatLong(route.lat, route.long);
    const region = getRegion(route.location);
    ticks.forEach((tick: Tick, tickId: TickId) => {
      const dayOfWeek = getDayOfWeek(parseDate(tick.date));

      add(counts.datePitches, tick.date, tick.pitches);
      add(counts.dateTicks, tick.date);
      add(counts.dayOfWeekPitches, dayOfWeek, tick.pitches);
      add(counts.dayOfWeekTicks, dayOfWeek);
      add(
        counts.gradeCleanTicks,
        route.grade,
        isCleanTickStyle(tick.style) ? 1 : 0
      );
      add(counts.gradeTicks, route.grade);
      add(counts.latLongTicks, latLong);
      add(counts.pitchesTicks, tick.pitches);
      add(counts.regionTicks, region);
      // |routeTicks| is updated above and below.
      add(counts.routeTypeTicks, route.type);
      add(counts.tickStyleTicks, tick.style);
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
      .sort((a, b) => b[1] - a[1])
      .slice(0, numTopRoutes)
  );
}
