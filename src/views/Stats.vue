<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div>
    <!-- Using v-show instead of v-if so the canvas will exist when we try to draw
       into it from mounted(). -->
    <div v-show="ready">
      <v-row>
        <v-col class="ma-3">
          <div v-for="item in dateCounts" :key="item.label">
            {{ item.label }}:
            <span v-for="(count, i) in item.counts" :key="i">
              {{ count }}
            </span>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <v-col class="ma-3">
          <div v-for="(item, i) in topRoutes" :key="i">
            {{ item.label }}: {{ item.count }}
          </div>
        </v-col>
      </v-row>

      <v-row>
        <v-col class="ma-3"> </v-col>
      </v-row>

      <v-row>
        <v-col class="ma-3">
          <canvas id="month-chart" />
        </v-col>
      </v-row>
      <v-row>
        <v-col class="ma-3">
          <canvas id="day-of-week-chart" />
        </v-col>
      </v-row>
      <v-row>
        <v-col class="ma-3">
          <canvas id="grade-chart" />
        </v-col>
      </v-row>
      <v-row>
        <v-col class="ma-3">
          <canvas id="route-type-chart" />
        </v-col>
      </v-row>
    </div>
    <Spinner v-if="!ready" />
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Chart from 'chart.js';
import { tickCountsRef, userRef } from '@/docs';
import { formatDate, parseDate } from '@/dateutil';
import { TickCounts, User } from '@/models';
import Spinner from '@/components/Spinner.vue';

enum Trim {
  NONE,
  ALL_ZEROS,
  ZEROS_AT_ENDS,
}

interface CountItem {
  label: string;
  counts: number[];
}

@Component({ components: { Spinner } })
export default class Stats extends Vue {
  ready = false;

  tickCounts: TickCounts | null = null;
  userDoc: User | null = null;

  mounted() {
    Promise.all([
      tickCountsRef()
        .get()
        .then(snap => {
          if (snap.exists) {
            this.tickCounts = snap.data()! as TickCounts;
            this.drawCharts();
          }
        }),
      userRef()
        .get()
        .then(snap => {
          if (snap.exists) this.userDoc = snap.data()! as User;
        }),
    ]).then(() => {
      this.ready = true;
    });
  }

  drawCharts() {
    if (!this.tickCounts) return;

    const sortedDates = Object.keys(this.tickCounts.dates).sort();
    const endDate = parseDate(sortedDates[sortedDates.length - 1]);
    const monthLabels: string[] = [];
    for (
      let date = parseDate(sortedDates[0]);
      date.getFullYear() < endDate.getFullYear() ||
      date.getMonth() <= endDate.getMonth();
      date.setMonth(date.getMonth() + 1)
    ) {
      monthLabels.push(formatDate(date, '%Y-%m'));
    }
    this.drawChart(
      'month-chart',
      monthLabels,
      (key: string) => `${key.substring(0, 4)}-${key.substring(4, 6)}`,
      this.tickCounts.dates,
      Trim.NONE
    );

    const dayOfWeekLabels = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    this.drawChart(
      'day-of-week-chart',
      dayOfWeekLabels,
      (key: string) => dayOfWeekLabels[parseInt(key) - 1],
      this.tickCounts.daysOfWeek,
      Trim.NONE
    );

    const gradeLabels: string[] = [];
    for (let i = 0; i <= 15; i++) {
      if (i < 10) {
        gradeLabels.push(`5.${i}`);
      } else {
        ['a', 'b', 'c', 'd'].forEach(ch => {
          gradeLabels.push(`5.${i}${ch}`);
        });
      }
    }
    this.drawChart(
      'grade-chart',
      gradeLabels,
      (key: string) => {
        const m = key.match(/^5\.(\d+)([a-d]?).*/);
        if (!m) return '';

        const minor = m[1];
        const letter = m[2];
        let label = `5.${minor}${letter}`;
        if (minor.length == 2 && !letter) label += 'a';
        return label;
      },
      this.tickCounts.grades,
      Trim.ZEROS_AT_ENDS
    );

    // Order needs to match the RouteType enum.
    const routeTypeLabels = [
      'Other',
      'Sport',
      'Trad',
      'Boulder',
      'Ice',
      'Alpine',
      'Mixed',
      'Snow',
      'Aid',
      'Top-rope',
    ];
    this.drawChart(
      'route-type-chart',
      routeTypeLabels,
      (key: string) => routeTypeLabels[parseInt(key)],
      this.tickCounts.routeTypes,
      Trim.ALL_ZEROS
    );
  }

  drawChart(
    id: string,
    labels: string[],
    labelFunc: (key: string) => string,
    counts: Record<string | number, number>,
    trim: Trim = Trim.NONE
  ) {
    const values: Record<string, number> = {};
    labels.forEach(label => (values[label] = 0));

    Object.entries(counts).forEach(([key, count]) => {
      const label = labelFunc(key.toString());
      if (label) values[label] += count;
    });

    if (trim == Trim.ZEROS_AT_ENDS) {
      while (labels.length && !values[labels[0]]) labels.shift();
      while (labels.length && !values[labels[labels.length - 1]]) labels.pop();
    } else if (trim == Trim.ALL_ZEROS) {
      let i = labels.length;
      while (i--) {
        if (values[labels[i]] == 0) labels.splice(i, 1);
      }
    }

    const data: number[] = labels.map(l => values[l]);

    const canvas = document.getElementById(id) as HTMLCanvasElement;
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Ticks', data }],
      },
      options: {
        scales: {
          xAxes: [{ gridLines: { drawOnChartArea: false } }],
          yAxes: [{ ticks: { beginAtZero: true } }],
        },
      },
    });
  }

  get dateCounts(): CountItem[] {
    if (!this.tickCounts) return [];

    type DateFunc = (d: Date) => void;
    const getDate = (f: DateFunc): string => {
      const date = new Date();
      f(date);
      return formatDate(date, '%Y%m%d'); // matches Tick.date format
    };
    const today = getDate(() => {});

    return ([
      ['All time', '00000000'],
      ['Last 5 years', getDate(d => d.setFullYear(d.getFullYear() - 5))],
      ['Last year', getDate(d => d.setFullYear(d.getFullYear() - 1))],
      ['Last 90 days', getDate(d => d.setDate(d.getDate() - 90))],
      ['Last 30 days', getDate(d => d.setDate(d.getDate() - 30))],
    ] as [string, string][]).map(([label, start]) => {
      let ticks = 0;
      let daysOut = 0;
      Object.keys(this.tickCounts!.dates)
        .filter(date => date > start && date <= today)
        .forEach(date => {
          const num = this.tickCounts!.dates[date];
          ticks += num;
          if (num) daysOut++;
        });
      return { label, counts: [ticks, daysOut] };
    });
  }

  get numRoutes(): number {
    return this.userDoc ? this.userDoc.numRoutes : 0;
  }

  get topRoutes(): CountItem[] {
    if (!this.tickCounts) return [];

    return Object.entries(this.tickCounts.topRoutes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => {
        const parts = key.split('|');
        return { label: parts.slice(1).join('|'), count: count as number };
      });
  }
}
</script>
