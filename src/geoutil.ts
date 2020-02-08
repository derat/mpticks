// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Truncates the supplied coordinates to a single decimal place (corresponding
// to 11.132 km of precision) and returns a string like '39.9,-105.0'. See
// https://en.wikipedia.org/wiki/Decimal_degrees.
export function truncateLatLong(latitude: number, longitude: number): string {
  return `${latitude.toFixed(1)},${longitude.toFixed(1)}`;
}
