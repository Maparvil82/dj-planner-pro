import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { cn } from '../../src/theme/tw';

export default function LoginScreen() {
    const { t } = useTranslation();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const canSubmit = isValidEmail(email) && password.length >= 8 && !loading;

    const handleLogin = async () => {
        if (!canSubmit) return;

        setLoading(true);
        setErrorMsg('');

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg(error.message); // Real apps can map error.message to translation keys
            setLoading(false);
        } else {
            router.replace('/(tabs)/home');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 px-8 justify-center"
            >
                <View className="mb-10">
                    <Text className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3">
                        {t('login')}
                    </Text>
                    <Text className="text-lg text-gray-500 dark:text-gray-400 font-medium">
                        {t('login_subtitle')}
                    </Text>
                </View>

                {!!errorMsg && (
                    <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 p-4 rounded-xl mb-6">
                        <Text className="text-red-600 dark:text-red-400 font-medium">{errorMsg}</Text>
                    </View>
                )}

                <View className="space-y-5 gap-y-4">
                    <View>
                        <TextInput
                            placeholder={t('email_placeholder')}
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            onChangeText={(val) => {
                                setEmail(val.trim());
                                setErrorMsg('');
                            }}
                            value={email}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-blue-500 dark:focus:border-blue-500 dark:text-white rounded-2xl px-5 py-4 text-base"
                        />
                        {email.length > 0 && !isValidEmail(email) && (
                            <Text className="text-red-500 text-sm mt-2 ml-1">{t('invalid_email')}</Text>
                        )}
                    </View>

                    <View>
                        <TextInput
                            placeholder={t('password_placeholder')}
                            placeholderTextColor="#9CA3AF"
                            secureTextEntry
                            autoCapitalize="none"
                            onChangeText={(val) => {
                                setPassword(val);
                                setErrorMsg('');
                            }}
                            value={password}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-blue-500 dark:focus:border-blue-500 dark:text-white rounded-2xl px-5 py-4 text-base"
                        />
                        {password.length > 0 && password.length < 8 && (
                            <Text className="text-red-500 text-sm mt-2 ml-1">{t('password_too_short')}</Text>
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    className={cn(
                        "w-full rounded-2xl py-4 mt-8 items-center justify-center shadow-sm shadow-blue-500/20",
                        canSubmit ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-800"
                    )}
                    onPress={handleLogin}
                    disabled={!canSubmit}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className={cn(
                            "font-bold text-lg select-none",
                            canSubmit ? "text-white" : "text-gray-500 dark:text-gray-500"
                        )}>
                            {t('login')}
                        </Text>
                    )}
                </TouchableOpacity>

                <View className="flex-row justify-center mt-10">
                    <Text className="text-gray-500 dark:text-gray-400 font-medium">{t('no_account')}</Text>
                    <Link href="/(auth)/register" className="text-blue-600 dark:text-blue-400 font-bold ml-1">
                        {t('register')}
                    </Link>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
