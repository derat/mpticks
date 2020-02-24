<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div class="mx-3">
    <Alert :text.sync="errorMsg" />

    <!-- Using v-show instead of v-if so the canvas will exist when we try to
         draw into it from mounted(). -->
    <div v-show="ready && haveStats">
      <v-row>
        <v-col v-bind="halfColProps">
          <v-data-table
            ref="dateTable"
            :headers="dateHeaders"
            :items="dateItems"
            v-bind="dataTableProps"
          />
        </v-col>
        <v-col v-bind="halfColProps">
          <canvas id="year-pitches-chart" />
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="fullColProps">
          <canvas id="year-month-pitches-chart" />
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="fullColProps">
          <canvas id="week-pitches-chart" />
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="halfColProps">
          <canvas id="month-pitches-chart" />
        </v-col>
        <v-col v-bind="halfColProps">
          <canvas id="day-of-week-pitches-chart" />
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="halfColProps">
          <v-data-table
            ref="routeTypeTable"
            :headers="routeTypeHeaders"
            :items="routeTypeItems"
            v-bind="dataTableProps"
          />
        </v-col>
        <v-col v-bind="halfColProps">
          <v-data-table
            ref="topRouteTable"
            :headers="topRouteHeaders"
            :items="topRouteItems"
            v-bind="dataTableProps"
          >
            <!-- Override rendering of 'route' values to add a click handler
                 that jumps to the corresponding route in the Ticks view. -->
            <template v-slot:item.route="props">
              <span class="top-route-name" @click="openRoute(props.item.id)">
                {{ props.value }}
              </span>
            </template>
          </v-data-table>
          <div class="total-routes">
            <span class="label">Total Routes:</span> {{ numRoutes }}
          </div>
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="fullColProps">
          <canvas id="rock-grade-ticks-chart" />
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="fullColProps">
          <canvas id="boulder-grade-ticks-chart" />
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="halfColProps">
          <canvas id="year-month-rock-grade-ticks-chart" />
        </v-col>
        <v-col v-bind="halfColProps">
          <canvas id="new-route-ticks-chart" />
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="halfColProps">
          <v-data-table
            ref="regionTable"
            :headers="regionHeaders"
            :items="regionItems"
            v-bind="dataTableProps"
          />
        </v-col>
        <v-col v-bind="halfColProps">
          <div id="map" />
        </v-col>
      </v-row>

      <v-row>
        <v-col v-bind="halfColProps">
          <canvas id="pitches-ticks-chart" />
        </v-col>
        <v-col v-bind="halfColProps">
          <canvas id="tick-style-ticks-chart" />
        </v-col>
      </v-row>
    </div>
    <NoTicks v-if="ready && !haveStats" class="ma-3" />
    <Spinner v-else-if="!ready" />

    <v-snackbar bottom color="info" :timeout="0" :value="rebuildingCounts">
      Regenerating stats. This may take a while.
    </v-snackbar>
  </div>
</template>

<script lang="ts">
import colors from 'vuetify/lib/util/colors';
import { Component, Vue } from 'vue-property-decorator';
import Alert from '@/components/Alert.vue';
import NoTicks from '@/components/NoTicks.vue';
import Spinner from '@/components/Spinner.vue';

import Chart from 'chart.js';
import loadGoogleMapsApi from 'load-google-maps-api';

import {
  ChartDataSet,
  makeMonthLabels,
  makeWeekLabels,
  makeYearLabels,
  newChart,
  Trim,
} from '@/charts';
import { normalizeVGrade, normalizeYdsGrade } from '@/convert';
import { countsRef, userRef } from '@/docs';
import { formatDate, formatDateString, parseDate } from '@/dateutil';
import {
  Counts,
  countsVersion,
  newCounts,
  Route,
  RouteId,
  RouteTypeToString,
  Tick,
  TickId,
  TickStyle,
  TickStyleToString,
  User,
} from '@/models';
import { addTicksToCounts } from '@/stats';

@Component({ components: { Alert, NoTicks, Spinner } })
export default class Stats extends Vue {
  // Properties for half- and full-screen-width columns.
  readonly halfColProps = { cols: 12, lg: 4, sm: 6 };
  readonly fullColProps = { cols: 12, lg: 8 };

