import test from "node:test";
import assert from "node:assert/strict";
import { orderPhotos } from "../photo-selector.mjs";

const stableRandom = () => 0.5;

test("portrait is always followed by landscape when one remains", () => {
  const photos = [
    { url: "p1", orientation: "portrait", weight: 1 },
    { url: "p2", orientation: "portrait", weight: 1 },
    { url: "l1", orientation: "landscape", weight: 1 },
    { url: "l2", orientation: "landscape", weight: 1 },
  ];
  const result = orderPhotos(photos, [], 0, stableRandom);
  for (let i = 0; i < result.length - 1; i++) {
    const current = photos.find((p) => p.url === result[i]);
    const next = photos.find((p) => p.url === result[i + 1]);
    if (current.orientation === "portrait") assert.equal(next.orientation, "landscape");
  }
});

test("cycle wraparound is portrait-to-landscape safe", () => {
  const photos = [
    { url: "p1", orientation: "portrait", weight: 1 },
    { url: "p2", orientation: "portrait", weight: 1 },
    { url: "l1", orientation: "landscape", weight: 1 },
  ];
  const result = orderPhotos(photos, [], 0, stableRandom);
  const last = photos.find((p) => p.url === result.at(-1));
  const first = photos.find((p) => p.url === result[0]);
  if (last.orientation === "portrait") assert.equal(first.orientation, "landscape");
});

test("repeat avoidance is secondary to the orientation rule", () => {
  const photos = [
    { url: "recent-landscape", orientation: "landscape", weight: 1 },
    { url: "fresh-portrait", orientation: "portrait", weight: 1 },
  ];
  const result = orderPhotos(photos, ["recent-landscape"], 1, stableRandom);
  assert.equal(result[0], "recent-landscape");
});

test("higher ratings receive greater sampling weight", () => {
  const photos = [
    { url: "one-star", orientation: "landscape", weight: 1 },
    { url: "five-star", orientation: "landscape", weight: 5 },
  ];
  const result = orderPhotos(photos, [], 0, stableRandom);
  assert.equal(result[0], "five-star");
});

test("every input photo appears exactly once", () => {
  const photos = [
    { url: "a", orientation: "portrait", weight: 1 },
    { url: "b", orientation: "landscape", weight: 2 },
    { url: "c", orientation: "square", weight: 3 },
  ];
  const result = orderPhotos(photos, [], 0, stableRandom);
  assert.deepEqual([...result].sort(), ["a", "b", "c"]);
});
