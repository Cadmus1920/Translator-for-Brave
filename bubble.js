(() => {
  // --------------------------------------------------------------
  // 0️⃣  Injected constants & helpers (already provided by constants.js)
  // --------------------------------------------------------------
  const { STORAGE_KEY, UI_DEFAULTS } = window;
  const { clamp, snapToEdges, applyTheme, applyFontSize } = window;

  // --------------------------------------------------------------
  // 1️⃣  Messaging helpers (load / save settings)
  // --------------------------------------------------------------
  function loadSettings() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: "getSettings" }, res => {
        resolve(res || {});
      });
    });
  }

  function saveSettings(settings) {
    chrome.runtime.sendMessage({ type: "saveSettings", data: settings });
  }

  // --------------------------------------------------------------
  // 2️⃣  **Language list – must be defined before we use it**
  // --------------------------------------------------------------
  const LANGUAGES = [
    { code: "af",   name: "Afrikaans" },
    { code: "sq",   name: "Albanian" },
    { code: "am",   name: "Amharic" },
    { code: "ar",   name: "Arabic" },
    { code: "hy",   name: "Armenian" },
    { code: "az",   name: "Azerbaijani" },
    { code: "eu",   name: "Basque" },
    { code: "be",   name: "Belarusian" },
    { code: "bn",   name: "Bengali" },
    { code: "bs",   name: "Bosnian" },
    { code: "bg",   name: "Bulgarian" },
    { code: "ca",   name: "Catalan" },
    { code: "zh-CN",name: "Chinese (Simplified)" },
    { code: "zh-TW",name: "Chinese (Traditional)" },
    { code: "hr",   name: "Croatian" },
    { code: "cs",   name: "Czech" },
    { code: "da",   name: "Danish" },
    { code: "nl",   name: "Dutch" },
    { code: "en",   name: "English" },
    { code: "et",   name: "Estonian" },
    { code: "fi",   name: "Finnish" },
    { code: "fr",   name: "French" },
    { code: "gl",   name: "Galician" },
    { code: "ka",   name: "Georgian" },
    { code: "de",   name: "German" },
    { code: "el",   name: "Greek" },
    { code: "gu",   name: "Gujarati" },
    { code: "he",   name: "Hebrew" },
    { code: "hi",   name: "Hindi" },
    { code: "hu",   name: "Hungarian" },
    { code: "is",   name: "Icelandic" },
    { code: "id",   name: "Indonesian" },
    { code: "ga",   name: "Irish" },
    { code: "it",   name: "Italian" },
    { code: "ja",   name: "Japanese" },
    { code: "kn",   name: "Kannada" },
    { code: "kk",   name: "Kazakh" },
    { code: "km",   name: "Khmer" },
    { code: "ko",   name: "Korean" },
    { code: "ky",   name: "Kyrgyz" },
    { code: "lo",   name: "Lao" },
    { code: "lv",   name: "Latvian" },
    { code: "lt",   name: "Lithuanian" },
    { code: "mk",   name: "Macedonian" },
    { code: "ms",   name: "Malay" },
    { code: "ml",   name: "Malayalam" },
    { code: "mt",   name: "Maltese" },
    { code: "mr",   name: "Marathi" },
    { code: "mn",   name: "Mongolian" },
    { code: "ne",   name: "Nepali" },
    { code: "no",   name: "Norwegian" },
    { code: "fa",   name: "Persian" },
    { code: "pl",   name: "Polish" },
    { code: "pt",   name: "Portuguese" },
    { code: "pa",   name: "Punjabi" },
    { code: "ro",   name: "Romanian" },
    { code: "ru",   name: "Russian" },
    { code: "sr",   name: "Serbian" },
    { code: "si",   name: "Sinhala" },
    { code: "sk",   name: "Slovak" },
    { code: "sl",   name: "Slovenian" },
    { code: "es",   name: "Spanish" },
    { code: "sw",   name: "Swahili" },
    { code: "sv",   name: "Swedish" },
    { code: "ta",   name: "Tamil" },
    { code: "te",   name: "Telugu" },
    { code: "th",   name: "Thai" },
    { code: "tr",   name: "Turkish" },
    { code: "uk",   name: "Ukrainian" },
    { code: "ur",   name: "Urdu" },
    { code: "uz",   name: "Uzbek" },
    { code: "vi",   name: "Vietnamese" },
    { code: "cy",   name: "Welsh" },
    { code: "yi",   name: "Yiddish" }
  ];

  // --------------------------------------------------------------
  // 3️⃣  Error‑message listener (you already added this)
  // --------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
    if (msg.type === "translationError") {
      showError(msg.message);
    }
  });

  // --------------------------------------------------------------
  // 4️⃣  UI entry point – called from background.js
  // --------------------------------------------------------------
  window.showTranslatorBubble = async (text) => {
    // ------------------------------------------------------------
    // A️⃣  Re‑use existing bubble if it already exists
    // ------------------------------------------------------------
    let bubble = document.getElementById("translator-bubble");
    const stored = await loadSettings();   // ← settings are loaded first

    // If a bubble already exists, just update its text and exit
    if (bubble) {
      const content = bubble.querySelector("#tb-content");
      if (content) content.textContent = text;
      return;
    }

    // ------------------------------------------------------------
    // B️⃣  Create the bubble DOM (includes the empty <select>)
    // ------------------------------------------------------------
    bubble = document.createElement("div");
    bubble.id = "translator-bubble";
    bubble.setAttribute("role", "dialog");
    bubble.setAttribute("aria-modal", "true");
    bubble.setAttribute("aria-label", "Translation result");

    bubble.innerHTML = `
      <div id="tb-header">
        <span id="tb-title">Translator</span>

        <!-- Language selector – will be filled right after this -->
        <select id="tb-lang-select"
                aria-label="Target language"
                title="Choose translation language"></select>

        <div id="tb-buttons">
          <button id="tb-font-minus" aria-label="Decrease font size">A−</button>
          <button id="tb-font-plus" aria-label="Increase font size">A+</button>
          <button id="tb-clear" aria-label="Clear text">🧹</button>
          <button id="tb-theme" aria-label="Toggle dark/light theme">🌗</button>
          <button id="tb-fullscreen" aria-label="Toggle full‑screen">⛶</button>
          <button id="tb-copy" aria-label="Copy to clipboard">📋</button>
          <button id="tb-close" aria-label="Close dialog">✕</button>
        </div>
      </div>

      <div id="tb-error" role="alert" aria-live="assertive"
           style="display:none;padding:4px 8px;color:#b71c1c;background:#ffebee;"></div>

      <div id="tb-content" tabindex="0" aria-live="polite" role="status"></div>
      <div id="tb-resize" aria-hidden="true"></div>
    `;

    // ------------------------------------------------------------
    // C️⃣  Grab references to elements we’ll need
    // ------------------------------------------------------------
    const header   = bubble.querySelector("#tb-header");
    const content  = bubble.querySelector("#tb-content");
    const resizer  = bubble.querySelector("#tb-resize");
    const errorBox = bubble.querySelector("#tb-error");

    const btnMinus = bubble.querySelector("#tb-font-minus");
    const btnPlus  = bubble.querySelector("#tb-font-plus");
    const btnClear = bubble.querySelector("#tb-clear");
    const btnCopy  = bubble.querySelector("#tb-copy");
    const btnTheme = bubble.querySelector("#tb-theme");
    const btnClose = bubble.querySelector("#tb-close");
    const btnFull  = bubble.querySelector("#tb-fullscreen");
    const langSelect = bubble.querySelector("#tb-lang-select"); // ← now it exists!

    // ------------------------------------------------------------
    // D️⃣  **Populate the language selector** (this is the crucial part)
    // ------------------------------------------------------------
    // 1. Fill the <select> with all language options
    LANGUAGES.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.code;
      opt.textContent = l.name;
      langSelect.appendChild(opt);
    });

    // 2. Choose the initial language:
    //    • stored.targetLang if the user previously selected one
    //    • otherwise fall back to the browser UI language
    const uiLang = chrome.i18n.getUILanguage().split("-")[0];
    const currentLang = stored.targetLang || uiLang;
    langSelect.value = currentLang;

    // ------------------------------------------------------------------
