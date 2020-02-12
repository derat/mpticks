<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-list>
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :to="item.to ? item.to : ''"
          v-on="item.method ? { click: item.method } : null"
        >
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
      <v-toolbar-title class="white--text">{{
        $route.meta.title
      }}</v-toolbar-title>
    </v-app-bar>

    <v-content>
      <router-view />
    </v-content>
  </v-app>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import firebase from '@/firebase';
import { routes, When } from '@/router';

interface NavItem {
  title: string;
  icon: string;
  to?: string;
  method?: () => void;
  when?: When;
}

@Component
export default class App extends Vue {
  // Model for navigation drawer.
  drawer: any = null;

  navItems: NavItem[] = [];

  mounted() {
    firebase.auth().onAuthStateChanged(() => {
      this.updateNavItems();
    });
  }

  updateNavItems() {
    const loggedIn = !!firebase.auth().currentUser;
    this.navItems = [
      { title: 'Log in', icon: 'account_circle', to: 'login' },
      { title: 'Ticks', icon: 'check', to: 'ticks' },
      { title: 'Stats', icon: 'assessment', to: 'stats' },
      { title: 'Import', icon: 'import_export', to: 'import' },
      { title: 'About', icon: 'info', to: 'about' },
      {
        title: 'Log out',
        icon: 'exit_to_app',
        method: this.logOut,
        when: When.LOGGED_IN,
      },
    ].filter(item => {
      const route = routes.find(r => r.name == item.to);
      const when = route && route.meta ? route.meta.when : item.when;
      return (
        !(when == When.LOGGED_IN && !loggedIn) &&
        !(when == When.LOGGED_OUT && loggedIn)
      );
    });
  }

  logOut() {
    firebase
      .auth()
      .signOut()
      .then(() => {
        this.$router.replace('login');
      });
  }
}
</script>
