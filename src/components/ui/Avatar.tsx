import { View, Image, TouchableOpacity, Text } from 'react-native';
import { cn } from '../../theme/tw';

interface AvatarProps {
    url?: string | null;
    name?: string | null;
    size?: 'sm' | 'md' | 'lg';
    onPress?: () => void;
    className?: string;
}

export function Avatar({ url, name, size = 'md', onPress, className }: AvatarProps) {
    const sizeClasses = {
        sm: 'w-8 h-8 rounded-full',
        md: 'w-10 h-10 rounded-full',
        lg: 'w-16 h-16 rounded-full',
    };

    const textSizes = {
        sm: 'text-xs',
        md: 'text-base',
        lg: 'text-2xl',
    };

    const getInitials = (str: string) => {
        return str
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const Container = onPress ? TouchableOpacity : View;

    return (
        <Container
            onPress={onPress}
            className={cn(
                "bg-gray-200 dark:bg-gray-800 items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-700",
                sizeClasses[size],
                className
            )}
        >
            {url ? (
                <Image
                    source={{ uri: url }}
                    className="w-full h-full"
                    resizeMode="cover"
                />
            ) : (
                <Text className={cn("font-bold text-gray-500 dark:text-gray-400 tracking-wider", textSizes[size])}>
                    {name ? getInitials(name) : '?'}
                </Text>
            )}
        </Container>
    );
}
