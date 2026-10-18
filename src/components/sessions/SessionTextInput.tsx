import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { useCommunityColors } from '../community/communityColors';

// Explicit native styles keep form fields readable even while utility styles refresh.
export const SessionTextInput = forwardRef<TextInput, TextInputProps & { className?: string }>(
    function SessionTextInput({ style, placeholderTextColor, selectionColor, ...props }, ref) {
        const c = useCommunityColors();
        return <TextInput {...props} ref={ref}
            placeholderTextColor={placeholderTextColor ?? c.muted}
            selectionColor={selectionColor ?? c.accent}
            style={[style, { backgroundColor: c.field, color: c.fg, borderColor: c.border, borderRadius: 14 }]}
        />;
    },
);
