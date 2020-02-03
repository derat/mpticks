// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

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
}

// A map value in Route's |ticks| field.
export interface Tick {
  date: string; // 'YYYY-MM-DD'
  pitches: number;
  style: TickStyle;
  notes: string;
  stars: number; // optional user-supplied score: 1 is 'bomb', 5 is 4-star
  grade: string; // optional user-supplied grade, e.g. '5.11a'
}

// Corresponds to the |type| field returned by the get-routes API endpoint. In
// addition to a choice between these three types, Mountain Project offers a
// 'Toprope' checkbox. I'm not bothering with it since it doesn't seem useful in
// the context of ticks -- the TickStyle enum already describes the user's
// climbing style.
export enum RouteType {
  SPORT = 0,
  TRAD = 1,
  OTHER = 2,
}

// A document in the |routes| subcollection under a user document.
// This contains detailed information about the route itself, along with all of
// the user's ticks for the route.
export interface Route {
  name: string;
  type: RouteType;
  location: string[]; // e.g. ['Colorado', 'Boulder', ...]
  grade: string; // e.g. '5.11a'
  pitches: number;
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

// A document in the |areas| subcollection under a user document. Specifically,
// this is a location (to use Mountain Project's terminology) that includes one
// or more routes.
//
// If a location does not directly include routes but needs to be tracked
// because it has sublocations with routes, then it's only tracked by AreaMap.
export interface Area {
  // Routes that are in this area (but not in child areas).
  routes: Record<RouteId, RouteSummary>;
}

// The 'map' document in the |areas| subcollection, but also used recursively
// within that document. This stores the high-level tree of areas. At the top
// level of the 'map' document, |children| contains top-level locations, e.g.
// 'Colorado' and 'International'.
export interface AreaMap {
  // Areas within this area, keyed by name (e.g. 'Boulder Canyon').
  children: Record<string, AreaMap>;
  // If the area contains routes, the document ID of the Area document in the
  // |areas| subcollection describing the area's routes. Undefined if the area
  // doesn't directly contain any routes.
  areaId?: AreaId;
}
