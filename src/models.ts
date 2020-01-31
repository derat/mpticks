// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export type RouteId = number;
export type TickId = number;

// A combination of the 'style' and 'leadStyle' fields returned by the get-ticks
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

// A map value in Route's 'ticks' field.
export interface Tick {
  date: string; // 'YYYY-MM-DD'
  pitches: number;
  style: TickStyle;
  notes: string;
  stars: number; // optional user-supplied score: 1 is 'bomb', 5 is 4-star
  grade: string; // optional user-supplied grade, e.g. '5.11a'
}

// Corresponds to the 'type' field returned by the get-routes API endpoint. In
// addition to a choice between these three types, Mountain Project offers a
// 'Toprope' checkbox. I'm not bothering with it since it doesn't seem useful in
// the context of ticks -- the TickStyle enum already describes the user's
// climbing style.
export enum RouteType {
  SPORT = 0,
  TRAD = 1,
  OTHER = 2,
}

// A document in the 'routes' subcollection under a user document.
export interface Route {
  name: string;
  type: RouteType;
  grade: string; // e.g. '5.11a'
  pitches: number;
  ticks: Record<TickId, Tick>;
}

export type LocationName = string;
type LocationMap = Record<LocationName, Location>;

export interface LocationInfo {
  routeIds: RouteId[]; // routes that are directly in the location
  numTicks: number; // includes ticks from children
  children: LocationMap;
}

// A document in the 'users' collection.
export interface User {
  locations: LocationMap; // top-level locations
}
