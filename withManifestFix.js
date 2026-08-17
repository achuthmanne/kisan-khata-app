const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];
    const metaData = application['meta-data'];
    
    if (metaData) {
      metaData.forEach((item) => {
        if (
          item.$['android:name'] === 'com.google.firebase.messaging.default_notification_color' ||
          item.$['android:name'] === 'com.google.firebase.messaging.default_notification_icon' ||
          item.$['android:name'] === 'expo.modules.notifications.default_notification_color' ||
          item.$['android:name'] === 'expo.modules.notifications.default_notification_icon'
        ) {
          item.$['tools:replace'] = 'android:resource';
        }
      });
    }

    // Ensure xmlns:tools is present
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Add package visibility queries for Play Store (market://)
    if (!androidManifest.manifest.queries) {
      androidManifest.manifest.queries = [{ intent: [] }];
    } else if (!androidManifest.manifest.queries[0].intent) {
      androidManifest.manifest.queries[0].intent = [];
    }

    const intentArray = androidManifest.manifest.queries[0].intent;
    const hasMarket = intentArray.some(
      (intent) => intent.data && intent.data.some((d) => d.$['android:scheme'] === 'market')
    );

    if (!hasMarket) {
      intentArray.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'market' } }]
      });
    }

    return config;
  });
};
