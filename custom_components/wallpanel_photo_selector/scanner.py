"""Incremental JPEG metadata scanner for the WallPanel photo library."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from typing import Any

IMAGE_SUFFIXES = {".jpg", ".jpeg"}
XMP_NAMESPACE = "{http://ns.adobe.com/xap/1.0/}"
RDF_NAMESPACE = "{http://www.w3.org/1999/02/22-rdf-syntax-ns#}"
SOF_MARKERS = {
    0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
    0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
}


def _jpeg_metadata(path: Path) -> tuple[int | None, int | None, int]:
    """Return width, height and Lightroom XMP rating (0 means unrated)."""
    width = height = None
    rating = 0
    with path.open("rb") as image:
        if image.read(2) != b"\xff\xd8":
            raise ValueError("Not a JPEG file")
        while True:
            marker_start = image.read(1)
            if not marker_start:
                break
            if marker_start != b"\xff":
                continue
            marker_byte = image.read(1)
            while marker_byte == b"\xff":
                marker_byte = image.read(1)
            if not marker_byte:
                break
            marker = marker_byte[0]
            if marker in (0xD9, 0xDA):
                break
            if marker in (0x01, *range(0xD0, 0xD8)):
                continue
            length_bytes = image.read(2)
            if len(length_bytes) != 2:
                break
            segment_length = int.from_bytes(length_bytes, "big")
            if segment_length < 2:
                break
            payload_length = segment_length - 2

            if marker in SOF_MARKERS:
                payload = image.read(payload_length)
                if len(payload) >= 5:
                    height = int.from_bytes(payload[1:3], "big")
                    width = int.from_bytes(payload[3:5], "big")
                continue

            if marker == 0xE1:
                payload = image.read(payload_length)
                if payload.startswith(XMP_NAMESPACE.encode("ascii")):
                    packet = payload[len(XMP_NAMESPACE):].rstrip(b"\x00")
                    parsed_rating = _extract_rating(packet)
                    if parsed_rating is not None:
                        rating = parsed_rating
                continue
            image.seek(payload_length, 1)

    return width, height, rating


def _extract_rating(packet: bytes) -> int | None:
    """Read xmp:Rating from either RDF attributes or element text."""
    try:
        root = ET.fromstring(packet)
    except ET.ParseError:
        # Lightroom normally writes a simple xmp:Rating attribute. This
        # fallback handles packets with harmless XML declarations/leading bytes.
        match = re.search(rb'<(?:[A-Za-z0-9_-]+:)?Description\b[^>]*\bxmp:Rating=["\'](-?\d+)["\']', packet)
        if match:
            return max(0, min(5, int(match.group(1))))
        return None

    for element in root.iter():
        for key, value in element.attrib.items():
            if key.rsplit("}", 1)[-1] == "Rating":
                try:
                    return max(0, min(5, int(float(value))))
                except (TypeError, ValueError):
                    pass
        if element.tag.rsplit("}", 1)[-1] == "Rating" and element.text:
            try:
                return max(0, min(5, int(float(element.text.strip()))))
            except (TypeError, ValueError):
                pass
    return None


def scan_photo_directory(
    root: Path, previous: dict[str, dict[str, Any]]
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    """Scan recursively, parsing only new or changed JPEGs and pruning deletions."""
    root = root.resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"Photo directory does not exist: {root}")

    current: dict[str, dict[str, Any]] = {}
    added = modified = unchanged = 0
    for path in sorted(root.rglob("*")):
        if path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        try:
            # Do not follow symlinks out of the configured media directory.
            resolved_path = path.resolve(strict=True)
            if not resolved_path.is_relative_to(root) or not resolved_path.is_file():
                continue
            relative = path.relative_to(root).as_posix()
            stat = resolved_path.stat()
            old = previous.get(relative)
            if old and old.get("mtime_ns") == stat.st_mtime_ns and old.get("size") == stat.st_size:
                current[relative] = old
                unchanged += 1
                continue
            width, height, rating = _jpeg_metadata(resolved_path)
            current[relative] = {
                "path": relative,
                "size": stat.st_size,
                "mtime_ns": stat.st_mtime_ns,
                "rating": rating,
                "orientation": (
                    "landscape" if width and height and width > height
                    else "portrait" if width and height and height > width
                    else "square" if width and height
                    else "unknown"
                ),
                "width": width,
                "height": height,
                "weight": max(1, rating),
            }
            if old is None:
                added += 1
            else:
                modified += 1
        except (OSError, ValueError):
            # Omit unreadable files from this cache snapshot. They remain on disk
            # and will be treated as new candidates on the next scheduled scan.
            continue

    deleted = len(set(previous) - set(current))
    summary = {
        "found": len(current),
        "added": added,
        "modified": modified,
        "deleted": deleted,
        "unchanged": unchanged,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    return current, summary
