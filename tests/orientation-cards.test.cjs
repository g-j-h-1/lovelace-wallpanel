const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Exercise the actual method from the WallPanel view, without browser globals.
const source = fs.readFileSync(path.join(__dirname, "../wallpanel-src.js"), "utf8");
const start = source.indexOf("\t\tupdateOrientationCardVisibility(mediaElement) {");
const end = source.indexOf("\n\t\tsetDisplayTime() {", start);
assert.ok(start >= 0 && end > start, "Orientation visibility method must exist");
const update = new Function(`return ({${source.slice(start, end)}}).updateOrientationCardVisibility;`)();

function panel() {
  const clock = { style: {} };
  const ticker = { style: {} };
  const weather = { style: {} };
  return {
    clock,
    ticker,
    weather,
    view: {
      orientationCardRules: [
        { element: ticker, allowed: ["landscape"] },
        { element: weather, allowed: ["landscape", "square"] }
      ]
    }
  };
}

test("portrait hides landscape-only cards but leaves unrestricted clock alone", () => {
  const p = panel();
  update.call(p.view, { naturalWidth: 800, naturalHeight: 1200 });
  assert.equal(p.view.currentPhotoOrientation, "portrait");
  assert.equal(p.ticker.style.display, "none");
  assert.equal(p.weather.style.display, "none");
  assert.equal(p.clock.style.display, undefined);
});

test("landscape restores cards previously hidden for portrait", () => {
  const p = panel();
  update.call(p.view, { naturalWidth: 800, naturalHeight: 1200 });
  update.call(p.view, { naturalWidth: 1200, naturalHeight: 800 });
  assert.equal(p.ticker.style.display, "");
  assert.equal(p.weather.style.display, "");
});

test("square and unknown media follow their explicit orientation rules", () => {
  const p = panel();
  update.call(p.view, { naturalWidth: 1000, naturalHeight: 1000 });
  assert.equal(p.ticker.style.display, "none");
  assert.equal(p.weather.style.display, "");
  update.call(p.view, {});
  assert.equal(p.view.currentPhotoOrientation, "unknown");
  assert.equal(p.weather.style.display, "none");
});

test("video dimensions are used when natural image dimensions are absent", () => {
  const p = panel();
  update.call(p.view, { videoWidth: 1920, videoHeight: 1080 });
  assert.equal(p.ticker.style.display, "");
});
