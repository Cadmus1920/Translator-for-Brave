const STORAGE_KEY = "translatorBubbleSettings";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getSettings") {
    chrome.storage.local.get([STORAGE_KEY], res => {
      sendResponse(res[STORAGE_KEY] || {});
    });
    return true; // IMPORTANT: keeps message channel open
  }

if (msg.type === "saveSettings") {
  chrome.storage.local.set({ [STORAGE_KEY]: msg.data }, () => {
    sendResponse(true);
  });
  return true;
}
});



chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate selection",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate-selection") return;

  const text = info.selectionText?.trim();
  if (!text) return;

  const targetLang = chrome.i18n.getUILanguage().split("-")[0];

  try {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=auto&tl=" + targetLang +
      "&dt=t&q=" + encodeURIComponent(text);

    const res = await fetch(url);
    const data = await res.json();
    const translated = data[0].map(item => item[0]).join("");

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["bubble.js"]
    }, () => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (t) => window.showTranslatorBubble(t),
        args: [translated]
      });
    });

  } catch (e) {
    console.error("Translation failed:", e);
  }
});
