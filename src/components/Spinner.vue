<!-- Copyright 2019 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-progress-circular indeterminate size="48" class="spinner" />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component
export default class Spinner extends Vue {}
</script>

<style scoped>
.spinner {
  left: 50%;
  margin-left: -24px;
  margin-top: -24px;
  position: fixed;
  top: 50%;
}
</style>
