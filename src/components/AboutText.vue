<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div>
    <p>
      This site lets you import and view your ticks from
      <a target="_blank" href="https://www.mountainproject.com/"
        >Mountain Project</a
      >.
    </p>
    <p>
      Some users want to tick every climb so they can track their activity or
      review notes about earlier attempts. At the same time, it can be annoying
      to see the stats page for a warm-up route cluttered with multiple ticks
      from a single user.
      <span v-if="!short"
        >There have been
        <a
          href="https://www.mountainproject.com/forum/topic/111808954/suggestion-private-ticks-option"
          target="_blank"
          >several</a
        >&#32;
        <a
          href="https://www.mountainproject.com/forum/topic/113634433/hiding-tick-list-from-profile"
          target="_blank"
          >requests</a
        >
        in the forums for a "private ticks" feature, but they don't seem to be
        going anywhere.</span
      >
    </p>
    <p>
      This site provides an alternate location for storing ticks. You submit
      ticks to Mountain Project like usual using the website or mobile app, but
      then import them to this site and can delete the original ticks from
      Mountain Project if you want.
    </p>
    <p v-if="!short">
      Mountain Project doesn't currently provide an interface for importing
      ticks, so be sure that you know what you're doing before you delete them
      from there.
    </p>
    <p>
      The source code for this site is available on
      <a href="https://github.com/derat/mpticks" target="_blank">GitHub</a>.
      <span v-if="!short"
        >If you have a questions or comments, don't hesitate to
        <a href="mailto:dan-mpticks@erat.org" target="_blank">email me</a
        >.</span
      >
    </p>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class AboutText extends Vue {
  @Prop(Boolean) readonly short: boolean;
}
</script>