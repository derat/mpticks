// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  getCreds,
  getRoutes,
  getTicks,
  deleteTicks,
  fakeGetRoutes,
  fakeGetTicks,
  fakeDeleteTicks,
} from './api.js';
import { groupAndSortTicks } from './ticks.js';

// Can be set to true for development.
const useFakeApi = false;

// Contains numeric tick IDs that should be deleted.
const tickIdsToDelete = new Set();

// Updates the 'route-container' element to list the routes and ticks in
// |routeTicks|, an object mapping from route ID to array of ticks. Ticks with
// IDs in |tickIdsToDelete|, a Set of numbers, will be displayed in a
// crossed-out state. |routeNames| is an object mapping from route ID to route
// name.
function updateTickList(routeTicks, tickIdsToDelete, routeNames) {
  const cont = document.getElementById('route-container');
  while (cont.firstChild) cont.removeChild(cont.firstChild);

  Object.keys(routeTicks)
    .sort((a, b) => parseInt(a) - parseInt(b)) // ascending route ID
    .forEach(routeId => {
      const ticks = routeTicks[routeId];
      // Skip the route if none of its ticks are being deleted.
      if (!ticks.find(t => tickIdsToDelete.has(t.tickId))) return;

      const routeName = routeNames[routeId] || 'Unknown';
      const routeDiv = document.createElement('div');
      routeDiv.appendChild(
        document.createTextNode(`${routeName} (${routeId})`)
      );
      routeDiv.classList.add('route');
      cont.appendChild(routeDiv);

      const tickList = document.createElement('ul');
      tickList.classList.add('tick-list');
      ticks
        .sort((a, b) => a.date.localeCompare(b.date) || a.tickId - b.tickId)
        .forEach(tick => {
          const tickItem = document.createElement('li');
          if (tickIdsToDelete.has(tick.tickId)) {
            tickItem.classList.add('delete');
          }
          tickItem.appendChild(
            document.createTextNode(
              `Tick ${tick.tickId}: ${tick.date} ${tick.style} ${tick.leadStyle}`
            )
          );
          tickList.appendChild(tickItem);
        });
      cont.appendChild(tickList);
    });
}

// Logs and displays the supplied error.
function displayError(err) {
  console.error(err);
  document.getElementById('error-message').innerText = err.message;
  window.scrollTo(0, document.body.scrollHeight);
}

// Hides the onscreen error (if any).
function hideError() {
  document.getElementById('error-message').innerText = '';
}

// Handles the 'Load ticks' button being clicked.
function onLoadClicked() {
  const button = document.getElementById('load-button');
  button.disabled = 'disabled';
  hideError();

  let email = '';
  let key = '';
  let routeTicks; // map from route ID to array of sorted tick objects

  button.innerText = 'Loading credentials...';
  (useFakeApi ? Promise.resolve(['', '']) : getCreds())
    .then(creds => {
      email = creds[0];
      key = creds[1];
      button.innerText = 'Loading ticks...';
      return useFakeApi ? fakeGetTicks() : getTicks(email, key);
    })
    .then(ticks => {
      routeTicks = groupAndSortTicks(ticks);

      const routeIdsToUpdate = [];
      Object.entries(routeTicks).forEach(([routeId, ticks]) => {
        // Preserve the first/best tick from each route's list.
        ticks.slice(1).forEach(t => tickIdsToDelete.add(t.tickId));
        if (ticks.length > 1) routeIdsToUpdate.push(routeId);
      });

      button.innerText = 'Loading routes...';
      return useFakeApi
        ? fakeGetRoutes(routeIdsToUpdate)
        : getRoutes(routeIdsToUpdate, key);
    })
    .then(routes => {
      const routeNames = {}; // keyed by route ID
      for (const r of routes) routeNames[r.id] = r.name;

      updateTickList(routeTicks, tickIdsToDelete, routeNames);
      document.getElementById('screen-1').classList.add('hidden');
      document
        .getElementById(tickIdsToDelete.size ? 'screen-2' : 'screen-2-empty')
        .classList.remove('hidden');
    })
    .catch(err => {
      displayError(err);
      button.innerText = 'Load ticks';
      button.disabled = undefined;
    });
}

// Handles the 'Delete ticks' button being clicked.
function onDeleteClicked() {
  // Save the count first since |tickIdsToDelete| will get mutated.
  const deleteCount = tickIdsToDelete.size;

  const button = document.getElementById('delete-button');
  button.innerText = `Deleting ticks...`;
  button.disabled = 'disabled';
  hideError();

  const status = document.getElementById('delete-status');
  let numDeleted = 0;

  (useFakeApi ? fakeDeleteTicks : deleteTicks)(tickIdsToDelete, id => {
    console.log(`Deleted tick ${id}`);
    status.innerText = `Deleted ${++numDeleted} of ${deleteCount} tick(s)`;
  })
    .then(() => {
      document.getElementById('screen-2').classList.add('hidden');
      document.getElementById('screen-3').classList.remove('hidden');
      document
        .getElementById('deleted-count')
        .appendChild(document.createTextNode(deleteCount.toString()));
    })
    .catch(err => {
      displayError(err);
      button.innerText = 'Delete ticks';
      button.disabled = undefined;
    });
}

window.onload = () => {
  document
    .getElementById('load-button')
    .addEventListener('click', onLoadClicked);
  document
    .getElementById('delete-button')
    .addEventListener('click', onDeleteClicked);
};
