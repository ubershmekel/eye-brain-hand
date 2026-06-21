import test from "node:test";
import assert from "node:assert/strict";

import { average, median } from "../src/game.ts";

test("average delay includes the slow first tap from every round", () => {
  // The player spends 1.2 seconds finding each round's three letters, then
  // dispatches its two remaining taps in 50 ms each.
  const delays = [1200, 50, 50, 1200, 50, 50, 1200, 50, 50];

  assert.equal(median(delays), 50);
  assert.equal(average(delays), 1300 / 3);
});

test("average of no taps is zero", () => {
  assert.equal(average([]), 0);
});
