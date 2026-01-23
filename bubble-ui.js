// bubble-ui.js - Main translator bubble UI

(() => {
  // Get constants and utilities from window (injected by earlier scripts)
  const {
    BUBBLE_ID, UI_DEFAULTS, Z_INDEX, Z_INDEX_FULLSCREEN,
    LANGUAGES, clamp, applyTheme, applyFontSize, showError,
    DragHandler, ResizeHandler, validateSettings
  } = window;

  // --------------------------------------------------------------
  // Messaging helpers (load / save settings)
  // --------------------------------------------------------------
  function loadSettings() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: "getSettings" }, res => {
        const validated = validateSettings(res || {}, UI_DEFAULTS);
        resolve(validated);
      });
    });
  }

  function saveSettings(settings) {
    chrome.runtime.sendMessage({ type: "saveSettings", data: settings });
  }

  // --------------------------------------------------------------
  // Listen for error messages from background.js
  // --------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
    if (msg.type === "translationError") {
      showError(msg.message);
    }
  });

  // --------------------------------------------------------------
  // Main entry point – called from background.js
  // --------------------------------------------------------------
  window.showTranslatorBubble = async (text) => {
    // Re-use existing bubble if it already exists
    let bubble = document.getElementById(BUBBLE_ID);
    const stored = await loadSettings();

    if (bubble) {
      const content = bubble.querySelector("#tb-content");
      if (content) content.textContent = text;
      return;
    }

    // Track cleanup functions for proper teardown
    const cleanupFns = [];

    // Declare prevGeometry before use (fixes hoisting bug)
    let prevGeometry = null;

    // Build the bubble DOM
    bubble = document.createElement("div");
    bubble.id = BUBBLE_ID;
    bubble.setAttribute("role", "dialog");
    bubble.setAttribute("aria-modal", "true");
    bubble.setAttribute("aria-label", "Translation result");

    bubble.innerHTML = `
      <div id="tb-header">
        <span id="tb-title">Translator</span>
        <select id="tb-lang-select"
                aria-label="Target language"
                title="Choose translation language"></select>
        <div id="tb-buttons">
          <button id="tb-font-minus" aria-label="Decrease font size">A−</button>
          <button id="tb-font-plus" aria-label="Increase font size">A+</button>
          <button id="tb-clear" aria-label="Clear text">🧹</button>
          <button id="tb-theme" aria-label="Toggle dark/light theme">🌗</button>
          <button id="tb-fullscreen" aria-label="Toggle full-screen">⛶</button>
          <button id="tb-copy" aria-label="Copy to clipboard">📋</button>
          <button id="tb-close" aria-label="Close dialog">✕</button>
        </div>
      </div>
      <div id="tb-error" role="alert" aria-live="assertive"
           style="display:none;padding:4px 8px;color:#b71c1c;background:#ffebee;"></div>
      <div id="tb-content" tabindex="0" aria-live="polite" role="status"></div>
      <div id="tb-resize" aria-hidden="true"></div>
    `;

    // Grab frequently used elements
    const header = bubble.querySelector("#tb-header");
    const content = bubble.querySelector("#tb-content");
    const resizer = bubble.querySelector("#tb-resize");
    const btnMinus = bubble.querySelector("#tb-font-minus");
    const btnPlus = bubble.querySelector("#tb-font-plus");
    const btnClear = bubble.querySelector("#tb-clear");
    const btnCopy = bubble.querySelector("#tb-copy");
    const btnTheme = bubble.querySelector("#tb-theme");
    const btnClose = bubble.querySelector("#tb-close");
    const btnFull = bubble.querySelector("#tb-fullscreen");
    const langSelect = bubble.querySelector("#tb-lang-select");

    // Populate the language selector
    LANGUAGES.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.code;
      opt.textContent = l.name;
      langSelect.appendChild(opt);
    });

    const uiLang = chrome.i18n.getUILanguage().split("-")[0];
    const currentLang = stored.targetLang || uiLang;
    langSelect.value = currentLang;

    // State
    let theme = stored.theme || UI_DEFAULTS.theme;
    let fontSize = stored.fontSize || UI_DEFAULTS.fontSize;
    let isFullScreen = false;

    const startW = stored.width || UI_DEFAULTS.width;
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

    // Apply initial styles
    Object.assign(bubble.style, {
      position: "fixed",
      top: `${startT}px`,
      left: `${startL}px`,
      width: `${startW}px`,
      height: `${startH}px`,
      borderRadius: "10px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      zIndex: String(Z_INDEX),
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    });

    Object.assign(header.style, {
      padding: "8px 10px",
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

    const refreshTheme = () => applyTheme(bubble, theme);
    const refreshFont = () => applyFontSize(content, fontSize);
    refreshTheme();
    refreshFont();

    // Close with proper cleanup
    const closeBubble = () => {
      cleanupFns.forEach(fn => fn());
      bubble.remove();
    };

    // Initialize handlers with cleanup tracking
    cleanupFns.push(DragHandler(bubble, header, UI_DEFAULTS, (pos) => {
      saveSettings({ ...stored, left: pos.left, top: pos.top });
    }));

    cleanupFns.push(ResizeHandler(bubble, resizer, UI_DEFAULTS, (size) => {
      saveSettings({ ...stored, width: size.width, height: size.height });
    }));

    // Language change handler
    langSelect.addEventListener("change", () => {
      const newLang = langSelect.value;
      saveSettings({ ...stored, targetLang: newLang });

      chrome.runtime.sendMessage(
        { type: "retranslate", payload: { text: content.textContent } },
        response => {
          if (response?.ok) {
            content.textContent = response.translated;
            content.focus();
          } else {
            showError(response?.error || "Failed to refresh translation");
          }
        }
      );
    });

    // Button actions
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
          zIndex: String(Z_INDEX_FULLSCREEN)
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
          borderRadius: "10px",
          zIndex: String(Z_INDEX)
        });
        resizer.style.display = "";
        isFullScreen = false;
      }
    };

    btnClose.onclick = closeBubble;

    // Escape key handling
    bubble.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        if (isFullScreen) btnFull.click();
        else closeBubble();
      }
    });

    // Insert the translated text and attach the bubble
    content.textContent = text;
    content.focus();
    document.body.appendChild(bubble);
  };
})();
