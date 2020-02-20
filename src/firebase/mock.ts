// Copyright 2019 Daniel Erat and Niniane Wang. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import Vue from 'vue';
import { deepCopy } from '@/testutil';

type DocumentReference = firebase.firestore.DocumentReference;

// Firestore document data as property names to values.
// This also gets used for describing document updates,
// i.e. the keys may be dotted properties.
type DocData = Record<string, any>;

// Firestore document path types.
enum PathType {
  DOCUMENT,
  COLLECTION,
  RELATIVE,
}

// Removes leading and trailing slash from |path| and checks its validity per
// |pathType|.
function canonicalizePath(path: string, pathType = PathType.RELATIVE) {
  if (path.startsWith('/')) path = path.substr(1);
  if (path.endsWith('/')) path = path.substr(0, path.length - 1);
  if (!path.length) throw new Error('Path');

  // Paths begin with a collection name and alternate between collections and
  // documents, e.g. "collection/doc/subcollection/doc", so documents should
  // always have an even number of components and collections an odd number.
  // We don't check relative paths, since they'll be checked later when they're
  // appended to an absolute path.
  const even = path.split('/').length % 2 == 0;
  if (pathType == PathType.DOCUMENT && !even) {
    throw new Error(`Document path "${path}" has odd number of components`);
  } else if (pathType == PathType.COLLECTION && even) {
    throw new Error(`Collection path "${path}" has even number of components`);
  }

  return path;
}

