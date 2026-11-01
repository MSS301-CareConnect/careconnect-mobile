const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  maxWorkers: 2,
  resolver: { blockList: [/[/\\]artifacts[/\\].*/, /[/\\]\.tools[/\\].*/] },
});
