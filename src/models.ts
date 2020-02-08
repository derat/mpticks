// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file defines objects stored in Firestore.

export type RouteId = number;
export type TickId = number;

// A combination of the |style| and |leadStyle| fields returned by the get-ticks
// API endpoint.
export enum TickStyle {
  UNKNOWN = 0,
  SOLO = 1,
  TOP_ROPE = 2,
  FOLLOW = 3,
  LEAD = 4,
  LEAD_ONSIGHT = 5,
  LEAD_FLASH = 6,
  LEAD_REDPOINT = 7,
  LEAD_PINKPOINT = 8,
  LEAD_FELL_HUNG = 9,
  // These three seem to be boulder-specific. I haven't seen 'Attempt' in the
  // wild yet.
  SEND = 10,
  FLASH = 11,
  ATTEMPT = 12,
}

export function TickStyleToString(style: TickStyle): string {
  switch (style) {
    case TickStyle.SOLO:
      return 'Solo';
    case TickStyle.TOP_ROPE:
      return 'Top-rope';
    case TickStyle.FOLLOW:
      return 'Follow';
    case TickStyle.LEAD:
      return 'Lead';
    case TickStyle.LEAD_ONSIGHT:
      return 'Lead (Onsight)';
    case TickStyle.LEAD_FLASH:
      return 'Lead (Flash)';
    case TickStyle.LEAD_REDPOINT:
      return 'Lead (Redpoint)';
    case TickStyle.LEAD_PINKPOINT:
      return 'Lead (Pinkpoint)';
    case TickStyle.LEAD_FELL_HUNG:
      return 'Lead (Fell/Hung)';
    case TickStyle.SEND:
      return 'Send';
    case TickStyle.FLASH:
      return 'Flash';
    case TickStyle.ATTEMPT:
      return 'Attempt';
    default:
      return 'Unknown';
  }
}

// A map value in Route's |ticks| field.
export interface Tick {
  date: string; // 'YYYYMMDD'
  style: TickStyle;
  pitches?: number;
  notes?: string;
  stars?: number; // user-supplied score: 1 is 'bomb', 5 is 4-star
  grade?: string; // user-supplied grade, e.g. '5.11a'
}

// Corresponds to the |type| field returned by the get-routes API endpoint.
//
// Mountain Project's route-editing page offers a 'Route Type' section with
// 'Sport', 'Trad', and 'Other' radio buttons and a 'Toprope' checkbox, along
// with a 'Rating' section with 'Rock' (YDS), 'Boulder' (V scale), 'Ice' (WI,
// AI), 'Aid' (A/C), 'Mixed' (M), and 'Snow' (easy/moderate/steep) dropdowns.
//
// The get-routes endpoint appears to map these to a comma-separated list that
// can contain (at least) 'Sport', 'Trad', 'TR', 'Boulder', 'Ice', 'Alpine',
// 'Aid', 'Mixed', and 'Snow'.
//
// I'm not interested in trying to catalog all of these. The only use I can
// think of for the route type here is showing the user how many ticks they have
// for each type, and that doesn't work if a route can have multiple types.
// Instead, each route just gets a single type chosen from its list.
export enum RouteType {
  OTHER = 0,
  SPORT = 1,
  TRAD = 2,
  BOULDER = 3,
  ICE = 4,
  ALPINE = 5,
  MIXED = 6,
  SNOW = 8,
  AID = 7,
  TOP_ROPE = 8,
}

// A document in the 'routes' subcollection under a user document.
// This contains detailed information about the route itself, along with all of
// the user's ticks for the route.
export interface Route {
  name: string;
  type: RouteType;
  location: string[]; // e.g. ['Colorado', 'Boulder', ...]
  lat: number;
  long: number;
  grade: string; // e.g. '5.11a'
  pitches?: number;
  // We would ideally use Map instead of Record here and in the rest of this
  // file, but all of these types need to get serialized and deserialized by
  // Firestore, which only expects simple types and objects (unless you write
  // custom conversion functions, which seems like a pain).
  ticks: Record<TickId, Tick>;
}

// Partial information about a route stored in Area.
export interface RouteSummary {
  name: string;
  grade: string;
}

// A unique identifier for an area containing routes. Created by joining the
// components of the |location| field returned by the get-routes API endpoint
// with pipes, e.g. 'Colorado|Boulder|Flatirons|South|The Maiden'.
//
// This is used as the document ID for the corresponding AreaMap in the |areas|
// subcollection.
export type AreaId = string;

// Generates an AreaId based on the supplied location components.
export function makeAreaId(location: string[]) {
  return location.join('|');
}

// A document in the 'areas' subcollection under a user document. Specifically,
// this is a location (to use Mountain Project's terminology) that includes one
// or more routes.
//
// If an area does not directly include routes but needs to be tracked because
// it has subareas with routes, then it's only tracked by AreaMap.
export interface Area {
  // Routes that are in this area (but not in child areas).
  routes: Record<RouteId, RouteSummary>;
}

// The 'map' document in the 'areas' subcollection, but also used recursively
// within that document. This stores the high-level tree of areas. At the top
// level of the 'map' document, |children| contains top-level locations, e.g.
// 'Colorado' and 'International'.
//
// I considered saving this as a field in User instead of making it a singleton
// document in 'areas', but then the Import view would end up needing to load
// this potentially-bulky data to get the max tick ID even when no new areas
// need to be added.
export interface AreaMap {
  // Areas within this area, keyed by name (e.g. 'Boulder Canyon'). Undefined if
  // the area doesn't contain any subareas.
  children?: Record<string, AreaMap>;
  // If the area contains routes, the document ID of the Area document in the
  // 'areas' subcollection describing the area's routes. Undefined if the area
  // doesn't directly contain any routes.
  areaId?: AreaId;
}

// A document in the 'users' collection.
export interface User {
  // The maximum tick ID that has been imported.
  maxTickId: TickId;
  // The number of routes that have been imported (i.e. the number of distinct
  // routes with ticks).
  numRoutes: number;
}

// The 'tickCounts' document in the 'stats' subcollection. Contains tick counts
// keyed by various values.
//
// Think long and hard before adding any new properties here, as existing
// documents in Firestore won't include them.
export interface TickCounts {
  dates: Record<string, number>; // 'YYYYMMDD'
  daysOfWeek: Record<number, number>; // ISO 8601: 1 is Monday, 7 is Sunday
  grades: Record<string, number>;
  latLongs: Record<string, number>; // '39.9,-105.0' (11.132 km accuracy)
  routePitches: Record<number, number>;
  routeTypes: Record<number, number>; // RouteType (TS doesn't allow enum keys)
  tickPitches: Record<number, number>;
  tickStyles: Record<number, number>; // TickStyle (TS doesn't allow enum keys)
  topAreas: Record<string, number>; // 'California', 'International', etc.
}
