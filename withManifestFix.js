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

    return config;
  });
};
