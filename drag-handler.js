// drag-handler.js - Encapsulated drag-to-move functionality with cleanup

/**
 * Creates a drag handler for the bubble
 * @param {HTMLElement} bubble - The bubble element to move
 * @param {HTMLElement} header - The header element (drag handle)
 * @param {Object} config - Configuration with safeMargin, safeTop, snapDistance
 * @param {Function} onPositionChange - Callback when position changes (receives {left, top})
 * @returns {Function} destroy - Cleanup function to remove all listeners
 */
window.DragHandler = function (bubble, header, config, onPositionChange) {
  // Encapsulated state
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Get utilities from window
  const clamp = window.clamp;
  const snapToEdges = window.snapToEdges;

  // Named listener: mousedown on header
  const onMouseDown = (e) => {
    // Only react to left-click
    if (e.button !== 0) return;
    // Don't start drag if clicking on a button or select
    if (e.target.closest("button, select")) return;

    e.preventDefault();
    isDragging = true;

    // Compute offset between mouse pointer and bubble's top-left corner
    const rect = bubble.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Change cursor while dragging
    document.body.style.cursor = "move";
  };

  // Named listener: mousemove on document
  const onMouseMove = (e) => {
    if (!isDragging) return;

    // New top-left coordinates, corrected by the initial offset
    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;

    // Keep the bubble inside the viewport (respect safe margins)
    newLeft = clamp(
      newLeft,
      config.safeMargin,
      window.innerWidth - bubble.offsetWidth - config.safeMargin
    );
    newTop = clamp(
      newTop,
      config.safeTop,
      window.innerHeight - bubble.offsetHeight - config.safeMargin
    );

    bubble.style.left = `${newLeft}px`;
    bubble.style.top = `${newTop}px`;
  };

  // Named listener: mouseup on document
  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.cursor = ""; // restore default

    // Snap to nearest screen edge
    const snapped = snapToEdges(bubble, config);

    // Notify position change
    if (typeof onPositionChange === "function") {
      onPositionChange({ left: snapped.left, top: snapped.top });
    }
  };

  // Set visual cue on header
  header.style.cursor = "move";

  // Attach listeners
  header.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  // Return cleanup function
  return function destroy() {
    header.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    isDragging = false;
  };
};
