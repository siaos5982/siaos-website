(() => {
  const $=id=>document.getElementById(id);
  const summary=$('paymentSummary'),checkout=$('paymentCheckout');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const json=(storage,key)=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
  const productSlug=new URLSearchParams(location.search).get('product');
  async function start(){
    const session=await window.SIAOSAccount.getSession();
    if(!session?.access_token||session.demo){
      checkout.innerHTML='<h2>Verified sign-in required</h2><p>Please sign in before payment.</p><a class="btn fill" href="login.html?mode=signin&next='+encodeURIComponent('payment.html'+location.search)+'">Sign in</a>';return;
    }
    if(productSlug==='compatibility-report'){
      summary.innerHTML='<h2>Compatibility report</h2><p>The paid report is not available for purchase yet. No payment will be taken until its secure delivery is ready.</p>';
      checkout.innerHTML='<a class="btn" href="compatibility-report.html">Return to your preview</a>';return;
    }
    const product=productSlug?json(localStorage,'siaosPendingProduct'):null;
    const booking=productSlug?null:json(sessionStorage,'siaosBooking');
    if(productSlug?(!product||product.slug!==productSlug):!booking?.consultationId){
      checkout.innerHTML='<h2>No saved checkout found</h2><a class="btn" href="'+(productSlug?'products.html':'booking.html')+'">Start again</a>';return;
    }
    const selection=product?{kind:'product',slug:product.slug,variant:product.size||'Standard',quantity:Number(product.quantity||1)}:{kind:'consultation',slug:booking.service,variant:booking.relatedService,quantity:1,consultationId:booking.consultationId};
    summary.innerHTML='<h2>'+escape(product?.name||booking?.serviceName)+'</h2><p>'+escape(selection.variant)+' · Quantity '+selection.quantity+'</p><p>The final price is calculated by the secure server. Please check the amount displayed in Razorpay before authorising payment.</p>';
    const address=product?'<fieldset><legend>Delivery address · India</legend>'+[['name','Recipient name','name'],['phone','Phone number','tel'],['line1','Address line 1','address-line1'],['line2','Address line 2 (optional)','address-line2'],['city','City','address-level2'],['state','State','address-level1'],['postalCode','PIN code','postal-code']].map(([name,label,auto])=>'<label>'+label+'<input name="'+name+'" autocomplete="'+auto+'" maxlength="200" '+(name==='line2'?'':'required')+'></label>').join('')+'</fieldset>':'';
    checkout.innerHTML='<form id="checkoutForm" class="form">'+address+'<label><input name="purchaseConsent" type="checkbox" required> I agree to the published purchase policies and the processing of my order details in the restricted SIAOS dashboard and operational Google Sheets.</label><button class="btn fill" type="submit">Continue to secure payment</button></form><p id="checkoutStatus" role="status" aria-live="polite"></p><p>No card number or OTP is stored by SIAOS. Keep this page open until verification finishes.</p><a class="btn" href="account.html">My Account</a>';
    const form=$('checkoutForm'),button=form.querySelector('button'),status=$('checkoutStatus');
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!form.reportValidity())return;button.disabled=true;status.textContent='Preparing secure payment…';
      try {
        const input={...selection,consentAccepted:true};
        if(product){input.address=Object.fromEntries(new FormData(form));delete input.address.purchaseConsent;input.address.country='India';}
        const identity=session.user.id+'|'+JSON.stringify(input);
        let draft=json(sessionStorage,'siaosCheckoutIntent');
        if(!draft||draft.identity!==identity)draft={identity,requestId:crypto.randomUUID()};
        sessionStorage.setItem('siaosCheckoutIntent',JSON.stringify(draft));
        const order=await window.SIAOSApi('payments/create',{method:'POST',body:{...input,requestId:draft.requestId}});
        if(['paid','refunded'].includes(order.status)){status.textContent='This checkout is already '+order.status+'. See My Account.';return;}
        if(!window.Razorpay)throw new Error('Payment checkout failed to load. Check your connection.');
        const modal=new Razorpay({key:order.key,order_id:order.orderId,amount:order.amount,currency:order.currency,name:'SIAOS',description:order.name,
          prefill:{contact:session.user.phone||''},
          modal:{ondismiss:()=>{button.disabled=false;status.textContent='Checkout closed. If you paid, check My Account before trying again.';}},
          handler:async result=>{
            button.disabled=true;status.textContent='Verifying your payment…';
            try{
              const verified=await window.SIAOSApi('payments/verify',{method:'POST',body:{orderId:order.orderId,paymentId:result.razorpay_payment_id,signature:result.razorpay_signature}});
              status.textContent=verified.status==='paid'?(verified.requiresReview?'Payment received. Your reserved time expired; SIAOS must arrange a new time or refund.':'Payment verified. Your purchase is saved in My Account.'):'Payment is processing. Check My Account shortly; do not pay again.';
            }catch(error){status.textContent=error.message+' If money was deducted, do not pay again. Contact SIAOS with your Razorpay reference.';}
          }
        });
        modal.on('payment.failed',()=>{status.textContent='Payment attempt failed. If money was deducted, check its status before retrying.';button.disabled=false;});
        modal.open();
      }catch(error){status.textContent=error.message||'Checkout could not be opened.';button.disabled=false;}
    });
  }
  start().catch(error=>{checkout.textContent=error.message||'Checkout could not be opened.';});
})();
