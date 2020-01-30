<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div>
    <v-card class="ma-3 pa-3">
      <p>
        Enter the email address that you use to log in to Mountain Project and
        your private API key displayed at the right side of
        <a target="_blank" href="https://www.mountainproject.com/data"
          >this page</a
        >.
      </p>

      <p>
        This information is only used to import your ticks (and in fact, it will
        be sent directly from your browser to Mountain Project's servers).
      </p>

      <v-divider class="mb-2" />

      <v-form v-model="valid" @submit.prevent>
        <v-row>
          <v-col cols="12" class="py-0">
            <v-text-field
              label="Email address"
              v-model="email"
              single-line
              :rules="emailRules"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" class="py-0">
            <v-text-field
              label="Private key"
              v-model="key"
              single-line
              :rules="keyRules"
            />
          </v-col>
        </v-row>
      </v-form>

      <v-row>
        <v-col class="pb-1">
          <v-btn color="primary" :disabled="!valid" @click="onClick"
            >Import</v-btn
          >
        </v-col>
      </v-row>
    </v-card>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { getTicks } from '@/api';

@Component
export default class Import extends Vue {
  // Models for text fields.
  email = '';
  key = '';

  // Whether the form contains valid input.
  valid = false;

  emailRules = [(v: string) => !!v || 'Email address must be supplied'];
  keyRules = [(v: string) => !!v || 'Private key must be supplied'];

  onClick() {
    getTicks(this.email, this.key).then(ticks => {
      console.log(ticks);
    });
  }
}
</script>
