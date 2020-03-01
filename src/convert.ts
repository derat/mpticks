// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file defines methods for converting objects from the Mountain Project
// Data API to objects stored in Firestore.

import { ApiRoute, ApiTick } from '@/api';
import { Route, RouteType, Tick, TickStyle } from '@/models';

// Converts the |style| and |leadStyle| values from an ApiTick object to the
// TickStyle enum used in a Tick object.
export function getTickStyle(style: string, leadStyle: string): TickStyle {
  switch (style) {
    case 'Solo':
      return TickStyle.SOLO;
    case 'TR':
      return TickStyle.TOP_ROPE;
    case 'Follow':
      return TickStyle.FOLLOW;
    case 'Lead': {
      switch (leadStyle) {
        case 'Onsight':
          return TickStyle.LEAD_ONSIGHT;
        case 'Flash':
          return TickStyle.LEAD_FLASH;
        case 'Redpoint':
          return TickStyle.LEAD_REDPOINT;
        case 'Pinkpoint':
          return TickStyle.LEAD_PINKPOINT;
        case 'Fell/Hung':
          return TickStyle.LEAD_FELL_HUNG;
        default:
          return TickStyle.LEAD;
      }
    }
    case 'Send':
      return TickStyle.SEND;
    case 'Flash':
      return TickStyle.FLASH;
    case 'Attempt':
      return TickStyle.ATTEMPT;
    default:
      return TickStyle.UNKNOWN;
  }
}

// Creates a Tick describing the supplied tick returned by the get-ticks API
// endpoint. Throws an error if key information is missing.
export function createTick(apiTick: ApiTick): Tick {
  if (!apiTick.tickId) throw new Error('Missing tick ID');
  if (!apiTick.routeId) throw new Error('Missing route ID');
  if (
    typeof apiTick.date != 'string' ||
    !apiTick.date.match(/^\d{4}-\d\d-\d\d$/)
  ) {
    throw new Error('Invalid date');
  }

  const tick: Tick = {
    date: apiTick.date.replace(/-/g, ''),
    style: getTickStyle(apiTick.style, apiTick.leadStyle),
    // The web UI forces this to be at least 1, so enforce the same here.
    pitches: apiTick.pitches > 0 ? apiTick.pitches : 1,
  };

  // The Mountain Project website garbles user-supplied notes:
  // - Newlines get changed to '\r\n'.
  // - Single quotes get changed to '&#39;'.
  // - Double quotes get changed to '&#34;'.
  // - Less-than symbols and everything after them get eaten (as a hacky XSS
  //   mitigation?).
  // - Ampersands and greater-than symbols are *not* changed.
  //
  // When displaying the tick, the website repairs the escaped quotes.
  // The Android app doesn't seem to suffer from the same problems.
  if (apiTick.notes) {
    tick.notes = apiTick.notes
      .replace(/\r\n/g, '\n')
      .replace(/&#39;/g, "'")
      .replace(/&#34;/g, '"');
  }

  if (apiTick.userStars > 0) tick.stars = apiTick.userStars;
  if (apiTick.userRating) tick.grade = apiTick.userRating;
  return tick;
}

// Converts the |type| value from an ApiRoute object to the RouteType enum used
// by the Route object.
export function getRouteType(apiType: string): RouteType {
  const words = apiType.split(/,\s*/);
  if (words.indexOf('Sport') != -1) return RouteType.SPORT;
  if (words.indexOf('Trad') != -1) return RouteType.TRAD;
  if (words.indexOf('Boulder') != -1) return RouteType.BOULDER;
  if (words.indexOf('Ice') != -1) return RouteType.ICE;
  if (words.indexOf('Alpine') != -1) return RouteType.ALPINE;
  if (words.indexOf('Mixed') != -1) return RouteType.MIXED;
  if (words.indexOf('Snow') != -1) return RouteType.SNOW;
  if (words.indexOf('Aid') != -1) return RouteType.AID;
  if (words.indexOf('TR') != -1) return RouteType.TOP_ROPE;
  return RouteType.OTHER;
}

// Creates a Route describing the supplied route returned by the get-routes API
// endpoint. Throws an error if key information is missing.
export function createRoute(apiRoute: ApiRoute): Route {
  if (!apiRoute.id) throw new Error('Missing route ID');
  if (!apiRoute.name) throw new Error('Missing name');
  if (!apiRoute.location || !apiRoute.location.length) {
    throw new Error('Missing location');
  }

  const route: Route = {
    name: apiRoute.name,
    type: getRouteType(apiRoute.type || ''),
    location: apiRoute.location,
    lat: apiRoute.latitude,
    long: apiRoute.longitude,
    grade: apiRoute.rating || '',
    ticks: {},
  };
  // If a route's pitches are unset, Mountain Project returns an empty string.
  if (typeof apiRoute.pitches === 'number') route.pitches = apiRoute.pitches;
  return route;
}

// Simplifies a YDS rock grade from Mountain Project into a '5.x' string with an
// optional trailing 'a', 'b', 'c', or 'd' letter for 5.10 and up. An empty
// string is returned if the grade couldn't be parsed.
//
// See the 'Rating' menus in https://www.mountainproject.com/edit/route pages
// for the full set ordering of grades. In short, though:
//
// 5.10a  5.10-  5.10a/b  5.10b  5.10  5.10b/c  5.10c  5.10+  5.10c/d  5.10d
//
// Note the strange placement of '-' between 'a' and 'a/b', but '+' between 'c'
// and 'c/d' (instead of between 'c/d' and 'd'). To simplify things, this
// function maps '-' to 'a', '+' to 'd', bare grades to 'b', and truncates the
// letter after a slash.
export function normalizeYdsGrade(grade: string): string {
  if (grade == 'Easy 5th') return '5.0';

  const m = grade.match(/^5\.(\d+)([-+a-d]?)/);
  if (!m) return '';

  const minor = m[1];
  const suffix = m[2];

  // For everything below 5.10, drop the suffix.
  if (minor.length == 1) return `5.${minor}`;

  if (suffix == '-') return `5.${minor}a`;
  if (suffix == '+') return `5.${minor}d`;
  if (suffix == '') return `5.${minor}b`; // could also go 'c' here
  return `5.${minor}${suffix}`; // a-d
}

// Simplifies a V boulder grade from Mountain Project into a 'Vx' string, where
// 'x' is 'B' or a number. An empty string is returned if the grade couldn't be
// parsed.
export function normalizeVGrade(grade: string): string {
  if (grade == 'V-easy') return 'VB';
  const m = grade.match(/^V\d+/);
  return m ? m[0] : '';
}
