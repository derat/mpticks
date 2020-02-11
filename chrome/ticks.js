// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Groups the supplied ticks by route ID and sorts each route's ticks from best
// to worst. |ticks| is an array of tick objects. Returns an object mapping from
// route ID to array of tick objects.
export function groupAndSortTicks(ticks) {
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

  // Returns a string to use when comparing |tick| against other ticks.
  // Ticks are ordered by style, date, and then ID. Keys that are
  // lexicographically smaller correspond to "better" ticks.
  const makeSortKey = tick => {
    const styleKey = styleValues[tick.style] || 9;
    const leadStyleKey = leadStyleValues[tick.leadStyle] || 9;
    const paddedId = tick.tickId.toString().padStart(10, '0');
    return `${styleKey}-${leadStyleKey}-${tick.date}-${paddedId}`;
  };

  // Group ticks by route.
  const routeTicks = {}; // keys are route IDs, values are arrays of ticks
  const tickSortKeys = {}; // keys are tick IDs, values are strings
  for (const tick of ticks) {
    const routeId = tick.routeId;
    if (!routeTicks[routeId]) routeTicks[routeId] = [];
    routeTicks[routeId].push(tick);
    tickSortKeys[tick.tickId] = makeSortKey(tick);
  }

  // Sort each route's ticks from best to worse.
  Object.values(routeTicks).forEach(ticks => {
    ticks.sort((a, b) =>
      tickSortKeys[a.tickId].localeCompare(tickSortKeys[b.tickId])
    );
  });

  return routeTicks;
}
