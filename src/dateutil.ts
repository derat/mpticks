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

// Replaces '%Y', '%m', and '%d' sequences in |fmt| with the corresponding
// 0-padded values from |date|. Doesn't support escaping or any other strftime()
// format codes.
export function formatDate(date: Date, fmt: string): string {
  // Ladies and gentlemen, JavaScript: https://stackoverflow.com/a/34290167
  fmt = fmt.replace(/%Y/g, date.getFullYear().toString());
  fmt = fmt.replace(/%m/g, ('0' + (date.getMonth() + 1)).slice(-2));
  fmt = fmt.replace(/%d/g, ('0' + date.getDate()).slice(-2));

  const match = fmt.match(/%./);
  if (match) throw new Error(`Unsupported format code '${match[0]}'`);

  return fmt;
}

// Returns the day of week from |date| per ISO 8601 (i.e. 1 is Monday and 7 is
// Sunday).
export function getDayOfWeek(date: Date): number {
  return date.getDay() || 7;
}
