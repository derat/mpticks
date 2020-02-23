// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import Chart from 'chart.js';
import { formatDate } from '@/dateutil';

// A set of values to be drawn in a chart.
export interface ChartDataSet {
  data: Record<string | number, number>; // keys are passed to |labelFunc|
  units: string;
  color: string;
}

// How zero values should be treated by newChart().
export enum Trim {
  ALL_ZEROS,
  ZEROS_AT_ENDS,
}

// Information about how a chart should be rendered.
export interface ChartConfig {
  id: string; // ID of canvas element
  title: string;
  labels: string[]; // labels for values in the order they'll be shown
  labelFunc: (key: string) => string; // maps |dataSets| keys to |labels|
  dataSets: ChartDataSet[];
  trim?: Trim;
  aspectRatio?: number; // default is 2
}

// Creates a Chart object as described by |cfg| and appends it to
// |this.charts|.
export function newChart(cfg: ChartConfig) {
  const labels = [...cfg.labels];

  // Aggregate each data set's data into a map from label to value.
  const dataSetLabelValues: Record<string, number>[] = cfg.dataSets.map(ds => {
    const values: Record<string, number> = {};
    labels.forEach(l => (values[l] = 0));
    Object.entries(ds.data).forEach(([key, val]) => {
      const label = cfg.labelFunc(key.toString());
      if (label && values.hasOwnProperty(label)) values[label] += val;
    });
    return values;
  });

  // Returns true if any data sets have nonzero values for |label|.
  const labelHasValue = (label: string) =>
    dataSetLabelValues.map(lv => lv[label]).find(v => !!v);

  // Drop zero-valued labels if requested.
  if (cfg.trim == Trim.ZEROS_AT_ENDS) {
    while (labels.length && !labelHasValue(labels[0])) labels.shift();
    while (labels.length && !labelHasValue(labels[labels.length - 1])) {
      labels.pop();
    }
  } else if (cfg.trim == Trim.ALL_ZEROS) {
    let i = labels.length;
    while (i--) {
      if (!labelHasValue(labels[i])) labels.splice(i, 1);
    }
  }

  // We don't test that this is defined since it's missing during unit tests,
  // presumably because jsdom doesn't support <canvas>. I briefly tried
  // various packages for adding canvas support but couldn't get them to work.
  const canvas = document.getElementById(cfg.id) as HTMLCanvasElement;
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: cfg.dataSets.map((ds, i) => ({
        label: ds.units,
        data: labels.map(label => dataSetLabelValues[i][label]),
        backgroundColor: ds.color,
        // Avoid letting bars get super-wide if someone has e.g. only
        // climbed one or two grades.
        maxBarThickness: 60,
      })),
    },
    options: {
      aspectRatio: cfg.aspectRatio || 2,
      legend: { display: false },
      title: {
        display: true,
        text: cfg.title,
      },
      scales: {
        xAxes: [
          {
            gridLines: { drawOnChartArea: false },
            stacked: true,
          },
        ],
        yAxes: [
          {
            stacked: false,
            ticks: { beginAtZero: true, maxTicksLimit: 8 },
          },
        ],
      },
    },
  });
}

// Returns 'YYYY-MM-DD' labels for |numWeeks| preceding today, along with a map
// from 'YYYYMMDD' dates to week label.
export function makeWeekLabels(
  numWeeks: number
): [string[], Record<string, string>] {
  const labels: string[] = [];
  const dateToLabel: Record<string, string> = {}; // 'YYYYMMDD' keys

  // If today is 2020-01-20, then we'll want labels for '2020-01-14',
  // '2020-01-07', etc. '20200114' through '20200120' should be mapped to
  // '2020-01-14', '20200101' through '20200107' to '2020-01-07', and so on.
  const d = new Date(Date.now()); // tests mock Date.now()
  d.setDate(d.getDate() - numWeeks * 7);
  for (let i = 0; i < numWeeks * 7; i++) {
    d.setDate(d.getDate() + 1);
    if (i % 7 == 0) labels.push(formatDate(d, '%Y-%m-%d'));
    dateToLabel[formatDate(d, '%Y%m%d')] = labels[labels.length - 1];
  }

  return [labels, dateToLabel];
}
