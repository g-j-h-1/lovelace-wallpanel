import test from "node:test";
import assert from "node:assert/strict";
import { getRatingFrequency, matchPhotoMetadata, selectPhoto, filterPhotos, effectiveHistorySize } from "../photo-selector.mjs";

const photos = [
  { url: "p", orientation: "portrait", weight: 1 },
  { url: "l", orientation: "landscape", weight: 5 },
  { url: "l2", orientation: "landscape", weight: 1 },
];
test("zero-rated defaults to zero weight but is configurable", () => {
  assert.equal(getRatingFrequency(0), 0);
  assert.equal(getRatingFrequency(0, {0: 3}), 3);
});
test("weighted choice runs independently on each selection", () => {
  assert.equal(selectPhoto(photos, [], 0, () => 0.5), "l");
  assert.equal(selectPhoto(photos, [], 0, () => 0), "p");
});
test("recent photos excluded until oldest history is relaxed", () => {
  assert.equal(selectPhoto(photos, ["p","l"], 2, () => 0), "l2");
  assert.equal(selectPhoto(photos.slice(0,2), ["p","l"], 2, () => 0), "p");
});
test("portrait must be followed by landscape where available", () => {
  assert.notEqual(selectPhoto(photos, ["p"], 1, () => 0), "p");
});
test("zero weights are never restored during history fallback", () => {
  assert.equal(selectPhoto([{url:"x",weight:0,orientation:"landscape"}], [], 0), null);
});
test("unmatched metadata is excluded individually", () => {
  const urls = ["media-source://media_source/local/PortalPhotos/known.jpg", "media-source://media_source/local/PortalPhotos/missing.jpg"];
  const result = matchPhotoMetadata(urls, [{path:"known.jpg",rating:4,orientation:"landscape"}], "PortalPhotos");
  assert.equal(result.length, 1);
  assert.equal(result[0].weight, 4);
});
test("filename include and exclude regex filters are case insensitive", () => {
  const result = filterPhotos([{url:"/local/2026-Rugby.JPG"}, {url:"/local/2026-Private.jpg"}, {url:"/local/2025-Rugby.jpg"}], "^2026", "private");
  assert.deepEqual(result.map(x=>x.url), ["/local/2026-Rugby.JPG"]);
});
test("invalid regex throws instead of silently passing", () => {
  assert.throws(() => filterPhotos(photos, "[", ""), SyntaxError);
});

test("history never exceeds a quarter of selectable photos", () => {
  const pool = Array.from({length: 10}, (_, i) => ({url: String(i), weight: 1, orientation: "landscape"}));
  assert.equal(effectiveHistorySize(pool, 50), 2);
  assert.equal(effectiveHistorySize(pool.slice(0, 3), 50), 0);
  assert.equal(effectiveHistorySize(pool.concat([{url:"excluded",weight:0}]), 50), 2);
  assert.equal(effectiveHistorySize(pool, 1), 1);
});
test("selection ignores stale history beyond the 25 percent cap", () => {
  const pool = Array.from({length: 8}, (_, i) => ({url: String(i), weight: 1, orientation: "landscape"}));
  assert.equal(selectPhoto(pool, ["0","1","2","3","4","5","6","7"], 50, () => 0), "0");
});
