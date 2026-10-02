import { useEffect, useRef, useState } from 'react';
import {
    Image,
    PanResponder,
    View,
    type ImageStyle,
    type ViewStyle,
} from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import {
    clampPosterPosition,
    dragPosterPosition,
    posterCoverGeometry,
    POSTER_CARD_ASPECT,
    type PosterPosition,
} from '../../utils/posterFrame';

export function PosterFrameImage({
    uri,
    x = 0.5,
    y = 0.5,
    onChange,
    onDragChange,
    onError,
}: {
    uri: string;
    x?: number;
    y?: number;
    onChange?: (position: PosterPosition) => void;
    onDragChange?: (dragging: boolean) => void;
    onError?: () => void;
}) {
    const { t } = useTranslation();
    const [frame, setFrame] = useState({ width: 0, height: 0 });
    const [image, setImage] = useState<{
        uri: string;
        width: number;
        height: number;
    } | null>(null);
    const geometry =
        image?.uri === uri
            ? posterCoverGeometry(
                  frame.width,
                  frame.height,
                  image.width,
                  image.height,
              )
            : null;
    const position = { x: clampPosterPosition(x), y: clampPosterPosition(y) };
    const current = useRef({ geometry, position, onChange, onDragChange });
    current.current = { geometry, position, onChange, onDragChange };
    const start = useRef(position);
    const [responder] = useState(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () =>
                !!current.current.onChange && !!current.current.geometry,
            onMoveShouldSetPanResponder: () =>
                !!current.current.onChange && !!current.current.geometry,
            onPanResponderGrant: () => {
                start.current = current.current.position;
                current.current.onDragChange?.(true);
            },
            onPanResponderMove: (_, gesture) => {
                const { geometry, onChange } = current.current;
                if (geometry)
                    onChange?.(
                        dragPosterPosition(
                            start.current,
                            gesture.dx,
                            gesture.dy,
                            geometry.overflowX,
                            geometry.overflowY,
                        ),
                    );
            },
            onPanResponderRelease: () => current.current.onDragChange?.(false),
            onPanResponderTerminate: () =>
                current.current.onDragChange?.(false),
            onPanResponderTerminationRequest: () => false,
        }),
    );
    useEffect(() => {
        let active = true;
        Image.getSize(
            uri,
            (width, height) => {
                if (active) setImage({ uri, width, height });
            },
            () => {
                if (active) onError?.();
            },
        );
        return () => {
            active = false;
            current.current.onDragChange?.(false);
        };
    }, [uri, onError]);
    const imageStyle: ImageStyle = geometry
        ? {
              position: 'absolute',
              width: geometry.width,
              height: geometry.height,
              left: -geometry.overflowX * position.x,
              top: -geometry.overflowY * position.y,
          }
        : { width: '100%', height: '100%' };
    return (
        <View
            {...(onChange ? responder.panHandlers : {})}
            onLayout={(event) => setFrame(event.nativeEvent.layout)}
            accessible={!!onChange}
            accessibilityRole={onChange ? 'adjustable' : undefined}
            aria-valuemin={onChange ? 0 : undefined}
            aria-valuemax={onChange ? 100 : undefined}
            aria-valuenow={
                onChange
                    ? Math.round(
                          ((geometry?.overflowY || 0) > 0.5
                              ? position.y
                              : position.x) * 100,
                      )
                    : undefined
            }
            accessibilityLabel={onChange ? t('posterFrame.title') : undefined}
            accessibilityHint={onChange ? t('posterFrame.dragHint') : undefined}
            accessibilityValue={
                onChange
                    ? {
                          min: 0,
                          max: 100,
                          now: Math.round(
                              ((geometry?.overflowY || 0) > 0.5
                                  ? position.y
                                  : position.x) * 100,
                          ),
                      }
                    : undefined
            }
            accessibilityActions={
                onChange
                    ? [{ name: 'increment' }, { name: 'decrement' }]
                    : undefined
            }
            onAccessibilityAction={(event) => {
                if (!onChange || !geometry) return;
                const delta =
                    event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1;
                onChange(
                    geometry.overflowY > 0.5
                        ? {
                              ...position,
                              y: clampPosterPosition(position.y + delta),
                          }
                        : {
                              ...position,
                              x: clampPosterPosition(position.x + delta),
                          },
                );
            }}
            style={{
                width: '100%',
                aspectRatio: POSTER_CARD_ASPECT,
                overflow: 'hidden',
                backgroundColor: '#151c30',
                ...(onChange ? ({ touchAction: 'none' } as ViewStyle) : {}),
            }}
        >
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                }}
            >
                <Image
                    source={{ uri }}
                    resizeMode="cover"
                    onError={onError}
                    accessible={false}
                    style={imageStyle}
                />
            </View>
        </View>
    );
}
