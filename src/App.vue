<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-list>
        <v-list-item v-for="item in navItems" :key="item.to" :to="item.to">
          <v-list-item-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{ item.title }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar color="primary" app>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" color="white" />
      <v-toolbar-title class="white--text">{{ $route.name }}</v-toolbar-title>
    </v-app-bar>

    <v-content>
      <router-view />
    </v-content>
  </v-app>
</template>

<script lang="ts">
interface NavItem {
  title: string;
  icon: string;
  to: string;
}

import { Component, Vue } from 'vue-property-decorator';

@Component
export default class App extends Vue {
  readonly navItems: NavItem[] = [
    { title: 'Ticks', icon: 'check_box', to: 'ticks' },
    { title: 'Import', icon: 'import_export', to: 'import' },
  ];

  // Model for navigation drawer.
  drawer: any = null;
  // TODO: Make this change dynamically.
  title = 'Foo';
}
</script>
