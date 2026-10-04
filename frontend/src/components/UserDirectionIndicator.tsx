import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import DirectionIndicator from './DirectionIndicator';

export type UserDirectionIndicatorHandle = {

  mover: (x: number, y: number) => void;
};

type Props = {
  heading: number | null;
  visivel: boolean;
  pivoStyle: StyleProp<ViewStyle>;
  centralizadorStyle: StyleProp<ViewStyle>;
  variant?: 'facho' | 'seta';
};

const UserDirectionIndicator = forwardRef<UserDirectionIndicatorHandle, Props>(
  ({ heading, visivel, pivoStyle, centralizadorStyle, variant }, ref) => {
    const pos = useRef(new Animated.ValueXY({ x: -9999, y: -9999 })).current;

    useImperativeHandle(
      ref,
      () => ({
        mover: (x: number, y: number) => {
          pos.setValue({ x, y });
        },
      }),
     
      []
    );

    if (!visivel) return null;

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          pivoStyle,
          {
            left: pos.x,
            top: pos.y,
            transform: [{ rotate: `${heading ?? 0}deg` }],
          },
        ]}
      >
        <Animated.View style={centralizadorStyle}>
          <DirectionIndicator variant={variant} />
        </Animated.View>
      </Animated.View>
    );
  }
);

export default UserDirectionIndicator;