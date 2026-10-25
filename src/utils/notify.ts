import { Alert, Platform } from 'react-native';

// Alert.alert does nothing on web, so fall back to the browser's alert there.
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    (globalThis as { alert?: (m: string) => void }).alert?.(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}