// ui-utils.js (plain script – will be injected into the page)

// ------------------------------------------------------------------
// Clamp a numeric value between a min and a max
// ------------------------------------------------------------------
window.clamp = function (value, min, max) {
  return Math.max(min, Math.min(value, max));
};

// ------------------------------------------------------------------
// Snap the bubble to the nearest screen edge when it gets close
// ------------------------------------------------------------------
window.snapToEdges = function (elem, { safeMargin, safeTop, snapDistance }) {
  const {
    offsetLeft: leftPos,
    offsetTop: topPos,
    offsetWidth: width,
    offsetHeight: height,
  } = elem;

  let left = leftPos;
  let top = topPos;

  if (leftPos < snapDistance) left = safeMargin;
  if (window.innerWidth - (leftPos + width) < snapDistance)
    left = window.innerWidth - width - safeMargin;
  if (topPos - safeTop < snapDistance) top = safeTop;
  if (window.innerHeight - (topPos + height) < snapDistance)
    top = window.innerHeight - height - safeMargin;

  elem.style.left = `${left}px`;
  elem.style.top = `${top}px`;
  return { left, top };
};

// ------------------------------------------------------------------
// Apply dark / light theme with WCAG‑AA+ contrast ratios
// ------------------------------------------------------------------
window.applyTheme = function (elem, theme) {
  // Convert the incoming theme string to a boolean we can reuse
  const isDark = theme === "dark";

  // Colours chosen to stay well above the 4.5:1 contrast threshold
  const bg = isDark ? "#121418" : "#ffffff";   // background
  const fg = isDark ? "#e0e0e0" : "#212121";   // foreground (text)
  const headerBg = isDark ? "#1c212b" : "#eaeaea";
  const border = isDark ? "1px solid #555" : "1px solid #888";

  // Apply the calculated styles to the bubble element
  Object.assign(elem.style, {
    background: bg,
    color: fg,
    border,
    // Custom CSS variables – useful if you ever want to reference them elsewhere
    "--bubble-fg": fg,
    "--bubble-bg": bg,
  });

  // Header gets its own background colour
  const header = elem.querySelector("#tb-header");
  if (header) header.style.background = headerBg;

  // Return the values in case the caller wants to store them
  return { bg, fg, headerBg, border };
};

// ------------------------------------------------------------------
// Set the font size of the bubble's content area
// ------------------------------------------------------------------
window.applyFontSize = function (contentEl, size) {
  contentEl.style.fontSize = `${size}px`;
};

// ------------------------------------------------------------------
// Display an error message in the bubble's error element
// ------------------------------------------------------------------
window.showError = function (message, duration = 5000) {
  const bubble = document.getElementById(window.BUBBLE_ID || "translator-bubble");
  if (!bubble) return;

  const errorBox = bubble.querySelector("#tb-error");
  if (!errorBox) return;

  errorBox.textContent = message;
  errorBox.style.display = "block";

  if (duration > 0) {
    setTimeout(() => {
      errorBox.style.display = "none";
      errorBox.textContent = "";
    }, duration);
  }
};

// ------------------------------------------------------------------
// Hide any currently displayed error
// ------------------------------------------------------------------
window.hideError = function () {
  const bubble = document.getElementById(window.BUBBLE_ID || "translator-bubble");
  if (!bubble) return;

  const errorBox = bubble.querySelector("#tb-error");
  if (errorBox) {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }
};
