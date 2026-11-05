"""Config flow for WallPanel Photo Selector."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, DEFAULT_MEDIA_PATH, DEFAULT_SCAN_INTERVAL, MIN_SCAN_INTERVAL, MAX_SCAN_INTERVAL


class WallPanelPhotoSelectorConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None) -> FlowResult:
        errors = {}
        if user_input is not None:
            path = user_input["media_path"]
            if not path.startswith("/media/"):
                errors["media_path"] = "invalid_path"
            else:
                await self.async_set_unique_id(DOMAIN)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title="WallPanel Photo Selector", data=user_input)

        schema = vol.Schema({
            vol.Required("media_path", default=DEFAULT_MEDIA_PATH): str,
            vol.Required("scan_interval", default=DEFAULT_SCAN_INTERVAL): vol.All(
                vol.Coerce(int), vol.Range(min=MIN_SCAN_INTERVAL, max=MAX_SCAN_INTERVAL)
            ),
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
