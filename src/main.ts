// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import Vue from 'vue';

Vue.config.productionTip = false;
Vue.config.devtools = false;

import VueRouter from 'vue-router';

Vue.use(VueRouter);

import '@/register-service-worker';

import router from '@/router';
import vuetify from '@/plugins/vuetify';
import App from '@/App.vue';

new Vue({
  router,
  vuetify,
  render: h => h(App),
}).$mount('#app');
