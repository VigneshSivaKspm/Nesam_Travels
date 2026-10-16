import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
export interface AuthFrameProps { children: React.ReactNode; style?: StyleProp<ViewStyle>; }
export function AuthFrame({children,style}: AuthFrameProps) { return <View style={style}>{children}</View>; }
