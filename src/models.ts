// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file defines objects stored in Firestore.

import { ApiRoute, ApiTick } from '@/api';

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

// Returns true if |style| indicates that the climber was either unroped or
// leading and didn't fall or hang.
export function isCleanTickStyle(style: TickStyle): boolean {
  return (
    style == TickStyle.SOLO ||
    style == TickStyle.LEAD ||
    style == TickStyle.LEAD_ONSIGHT ||
    style == TickStyle.LEAD_FLASH ||
    style == TickStyle.LEAD_REDPOINT ||
    style == TickStyle.LEAD_PINKPOINT ||
    style == TickStyle.SEND ||
    style == TickStyle.FLASH
  );
}

// A map value in Route's |ticks| field.
export interface Tick {
  date: string; // 'YYYYMMDD'
  style: TickStyle;
  pitches: number;
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

export function RouteTypeToString(t: RouteType): string {
  switch (t) {
    case RouteType.OTHER:
      return 'Other';
    case RouteType.SPORT:
      return 'Sport';
    case RouteType.TRAD:
      return 'Trad';
    case RouteType.BOULDER:
      return 'Boulder';
    case RouteType.ICE:
      return 'Ice';
    case RouteType.ALPINE:
      return 'Alpine';
    case RouteType.MIXED:
      return 'Mixed';
    case RouteType.SNOW:
      return 'Snow';
    case RouteType.AID:
      return 'Aid';
    case RouteType.TOP_ROPE:
      return 'Top-rope';
    default:
      return 'Unknown';
  }
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
  // If the user deletes a tick, it's moved here from |ticks|.
  deletedTicks?: Record<TickId, Tick>;
}

// Partial information about a route stored in Area.
export interface RouteSummary {
  name: string;
  grade: string;
}

// A unique identifier for an area containing routes. Created by joining the
// components of the |location| field returned by the get-routes API endpoint,
// e.g. 'Colorado|Boulder|Flatirons|South|The Maiden'. Some characters are
// escaped due to limitations in Firestore path components; see makeAreaId() in
// convert.ts.
//
// This is used as the document ID for the corresponding AreaMap in the |areas|
// subcollection.
//
// It would be better to use actual area IDs from Mountain Project URLs, e.g.
// https://www.mountainproject.com/area/105907743/international, but as far as I
// can tell, the API doesn't expose those anywhere -- get-routes just returns
// the human-readable location components that are used here.
export type AreaId = string;

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

// The 'counts' document in the 'stats' subcollection. Contains tick and pitch
// counts keyed by various values.
//
// To add a new field:
// - Update addTicksToCounts() in stats.ts.
// - Update testCounts() in testdata.ts.
// - Increment the |countsVersion| constant in this file to force
//   views/Stats.vue to regenerate stale documents.
export interface Counts {
  // Value of |countsVersion| at the time when the Counts object was created.
  version: number;

  datePitches: Record<string, number>; // 'YYYYMMDD'
  dateTicks: Record<string, number>; // 'YYYYMMDD'
  dayOfWeekPitches: Record<number, number>; // ISO 8601: 1 is Monday, 7 is Sunday
  dayOfWeekTicks: Record<number, number>; // ISO 8601: 1 is Monday, 7 is Sunday
  gradeCleanTicks: Record<string, number>; // '5.10a PG-13', 'V3', etc.
  gradeTicks: Record<string, number>; // '5.10a PG-13', 'V3', etc.
  latLongTicks: Record<string, number>; // '39.94,-105.01' (1.1132 km accuracy)
  pitchesTicks: Record<number, number>; // pitch count from tick
  regionTicks: Record<string, number>; // 'California', 'China', etc.
  routeTicks: Record<string, number>; // 'id|name', e.g. '105924807|The Nose'
  routeTypeTicks: Record<number, number>; // RouteType (TS doesn't allow enum keys)
  tickStyleTicks: Record<number, number>; // TickStyle (TS doesn't allow enum keys)
}

// Current version of the Counts interface.
export const countsVersion = 1;

// Returns an empty Counts object.
export function newCounts(): Counts {
  return {
    version: countsVersion,
    datePitches: {},
    dateTicks: {},
    dayOfWeekPitches: {},
    dayOfWeekTicks: {},
    gradeCleanTicks: {},
    gradeTicks: {},
    latLongTicks: {},
    pitchesTicks: {},
    regionTicks: {},
    routeTicks: {},
    routeTypeTicks: {},
    tickStyleTicks: {},
  };
}

// Number of entries to store in Counts.routeTicks.
export const numTopRoutes = 20;

// Documents in the 'imports' subcollection.
export interface ImportedTicks {
  ticks: ApiTick[];
}
export interface ImportedRoutes {
  routes: ApiRoute[];
}

// Maximum number of entries to store in each ImportedTicks and ImportedRoutes
// document.
export const importedTicksBatchSize = 200;
export const importedRoutesBatchSize = 200;
