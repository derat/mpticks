<!-- Copyright 2020 Daniel Erat. All rights reserved.
     Use of this source code is governed by a BSD-style license that can be
     found in the LICENSE file. -->

<template>
  <div class="login-wrapper">
    <div id="firebaseui-auth-container" v-show="showUI" />
    <v-container class="fill-height" v-if="!showUI">
      <v-row justify="center" align="center">
        <v-progress-circular indeterminate size="48" />
      </v-row>
    </v-container>
  </div>
</template>

<script lang="ts">
import app from '@/firebase';
import firebase from 'firebase/app';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';

import { Component, Vue } from 'vue-property-decorator';

@Component
export default class Login extends Vue {
  // True when an OAuth-based flow has redirected back to this view after
  // getting user confirmation.
  pendingRedirect = false;

  get showUI() {
    // Hide the login elements when we don't need anything else from the user.
    return !this.pendingRedirect;
  }

  mounted() {
    // See https://github.com/firebase/firebaseui-web/issues/293.
    let ui = firebaseui.auth.AuthUI.getInstance();
    if (!ui) ui = new firebaseui.auth.AuthUI(app.auth());

    this.pendingRedirect = ui.isPendingRedirect();

    ui.start('#firebaseui-auth-container', {
      // Disable the account chooser, which is ugly and doesn't seem to work
      // correctly with this logic (i.e. after signing out and trying to
      // sign in with email, I just see a spinner):
      // https://stackoverflow.com/q/37369929
      credentialHelper: firebaseui.auth.CredentialHelper.NONE,
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
      ],
      callbacks: {
        signInSuccessWithAuthResult: () => {
          this.$router.replace('ticks');

          // Don't redirect automatically; we handle that above.
          return false;
        },
      },
    });
  }
}
</script>

<style scoped>
.login-wrapper {
  /* Needed in order for spinner to be vertically centered. */
  display: inline;
}
</style>
