/**
 * Entry for Astryx Instant Preview. One AppRegistry name, `PreviewNonsense` (`module=` in the preview link; kept so the
 * existing QR codes and deep links still open it), which the Astryx Preview host mounts.
 */
import {AppRegistry} from 'react-native';
import {App} from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
