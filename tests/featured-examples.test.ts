import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateExample,
  saveExample,
  readExamples,
} from "../src/adapters/featured-examples";
import type { KeyValueStore } from "../src/adapters/scoped-storage";

const original = JSON.parse(
  readFileSync(
    new URL(
      "../public/featured/night-tavern-golden-tree.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
function memory() {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
  return { data, store };
}
test("saved and exported versions retain the complete plan and cannot mutate the source", () => {
  const { store } = memory();
  const copy = validateExample(original);
  saveExample(store, copy);
  copy.plan.visual.clothes = "#123456";
  const restored = validateExample(
    JSON.parse(JSON.stringify(readExamples(store)[0])),
  );
  assert.deepEqual(restored, original);
  assert.throws(() => saveExample(store, original), /已保存/);
  assert.equal(readExamples(store).length, 1);
});
test("invalid imports, corrupt storage and quota failure never replace existing data", () => {
  const { store, data } = memory();
  saveExample(store, original);
  const before = [...data];
  assert.throws(
    () =>
      saveExample(store, {
        ...original,
        id: "new",
        highlights: [{ title: "bad", time: 9999 }],
      }),
    /范围/,
  );
  assert.deepEqual([...data], before);
  assert.throws(
    () =>
      saveExample(
        {
          ...store,
          setItem: () => {
            throw Error("quota");
          },
        },
        { ...original, id: "new" },
      ),
    /quota/,
  );
  assert.deepEqual([...data], before);
  const corrupt = {
    getItem: () => "not json",
    setItem: () => assert.fail("must not overwrite corrupt library"),
    removeItem: () => {},
  };
  assert.throws(() => saveExample(corrupt, original));
});
