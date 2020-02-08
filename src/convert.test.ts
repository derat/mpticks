// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

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
});

describe('createTick', () => {
  it('converts ApiTick objects to Tick objects', () => {
    const tickId = 3;
    const routeId = 5;
    expect(createTick(testApiTick(tickId, routeId))).toEqual(
      testTick(tickId, routeId)
    );
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
