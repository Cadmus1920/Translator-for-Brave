// --------------------------------------------------------------
// background.js (service worker) – MV3
// --------------------------------------------------------------

/* -----------------------------------------------------------------
 *  Storage key used throughout the extension
 * ----------------------------------------------------------------- */
const STORAGE_KEY = "translatorBubbleSettings";

/* -----------------------------------------------------------------
 *  Message handlers – get / save settings / re‑translate
 * ----------------------------------------------------------------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // --------------------------------------------------------------
  // 1️⃣ Get stored settings (used by the UI)
  // --------------------------------------------------------------
  if (msg.type === "getSettings") {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      sendResponse(res[STORAGE_KEY] || {});
    });
    return true; // keep the channel open for async response
  }

  // --------------------------------------------------------------
  // 2️⃣ Save settings (called by the bubble UI)
  // --------------------------------------------------------------
  if (msg.type === "saveSettings") {
    chrome.storage.local.set({ [STORAGE_KEY]: msg.data }, () => {
      sendResponse(true);
    });
    return true;
  }

  // --------------------------------------------------------------
  // 3️⃣ New – Re‑translate the currently displayed text
  // --------------------------------------------------------------
  if (msg.type === "retranslate") {
    const raw = msg.payload?.text?.trim();

    if (!raw) {
      sendResponse({ ok: false, error: "No text to translate" });
      return true;
    }

    // Load stored settings (may contain a user‑chosen targetLang)
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const stored = result[STORAGE_KEY] || {};
      const uiLang = chrome.i18n.getUILanguage().split("-")[0];
      const targetLang = stored.targetLang || uiLang;

      translateText(raw, targetLang)
        .then(translated => sendResponse({ ok: true, translated }))
        .catch(err => {
          console.error("Re‑translate failed:", err);
          sendResponse({ ok: false, error: err.message });
        });
    });

    return true; // async response
  }

  // If we reach here, the message type is unknown – ignore it.
});

/* -----------------------------------------------------------------
 *  Context‑menu registration – runs on every load
 * ----------------------------------------------------------------- */
function registerContextMenu() {
  // Remove any stale entries first (prevents duplicate‑id errors)
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate-selection",
      title: "Translate selection",
      contexts: ["selection"]
    });
  });
}

// Register when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
});

// Also register immediately when the service worker starts
// (covers manual reloads during development)
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
  // data[0] is an array of translation fragments
  return data[0].map(item => item[0]).join("");
}

/* -----------------------------------------------------------------
 *  Context‑menu click handler – orchestrates the whole flow
 * ----------------------------------------------------------------- */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate-selection") return;

  const raw = info.selectionText?.trim();
  if (!raw) return;

  // --------------------------------------------------------------
  // Load stored settings (may contain a user‑chosen targetLang)
  // --------------------------------------------------------------
  const stored = await new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => {
      resolve(result[STORAGE_KEY] || {});
    });
  });

  // --------------------------------------------------------------
  // Determine language: stored choice overrides UI language
  // --------------------------------------------------------------
  const uiLang = chrome.i18n.getUILanguage().split("-")[0];
  const targetLang = stored.targetLang || uiLang;

  try {
    // ------------------------------------------------------------
    // 1️⃣ Perform the translation
    // ------------------------------------------------------------
    const translated = await translateText(raw, targetLang);

    // ------------------------------------------------------------
    // 2️⃣ Inject UI scripts into the active tab
    // ------------------------------------------------------------
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["constants.js"]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["ui-utils.js"]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["bubble.js"]
    });

    // ------------------------------------------------------------
    // 3️⃣ Show the bubble with the translation
    // ------------------------------------------------------------
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: t => window.showTranslatorBubble(t),
      args: [translated]
    });
  } catch (err) {
    console.error("Translation failed:", err);

    // ------------------------------------------------------------
    // 4️⃣ Send an in‑bubble error message (bubble.js listens for this)
    // ------------------------------------------------------------
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "translationError",
          message: "Could not translate the selected text. Please try again."
        });
      }
    });
  }
});
