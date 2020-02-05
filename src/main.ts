// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import Vue from 'vue';

Vue.config.productionTip = false;
Vue.config.devtools = false;

import VueRouter from 'vue-router';

Vue.use(VueRouter);

import firebase from '@/firebase';
import { router } from '@/router';
import vuetify from '@/plugins/vuetify';
import App from '@/App.vue';

// Defer Vue initialization until Firebase has determined if the user has
// authenticated or not. Otherwise, router.beforeEach may end up trying to
// inspect Firebase's auth state before it's been initialized.
let app: Vue | null = null;
firebase.auth().onAuthStateChanged(() => {
  if (!app) {
    app = new Vue({
      router,
      vuetify,
      render: h => h(App),
    }).$mount('#app');
  }
});
