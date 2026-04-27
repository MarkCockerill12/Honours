/* eslint-disable @typescript-eslint/no-require-imports */
const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Custom plugin to enable 16 KB page size support on Android.
 * This is required for Android 15 compatibility.
 */
function with16KbPageSize(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'gradle') {
      const packagingBlock = `
    packaging {
        jniLibs {
            useLegacyPackaging = false
            pageSize = 16 * 1024
        }
    }`;

      // Check if packaging or packagingOptions already exists
      if (config.modResults.contents.includes('packaging {')) {
        config.modResults.contents = config.modResults.contents.replace(
          /packaging\s*{[^}]*}/s,
          packagingBlock
        );
      } else if (config.modResults.contents.includes('packagingOptions {')) {
        config.modResults.contents = config.modResults.contents.replace(
          /packagingOptions\s*{[^}]*}/s,
          packagingBlock
        );
      } else {
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*{/,
          `android {${packagingBlock}`
        );
      }
    }
    return config;
  });
}

module.exports = with16KbPageSize;
