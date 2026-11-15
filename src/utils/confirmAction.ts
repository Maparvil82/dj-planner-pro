import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, message: string, cancel: string, proceed: string): Promise<boolean> {
    if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    return new Promise(resolve => Alert.alert(title, message, [
        { text: cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: proceed, onPress: () => resolve(true) }
    ], { cancelable: true, onDismiss: () => resolve(false) }));
}
