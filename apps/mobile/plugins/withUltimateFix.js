/* eslint-disable @typescript-eslint/no-require-imports */
const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

/**
 * The Ultimate Fix for Windows MAX_PATH and Android 15 16KB Page Size.
 * (Now without buildDir redirection which breaks autolinking)
 */
function withUltimateFix(config) {
  // 1. Restrict architectures and set properties in gradle.properties
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.key !== 'reactNativeArchitectures' && item.key !== 'expo.useLegacyPackaging'
    );
    
    config.modResults.push({
      key: 'reactNativeArchitectures',
      value: 'arm64-v8a,x86_64',
      type: 'property'
    });
    
    config.modResults.push({
      key: 'expo.useLegacyPackaging',
      value: 'false',
      type: 'property'
    });
    
    return config;
  });

  // 2. Enable 16KB alignment and move CXX build directory in app build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'gradle') {
      let contents = config.modResults.contents;
      
      // Add pageSize alignment
      const packagingBlock = `
    packaging {
        jniLibs {
            useLegacyPackaging = false
            pageSize = 16 * 1024
        }
    }`;

      if (!contents.includes('pageSize = 16 * 1024')) {
        contents = contents.replace(/android\s*{/, `android {${packagingBlock}`);
      }

      // Move CXX build staging directory on Windows
      if (process.platform === 'win32') {
        const cxxInjection = `
    externalNativeBuild {
        cmake {
            buildStagingDirectory = "C:/tmp/ps-b/cxx"
        }
    }`;
        if (!contents.includes('buildStagingDirectory')) {
          contents = contents.replace(/android\s*{/, `android {${cxxInjection}`);
        }
      }
      
      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
}

module.exports = withUltimateFix;
