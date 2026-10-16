import React from 'react';
import { Image } from 'react-native';
const sources:Record<string,number>={
 'Home':require('../../assets/nesam/icon-home.png'),
 'Trip':require('../../assets/nesam/icon-navigation.png'),
 'Earnings':require('../../assets/nesam/icon-earnings.png'),
 'Wallet':require('../../assets/nesam/icon-wallet.png'),
 'Profile':require('../../assets/nesam/icon-document.png'),
};
export function NavAsset({name,color}:{name:string;color:string}) { const source=sources[name]; return source ? <Image source={source} accessible={false} resizeMode="contain" style={{width:22,height:22,tintColor:color}}/> : null; }
