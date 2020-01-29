// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import Import from '@/views/Import.vue';
import Ticks from '@/views/Ticks.vue';

export default [
  {
    name: 'ticks',
    path: '/ticks',
    component: Ticks,
  },
  {
    name: 'import',
    path: '/import',
    component: Import,
  },
  {
    path: '*',
    redirect: '/ticks',
  },
];
