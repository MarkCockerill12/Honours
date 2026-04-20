/* eslint-disable @typescript-eslint/no-require-imports */
const { withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Custom plugin to shorten Android build paths on Windows.
 */
function withShortBuildPath(config) {
  // 1. Update Project-level build.gradle
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'gradle' && process.platform === 'win32') {
      const shortPath = "C:/b"; 
      const injection = `
allprojects {
    buildDir = "${shortPath}/\${project.name == 'app' ? 'ps-app' : project.name}"
}
`;
      if (!config.modResults.contents.includes('buildDir = "C:/b')) {
        config.modResults.contents = injection + config.modResults.contents;
      }
    }
    return config;
  });

  // 2. Update App-level build.gradle to ensure externalNativeBuild also moves
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'gradle' && process.platform === 'win32') {
       const shortPath = "C:/b/ps-app";
       // We can try to move the .cxx directory too
       const cxxInjection = `
android {
    externalNativeBuild {
        cmake {
            // Move CMake build files to a shorter path
            buildStagingDirectory = "${shortPath}/.cxx"
        }
    }
}
`;
       if (!config.modResults.contents.includes('buildStagingDirectory')) {
         config.modResults.contents += cxxInjection;
       }
    }
    return config;
  });

  return config;
}

module.exports = withShortBuildPath;
