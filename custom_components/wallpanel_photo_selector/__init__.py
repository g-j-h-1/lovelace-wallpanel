"""WallPanel Photo Selector integration."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store

from .const import DOMAIN, DEFAULT_MEDIA_PATH, DEFAULT_SCAN_INTERVAL
from .scanner import scan_photo_directory

_LOGGER = logging.getLogger(__name__)
STORAGE_VERSION = 1
WS_TYPE = f"{DOMAIN}/photos"


@websocket_api.websocket_command({vol.Required("type"): WS_TYPE})
@websocket_api.async_response
async def websocket_get_photos(hass: HomeAssistant, connection, msg) -> None:
    """Return the current indexed photo metadata to a WallPanel client."""
    entries = hass.data.get(DOMAIN, {})
    if not entries:
        connection.send_result(msg["id"], {"photos": [], "last_scan": None})
        return
    # One integration entry is enforced by the config flow's unique ID.
    data = next(iter(entries.values()))
    photos = [
        {
            "path": item["path"],
            "rating": item.get("rating", 0),
            "weight": max(1, int(item.get("rating", 0))),
            "orientation": item.get("orientation", "unknown"),
        }
        for item in data["photos"].values()
    ]
    connection.send_result(msg["id"], {
        "photos": photos,
        "media_folder": Path(data["media_path"]).name,
        "last_scan": data.get("last_scan"),
    })


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    websocket_api.async_register_command(hass, websocket_get_photos)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    media_path = Path(entry.options.get("media_path", entry.data.get("media_path", DEFAULT_MEDIA_PATH))).resolve()
    interval = int(entry.options.get("scan_interval", entry.data.get("scan_interval", DEFAULT_SCAN_INTERVAL)))
    if not media_path.is_dir():
        _LOGGER.warning("Photo directory %s does not exist yet; it will be checked on the next scan", media_path)

    store = Store(hass, STORAGE_VERSION, f"{DOMAIN}_{entry.entry_id}")
    cached = await store.async_load() or {"photos": {}, "last_scan": None}
    data = {
        "media_path": str(media_path),
        "scan_interval": interval,
        "photos": cached.get("photos", {}),
        "last_scan": cached.get("last_scan"),
        "store": store,
        "lock": asyncio.Lock(),
        "unload_callback": None,
    }
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = data

    async def _scan(_now=None) -> None:
        async with data["lock"]:
            try:
                photos, summary = await hass.async_add_executor_job(
                    scan_photo_directory, media_path, data["photos"]
                )
                data["photos"] = photos
                data["last_scan"] = summary["completed_at"]
                await store.async_save({"photos": photos, "last_scan": data["last_scan"]})
                _LOGGER.info(
                    "Photo scan complete: %s found, %s added, %s modified, %s deleted",
                    summary["found"], summary["added"], summary["modified"], summary["deleted"],
                )
            except Exception:
                _LOGGER.exception("Unable to scan photo directory %s", media_path)

    await _scan()
    data["unload_callback"] = async_track_time_interval(
        hass, _scan, timedelta(minutes=interval)
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    if data and data.get("unload_callback"):
        data["unload_callback"]()
    if not hass.data.get(DOMAIN):
        hass.data.pop(DOMAIN, None)
    return True
