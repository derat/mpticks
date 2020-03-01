// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Package mpticks contains entry points to Cloud Functions.
package mpticks

import (
	"context"
	"net/http"

	"mpticks/go/usage"
)

// Usage is the entry point into the "Usage" Cloud Function.
// The actual implementation lives in the usage package.
func Usage(w http.ResponseWriter, r *http.Request) {
	usage.HandleRequest(context.Background(), w, r)
}
