import * as ImagePicker from 'expo-image-picker';

export async function pickSessionPoster() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('poster_permission');
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        base64: false,
        preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode
                .Compatible,
    });
    return result.canceled ? null : result.assets?.[0] || null;
}
