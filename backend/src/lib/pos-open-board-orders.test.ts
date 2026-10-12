import assert from "node:assert/strict";
import test from "node:test";
import { shouldFetchOpenBoardExtras } from "./pos-open-board-orders.ts";

test("open board extras run on All / default status, not completed-only", () => {
  assert.equal(shouldFetchOpenBoardExtras(undefined), true);
  assert.equal(shouldFetchOpenBoardExtras("all"), true);
  assert.equal(shouldFetchOpenBoardExtras("preparing"), true);
  assert.equal(shouldFetchOpenBoardExtras("awaiting_payment"), true);
  assert.equal(shouldFetchOpenBoardExtras("completed"), false);
});
