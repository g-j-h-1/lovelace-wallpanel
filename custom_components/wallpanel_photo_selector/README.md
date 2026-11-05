# WallPanel Photo Selector

An optional companion integration and WallPanel source change for rating-aware selection of a local Home Assistant photo library.

## What it does

- Recursively indexes JPEG/JPG files in the configured Home Assistant media folder (default: `/media/PortalPhotos`).
- Reads Lightroom XMP star ratings and JPEG pixel dimensions.
- Treats unrated and 1-star images equally (weight 1); 2–5 stars use their numeric rating as the selection weight.
- Builds a weighted random order without repeating an indexed image within that order.
- When the preceding selected image is portrait, it chooses a landscape next when one remains. If no landscape remains, it falls back to the remaining images rather than getting stuck.
- Leaves WallPanel's image loading/rendering code and previous/next index navigation in place.
- Falls back to normal WallPanel random ordering if the integration or metadata response is unavailable.

## Requirements

This feature requires **both** the Home Assistant custom integration and the modified WallPanel JavaScript from this repository branch. It is not enabled by default.

## Install the Home Assistant integration

1. Copy `custom_components/wallpanel_photo_selector/` from this branch into `<Home Assistant config>/custom_components/wallpanel_photo_selector/`.
2. Restart Home Assistant.
3. In **Settings → Devices & services → Add integration**, add **WallPanel Photo Selector**.
4. Keep the default folder if your photos are in `/media/PortalPhotos`. The folder must exist and be readable by Home Assistant.
5. Allow the first scan to complete. Further scans run at the configured interval (default 15 minutes).

The integration is read-only: it does not modify, move or delete photos.

## Install the modified WallPanel frontend

Use the WallPanel files from this same `photo-selection` branch, not the unmodified upstream release. Install/update the card using the same method you normally use for your WallPanel development build. Back up your current card first.

Add this option to the WallPanel YAML configuration:

```yaml
wallpanel:
  photo_selector_enabled: true
```

Keep `media_order: random` and point `image_url` at the same local media folder, for example:

```yaml
wallpanel:
  image_url: media-source://media_source/local/PortalPhotos
  media_order: random
  photo_selector_enabled: true
```

If `photo_selector_enabled` is omitted or false, normal WallPanel behaviour is retained. The feature currently applies only to the local media-source path and the standard `random` order; other media order modes are unchanged.

## Selection details and limitations

The algorithm uses weighted sampling without replacement to create a shuffled cycle. A 5-star image has five times the selection weight of an unrated/1-star image while candidates remain. This is a relative weighting, not a guarantee that every 5-star image appears before every lower-rated image.

The portrait-to-landscape rule applies within the generated order. If the library has no eligible landscape remaining, it relaxes the rule so playback continues. Square/unknown images are not treated as landscape.

The scanner currently reads JPEG/JPG only. Confirm that your exported JPEGs retain Lightroom's XMP rating metadata. The integration's WebSocket response returns file paths and small metadata fields, not image data.

## Testing status

This branch is a development build. It has not yet been validated against a running Home Assistant instance and the user's complete photo library. Test the integration and WallPanel frontend on a backup/dev installation before enabling it on the live Portal.
