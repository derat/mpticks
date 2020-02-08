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
          <div>All time: {{ ticksTotal }}</div>
          <div>Last 5 years: {{ ticks5Years }}</div>
          <div>Last year: {{ ticksYear }}</div>
          <div>Last 90 days: {{ ticks90Days }}</div>
          <div>Last 30 days: {{ ticks30Days }}</div>
        </v-col>
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
import { tickCountsRef } from '@/docs';
import { formatDate, parseDate } from '@/dateutil';
import { TickCounts } from '@/models';
import Spinner from '@/components/Spinner.vue';

enum Trim {
  NONE,
  ALL_ZEROS,
  ZEROS_AT_ENDS,
}

@Component({ components: { Spinner } })
export default class Stats extends Vue {
  ready = false;

  ticksTotal = 0;
  ticks5Years = 0;
  ticksYear = 0;
  ticks90Days = 0;
  ticks30Days = 0;

  mounted() {
    tickCountsRef()
      .get()
      .then(snap => {
        this.ready = true;
        if (snap.exists) {
          const counts: TickCounts = snap.data()! as TickCounts;
          this.updateCounts(counts);
          this.drawCharts(counts);
        }
      });
  }

  drawCharts(counts: TickCounts) {
    const sortedDates = Object.keys(counts.dates).sort();
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
      counts.dates,
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
      counts.daysOfWeek,
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
      counts.grades,
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
      counts.routeTypes,
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

  updateCounts(counts: TickCounts) {
    type DateFunc = (d: Date) => void;
    const getDate = (f: DateFunc): string => {
      const date = new Date();
      f(date);
      return formatDate(date, '%Y%m%d'); // matches Tick.date format
    };

    const dateToday = getDate((d: Date) => {});
    const date5Years = getDate((d: Date) => {
      d.setFullYear(d.getFullYear() - 5);
    });
    const dateYear = getDate((d: Date) => {
      d.setFullYear(d.getFullYear() - 1);
    });
    const date90Days = getDate((d: Date) => {
      d.setDate(d.getDate() - 90);
    });
    const date30Days = getDate((d: Date) => {
      d.setDate(d.getDate() - 30);
    });

    this.ticksTotal = 0;
    this.ticks5Years = 0;
    this.ticksYear = 0;
    this.ticks90Days = 0;
    this.ticks30Days = 0;

    Object.keys(counts.dates).forEach(date => {
      const count = counts.dates[date];
      this.ticksTotal += count;

      if (date > dateToday) return;
      if (date <= date5Years) return;
      this.ticks5Years += count;
      if (date <= dateYear) return;
      this.ticksYear += count;
      if (date <= date90Days) return;
      this.ticks90Days += count;
      if (date <= date30Days) return;
      this.ticks30Days += count;
    });
  }
}
</script>
