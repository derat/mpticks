<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div class="mx-3">
    <Alert :text.sync="errorMsg" />

    <!-- Using v-show instead of v-if so the canvas will exist when we try to
         draw into it from mounted(). -->
    <div v-show="ready && haveStats">
      <v-row class="mx-1">
        <v-col cols="12" :sm="smHalfCols" :lg="lgHalfCols">
          <v-data-table
            :headers="dateHeaders"
            :items="dateItems"
            :mobile-breakpoint="NaN"
            dense
            disable-filtering
            disable-pagination
            disable-sort
            hide-default-footer
          />
        </v-col>
        <v-col cols="12" :sm="smHalfCols" :lg="lgHalfCols">
          <canvas id="year-pitches-chart" />
        </v-col>
      </v-row>

      <v-row class="mx-1">
        <v-col cols="12" :lg="lgFullCols">
          <canvas id="year-month-pitches-chart" />
        </v-col>
      </v-row>

      <v-row class="mx-1">
        <v-col cols="12" :sm="smHalfCols" :lg="lgHalfCols">
          <canvas id="month-pitches-chart" />
        </v-col>
        <v-col cols="12" :sm="smHalfCols" :lg="lgHalfCols">
          <canvas id="day-of-week-pitches-chart" />
        </v-col>
      </v-row>

      <v-row class="mx-1">
        <v-col cols="12" :sm="smHalfCols" :lg="lgHalfCols">
          <v-data-table
            :headers="routeTypeHeaders"
            :items="routeTypeItems"
            :mobile-breakpoint="NaN"
            dense
            disable-filtering
            disable-pagination
            disable-sort
            hide-default-footer
          />
        </v-col>
        <v-col cols="12" :sm="smHalfCols" :lg="lgHalfCols">
          <v-data-table
            :headers="topRouteHeaders"
            :items="topRouteItems"
            :mobile-breakpoint="NaN"
            dense
            disable-filtering
            disable-pagination
            disable-sort
            hide-default-footer
          >
            <!-- Override rendering of 'route' values to add a click handler
                 that jumps to the corresponding route in the Ticks view. -->
            <template v-slot:item.route="props">
              <td class="top-route-name" @click="openRoute(props.item.id)">
                {{ props.value }}
              </td>
            </template>
          </v-data-table>
          <div class="total-routes">
            <span class="label">Total Routes:</span> {{ numRoutes }}
          </div>
        </v-col>
      </v-row>

      <v-row class="mx-1">
        <v-col cols="12" :lg="lgFullCols">
          <canvas id="grade-ticks-chart" />
        </v-col>
      </v-row>

      <v-row class="mx-1">
        <v-col cols="12" :sm="smHalfCols" :lg="lgHalfCols">
          <canvas id="pitches-ticks-chart" />
        </v-col>
        <v-col cols="12" :sm="smHalfCols" :lg="lgHalfCols">
          <canvas id="tick-style-ticks-chart" />
        </v-col>
      </v-row>
    </div>
    <NoTicks v-if="ready && !haveStats" class="ma-3" />
    <Spinner v-else-if="!ready" />
  </div>
</template>

<script lang="ts">
import colors from 'vuetify/lib/util/colors';
import { Component, Vue } from 'vue-property-decorator';
import Alert from '@/components/Alert.vue';
import NoTicks from '@/components/NoTicks.vue';
import Spinner from '@/components/Spinner.vue';

import Chart from 'chart.js';

import { countsRef, userRef } from '@/docs';
import { formatDate, parseDate } from '@/dateutil';
import {
  Counts,
  RouteId,
  RouteTypeToString,
  TickStyle,
  TickStyleToString,
  User,
} from '@/models';

enum Trim {
  ALL_ZEROS,
  ZEROS_AT_ENDS,
}

// A set of values to be drawn in a chart.
interface ChartDataSet {
  data: Record<string | number, number>; // keys are passed to |labelFunc|
  units: string;
  color: string;
}

// Information about how a chart should be rendered.
interface ChartConfig {
  id: string; // ID of canvas element
  title: string;
  labels: string[]; // labels for values in the order they'll be shown
  labelFunc: (key: string) => string; // maps |dataSets| keys to |labels|
  dataSets: ChartDataSet[];
  trim?: Trim;
  aspectRatio?: number; // default is 2
}

@Component({ components: { Alert, NoTicks, Spinner } })
export default class Stats extends Vue {
  // Columns for half-width charts at the 'sm' and 'lg' breakpoints.
  readonly smHalfCols = 6;
  readonly lgHalfCols = 4;
  // Columns for full-width charts at the 'lg' breakpoint.
  readonly lgFullCols = 8;
  // Aspect ratio for full-width charts at the 'sm' breakpoint.
  readonly smAspectRatio = 3;

  ready = false;
  haveStats = false;
  errorMsg = '';

