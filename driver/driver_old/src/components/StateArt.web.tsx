import React from 'react';
import { Image } from 'react-native';
import type { ArtProps } from './StateArt';
const sources: Record<string, number> = {
  'offline-dashboard': require('../../assets/nesam/offline-dashboard.webp'),
  'no-available-trips': require('../../assets/nesam/no-available-trips.webp'),
  'no-earnings': require('../../assets/nesam/no-earnings.webp'),
  'no-notifications': require('../../assets/nesam/no-notifications.webp'),
};
const byTitle: Record<string, string> = {
  "You are offline": "offline-dashboard",
  "No open trips right now": "no-available-trips",
  "No active trip": "no-available-trips",
  "No completed trips yet": "no-earnings",
  "No payout requests yet": "no-earnings",
  "No entries yet": "no-earnings",
  "No notifications": "no-notifications",
  "Trips come from your fleet": "no-available-trips"
};
export function StateArt({ title }: ArtProps) {
 const source = sources[byTitle[title]];
 if (!source) return null;
 return <Image source={source} accessible={false} resizeMode="contain" style={{width:160,height:136,alignSelf:'center',marginBottom:16}} />;
}
