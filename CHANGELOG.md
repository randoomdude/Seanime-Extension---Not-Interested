# Changelog

## 1.1.0

- Replace **Restore interest** in the card and anime page menus with **Mark as interested**.
- Add a green border and green **Interested** badge to interested anime cards in Search and Discover.
- Keep interested cards visible with their green markings when hiding is enabled.
- Rename the hiding switch to **Hide not interested series** so its scope is clear.
- Keep interested and not-interested states mutually exclusive; choosing one replaces the other.
- Show each saved series' state in the tray and provide **Clear mark** to return it to an unmarked state.
- Preserve existing negative marks from the local 1.0.0 plugin, with undo for state changes.
- Add the public install/update manifest, source, installation documentation, portable browser tests, and release workflow.

This is the first public GitHub release; version 1.0.0 was the earlier local plugin.

## 1.0.0 — Local prototype

- Add persistent **not interested** marks from anime card and page menus.
- Fade marked cards and display a red **Not interested** badge in Search and Discover.
- Offer optional hiding, including handling for Search's lazy-grid placeholders.
- Provide display toggles, a searchable saved list, restore, and undo controls.
- Remove visual changes when the plugin is disabled while preserving saved marks.