// Returns |path|'s ID, i.e. its last component.
function pathID(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

// These aren't really mocks (they're more like stubs or maybe fakes), but their
// names need to start with 'Mock' (case-insensitive) or else Jest gives a dumb
// error: "The module factory of `jest.mock()` is not allowed to reference any
// out-of-scope variables."

// Stub implementation of firebase.firestore.DocumentSnapshot.
class MockDocumentSnapshot {
  _id: string;
  _data: DocData | undefined;
  constructor(id: string, data: DocData | undefined) {
    this._id = id;
    this._data = data;
  }
  get id() {
    return this._id;
  }
  data() {
    return this._data;
  }
  get(field: string) {
    // TODO: Implement dotted field paths if we need them.
    if (field.indexOf('.') != -1) throw new Error('Field paths unsupported');
    return this._data ? this._data[field] : undefined;
  }
  get exists() {
    return this._data !== undefined;
  }
}

// Stub implementation of firebase.firestore.QuerySnapshot.
class MockQuerySnapshot {
  _docs: MockDocumentSnapshot[];
  constructor(docs: MockDocumentSnapshot[]) {
    this._docs = docs;
  }
  get docs() {
    return this._docs;
  }
}

/* eslint-disable @typescript-eslint/no-use-before-define */

// Stub implementation of firebase.firestore.DocumentReference.
class MockDocumentReference {
  path: string;
  id: string;

  constructor(path: string) {
    this.path = canonicalizePath(path, PathType.DOCUMENT);
    this.id = pathID(this.path);
  }
  collection(path: string) {
    return new MockCollectionReference(
      `${this.path}/${canonicalizePath(path)}`
    );
  }
  get() {
    return Promise.resolve(
      new MockDocumentSnapshot(this.id, MockFirebase.getDoc(this.path))
    );
  }
  set(data: DocData, options?: firebase.firestore.SetOptions) {
    return Promise.resolve(MockFirebase.setDoc(this.path, data, options));
  }
  update(props: DocData) {
    return Promise.resolve(MockFirebase._updateDoc(this.path, props));
  }
}

/* eslint-enable @typescript-eslint/no-use-before-define */

// Prefix and next ID for automatically-generated Firestore document IDs.
// We do this instead of generating a UUID to make tests deterministic.
// It's totally not because generating UUIDs in JS is painful.
const autogenPrefix = 'auto-doc-';
let nextAutogenNum = 1;

// Stub implementation of firebase.firestore.CollectionReference.
class MockCollectionReference {
  path: string;
  id: string;

  constructor(path: string) {
    this.path = canonicalizePath(path, PathType.COLLECTION);
    this.id = pathID(this.path);
  }
  doc(path: string) {
    if (path === undefined) path = `${autogenPrefix}${nextAutogenNum++}`;
    return new MockDocumentReference(`${this.path}/${canonicalizePath(path)}`);
  }
  get() {
    return Promise.resolve(
      new MockQuerySnapshot(
        MockFirebase.listDocs()
          .filter(
            path =>
              // Document is within this collection.
              path.startsWith(this.path + '/') &&
              // Document is not within a subcollection.
              path.slice(this.path.length + 1).indexOf('/') == -1
          )
          .map(
            path =>
              new MockDocumentSnapshot(pathID(path), MockFirebase.getDoc(path))
          )
      )
    );
  }
}

// Operations that can be executed as part of a MockWriteBatch.
class BatchSet {
  constructor(
    public path: string,
    public data: DocData,
    public options?: firebase.firestore.SetOptions
  ) {}
}
class BatchUpdate {
  constructor(public path: string, public props: DocData) {}
}

/* eslint-disable @typescript-eslint/no-use-before-define */

// Stub implementation of firebase.firestore.WriteBatch.
class MockWriteBatch {
  _ops: (BatchUpdate | BatchSet)[] = [];

  set(
    ref: DocumentReference,
    data: DocData,
    options?: firebase.firestore.SetOptions
  ) {
    this._ops.push(new BatchSet(ref.path, data, options));
  }
  update(ref: DocumentReference, props: DocData) {
    this._ops.push(new BatchUpdate(ref.path, props));
  }
  commit() {
    return new Promise(resolve => {
      for (const op of this._ops) {
        if (op instanceof BatchSet) {
          MockFirebase.setDoc(op.path, op.data, op.options);
        } else if (op instanceof BatchUpdate) {
          MockFirebase._updateDoc(op.path, op.props);
        } else {
          throw new Error(`Invalid type for batch operation ${op}`);
        }
      }
      this._ops = [];
      resolve();
    });
  }
}

/* eslint-enable @typescript-eslint/no-use-before-define */

// Stub implementation of firebase.auth.User.
export class MockUser {
  constructor(public uid: string, public displayName: string | null) {}
  getIdToken() {
    return Promise.resolve('token');
  }
}

// Sentinel value for firebase.firestore.FieldValue.delete().
const mockFieldValueDeleteSentinel = {};

// Class returned by firebase.firestore.FieldValue.increment().
class MockFieldValueIncrement {
  constructor(public amount: number) {}
}

// Holds data needed to simulate (a tiny bit of) Firebase's functionality.
export const MockFirebase = new (class {
  // User for auth.currentUser.
  currentUser: MockUser | null = null;
  // May be set by tests to inject additional logic into getDoc().
  // If null is returned, getDoc() returns the document as usual.
  getDocHook: ((path: string) => DocData | null) | null = null;

  // Firestore documents keyed by path.
  _docs: Record<string, DocData> = {};

  constructor() {
    this.reset();
  }

  // Resets data to defaults.
  reset() {
    this.currentUser = new MockUser('test-uid', 'Test User');
    this.getDocHook = null;
    this._docs = {};
  }

  // Sets the document at |path| to |data|.
  setDoc(
    path: string | DocumentReference,
    data: DocData,
    options?: firebase.firestore.SetOptions
  ) {
    if (typeof path !== 'string') path = path.path;

    // Extract any field increments that are in the doc data.
    const extractIncs = (data: DocData): firebase.firestore.UpdateData => {
      const incs: firebase.firestore.UpdateData = {};
      for (const prop of Object.keys(data)) {
        const val = data[prop];
        if (val instanceof MockFieldValueIncrement) {
          incs[prop] = val;
          delete data[prop];
        } else if (typeof val === 'object') {
          Object.entries(extractIncs(val)).forEach(([fieldPath, inc]) => {
            incs[`${prop}.${fieldPath}`] = inc;
          });
        }
      }
      return incs;
    };
    const incs = extractIncs(data);

    // TODO: Also support |options.mergeFields| if needed.
    const oldData = this._docs[path] || {};
    const newData = {
      ...(options && options.merge ? this._docs[path] : {}),
      ...deepCopy(data),
    };
    this._docs[path] = newData;

    // Now apply the field increments.
    if (Object.keys(incs).length) this._updateDoc(path, incs);
  }

  // Returns the document at |path|. Primarily used to simulate actual document
  // fetches, but exposed publicly to let tests check stored data.
  getDoc(path: string | DocumentReference): DocData | undefined {
    if (typeof path !== 'string') path = path.path;

    if (this.getDocHook) {
      const data = this.getDocHook(path);
      if (data != null) return data;
    }

    return Object.prototype.hasOwnProperty.call(this._docs, path)
      ? deepCopy(this._docs[path])
      : undefined;
  }

  // Returns paths of all documents.
  listDocs(): string[] {
    return Object.keys(this._docs).sort();
  }

  // Updates portions of the document at |path|. This is used to implement
  // firebase.firestore.DocumentReference.update.
  _updateDoc(path: string, props: firebase.firestore.UpdateData) {
    const doc = this._docs[path];
    if (!doc) throw new Error(`Document at ${path} doesn't exist`);
    for (let prop of Object.keys(props)) {
      let obj = doc; // final object to set property on
      const data = props[prop]; // data to set
      // Strip off each dotted component from the full property path, walking
      // deeper into the document and creating new nested objects if needed.
      for (let i = prop.indexOf('.'); i != -1; i = prop.indexOf('.')) {
        const first = prop.slice(0, i);
        obj = Object.prototype.hasOwnProperty.call(obj, first)
          ? obj[first]
          : (obj[first] = {});
        prop = prop.slice(i + 1);
      }
      if (data === mockFieldValueDeleteSentinel) {
        delete obj[prop];
      } else if (data instanceof MockFieldValueIncrement) {
        if (typeof obj[prop] === 'undefined') obj[prop] = 0;
        obj[prop] += data.amount;
      } else {
        obj[prop] = data;
      }
    }
    this.setDoc(path, doc);
  }
})();

export const MockEmailAuthProviderID = 'email';
export const MockGoogleAuthProviderID = 'google';

jest.mock('firebase');
jest.mock('firebase/app', () => {
  // This implementation is gross, since we'll return a new object each time
  // e.g. firebase.firestore() is called. I think we can get away with it for
  // now since all of these are just wrappers around groups of methods, though.
  const app = {
    initializeApp: () => app,
    auth: () => ({
      get currentUser() {
        return MockFirebase.currentUser;
      },
      onAuthStateChanged: (observer: any) => {
        new Promise(resolve => {
          observer(MockFirebase.currentUser);
          resolve();
        });
      },
      signOut: () => {
        MockFirebase.currentUser = null;
        return Promise.resolve();
      },
    }),
    firestore: () => ({
      batch: () => new MockWriteBatch(),
      collection: (path: string) => new MockCollectionReference(path),
      doc: (path: string) => new MockDocumentReference(path),
      enablePersistence: () => Promise.resolve(),
      waitForPendingWrites: () => Promise.resolve(),
    }),
  };

  // Also set special field values and static Timestamp.fromMillis function, all
  // of which live on the firestore method.
  (app.firestore as any).FieldValue = {
    delete: () => mockFieldValueDeleteSentinel,
    increment: (amount: number) => new MockFieldValueIncrement(amount),
  };
  // Probably there's some way to use the real Timestamp implementation here
  // instead, but I'm not sure how to get at it.
  (app.firestore as any).Timestamp = {
    fromMillis: (ms: number) => ({
      toMillis: () => ms,
    }),
  };

  // Set some random const properties on the auth method.
  const authAny = app.auth as any;
  authAny.EmailAuthProvider = { PROVIDER_ID: MockEmailAuthProviderID };
  authAny.GoogleAuthProvider = { PROVIDER_ID: MockGoogleAuthProviderID };

  return app;
});

// TODO: Is this actually necessary? These modules are imported for their side
// effects in the code that's being tested.
jest.mock('firebase/auth');
jest.mock('firebase/firestore');
jest.mock('firebase/functions');
