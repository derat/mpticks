// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Truncates the supplied coordinates to two decimal places (corresponding to
// 1.1132 km of precision) and returns a string like '39.92,-105.05'. See
// https://en.wikipedia.org/wiki/Decimal_degrees.
export function truncateLatLong(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}
