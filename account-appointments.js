(() => {
  const section=document.createElement('section');section.className='account-history-section';
  const heading=document.createElement('h2');heading.textContent='Your consultation appointments';
  const policy=document.createElement('p');policy.append('Consultation payments and confirmation are completed with SIAOS on WhatsApp. ',Object.assign(document.createElement('a'),{href:'cancellation-policy.html',textContent:'Read the cancellation policy.'}));
  const content=document.createElement('div');content.className='account-history-grid';content.setAttribute('aria-live','polite');section.append(heading,policy,content);
  document.querySelector('.account-main')?.append(section);
  const money=paise=>'₹'+(Number(paise||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const when=value=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value))+' IST';
  function refundText(refund){
    if(!refund)return '';
    if(refund.status==='not_due')return 'Cancellation completed · no refund is due under the published schedule.';
    return `${refund.policy_percent}% refund · ${money(refund.eligible_amount)} · ${String(refund.status).replace(/_/g,' ')}`;
  }
  async function load(){
    const account=window.SIAOSAccount,session=await account.getSession();
    if(!session?.access_token){content.textContent='Verify your phone number to see live appointments.';return;}
    const [{data,error},refundData]=await Promise.all([
      account.client.from('appointments').select('id,service,related_service,start_at,status,hold_expires_at,direct_payment_amount,direct_refund_amount,direct_refund_percent,direct_refund_status,direct_refund_reference').order('start_at',{ascending:false}).limit(100),
      window.SIAOSApi('consultations/refunds').catch(()=>({rows:[]}))
    ]);
    if(error)throw error;
    if(!data.length){content.textContent='No appointments yet.';return;}
    const refunds=new Map((refundData.rows||[]).map(item=>[item.appointment_id,item]));
    data.forEach(item=>{
      const card=document.createElement('article');card.className='history-card';
      const h=document.createElement('h3');h.textContent=item.related_service;
      const appointmentTime=document.createElement('p');appointmentTime.textContent=when(item.start_at);
      const status=document.createElement('p');const expired=item.status==='held'&&Date.parse(item.hold_expires_at)<=Date.now();
      status.textContent=expired?'Reservation expired':item.status==='held'?'Saving booking request':item.status==='requested'?'Request sent on WhatsApp — awaiting SIAOS confirmation':item.status;
      card.append(h,appointmentTime,status);
      const existing=refunds.get(item.id);if(existing){const note=document.createElement('p');note.textContent=refundText(existing);card.append(note);}
      else if(item.direct_refund_status&&item.direct_refund_status!=='none'){const note=document.createElement('p');note.textContent=item.direct_refund_status==='required'?`${item.direct_refund_percent}% direct refund · ${money(item.direct_refund_amount)} · awaiting transfer by SIAOS`:item.direct_refund_status==='processed'?`${item.direct_refund_percent}% direct refund · ${money(item.direct_refund_amount)} · processed${item.direct_refund_reference?' · reference '+item.direct_refund_reference:''}`:'Cancellation completed · no refund is due under the published schedule.';card.append(note);}
      const cancellable=['held','requested','confirmed'].includes(item.status)&&Date.parse(item.start_at)>Date.now()&&!existing;
      if(cancellable){
        const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Cancel appointment';
        button.addEventListener('click',async()=>{
          if(!confirm('Cancel this appointment request? If a payment was made directly to SIAOS, the published cancellation policy will be handled with the team.'))return;
          const reason=prompt('Optional reason for cancellation (do not include sensitive information):','')??null;if(reason===null)return;
          button.disabled=true;status.textContent='Cancelling appointment…';
          try{
            const result=await window.SIAOSApi('consultations/cancel',{method:'POST',body:{appointmentId:item.id,reason}});
            status.textContent='cancelled';const note=document.createElement('p');note.textContent=result.message||refundText({status:result.refund?.status||result.status,policy_percent:result.policyPercent,eligible_amount:result.eligibleAmount});card.append(note);button.remove();
          }catch(error){status.textContent=error.message||'Cancellation could not be completed.';button.disabled=false;}
        });card.append(button);
      }
      content.append(card);
    });
  }
  load().catch(error=>{content.textContent=error.message||'Appointments could not be loaded.';});
})();
