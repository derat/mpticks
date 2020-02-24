// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Performs a half-hearted check that |date| is in 'YYYYMMDD' format and throws
// an exception if it isn't.
function checkDateString(date: string) {
  if (!date.match(/^\d{4}(0[1-9]|1[012])(0[1-9]|[12]\d|3[01])$/)) {
    throw new Error(`Date '${date}' is not YYYYMMDD`);
  }
}

// Parses a date in the format 'YYYYMMDD' to a Date in the local time zone.
export function parseDate(date: string): Date {
  checkDateString(date);
  return new Date(
    parseInt(date.slice(0, 4)),
    parseInt(date.slice(4, 6)) - 1,
    parseInt(date.slice(6, 8))
  );
}

// Helper function for formatDate() and formatDateString(). |year|, |month|, and
// |date| should be zero-padded strings of lengths 4, 2, and 2, respectively.
function formatDateInternal(
  year: string,
  month: string,
  day: string,
  fmt: string
): string {
  fmt = fmt.replace(/%Y/g, year);
  fmt = fmt.replace(/%m/g, month);
  fmt = fmt.replace(/%d/g, day);

  const match = fmt.match(/%./);
  if (match) throw new Error(`Unsupported format code '${match[0]}'`);

  return fmt;
}

// Replaces '%Y', '%m', and '%d' sequences in |fmt| with the corresponding
// 0-padded values from |date|. Doesn't support escaping or any other strftime()
// format codes.
export function formatDate(date: Date, fmt: string): string {
  // Ladies and gentlemen, JavaScript: https://stackoverflow.com/a/34290167
  return formatDateInternal(
    date.getFullYear().toString(),
    ('0' + (date.getMonth() + 1)).slice(-2),
    ('0' + date.getDate()).slice(-2),
    fmt
  );
}

// Like formatDate(), but accepts a |date| arg in 'YYYYMMDD' format.
export function formatDateString(date: string, fmt: string): string {
  checkDateString(date);
  return formatDateInternal(
    date.slice(0, 4),
    date.slice(4, 6),
    date.slice(6, 8),
    fmt
  );
}

// Returns the day of week from |date| per ISO 8601 (i.e. 1 is Monday and 7 is
// Sunday).
export function getDayOfWeek(date: Date): number {
  return date.getDay() || 7;
}
