/**
 * Photo ordering for the WallPanel Photo Selector.
 * Kept independent of the card so the selection rules can be unit-tested.
 */
export function orderPhotos(items, recent = [], historySize = 5, random = Math.random) {
  const candidates = items.map((item) => ({
    ...item,
    weight: Math.max(1, Number(item.weight) || 1),
  }));
  const orientationByUrl = new Map(candidates.map((item) => [item.url, item.orientation]));
  const ordered = [];
  // Continue the orientation rule from the last image shown before a list refresh.
  let previousOrientation = recent.length ? (orientationByUrl.get(recent[recent.length - 1]) || null) : null;

  while (candidates.length) {
    let eligible = candidates;
    if (previousOrientation === "portrait") {
      const landscapes = candidates.filter((item) => item.orientation === "landscape");
      if (landscapes.length) eligible = landscapes;
    }
    if (ordered.length < historySize) {
      const fresh = eligible.filter((item) => !recent.includes(item.url));
      if (fresh.length) eligible = fresh;
    }

    let selected = eligible[0];
    let bestKey = Infinity;
    for (const item of eligible) {
      const key = -Math.log(Math.max(Number.EPSILON, random())) / item.weight;
      if (key < bestKey) {
        bestKey = key;
        selected = item;
      }
    }
    ordered.push(selected.url);
    previousOrientation = selected.orientation;
    candidates.splice(candidates.indexOf(selected), 1);
  }

  // Rotate the cycle so wraparound also obeys portrait -> landscape.
  if (ordered.length > 1 && orientationByUrl.get(ordered[ordered.length - 1]) === "portrait") {
    const firstLandscape = ordered.findIndex((url) => orientationByUrl.get(url) === "landscape");
    if (firstLandscape > 0) ordered.push(...ordered.splice(0, firstLandscape));
  }
  return ordered;
}
/**
 * Match Home Assistant media-source IDs to scanner-relative photo metadata.
 * WallPanel's media browser supplies IDs such as
 * media-source://media_source/local/PortalPhotos/album/photo.jpg.
 */
export function matchPhotoMetadata(urls, photos, mediaFolder = "PortalPhotos") {
  const metadata = new Map((photos || []).map((photo) => [photo.path, photo]));
  const folderPrefix = mediaFolder ? `${mediaFolder}/` : "";
  const candidates = urls.map((url) => {
    const marker = "/local/";
    const position = url.indexOf(marker);
    if (position < 0) return null;
    let relativePath;
    try {
      relativePath = decodeURIComponent(url.slice(position + marker.length));
    } catch (_error) {
      relativePath = url.slice(position + marker.length);
    }
    if (folderPrefix && relativePath.startsWith(folderPrefix)) {
      relativePath = relativePath.slice(folderPrefix.length);
    }
    const photo = metadata.get(relativePath);
    return photo
      ? { url, weight: Math.max(1, Number(photo.rating) || 0), orientation: photo.orientation }
      : null;
  });
  return candidates.every(Boolean) ? candidates : null;
}
