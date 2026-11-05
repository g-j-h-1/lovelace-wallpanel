# WallPanel Photo Selector (scanner prototype)

This custom integration scans the local Home Assistant media folder recursively and maintains a persistent metadata cache.

## Current scope

- Default folder: `/media/PortalPhotos`
- Scans JPEG and JPG files, including subfolders.
- Reads Lightroom XMP star rating (0/unrated through 5 stars).
- Reads pixel dimensions and classifies landscape, portrait, square or unknown.
- Treats unrated (0) and 1-star photos with the same weight (1).
- Reuses cached metadata when file size and nanosecond modification time are unchanged.
- Adds new files, re-reads modified files, and removes deleted files from the cache.
- Persists the cache using Home Assistant's `Store` helper.
- Runs once when the integration starts, then on the configured interval (default 15 minutes).

## Install for development only

Copy this folder into `<config>/custom_components/wallpanel_photo_selector/`, restart Home Assistant, then add **WallPanel Photo Selector** from Settings → Devices & services → Add integration.

The integration only reads files under the configured `/media/` path. It does not alter or delete photos. It does not yet expose a selection service or connect to WallPanel; that is a later step after scanner testing.

## Cache record

Each photo is keyed by its path relative to the configured root and stores file size, nanosecond modification time, Lightroom rating, pixel dimensions, orientation and selection weight.

## Notes

This is an early prototype. Validate the XMP parser against a sample of your actual Lightroom exports before relying on its ratings. The integration logs scan totals but does not expose a UI entity yet.
