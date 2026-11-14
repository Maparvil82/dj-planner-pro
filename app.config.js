// Build credentials stay in private environment variables; never in expo.extra.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    ['@sentry/react-native/expo', {
      url: 'https://sentry.io/',
      organization: process.env.SENTRY_ORG || 'dj-planner-pro',
      project: process.env.SENTRY_PROJECT || 'react-native',
      // Native builds remain usable before the private upload credential is configured.
      disableAutoUpload: !process.env.SENTRY_AUTH_TOKEN,
    }],
  ],
});
