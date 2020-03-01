// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Package usage implements the "Usage" Cloud Function.
package usage

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

// HandleRequest handles an HTTP request to the "Usage" Cloud Function.
func HandleRequest(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	// Initialize Cloud Firestore.
	client, err := firestore.NewClient(ctx, os.Getenv("GCP_PROJECT")) // automatically set by runtime
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed creating Firestore client: %v", err), http.StatusInternalServerError)
		return
	}

	numUsers := 0
	numImportsHist := newHistogram(0, 100, 5)
	numRoutesHist := newHistogram(0, 2500, 10)
	numTicksHist := newHistogram(0, 5000, 10)

	var countsRefs []*firestore.DocumentRef // users/<uid>/stats/counts

	iter := client.Collection("users").Documents(ctx)
	defer iter.Stop()
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed iterating over user docs: %v", err), http.StatusInternalServerError)
			return
		}
		var user struct {
			NumRoutes      int64     `firestore:"numRoutes"`
			NumImports     int64     `firestore:"numImports"`
			LastImportTime time.Time `firestore:"lastImportTime"`
		}
		if err := doc.DataTo(&user); err != nil {
			http.Error(w, fmt.Sprintf("Failed decoding %v: %v", doc.Ref.Path, err), http.StatusInternalServerError)
			return
		}

		numUsers++
		numRoutesHist.add(user.NumRoutes)
		numImportsHist.add(user.NumImports)

		countsRefs = append(countsRefs, doc.Ref.Collection("stats").Doc("counts"))
	}

	countsDocs, err := client.GetAll(ctx, countsRefs)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed getting counts docs: %v", err), http.StatusInternalServerError)
		return
	}
	for _, doc := range countsDocs {
		var counts struct {
			DateTicks map[string]int64 `firestore:"dateTicks"`
		}
		if err := doc.DataTo(&counts); err != nil {
			http.Error(w, fmt.Sprintf("Failed decoding %v: %v", doc.Ref.Path, err), http.StatusInternalServerError)
			return
		}
		var numTicks int64
		for _, ticks := range counts.DateTicks {
			numTicks += ticks
		}
		numTicksHist.add(numTicks)
	}

	fmt.Fprintf(w, "Users: %v\n", numUsers)
	fmt.Fprintf(w, "\nImports:\n")
	numImportsHist.write(w, 20)
	fmt.Fprintf(w, "\nRoutes:\n")
	numRoutesHist.write(w, 20)
	fmt.Fprintf(w, "\nTicks:\n")
	numTicksHist.write(w, 20)
}