  counts: Counts | null = null;
  userDoc: User | null = null;

  readonly dateHeaders = [
    { text: 'Period', value: 'period' },
    { text: 'Pitches', value: 'pitches', align: 'end' },
    { text: 'Ticks', value: 'ticks', align: 'end' },
    { text: 'Days Out', value: 'daysOut', align: 'end' },
  ];
  readonly routeTypeHeaders = [
    { text: 'Type', value: 'routeType' },
    { text: 'Ticks', value: 'ticks', align: 'right' },
    { text: 'Percent', value: 'percent', align: 'right' },
  ];
  readonly topRouteHeaders = [
    { text: 'Route', value: 'route' },
    { text: 'Ticks', value: 'ticks', align: 'right' },
  ];

  charts: Chart[] = [];

  mounted() {
    Promise.all([
      countsRef()
        .get()
        .then(snap => {
          if (snap.exists) {
            this.haveStats = true;
            this.counts = snap.data()! as Counts;
            this.createCharts();
          }
        }),
      userRef()
        .get()
        .then(snap => {
          if (snap.exists) this.userDoc = snap.data()! as User;
        }),
    ])
      .catch(err => {
        this.errorMsg = `Failed to load stats: ${err.message}`;
        throw err;
      })
      .finally(() => {
        this.ready = true;
      });
  }

  beforeDestroy() {
    // Not sure if this is necessary, but I'm doing it to be on the safe side.
    this.charts.forEach(c => c.destroy());
  }

  createCharts() {
    if (!this.counts) return;

    const fullAspectRatio = this.$vuetify.breakpoint.smAndUp
      ? this.smAspectRatio
      : undefined;

    const sortedDates = Object.keys(this.counts.datePitches).sort();
    const endDate = parseDate(sortedDates[sortedDates.length - 1]);

    const yearLabels: string[] = [];
    for (
      let date = parseDate(sortedDates[0]);
      date.getFullYear() <= endDate.getFullYear();
      date.setFullYear(date.getFullYear() + 1)
    ) {
      yearLabels.push(formatDate(date, '%Y'));
    }
    this.addChart({
      id: 'year-pitches-chart',
      title: 'Pitches by Year',
      labels: yearLabels,
      labelFunc: k => k.substring(0, 4),
      dataSets: [
        {
          data: this.counts.datePitches,
          units: 'Pitches',
          color: colors.green.lighten2,
        },
      ],
    });

    const yearMonthLabels: string[] = [];
    for (
      let date = parseDate(sortedDates[0]);
      date.getFullYear() < endDate.getFullYear() ||
      date.getMonth() <= endDate.getMonth();
      date.setMonth(date.getMonth() + 1)
    ) {
      yearMonthLabels.push(formatDate(date, '%Y-%m'));
    }
    this.addChart({
      id: 'year-month-pitches-chart',
      title: 'Pitches by Year and Month',
      labels: yearMonthLabels,
      labelFunc: k => `${k.substring(0, 4)}-${k.substring(4, 6)}`,
      dataSets: [
        {
          data: this.counts.datePitches,
          units: 'Pitches',
          color: colors.blueGrey.base,
        },
      ],
      aspectRatio: fullAspectRatio,
    });

    const monthLabels: string[] = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    this.addChart({
      id: 'month-pitches-chart',
      title: 'Pitches by Month',
      labels: monthLabels,
      labelFunc: k => monthLabels[parseInt(k.substring(4, 6)) - 1],
      dataSets: [
        {
          data: this.counts.datePitches,
          units: 'Pitches',
          color: colors.indigo.lighten2,
        },
      ],
    });

    const dayOfWeekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    this.addChart({
      id: 'day-of-week-pitches-chart',
      title: 'Pitches by Day of Week',
      labels: dayOfWeekLabels,
      labelFunc: k => dayOfWeekLabels[parseInt(k) - 1],
      dataSets: [
        {
          data: this.counts.dayOfWeekPitches,
          units: 'Pitches',
          color: colors.brown.lighten2,
        },
      ],
    });

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
    this.addChart({
      id: 'grade-ticks-chart',
      title: 'Ticks by Grade',
      labels: gradeLabels,
      labelFunc: (key: string) => {
        const m = key.match(/^5\.(\d+)([a-d]?).*/);
        if (!m) return '';

        const minor = m[1];
        const letter = m[2];
        let label = `5.${minor}${letter}`;
        if (minor.length == 2 && !letter) label += 'a';
        return label;
      },
      dataSets: [
        {
          data: this.counts.gradeCleanTicks,
          units: 'Clean ticks',
          color: colors.orange.lighten2,
        },
        {
          data: this.counts.gradeTicks,
          units: 'All ticks',
          color: colors.red.lighten2,
        },
      ],
      trim: Trim.ZEROS_AT_ENDS,
      aspectRatio: fullAspectRatio,
    });

    const pitchesLabels: string[] = Object.keys(this.counts.pitchesTicks).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );
    this.addChart({
      id: 'pitches-ticks-chart',
      title: 'Ticks by Pitches',
      labels: pitchesLabels,
      labelFunc: k => k,
      dataSets: [
        {
          data: this.counts.pitchesTicks,
          units: 'Ticks',
          color: colors.teal.lighten3,
        },
      ],
      trim: Trim.ALL_ZEROS,
    });

