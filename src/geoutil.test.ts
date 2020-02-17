// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { truncateLatLong } from './geoutil';

describe('truncateLatLong', () => {
  it('truncates to two decimal places', () => {
    ([
      [45.5435, -123.34541, '45.54,-123.35'],
      [0.123, 0.426, '0.12,0.43'],
      [29.999, 41.964, '30.00,41.96'],
      [23, -67, '23.00,-67.00'],
    ] as [number, number, string][]).forEach(([lat, long, exp]) => {
      expect(truncateLatLong(lat, long)).toEqual(exp);
    });
  });
});
