// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { groupAndSortTicks } from './ticks';

describe('groupAndSortTicks', () => {
  // Default route ID used by makeTick.
  const rid = 10;

  // Next tick ID to be used by makeTick.
  let nextTickId = 1;
  beforeEach(() => {
    nextTickId = 1;
  });

  // Returns a tick object using the supplied data and an ascending tick ID.
  function makeTick(style, leadStyle = '', routeId = rid, date = '2020-01-01') {
    return { tickId: nextTickId++, routeId, date, style, leadStyle };
  }

  it('favors onsights over falls', () => {
    const t1 = makeTick('Lead', 'Fell/Hung');
    const t2 = makeTick('Lead', 'Onsight');
    expect(groupAndSortTicks([t1, t2])).toEqual({ [rid]: [t2, t1] });
  });

  it('favors leading over top-roping', () => {
    const t1 = makeTick('TR');
    const t2 = makeTick('Lead', 'Fell/Hung');
    expect(groupAndSortTicks([t1, t2])).toEqual({ [rid]: [t2, t1] });
  });

  it('favors redpointing over falling', () => {
    const t1 = makeTick('Lead', 'Fell/Hung');
    const t2 = makeTick('Lead', 'Fell/Hung');
    const t3 = makeTick('Lead', 'Redpoint');
    const t4 = makeTick('Lead', 'Fell/Hung');
    expect(groupAndSortTicks([t1, t2, t3, t4])).toEqual({
      [rid]: [t3, t1, t2, t4],
    });
  });

  it('favors earlier climbs', () => {
    const t1 = makeTick('Lead', '', rid, '2020-01-10');
    const t2 = makeTick('Lead', '', rid, '2019-10-15');
    const t3 = makeTick('Lead', '', rid, '2020-02-01');
    expect(groupAndSortTicks([t1, t2, t3])).toEqual({
      [rid]: [t2, t1, t3],
    });
  });

  it('favors lower tick IDs', () => {
    const t1 = makeTick('Send', '', rid, '2020-01-10');
    const t2 = makeTick('Send', '', rid, '2020-01-10');
    const t3 = makeTick('Send', '', rid, '2020-01-10');
    expect(groupAndSortTicks([t2, t3, t1])).toEqual({
      [rid]: [t1, t2, t3],
    });
  });

  it('groups ticks by route', () => {
    const rid1 = 101;
    const rid2 = 102;
    const rid3 = 103;
    const t1 = makeTick('Lead', 'Fell/Hung', rid1);
    const t2 = makeTick('Lead', 'Pinkpoint', rid1);
    const t3 = makeTick('TR', '', rid2);
    const t4 = makeTick('Solo', '', rid2);
    const t5 = makeTick('Follow', '', rid3);
    expect(groupAndSortTicks([t1, t2, t3, t4, t5])).toEqual({
      [rid1]: [t2, t1],
      [rid2]: [t4, t3],
      [rid3]: [t5],
    });
  });
});
