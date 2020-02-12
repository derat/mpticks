// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import VueRouter from 'vue-router';
import firebase from '@/firebase';

import About from '@/views/About.vue';
import Export from '@/views/Export.vue';
import Import from '@/views/Import.vue';
import Login from '@/views/Login.vue';
import Stats from '@/views/Stats.vue';
import Ticks from '@/views/Ticks.vue';

export enum When {
  ALWAYS,
  LOGGED_IN,
  LOGGED_OUT,
}

export const routes = [
  {
    name: 'login',
    path: '/login',
    component: Login,
    meta: { title: 'mpticks', when: When.LOGGED_OUT },
  },
  {
    name: 'ticks',
    path: '/ticks',
    component: Ticks,
    meta: { title: 'Ticks', when: When.LOGGED_IN },
  },
  {
    name: 'stats',
    path: '/stats',
    component: Stats,
    meta: { title: 'Stats', when: When.LOGGED_IN },
  },
  {
    name: 'import',
    path: '/import',
    component: Import,
    meta: { title: 'Import', when: When.LOGGED_IN },
  },
  {
    name: 'export',
    path: '/export',
    component: Export,
    meta: { title: 'Export', when: When.LOGGED_IN },
  },
  {
    name: 'about',
    path: '/about',
    component: About,
    meta: { title: 'About', when: When.LOGGED_IN },
  },
  {
    path: '*',
    redirect: '/login',
  },
];

export const router = new VueRouter({ mode: 'history', routes });

router.beforeEach((to, from, next) => {
  const loggedIn = !!firebase.auth().currentUser;
  const when: When = to.matched[0].meta.when;

  if (when == When.LOGGED_IN && !loggedIn) {
    next('login');
  } else if (when == When.LOGGED_OUT && loggedIn) {
    next('ticks');
  } else {
    next();
  }
});
