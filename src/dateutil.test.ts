// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  formatDate,
  formatDateString,
  getDayOfWeek,
  parseDate,
} from './dateutil';

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

  it('parses dates with maximal values', () => {
    const d = parseDate('99991231');
    expect(d.getFullYear()).toBe(9999);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });

  it('throws errors for bad input', () => {
    expect(() => parseDate('')).toThrow();
    expect(() => parseDate('2020011')).toThrow();
    expect(() => parseDate('202001012')).toThrow();
    expect(() => parseDate('2020-01-01')).toThrow();
    expect(() => parseDate('20200001')).toThrow();
    expect(() => parseDate('20201301')).toThrow();
    expect(() => parseDate('20209901')).toThrow();
    expect(() => parseDate('20200100')).toThrow();
    expect(() => parseDate('20200132')).toThrow();
    expect(() => parseDate('20200199')).toThrow();
    expect(() => parseDate('abcdefgh')).toThrow();
  });
});

describe('formatDate', () => {
  it('formats single-digit numbers correctly', () => {
    const date = new Date(2019, 0, 2);
    expect(formatDate(date, '%Y-%m-%d')).toBe('2019-01-02');
    expect(formatDate(date, '%Y%m%d')).toBe('20190102');
    expect(formatDate(date, '%Y%m')).toBe('201901');
    expect(formatDate(date, '%Y')).toBe('2019');
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

describe('formatDateString', () => {
  it('formats single-digit numbers correctly', () => {
    expect(formatDateString('20190102', '%Y-%m-%d')).toBe('2019-01-02');
    expect(formatDateString('20190102', '%Y%m%d')).toBe('20190102');
    expect(formatDateString('20190102', '%Y%m')).toBe('201901');
    expect(formatDateString('20190102', '%Y')).toBe('2019');
  });

  it('accepts minimal and maximal values', () => {
    expect(formatDateString('00000101', '%Y-%m-%d')).toBe('0000-01-01');
    expect(formatDateString('99991231', '%Y-%m-%d')).toBe('9999-12-31');
  });

  it('throws errors for invalid format codes', () => {
    expect(() => formatDateString('20200101', '%a')).toThrow();
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
