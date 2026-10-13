import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createScopedStorage,
  type KeyValueStore,
} from "../src/adapters/scoped-storage.ts";

test("snapshot stores isolate plans, views and assets while keeping existing development keys", () => {
  const values = new Map<string, string>();
  const backing: KeyValueStore = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const live = createScopedStorage(backing),
    a = createScopedStorage(backing, "review-r3-a:"),
    b = createScopedStorage(backing, "review-r3-b:");
  for (const key of [
    "melodic-journey",
    "journey-view",
    "asset-reviews",
    "library-atmospheres",
  ]) {
    live.setItem(key, "live");
    a.setItem(key, "a");
    b.setItem(key, "b");
    a.removeItem(key);
    assert.equal(a.getItem(key), null);
    assert.equal(b.getItem(key), "b");
    assert.equal(live.getItem(key), "live");
    assert.equal(backing.getItem(key), "live");
  }
});
test("storage errors stay observable rather than falsely reporting a saved plan", () => {
  const unavailable = createScopedStorage({
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
    removeItem: () => {},
  });
  assert.throws(() => unavailable.setItem("plan", "value"), /quota/);
});
