import { db } from './admin';
import { HttpsError } from 'firebase-functions/v2/https';
export function supportsTrip(service:Record<string,any>,tripType:string):boolean {
  const known:Record<string,string[]>={'One Way Taxi':['One Way'],'Outstation Cab':['One Way','Round Trip'],'Airport Taxi':['Airport Taxi'],'Local Rental':['Local Rental']};
  return known[service.serviceType]?.includes(tripType)??true;
}
export function serviceAllowsCategory(service:Record<string,any>,id:string):boolean {
  return !Array.isArray(service.allowedVehicleCategoryIds)||!service.allowedVehicleCategoryIds.length||service.allowedVehicleCategoryIds.includes(id);
}
/** An absent master retains legacy service availability; configured masters are authoritative. */
export async function assertOnlineCatalog(tripType:string,categoryId?:string):Promise<void> {
  const docs=await db.collection('services').get();
  const known=['One Way Taxi','Outstation Cab','Airport Taxi','Local Rental'];
  const matching=docs.docs.map(d=>d.data()).filter(s=>known.includes(s.serviceType)&&supportsTrip(s,tripType));
  if(!matching.length)return;
  const available=matching.some(s=>s.status==='Active'&&s.onlineBookingEnabled===true&&(!categoryId||serviceAllowsCategory(s,categoryId))&&
    !(s.serviceType==='Outstation Cab'&&s.outstationOptions?.[tripType==='Round Trip'?'roundTripAllowed':'oneWayAllowed']===false));
  if(!available)throw new HttpsError('failed-precondition','This service or vehicle is not currently available for online booking. Contact NESAM for assistance.');
}
