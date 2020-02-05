// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import VueRouter from 'vue-router';
import firebase from '@/firebase';

import Import from '@/views/Import.vue';
import Login from '@/views/Login.vue';
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
    meta: { title: 'Log in', when: When.LOGGED_OUT },
  },
  {
    name: 'ticks',
    path: '/ticks',
    component: Ticks,
    meta: { title: 'Ticks', when: When.LOGGED_IN },
  },
  {
    name: 'import',
    path: '/import',
    component: Import,
    meta: { title: 'Import', when: When.LOGGED_IN },
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
    // TODO: Should probably go to import page if they don't have any ticks yet.
    next('ticks');
  } else {
    next();
  }
});
