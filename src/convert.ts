// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file defines methods for converting objects from the Mountain Project
// Data API to objects stored in Firestore.

import { ApiRoute, ApiTick } from '@/api';
import { AreaId, AreaMap, Route, RouteType, Tick, TickStyle } from '@/models';

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
  };
  if (apiTick.pitches > -1) tick.pitches = apiTick.pitches;
  if (apiTick.notes) tick.notes = apiTick.notes;
  if (apiTick.userStars > -1) tick.stars = apiTick.userStars;
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
  if (apiRoute.pitches > 0) route.pitches = apiRoute.pitches;
  return route;
}

// Generates an AreaId based on the supplied location components.
export function makeAreaId(location: string[]) {
  return location.join('|');
}

// Recursively walks |map| in order to add an area identified by |id|.
// |location| contains the area's location components, e.g.
// ['Colorado', 'Boulder', 'Boulder Canyon', 'Castle Rock'].
export function addAreaToAreaMap(id: AreaId, location: string[], map: AreaMap) {
  const name = location[0];
  if (!map.children) map.children = {};
  if (!map.children[name]) map.children[name] = {};

  // If we're down to the final component, we're done. Otherwise, recurse.
  if (location.length == 1) map.children[name]!.areaId = id;
  else addAreaToAreaMap(id, location.slice(1), map.children[name]!);
}

// Placeholder for weird/missing regions.
export const unknownRegion = 'Unknown';

// Returns a region (generally a U.S. state or a country) for the supplied
// Mountain Project area.
//
// Mountain Project's area hierarchy is a U.S.-centric mess. See
// https://www.mountainproject.com/route-guide:
//
// - Every U.S. state has its own top-level area.
// - Everything else goes under an 'International' top-level area.
// - 'International' mostly contains continents ('Africa', 'Asia', etc.) which
//   themselves contain countries, but also includes 'Antarctica' and
//   'Australia'.
export function getRegion(loc: string[]): string {
  if (!loc.length || loc[0] == 'In Progress') return unknownRegion;
  if (loc[0] != 'International') return loc[0]; // U.S. state
  if (loc.length < 2) return unknownRegion;
  if (['Antarctica', 'Australia'].indexOf(loc[1]) != -1) return loc[1];
  return loc.length >= 3 ? loc[2] : loc[1];
}
