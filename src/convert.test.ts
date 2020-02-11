// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ApiRoute, ApiTick } from '@/api';
import {
  createRoute,
  createTick,
  getRegion,
  getRouteType,
  getTickStyle,
  unknownRegion,
} from '@/convert';
import { RouteType, TickStyle } from '@/models';
import { testApiRoute, testApiTick, testRoute, testTick } from '@/testdata';

describe('createRoute', () => {
  it('converts ApiRoute objects to Route objects', () => {
    const routeId = 10;
    const location = ['A', 'B', 'C'];
    expect(createRoute(testApiRoute(routeId, location))).toEqual(
      testRoute(routeId, [], location)
    );
  });

  it('sanitizes data', () => {
    expect(
      createRoute({
        id: 1,
        name: 'Name',
        type: '',
        rating: '',
        stars: 1,
        starVotes: 2,
        pitches: '',
        location: ['Here'],
        url: '',
        imgSqSmall: '',
        imgSmall: '',
        imgSmallMed: '',
        imgMedium: '',
        longitude: 0,
        latitude: 0,
      })
    ).toEqual({
      name: 'Name',
      type: RouteType.OTHER,
      location: ['Here'],
      lat: 0,
      long: 0,
      grade: '',
      ticks: {},
    });
  });

  it('throws errors for missing fields', () => {
    [
      { name: 'Name', location: [] },
      { id: 3, location: [] },
      { id: 3, name: 'Name' },
    ].forEach(o => {
      expect(() => createRoute((o as unknown) as ApiRoute)).toThrow();
    });
  });
});

describe('createTick', () => {
  it('converts ApiTick objects to Tick objects', () => {
    const tickId = 3;
    const routeId = 5;
    expect(createTick(testApiTick(tickId, routeId))).toEqual(
      testTick(tickId, routeId)
    );
  });

  it('fixes mangled characters in notes', () => {
    const tickId = 3;
    const routeId = 5;

    const apiTick = testApiTick(tickId, routeId);
    apiTick.notes = '&#39;\r\n&#34;\r\n<>&';

    const tick = testTick(tickId, routeId);
    tick.notes = '\'\n"\n<>&';

    expect(createTick(apiTick)).toEqual(tick);
  });

  it('sanitizes data', () => {
    expect(
      createTick({
        routeId: 1,
        date: '2019-10-31',
        pitches: 1,
        notes: '',
        style: '',
        leadStyle: '',
        tickId: 10,
        userStars: -1,
        userRating: '',
      })
    ).toEqual({
      date: '20191031',
      style: TickStyle.UNKNOWN,
      pitches: 1,
    });
  });

  it('throws errors for missing or malformed fields', () => {
    [
      { routeId: 2, date: '2019-01-01' },
      { tickId: 1, date: '2019-01-01' },
      { tickId: 1, routeId: 2 },
      { tickId: 1, routeId: 2, date: 'bogus' },
    ].forEach(o => {
      expect(() => createTick((o as unknown) as ApiTick)).toThrow();
    });
  });
});

describe('getRouteType', () => {
  it('converts API-supplied types correctly', () => {
    ([
      ['Sport', RouteType.SPORT],
      ['Trad', RouteType.TRAD],
      ['Boulder', RouteType.BOULDER],
      ['Ice', RouteType.ICE],
      ['Alpine', RouteType.ALPINE],
      ['Mixed', RouteType.MIXED],
      ['Snow', RouteType.SNOW],
      ['Aid', RouteType.AID],
      ['TR', RouteType.TOP_ROPE],
      ['Trad, TR, Sport', RouteType.SPORT],
      ['Boulder, TR', RouteType.BOULDER],
      ['Snow, Ice', RouteType.ICE],
      ['Trad, Aid', RouteType.TRAD],
      ['Bogus', RouteType.OTHER],
      ['', RouteType.OTHER],
    ] as [string, RouteType][]).forEach(([str, exp]) => {
      expect(getRouteType(str)).toEqual(exp);
    });
  });
});

describe('getTickStyle', () => {
  it('converts API-supplied styles correctly', () => {
    ([
      ['Solo', '', TickStyle.SOLO],
      ['TR', '', TickStyle.TOP_ROPE],
      ['Follow', '', TickStyle.FOLLOW],
      ['Lead', 'Onsight', TickStyle.LEAD_ONSIGHT],
      ['Lead', 'Flash', TickStyle.LEAD_FLASH],
      ['Lead', 'Redpoint', TickStyle.LEAD_REDPOINT],
      ['Lead', 'Pinkpoint', TickStyle.LEAD_PINKPOINT],
      ['Lead', 'Fell/Hung', TickStyle.LEAD_FELL_HUNG],
      ['Lead', '', TickStyle.LEAD],
      ['Send', '', TickStyle.SEND],
      ['Flash', '', TickStyle.FLASH],
      ['Attempt', '', TickStyle.ATTEMPT],
      ['Lead', 'Bogus', TickStyle.LEAD],
      ['Bogus', '', TickStyle.UNKNOWN],
      ['', '', TickStyle.UNKNOWN],
    ] as [string, string, TickStyle][]).forEach(([style, leadStyle, exp]) => {
      expect(getTickStyle(style, leadStyle)).toEqual(exp);
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
