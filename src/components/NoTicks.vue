<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div>
    No ticks. Try <router-link to="/import">importing</router-link> some.
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
@Component
export default class NoTicks extends Vue {}
</script>