  // Common properties for all v-data-table components.
  readonly dataTableProps = {
    dense: true,
    disableFiltering: true,
    disablePagination: true,
    disableSort: true,
    hideDefaultFooter: true,
    mobileBreakpoint: NaN,
  };

  // Aspect ratio for full-width charts at the 'sm' breakpoint.
  readonly smAspectRatio = 3;

  ready = false;
  haveStats = false;
  errorMsg = '';
  rebuildingCounts = false;

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
  readonly regionHeaders = [
    { text: 'Region', value: 'region' },
    { text: 'Ticks', value: 'ticks', align: 'right' },
  ];

  charts: Chart[] = [];
  map?: google.maps.Map;

  mounted() {
    Promise.all([
      countsRef()
        .get()
        .then(snap => {
          if (!snap.exists) return Promise.resolve(null);
          const counts = snap.data()! as Counts;
          return this.needToRebuildCounts(counts)
            ? this.rebuildCounts()
            : counts;
        })
        .then(counts => {
          if (counts) {
            this.haveStats = true;
            this.counts = counts;
            this.createCharts();
            this.createMap();
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
    if (!this.counts || !this.counts.datePitches) return;

    const fullAspectRatio = this.$vuetify.breakpoint.smAndUp
      ? this.smAspectRatio
      : undefined;

    const sortedDates = Object.keys(this.counts.datePitches).sort();
    if (!sortedDates.length) return; // deleted all ticks?
    const startDate = parseDate(sortedDates[0]);
    const now = new Date(Date.now()); // tests mock Date.now()

    // Gets the date corresponding to |numWeeks| before |now|.
    // If |startDate| is later than that date, returns |startDate| instead.
    const getWeekStart = (numWeeks: number): Date => {
      const d = new Date(now.getTime());
      d.setDate(d.getDate() - numWeeks * 7 + 1);
      return d > startDate ? d : startDate;
    };

    this.charts.push(
      newChart({
        id: 'year-pitches-chart',
        title: 'Yearly Pitches',
        labels: makeYearLabels(startDate, now),
        labelFunc: k => formatDateString(k, '%Y'),
        dataSets: [
          {
            data: this.counts.datePitches,
            units: 'Pitches',
            color: colors.green.lighten2,
          },
        ],
      })
    );

    this.charts.push(
      newChart({
        id: 'year-month-pitches-chart',
        title: 'Monthly Pitches',
        // Limit to 4 years of history to keep it readable.
        labels: makeMonthLabels(startDate, now).slice(-48),
        labelFunc: k => formatDateString(k, '%Y-%m'),
        dataSets: [
          {
            data: this.counts.datePitches,
            units: 'Pitches',
            color: colors.blueGrey.base,
          },
        ],
        aspectRatio: fullAspectRatio,
      })
    );

    const [weeklyLabels, weeklyDateToLabel] = makeWeekLabels(
      getWeekStart(26),
      now
    );
    this.charts.push(
      newChart({
        id: 'week-pitches-chart',
        title: 'Weekly Pitches',
        labels: weeklyLabels,
        labelFunc: k => weeklyDateToLabel[k],
        dataSets: [
          {
            data: this.counts.datePitches,
            units: 'Pitches',
            color: colors.blue.lighten3,
          },
        ],
        aspectRatio: fullAspectRatio,
      })
    );

    const monthLabels = [
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
    this.charts.push(
      newChart({
        id: 'month-pitches-chart',
        title: 'Pitches by Month',
        labels: monthLabels,
        labelFunc: k => monthLabels[parseInt(formatDateString(k, '%m')) - 1],
        dataSets: [
          {
            data: this.counts.datePitches,
            units: 'Pitches',
            color: colors.indigo.lighten2,
          },
        ],
      })
    );

    const dayOfWeekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    this.charts.push(
      newChart({
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
      })
    );

    // Future-proof grade range.
    const rockGradeLabels: string[] = [];
    for (let i = 0; i <= 16; i++) {
      if (i < 10) {
        rockGradeLabels.push(`5.${i}`);
      } else {
        ['a', 'b', 'c', 'd'].forEach(ch => {
          rockGradeLabels.push(`5.${i}${ch}`);
        });
      }
    }
    this.charts.push(
      newChart({
        id: 'rock-grade-ticks-chart',
        title: 'Rock Ticks by Grade',
        labels: rockGradeLabels,
        labelFunc: key => normalizeYdsGrade(key),
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
      })
    );

    // Future-proof grade range.
    const boulderGradeLabels = ['VB'];
    for (let i = 0; i <= 20; i++) boulderGradeLabels.push(`V${i}`);
    this.charts.push(
      newChart({
        id: 'boulder-grade-ticks-chart',
        title: 'Boulder Ticks by Grade',
        labels: boulderGradeLabels,
        labelFunc: key => normalizeVGrade(key),
        dataSets: [
          {
            data: this.counts.gradeCleanTicks,
            units: 'Clean ticks',
            color: colors.yellow.lighten2,
          },
          {
            data: this.counts.gradeTicks,
            units: 'All ticks',
            color: colors.green.lighten2,
          },
        ],
        trim: Trim.ZEROS_AT_ENDS,
        aspectRatio: fullAspectRatio,
      })
    );

    const monthGradeDataSets: ChartDataSet[] = [];
    ([
      ['≤ 5.7 Ticks', /^5\.[0-7]($|[^0-9])/, colors.purple.base],
      ['5.8 Ticks', /^5\.8/, colors.indigo.base],
      ['5.9 Ticks', /^5\.9/, colors.blue.base],
      ['5.10 Ticks', /^5\.10/, colors.green.base],
      ['5.11 Ticks', /^5\.11/, colors.lime.darken1],
      ['5.12 Ticks', /^5\.12/, colors.amber.base],
      ['5.13 Ticks', /^5\.13/, colors.orange.base],
      ['5.14 Ticks', /^5\.14/, colors.red.base],
      ['≥ 5.15 Ticks', /^5\.1[5-9]/, colors.pink.base],
    ] as [string, RegExp, string][]).forEach(([units, re, color]) => {
      const data: Record<string, number> = Object.keys(
        this.counts!.monthGradeTicks
      )
        .filter(k => k.slice(7).match(re))
        .reduce((m: Record<string, number>, k: string) => {
          const yearMonth = `${k.slice(0, 4)}-${k.slice(4, 6)}`;
          m[yearMonth] = (m[yearMonth] || 0) + this.counts!.monthGradeTicks[k];
          return m;
        }, {});
      if (Object.values(data).find(v => v > 0)) {
        monthGradeDataSets.push({ data, units, color });
      }
    });
    this.charts.push(
      // TODO: Show legend?
      newChart({
        id: 'year-month-rock-grade-ticks-chart',
        title: 'Monthly Rock Ticks by Grade',
        labels: makeMonthLabels(startDate, now).slice(-12),
        labelFunc: k => k,
        dataSets: monthGradeDataSets,
        line: true,
      })
    );

    const [newRoutesLabels, newRoutesDateToLabel] = makeWeekLabels(
      getWeekStart(12),
      now
    );
    this.charts.push(
      newChart({
        id: 'new-route-ticks-chart',
        title: 'Weekly New Routes',
        labels: newRoutesLabels,
        labelFunc: k => newRoutesDateToLabel[k],
        dataSets: [
          {
            data: this.counts.dateFirstTicks,
            units: 'Ticks',
            color: colors.indigo.lighten2,
          },
        ],
      })
    );

    const sortedPitches = Object.keys(this.counts.pitchesTicks)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(s => parseInt(s));
    const pitchesLabels = [
      ...Array(sortedPitches[sortedPitches.length - 1]).keys(),
    ].map(i => (i + 1).toString());
    this.charts.push(
      newChart({
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
        trim: Trim.ZEROS_AT_ENDS,
      })
    );

    const tickStyleLabels = [
      TickStyle.SOLO,
      TickStyle.LEAD_ONSIGHT,
      TickStyle.LEAD_FLASH,
      TickStyle.LEAD_REDPOINT,
      TickStyle.LEAD_PINKPOINT,
      TickStyle.LEAD,
      TickStyle.LEAD_FELL_HUNG,
      TickStyle.FOLLOW,
      TickStyle.TOP_ROPE,
      TickStyle.FLASH,
      TickStyle.SEND,
      TickStyle.ATTEMPT,
    ].map(v => TickStyleToString(v));
    this.charts.push(
      newChart({
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
      })
    );
  }

  createMap() {
    if (!this.counts) return;

    loadGoogleMapsApi({
      key: process.env.VUE_APP_GOOGLE_MAPS_API_KEY,
      libraries: ['visualization'],
    }).then(googleMaps => {
      let maxTicks = 1;
      const bounds = new googleMaps.LatLngBounds();

      // https://developers.google.com/maps/documentation/javascript/heatmaplayer
      const data = Object.entries(this.counts!.latLongTicks).map(
        ([key, tickCount]) => {
          const p = key.split(',').map(s => parseFloat(s));
          const latLng = new googleMaps.LatLng(p[0], p[1]);
          bounds.extend(latLng);
          maxTicks = Math.max(maxTicks, tickCount);
          return { location: latLng, weight: tickCount };
        }
      );
      const heatmap = new googleMaps.visualization.HeatmapLayer({
        data,
        gradient: [
          'rgba(183, 28, 28, 0)', // red darken-4
          colors.red.darken4,
          colors.orange.darken2,
          colors.orange.base,
          colors.orange.lighten2,
          colors.yellow.base,
        ],
        maxIntensity: Math.min(maxTicks, 20),
        opacity: 1,
        radius: 10,
      });

      this.map = new googleMaps.Map(document.getElementById('map')!, {
        center: bounds.getCenter(),
        controlSize: 24,
        mapTypeControl: false,
        mapTypeId: 'terrain',
        scaleControl: false,
        streetViewControl: false,
        zoom: 1,
        zoomControl: true,
      });

      heatmap.setMap(this.map);
    });
  }

  get dateItems() {
    if (!this.counts) return [];

    type DateFunc = (d: Date) => void;
    const getDate = (f: DateFunc): string => {
      const date = new Date(Date.now()); // tests mock Date.now()
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
      (a, b) => a + b,
      0
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
    return this.counts
      ? Object.entries(this.counts.routeTicks)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([key, ticks]) => {
            const parts = key.split('|');
            return {
              id: parts[0],
              route: parts.slice(1).join('|'),
              ticks: ticks as number,
            };
          })
      : [];
  }

  get regionItems() {
    return this.counts
      ? Object.entries(this.counts.regionTicks)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([region, ticks]) => ({ region, ticks }))
      : [];
  }

  // Navigates to the Ticks view with |routeId| initially open.
  openRoute(routeId: RouteId) {
    this.$router.push({
      name: 'ticks',
      params: { initialRouteId: routeId.toString() },
    });
  }

  // Returns true if |counts| is stale and needs to be rebuilt.
  needToRebuildCounts(counts: Counts) {
    return (
      typeof counts.version === 'undefined' || counts.version < countsVersion
    );
  }

  // Loads all routes (read: expensive) and returns a promise for a regenerated
  // Counts object incorporating all ticks. The UI is updated to display a
  // message while stats are being updated.
  rebuildCounts(): Promise<Counts> {
    this.rebuildingCounts = true;

    const counts = newCounts();
    return userRef()
      .collection('routes')
      .get()
      .then(snapshot => {
        const routeTicks = new Map<RouteId, Map<TickId, Tick>>();
        const routes = new Map<RouteId, Route>();
        snapshot.docs.forEach(doc => {
          const routeId = parseInt(doc.id);
          const route = doc.data() as Route;
          routes.set(routeId, route);
          routeTicks.set(
            routeId,
            new Map(
              Object.entries(route.ticks).map(([tickId, tick]) => [
                parseInt(tickId),
                tick as Tick,
              ])
            )
          );
        });
        addTicksToCounts(counts, routeTicks, routes);
      })
      .then(() => countsRef().set(counts))
      .then(() => counts)
      .finally(() => {
        this.rebuildingCounts = false;
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

#map {
  width: 100%;
  height: 250px;
}
</style>
