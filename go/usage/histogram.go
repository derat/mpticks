// Copyright 2020 Daniel Erat. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package usage

import (
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
)

// histogram implements a simple linear histogram.
type histogram struct {
	step      float64
	buckets   []bucket
	underflow int
	overflow  int
}

// bucket is an individual bucket within histogram.
type bucket struct {
	min, max int64
	count    int
}

// newHistogram returns a new histogram suitable for counting values between min
// and max, inclusive, with nb buckets.
func newHistogram(min, max int64, nb int) *histogram {
	h := &histogram{
		step:    float64(max-min+1) / float64(nb),
		buckets: make([]bucket, nb),
	}
	for i := range h.buckets {
		b := &h.buckets[i]
		b.min = min + int64(float64(i)*h.step)
		b.max = min + int64(float64(i+1)*h.step) - 1
	}
	return h
}

// add records n in the appropriate bucket.
func (h *histogram) add(n int64) {
	if n < h.buckets[0].min {
		h.underflow += 1
	} else if n > h.buckets[len(h.buckets)-1].max {
		h.overflow += 1
	} else {
		// We'd ideally be able to compute the bucket directly here.
		// However, this doesn't work due to truncation.
		//
		// Consider a case with 10 buckets and a range of [4, 50].
		// step will be 4.7, and buckets[2].min will be 4 + (2 * 4.7) = 13.4,
		// which will be truncated to 13. If we try to compute the bucket for
		// 13, we'll get (13 - 4) / 4.7 = 1.915 instead of 2. This is because
		// the "real" lower bound for the bucket given the step is 13.4.
		//
		// To work around this, use the next smaller or larger bucket if needed.
		// Maybe there's an easier way to do this, but I'm not seeing it...
		i := int(float64(n-h.buckets[0].min) / h.step)
		if n < h.buckets[i].min {
			i--
		} else if n > h.buckets[i].max {
			i++
		}
		h.buckets[i].count++
	}
}

// write writes a string representation of the histogram to w.
// width specifies the width in characters of the bar used for the largest count.
func (h *histogram) write(w io.Writer, width int) error {
	maxCount := 0
	for _, b := range h.buckets {
		if b.count > maxCount {
			maxCount = b.count
		}
	}

	// Figure out how much space to use for the labels on the left.
	nw := len(strconv.FormatInt(h.buckets[len(h.buckets)-1].max+1, 10))
	lw := 2*nw + 1
	fs := fmt.Sprintf("%%%ds |%%s\n", lw)

	var perr error
	pl := func(label string, count int) {
		if perr != nil {
			return
		}
		bw := int(math.Round(float64(count) / float64(maxCount) * float64(width)))
		bar := strings.Repeat("#", bw)
		if len(bar) > 0 {
			bar += " " + strconv.Itoa(count)
		}
		_, perr = fmt.Fprintf(w, fs, label, bar)
	}

	pl(fmt.Sprintf("<%v", h.buckets[0].min), h.underflow)
	for _, b := range h.buckets {
		pl(fmt.Sprintf("%v-%v", b.min, b.max), b.count)
	}
	pl(fmt.Sprintf(">%v", h.buckets[len(h.buckets)-1].max), h.overflow)

	return perr
}
