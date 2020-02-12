// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Fetches |url| and returns a promise for the string response body.
function getUrl(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.status != 200) {
        reject(`Failed to load ${url}: ${xhr.status} ${xhr.statusText}`);
        return;
      }
      resolve(xhr.responseText);
    };
    xhr.open('GET', url);
    xhr.send();
  });
}

// Returns a promise for a two-element array containing the signed-in user's
// email address and API key.
export function getCreds() {
  return getUrl('https://www.mountainproject.com/data').then(body => {
    const m = body.match(
      new RegExp('<a href="/data/get-user\\?email=([^"&]+)&amp;key=([^"]+)"')
    );
    if (!m) throw new Error('Failed to find email and key');
    return [m[1], m[2]];
  });
}

// Fetches and returns all ticks from Mountain Project.
// See the documented TypeScript getTicks() function in src/api.ts.
export function getTicks(email, key, ticks = []) {
  return getUrl(
    'https://www.mountainproject.com/data/get-ticks' +
      `?email=${email}&key=${key}&startPos=${ticks.length}`
  ).then(body => {
    const result = JSON.parse(body);
    if (!result.success) throw new Error('API reported failure');
    if (!result.ticks.length) return ticks;
    for (const tick of result.ticks) ticks.push(tick);
    return getTicks(email, key, ticks);
  });
}

// Deletes the ticks in |tickIds| (an array of numbers) one at a time.
export function deleteTicks(tickIds) {
  if (!tickIds.length) return Promise.resolve();
  const id = tickIds[0];
  console.log(`Deleting tick ${id}`);
  return getUrl(
    'https://www.mountainproject.com/ajax/delete-tick/' + id.toString()
  ).then(() => {
    tickIds.shift();
    return deleteTicks(tickIds);
  });
}

// Fake version of getTicks() that returns a promise that's resolved with an
// array of arbitrary ticks after a short delay.
export function fakeGetTicks() {
  const numTicks = 120;
  const numRoutes = 17;

  return new Promise((resolve, reject) => {
    const ticks = [];
    for (let i = 1; i <= numTicks; i++) {
      ticks.push({
        tickId: i,
        routeId: (i % numRoutes) + 1,
        date: `2020-01-0${(i % 9) + 1}`,
        style: 'Lead',
        leadStyle: ['Onsight', 'Redpoint', 'Fell/Hung'][i % 3],
      });
    }
    window.setTimeout(() => resolve(ticks), 500);
  });
}

// Fake version of deleteTicks() that returns a promise that's resolved after a
// short delay.
export function fakeDeleteTicks(tickIds) {
  return new Promise((resolve, reject) => {
    console.log('Would delete', tickIds);
    window.setTimeout(() => resolve(), 500);
  });
}