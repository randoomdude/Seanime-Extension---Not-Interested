## Thumbnail and installation links

Adds a 512 × 512 PNG icon with red and green interest symbols. The extension manifest and tray now use a hosted `.png` URL, which fixes Seanime showing a blank thumbnail for the previous SVG data URL.

People can install directly using the manifest URL below, or add this custom marketplace index in **Marketplace → Add new repository**:

```text
https://raw.githubusercontent.com/randoomdude/Seanime-Extension---Not-Interested/main/marketplace.json
```

The icon is also included as a release attachment. Saved marks, interested/not-interested behavior, and the Storage-only permission are unchanged.

## Interested markers

**Mark as interested** replaces the old **Restore interest** menu item. Interested anime cards show a green border and green **Interested** badge in Search and Discover.

**Hide not interested series** hides only negative marks. Interested cards remain visible and keep their green markings. Choosing a new state replaces the old one; **Clear mark** in the tray returns a series to an unmarked state.

Existing marks from the local 1.0.0 plugin are preserved. Update in place using the same plugin ID; do not uninstall if you want to retain your saved choices.

## Install

In Seanime, open **Extensions → Installed → Add extensions**, paste the manifest URL below, and approve the plugin's **Storage** permission:

```text
https://raw.githubusercontent.com/randoomdude/Seanime-Extension---Not-Interested/main/local-anime-not-interested.json
```

Or download the attached `local-anime-not-interested.json`, place it in your Seanime extensions folder, and reload/restart Seanime. The JSON includes the complete plugin; `plugin.js` is provided for source review.

## Validation

Tested against Seanime 3.10.3's card markup and plugin APIs. Browser fixture tests passed for both mark states, green styling, visibility while hiding, lazy-grid placeholders, switching states, fresh-runtime persistence with simulated storage, undo, save failures, cleanup, and preservation of earlier negative marks. Seanime 3.10.3 loaded the updated plugin locally.

See [README](https://github.com/randoomdude/Seanime-Extension---Not-Interested#readme) for controls, backups, and development instructions.
