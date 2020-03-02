// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

const app = firebase.initializeApp(
  process.env.NODE_ENV == 'test'
    ? {} // avoid using real backend in tests
    : {
        apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
        authDomain: process.env.VUE_APP_FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.VUE_APP_FIREBASE_DATABASE_URL,
        projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VUE_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VUE_APP_FIREBASE_APP_ID,
      }
);

export default app;
