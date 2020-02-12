<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-list>
        <template v-for="(item, index) in navItems">
          <v-divider
            v-if="item.type == NavItemType.DIVIDER"
            :key="`divider-${index}`"
            class="my-2"
          />
          <v-list-item
            v-else-if="item.type == NavItemType.ITEM"
            :key="item.text"
            :to="item.to ? item.to : ''"
            v-on="item.method ? { click: item.method } : null"
          >
            <v-list-item-action>
              <v-icon>{{ item.icon }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ item.text }}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </template>
      </v-list>
      <template v-slot:append>
        <div class="build mb-2 ml-2">{{ `Build ${buildInfo}` }}</div>
      </template>
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

enum NavItemType {
  // A clickable item with text and an icon.
  ITEM,
  // A horizontal line.
  DIVIDER,
}

// An entry in the navigation drawer.
interface NavItem {
  // Type of item to display.
  type: NavItemType;
  // Text to display. Only set for ITEM.
  text?: string;
  // Material icon name to use. Only set for ITEM.
  icon?: string;
  // vue-router route name to navigate to when clicked. Optionally set for ITEM.
  to?: string;
  // Method on App component to invoke when clicked. Optionally set for ITEM.
  method?: () => void;
  // When the item should be displayed.
  when?: When;
}

@Component
export default class App extends Vue {
  drawer: any = null; // model for navigation drawer
  NavItemType = NavItemType; // hoist for template
  navItems: NavItem[] = []; // items to display in drawer

  mounted() {
    firebase.auth().onAuthStateChanged(() => {
      this.updateNavItems();
    });
  }

  updateNavItems() {
    const loggedIn = !!firebase.auth().currentUser;
    this.navItems = [
      {
        type: NavItemType.ITEM,
        text: 'Log in',
        icon: 'account_circle',
        to: 'login',
      },
      { type: NavItemType.ITEM, text: 'Ticks', icon: 'check', to: 'ticks' },
      {
        type: NavItemType.ITEM,
        text: 'Stats',
        icon: 'assessment',
        to: 'stats',
      },
      {
        type: NavItemType.ITEM,
        text: 'Import',
        icon: 'import_export',
        to: 'import',
      },
      { type: NavItemType.ITEM, text: 'About', icon: 'info', to: 'about' },
      { type: NavItemType.DIVIDER },
      {
        type: NavItemType.ITEM,
        text: 'Log out',
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

  get buildInfo(): string {
    const timestamp = document.documentElement.dataset.buildTime || '';
    const commit = document.documentElement.dataset.buildCommit || '';
    return `${timestamp}-${commit.slice(0, 8)}`;
  }
}
</script>

<style scoped>
.build {
  color: #aaa;
  font-size: 11px;
  padding-left: 2px;
}
</style>
