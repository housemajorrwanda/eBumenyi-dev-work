/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const DEFAULT_BACKEND = 'https://apitest.ebumenyi.online';

const backendBaseUrl = (
  process.env.EXPO_PUBLIC_BACKEND_BASE_URL ||
  appJson.expo.extra?.backendBaseUrl ||
  DEFAULT_BACKEND
).replace(/\/$/, '');

const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  appJson.expo.extra?.apiBaseUrl ||
  `${backendBaseUrl}/api`
).replace(/\/$/, '');

const assetsBaseUrl = (
  process.env.EXPO_PUBLIC_ASSETS_BASE_URL ||
  appJson.expo.extra?.assetsBaseUrl ||
  backendBaseUrl
).replace(/\/$/, '');

const weltelWebUrl =
  process.env.EXPO_PUBLIC_WELTEL_WEB_URL ||
  appJson.expo.extra?.weltelWebUrl ||
  'https://rw-chw1.weltelhealth.net';

const narrationApiBaseUrl = (
  process.env.EXPO_PUBLIC_NARRATION_API_BASE_URL ||
  appJson.expo.extra?.narrationApiBaseUrl ||
  ''
).replace(/\/$/, '');

const recommendationsApiBaseUrl = (
  process.env.EXPO_PUBLIC_RECOMMENDATIONS_API_BASE_URL ||
  appJson.expo.extra?.recommendationsApiBaseUrl ||
  ''
).replace(/\/$/, '');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      backendBaseUrl,
      apiBaseUrl,
      assetsBaseUrl,
      weltelWebUrl,
      ...(narrationApiBaseUrl ? { narrationApiBaseUrl } : {}),
      ...(recommendationsApiBaseUrl ? { recommendationsApiBaseUrl } : {}),
      uploadsVideosPath:
        process.env.EXPO_PUBLIC_UPLOADS_VIDEOS_PATH || '/uploads/videos',
      uploadsDocumentsPath:
        process.env.EXPO_PUBLIC_UPLOADS_DOCUMENTS_PATH || '/uploads/documents',
      uploadsImagesPath:
        process.env.EXPO_PUBLIC_UPLOADS_IMAGES_PATH || '/uploads/images',
    },
  },
};
