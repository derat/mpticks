<!-- Copyright 2019 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center">
      <v-progress-circular indeterminate size="48" />
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component
export default class Spinner extends Vue {}
</script>
