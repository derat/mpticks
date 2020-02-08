// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file defines functions that return references to Firestore documents.

import firebase from '@/firebase';
import { AreaId, RouteId } from '@/models';

export function userRef() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Not logged in');
  return firebase
    .firestore()
    .collection('users')
    .doc(user.uid);
}

export function routeRef(id: RouteId) {
  return userRef()
    .collection('routes')
    .doc(id.toString());
}

export function areaRef(id: AreaId) {
  return userRef()
    .collection('areas')
    .doc(id);
}

export function areaMapRef() {
  return areaRef('map');
}

export function tickCountsRef() {
  return userRef()
    .collection('stats')
    .doc('tickCounts');
}
