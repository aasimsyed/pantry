import { useWindowDimensions } from 'react-native';
import { getLayoutConstants, type LayoutConstants } from '../utils/layout';

/**
 * Returns layout constants (isTablet, contentMaxWidth, horizontalPadding, etc.)
 * for responsive layouts. Updates on orientation/resize (e.g. iPad split view).
 */
export function useLayout(): LayoutConstants {
  const { width } = useWindowDimensions();
  return getLayoutConstants(width);
}
