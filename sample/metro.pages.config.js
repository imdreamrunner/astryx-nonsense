const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro for the statically hosted build: the three exploration packages are real folders inside node_modules (copied
 * by bundle.sh), so there are no watch folders and asset paths stay under node_modules/.
 */
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    disableHierarchicalLookup: true,
  },
});
