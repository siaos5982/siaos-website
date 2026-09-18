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
    numerology:['legalName','dateOfBirth','ownedPhoneNumbers','consultationMode'],
    vastu:['propertyStatus','propertyType','analysisMode','phone'],
    tarot:['fullName','dateOfBirth','consultationMode'],
    face:['fullName','dateOfBirth','phone','currentCity','currentState','currentCountry','consultationMode'],
    paranormal:['fullName','phone','currentCity','currentState','currentCountry']
  };
  requireValue(required[body.service].every(key => details[key]), 'Complete all required consultation details.');
  if (details.dateOfBirth) requireValue(/^\d{4}-\d{2}-\d{2}$/.test(details.dateOfBirth) && Number.isFinite(Date.parse(details.dateOfBirth)) && new Date(details.dateOfBirth).toISOString().slice(0,10)===details.dateOfBirth && Date.parse(details.dateOfBirth) <= Date.now(), 'Enter a valid date of birth.');
  return {...body, details, serviceName:serviceNames[body.service]};
}
export function checkoutInput(body) {
  requireValue(body.consentAccepted === true, 'Purchase and data-processing consent is required.');
  requireValue(uuid(body.requestId), 'A checkout request ID is required.');
  requireValue(['product','consultation'].includes(body.kind), 'This purchase type is not available yet.');
  requireValue(typeof body.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(body.slug), 'Invalid item.');
  requireValue(Number.isInteger(body.quantity) && body.quantity >= 1 && body.quantity <= 10, 'Quantity must be from 1 to 10.');
  requireValue(typeof body.variant === 'string' && body.variant.length <= 100, 'Choose a valid option.');
  if (body.kind === 'consultation') {
    requireValue(uuid(body.consultationId) && body.quantity === 1, 'Choose a saved consultation.');
    return {requestId:body.requestId,kind:body.kind,slug:body.slug,quantity:1,variant:body.variant,consultationId:body.consultationId,consentAccepted:true};
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
