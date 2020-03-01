// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package usage

import (
	"bytes"
	"testing"
)

func TestHistogramEven(t *testing.T) {
	h := newHistogram(1, 20, 10)
	for i := 0; i <= 21; i++ {
		h.add(int64(i))
	}
	var b bytes.Buffer
	if err := h.write(&b, 5); err != nil {
		t.Fatal("write failed: ", err)
	}
	const exp = `   <1 |### 1
  1-2 |##### 2
  3-4 |##### 2
  5-6 |##### 2
  7-8 |##### 2
 9-10 |##### 2
11-12 |##### 2
13-14 |##### 2
15-16 |##### 2
17-18 |##### 2
19-20 |##### 2
  >20 |### 1
`
	if b.String() != exp {
		t.Errorf("write produced %q; want %q", b.String(), exp)
	}
}

func TestHistogramUneven(t *testing.T) {
	h := newHistogram(1, 10, 3)
	for i := 1; i <= 10; i++ {
		h.add(int64(i))
	}
	var b bytes.Buffer
	if err := h.write(&b, 2); err != nil {
		t.Fatal("write failed: ", err)
	}
	const exp = `  1-3 |## 3
  4-6 |## 3
 7-10 |## 4
`
	if b.String() != exp {
		t.Errorf("write produced %q; want %q", b.String(), exp)
	}
}
