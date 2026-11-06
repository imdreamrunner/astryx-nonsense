/**
 * Entry. One AppRegistry name, `PreviewNonsense` (`module=` in the preview link), which the Astryx Preview host mounts.
 */
import {AppRegistry} from 'react-native';
import {App} from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
