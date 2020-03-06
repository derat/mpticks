// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component
export default class NetworkWatcher extends Vue {
  public online = false;
  public get offline() {
    return !this.online;
  }

  public handleOnline() {
    this.online = true;
  }
  public handleOffline() {
    this.online = false;
  }

  public mounted() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.online = navigator.onLine;
  }
  public beforeDestroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}