    const tickStyleLabels = [
      TickStyle.LEAD,
      TickStyle.LEAD_ONSIGHT,
      TickStyle.LEAD_FLASH,
      TickStyle.LEAD_REDPOINT,
      TickStyle.LEAD_PINKPOINT,
      TickStyle.LEAD_FELL_HUNG,
      TickStyle.FOLLOW,
      TickStyle.TOP_ROPE,
      TickStyle.SOLO,
      TickStyle.SEND,
      TickStyle.FLASH,
      TickStyle.ATTEMPT,
    ].map(v => TickStyleToString(v));
    this.addChart({
      id: 'tick-style-ticks-chart',
      title: 'Ticks by Style',
      labels: tickStyleLabels,
      labelFunc: k => TickStyleToString(parseInt(k)),
      dataSets: [
        {
          data: this.counts.tickStyleTicks,
          units: 'Ticks',
          color: colors.blueGrey.base,
        },
      ],
      trim: Trim.ALL_ZEROS,
    });
  }

  addChart(cfg: ChartConfig) {
    const labels = [...cfg.labels];

    // Aggregate each data set's data into a map from label to value.
    const dataSetLabelValues: Record<string, number>[] = cfg.dataSets.map(
      ds => {
        const values: Record<string, number> = {};
        labels.forEach(l => (values[l] = 0));
        Object.entries(ds.data).forEach(([key, val]) => {
          const label = cfg.labelFunc(key.toString());
          if (label && values.hasOwnProperty(label)) values[label] += val;
        });
        return values;
      }
    );

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

    const canvas = document.getElementById(cfg.id) as HTMLCanvasElement;
    this.charts.push(
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: cfg.dataSets.map((ds, i) => ({
            label: ds.units,
            data: labels.map(label => dataSetLabelValues[i][label]),
            backgroundColor: ds.color,
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
      })
    );
  }

  get dateItems() {
    if (!this.counts) return [];

    type DateFunc = (d: Date) => void;
    const getDate = (f: DateFunc): string => {
      const date = new Date();
      f(date);
      return formatDate(date, '%Y%m%d'); // matches Tick.date format
    };
    const today = getDate(() => {});

    return ([
      ['Last 30 days', getDate(d => d.setDate(d.getDate() - 30))],
      ['Last 90 days', getDate(d => d.setDate(d.getDate() - 90))],
      ['Last year', getDate(d => d.setFullYear(d.getFullYear() - 1))],
      ['Last 5 years', getDate(d => d.setFullYear(d.getFullYear() - 5))],
      ['All time', '00000000'],
    ] as [string, string][]).map(([period, start]) => {
      let pitches = 0;
      let ticks = 0;
      let daysOut = 0;
      Object.keys(this.counts!.dateTicks)
        .filter(date => date > start && date <= today)
        .forEach(date => {
          const ts = this.counts!.dateTicks[date];
          ticks += ts || 0;
          if (ts) daysOut++;
          pitches += this.counts!.datePitches[date] || 0;
        });
      return { period, pitches, ticks, daysOut };
    });
  }

  get numRoutes(): number {
    return this.userDoc ? this.userDoc.numRoutes : 0;
  }

  get routeTypeItems() {
    if (!this.counts) return [];

    const total = Object.values(this.counts.routeTypeTicks).reduce(
      (a, b) => a + b
    );
    return Object.entries(this.counts.routeTypeTicks)
      .sort((a, b) => b[1] - a[1])
      .map(([key, ticks]) => {
        return {
          routeType: RouteTypeToString(parseInt(key)),
          ticks,
          percent: `${((ticks / total) * 100).toFixed(1)}%`,
        };
      });
  }

  get topRouteItems() {
    if (!this.counts) return [];

    return Object.entries(this.counts.routeTicks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, ticks]) => {
        const parts = key.split('|');
        return {
          id: parts[0],
          route: parts.slice(1).join('|'),
          ticks: ticks as number,
        };
      });
  }

  openRoute(routeId: RouteId) {
    this.$router.push({
      name: 'ticks',
      params: { initialRouteId: routeId.toString() },
    });
  }
}
</script>

<style scoped>
.top-route-name {
  cursor: pointer;
}

.total-routes {
  font-size: 14px;
  padding: 16px 0 6px 16px;
}
.total-routes .label {
  color: rgb(0, 0, 0, 0.6);
  font-weight: 700;
}
</style>
