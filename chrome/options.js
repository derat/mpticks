// Copyright 2021 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { emailKey, apiKeyKey } from './constants.js';

function $(id) {
  return document.getElementById(id);
}

// Initialize the UI with option values from storage.
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email-input');
  const apiKeyInput = document.getElementById('api-key-input');

  chrome.storage.sync.get([emailKey, apiKeyKey], (items) => {
    if (items[emailKey]) emailInput.value = items[emailKey];
    if (items[apiKeyKey]) apiKeyInput.value = items[apiKeyKey];
  });

  // Save options to storage when they're modified through the UI.
  emailInput.addEventListener('change', (e) => {
    chrome.storage.sync.set({ [emailKey]: e.target.value });
  });
  apiKeyInput.addEventListener('change', (e) => {
    chrome.storage.sync.set({ [apiKeyKey]: e.target.value });
  });
});
