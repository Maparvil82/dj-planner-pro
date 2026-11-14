import type { ComponentRef } from 'react';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Keyboard, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/communityColors';
import { SessionTextInput } from './SessionTextInput';

export function SessionNotesField({ value, onChange, disabled = false, scrollRef }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
    const frame = useRef<number | null>(null);
    const revealInput = useCallback(() => {
        if (Platform.OS !== 'ios' || !Keyboard.isVisible()) return;
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
            frame.current = null;
            const scroll = scrollRef?.current;
            if (!scroll || !inputRef.current?.isFocused()) return;
            // The scroll view starts below the safe area and the form header.
            // RN's keyboard-scrolling helper otherwise assumes a full-screen origin.
            scroll.getNativeScrollRef()?.measureInWindow((_x: number, top: number) => {
                if (inputRef.current?.isFocused())
                    scroll.scrollResponderScrollNativeHandleToKeyboard(inputRef.current, top + 24, true);
            });
        });
    }, [scrollRef]);
    useEffect(() => {
        const keyboard = Keyboard.addListener('keyboardDidShow', revealInput);
        return () => {
            keyboard.remove();
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, [revealInput]);
    return <View style={{ gap: 8 }}>
        <SessionTextInput ref={inputRef} accessibilityLabel={t('sessionNotes.title')}
            placeholder={t('sessionNotes.placeholder')} value={value}
            onChangeText={onChange} multiline maxLength={5000} editable={!disabled}
            textAlignVertical="top"
            onFocus={revealInput} onSelectionChange={revealInput}
            style={{ minHeight: 124, maxHeight: 240, padding: 14, fontSize: 15,
                lineHeight: 22, borderWidth: 1, borderColor: c.border }} />
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
            {t('sessionNotes.privateHint')}
        </Text>
    </View>;
}
