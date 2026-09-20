(() => {
  const $=id=>document.getElementById(id),account=window.SIAOSAccount;
  let offset=0,date='',factorId='',busy=false;
  const status=message=>{$('adminStatus').textContent=message;};
  async function records(){
    const type=$('recordType').value;
    const data=await window.SIAOSApi('admin/records?type='+type+'&offset='+offset+(type==='calendar'&&date?'&date='+date:''));
    $('recordsHeading').textContent=type==='calendar'&&date?'Appointments · '+date+' · IST':$('recordType').selectedOptions[0].textContent;
    const columns=[...new Set(data.rows.flatMap(row=>Object.keys(row)))];if(['refunds','calendar'].includes(type))columns.push('operator_action');
    const table=$('recordsTable');table.tHead.replaceChildren();table.tBodies[0].replaceChildren();
    const heading=table.tHead.insertRow();columns.forEach(key=>{const th=document.createElement('th');th.textContent=key.replace(/_/g,' ');heading.append(th);});
    data.rows.forEach(row=>{const tr=table.tBodies[0].insertRow();columns.forEach(key=>{
      const td=tr.insertCell();
      if(key==='operator_action'&&type==='refunds'){
        if(['requested','processing','review_required'].includes(row.status)&&Number(row.eligible_amount)>0){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Reconcile / issue';button.onclick=()=>run(async()=>{button.disabled=true;status('Reconciling refund with Razorpay…');const result=await window.SIAOSApi('admin/refunds/'+row.id+'/issue',{method:'POST',body:{}});status('Refund '+result.status+'. Provider reference: '+(result.refundId||'pending'));await records();});td.append(button);}else td.textContent='—';
      }else if(key==='operator_action'&&type==='calendar'){
        if(row.status==='requested'){
          const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Confirm WhatsApp payment';button.onclick=()=>run(async()=>{
            const rupees=prompt('Consultation amount received (₹):','');if(rupees===null)return;
            const amount=Math.round(Number(rupees)*100);if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Enter a valid received amount.');
            const method=prompt('Direct payment method (for example UPI or bank transfer):','UPI');if(method===null)return;
            const reference=prompt('Payment reference:','');if(reference===null)return;
            if(!confirm('Confirm this appointment and record the direct payment?'))return;
            button.disabled=true;const result=await window.SIAOSApi('admin/consultations/'+row.id+'/confirm',{method:'POST',body:{amount,method,reference}});
            status('Appointment confirmed. Direct payment recorded: ₹'+(result.amount/100).toLocaleString('en-IN'));await records();
          });td.append(button);
        }else td.textContent='—';
      }else if(row[key]&&typeof row[key]==='object'){
        const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='View details';pre.textContent=JSON.stringify(row[key],null,2);details.append(summary,pre);td.append(details);
      }else td.textContent=String(row[key]??'—');
    });});
    $('previousPage').disabled=offset===0;$('nextPage').disabled=!data.hasMore;
    $('recordPage').textContent=data.rows.length?`Records ${offset+1}–${offset+data.rows.length}`:'No records for this selection.';
  }
  function calendar(){
    const month=$('calendarMonth').value;if(!/^\d{4}-\d{2}$/.test(month))return;
    const [year,m]=month.split('-').map(Number),count=new Date(year,m,0).getDate(),first=new Date(year,m-1,1).getDay();
    const grid=$('adminCalendar');grid.replaceChildren();
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day=>{const label=document.createElement('strong');label.textContent=day;grid.append(label);});
    for(let i=0;i<first;i++)grid.append(document.createElement('span'));
    for(let d=1;d<=count;d++){const button=document.createElement('button');button.textContent=d;button.type='button';const day=month+'-'+String(d).padStart(2,'0');button.setAttribute('aria-label','View appointments for '+day);button.addEventListener('click',()=>run(async()=>{date=day;offset=0;$('recordType').value='calendar';grid.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));button.classList.add('selected');await records();}));grid.append(button);}
  }
  async function openDashboard(){
    const data=await window.SIAOSApi('admin/summary');
    $('mfaPanel').hidden=true;$('mfaQr').replaceChildren();$('adminWorkspace').hidden=false;
    const metrics=$('adminMetrics');metrics.replaceChildren();
    for(const [label,value]of Object.entries({'Page views (30 days)':data.totals.page_views,'Consented visitors':data.totals.visitors,'Consultation requests':data.business.consultations,'Paid purchases':data.business.paid_orders,'Razorpay net revenue (INR)':(data.business.revenue_paise/100).toLocaleString('en-IN'),'Refunds requiring attention':data.business.refunds_pending||0})){
      const card=document.createElement('article'),n=document.createElement('strong'),text=document.createElement('span');n.textContent=value;text.textContent=label;card.append(n,text);metrics.append(card);
    }
    calendar();await records();status('Administrator verified. Times are shown in IST; raw timestamps retain their timezone.');
  }
  async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(e.message||'Operation failed.');}finally{busy=false;}}
  $('recordType').onchange=()=>run(async()=>{offset=0;date='';await records();});
  $('reloadRecords').onclick=()=>run(records);
  $('previousPage').onclick=()=>run(async()=>{offset=Math.max(0,offset-100);await records();});
  $('nextPage').onclick=()=>run(async()=>{offset+=100;await records();});
  $('calendarRefresh').onclick=calendar;
  $('syncSheets').onclick=()=>run(async()=>{status('Syncing restricted operational Sheets…');const result=await window.SIAOSApi('admin/sheets-sync',{method:'POST',body:{}});status('Sheets sync complete: '+Object.entries(result.counts).map(([k,v])=>k+' '+v).join(', '));});
  $('catalogForm').onsubmit=event=>{event.preventDefault();run(async()=>{
    const unitAmount=Math.round(Number($('catalogPrice').value)*100),shippingAmount=Math.round(Number($('catalogShipping').value)*100);
    if(!Number.isSafeInteger(unitAmount)||!Number.isSafeInteger(shippingAmount))throw new Error('Enter valid rupee amounts.');
    const value={kind:$('catalogKind').value,slug:$('catalogSlug').value.trim(),variant:$('catalogVariant').value.trim(),name:$('catalogName').value.trim(),unitAmount,shippingAmount,active:$('catalogActive').checked};
    await window.SIAOSApi('admin/catalog',{method:'POST',body:value});status('Approved catalogue price saved.');if($('recordType').value==='catalog'){offset=0;await records();}
  });};
  $('refundForm').onsubmit=event=>{event.preventDefault();run(async()=>{
    if(!confirm('Issue this approved refund to the original payment method?'))return;
    const amount=Math.round(Number($('refundAmount').value)*100);if(!Number.isSafeInteger(amount))throw new Error('Enter a valid rupee amount.');
    const result=await window.SIAOSApi('admin/refunds',{method:'POST',body:{transactionId:$('refundTransaction').value.trim(),amount,reason:$('refundReason').value.trim()}});
    status('Refund '+(result.refund?.status||result.status)+'. Request '+result.id+'.');$('refundForm').reset();if($('recordType').value==='refunds'){offset=0;await records();}
  });};
  $('adminSignOut').onclick=async()=>{await account.signOut();location.replace('login.html');};
  $('enrolMfa').onclick=()=>run(async()=>{
    const {data,error}=await account.client.auth.mfa.enroll({factorType:'totp',friendlyName:'SIAOS administrator'});if(error)throw error;factorId=data.id;
    const img=document.createElement('img');img.alt='Scan this QR code with your authenticator app';img.src=data.totp.qr_code.startsWith('data:')?data.totp.qr_code:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(data.totp.qr_code);$('mfaQr').replaceChildren(img);$('enrolMfa').disabled=true;status('Scan the code privately, then enter a code from your authenticator.');
  });
  $('mfaForm').onsubmit=event=>{event.preventDefault();run(async()=>{
    if(!factorId)throw new Error('Set up an authenticator first.');
    const {error}=await account.client.auth.mfa.challengeAndVerify({factorId,code:$('mfaCode').value});if(error)throw error;$('mfaCode').value='';await openDashboard();
  });};
  run(async()=>{
    const session=await account.getSession();if(!session?.access_token){location.replace('login.html?mode=signin&next=admin.html');return;}
    const india=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit'}).format(new Date());
    $('calendarMonth').value=/^\d{4}-\d{2}$/.test(india)?india:new Date().toISOString().slice(0,7);
    const {data,error}=await account.client.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;
    if(data.currentLevel==='aal2'){await openDashboard();return;}
    const factors=await account.client.auth.mfa.listFactors();if(factors.error)throw factors.error;
    factorId=factors.data.totp?.find(f=>f.status==='verified')?.id||'';
    $('enrolMfa').hidden=Boolean(factorId);$('mfaPanel').hidden=false;status('Verify your authenticator. Server-side admin approval is also required.');
  });
})();
