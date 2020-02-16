// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ApiRoute, ApiTick } from '@/api';
import { getRegion } from '@/convert';
import {
  Counts,
  isCleanTickStyle,
  Route,
  RouteId,
  RouteSummary,
  RouteType,
  Tick,
  TickId,
  TickStyle,
} from '@/models';
import { getDayOfWeek, formatDate, parseDate } from '@/dateutil';
import { truncateLatLong } from '@/geoutil';

// Returns an ApiRoute with arbitrary but consistent (for |routeId|) data.
export function testApiRoute(routeId: RouteId, location?: string[]): ApiRoute {
  if (!location) location = [`Location ${routeId}`];
  return {
    id: routeId,
    name: `Route ${routeId}`,
    type: ['Sport', 'Trad', 'Other'][routeId % 3],
    rating: ['5.6', '5.9', '5.12a'][routeId % 3],
    stars: (routeId % 5) + 1,
    starVotes: routeId % 3,
    pitches: (routeId % 3) + 1,
    location,
    url: `https://example.org/${routeId}`,
    imgSqSmall: '',
    imgSmall: '',
    imgSmallMed: '',
    imgMedium: '',
    longitude: routeId,
    latitude: routeId + 1,
  };
}

// Returns a Route with arbitrary but consistent (for |routeId|) data.
export function testRoute(
  routeId: RouteId,
  tickIds: TickId[],
  location?: string[]
): Route {
  const apiRoute = testApiRoute(routeId, location);
  return {
    name: apiRoute.name,
    // This needs to match the logic in testApiRoute.
    type: [RouteType.SPORT, RouteType.TRAD, RouteType.OTHER][routeId % 3],
    location: apiRoute.location,
    lat: apiRoute.latitude,
    long: apiRoute.longitude,
    grade: apiRoute.rating,
    pitches: apiRoute.pitches as number,
    // https://stackoverflow.com/a/26265095
    ticks: tickIds.reduce(
      (m, id) => ((m[id] = testTick(id, routeId)), m),
      {} as Record<TickId, Tick>
    ),
  };
}

// Returns a RouteSummary with arbitrary but consistent (for |id|) data.
export function testRouteSummary(id: RouteId): RouteSummary {
  const route = testRoute(id, []);
  return { name: route.name, grade: route.grade };
}

// Returns an ApiTick with arbitrary but consistent (for |tickId|) data.
export function testApiTick(tickId: TickId, routeId: RouteId): ApiTick {
  const apiRoute = testApiRoute(routeId, []);

  const d = new Date(2020, 0, 1);
  d.setDate(tickId);
  const date = formatDate(d, '%Y-%m-%d');

  return {
    routeId,
    date,
    pitches: apiRoute.pitches as number,
    notes: `Notes ${tickId}`,
    style: ['Lead', 'Lead', 'TR', 'Follow', 'Solo'][tickId % 5],
    leadStyle: ['Flash', 'Redpoint', '', '', ''][tickId % 5],
    tickId,
    userStars: (tickId % 5) + 1,
    userRating: ['5.5', '5.8', '5.11a'][tickId % 3],
  };
}

// Returns a Tick with arbitrary but consistent (for |tickId|) data.
export function testTick(tickId: TickId, routeId: RouteId): Tick {
  const apiTick = testApiTick(tickId, routeId);
  return {
    date: apiTick.date.replace(/-/g, ''),
    pitches: apiTick.pitches,
    // This needs to match the logic in testApiTick.
    style: [
      TickStyle.LEAD_FLASH,
      TickStyle.LEAD_REDPOINT,
      TickStyle.TOP_ROPE,
      TickStyle.FOLLOW,
      TickStyle.SOLO,
    ][tickId % 5],
    notes: apiTick.notes,
    stars: apiTick.userStars,
    grade: apiTick.userRating,
  };
}

// Runs |keyFunc| and |valFunc| on each item in |items| and returns a map from
// each key to its summed values. If |valFunc| isn't supplied, a value of 1 is
// used for each item.
function countItems<T>(
  items: T[],
  keyFunc: (t: T) => number | string,
  valFunc?: (t: T) => number
): Record<string, number> {
  return items.reduce((m, t) => {
    const key = keyFunc(t).toString();
    const val = valFunc ? valFunc(t) : 1;
    if (val) m[key] = m[key] + val || val;
    return m;
  }, {} as Record<string, number>);
}

// Returns a Counts object incorporating all of the ticks from |routeMap|.
export function testCounts(routeMap: Map<RouteId, Route>): Counts {
  const routes: Route[] = Array.from(routeMap.values());
  const ticks: Tick[] = routes.map(r => Object.values(r.ticks)).flat();

  const counts: Counts = {
    datePitches: countItems(
      ticks,
      t => t.date,
      t => t.pitches
    ),
    dateTicks: countItems(ticks, t => t.date),
    dayOfWeekPitches: countItems(
      ticks,
      t => getDayOfWeek(parseDate(t.date)),
      t => t.pitches
    ),
    dayOfWeekTicks: countItems(ticks, t => getDayOfWeek(parseDate(t.date))),
    gradeCleanTicks: countItems(
      routes,
      r => r.grade,
      r =>
        Object.values(r.ticks)
          .map(t => (isCleanTickStyle(t.style) ? 1 : 0) as number)
          .reduce((a, b) => a + b, 0)
    ),
    gradeTicks: countItems(
      routes,
      r => r.grade,
      r => Object.keys(r.ticks).length
    ),
    latLongTicks: countItems(
      routes,
      r => truncateLatLong(r.lat, r.long),
      r => Object.keys(r.ticks).length
    ),
    pitchesTicks: countItems(ticks, t => t.pitches),
    regionTicks: countItems(
      routes,
      r => getRegion(r.location),
      r => Object.keys(r.ticks).length
    ),
    routeTicks: {}, // updated below
    routeTypeTicks: countItems(
      routes,
      r => r.type,
      r => Object.keys(r.ticks).length
    ),
    tickStyleTicks: countItems(ticks, t => t.style),
  };

  routeMap.forEach((r, rid) => {
    counts.routeTicks[`${rid}|${r.name}`] = Object.keys(r.ticks).length;
  });

  return counts;
}
