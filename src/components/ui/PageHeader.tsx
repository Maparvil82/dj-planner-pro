import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AddSessionButton } from './AddSessionButton';

export function PageHeader({
    title,
    subtitle,
    children,
    action,
}: {
    title: string;
    subtitle: string;
    children?: ReactNode;
    action?: ReactNode;
}) {
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    return (
        <View
            style={{
                paddingHorizontal: 24,
                paddingTop: 18,
                paddingBottom: 24,
                backgroundColor: dark ? '#0d1220' : '#f5f6fa',
            }}
        >
            <View
                style={{
                    minHeight: 58,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={{
                            fontSize: 29,
                            lineHeight: 36,
                            fontWeight: '800',
                            letterSpacing: -0.9,
                            color: dark ? '#f3f4f8' : '#202538',
                        }}
                    >
                        {title}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={{
                            fontSize: 12,
                            lineHeight: 18,
                            marginTop: 4,
                            color: dark ? '#a8b2c6' : '#6d7588',
                        }}
                    >
                        {subtitle}
                    </Text>
                </View>
                {children}
                {action === undefined ? <AddSessionButton /> : action}
            </View>
        </View>
    );
}
