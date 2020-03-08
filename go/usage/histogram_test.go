// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package usage

import (
	"bytes"
	"testing"
)

func checkHist(t *testing.T, h *histogram, lw, bw int, exp string) {
	var b bytes.Buffer
	if err := h.write(&b, lw, bw); err != nil {
		t.Fatal("write failed: ", err)
	}
	if b.String() != exp {
		t.Errorf("write produced %q; want %q", b.String(), exp)
	}
}

func TestHistogramSingle(t *testing.T) {
	h := newHistogram(1, 4, 4)
	for i := 0; i <= 5; i++ {
		h.add(int64(i))
	}
	checkHist(t, h, 0, 2, `<1 |## 1
 1 |## 1
 2 |## 1
 3 |## 1
 4 |## 1
>4 |## 1
`)
}

func TestHistogramEven(t *testing.T) {
	h := newHistogram(1, 20, 10)
	for i := 0; i <= 21; i++ {
		h.add(int64(i))
	}
	checkHist(t, h, 0, 5, `   <1 |### 1
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
`)
}

func TestHistogramUneven(t *testing.T) {
	h := newHistogram(1, 10, 3)
	for i := 1; i <= 10; i++ {
		h.add(int64(i))
	}
	checkHist(t, h, 0, 2, ` 1-3 |## 3
 4-6 |## 3
7-10 |## 4
`)
}

func TestHistogramOnlyUnderflow(t *testing.T) {
	h := newHistogram(1, 3, 3)
	h.add(0)
	checkHist(t, h, 0, 2, `<1 |## 1
 1 |
 2 |
 3 |
`)
}

func TestHistogramOnlyOverflow(t *testing.T) {
	h := newHistogram(1, 3, 3)
	h.add(4)
	checkHist(t, h, 0, 2, ` 1 |
 2 |
 3 |
>3 |## 1
`)
}
