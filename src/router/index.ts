// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import VueRouter from 'vue-router';
import routes from './routes';

const router = new VueRouter({ mode: 'history', routes });

router.beforeEach((to, from, next) => {
  // TODO: Add routing logic here.
  next();
});

export default router;
