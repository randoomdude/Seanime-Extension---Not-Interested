# Changelog

## 1.2.1

- Clicking an existing Interested or Not interested mark again clears it; selecting the opposite mark switches states.
- Add Interested and Not interested actions to the existing Discover Schedule right-click menu, without row buttons.
- Dismiss the Schedule menu using its native Escape handler; requires the DOM script permission and manual future updates.

## 1.2.0

- Extend Interested and Not interested marks to **Discover → Schedule**.
- Add small **✓ Interested** and **⊘ Not interested** buttons below each show's airing time, since schedule rows do not expose Seanime's media-card plugin menu.
- Reuse saved AniList series IDs so all scheduled episodes share the same mark with Search and Discover cards.
- Show green borders and badges on interested rows; fade negative rows or hide their complete grid items when hiding is enabled.
- Observe newly loaded schedule rows and remove all owned controls and styling when the plugin is disabled.
- Preserve the existing plugin ID, saved marks, and Storage-only permission.
- Add browser regression coverage for schedule controls, duplicate episodes, hiding, fresh-runtime persistence, undo, failed saves, and cleanup.

## 1.1.1

- Add a 512 × 512 PNG icon with red not-interested and green interested symbols.
- Replace the SVG data URLs in the extension manifest and tray with a hosted PNG URL accepted by Seanime's image component.
- Add a custom `marketplace.json` index so users can browse and install the plugin through **Add new repository**.
- Document both the direct extension install URL and the custom marketplace URL.
- Include the icon in downloadable releases. The mark states, saved data, and permissions are unchanged.

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
