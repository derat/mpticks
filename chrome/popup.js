// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  getCreds,
  getTicks,
  deleteTicks,
  fakeGetTicks,
  fakeDeleteTicks,
} from './api.js';
import { groupAndSortTicks } from './ticks.js';

// Can be set to true for development.
const useFakeApi = true;

// Contains numeric tick IDs that should be deleted.
let tickIdsToDelete = [];

// Updates the 'route-container' element to list the routes and ticks in
// |routeTicks|, an object mapping from route ID to array of ticks in
// best-to-worst order. All but the top tick for each route will be displayed in
// a crossed-out state.
function updateTickList(routeTicks) {
  const cont = document.getElementById('route-container');
  while (cont.firstChild) cont.removeChild(cont.firstChild);

  Object.keys(routeTicks)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(routeId => {
      const bestTickId = routeTicks[routeId][0].tickId;

      const routeDiv = document.createElement('div');
      routeDiv.appendChild(document.createTextNode(`Route ${routeId}`));
      routeDiv.classList.add('route');
      cont.appendChild(routeDiv);

      const tickList = document.createElement('ul');
      tickList.classList.add('tick-list');
      routeTicks[routeId]
        // TODO: These should technically also be sorted by tick ID, but this is
        // just the order in which we display the ticks so it's not a big deal.
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach(tick => {
          const tickItem = document.createElement('li');
          if (tick.tickId != bestTickId) tickItem.classList.add('delete');
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
  button.innerText = 'Loading ticks...';
  button.disabled = 'disabled';
  hideError();

  (useFakeApi
    ? fakeGetTicks()
    : getCreds().then(([email, key]) => getTicks(email, key))
  )
    .then(ticks => {
      const routeTicks = groupAndSortTicks(ticks);
      Object.values(routeTicks).forEach(ticks => {
        ticks
          .slice(1) // preserve the best tick
          .forEach(tick => tickIdsToDelete.push(parseInt(tick.tickId)));
      });

      updateTickList(routeTicks);
      document.getElementById('screen-1').classList.add('hidden');
      document.getElementById('screen-2').classList.remove('hidden');
    })
    .catch(err => {
      displayError(err);
      button.innerText = 'Load ticks';
      button.disabled = undefined;
    });
}

// Handles the 'Delete ticks' button being clicked.
function onDeleteClicked() {
  const button = document.getElementById('delete-button');
  button.innerText = `Deleting ${tickIdsToDelete.length} ticks...`;
  button.disabled = 'disabled';
  hideError();

  // Save the count first since |tickIdsToDelete| will get mutated.
  const deleteCount = tickIdsToDelete.length;

  (useFakeApi ? fakeDeleteTicks(tickIdsToDelete) : deleteTicks(tickIdsToDelete))
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