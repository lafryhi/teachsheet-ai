export function normalizeZoomValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 100;
  }

  return Math.min(200, Math.max(50, numericValue));
}

export function applyZoom(worksheetElement, value) {
  const zoomValue = normalizeZoomValue(value);

  worksheetElement.style.zoom = String(zoomValue / 100);
  worksheetElement.dataset.zoom = String(zoomValue);
}
