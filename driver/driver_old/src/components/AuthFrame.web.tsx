import React from 'react';
import { Image, Text, View, useWindowDimensions } from 'react-native';
import type { AuthFrameProps } from './AuthFrame';
const hero = require('../../assets/nesam/auth-hero.webp');
export function AuthFrame({children,style}: AuthFrameProps) {
 const {width}=useWindowDimensions();
 if(width<1024) return <View style={style}>{children}</View>;
 return <View style={{width:'100%',maxWidth:1160,alignSelf:'center',flexDirection:'row',alignItems:'center',gap:48,paddingVertical:32}}>
  <View style={{flex:1,backgroundColor:'#F7F4EE',borderRadius:24,padding:28,overflow:'hidden'}}>
   <Text style={{color:'#161616',fontSize:28,fontWeight:'700',marginBottom:8}}>Your next journey starts here.</Text>
   <Text style={{color:'#667085',fontSize:16,lineHeight:24}}>Manage your trips, vehicle documents and earnings.</Text>
   <Image source={hero} accessible={false} resizeMode="contain" style={{width:'100%',height:400,marginTop:20}}/>
  </View>
  <View style={{width:440,maxWidth:'48%'}}>{children}</View>
 </View>;
}
