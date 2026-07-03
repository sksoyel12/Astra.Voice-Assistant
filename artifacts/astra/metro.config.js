const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Redirect native-only packages to thin web stubs when bundling for web.
// Without this, Metro bundles them into the web output, their module-init
// code runs at load time, and the app crashes before any Platform guard fires.
const WEB_STUBS = {
  "expo-battery": path.resolve(__dirname, "web-stubs/expo-battery.js"),
  "expo-brightness": path.resolve(__dirname, "web-stubs/expo-brightness.js"),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_STUBS[moduleName]) {
    return { filePath: WEB_STUBS[moduleName], type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
