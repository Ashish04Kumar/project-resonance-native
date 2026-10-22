// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle 3D models (the Buddy robot) as assets.
config.resolver.assetExts.push('glb');

// three's CommonJS entry (picked when a library uses require('three'), like
// react-three-fiber/native) calls Node's process.emitWarning, which doesn't exist
// in React Native and crashes with "undefined is not a function". Always use
// three's ES module build instead.
const threeModule = path.join(__dirname, 'node_modules/three/build/three.module.js');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeModule };
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
