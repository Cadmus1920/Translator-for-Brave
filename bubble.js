(() => {
  if (window.showTranslatorBubble) return;

  const STORAGE_KEY = "translatorBubbleSettings";

  const SAFE_TOP = 40;      // prevents hiding under bookmarks bar
  const SAFE_MARGIN = 10;

  const MIN_FONT = 12;
  const MAX_FONT = 20;
  const FONT_STEP = 2;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function loadSettings() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY], res => {
        resolve(res[STORAGE_KEY] || {});
      });
    });
  }

  function saveSettings(settings) {
    chrome.storage.local.set({ [STORAGE_KEY]: settings });
  }

  window.showTranslatorBubble = async (text) => {
    let box = document.getElementById("translator-bubble");
    let settings = await loadSettings();

    // Reuse existing bubble safely
    if (box) {
      const content = box.querySelector("#tb-content");
      if (content) content.textContent = text;
      return;
    }

    // Create bubble
    box = document.createElement("div");
    box.id = "translator-bubble";

    box.innerHTML = `
      <div id="tb-header">
        <span>Translator</span>
        <div id="tb-buttons">
          <span id="tb-font-minus">A−</span>
          <span id="tb-font-plus">A+</span>
          <span id="tb-clear">🧹</span>
          <span id="tb-copy">📋</span>
          <span id="tb-theme">🌗</span>
          <span id="tb-close">✕</span>
        </div>
      </div>
      <div id="tb-content"></div>
      <div id="tb-resize"></div>
    `;

    document.body.appendChild(box);

    const header = box.querySelector("#tb-header");
    const content = box.querySelector("#tb-content");
    const resizer = box.querySelector("#tb-resize");

    const fontMinusBtn = box.querySelector("#tb-font-minus");
    const fontPlusBtn = box.querySelector("#tb-font-plus");
    const clearBtn = box.querySelector("#tb-clear");
    const copyBtn = box.querySelector("#tb-copy");
    const themeBtn = box.querySelector("#tb-theme");
    const closeBtn = box.querySelector("#tb-close");

// Button cursors (click targets)
[
  fontMinusBtn,
  fontPlusBtn,
  clearBtn,
  copyBtn,
  themeBtn,
  closeBtn
].forEach(btn => {
  btn.style.cursor = "pointer";
});

    let theme = settings.theme || "dark";
    let fontSize = settings.fontSize || 14;

    function applyTheme() {
      if (theme === "dark") {
        box.style.background = "#0f1115";
        box.style.color = "#fff";
        header.style.background = "#161a22";
        box.style.border = "1px solid #333";
      } else {
        box.style.background = "#f2f2f2";
        box.style.color = "#000";
        header.style.background = "#e4e4e4";
        box.style.border = "1px solid #bbb";
      }
    }

    function applyFontSize() {
      content.style.fontSize = fontSize + "px";
    }

    // Clamp saved position on load (PERMANENT FIX)
    const startWidth = settings.width || 320;
    const startHeight = settings.height || 180;

    const startLeft = clamp(
      settings.left ?? 80,
      SAFE_MARGIN,
      window.innerWidth - startWidth - SAFE_MARGIN
    );

    const startTop = clamp(
      settings.top ?? 80,
      SAFE_TOP,
      window.innerHeight - startHeight - SAFE_MARGIN
    );

    Object.assign(box.style, {
      position: "fixed",
      top: startTop + "px",
      left: startLeft + "px",
      width: startWidth + "px",
      height: startHeight + "px",
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

    applyTheme();
    applyFontSize();

    // Buttons
    fontPlusBtn.onclick = () => {
      if (fontSize < MAX_FONT) {
        fontSize += FONT_STEP;
        settings.fontSize = fontSize;
        saveSettings(settings);
        applyFontSize();
      }
    };

    fontMinusBtn.onclick = () => {
      if (fontSize > MIN_FONT) {
        fontSize -= FONT_STEP;
        settings.fontSize = fontSize;
        saveSettings(settings);
        applyFontSize();
      }
    };

    clearBtn.onclick = () => {
      content.textContent = "";
    };

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(content.textContent);
      copyBtn.textContent = "✔";
      setTimeout(() => (copyBtn.textContent = "📋"), 800);
    };

    themeBtn.onclick = () => {
      theme = theme === "dark" ? "light" : "dark";
      settings.theme = theme;
      saveSettings(settings);
      applyTheme();
    };

    closeBtn.onclick = () => box.remove();

    // Dragging (clamped)
    let dx = 0, dy = 0, drag = false;

    header.addEventListener("mousedown", e => {
      drag = true;
      dx = e.clientX - box.offsetLeft;
      dy = e.clientY - box.offsetTop;
    });

    document.addEventListener("mousemove", e => {
      if (!drag) return;

      const maxLeft =
        window.innerWidth - box.offsetWidth - SAFE_MARGIN;
      const maxTop =
        window.innerHeight - box.offsetHeight - SAFE_MARGIN;

      let newLeft = e.clientX - dx;
      let newTop = e.clientY - dy;

      newLeft = clamp(newLeft, SAFE_MARGIN, maxLeft);
      newTop = clamp(newTop, SAFE_TOP, maxTop);

      box.style.left = newLeft + "px";
      box.style.top = newTop + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!drag) return;
      drag = false;
      settings.left = box.offsetLeft;
      settings.top = box.offsetTop;
      saveSettings(settings);
    });

// Header cursor behavior (only show move cursor on drag area)
header.addEventListener("mouseenter", () => {
  header.style.cursor = "move";
});

header.addEventListener("mouseleave", () => {
  header.style.cursor = "default";
});

    // Resizing
    let resize = false, sx, sy, sw, sh;

    resizer.addEventListener("mousedown", e => {
      resize = true;
      sx = e.clientX;
      sy = e.clientY;
      sw = box.offsetWidth;
      sh = box.offsetHeight;
      e.preventDefault();
    });

    document.addEventListener("mousemove", e => {
      if (!resize) return;
      box.style.width = sw + (e.clientX - sx) + "px";
      box.style.height = sh + (e.clientY - sy) + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!resize) return;
      resize = false;
      settings.width = box.offsetWidth;
      settings.height = box.offsetHeight;
      saveSettings(settings);
    });

    content.textContent = text;
  };
})();
