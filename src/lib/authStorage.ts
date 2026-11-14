import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { createSecureSessionStorage } from '../utils/secureSessionStorage';

export const authStorage = Platform.OS === 'web' ? AsyncStorage : createSecureSessionStorage({
    getItem: key => SecureStore.getItemAsync(key),
    setItem: (key,value) => SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
    removeItem: key => SecureStore.deleteItemAsync(key),
},AsyncStorage,()=>Crypto.randomUUID());
