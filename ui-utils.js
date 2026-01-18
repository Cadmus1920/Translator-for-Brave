// ui-utils.js (plain script – will be injected into the page)
window.clamp = function(value, min, max) {
  return Math.max(min, Math.min(value, max));
};

window.snapToEdges = function(elem, { safeMargin, safeTop, snapDistance }) {
  const { offsetLeft: leftPos, offsetTop: topPos,
          offsetWidth: width, offsetHeight: height } = elem;

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

window.applyTheme = function(elem, theme) {
  const isDark = theme === "dark";
  const bg = isDark ? "#0f1115" : "#f2f2f2";
  const fg = isDark ? "#fff" : "#000";
  const headerBg = isDark ? "#161a22" : "#e4e4e4";
  const border = isDark ? "1px solid #333" : "1px solid #bbb";

  Object.assign(elem.style, { background: bg, color: fg, border });
  const header = elem.querySelector("#tb-header");
  if (header) header.style.background = headerBg;
  return { bg, fg, headerBg, border };
};

window.applyFontSize = function(contentEl, size) {
  contentEl.style.fontSize = `${size}px`;
};
