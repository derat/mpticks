<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <v-row class="mx-1">
    <v-col cols="12" lg="8">
      <AboutText />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import AboutText from '@/components/AboutText.vue';

@Component({ components: { AboutText } })
export default class About extends Vue {}
</script>
