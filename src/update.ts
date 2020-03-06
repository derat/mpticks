// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { formatDateString, getDayOfWeek, parseDate } from '@/dateutil';
import { areaMapRef, areaRef, countsRef, routeRef, userRef } from '@/docs';
import { truncateLatLong } from '@/geoutil';
import {
  compareTicks,
  Area,
  AreaId,
  AreaMap,
  Counts,
  isCleanTickStyle,
  newCounts,
  numTopRoutes,
  Route,
  RouteId,
  Tick,
  TickId,
} from '@/models';

// Generates an AreaId based on the supplied location components.
export function makeAreaId(location: string[]): AreaId {
  // Area IDs are used as document IDs in the 'areas' subcollection, so we
  // percent-escape various characters to avoid running afoul of the naming
  // rules at https://cloud.google.com/firestore/quotas.
  let id: AreaId = location
    // Forward slashes can't appear in Firestore path components.
    // Pipes are used for separating components.
    // Percent signs are used for escaping.
    .map(l => l.replace(/[/|%]/g, c => '%' + c.charCodeAt(0).toString(16)))
    .join('|');

  // Handle more weird Firestore document-naming rules: docs can't be named '.',
  // '..', or be matched by /__.*__/.
  if (id == '.') {
    id = '%2e';
  } else if (id == '..') {
    id = '%2e%2e';
  } else if (id.length >= 4 && id.startsWith('__') && id.endsWith('__')) {
    id = '%5f%5f' + id.slice(2, id.length - 2) + '%5f%5f';
  }

  return id;
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

// Loads the areas for |routes| from Firestore and adds each route to the
// appropriate area. If |overwrite| is true, all areas are created from scratch
// without being loaded from Firestore.
export function saveRoutesToAreas(
  routes: Map<RouteId, Route>,
  overwrite: boolean,
  batch: firebase.firestore.WriteBatch
): Promise<void> {
  if (!routes.size) return Promise.resolve();

  // Figure out which areas are needed.
  const areaLocations = new Map<AreaId, string[]>();
  for (const r of routes.values()) {
    areaLocations.set(makeAreaId(r.location), r.location);
  }

  const areas = new Map<AreaId, Area>();
  let areaMap: AreaMap = {};

  // Load the area map from Firestore so new areas can be added to it.
  return (overwrite
    ? Promise.resolve()
    : areaMapRef()
        .get()
        .then(snap => {
          if (snap.metadata.fromCache) {
            throw new Error("Can't update area map using cached data");
          }
          if (snap.exists) areaMap = snap.data() as AreaMap;
        })
  ).then(() =>
    // Try to load each area from Firestore.
    Promise.all(
      Array.from(areaLocations).map(([areaId, location]) =>
        (overwrite
          ? Promise.resolve(null)
          : areaRef(areaId)
              .get()
              .then(snap => {
                if (snap.metadata.fromCache) {
                  throw new Error("Can't update areas using cached data");
                }
                return snap.exists ? (snap.data() as Area) : null;
              })
        ).then(area => {
          if (area) {
            areas.set(areaId, area);
          } else {
            areas.set(areaId, { routes: {} });
            addAreaToAreaMap(areaId, location, areaMap);
          }
        })
      )
    ).then(() => {
      // Update areas to contain route summaries.
      routes.forEach((route: Route, routeId: RouteId) => {
        areas.get(makeAreaId(route.location))!.routes[routeId] = {
          name: route.name,
          grade: route.grade,
        };
      });
      // Queue up writes.
      batch.set(areaMapRef(), areaMap);
      areas.forEach((area: Area, areaId: AreaId) => {
        batch.set(areaRef(areaId), area);
      });
    })
  );
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

// Loads all routes from Firestore. This is expensive and should be used
// sparingly.
export function loadAllRoutes(): Promise<Map<RouteId, Route>> {
  return userRef()
    .collection('routes')
    .get()
    .then(snapshot => {
      if (snapshot.metadata.fromCache) {
        throw new Error("Can't load all routes using cached data");
      }
      const routes = new Map<RouteId, Route>();
      snapshot.docs.forEach(doc => {
        if (doc.metadata.fromCache) {
          throw new Error("Can't load all routes using cached data");
        }
        const routeId = parseInt(doc.id);
        const route = doc.data() as Route;
        routes.set(routeId, route);
      });
      return routes;
    });
}

// Returns a map from route ID to ticks for all routes in |routes|.
export function getRouteTicks(
  routes: Map<RouteId, Route>
): Map<RouteId, Map<TickId, Tick>> {
  const routeTicks = new Map<RouteId, Map<TickId, Tick>>();
  routes.forEach((route: Route, routeId: RouteId) => {
    routeTicks.set(
      routeId,
      new Map(
        Object.entries(route.ticks).map(([tickId, tick]) => [
          parseInt(tickId),
          tick as Tick,
        ])
      )
    );
  });
  return routeTicks;
}

// Deletes |tickId| from |routeId| in Firestore.
// Also loads the counts doc and updates it using addTicksToCounts().
export function deleteTick(
  tickId: TickId,
  routeId: RouteId,
  batch: firebase.firestore.WriteBatch
): Promise<void> {
  return Promise.all([
    routeRef(routeId)
      .get()
      .then(snap => {
        if (snap.metadata.fromCache) {
          throw new Error("Can't update route using cached data");
        }
        if (!snap.exists) throw new Error(`Can't find route ${routeId}`);
        return snap.data() as Route;
      }),
    countsRef()
      .get()
      .then(snap => {
        if (snap.metadata.fromCache) {
          throw new Error("Can't update stats using cached data");
        }
        if (!snap.exists) throw new Error("Can't find stats");
        return snap.data() as Counts;
      }),
  ]).then(([route, counts]) => {
    const tick = route.ticks[tickId];
    if (!tick) throw new Error(`Can't find tick ${tickId}`);

    // This needs to happen before |route| is passed to addTicksToCounts().
    delete route.ticks[tickId];
    (route.deletedTicks = route.deletedTicks || {})[tickId] = tick;
    batch.set(routeRef(routeId), route);

    addTicksToCounts(
      counts,
      new Map([[routeId, new Map([[tickId, tick]])]]),
      new Map([[routeId, route]]),
      true /* remove */
    );
    batch.set(countsRef(), counts);
  });
}

// Loads, updates, and writes the stats document to include the ticks in
// |routeTicks|. |routes| is used to get route information; the ticks in
// |routeTicks| should already be incorporated. If |overwrite| is true, the
// existing doc in Firestore will be overwritten with a newly-created doc
// instead of the existing doc being loaded and updated.
export function updateCounts(
  routeTicks: Map<RouteId, Map<TickId, Tick>>,
  routes: Map<RouteId, Route>,
  overwrite: boolean,
  batch: firebase.firestore.WriteBatch
): Promise<Counts> {
  return (overwrite
    ? Promise.resolve(newCounts())
    : countsRef()
        .get()
        .then(snap => {
          if (snap.metadata.fromCache) {
            throw new Error("Can't update stats using cached data");
          }
          const counts = newCounts();
          if (snap.exists) {
            // Copy over fields from Firestore while keeping unset versions.
            const data = snap.data()!;
            Object.assign(counts, data);
            if (!data.hasOwnProperty('version')) counts.version = 0;
          }
          return counts;
        })
  ).then(counts => {
    addTicksToCounts(counts, routeTicks, routes);
    batch.set(countsRef(), counts);
    return counts;
  });
}

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
