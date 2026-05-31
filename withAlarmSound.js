const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withCustomAlarmSound = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resRawPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'raw');
      
      // Create the raw directory if it doesn't exist
      if (!fs.existsSync(resRawPath)) {
        fs.mkdirSync(resRawPath, { recursive: true });
      }

      // Source path of the audio file in the assets folder
      const sourcePath = path.join(projectRoot, 'assets', 'sounds', 'alarm.mp3');
      const destPath = path.join(resRawPath, 'alarm.mp3');

      // Copy the file if it exists
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ Custom alarm sound copied to ${destPath}`);
      } else {
        console.warn(`⚠️ Alarm sound not found at ${sourcePath}`);
      }

      return config;
    },
  ]);
};

module.exports = withCustomAlarmSound;
