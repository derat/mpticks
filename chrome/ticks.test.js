// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { groupTicksByRoute, sortTicks } from './ticks';

// Default route ID used by makeTick.
const rid = 10;

// Next tick ID to be used by makeTick.
let nextTickId = 1;
beforeEach(() => {
  nextTickId = 1;
});

// Returns a tick object using the supplied data and an ascending tick ID.
function makeTick(
  style,
  leadStyle = '',
  routeId = rid,
  date = '2020-01-01',
  pitches = 1
) {
  return { tickId: nextTickId++, routeId, date, style, leadStyle, pitches };
}

describe('groupTicksByRoute', () => {
  it('groups ticks by route', () => {
    const rid1 = 101;
    const rid2 = 102;
    const rid3 = 103;
    const t1 = makeTick('Lead', 'Fell/Hung', rid1);
    const t2 = makeTick('Lead', 'Pinkpoint', rid1);
    const t3 = makeTick('TR', '', rid2);
    const t4 = makeTick('Solo', '', rid2);
    const t5 = makeTick('Follow', '', rid3);
    expect(groupTicksByRoute([t1, t2, t3, t4, t5])).toEqual({
      [rid1]: [t1, t2],
      [rid2]: [t3, t4],
      [rid3]: [t5],
    });
  });
});

describe('sortTicks', () => {
  it('favors onsights over falls', () => {
    const t1 = makeTick('Lead', 'Fell/Hung');
    const t2 = makeTick('Lead', 'Onsight');
    expect(sortTicks([t1, t2])).toEqual([t2, t1]);
  });

  it('favors leading over top-roping', () => {
    const t1 = makeTick('TR');
    const t2 = makeTick('Lead', 'Fell/Hung');
    expect(sortTicks([t1, t2])).toEqual([t2, t1]);
  });

  it('favors redpointing over falling', () => {
    const t1 = makeTick('Lead', 'Fell/Hung');
    const t2 = makeTick('Lead', 'Fell/Hung');
    const t3 = makeTick('Lead', 'Redpoint');
    const t4 = makeTick('Lead', '');
    const t5 = makeTick('Lead', 'Fell/Hung');
    expect(sortTicks([t1, t2, t3, t4, t5])).toEqual([t3, t4, t1, t2, t5]);
  });

  it('favors earlier climbs', () => {
    const t1 = makeTick('Lead', '', rid, '2020-01-10');
    const t2 = makeTick('Lead', '', rid, '2019-10-15');
    const t3 = makeTick('Lead', '', rid, '2020-02-01');
    expect(sortTicks([t1, t2, t3])).toEqual([t2, t1, t3]);
  });

  it('favors ticks with more pitches', () => {
    // A tick with more pitches should be favored even if it has a worse style.
    const t1 = makeTick('Lead', 'Onsight', rid, '2020-01-10', 1);
    const t2 = makeTick('Follow', '', rid, '2020-02-20', 3);
    expect(sortTicks([t1, t2])).toEqual([t2, t1]);
  });

  it('constrains tick pitches to route pitches', () => {
    // Cap the tick pitch count to the route pitch count to handle a tick's
    // pitches being used to record laps:
    // https://github.com/derat/mpticks/issues/4
    const t1 = makeTick('Lead', 'Redpoint', rid, '2020-01-10', 1);
    const t2 = makeTick('Lead', 'Redpoint', rid, '2020-02-20', 3);
    expect(sortTicks([t2, t1], 1)).toEqual([t1, t2]);

    // MP seems to return an empty string if it doesn't have a pitch count for
    // the route. Use the ticks' pitch counts directly in this case.
    expect(sortTicks([t2, t1], '')).toEqual([t2, t1]);
  });

  it('favors lower tick IDs', () => {
    const t1 = makeTick('Send', '', rid, '2020-01-10');
    const t2 = makeTick('Send', '', rid, '2020-01-10');
    const t3 = makeTick('Send', '', rid, '2020-01-10');
    expect(sortTicks([t2, t3, t1])).toEqual([t1, t2, t3]);
  });
});
