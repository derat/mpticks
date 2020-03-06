// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MockFirebase, MockUser } from '@/firebase/mock';
import firebase from 'firebase/app';

import Vue from 'vue';
import { mount, Wrapper } from '@vue/test-utils';

import flushPromises from 'flush-promises';

import { testApiRoute, testApiTick } from '@/testdata';
import {
  newVuetifyMountOptions,
  setUpVuetifyTesting,
  stubConsole,
} from '@/testutil';

import Export from './Export.vue';

setUpVuetifyTesting();

describe('Export', () => {
  let wrapper: Wrapper<Vue>;

  const testUid = 'test-uid';
  const importsPath = `users/${testUid}/imports`;

  // Objects passed to window.URL.createObjectURL. This is the closest we can
  // get to see what's actually getting downloaded. :-/
  let downloads: any[] = [];

  beforeAll(() => {
    window.URL.createObjectURL = (obj: any) => {
      downloads.push(obj);
      // It seems like this needs to be an empty string to prevent 'Error: Not
      // implemented: navigation (except hash changes)' from Jest when the link
      // is clicked.
      return '';
    };
    window.URL.revokeObjectURL = (url: string) => {};
  });

  beforeEach(async () => {
    MockFirebase.reset();
    MockFirebase.currentUser = new MockUser(testUid, 'Test User');
    downloads = [];
    wrapper = mount(Export, newVuetifyMountOptions());
    await flushPromises();
  });

  // Clicks the button and waits for the export to finish.
  async function doExport() {
    const button = wrapper.find({ ref: 'exportButton' });
    expect(button.attributes('disabled')).toBeFalsy();
    button.trigger('click');
    await flushPromises();
  }

  it('downloads ticks and routes', async () => {
    const r1 = testApiRoute(1, []);
    const r2 = testApiRoute(2, []);
    const r3 = testApiRoute(3, []);
    const t1 = testApiTick(11, r1.id);
    const t2 = testApiTick(12, r2.id);
    const t3 = testApiTick(13, r3.id);

    // Create docs with various imported routes and ticks.
    MockFirebase.setDoc(`${importsPath}/123.routes.0}`, { routes: [r1, r2] });
    MockFirebase.setDoc(`${importsPath}/456.routes.0}`, { routes: [r3] });
    MockFirebase.setDoc(`${importsPath}/123.ticks.0}`, { ticks: [t1] });
    MockFirebase.setDoc(`${importsPath}/123.ticks.1}`, { ticks: [t2] });
    MockFirebase.setDoc(`${importsPath}/456.ticks.0}`, { ticks: [t3] });

    await doExport();

    // What a pain. Blob has a Promise-based text() method, but it doesn't
    // appear to be supported here yet.
    const files: string[] = await Promise.all(
      downloads.map(o => {
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(reader.result!.toString());
          reader.readAsText(o as Blob);
        });
      })
    );

    // We download ticks first and then routes.
    expect(files).toEqual([
      JSON.stringify([t1, t2, t3]),
      JSON.stringify([r1, r2, r3]),
    ]);
  });

  it("skips doing anything when there's no data", async () => {
    await doExport();
    expect(downloads.length).toBe(0);
  });

  it('refuses to export cached data', async () => {
    MockFirebase.setDoc(`${importsPath}/1.routes.0}`, {
      routes: [testApiRoute(1, [])],
    });
    MockFirebase.serveFromCache = true;

    const origConsole = stubConsole();
    await doExport();
    console = origConsole;

    expect(wrapper.find({ ref: 'errorAlert' }).text()).toContain(
      'Failed to export data'
    );
    expect(downloads.length).toBe(0);
  });
});
