// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { makeWeekLabels } from '@/charts';

describe('makeWeekLabels', () => {
  it('returns expected labels and map', () => {
    const mockTime = new Date(2020, 0, 1).getTime();
    const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => mockTime);
    const [labels, dateToLabel] = makeWeekLabels(2);
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
