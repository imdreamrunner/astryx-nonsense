/**
 * Entry for the statically hosted build (GitHub Pages). Same app as index.js, plus one asset rule: when the bundle
 * comes from an https URL (a plain file server, not Metro), images are read from next to the bundle, in the layout
 * `react-native bundle --assets-dest` writes (ios: assets/..., android: drawable-xxhdpi/... and raw/...), instead
 * of from the site's root, where React Native would expect a Metro asset server.
 */
import {Platform} from 'react-native';
import resolveAssetSource from 'react-native/Libraries/Image/resolveAssetSource';
import SourceCode from 'react-native/Libraries/NativeModules/specs/NativeSourceCode';

const scriptURL = SourceCode.getConstants().scriptURL ?? '';
if (/^https:\/\//.test(scriptURL)) {
  resolveAssetSource.addCustomSourceTransformer(resolver =>
    Platform.OS === 'android' ? resolver.drawableFolderInBundle() : resolver.scaledAssetURLNearBundle(),
  );
}

require('./index');
