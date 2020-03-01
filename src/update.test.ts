// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MockFirebase, MockUser } from '@/firebase/mock';
import app from '@/firebase';

import { areaMapRef, areaRef } from '@/docs';
import { AreaMap, newCounts, Route, RouteId, Tick, TickId } from '@/models';
import { testCounts, testRoute, testRouteSummary, testTick } from '@/testdata';
import {
  addAreaToAreaMap,
  addTicksToCounts,
  makeAreaId,
  getRegion,
  saveRoutesToAreas,
  unknownRegion,
} from '@/update';

const testUid = 'test-uid';

describe('makeAreaId', () => {
  it('escapes disallowed characters', () => {
    ([
      [['A', 'B', 'C'], 'A|B|C'],
      [['A/%B', 'C%|D', 'E|/F'], 'A%2f%25B|C%25%7cD|E%7c%2fF'],
      [['.'], '%2e'],
      [['.A'], '.A'],
      [['..'], '%2e%2e'],
      [['..A'], '..A'],
      [['__foo__'], '%5f%5ffoo%5f%5f'],
      [['____'], '%5f%5f%5f%5f'],
      [['___'], '___'],
      [['__'], '__'],
    ] as [string[], string][]).forEach(([location, exp]) => {
      expect(makeAreaId(location)).toBe(exp);
      // It's just a nice-to-have, but check that the area ID decodes to the
      // original components joined by pipes.
      expect(decodeURIComponent(makeAreaId(location))).toBe(location.join('|'));
    });
  });
});

describe('addAreaToAreaMap', () => {
  it('adds nested areas', () => {
    const loc1 = ['a', 'b', 'c'];
    const loc2 = ['a', 'b', 'c2'];
    const loc3 = ['a', 'b2', 'd'];
    const loc4 = ['a2'];

    const map: AreaMap = {};
    [loc1, loc2, loc3, loc4].forEach(loc =>
      addAreaToAreaMap(makeAreaId(loc), loc, map)
    );
    expect(map).toEqual({
      children: {
        a: {
          children: {
            b: {
              children: {
                c: { areaId: makeAreaId(loc1) },
                c2: { areaId: makeAreaId(loc2) },
              },
            },
            b2: {
              children: {
                d: { areaId: makeAreaId(loc3) },
              },
            },
          },
        },
        a2: { areaId: makeAreaId(loc4) },
      },
    });
  });
});

describe('saveRoutesToAreas', () => {
  beforeEach(async () => {
    MockFirebase.reset();
    MockFirebase.currentUser = new MockUser(testUid, 'Test User');
  });

  it('updates existing areas', async () => {
    const loc1 = ['a', 'b'];
    const loc2 = ['a', 'b', 'c'];
    const loc3 = ['d', 'e'];

    MockFirebase.setDoc(areaMapRef(), {
      children: { a: { children: { b: { areaId: makeAreaId(loc1) } } } },
    });
    MockFirebase.setDoc(areaRef(makeAreaId(loc1)), {
      routes: { 1: testRouteSummary(1) },
    });

    const batch = app.firestore().batch();
    await saveRoutesToAreas(
      new Map([
        [1, testRoute(1, [], loc1)],
        [2, testRoute(2, [], loc2)],
        [3, testRoute(3, [], loc3)],
        [4, testRoute(4, [], loc1)],
      ]),
      false /* overwrite */,
      batch
    );
    await batch.commit();

    expect(MockFirebase.getDoc(areaMapRef())).toEqual({
      children: {
        a: {
          children: {
            b: {
              areaId: makeAreaId(loc1),
              children: {
                c: { areaId: makeAreaId(loc2) },
              },
            },
          },
        },
        d: { children: { e: { areaId: makeAreaId(loc3) } } },
      },
    });
    expect(MockFirebase.getDoc(areaRef(makeAreaId(loc1)))).toEqual({
      routes: { 1: testRouteSummary(1), 4: testRouteSummary(4) },
    });
    expect(MockFirebase.getDoc(areaRef(makeAreaId(loc2)))).toEqual({
      routes: { 2: testRouteSummary(2) },
    });
    expect(MockFirebase.getDoc(areaRef(makeAreaId(loc3)))).toEqual({
      routes: { 3: testRouteSummary(3) },
    });
  });

  it('overwrites areas when requested', async () => {
    const loc = ['a', 'b'];

    MockFirebase.setDoc(areaMapRef(), {
      children: {
        a: { children: { b: { areaId: makeAreaId(loc) } } },
        orphaned: { areaId: 'orphaned' }, // should be dropped from map
      },
    });
    MockFirebase.setDoc(areaRef(makeAreaId(loc)), {
      routes: { 1: testRouteSummary(1) },
    });

    // Overwrite with a new route in the existing area.
    const batch = app.firestore().batch();
    await saveRoutesToAreas(
      new Map([[2, testRoute(2, [], loc)]]),
      true /* overwrite */,
      batch
    );
    await batch.commit();

    expect(MockFirebase.getDoc(areaMapRef())).toEqual({
      children: { a: { children: { b: { areaId: makeAreaId(loc) } } } },
    });
    expect(MockFirebase.getDoc(areaRef(makeAreaId(loc)))).toEqual({
      routes: { 2: testRouteSummary(2) },
    });
  });
});

describe('getRegion', () => {
  it('converts area locations to regions', () => {
    ([
      // States should be returned.
      [['Colorado'], 'Colorado'],
      [['Colorado', 'Some Area'], 'Colorado'],
      [['Colorado', 'Flatirons', 'North', 'Baby Giraffe'], 'Colorado'],
      // Handle international areas that don't have countries under them.
      [['International', 'Australia', 'Sydney'], 'Australia'],
      [['International', 'Antarctica', 'Holtanna'], 'Antarctica'],
      // Countries (or territories) should be returned otherwise.
      [['International', 'Asia', 'Georgia', 'Chiatura'], 'Georgia'],
      [
        [
          'International',
          'North America',
          'Puerto Rico',
          'Nuevo Bayamón',
          'Dante',
        ],
        'Puerto Rico',
      ],
      // If the country is missing, use the continent. I don't know whether this
      // is expected to ever happen.
      [['International', 'Asia'], 'Asia'],
      [['International', 'South America'], 'South America'],
      // Handle unexpected data.
      [['In Progress', 'Banburries'], unknownRegion],
      [['In Progress'], unknownRegion],
      [['International'], unknownRegion],
      [[], unknownRegion],
    ] as [string[], string][]).forEach(([loc, region]) => {
      expect(getRegion(loc)).toEqual(region);
    });
  });
});

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
