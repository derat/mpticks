// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Parses a date in the format 'YYYYMMDD' to a Date in the local time zone.
export function parseDate(date: string): Date {
  if (!date.match(/^\d{8}$/)) throw new Error(`Date '${date}' is not YYYYMMDD`);
  return new Date(
    parseInt(date.substring(0, 4)),
    parseInt(date.substring(4, 6)) - 1,
    parseInt(date.substring(6, 8))
  );
}

// Returns the day of week from |date| per ISO 8601 (i.e. 1 is Monday and 7 is
// Sunday).
export function getDayOfWeek(date: Date): number {
  return date.getDay() || 7;
}
