// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Fetches |url| and returns a promise for the string response body.
function getUrl(url) {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.status != 200) {
        throw new Error(
          `Failed to load ${url}: ${xhr.status} ${xhr.statusText}`
        );
      }
      resolve(xhr.responseText);
    };
    xhr.open('GET', url);
    xhr.send();
  });
}

// Delay between deleting ticks.
const deleteDelayMs = 10;

// Helper function that deletes the ticks in |tickIds| (a Set of numbers) one at
// a time in an arbitrary order. |deleteFunc| should take a number tick ID and
// return a promise that is resolved once the tick is deleted. If |cb| is
// defined, it is invoked after each successful deletion with the ID of the
// just-deleted tick. Returns a void promise that is resolved when all ticks are
// deleted.
function recursivelyDeleteTicks(tickIds, deleteFunc, cb) {
  if (!tickIds.size) return Promise.resolve();

  const id = tickIds.values().next().value;
  return new Promise(resolve => {
    deleteFunc(id).then(() => {
      if (cb) cb(id);
      tickIds.delete(id);
      if (!tickIds.size) {
        resolve();
        return;
      }
      window.setTimeout(
        () => resolve(recursivelyDeleteTicks(tickIds, deleteFunc, cb)),
        deleteDelayMs
      );
    });
  });
}

// Returns a promise for a two-element array containing the signed-in user's
// email address and API key.
export function getCreds() {
  return getUrl('https://www.mountainproject.com/data').then(body => {
    const m = body.match(
      new RegExp('<a href="/data/get-user\\?email=([^"&]+)&amp;key=([^"]+)"')
    );
    if (!m) throw new Error("Didn't find email/key (are you logged in to MP?)");
    return [m[1], m[2]];
  });
}

// Fetches and returns all ticks from Mountain Project.
// See the documented TypeScript getApiTicks() function in src/api.ts.
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

// Fetches and returns the requested routes from Mountain Project.
// See the documented TypeScript getApiRoutes() function in src/api.ts.
export function getRoutes(routeIds, key, routes = []) {
  if (!routeIds.length) return Promise.resolve([]);

  const maxRoutes = 200;
  return getUrl(
    'https://www.mountainproject.com/data/get-routes' +
      `?key=${key}&routeIds=${routeIds.slice(0, maxRoutes).join(',')}`
  ).then(body => {
    const result = JSON.parse(body);
    if (!result.success) throw new Error('API reported failure');
    routes = routes.concat(result.routes);
    if (routeIds.length <= maxRoutes) return routes;
    return getRoutes(routeIds.slice(maxRoutes), key, routes);
  });
}

// Deletes the ticks in |tickIds| (a Set of numbers) and returns a void promise
// that is resolved once all ticks are deleted. If |cb| is defined, it is
// invoked after each successful deletion with the ID of the just-deleted tick.
export function deleteTicks(tickIds, cb) {
  return recursivelyDeleteTicks(
    tickIds,
    tickId =>
      getUrl(
        'https://www.mountainproject.com/ajax/delete-tick/' + tickId.toString()
      ),
    cb
  );
}

// Fake version of getTicks() that returns a promise that's resolved with an
// array of arbitrary ticks after a short delay.
export function fakeGetTicks() {
  const numTicks = 120;
  const numRoutes = 17;

  return new Promise(resolve => {
    const ticks = [];
    for (let i = 1; i <= numTicks; i++) {
      ticks.push({
        tickId: i,
        routeId: 1 + Math.floor(Math.random() * numRoutes),
        date: `2020-01-0${(i % 9) + 1}`,
        style: 'Lead',
        leadStyle: ['Onsight', 'Redpoint', 'Fell/Hung'][i % 3],
      });
    }
    window.setTimeout(() => resolve(ticks), 500);
  });
}

// Fake version of getRoutes() that returns a promise that's resolved with fake
// data for the supplied route IDs after a short delay.
export function fakeGetRoutes(routeIds) {
  return new Promise(resolve => {
    window.setTimeout(() =>
      resolve(
        routeIds.map(
          id => ({
            id,
            name: `Route #${id}`,
            // We don't use any other fields.
          }),
          500
        )
      )
    );
  });
}

// Fake version of deleteTicks() that doesn't delete anything.
export function fakeDeleteTicks(tickIds, cb) {
  return recursivelyDeleteTicks(tickIds, tickId => Promise.resolve(), cb);
}
