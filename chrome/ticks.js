// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Groups the supplied ticks by route ID. |ticks| is an array of tick objects.
// Returns an object mapping from route ID to array of tick objects.
export function groupTicksByRoute(ticks) {
  const routeTicks = {};
  for (const tick of ticks) {
    const routeId = tick.routeId;
    if (!routeTicks[routeId]) routeTicks[routeId] = [];
    routeTicks[routeId].push(tick);
  }
  return routeTicks;
}

// Sorts the supplied ticks from best to worst. Accepts and returns an array of
// tick objects. |routePitches| is MP's pitch count for the route.
export function sortTicks(ticks, routePitches) {
  // Main style and lead tick style values from best to worst for some
  // definition of "best" and "worst". makeSortKey() needs to be updated if
  // these ever exceed single digits.
  const styleValues = {
    // These imply a clean climb, so they come first.
    Solo: 1,
    Flash: 2,
    Send: 3,
    // 'Lead' may or may not be clean depending on 'leadStyle'.
    Lead: 4,
    Follow: 5,
    TR: 6,
    // This likely means a fall, since 'Flash' or 'Send' would presumably be
    // used otherwise.
    Attempt: 7,
  };
  const leadStyleValues = {
    Onsight: 1,
    Flash: 2,
    Redpoint: 3,
    Pinkpoint: 4,
    'Fell/Hung': 5,
  };

  // Returns a string to use when comparing |tick| against other ticks. Ticks
  // are ordered by pitches, style, date, and then ID. Keys that are
  // lexicographically smaller correspond to "better" ticks.
  const makeSortKey = tick => {
    // Some users use the tick's pitch count to record multiple laps on a
    // single-pitch route. If the API supplied a pitch count for the route, use
    // it to cap the tick's pitch count. More details at
    // https://github.com/derat/mpticks/issues/4.
    let pitches = tick.pitches || 1;
    if (routePitches && pitches > routePitches) pitches = routePitches;

    const pitchesKey = (100 - pitches).toString().padStart(2, '0');
    const styleKey = styleValues[tick.style] || 9;
    const leadStyleKey = leadStyleValues[tick.leadStyle] || 9;
    const paddedId = tick.tickId.toString().padStart(10, '0');
    return `${pitchesKey}|${styleKey}|${leadStyleKey}|${tick.date}|${paddedId}`;
  };

  const tickSortKeys = {}; // keys are tick IDs, values are strings
  for (const tick of ticks) tickSortKeys[tick.tickId] = makeSortKey(tick);
  return ticks.sort((a, b) =>
    tickSortKeys[a.tickId].localeCompare(tickSortKeys[b.tickId])
  );
}
