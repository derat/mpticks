// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { formatDate, getDayOfWeek, parseDate } from './dateutil';

describe('parseDate', () => {
  it('parses dates with two-digit values', () => {
    const d = parseDate('20201123');
    expect(d.getFullYear()).toBe(2020);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(23);
  });

  it('parses dates with zero-prefixed values', () => {
    const d = parseDate('20200101');
    expect(d.getFullYear()).toBe(2020);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('throws errors for bad input', () => {
    expect(() => parseDate('')).toThrow();
    expect(() => parseDate('2020011')).toThrow();
    expect(() => parseDate('202001012')).toThrow();
    expect(() => parseDate('2020-01-01')).toThrow();
    expect(() => parseDate('abcdefgh')).toThrow();
  });
});

describe('formatDate', () => {
  it('formats single-digit numbers correctly', () => {
    const date = new Date(2019, 0, 2);
    expect(formatDate(date, '%Y-%m-%d')).toBe('2019-01-02');
    expect(formatDate(date, '%Y%m%d')).toBe('20190102');
    expect(formatDate(date, '%Y%m')).toBe('201901');
  });

  it('formats two-digit numbers correctly', () => {
    const date = new Date(2019, 9, 23);
    expect(formatDate(date, '%Y-%m-%d')).toBe('2019-10-23');
    expect(formatDate(date, '%Y%m%d')).toBe('20191023');
    expect(formatDate(date, '%Y%m')).toBe('201910');
  });

  it('throws errors for invalid format codes', () => {
    expect(() => formatDate(new Date(), '%a')).toThrow();
  });
});

describe('getDayOfWeek', () => {
  it('returns the correct day', () => {
    expect(getDayOfWeek(new Date(2020, 0, 1))).toBe(3); // Wednesday
    expect(getDayOfWeek(new Date(2020, 0, 2))).toBe(4); // Thursday
    expect(getDayOfWeek(new Date(2020, 0, 3))).toBe(5); // Friday
    expect(getDayOfWeek(new Date(2020, 0, 4))).toBe(6); // Saturday
    expect(getDayOfWeek(new Date(2020, 0, 5))).toBe(7); // Sunday
    expect(getDayOfWeek(new Date(2020, 0, 6))).toBe(1); // Monday
    expect(getDayOfWeek(new Date(2020, 0, 7))).toBe(2); // Tuesday
    expect(getDayOfWeek(new Date(2020, 0, 8))).toBe(3); // Wednesday
  });
});
