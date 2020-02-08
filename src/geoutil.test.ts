// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { truncateLatLong } from './geoutil';

describe('truncateLatLong', () => {
  it('truncates to one decimal place', () => {
    ([
      [45.5435, -123.34541, '45.5,-123.3'],
      [0.123, 0.426, '0.1,0.4'],
      [29.99, 41.96, '30.0,42.0'],
      [23, -67, '23.0,-67.0'],
    ] as [number, number, string][]).forEach(([lat, long, exp]) => {
      expect(truncateLatLong(lat, long)).toEqual(exp);
    });
  });
});
