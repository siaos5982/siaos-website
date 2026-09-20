export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const serviceNames = {kundli:'Kundli Analysis',numerology:'Numerology Analysis',vastu:'Vastu Analysis',tarot:'Tarot Reading',face:'Face Reading',paranormal:'Paranormal Consultation'};
export const consultationFields = new Set(['fullName','legalName','dateOfBirth','birthCity','birthState','birthCountry','birthHour','birthMinute','birthPeriod','phone','whatsapp','currentCity','currentState','currentCountry','consultationMode','ownedPhoneNumbers','companyName','propertyStatus','propertyType','analysisMode','disclaimerAccepted','appointmentDate','appointmentStart','relatedService']);
export function consultationInput(body) {
  requireValue(Object.hasOwn(serviceNames, body.service), 'Choose a valid service.');
  requireValue(uuid(body.appointmentId), 'Choose a reserved appointment.');
  requireValue(typeof body.relatedService === 'string' && body.relatedService.trim().length > 0 && body.relatedService.length <= 160, 'Choose a consultation type.');
  requireValue(body.details && typeof body.details === 'object' && !Array.isArray(body.details), 'Consultation details are required.');
  const details = {};
  for (const [key, value] of Object.entries(body.details)) {
    requireValue(consultationFields.has(key), 'Unexpected consultation field.');
    requireValue(typeof value === 'string' && value.length <= 2000, 'Invalid consultation field.');
    details[key] = value.trim();
  }
  requireValue(['on','true'].includes(details.disclaimerAccepted), 'Consent is required.');
  const required = {
    kundli:['fullName','dateOfBirth','birthCity','birthState','birthCountry','birthHour','birthMinute','birthPeriod','phone','whatsapp','currentCity','currentState','currentCountry','consultationMode'],
    numerology:['legalName','dateOfBirth','ownedPhoneNumbers','phone','whatsapp','consultationMode'],
    vastu:['fullName','propertyStatus','propertyType','analysisMode','phone','whatsapp','consultationMode'],
    tarot:['fullName','dateOfBirth','phone','whatsapp','consultationMode'],
    face:['fullName','dateOfBirth','phone','whatsapp','currentCity','currentState','currentCountry','consultationMode'],
    paranormal:['fullName','phone','whatsapp','currentCity','currentState','currentCountry','consultationMode']
  };
  requireValue(required[body.service].every(key => details[key]), 'Complete all required consultation details.');
  if (details.dateOfBirth) requireValue(/^\d{4}-\d{2}-\d{2}$/.test(details.dateOfBirth) && Number.isFinite(Date.parse(details.dateOfBirth)) && new Date(details.dateOfBirth).toISOString().slice(0,10)===details.dateOfBirth && Date.parse(details.dateOfBirth) <= Date.now(), 'Enter a valid date of birth.');
  return {...body, details, serviceName:serviceNames[body.service]};
}
export function checkoutInput(body) {
  requireValue(body.consentAccepted === true, 'Purchase and data-processing consent is required.');
  requireValue(uuid(body.requestId), 'A checkout request ID is required.');
  requireValue(['product','report'].includes(body.kind), 'Online payment is available only for products and the ₹99 compatibility report.');
  requireValue(typeof body.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(body.slug), 'Invalid item.');
  requireValue(Number.isInteger(body.quantity) && body.quantity >= 1 && body.quantity <= 10, 'Quantity must be from 1 to 10.');
  requireValue(typeof body.variant === 'string' && body.variant.length <= 100, 'Choose a valid option.');
  if (body.kind === 'report') {
    requireValue(body.slug === 'compatibility-report' && body.variant === '15-day-access' && body.quantity === 1, 'Choose a valid report.');
    const values=body.reportNumbers||{};const reportNumbers={};
    for(const key of ['yourMulank','yourBhagyank','partnerMulank','partnerBhagyank']){
      requireValue(Number.isInteger(values[key])&&values[key]>=1&&values[key]<=9,'Complete the compatibility calculation first.');reportNumbers[key]=values[key];
    }
    return {requestId:body.requestId,kind:body.kind,slug:body.slug,quantity:1,variant:body.variant,reportNumbers,consentAccepted:true};
  }
  const address = body.address || {};
  const clean = {};
  for (const key of ['name','phone','line1','line2','city','state','postalCode','country']) {
    requireValue(typeof (address[key] ?? '') === 'string' && (address[key] || '').length <= 200, 'Invalid delivery address.');
    clean[key] = (address[key] || '').trim();
  }
  requireValue(['name','phone','line1','city','state','postalCode','country'].every(key => clean[key]), 'Complete the delivery address.');
  requireValue(clean.country === 'India' && /^\d{6}$/.test(clean.postalCode), 'Online product delivery currently supports India only.');
  return {requestId:body.requestId,kind:body.kind,slug:body.slug,quantity:body.quantity,variant:body.variant,address:clean,consentAccepted:true};
}
const compatibilityMatrix=[[86,84,88,58,82,67,64,52,91],[84,88,90,62,66,92,86,55,81],[88,90,91,60,86,88,68,59,90],[58,62,60,82,84,64,88,80,66],[82,66,86,84,89,87,70,72,83],[67,92,88,64,87,92,78,68,86],[64,86,68,88,70,78,88,73,82],[52,55,59,80,72,68,73,84,76],[91,81,90,66,83,86,82,76,90]];
const numberProfiles={
  1:{gift:'initiative and clarity',need:'respect and constructive independence',practice:'alternate leadership so both people influence shared decisions'},
  2:{gift:'empathy and cooperation',need:'gentleness and emotional safety',practice:'name feelings calmly before discussing solutions'},
  3:{gift:'optimism and expression',need:'appreciation and meaningful growth',practice:'turn one shared idea into a small scheduled action'},
  4:{gift:'persistence and original thinking',need:'stability without control',practice:'write down expectations and review them without blame'},
  5:{gift:'adaptability and communication',need:'variety with dependable follow-through',practice:'keep important conversations brief, specific and actionable'},
  6:{gift:'care and harmony',need:'affection and fairly shared responsibility',practice:'check that giving is mutual rather than assumed'},
  7:{gift:'intuition and reflection',need:'privacy together with trust',practice:'allow quiet processing time and agree when to reconnect'},
  8:{gift:'discipline and commitment',need:'reliability and visible appreciation',practice:'balance practical planning with regular emotional check-ins'},
  9:{gift:'courage and emotional honesty',need:'purpose without unnecessary conflict',practice:'pause before responding and resolve one issue at a time'}
};
export function compatibilityPaidReport(numbers){
  const {yourMulank,partnerMulank,yourBhagyank,partnerBhagyank}=numbers;
  const pair=(a,b)=>compatibilityMatrix[a-1][b-1];
  const score=Math.round(pair(yourMulank,partnerMulank)*.5+pair(yourBhagyank,partnerBhagyank)*.35+pair(yourMulank,partnerBhagyank)*.075+pair(partnerMulank,yourBhagyank)*.075);
  const label=score>=85?'Natural harmony':score>=72?'Strong potential':score>=60?'Growth relationship':'Conscious balance needed';
  const you=numberProfiles[yourMulank],partner=numberProfiles[partnerMulank],yourPath=numberProfiles[yourBhagyank],partnerPath=numberProfiles[partnerBhagyank];
  return {title:'Complete Mulank & Bhagyank Compatibility Guidance',introduction:`A ${score}% compatibility pattern suggests ${label.toLowerCase()}. Use this as a reflective framework, not a prediction or fixed verdict.`,score,numbers,
    sections:[
      {label:'Core strengths',title:'What this pairing can build',copy:`Mulank ${yourMulank} contributes ${you.gift}; Mulank ${partnerMulank} contributes ${partner.gift}. The bond is strongest when neither contribution is treated as more important.`},
      {label:'Communication plan',title:'Make different styles workable',copy:`You benefit from ${you.need}, while your partner benefits from ${partner.need}. Before a difficult conversation, each person should state one feeling, one need and one realistic request.`},
      {label:'Conflict reset',title:'A practical repair sequence',copy:`Pause when intensity rises. Return at an agreed time, describe the specific event without labels, acknowledge its effect, then choose one repair action. For this pairing, ${you.practice}; your partner can support the process when you ${partner.practice}.`},
      {label:'Long-term rhythm',title:`Bhagyank ${yourBhagyank} and ${partnerBhagyank}`,copy:`Your longer-term paths combine ${yourPath.gift} with ${partnerPath.gift}. Discuss money, family, work, health and personal space explicitly instead of assuming that shared affection creates identical priorities.`},
      {label:'Weekly practice',title:'Twenty minutes of intentional connection',copy:'Once each week, share one appreciation, one pressure you are carrying, one practical request and one enjoyable plan. Keep the conversation free from phones and do not use it to reopen every past disagreement.'},
      {label:'Thirty-day focus',title:'Build evidence through behaviour',copy:`For 30 days, practise this pairing’s two strongest habits: ${you.practice}, and ${partner.practice}. Review what actually improved rather than judging progress from one difficult day.`},
      {label:'Healthy boundaries',title:'Compatibility does not replace safety',copy:'Numerology cannot determine whether a relationship is safe or suitable. Mutual consent, honesty, respect and freedom from coercion matter more than any score. Seek qualified support for abuse, mental-health, legal or financial concerns.'},
      {label:'Closing reflection',title:'Potential is shaped by choices',copy:`The ${score}% score describes a symbolic number pattern. Reliable care, clear boundaries, repair after conflict and shared values remain the meaningful measures of the relationship.`}
    ]};
}
export function consultationConfirmationInput(body) {
  requireValue(uuid(body.appointmentId), 'Choose a valid appointment.');
  requireValue(Number.isInteger(body.amount) && body.amount > 0 && body.amount <= 100000000, 'Enter the received consultation amount in paise.');
  requireValue(typeof body.method === 'string' && body.method.trim().length >= 2 && body.method.trim().length <= 50, 'Enter the direct payment method.');
  requireValue(typeof body.reference === 'string' && body.reference.trim().length >= 2 && body.reference.trim().length <= 120, 'Enter the direct payment reference.');
  return {appointmentId:body.appointmentId,amount:body.amount,method:body.method.trim(),reference:body.reference.trim()};
}
export function catalogInput(body) {
  requireValue(body.kind === 'product', 'Only physical products can be added to the online payment catalogue.');
  requireValue(typeof body.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(body.slug), 'Enter a valid catalogue slug.');
  requireValue(typeof body.variant === 'string' && body.variant.trim().length > 0 && body.variant.trim().length <= 160, 'Enter the exact product option.');
  requireValue(typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 160, 'Enter a catalogue name.');
  requireValue(Number.isInteger(body.unitAmount) && body.unitAmount > 0 && body.unitAmount <= 100000000, 'Enter a valid price in paise.');
  requireValue(Number.isInteger(body.shippingAmount) && body.shippingAmount >= 0 && body.shippingAmount <= 10000000, 'Enter a valid delivery charge in paise.');
  requireValue(typeof body.active === 'boolean', 'Choose whether this price is active.');
  return {kind:body.kind,slug:body.slug,variant:body.variant.trim(),name:body.name.trim(),unit_amount:body.unitAmount,shipping_amount:body.shippingAmount,active:body.active};
}
export function operatorRefundInput(body) {
  requireValue(uuid(body.transactionId), 'Choose a valid payment transaction.');
  requireValue(Number.isInteger(body.amount) && body.amount > 0 && body.amount <= 100000000, 'Enter a valid refund amount in paise.');
  requireValue(typeof body.reason === 'string' && body.reason.trim().length >= 5 && body.reason.trim().length <= 500, 'Enter a clear refund reason.');
  return {transactionId:body.transactionId,amount:body.amount,reason:body.reason.trim()};
}
export async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2,'0')).join('');
}
export function equalSignature(a,b) {
  if (typeof b !== 'string' || !/^[a-f0-9]{64}$/.test(b) || a.length !== b.length) return false;
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff === 0;
}
export function analyticsInput(body) {
  requireValue(body.consent === true && uuid(body.session_id) && uuid(body.anonymous_id), 'Analytics consent and anonymous IDs are required.');
  requireValue(['page_view','click','scroll_depth','form_start','form_submit','checkout_start','outbound_click'].includes(body.event_name), 'Invalid event.');
  requireValue(typeof body.path === 'string' && /^\/[a-zA-Z0-9/_-]*(?:\.html)?$/.test(body.path) && body.path.length <= 180, 'Invalid page path.');
  const metadata = {consent_version:'2026-09-17',device:['mobile','tablet','desktop'].includes(body.device)?body.device:'unknown'};
  if (Number.isInteger(body.depth) && [25,50,75,100].includes(body.depth)) metadata.depth=body.depth;
  let referrer=''; try { const url=new URL(body.referrer); if (['http:','https:'].includes(url.protocol)) referrer=url.hostname.slice(0,160); } catch {}
  const target = typeof body.target === 'string' && /^[a-zA-Z0-9_-]{0,80}$/.test(body.target) ? body.target : '';
  return {event_name:body.event_name,session_id:body.session_id,anonymous_id:body.anonymous_id,path:body.path,referrer,target,metadata};
}
