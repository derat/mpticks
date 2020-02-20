// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { newCounts, Route, RouteId, Tick, TickId } from '@/models';
import { addTicksToCounts } from '@/stats';
import { testCounts, testRoute, testTick } from '@/testdata';

describe('addTicksToCounts', () => {
  // src/views/Import.test.ts also tests that that counts are incremented
  // correctly and that the |topRoutes| field is maintained.

  it('adds and subtracts ticks', () => {
    const rid1 = 1;
    const rid2 = 2;
    const tid1 = 11;
    const tid2 = 12;
    const tid3 = 13;
    const loc1 = ['International', 'Europe', 'Germany'];
    const loc2 = ['Colorado'];

    // Add all of the ticks first.
    let r1 = testRoute(rid1, [tid1], loc1);
    let r2 = testRoute(rid2, [tid2, tid3], loc2);
    const t1 = r1.ticks[tid1];
    const t2 = r2.ticks[tid2];
    const t3 = r2.ticks[tid3];
    const counts = newCounts();
    // prettier-ignore
    let routes = new Map([[rid1, r1], [rid2, r2]]);
    // prettier-ignore
    addTicksToCounts(
      counts,
      new Map([
        [rid1, new Map([[tid1, t1]])],
        [rid2, new Map([[tid2, t2], [tid3, t3]])],
      ]),
      routes
    );
    expect(counts).toEqual(testCounts(routes));

    // Delete the first and third ticks.
    r1 = testRoute(rid1, [], loc1);
    r2 = testRoute(rid2, [tid2], loc2);
    // prettier-ignore
    routes = new Map([[rid1, r1], [rid2, r2]]);
    addTicksToCounts(
      counts,
      new Map([
        [rid1, new Map([[tid1, t1]])],
        [rid2, new Map([[tid3, t3]])],
      ]),
      routes,
      true /* remove */
    );
    expect(counts).toEqual(testCounts(routes));

    // Now delete the second tick as well.
    r2 = testRoute(rid2, [], loc2);
    // prettier-ignore
    routes = new Map([[rid1, r1], [rid2, r2]]);
    addTicksToCounts(
      counts,
      new Map([[rid2, new Map([[tid2, t2]])]]),
      routes,
      true /* remove */
    );
    expect(counts).toEqual(newCounts());
  });
});
