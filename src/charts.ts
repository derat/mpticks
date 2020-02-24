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
  line?: boolean;
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
    type: cfg.line ? 'line' : 'bar',
    data: {
      labels,
      datasets: cfg.dataSets.map((ds, i) => ({
        label: ds.units,
        data: labels.map(label => dataSetLabelValues[i][label]),
        backgroundColor: ds.color,
        // Avoid letting bars get super-wide if someone has e.g. only
        // climbed one or two grades.
        maxBarThickness: 60,
        // These are specific to line charts.
        borderColor: ds.color,
        borderWidth: 1,
        fill: !cfg.line,
        pointRadius: 1.5,
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

// Returns labels of the form 'YYYY' for years between |start| and |end|.
export function makeYearLabels(start: Date, end: Date): string[] {
  const labels: string[] = [];
  for (
    let date = new Date(start.getTime()); // avoid mutating |start|
    date.getFullYear() <= end.getFullYear();
    date.setFullYear(date.getFullYear() + 1)
  ) {
    labels.push(formatDate(date, '%Y'));
  }
  return labels;
}

// Returns labels of the form 'YYYY-MM' for months between |start| and |end|.
export function makeMonthLabels(start: Date, end: Date): string[] {
  const labels: string[] = [];
  for (
    let date = new Date(start.getTime()); // avoid mutating |start|
    date.getFullYear() < end.getFullYear() ||
    (date.getFullYear() == end.getFullYear() &&
      date.getMonth() <= end.getMonth());
    date.setMonth(date.getMonth() + 1)
  ) {
    labels.push(formatDate(date, '%Y-%m'));
  }
  return labels;
}

// Returns 'YYYY-MM-DD' labels at weekly intervals between |start| and |end|,
// along with a map from 'YYYYMMDD' dates to week label.
//
// The final label will be the first day in the seven-day period ending at
// |end|. For example, if |end| is 2020-01-20, then the final label will be
// '2020-01-14', and '20200114' through '20200120' will be mapped to
// '2020-01-14'. The first label will be first day in the seven-day period that
// includes |start|.
export function makeWeekLabels(
  start: Date,
  end: Date
): [string[], Record<string, string>] {
  const labels: string[] = [];
  const dateToLabel: Record<string, string> = {}; // 'YYYYMMDD' keys

  const d = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  d.setDate(d.getDate() - 6);
  while (d > start) d.setDate(d.getDate() - 7);

  for (let i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
    if (i % 7 == 0) labels.push(formatDate(d, '%Y-%m-%d'));
    dateToLabel[formatDate(d, '%Y%m%d')] = labels[labels.length - 1];
  }

  return [labels, dateToLabel];
}
