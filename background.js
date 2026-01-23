// --------------------------------------------------------------
// background.js (service worker) – MV3
// --------------------------------------------------------------

/* -----------------------------------------------------------------
 *  Storage key used throughout the extension
 * ----------------------------------------------------------------- */
const STORAGE_KEY = "translatorBubbleSettings";

/* -----------------------------------------------------------------
 *  Scripts to inject (in order)
 * ----------------------------------------------------------------- */
const UI_SCRIPTS = [
  "constants.js",
  "languages.js",
  "validators.js",
  "ui-utils.js",
  "drag-handler.js",
  "resize-handler.js",
  "bubble-ui.js"
];

/* -----------------------------------------------------------------
 *  Default settings (for validation in service worker)
 * ----------------------------------------------------------------- */
const DEFAULT_SETTINGS = {
  theme: "dark",
  fontSize: 14,
  width: 320,
  height: 180,
  left: 80,
  top: 80,
  minFont: 12,
  maxFont: 20
};

/* -----------------------------------------------------------------
 *  Settings validation (server-side mirror of validators.js)
 * ----------------------------------------------------------------- */
function validateStoredSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const result = {};

  if (raw.theme === "dark" || raw.theme === "light") {
    result.theme = raw.theme;
  }

  if (typeof raw.fontSize === "number" &&
      raw.fontSize >= DEFAULT_SETTINGS.minFont &&
      raw.fontSize <= DEFAULT_SETTINGS.maxFont) {
    result.fontSize = raw.fontSize;
  }

  if (typeof raw.width === "number" && raw.width >= 200) {
    result.width = raw.width;
  }

  if (typeof raw.height === "number" && raw.height >= 120) {
    result.height = raw.height;
  }

  if (typeof raw.left === "number" && raw.left >= 0) {
    result.left = raw.left;
  }

  if (typeof raw.top === "number" && raw.top >= 0) {
    result.top = raw.top;
  }

  if (typeof raw.targetLang === "string" && raw.targetLang.length > 0) {
    result.targetLang = raw.targetLang;
  }

  return result;
}

/* -----------------------------------------------------------------
 *  Message handlers – get / save settings / re-translate
 * ----------------------------------------------------------------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Get stored settings (used by the UI)
  if (msg.type === "getSettings") {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const validated = validateStoredSettings(res[STORAGE_KEY] || {});
      sendResponse(validated);
    });
    return true;
  }

  // Save settings (called by the bubble UI)
  if (msg.type === "saveSettings") {
    const validated = validateStoredSettings(msg.data);
    chrome.storage.local.set({ [STORAGE_KEY]: validated }, () => {
      sendResponse(true);
    });
    return true;
  }

  // Re-translate the currently displayed text
  if (msg.type === "retranslate") {
    const raw = msg.payload?.text?.trim();

    if (!raw) {
      sendResponse({ ok: false, error: "No text to translate" });
      return true;
    }

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const stored = validateStoredSettings(result[STORAGE_KEY] || {});
      const uiLang = chrome.i18n.getUILanguage().split("-")[0];
      const targetLang = stored.targetLang || uiLang;

      translateText(raw, targetLang)
        .then(translated => sendResponse({ ok: true, translated }))
        .catch(err => {
          console.error("Re-translate failed:", err);
          sendResponse({ ok: false, error: err.message });
        });
    });

    return true;
  }
});

/* -----------------------------------------------------------------
 *  Context-menu registration – runs on every load
 * ----------------------------------------------------------------- */
function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate-selection",
      title: "Translate selection",
      contexts: ["selection"]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
});

registerContextMenu();

/* -----------------------------------------------------------------
 *  Translation helper – calls the public Google Translate endpoint
 * ----------------------------------------------------------------- */
async function translateText(text, targetLang) {
  const endpoint = "https://translate.googleapis.com/translate_a/single";
  const params = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: targetLang,
    dt: "t",
    q: text
  });

  const response = await fetch(`${endpoint}?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  return data[0].map(item => item[0]).join("");
}

/* -----------------------------------------------------------------
 *  Inject UI scripts with error handling
 * ----------------------------------------------------------------- */
async function injectUIScripts(tabId) {
  for (const file of UI_SCRIPTS) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [file]
      });
    } catch (err) {
      console.error(`Failed to inject ${file}:`, err);
      throw new Error(`Script injection failed: ${file}`);
    }
  }
}

/* -----------------------------------------------------------------
 *  Context-menu click handler – orchestrates the whole flow
 * ----------------------------------------------------------------- */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate-selection") return;

  const raw = info.selectionText?.trim();
  if (!raw) return;

  // Load stored settings
  const stored = await new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => {
      resolve(validateStoredSettings(result[STORAGE_KEY] || {}));
    });
  });

  const uiLang = chrome.i18n.getUILanguage().split("-")[0];
  const targetLang = stored.targetLang || uiLang;

  try {
    // Perform the translation
    const translated = await translateText(raw, targetLang);

    // Inject UI scripts into the active tab
    await injectUIScripts(tab.id);

    // Show the bubble with the translation
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: t => window.showTranslatorBubble(t),
      args: [translated]
    });
  } catch (err) {
    console.error("Translation failed:", err);

    // Try to show error in bubble if scripts are injected
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "translationError",
        message: "Could not translate the selected text. Please try again."
      });
    } catch {
      // If we can't send message, show notification instead
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: "Translation Failed",
        message: "Could not translate the selected text. Please try again."
      });
    }
  }
});
