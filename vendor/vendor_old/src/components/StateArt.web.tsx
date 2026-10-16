import React from 'react';
import { Image } from 'react-native';
import type { ArtProps } from './StateArt';
const sources: Record<string, number> = {
  'no-vehicles': require('../../assets/nesam/no-vehicles.webp'),
  'no-drivers': require('../../assets/nesam/no-drivers.webp'),
  'no-marketplace-trips': require('../../assets/nesam/no-marketplace-trips.webp'),
  'no-transactions': require('../../assets/nesam/no-transactions.webp'),
  'no-notifications': require('../../assets/nesam/no-notifications.webp'),
};
const byTitle: Record<string, string> = {
  "No vehicles yet": "no-vehicles",
  "No vehicle expiry dates yet": "no-vehicles",
  "No drivers linked yet": "no-drivers",
  "No open trips": "no-marketplace-trips",
  "No bids yet": "no-marketplace-trips",
  "No active trips": "no-marketplace-trips",
  "No active trips in queue": "no-marketplace-trips",
  "No completed trips yet": "no-marketplace-trips",
  "No payout requests yet": "no-transactions",
  "No transactions yet": "no-transactions",
  "No notifications": "no-notifications"
};
export function StateArt({ title }: ArtProps) {
 const source = sources[byTitle[title]];
 if (!source) return null;
 return <Image source={source} accessible={false} resizeMode="contain" style={{width:160,height:136,alignSelf:'center',marginBottom:16}} />;
}
