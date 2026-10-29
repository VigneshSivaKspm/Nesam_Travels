const test=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers.e2e');
const {db,call,rid,inHours,place}=H;
const {syncPublicContent,publicContent}=require('../lib/publicContent');
const {sendSms,sendEmail,sendWhatsApp}=require('../lib/providers');
const {availableBusinessCredit,businessContract}=require('../lib/domain/business');
let routing,oldConfig;
const admin='fixes-master';
const rate={id:'C1',pickupZone:'Theni',dropZone:'Madurai',service:'One Way',category:'Sedan',contractType:'Fixed fare',priceEntered:'Excluding GST',customerRate:1000,partnerPayout:700,active:true,peak:false};
const request=(business,extra={})=>({requestId:rid('fix'),businessAccountId:business,businessBilledTo:'Company pays',categoryId:'fix-sedan',tripType:'One Way',pickupPoint:place('Theni',10.0104,77.4768),dropPoint:place('Madurai',9.9195,78.1193),scheduledAt:inHours(5),paymentMethod:'UPI',customerName:'Audit Customer',customerPhone:'+919000000000',termsAccepted:true,...extra});
test.before(async()=>{
  routing=await H.startRoutingStub();
  oldConfig=(await db.doc('settings/config').get()).data();
  await db.doc(`admins/${admin}`).set({role:'admin',status:'active',staffRole:'super_admin',name:'Fixes admin'});
  await db.doc('vehicle_categories/fix-sedan').set({name:'Sedan',status:'Active',code:'sedan',seatingCapacity:4,fare:{baseFare:70,baseKm:2,perKmRate:16,minimumFare:100}});
  const tariff=await call(admin,'saveTariffConfig',{useConfirmedDefaults:true,enabled:true,reason:'Regression fixture'});assert.equal(tariff.ok,true,JSON.stringify(tariff));
});
test('business quote uses contract; concurrent bookings cannot overspend credit; holds are enforced',async()=>{
  await db.doc('business_accounts/fix-credit').set({name:'Fix Corp',status:'Active',paymentTerms:'Credit',creditLimit:1050,contractRates:[rate]});
  const a=request('fix-credit'),b=request('fix-credit');
  const quote=await call(admin,'createAdminBooking',{...a,quoteOnly:true});
  assert.equal(quote.ok,true,JSON.stringify(quote));assert.equal(quote.data.quote.total,1050);
  const results=await Promise.all([a,b].map(x=>call(admin,'createAdminBooking',{...x,expectedFare:1050})));
  assert.equal(results.filter(r=>r.ok).length,1,JSON.stringify(results));
  const saved=(await db.collection('bookings').where('businessAccountId','==','fix-credit').get()).docs;
  assert.equal(saved.length,1);assert.equal(saved[0].data().pricing.partner.basePaise,70000);
  await db.doc('business_accounts/fix-credit').update({status:'On hold'});
  const held=await call(admin,'createAdminBooking',{...request('fix-credit'),quoteOnly:true});assert.equal(held.ok,false);assert.match(held.message,/hold/i);
});
test('contract matching rejects duplicate rates and keeps per-km and credit arithmetic explicit',()=>{
  const i={pickup:{name:'Theni'},drop:{name:'Madurai'},service:'One Way',tripType:'One Way',category:'Sedan',km:80};
  assert.throws(()=>businessContract({contractRates:[rate,rate]},i),/More than one/);
  assert.equal(businessContract({contractRates:[rate]},{...i,pickup:{name:'Theni Road'}}),null);
  assert.equal(businessContract({contractRates:[{...rate,contractType:'Per km',customerRate:15,partnerPayout:12}]},i).rule.customerFare,1200);
  assert.equal(availableBusinessCredit({paymentTerms:'Credit',creditLimit:2000},[{status:'Pending',fare:900},{status:'Completed',fare:500},{status:'Completed',fare:9000,businessBilledTo:'Passenger pays'}],[{amount:100}]),700);
});
test('approved public projection excludes contacts, notes and payouts; hiding/deleting retracts it',async()=>{
  const data={status:'Published',customerName:'Priya Raman',overallRating:5,reviewText:'Safe and punctual.',customerPhone:'PRIVATE_PHONE',customerEmail:'PRIVATE_EMAIL',moderation:{internalNotes:'PRIVATE_NOTE'},partnerPayout:'PRIVATE_PAYOUT',adminResponse:{text:'Thank you.'}};
  const projected=publicContent('reviews','fix-review',data);assert.equal(projected.name,'Priya');
  for(const secret of ['PRIVATE_PHONE','PRIVATE_EMAIL','PRIVATE_NOTE','PRIVATE_PAYOUT','Raman'])assert.equal(JSON.stringify(projected).includes(secret),false);
  await db.doc('reviews/fix-review').set(data);
  const refresh=await call(admin,'refreshPublicContent',{kind:'reviews',id:'fix-review'});assert.equal(refresh.ok,true,JSON.stringify(refresh));
  const base='http://127.0.0.1:8080/v1/projects/demo-nesam/databases/(default)/documents/';
  assert.equal((await fetch(base+'public_content/reviews_fix-review')).status,200);
  assert.equal((await fetch(base+'reviews/fix-review')).status,403);
  await db.doc('reviews/fix-review').update({status:'Hidden'});await syncPublicContent('reviews','fix-review');
  assert.equal((await fetch(base+'public_content/reviews_fix-review')).status,404);
  await db.doc('services/fix-service').set({status:'Active',name:'Airport',serviceType:'Airport Taxi',onlineBookingEnabled:true,partnerPayout:500});
  await syncPublicContent('services','fix-service');assert.equal((await db.doc('public_content/services_fix-service').get()).data().partnerPayout,undefined);
  await db.doc('services/fix-service').delete();await syncPublicContent('services','fix-service');assert.equal((await db.doc('public_content/services_fix-service').get()).exists,false);
});
test('disabled delivery channels do not contact providers; cash switch is enforced',async()=>{
  await db.doc('settings/config').set({smsEnabled:false,emailEnabled:false,whatsappEnabled:false,pushEnabled:false,allowCod:false});
  for(const result of await Promise.all([sendSms('+919000000000',{text:'test'}),sendEmail('test@example.test',{subject:'test',text:'test'}),sendWhatsApp('+919000000000',{name:'test',bodyParams:[]})])) {
    assert.equal(result.ok,false);assert.equal(result.provider,'settings');assert.match(result.error,/disabled/);
  }
  const cash=await call(admin,'createAdminBooking',request('',{paymentMethod:'Cash',expectedFare:1}));assert.equal(cash.ok,false);assert.match(cash.message,/Cash payments are disabled/);
});
test.after(async()=>{if(oldConfig)await db.doc('settings/config').set(oldConfig);else await db.doc('settings/config').delete();if(routing)await new Promise(r=>routing.close(r));await db.terminate();});
