import assert from "node:assert/strict";
import { test } from "node:test";
import { bubbleSort } from "../src/index.js";

test("bubbleSort returns a sorted copy without mutating the input", () => {
  const input = [5, 1, 4, 2, 8];

  assert.deepEqual(bubbleSort(input), [1, 2, 4, 5, 8]);
  assert.deepEqual(input, [5, 1, 4, 2, 8]);
});

test("bubbleSort handles duplicate and negative numbers", () => {
  assert.deepEqual(bubbleSort([3, -1, 3, 0]), [-1, 0, 3, 3]);
});
