"use client";

import { type RefObject, useEffect } from "react";
import type { ZoomRef } from "yet-another-react-lightbox";

/** Max gap between two pointer-downs counted as a double-click / double-tap. */
const DOUBLE_CLICK_DELAY_MS = 400;
const DOUBLE_TAP_DELAY_MS = 300;
/** Zoom level the double-click toggle switches to from the fitted (1x) view. */
const TOGGLE_ZOOM_LEVEL = 2;

const CURRENT_SLIDE_SELECTOR = ".yarl__slide_current";
const CONTAINER_SELECTOR = ".yarl__container";

/**
 * Strict 1x ↔ 2x double-click / double-tap toggle for the lightbox Zoom plugin.
 *
 * YARL's built-in double-click jumps by `max(maxZoom^(1/stops), multiplier)`,
 * i.e. straight to max zoom for small images — not the 2x toggle we want. The
 * built-in handler is disabled (zero delays) and this listener drives the zoom
 * ref instead, anchoring the zoom on the pointer position.
 */
export const useDoubleClickZoomToggle = (
  zoomRef: RefObject<ZoomRef | null>,
  isOpen: boolean
): void => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let lastPointerDownAt = 0;

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      const isOnCurrentImage = Boolean(
        target?.closest(CURRENT_SLIDE_SELECTOR) && target.tagName === "IMG"
      );
      // Multi-touch (pinch) and non-image targets never count as a tap.
      if (!(isOnCurrentImage && event.isPrimary)) {
        lastPointerDownAt = 0;
        return;
      }

      const delay =
        event.pointerType === "touch"
          ? DOUBLE_TAP_DELAY_MS
          : DOUBLE_CLICK_DELAY_MS;
      const isDoubleClick = event.timeStamp - lastPointerDownAt < delay;
      lastPointerDownAt = isDoubleClick ? 0 : event.timeStamp;

      const zoom = zoomRef.current;
      const container = target?.closest(CONTAINER_SELECTOR);
      if (!(isDoubleClick && zoom && !zoom.disabled && container)) {
        return;
      }

      // Offsets are relative to the container centre, as the plugin expects.
      const { left, top, width, height } = container.getBoundingClientRect();
      const offsetX = event.clientX - left - width / 2;
      const offsetY = event.clientY - top - height / 2;
      const targetZoom = zoom.zoom > 1 ? 1 : TOGGLE_ZOOM_LEVEL;
      zoom.changeZoom(targetZoom, false, offsetX, offsetY);
    };

    // Capture phase: the plugin stops propagation of pointer-downs while zoomed.
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [zoomRef, isOpen]);
};
