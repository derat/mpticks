<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-alert
    v-model="show"
    border="left"
    dense
    dismissible
    type="error"
    class="mb-0 mt-3"
    >{{ text }}</v-alert
  >
</template>

<script lang="ts">
import { Component, PropSync, Vue } from 'vue-property-decorator';

@Component
export default class Alert extends Vue {
  @PropSync('text', { type: String }) syncedText!: string;

  get show() {
    return !!this.syncedText;
  }
  set show(v: any) {
    if (!v) this.syncedText = '';
  }
}
</script>
