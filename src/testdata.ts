// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ApiRoute, ApiTick } from '@/api';
import {
  Route,
  RouteId,
  RouteSummary,
  RouteType,
  Tick,
  TickId,
  TickStyle,
} from '@/models';

// Returns an ApiRoute with arbitrary but consistent (for |routeId|) data.
export function makeApiRoute(routeId: RouteId, location?: string[]): ApiRoute {
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
    longitude: 0,
    latitude: 0,
  };
}

// Returns a Route with arbitrary but consistent (for |routeId|) data.
export function makeRoute(
  routeId: RouteId,
  tickIds: TickId[],
  location?: string[]
): Route {
  const apiRoute = makeApiRoute(routeId, location);
  return {
    name: apiRoute.name,
    // This needs to match the logic in makeApiRoute.
    type: [RouteType.SPORT, RouteType.TRAD, RouteType.OTHER][routeId % 3],
    location: apiRoute.location,
    grade: apiRoute.rating,
    pitches: apiRoute.pitches,
    // https://stackoverflow.com/a/26265095
    ticks: tickIds.reduce(
      (m, id) => ((m[id] = makeTick(id, routeId)), m),
      {} as Record<TickId, Tick>
    ),
  };
}

// Returns a RouteSummary with arbitrary but consistent (for |id|) data.
export function makeRouteSummary(id: RouteId): RouteSummary {
  const route = makeRoute(id, []);
  return { name: route.name, grade: route.grade };
}

// Returns an ApiTick with arbitrary but consistent (for |tickId|) data.
export function makeApiTick(tickId: TickId, routeId: RouteId): ApiTick {
  const apiRoute = makeApiRoute(routeId, []);

  // Ladies and gentlemen, JavaScript: https://stackoverflow.com/a/34290167
  const d = new Date(2020, 0, 1);
  d.setDate(tickId);
  const date = [
    d.getFullYear(),
    ('0' + (d.getMonth() + 1)).slice(-2),
    ('0' + d.getDate()).slice(-2),
  ].join('-');

  return {
    routeId,
    date,
    pitches: apiRoute.pitches,
    notes: `Notes ${tickId}`,
    style: ['Lead', 'Lead', 'TR', 'Follow', 'Solo'][tickId % 5],
    leadStyle: ['Flash', 'Redpoint', '', '', ''][tickId % 5],
    tickId,
    userStars: (tickId % 5) + 1,
    userRating: ['5.5', '5.8', '5.11a'][tickId % 3],
  };
}

// Returns a Tick with arbitrary but consistent (for |tickId|) data.
export function makeTick(tickId: TickId, routeId: RouteId): Tick {
  const apiTick = makeApiTick(tickId, routeId);
  return {
    date: apiTick.date.replace(/-/g, ''),
    pitches: apiTick.pitches,
    // This needs to match the logic in makeApiTick.
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
