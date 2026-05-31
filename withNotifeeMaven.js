const { withProjectBuildGradle } = require('@expo/config-plugins');

const withNotifeeMaven = (config) => {
  return withProjectBuildGradle(config, async (config) => {
    let contents = config.modResults.contents;

    const notifeeRepo = `maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`;

    if (!contents.includes('@notifee/react-native/android/libs')) {
      contents = contents.replace(
        /allprojects\s*{\s*repositories\s*{/,
        `allprojects {\n  repositories {\n    ${notifeeRepo}`
      );
      config.modResults.contents = contents;
    }

    return config;
  });
};

module.exports = withNotifeeMaven;
