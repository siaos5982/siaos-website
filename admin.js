(() => {
  const $=id=>document.getElementById(id),account=window.SIAOSAccount;
  let offset=0,date='',factorId='',busy=false,recordRows=[];
  const indiaDate=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'});
  const status=message=>{$('adminStatus').textContent=message;};
  const money=paise=>'₹'+(Number(paise||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const label=key=>key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const dateKey=key=>/(?:_at|_start|created|updated|ordered|paid|purchased|expires|deleted)$/.test(key);
  const statusKey=key=>['status','payment_status','refund_status','active'].includes(key);
  const amountKey=key=>/(?:^|_)(?:amount|total|subtotal|shipping_amount|unit_amount|eligible_amount|refunded_amount)$/.test(key);
  const columns={
    consultations:['id','service_name','related_service','appointment_start','consultation_mode','status','details','consent_at','submitted_at','operator_action'],
    calendar:['id','appointment_start','service','related_service','consultation_mode','status','details','operator_action'],
    clients:['id','full_name','email','phone','marketing_opt_in','terms_accepted_at','created_at','last_opened_at','operator_action'],
    deleted_accounts:['account_id','account_created_at','deleted_at','deletion_source'],
    orders:['id','order_number','payment_status','status','currency','total','items','delivery_address','tracking_reference','ordered_at','updated_at','operator_action'],
    payments:['id','gateway_order_id','gateway_payment_id','kind','item_name','quantity','amount','refunded_amount','status','refund_status','method','paid_at','created_at','operator_action'],
    refunds:['id','transaction_id','source','reason','eligible_amount','gateway_refund_id','status','attempts','last_error','requested_at','processed_at','operator_action'],
    catalog:['kind','slug','variant','name','unit_amount','shipping_amount','active','operator_action'],
    visitors:['event_name','path','target','referrer','occurred_at','metadata'],
    readings:['id','reading_type','title','created_at'],
    reports:['id','report_type','title','status','purchased_at','access_expires_at'],
    audits:['id','user_id','action','target','created_at']
  };
  const consultationTransitions={requested:['requested','contacted','cancelled'],contacted:['contacted','confirmed','cancelled'],confirmed:['confirmed','completed','cancelled','no_show'],completed:['completed'],cancelled:['cancelled'],no_show:['no_show']};
  const orderTransitions=row=>({awaiting_payment:row.payment_status==='paid'?['awaiting_payment']:['awaiting_payment','cancelled'],confirmed:['confirmed','processing'],processing:['processing','dispatched'],dispatched:['dispatched','delivered'],delivered:['delivered'],cancelled:['cancelled'],returned:['returned']})[row.status]||[row.status];

  function formattedValue(key,value){
    if(value===null||value===undefined||value==='')return '—';
    if(typeof value==='boolean')return value?'Yes':'No';
    if(amountKey(key)&&Number.isFinite(Number(value)))return money(value);
    if(dateKey(key)){const d=new Date(value);if(Number.isFinite(d.getTime()))return indiaDate.format(d)+' IST';}
    return String(value);
  }
  function appendValue(td,key,value){
    if(value&&typeof value==='object'){
      const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='View details';pre.textContent=JSON.stringify(value,null,2);details.append(summary,pre);td.append(details);return;
    }
    if(statusKey(key)){
      const pill=document.createElement('span');pill.className='status-pill';pill.dataset.status=String(value).toLowerCase();pill.textContent=formattedValue(key,value);td.append(pill);return;
    }
    td.textContent=formattedValue(key,value);
  }
  const actionButton=(text,handler)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=text;button.onclick=handler;return button;};
  const selectFor=(values,current)=>{const select=document.createElement('select');values.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=label(value);option.selected=value===current;select.append(option);});return select;};
  function operatorCell(td,type,row){
    const wrap=document.createElement('div');wrap.className='cell-actions';
    if(['consultations','calendar'].includes(type)){
      const phone=String(row.details?.whatsapp||row.details?.phone||'').replace(/\D/g,'');
      if(phone){const link=document.createElement('a');link.className='btn';link.target='_blank';link.rel='noopener noreferrer';link.href='https://wa.me/'+phone+'?text='+encodeURIComponent('Namaste, this is SIAOS regarding your consultation booking '+row.id+'.');link.textContent='WhatsApp';wrap.append(link);}
      const choices=consultationTransitions[row.status]||[row.status],select=selectFor(choices,row.status);
      const save=actionButton('Save status',()=>run(async()=>{save.disabled=true;status('Updating consultation status…');await window.SIAOSApi('admin/consultations/'+row.id,{method:'PATCH',body:{status:select.value}});status('Consultation status updated to '+label(select.value)+'.');await Promise.all([records(),loadSummary()]);}));
      if(choices.length===1){select.disabled=true;save.disabled=true;}wrap.append(select,save);
    }else if(type==='orders'){
      const select=selectFor(orderTransitions(row),row.status),tracking=document.createElement('input');tracking.placeholder='Tracking reference';tracking.value=row.tracking_reference||'';tracking.maxLength=120;
      const save=actionButton('Save fulfilment',()=>run(async()=>{save.disabled=true;status('Updating order fulfilment…');await window.SIAOSApi('admin/orders/'+row.id,{method:'PATCH',body:{status:select.value,trackingReference:tracking.value.trim()}});status('Order fulfilment updated.');await Promise.all([records(),loadSummary()]);}));
      if(orderTransitions(row).length===1&&['delivered','cancelled','returned'].includes(row.status)){select.disabled=true;tracking.disabled=true;save.disabled=true;}wrap.append(select,tracking,save);
    }else if(type==='refunds'){
      if(['requested','processing','review_required'].includes(row.status)&&Number(row.eligible_amount)>0)wrap.append(actionButton('Reconcile / issue',()=>run(async()=>{status('Reconciling refund with Razorpay…');const result=await window.SIAOSApi('admin/refunds/'+row.id+'/issue',{method:'POST',body:{}});status('Refund '+result.status+'. Provider reference: '+(result.refundId||'pending'));await Promise.all([records(),loadSummary()]);})));
    }else if(type==='clients'){
      const phone=String(row.phone||'').replace(/\D/g,'');if(phone){const link=document.createElement('a');link.className='btn';link.target='_blank';link.rel='noopener noreferrer';link.href='https://wa.me/'+phone;link.textContent='WhatsApp';wrap.append(link);}if(row.email){const email=document.createElement('a');email.className='btn';email.href='mailto:'+row.email;email.textContent='Email';wrap.append(email);}
    }else if(type==='payments'){
      wrap.append(actionButton('Prepare refund',()=>{$('refundTransaction').value=row.id;$('refundAmount').value=Math.max(0,(Number(row.amount||0)-Number(row.refunded_amount||0))/100).toFixed(2);document.querySelectorAll('.admin-toolbox')[1].open=true;$('refundReason').focus();status('Refund form prepared. Verify the amount and enter an approved reason.');}));
    }else if(type==='catalog'){
      wrap.append(actionButton('Edit price',()=>{$('catalogSlug').value=row.slug||'';$('catalogVariant').value=row.variant||'';$('catalogName').value=row.name||'';$('catalogPrice').value=(Number(row.unit_amount||0)/100).toFixed(2);$('catalogShipping').value=(Number(row.shipping_amount||0)/100).toFixed(2);$('catalogActive').checked=Boolean(row.active);document.querySelectorAll('.admin-toolbox')[0].open=true;$('catalogPrice').focus();}));
    }
    if(!wrap.children.length)wrap.textContent='—';td.append(wrap);
  }
  function renderRecords(){
    const type=$('recordType').value,q=$('recordSearch').value.trim().toLowerCase();
    const rows=q?recordRows.filter(row=>JSON.stringify(row).toLowerCase().includes(q)):recordRows;
    const keys=columns[type]||[...new Set(rows.flatMap(row=>Object.keys(row)))];
    const table=$('recordsTable');table.tHead.replaceChildren();table.tBodies[0].replaceChildren();
    const heading=table.tHead.insertRow();keys.forEach(key=>{const th=document.createElement('th');th.textContent=key==='operator_action'?'Actions':label(key);heading.append(th);});
    rows.forEach(row=>{const tr=table.tBodies[0].insertRow();keys.forEach(key=>{const td=tr.insertCell();if(key==='operator_action')operatorCell(td,type,row);else appendValue(td,key,row[key]);});});
    if(!rows.length){const tr=table.tBodies[0].insertRow(),td=tr.insertCell();td.colSpan=Math.max(1,keys.length);td.className='empty-state';td.textContent=q?'No records match this search.':'No records in this dataset yet.';}
    $('recordPage').textContent=recordRows.length?`Records ${offset+1}–${offset+recordRows.length}${q?` · ${rows.length} matches`:''}`:'No records for this selection.';
  }
  async function records(){
    const type=$('recordType').value;
    const data=await window.SIAOSApi('admin/records?type='+encodeURIComponent(type)+'&offset='+offset+(type==='calendar'&&date?'&date='+encodeURIComponent(date):''));
    recordRows=data.rows||[];$('recordSearch').value='';$('recordsHeading').textContent=type==='calendar'&&date?'Appointments · '+date+' · IST':$('recordType').selectedOptions[0].textContent;
    $('previousPage').disabled=offset===0;$('nextPage').disabled=!data.hasMore;renderRecords();
  }
  function calendar(){
    const month=$('calendarMonth').value;if(!/^\d{4}-\d{2}$/.test(month))return;
    const [year,m]=month.split('-').map(Number),count=new Date(year,m,0).getDate(),first=new Date(year,m-1,1).getDay(),grid=$('adminCalendar');grid.replaceChildren();
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day=>{const el=document.createElement('strong');el.textContent=day;grid.append(el);});for(let i=0;i<first;i++)grid.append(document.createElement('span'));
    for(let d=1;d<=count;d++){const button=document.createElement('button');button.textContent=d;button.type='button';const day=month+'-'+String(d).padStart(2,'0');button.setAttribute('aria-label','View appointments for '+day);button.addEventListener('click',()=>run(async()=>{date=day;offset=0;$('recordType').value='calendar';grid.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));button.classList.add('selected');await records();}));grid.append(button);}
  }
  const metricCard=(value,title,note='')=>{const card=document.createElement('article'),n=document.createElement('strong'),text=document.createElement('span');n.textContent=value;text.textContent=title;card.append(n,text);if(note){const small=document.createElement('small');small.textContent=note;card.append(small);}return card;};
  function renderRanked(id,rows,valueKey,title){const root=$(id);root.replaceChildren();if(!rows?.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='No activity recorded for this period.';root.append(empty);return;}rows.slice(0,6).forEach((row,index)=>{const item=document.createElement('div');item.className='ranked-item';const rank=document.createElement('b'),name=document.createElement('span'),value=document.createElement('strong');rank.textContent=index+1;name.textContent=title(row);value.textContent=Number(row[valueKey]||0).toLocaleString('en-IN');item.append(rank,name,value);root.append(item);});}
  function renderTrend(rows){const root=$('adminTrend');root.replaceChildren();if(!rows?.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='Analytics will appear after consented visits are recorded.';root.append(empty);return;}const max=Math.max(1,...rows.map(row=>Number(row.views||0)));rows.forEach(row=>{const day=document.createElement('div'),bar=document.createElement('span'),dateLabel=document.createElement('small');day.className='trend-day';bar.className='trend-bar';bar.style.height=Math.max(3,Math.round(Number(row.views||0)/max*145))+'px';bar.title=`${row.day}: ${row.views||0} views`;dateLabel.textContent=String(row.day).slice(5);day.append(bar,dateLabel);root.append(day);});}
  async function loadSummary(){
    const days=Number($('summaryPeriod').value||30),data=await window.SIAOSApi('admin/summary?days='+days),b=data.business||{},t=data.totals||{},metrics=$('adminMetrics');metrics.replaceChildren();
    [['Total customers',b.customers||0,'All active browser accounts'],['New customers',b.new_customers||0,`Last ${days} days`],['Consultation requests',b.consultations||0,`Last ${days} days`],['Awaiting consultation action',b.consultations_pending||0,'Requested or contacted'],['Product orders',b.product_orders||0,`Last ${days} days`],['Paid purchases',b.paid_orders||0,`Last ${days} days`],['Net revenue',money(b.revenue_paise||0),`Last ${days} days`],['Refunds requiring attention',b.refunds_pending||0,'Open cases'],['Page views',t.page_views||0,`Last ${days} days`],['Unique visitors',t.visitors||0,'Consented analytics'],['Sessions',t.sessions||0,'Consented analytics'],['Tracked clicks',t.clicks||0,'Consented analytics']].forEach(item=>metrics.append(metricCard(item[1],item[0],item[2])));
    $('summaryWindow').textContent=`Live business and consented analytics · last ${days} days`;
    const attention=$('attentionList');attention.replaceChildren();[['Consultations',b.consultations_pending||0],['Refunds',b.refunds_pending||0],['Payment attempts',b.payment_attempts||0],['Orders',b.product_orders||0]].forEach(([name,value],index)=>{const item=document.createElement('div');item.className='attention-item'+(value&&index<2?' is-alert':'');const n=document.createElement('strong'),text=document.createElement('span');n.textContent=value;text.textContent=name;item.append(n,text);attention.append(item);});
    const sync=data.integrations||{},last=sync.sheets_last_success?indiaDate.format(new Date(sync.sheets_last_success))+' IST':'Not synced yet',syncEl=$('sheetSyncState');syncEl.textContent='Google Sheets: '+last+(sync.sheets_last_error?' · Attention required':' · Live feeds active');syncEl.className='admin-integration-state '+(sync.sheets_last_error?'is-error':'is-success');
    renderTrend(data.daily||[]);renderRanked('topPages',data.topPages||[],'views',row=>row.path||'Unknown page');renderRanked('topClicks',data.topClicks||[],'clicks',row=>(row.target||'Interaction')+' · '+(row.path||'/'));
  }
  async function openDashboard(){
    const session=await account.getAdminSession();$('mfaPanel').hidden=true;$('mfaQr').replaceChildren();$('adminWorkspace').hidden=false;
    if(session?.user){$('adminIdentity').hidden=false;$('adminIdentity').replaceChildren();const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=session.user.email||'Approved administrator';span.textContent='MFA verified · restricted access';$('adminIdentity').append(strong,span);}
    calendar();await Promise.all([loadSummary(),records()]);status('Dashboard is live. All displayed information comes from the protected backend.');
  }
  async function run(fn){if(busy)return;busy=true;document.body.classList.add('admin-busy');try{await fn();}catch(e){status(e.message||'Operation failed.');}finally{busy=false;document.body.classList.remove('admin-busy');}}
  $('recordType').onchange=()=>run(async()=>{offset=0;date='';await records();});$('recordSearch').oninput=renderRecords;$('reloadRecords').onclick=()=>run(records);$('previousPage').onclick=()=>run(async()=>{offset=Math.max(0,offset-100);await records();});$('nextPage').onclick=()=>run(async()=>{offset+=100;await records();});$('calendarRefresh').onclick=()=>{date='';calendar();};$('refreshDashboard').onclick=()=>run(()=>Promise.all([loadSummary(),records()]));$('summaryPeriod').onchange=()=>run(loadSummary);
  $('catalogForm').onsubmit=event=>{event.preventDefault();run(async()=>{const unitAmount=Math.round(Number($('catalogPrice').value)*100),shippingAmount=Math.round(Number($('catalogShipping').value)*100);if(!Number.isSafeInteger(unitAmount)||!Number.isSafeInteger(shippingAmount))throw new Error('Enter valid rupee amounts.');await window.SIAOSApi('admin/catalog',{method:'POST',body:{kind:'product',slug:$('catalogSlug').value.trim(),variant:$('catalogVariant').value.trim(),name:$('catalogName').value.trim(),unitAmount,shippingAmount,active:$('catalogActive').checked}});status('Approved catalogue price saved.');if($('recordType').value==='catalog'){offset=0;await records();}});};
  $('refundForm').onsubmit=event=>{event.preventDefault();run(async()=>{if(!confirm('Issue this approved refund to the original payment method?'))return;const amount=Math.round(Number($('refundAmount').value)*100);if(!Number.isSafeInteger(amount))throw new Error('Enter a valid rupee amount.');const result=await window.SIAOSApi('admin/refunds',{method:'POST',body:{transactionId:$('refundTransaction').value.trim(),amount,reason:$('refundReason').value.trim()}});status('Refund '+(result.refund?.status||result.status)+'. Request '+result.id+'.');$('refundForm').reset();await loadSummary();if($('recordType').value==='refunds'){offset=0;await records();}});};
  $('adminSignOut').onclick=async()=>{await account.adminSignOut();location.replace('index.html');};
  $('enrolMfa').onclick=()=>run(async()=>{const {data,error}=await account.client.auth.mfa.enroll({factorType:'totp',friendlyName:'SIAOS administrator'});if(error)throw error;factorId=data.id;const img=document.createElement('img');img.alt='Scan this QR code with your authenticator app';img.src=data.totp.qr_code.startsWith('data:')?data.totp.qr_code:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(data.totp.qr_code);$('mfaQr').replaceChildren(img);$('enrolMfa').disabled=true;status('Scan the code privately, then enter a current code.');});
  $('mfaForm').onsubmit=event=>{event.preventDefault();run(async()=>{if(!factorId)throw new Error('Set up an authenticator first.');const {error}=await account.client.auth.mfa.challengeAndVerify({factorId,code:$('mfaCode').value});if(error)throw error;$('mfaCode').value='';await openDashboard();});};
  async function prepareAdmin(){
    const session=await account.getAdminSession();if(!session?.access_token){$('adminLoginPanel').hidden=false;status('Administrator sign-in is required.');return;}$('adminLoginPanel').hidden=true;
    const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit'}).formatToParts(new Date()),year=parts.find(p=>p.type==='year')?.value,month=parts.find(p=>p.type==='month')?.value;$('calendarMonth').value=`${year}-${month}`;
    const {data,error}=await account.client.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;if(data.currentLevel==='aal2'){await openDashboard();return;}
    const factors=await account.client.auth.mfa.listFactors();if(factors.error)throw factors.error;factorId=factors.data.totp?.find(f=>f.status==='verified')?.id||'';$('enrolMfa').hidden=Boolean(factorId);$('mfaPanel').hidden=false;status('Verify your authenticator. Server-side administrator approval is also required.');
  }
  $('adminLoginForm').onsubmit=event=>{event.preventDefault();run(async()=>{status('Signing in securely…');const {error}=await account.client.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});if(error)throw error;$('adminPassword').value='';await prepareAdmin();});};
  run(prepareAdmin);
})();
