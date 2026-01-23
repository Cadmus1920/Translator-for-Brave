// resize-handler.js - Encapsulated resize functionality with cleanup

/**
 * Creates a resize handler for the bubble
 * @param {HTMLElement} bubble - The bubble element to resize
 * @param {HTMLElement} resizer - The resize handle element
 * @param {Object} config - Configuration with safeMargin
 * @param {Function} onSizeChange - Callback when size changes (receives {width, height})
 * @returns {Function} destroy - Cleanup function to remove all listeners
 */
window.ResizeHandler = function (bubble, resizer, config, onSizeChange) {
  // Encapsulated state
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  // Get utilities and constants from window
  const clamp = window.clamp;
  const minWidth = window.MIN_WIDTH || 200;
  const minHeight = window.MIN_HEIGHT || 120;

  // Named listener: mousedown on resizer
  const onMouseDown = (e) => {
    e.preventDefault();
    isResizing = true;

    startX = e.clientX;
    startY = e.clientY;
    startWidth = bubble.offsetWidth;
    startHeight = bubble.offsetHeight;

    document.body.style.cursor = "nwse-resize";
  };

  // Named listener: mousemove on document
  const onMouseMove = (e) => {
    if (!isResizing) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const newWidth = clamp(
      startWidth + dx,
      minWidth,
      window.innerWidth - bubble.offsetLeft - config.safeMargin
    );
    const newHeight = clamp(
      startHeight + dy,
      minHeight,
      window.innerHeight - bubble.offsetTop - config.safeMargin
    );

    bubble.style.width = `${newWidth}px`;
    bubble.style.height = `${newHeight}px`;
  };

  // Named listener: mouseup on document
  const onMouseUp = () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = "";

    // Notify size change
    if (typeof onSizeChange === "function") {
      onSizeChange({
        width: bubble.offsetWidth,
        height: bubble.offsetHeight
      });
    }
  };

  // Attach listeners
  resizer.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  // Return cleanup function
  return function destroy() {
    resizer.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    isResizing = false;
  };
};
