import React from 'react';
import { Image } from 'react-native';
const sources:Record<string,number>={
 'Market':require('../../assets/nesam/icon-route.png'),
 'More':require('../../assets/nesam/icon-settings.png'),
 'Dashboard':require('../../assets/nesam/icon-home.png'),
 'Home':require('../../assets/nesam/icon-home.png'),
 'Marketplace':require('../../assets/nesam/icon-route.png'),
 'Trips':require('../../assets/nesam/icon-trip-history.png'),
 'Fleet':require('../../assets/nesam/icon-fleet.png'),
 'Drivers':require('../../assets/nesam/icon-driver.png'),
 'Wallet':require('../../assets/nesam/icon-wallet.png'),
 'Profile':require('../../assets/nesam/icon-profile.png'),
 'Documents':require('../../assets/nesam/icon-document.png'),
 'Penalties':require('../../assets/nesam/icon-warning.png'),
};
export function NavAsset({name,color}:{name:string;color:string}) { const source=sources[name]; return source ? <Image source={source} accessible={false} resizeMode="contain" style={{width:22,height:22,tintColor:color}}/> : null; }
