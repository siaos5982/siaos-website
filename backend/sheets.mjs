import {requireValue,consultationFields,HttpError} from './core.mjs';

export const REPORTS={
  clients:{table:'browser_accounts',select:'id,full_name,email,phone,country_code,marketing_opt_in,terms_accepted_at,created_at,updated_at,last_opened_at',order:'created_at.asc,id.asc'},
  deleted_accounts:{table:'account_deletion_audit',select:'account_id,account_created_at,deleted_at,deletion_source',order:'deleted_at.desc,account_id.asc'},
  consultations:{table:'browser_consultations',select:'id,account_id,service,service_name,related_service,appointment_start,consultation_mode,details,status,consent_at,submitted_at,updated_at',order:'submitted_at.asc,id.asc'},
  calendar:{table:'browser_consultations',select:'id,account_id,service,related_service,appointment_start,consultation_mode,status,details,submitted_at,updated_at',order:'appointment_start.asc,id.asc'},
  orders:{table:'product_orders',select:'id,user_id,order_number,payment_reference,payment_status,status,currency,total,items,delivery_address,tracking_reference,ordered_at,updated_at',order:'ordered_at.asc,id.asc'},
  payments:{table:'payment_transactions',select:'id,user_id,gateway_order_id,gateway_payment_id,receipt,kind,item_slug,item_name,quantity,amount,refunded_amount,refund_status,currency,status,raw_status,method,paid_at,created_at',order:'created_at.asc,id.asc'},
  refunds:{table:'refund_requests',select:'id,transaction_id,user_id,source,reason,eligible_amount,gateway_refund_id,status,attempts,last_error,requested_at,processed_at,updated_at',order:'requested_at.asc,id.asc'},
  catalog:{table:'catalog_prices',select:'id,kind,slug,variant,name,unit_amount,shipping_amount,active',order:'kind.asc,slug.asc,variant.asc'},
  readings:{table:'readings',select:'id,user_id,reading_type,title,created_at',order:'created_at.asc,id.asc'},
  visitors:{table:'analytics_events',select:'id,event_name,anonymous_id,session_id,path,referrer,target,metadata,occurred_at',order:'id.asc'},
  reports:{table:'report_purchases',select:'id,user_id,report_type,title,status,purchased_at,access_expires_at',order:'purchased_at.asc,id.asc'}
};
export const SHEET_TITLES=Object.freeze({
  clients:'Clients',
  deleted_accounts:'Deleted Accounts',
  consultations:'Consultations',
  calendar:'Calendar',
  orders:'Orders',
  payments:'Payments',
  refunds:'Refunds',
  catalog:'Catalog',
  readings:'Readings',
  visitors:'Visitors',
  reports:'Reports'
});
export function overviewRows(counts,refreshedAt){
  return [
    ['SIAOS Operations Reporting'],
    ['Private reporting mirror — Supabase remains the system of record'],
    [],
    ['Metric','Records','Notes'],
    ['Clients',counts.clients??0,'Submitted profile and contact records'],
    ['Deleted Accounts',counts.deleted_accounts??0,'Privacy-safe deletion references and dates'],
    ['Consultations',counts.consultations??0,'Requests, consent and appointment references'],
    ['Calendar',counts.calendar??0,'Appointment times, status and direct payment references'],
    ['Orders',counts.orders??0,'Product fulfilment and delivery details'],
    ['Payments',counts.payments??0,'Razorpay product and ₹99 report transactions'],
    ['Refunds',counts.refunds??0,'Eligible, processing and completed refunds'],
    ['Visitors',counts.visitors??0,'Consented anonymous activity only'],
    ['Readings',counts.readings??0,'Saved reading metadata'],
    ['Reports',counts.reports??0,'Purchased report access records'],
    ['Catalog',counts.catalog??0,'Server-approved prices and availability'],
    ['Last refresh',refreshedAt,'Automatic backend snapshot']
  ];
}
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const text64=text=>b64url(new TextEncoder().encode(text));
async function googleToken(env){
  const credentials=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON||'{}');
  requireValue(credentials.client_email&&credentials.private_key,'Google Sheets service account is not configured.',503);
  const now=Math.floor(Date.now()/1000);
  const header=text64(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload=text64(JSON.stringify({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const pem=credentials.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(`${header}.${payload}`))));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${header}.${payload}.${signature}`}),signal:AbortSignal.timeout(15000)});
  requireValue(response.ok,'Google authorization failed.',502);const data=await response.json();requireValue(data.access_token,'Google authorization failed.',502);return data.access_token;
}
// JSON is exported only from bounded, approved business fields. No raw session/auth objects.
export function sheetRows(name,rows){
  const value=v=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);
  const india=v=>{const date=new Date(v);return Number.isFinite(date.getTime())?date.toLocaleString('en-GB',{timeZone:'Asia/Kolkata'}):'';};
  if(name==='deleted_accounts')return [
    ['Account Reference','Status','Account Created (UTC)','Deleted At (UTC)','Deleted At (IST)','Days Since Deletion','Deletion Source'],
    ...rows.map(r=>{const deleted=new Date(r.deleted_at);return [r.account_id,'Deleted',r.account_created_at||'',r.deleted_at,deleted.toLocaleString('en-GB',{timeZone:'Asia/Kolkata'}),String(Math.max(0,Math.floor((Date.now()-deleted.getTime())/86400000))),r.deletion_source];})
  ];
  if(name==='clients')return [
    ['Client ID','Name','Email','Phone','Country Code','Marketing Opt-in','Terms Accepted (UTC)','Created (UTC)','Updated (UTC)','Last Opened (UTC)'],
    ...rows.map(r=>[r.id,r.full_name,r.email,r.phone,r.country_code,r.marketing_opt_in?'Yes':'No',r.terms_accepted_at,r.created_at,r.updated_at,r.last_opened_at].map(value))
  ];
  if(name==='consultations')return [
    ['Request ID','Client ID','Service','Consultation','Appointment (UTC)','Appointment (IST)','Mode','Status','Name','Date of Birth','Phone','WhatsApp','Current City','Current State','Current Country','Company','Property Status','Property Type','Analysis Mode','Submitted (UTC)','Consent (UTC)','Submitted Details (JSON)'],
    ...rows.map(r=>{const d=r.details||{};const details=Object.fromEntries([...consultationFields].filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));return [r.id,r.account_id,r.service_name||r.service,r.related_service,r.appointment_start,india(r.appointment_start),r.consultation_mode||d.consultationMode,r.status,d.fullName||d.legalName,d.dateOfBirth,d.phone,d.whatsapp,d.currentCity,d.currentState,d.currentCountry,d.companyName,d.propertyStatus,d.propertyType,d.analysisMode,r.submitted_at,r.consent_at,details].map(value);})
  ];
  if(name==='calendar')return [
    ['Appointment ID','Appointment (UTC)','Appointment (IST)','Service','Consultation','Mode','Status','Client','Phone','WhatsApp','Submitted (UTC)'],
    ...rows.map(r=>{const d=r.details||{};return [r.id,r.appointment_start,india(r.appointment_start),r.service,r.related_service,r.consultation_mode||d.consultationMode,r.status,d.fullName||d.legalName,d.phone,d.whatsapp,r.submitted_at].map(value);})
  ];
  if(name==='orders')return [
    ['Order ID','Client ID','Order Number','Payment Reference','Payment Status','Order Status','Currency','Total (INR)','Items','Delivery Address','Tracking Reference','Ordered (UTC)','Updated (UTC)'],
    ...rows.map(r=>[r.id,r.user_id,r.order_number,r.payment_reference,r.payment_status,r.status,r.currency,r.total!==null&&r.total!==undefined&&Number.isFinite(Number(r.total))?(Number(r.total)/100).toFixed(2):'',r.items,r.delivery_address,r.tracking_reference,r.ordered_at,r.updated_at].map(value))
  ];
  const fields=REPORTS[name].select.split(',').filter(k=>!k.includes('('));
  return [fields,...rows.map(r=>fields.map(k=>value(r[k])))];
}
export async function reportRows(name,db,max=10000){
  requireValue(Object.hasOwn(REPORTS,name),'Invalid report.');
  requireValue(Number.isInteger(max)&&max>0&&max<=10000,'Invalid export limit.',503);
  const spec=REPORTS[name],rows=[];
  for(let offset=0;offset<=max;offset+=500){
    const batch=await db(`${spec.table}?select=${spec.select}&order=${spec.order}&limit=500&offset=${offset}`);
    rows.push(...batch);requireValue(rows.length<=max,`The ${name} export exceeds its configured limit; increase capacity before syncing.`,409);
    if(batch.length<500)break;
  }
  return rows;
}
export function csvRows(rows){
  const cell=value=>{
    let text=String(value??'').replace(/\r?\n/g,' ');
    if(/^[=+\-@]/.test(text))text="'"+text;
    return `"${text.replace(/"/g,'""')}"`;
  };
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export async function syncSheets(env,db){
  requireValue(env.SHEETS_SYNC_ENABLED==='true'&&/^[A-Za-z0-9_-]+$/.test(env.GOOGLE_SHEET_ID||''),'Google Sheets sync is not enabled.',503);
  const locked=await db('rpc/claim_sheets_sync',{method:'POST',body:{}});requireValue(locked,'A Sheets sync is already in progress.',409);
  try{
    const max=Number(env.SHEETS_MAX_ROWS||10000);requireValue(Number.isInteger(max)&&max>0&&max<=10000,'Invalid export limit.',503);
    const token=await googleToken(env);const root=`https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}`;
    const google=async(path,options={})=>{
      const r=await fetch(root+path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(20000)});
      requireValue(r.ok,'Google Sheets write failed; sync can be retried.',502);return r.json();
    };
    const snapshot=await google('?fields=sheets.properties');
    const counts={};
    for(const [name,spec] of Object.entries(REPORTS)){
      const rows=await reportRows(name,db,max);
      const values=sheetRows(name,rows);const title=SHEET_TITLES[name];let existing=snapshot.sheets?.find(s=>s.properties.title===title);
      if(!existing){const added=await google(':batchUpdate',{method:'POST',body:{requests:[{addSheet:{properties:{title,gridProperties:{rowCount:Math.max(values.length,1000),columnCount:Math.max(values[0].length,26)}}}}]}});existing=added.replies[0].addSheet;}
      const rowCount=Math.max(existing.properties.gridProperties.rowCount,values.length);
      const columnCount=Math.max(existing.properties.gridProperties.columnCount,values[0].length);
      await google(':batchUpdate',{method:'POST',body:{requests:[{updateSheetProperties:{properties:{sheetId:existing.properties.sheetId,gridProperties:{rowCount,columnCount,frozenRowCount:1}},fields:'gridProperties'}}]}});
      // RAW prevents customer values beginning with '=' from becoming spreadsheet formulas.
      await google(`/values/${encodeURIComponent(title+'!A1')}?valueInputOption=RAW`,{method:'PUT',body:{majorDimension:'ROWS',values}});
      if(rowCount>values.length)await google(`/values/${encodeURIComponent(title+'!A'+(values.length+1)+':ZZ'+rowCount)}:clear`,{method:'POST',body:{}});
      counts[name]=rows.length;
    }
    const refreshedAt=new Date().toISOString();const dashboard=overviewRows(counts,refreshedAt);
    let overview=snapshot.sheets?.find(s=>s.properties.title==='Overview');
    if(!overview){const added=await google(':batchUpdate',{method:'POST',body:{requests:[{addSheet:{properties:{title:'Overview',index:0,gridProperties:{rowCount:1000,columnCount:26,frozenRowCount:4}}}}]}});overview=added.replies[0].addSheet;}
    await google(':batchUpdate',{method:'POST',body:{requests:[{updateSheetProperties:{properties:{sheetId:overview.properties.sheetId,gridProperties:{rowCount:Math.max(overview.properties.gridProperties?.rowCount||0,1000),columnCount:Math.max(overview.properties.gridProperties?.columnCount||0,26),frozenRowCount:4}},fields:'gridProperties'}}]}});
    await google(`/values/${encodeURIComponent('Overview!A1')}?valueInputOption=RAW`,{method:'PUT',body:{majorDimension:'ROWS',values:dashboard}});
    await db('integration_jobs?name=eq.sheets',{method:'PATCH',body:{locked_until:null,last_success:refreshedAt,last_error:null}});
    // Expired rate-limit keys need not be retained.
    await db(`api_rate_limits?expires_at=lt.${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}`,{method:'DELETE'});
    return {synced:true,counts,refreshedAt};
  }catch(error){
    await db('integration_jobs?name=eq.sheets',{method:'PATCH',body:{locked_until:null,last_error:'Sync failed. Check service permissions, Sheet capacity and configuration.'}}).catch(()=>{});
    throw error instanceof HttpError?error:new HttpError(502,'Google Sheets sync failed. No credentials were logged.');
  }
}
