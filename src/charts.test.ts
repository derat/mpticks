// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { makeMonthLabels, makeWeekLabels, makeYearLabels } from '@/charts';

describe('makeYearLabels', () => {
  it('correctly iterates over years', () => {
    expect(
      makeYearLabels(new Date(1996, 5, 20), new Date(2001, 11, 31))
    ).toEqual(['1996', '1997', '1998', '1999', '2000', '2001']);
  });

  it('handles a single year', () => {
    expect(
      makeYearLabels(new Date(2020, 0, 1), new Date(2020, 11, 31))
    ).toEqual(['2020']);
  });

  it('handles out-of-order years', () => {
    expect(makeYearLabels(new Date(2010, 0, 1), new Date(2009, 0, 1))).toEqual(
      []
    );
  });
});

describe('makeMonthLabels', () => {
  it('handles a single month', () => {
    expect(
      makeMonthLabels(new Date(2020, 2, 23), new Date(2020, 2, 26))
    ).toEqual(['2020-03']);
  });

  it('handles ranges within a single year', () => {
    expect(
      makeMonthLabels(new Date(2020, 2, 23), new Date(2020, 6, 2))
    ).toEqual(['2020-03', '2020-04', '2020-05', '2020-06', '2020-07']);
  });

  it('handles ranges across multiple years', () => {
    expect(
      makeMonthLabels(new Date(2015, 10, 4), new Date(2016, 1, 28))
    ).toEqual(['2015-11', '2015-12', '2016-01', '2016-02']);
  });

  it('handles out-of-order months', () => {
    expect(
      makeMonthLabels(new Date(2015, 10, 4), new Date(2014, 4, 28))
    ).toEqual([]);
  });
});

describe('makeWeekLabels', () => {
  it('returns expected labels and map', () => {
    const [labels, dateToLabel] = makeWeekLabels(
      new Date(2019, 11, 21),
      new Date(2020, 0, 1)
    );
    expect(labels).toEqual(['2019-12-19', '2019-12-26']);
    expect(dateToLabel).toEqual({
      20191219: '2019-12-19',
      20191220: '2019-12-19',
      20191221: '2019-12-19',
      20191222: '2019-12-19',
      20191223: '2019-12-19',
      20191224: '2019-12-19',
      20191225: '2019-12-19',
      20191226: '2019-12-26',
      20191227: '2019-12-26',
      20191228: '2019-12-26',
      20191229: '2019-12-26',
      20191230: '2019-12-26',
      20191231: '2019-12-26',
      20200101: '2019-12-26',
    });
  });
});
