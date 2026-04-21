import { useRouteFocus } from '../hooks/useRouteFocus';

/**
 * Invisible component that manages focus and screen-reader announcements
 * on SPA route changes. Must be rendered inside both <Router> and
 * <AnnouncerProvider>.
 */
export default function RouteFocusManager() {
  useRouteFocus();
  return null;
}
