import * as Linking from 'expo-linking';
import { MEETING_BASE_URL } from '@/config/constants';

const meetingHost = (() => {
  try {
    return new URL(MEETING_BASE_URL).hostname;
  } catch {
    return 'meeting.ebumenyi.online';
  }
})();

/**
 * Check if a URL is a valid meeting URL.
 * Accepts any host — the meeting ID path pattern is what matters,
 * not the specific host (which changes between local/production).
 */
export const isValidMeetingUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.pathname.match(/^\/meeting\/[a-z0-9-]+$/i) !== null;
  } catch {
    return false;
  }
};

/**
 * Normalize any meeting URL (localhost, IP, production domain) to the
 * current environment's MEETING_BASE_URL so the WebView always loads
 * the reachable address.
 */
export const normalizeMeetingUrl = (url: string): string | null => {
  const id = extractMeetingId(url);
  return id ? `${MEETING_BASE_URL}/meeting/${id}` : null;
};

/**
 * Extract meeting ID from URL
 */
export const extractMeetingId = (url: string): string | null => {
  try {
    const match = url.match(/\/meeting\/([a-z0-9\-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/**
 * Parse deep link and route accordingly
 * Returns { route: string, params: object } or null if not a valid app link
 */
export const parseLinkingURL = (url: string | null) => {
  if (!url) return null;

  try {
    url = url.trim();

    if (isValidMeetingUrl(url)) {
      const meetingId = extractMeetingId(url);
      if (meetingId) {
        return {
          route: 'meeting',
          params: {
            meetingId,
            fullUrl: url,
          },
        };
      }
    }

    const parsed = Linking.parse(url);
    return parsed;
  } catch (error) {
    console.log('Error parsing URL:', url, error);
    return null;
  }
};

/**
 * Create a meeting deep link
 */
export const createMeetingLink = (meetingId: string): string => {
  return `${MEETING_BASE_URL}/meeting/${meetingId}`;
};

/**
 * Check if URL is internal to the app (should stay in app)
 */
export const isInternalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === meetingHost || parsed.hostname?.includes('ebumenyi.online');
  } catch {
    return false;
  }
};

/**
 * Handle meeting URL in WebView
 * Returns true if the URL should be handled by the app (not opened externally)
 */
export const shouldHandleUrlInWebView = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === meetingHost;
  } catch {
    return false;
  }
};
