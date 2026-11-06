import test from "node:test";
import assert from "node:assert/strict";
import { getRatingFrequency, matchPhotoMetadata, orderPhotos } from "../photo-selector.mjs";

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
    { url: "previous-portrait", orientation: "portrait", weight: 1 },
    { url: "recent-landscape", orientation: "landscape", weight: 1 },
    { url: "fresh-portrait", orientation: "portrait", weight: 1 },
  ];
  // The last displayed image was a portrait. Even though the landscape is
  // recent, orientation safety takes priority over the repeat-avoidance rule.
  const result = orderPhotos(photos, ["recent-landscape", "previous-portrait"], 2, stableRandom);
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

test("media-source IDs match scanner paths including nested and encoded filenames", () => {
  const urls = [
    "media-source://media_source/local/PortalPhotos/album/Match%20day.jpg",
    "media-source://media_source/local/PortalPhotos/portrait.jpg",
  ];
  const photos = [
    { path: "album/Match day.jpg", rating: 5, orientation: "landscape" },
    { path: "portrait.jpg", rating: 0, orientation: "portrait" },
  ];
  assert.deepEqual(matchPhotoMetadata(urls, photos, "PortalPhotos"), [
    { url: urls[0], weight: 5, orientation: "landscape" },
    { url: urls[1], weight: 1, orientation: "portrait" },
  ]);
});

test("metadata matching fails closed when any media item is unmatched", () => {
  const urls = [
    "media-source://media_source/local/PortalPhotos/known.jpg",
    "media-source://media_source/local/PortalPhotos/missing.jpg",
  ];
  const photos = [{ path: "known.jpg", rating: 3, orientation: "landscape" }];
  assert.equal(matchPhotoMetadata(urls, photos, "PortalPhotos"), null);
});

test("metadata matching rejects non-local media source identifiers", () => {
  const urls = ["media-source://media_source/other/PortalPhotos/photo.jpg"];
  const photos = [{ path: "photo.jpg", rating: 3, orientation: "landscape" }];
  assert.equal(matchPhotoMetadata(urls, photos, "PortalPhotos"), null);
});


test("default rating frequencies preserve the existing relative weighting", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((rating) => getRatingFrequency(rating)), [1, 1, 2, 3, 4, 5]);
});

test("configured frequency overrides defaults and zero excludes a rating", () => {
  const urls = [
    "media-source://media_source/local/PortalPhotos/unrated.jpg",
    "media-source://media_source/local/PortalPhotos/one.jpg",
    "media-source://media_source/local/PortalPhotos/five.jpg",
  ];
  const photos = [
    { path: "unrated.jpg", rating: 0, orientation: "landscape" },
    { path: "one.jpg", rating: 1, orientation: "landscape" },
    { path: "five.jpg", rating: 5, orientation: "landscape" },
  ];
  const candidates = matchPhotoMetadata(urls, photos, "PortalPhotos", { 0: 0, 1: 3, 5: 0 });
  assert.deepEqual(candidates.map((item) => item.weight), [0, 3, 0]);
  assert.deepEqual(orderPhotos(candidates, [], 0, stableRandom), [urls[1]]);
});

test("orderPhotos never returns photos with zero or invalid weights", () => {
  const photos = [
    { url: "excluded", orientation: "landscape", weight: 0 },
    { url: "invalid", orientation: "landscape", weight: -1 },
    { url: "included", orientation: "landscape", weight: 2 },
  ];
  assert.deepEqual(orderPhotos(photos, [], 0, stableRandom), ["included"]);
});
