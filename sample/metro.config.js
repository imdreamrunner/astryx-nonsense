const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro for the Astryx Nonsense sample, set up as the doc site (apps/neutral-rn) sets it up: the exploration library,
 * the navigation tier and the platform package come in through npm `file:` links with no node_modules of their own, so
 * Metro watches their folders and resolves every package from this sample's node_modules (one React, one React Native).
 * The sample has no ios/ or android/ project: its bundle runs inside the doc-site app's binary through Astryx Preview.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const packages = ['react-native', 'react-native-navigation', 'react-native-platform'].map(name => path.resolve(__dirname, '../../packages', name));

const config = {
  watchFolders: packages,
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    disableHierarchicalLookup: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
