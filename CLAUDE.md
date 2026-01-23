# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Translator for Brave is a Chrome/Brave extension (Manifest V3) that translates selected text via Google Translate and displays results in a draggable, resizable popup bubble.

## Development

**Install/Test:** Load unpacked extension at `brave://extensions` (or `chrome://extensions`) with Developer Mode enabled.

**No build step required** - plain JavaScript files are injected directly.

## Architecture

### Service Worker (`background.js`)
- Registers context menu ("Translate selection")
- Handles translation via Google Translate API (`translate.googleapis.com`)
- Manages settings storage (`chrome.storage.local`)
- Injects UI scripts into active tab in order when translation is triggered

### Content Scripts (injected in order)
1. `constants.js` - IDs, z-index values, UI defaults
2. `languages.js` - Supported language codes/names array
3. `validators.js` - Settings validation/sanitization
4. `ui-utils.js` - Theme application, edge snapping, font sizing
5. `drag-handler.js` - Encapsulated drag-to-move with cleanup
6. `resize-handler.js` - Encapsulated resize with cleanup
7. `bubble-ui.js` - Main UI entry point, creates/manages the translator bubble

### Communication Pattern
- Background ↔ Content: `chrome.runtime.sendMessage` for settings load/save and retranslation
- All scripts expose functions/data on `window` object for inter-script access
- Handlers return cleanup functions to prevent memory leaks when bubble closes

### Settings Storage
Key: `translatorBubbleSettings` stores theme, fontSize, dimensions, position, and target language. Validation occurs both in background (server-side) and content scripts (client-side).
