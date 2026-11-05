"""Unit tests for the WallPanel Photo Selector JPEG scanner."""

from pathlib import Path
import tempfile
import unittest

from custom_components.wallpanel_photo_selector.scanner import (
    _jpeg_metadata,
    scan_photo_directory,
)


XMP_HEADER = b"http://ns.adobe.com/xap/1.0/\x00"


def jpeg(width=1200, height=800, rating=None):
    """Build a minimal JPEG containing a SOF marker and optional XMP rating."""
    parts = [b"\xff\xd8"]
    if rating is not None:
        packet = (
            b'<x:xmpmeta xmlns:x="adobe:ns:meta/">'
            b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
            + f'<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:Rating="{rating}"/>'.encode()
            + b"</rdf:RDF></x:xmpmeta>"
        )
        payload = XMP_HEADER + packet
        parts.append(b"\xff\xe1" + (len(payload) + 2).to_bytes(2, "big") + payload)
    sof = bytes([8]) + height.to_bytes(2, "big") + width.to_bytes(2, "big") + bytes([3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0])
    parts.append(b"\xff\xc0" + (len(sof) + 2).to_bytes(2, "big") + sof)
    parts.append(b"\xff\xd9")
    return b"".join(parts)


class ScannerTests(unittest.TestCase):
    def test_reads_rating_and_dimensions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rated.jpg"
            path.write_bytes(jpeg(800, 1200, 4))
            self.assertEqual(_jpeg_metadata(path), (800, 1200, 4))

    def test_unrated_image_has_zero_rating(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "unrated.jpg"
            path.write_bytes(jpeg(rating=None))
            self.assertEqual(_jpeg_metadata(path), (1200, 800, 0))

    def test_scanner_assigns_orientation_and_minimum_weight(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "portrait.jpg").write_bytes(jpeg(800, 1200, 0))
            (root / "landscape.jpg").write_bytes(jpeg(1600, 900, 5))
            photos, summary = scan_photo_directory(root, {})
            self.assertEqual(photos["portrait.jpg"]["orientation"], "portrait")
            self.assertEqual(photos["portrait.jpg"]["weight"], 1)
            self.assertEqual(photos["landscape.jpg"]["orientation"], "landscape")
            self.assertEqual(photos["landscape.jpg"]["weight"], 5)
            self.assertEqual(summary["added"], 2)

    def test_unreadable_image_is_pruned_and_retried_next_scan(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bad = root / "bad.jpg"
            bad.write_bytes(b"not a jpeg")
            first, summary = scan_photo_directory(root, {"bad.jpg": {"rating": 3}})
            self.assertNotIn("bad.jpg", first)
            self.assertEqual(summary["deleted"], 1)
            bad.write_bytes(jpeg(rating=3))
            second, summary = scan_photo_directory(root, first)
            self.assertEqual(second["bad.jpg"]["rating"], 3)
            self.assertEqual(summary["added"], 1)

    def test_unchanged_file_uses_cached_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "same.jpg").write_bytes(jpeg(rating=2))
            first, _ = scan_photo_directory(root, {})
            second, summary = scan_photo_directory(root, first)
            self.assertEqual(second, first)
            self.assertEqual(summary["unchanged"], 1)


if __name__ == "__main__":
    unittest.main()
