// ----- background.js (service worker) -----
/* No import of constants – we define the key locally */
const STORAGE_KEY = "translatorBubbleSettings";

/* ---------- Message Handlers ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "getSettings") {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      sendResponse(res[STORAGE_KEY] || {});
    });
    return true; // keep channel open
  }

  if (msg.type === "saveSettings") {
    chrome.storage.local.set({ [STORAGE_KEY]: msg.data }, () => {
      sendResponse(true);
    });
    return true;
  }
});

/* ---------- Context Menu ---------- */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate selection",
    contexts: ["selection"]
  });
});

/* ---------- Translation Logic ---------- */
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

/* ---------- Context‑Menu Click Handler ---------- */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate-selection") return;

  const raw = info.selectionText?.trim();
  if (!raw) return;

  const targetLang = chrome.i18n.getUILanguage().split("-")[0];

  try {
    const translated = await translateText(raw, targetLang);

    // 1️⃣ inject constants (exposes STORAGE_KEY & UI_DEFAULTS)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["constants.js"]
    });

    // 2️⃣ inject UI helpers
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["ui-utils.js"]
    });

    // 3️⃣ finally inject the bubble UI (which now reads the globals)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["bubble.js"]
    });

    // Call the UI function that bubble.js defined on the page
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: t => window.showTranslatorBubble(t),
      args: [translated]
    });
  } catch (err) {
    console.error("Translation failed:", err);
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon48.png",
      title: "Translation error",
      message: "Could not translate the selected text. Please try again."
    });
  }
});
