(() => {
  /* --------------------------------------------------------------
   *  Constants (formerly in constants.js)
   * -------------------------------------------------------------- */
  const STORAGE_KEY = "translatorBubbleSettings";

  const UI_DEFAULTS = {
    theme: "dark",
    fontSize: 14,
    width: 320,
    height: 180,
    left: 80,
    top: 80,
    safeMargin: 10,   // margin from screen edges
    safeTop: 40,      // keep bubble below the bookmarks bar
    snapDistance: 24, // distance (px) at which the bubble snaps to an edge
    minFont: 12,
    maxFont: 20,
    fontStep: 2
  };

  /* --------------------------------------------------------------
   *  Utility helpers (formerly in ui-utils.js)
   * -------------------------------------------------------------- */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  /**
   * Snap a bubble element to the nearest screen edge.
   * Returns the final `{ left, top }` coordinates.
   */
  function snapToEdges(box, { safeMargin, safeTop, snapDistance }) {
    const leftPos = box.offsetLeft;
    const topPos = box.offsetTop;
    const width = box.offsetWidth;
    const height = box.offsetHeight;

    let left = leftPos;
    let top = topPos;

    // Left edge
    if (leftPos < snapDistance) left = safeMargin;

    // Right edge
    if (window.innerWidth - (leftPos + width) < snapDistance) {
      left = window.innerWidth - width - safeMargin;
    }

    // Top edge
    if (topPos - safeTop < snapDistance) top = safeTop;

    // Bottom edge
    if (window.innerHeight - (topPos + height) < snapDistance) {
      top = window.innerHeight - height - safeMargin;
    }

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    return { left, top };
  }

  /**
   * Apply dark / light theme to the bubble.
   */
  function applyTheme(el, theme) {
    const isDark = theme === "dark";
    const bg = isDark ? "#0f1115" : "#f2f2f2";
    const fg = isDark ? "#fff" : "#000";
    const headerBg = isDark ? "#161a22" : "#e4e4e4";
    const border = isDark ? "1px solid #333" : "1px solid #bbb";

    Object.assign(el.style, { background: bg, color: fg, border });
    const header = el.querySelector("#tb-header");
    if (header) header.style.background = headerBg;
    return { bg, fg, headerBg, border };
  }

  /**
   * Set the content font size.
   */
  function applyFontSize(contentEl, size) {
    contentEl.style.fontSize = `${size}px`;
  }

  /* --------------------------------------------------------------
   *  Messaging helpers (talk to background for settings)
   * -------------------------------------------------------------- */
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

  /* --------------------------------------------------------------
   *  Main UI function – exposed globally as window.showTranslatorBubble
   * -------------------------------------------------------------- */
  window.showTranslatorBubble = async (text) => {
    // -----------------------------------------------------------------
    // 1️⃣ Re‑use existing bubble if it already exists
    // -----------------------------------------------------------------
    let bubble = document.getElementById("translator-bubble");
    const stored = await loadSettings();

    if (bubble) {
      const content = bubble.querySelector("#tb-content");
      if (content) content.textContent = text;
      return;
    }

    // -----------------------------------------------------------------
    // 2️⃣ Create the bubble DOM
    // -----------------------------------------------------------------
    bubble = document.createElement("div");
    bubble.id = "translator-bubble";
    bubble.setAttribute("role", "dialog");           // accessibility
    bubble.setAttribute("aria-modal", "true");
    bubble.setAttribute("aria-label", "Translation result");

    bubble.innerHTML = `
      <div id="tb-header">
        <span id="tb-title">Translator</span>
        <div id="tb-buttons">
          <button id="tb-font-minus" aria-label="Decrease font size">A−</button>
          <button id="tb-font-plus" aria-label="Increase font size">A+</button>
          <button id="tb-clear" aria-label="Clear text">🧹</button>
          <button id="tb-theme" aria-label="Toggle dark/light theme">🌗</button>
          <button id="tb-copy" aria-label="Copy to clipboard">📋</button>
          <button id="tb-close" aria-label="Close dialog">✕</button>
        </div>
      </div>
      <div id="tb-content" tabindex="0"></div>
      <div id="tb-resize" aria-hidden="true"></div>
    `;

    document.body.appendChild(bubble);

    // -----------------------------------------------------------------
    // 3️⃣ Grab references to frequently used elements
    // -----------------------------------------------------------------
    const header   = bubble.querySelector("#tb-header");
    const content  = bubble.querySelector("#tb-content");
    const resizer  = bubble.querySelector("#tb-resize");

    const btnMinus = bubble.querySelector("#tb-font-minus");
    const btnPlus  = bubble.querySelector("#tb-font-plus");
    const btnClear = bubble.querySelector("#tb-clear");
    const btnCopy  = bubble.querySelector("#tb-copy");
    const btnTheme = bubble.querySelector("#tb-theme");
    const btnClose = bubble.querySelector("#tb-close");

    // -----------------------------------------------------------------
    // 4️⃣ State (theme, font size, geometry)
    // -----------------------------------------------------------------
    let theme    = stored.theme   || UI_DEFAULTS.theme;
    let fontSize = stored.fontSize|| UI_DEFAULTS.fontSize;

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

    // -----------------------------------------------------------------
    // 5️⃣ Apply initial CSS
    // -----------------------------------------------------------------
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

    // -----------------------------------------------------------------
    // 6️⃣ Theme & font helpers
    // -----------------------------------------------------------------
    const refreshTheme = () => applyTheme(bubble, theme);
    const refreshFont  = () => applyFontSize(content, fontSize);
    refreshTheme();
    refreshFont();

    // -----------------------------------------------------------------
    // 7️⃣ Button actions
    // -----------------------------------------------------------------
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
      const original = btnCopy.textContent;
      btnCopy.textContent = "✔";
      setTimeout(() => (btnCopy.textContent = original), 800);
    };

    btnTheme.onclick = () => {
      theme = theme === "dark" ? "light" : "dark";
      refreshTheme();
      saveSettings({ ...stored, theme });
    };

    btnClose.onclick = () => bubble.remove();

    // Allow Esc key to close the bubble
    bubble.addEventListener("keydown", e => {
      if (e.key === "Escape") bubble.remove();
    });

    // -----------------------------------------------------------------
    // 8️⃣ Dragging (with clamping)
    // -----------------------------------------------------------------
    let dragging = false,
        dragOffsetX = 0,
        dragOffsetY = 0;

    header.addEventListener("mousedown", e => {
      dragging = true;
      dragOffsetX = e.clientX - bubble.offsetLeft;
      dragOffsetY = e.clientY - bubble.offsetTop;
    });

    document.addEventListener("mousemove", e => {
      if (!dragging) return;

      const maxLeft = window.innerWidth - bubble.offsetWidth - UI_DEFAULTS.safeMargin;
      const maxTop  = window.innerHeight - bubble.offsetHeight - UI_DEFAULTS.safeMargin;

      let newLeft = e.clientX - dragOffsetX;
      let newTop  = e.clientY - dragOffsetY;

      newLeft = clamp(newLeft, UI_DEFAULTS.safeMargin, maxLeft);
      newTop  = clamp(newTop, UI_DEFAULTS.safeTop, maxTop);

      bubble.style.left = `${newLeft}px`;
      bubble.style.top  = `${newTop}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;

      // Snap to nearest edge and persist position
      const { left, top } = snapToEdges(bubble, {
        safeMargin: UI_DEFAULTS.safeMargin,
        safeTop: UI_DEFAULTS.safeTop,
        snapDistance: UI_DEFAULTS.snapDistance
      });
      saveSettings({ ...stored, left, top });
    });

    // -----------------------------------------------------------------
    // 9️⃣ Hover‑reveal secondary buttons (font +/- , clear, theme)
    // -----------------------------------------------------------------
    const secondaryButtons = [btnMinus, btnPlus, btnClear, btnTheme];

    // Start hidden but still focusable via Tab
    secondaryButtons.forEach(b => (b.style.display = "none"));

    bubble.addEventListener("mouseenter", () => {
      secondaryButtons.forEach(b => (b.style.display = "inline"));
    });
    bubble.addEventListener("mouseleave", () => {
      secondaryButtons.forEach(b => (b.style.display = "none"));
    });

    // -----------------------------------------------------------------
    // 🔟 Resizing
    // -----------------------------------------------------------------
    let resizing = false,
        resizeStartX, resizeStartY,
        resizeStartW, resizeStartH;   // <-- renamed variables

    resizer.addEventListener("mousedown", e => {
      resizing = true;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartW = bubble.offsetWidth;
      resizeStartH = bubble.offsetHeight;
      e.preventDefault(); // stop text selection
    });

    document.addEventListener("mousemove", e => {
      if (!resizing) return;
      const newW = Math.max(200, resizeStartW + e.clientX - resizeStartX);
      const newH = Math.max(100, resizeStartH + e.clientY - resizeStartY);
      bubble.style.width = `${newW}px`;
      bubble.style.height = `${newH}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!resizing) return;
      resizing = false;
      saveSettings({
        ...stored,
        width: bubble.offsetWidth,
        height: bubble.offsetHeight
      });
    });

    // -----------------------------------------------------------------
    // 11️⃣ Populate the translation text
    // -----------------------------------------------------------------
    content.textContent = text;
    content.focus(); // give screen‑readers a cue that content changed
  };
})();
