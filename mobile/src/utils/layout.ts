/**
 * Layout constants for responsive design (Rams/Ive philosophy).
 * Tablet = iPad and larger; phone = iPhone. Same design language, better use of space on tablet.
 */

/** Width above which we treat the device as a tablet (iPad). */
export const TABLET_BREAKPOINT = 768;

/** Max content width on tablet so UI doesn't stretch; centered with generous margins. */
export const TABLET_CONTENT_MAX_WIDTH = 640;

/** Horizontal padding: phone vs tablet (more breathing room on iPad). */
export const PHONE_HORIZONTAL_PADDING = 24;
export const TABLET_HORIZONTAL_PADDING = 48;

/** Vertical spacing scale for tablet (slightly larger). */
export const TABLET_SPACING_SCALE = 1.25;

export interface LayoutConstants {
  /** True when screen width >= TABLET_BREAKPOINT. */
  isTablet: boolean;
  /** Screen width from useWindowDimensions. */
  screenWidth: number;
  /** Max width for main content (tablet: TABLET_CONTENT_MAX_WIDTH; phone: undefined = full width). */
  contentMaxWidth: number | undefined;
  /** Horizontal padding for content (tablet: 48, phone: 24). */
  horizontalPadding: number;
  /** Extra scale for spacing on tablet (e.g. 1.25). */
  spacingScale: number;
}

/**
 * Compute layout constants from current window width.
 * Use via useLayout() hook so it updates on resize/orientation.
 */
export function getLayoutConstants(screenWidth: number): LayoutConstants {
  const isTablet = screenWidth >= TABLET_BREAKPOINT;
  return {
    isTablet,
    screenWidth,
    contentMaxWidth: isTablet ? TABLET_CONTENT_MAX_WIDTH : undefined,
    horizontalPadding: isTablet ? TABLET_HORIZONTAL_PADDING : PHONE_HORIZONTAL_PADDING,
    spacingScale: isTablet ? TABLET_SPACING_SCALE : 1,
  };
}