// Language selector – store the choice **and** refresh the translation
// ------------------------------------------------------------------
langSelect.addEventListener("change", () => {
  const newLang = langSelect.value;

  // 1️⃣ Persist the new language for future translations
  saveSettings({ ...stored, targetLang: newLang });

  // 2️⃣ Ask the background script to translate the *current* text again
  //    `content.textContent` holds the text that is currently displayed.
  chrome.runtime.sendMessage(
    {
      type: "retranslate",
      payload: { text: content.textContent }   // send the original text
    },
    response => {
      if (response?.ok) {
        // Success – swap in the fresh translation
        content.textContent = response.translated;
        // Give screen‑readers a cue that the content changed
        content.focus();
      } else {
        // Something went wrong – show the in‑bubble error banner
        showError(response?.error || "Failed to refresh translation");
      }
    }
  );
});
    // ------------------------------------------------------------
    // E️⃣  State (theme, font size, geometry, fullscreen)
    // ------------------------------------------------------------
    let theme    = stored.theme   || UI_DEFAULTS.theme;
    let fontSize = stored.fontSize|| UI_DEFAULTS.fontSize;
    let isFullScreen = false;
    const startW = stored.width  || UI_DEFAULTS.width;
    const startH = stored.height || UI_DEFAULTS.height;

    const startL = clamp(
      stored.left ?? UI_DEFAULTS.left,
      UI_DEFAULTS.safeMargin,
      window.innerWidth - startW - UI_DEFAULTS.safeMargin
    );
    const startT = clamp(
      stored.top ?? UI_DEFAULTS.top,
      UI_DEFAULTS.safeTop,
      window.innerHeight - startH - UI_DEFAULTS.safeMargin
    );

    // ------------------------------------------------------------
    // F️⃣  Apply initial CSS, theme, font size, etc.
    // ------------------------------------------------------------
    Object.assign(bubble.style, {
      position: "fixed",
      top: `${startT}px`,
      left: `${startL}px`,
      width: `${startW}px`,
      height: `${startH}px`,
      borderRadius: "10px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      zIndex: "999999",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    });

    Object.assign(header.style, {
      padding: "8px 10px",
      cursor: "default",
      fontWeight: "600",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      userSelect: "none"
    });

    Object.assign(content.style, {
      padding: "10px",
      overflow: "auto",
      flex: "1",
      lineHeight: "1.4",
      whiteSpace: "pre-wrap"
    });

    Object.assign(resizer.style, {
      width: "14px",
      height: "14px",
      position: "absolute",
      right: "2px",
      bottom: "2px",
      cursor: "nwse-resize"
    });

    // Apply theme & font size (helpers from ui‑utils.js)
    const refreshTheme = () => applyTheme(bubble, theme);
    const refreshFont  = () => applyFontSize(content, fontSize);
    refreshTheme();
    refreshFont();

    // ------------------------------------------------------------
    // G️⃣  Button actions (font size, theme, copy, fullscreen, close)
    // ------------------------------------------------------------
    btnPlus.onclick = () => {
      if (fontSize < UI_DEFAULTS.maxFont) {
        fontSize += UI_DEFAULTS.fontStep;
        refreshFont();
        saveSettings({ ...stored, fontSize });
      }
    };
    btnMinus.onclick = () => {
      if (fontSize > UI_DEFAULTS.minFont) {
        fontSize -= UI_DEFAULTS.fontStep;
        refreshFont();
        saveSettings({ ...stored, fontSize });
      }
    };
    btnClear.onclick = () => (content.textContent = "");
    btnCopy.onclick = async () => {
      await navigator.clipboard.writeText(content.textContent);
      const orig = btnCopy.textContent;
      btnCopy.textContent = "✔";
      setTimeout(() => (btnCopy.textContent = orig), 800);
    };
    btnTheme.onclick = () => {
      theme = theme === "dark" ? "light" : "dark";
      refreshTheme();
      saveSettings({ ...stored, theme });
    };
    btnFull.onclick = () => {
      if (!isFullScreen) {
        // Save geometry
        prevGeometry = {
          width: bubble.offsetWidth,
          height: bubble.offsetHeight,
          left: bubble.offsetLeft,
          top: bubble.offsetTop
        };
        Object.assign(bubble.style, {
          top: "0",
          left: "0",
          width: "100vw",
          height: "100vh",
          borderRadius: "0",
          maxWidth: "none",
          maxHeight: "none",
          zIndex: "2147483647"
        });
        resizer.style.display = "none";
        isFullScreen = true;
      } else {
        const { width, height, left, top } = prevGeometry;
        Object.assign(bubble.style, {
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: "10px"
        });
        resizer.style.display = "";
        isFullScreen = false;
      }
    };
    btnClose.onclick = () => bubble.remove();

    // Escape‑key handling (close or exit fullscreen)
    bubble.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        if (isFullScreen) btnFull.click(); else bubble.remove();
      }
    });

    // ------------------------------------------------------------
    // H️⃣  Dragging, resizing, hover‑reveal, etc. (unchanged)
    // ------------------------------------------------------------
    // ... (keep the existing dragging/resizing code you already have)

    // ------------------------------------------------------------
    // I️⃣  Finally, put the translated text into the bubble
    // ------------------------------------------------------------
    content.textContent = text;
    content.focus(); // for screen‑readers
    document.body.appendChild(bubble);
  };
})();
