(() => {
  const section=document.createElement('section');section.className='account-history-section';
  const heading=document.createElement('h2');heading.textContent='Your consultation appointments';
  const policy=document.createElement('p');policy.textContent='Consultation payments, confirmations, rescheduling and cancellation requests are handled only in the verified SIAOS WhatsApp conversation.';
  const content=document.createElement('div');content.className='account-history-grid';content.setAttribute('aria-live','polite');section.append(heading,policy,content);
  document.querySelector('.account-main')?.append(section);
  const when=value=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value))+' IST';
  async function load(){
    const account=window.SIAOSAccount,session=await account.getSession();
    if(!session?.access_token){content.textContent='Verify your phone number to see live appointments.';return;}
    const {data,error}=await account.client.from('appointments').select('id,service,related_service,start_at,status,hold_expires_at').order('start_at',{ascending:false}).limit(100);
    if(error)throw error;
    if(!data.length){content.textContent='No appointments yet.';return;}
    data.forEach(item=>{
      const card=document.createElement('article');card.className='history-card';
      const h=document.createElement('h3');h.textContent=item.related_service;
      const appointmentTime=document.createElement('p');appointmentTime.textContent=when(item.start_at);
      const status=document.createElement('p');const expired=item.status==='held'&&Date.parse(item.hold_expires_at)<=Date.now();
      status.textContent=expired?'Reservation expired':item.status==='held'?'Saving booking request':item.status==='requested'?'Request sent on WhatsApp — awaiting SIAOS confirmation':item.status;
      card.append(h,appointmentTime,status);
      if(['held','requested','confirmed'].includes(item.status)&&Date.parse(item.start_at)>Date.now()){
        const message=`Hello SIAOS, I need help with appointment ${item.id} for ${item.related_service} on ${when(item.start_at)}.`;
        const link=document.createElement('a');link.className='btn';link.target='_blank';link.rel='noopener noreferrer';link.href=`https://wa.me/919173569555?text=${encodeURIComponent(message)}`;link.textContent='Manage on WhatsApp';card.append(link);
      }
      content.append(card);
    });
  }
  load().catch(error=>{content.textContent=error.message||'Appointments could not be loaded.';});
})();
