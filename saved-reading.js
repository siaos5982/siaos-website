(() => {
  const target=document.querySelector('#savedReadingContent');
  const id=new URLSearchParams(location.search).get('id');
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate=value=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
  const suitSymbol=suit=>({Wands:'✦',Cups:'♢',Swords:'†',Pentacles:'⟡'}[suit]||'✦');
  const cardVisual=card=>card.image?`<img class="tarot-card-art" src="${escapeHtml(card.image)}" alt="Illustrated ${escapeHtml(card.name)} Tarot card">`:`<div class="tarot-card-art tarot-card-art-fallback" role="img" aria-label="SIAOS ${escapeHtml(card.name)} Tarot card"><span>${escapeHtml(card.suit||'Major Arcana')}</span><b>${suitSymbol(card.suit)}</b><strong>${escapeHtml(card.name)}</strong><i>${escapeHtml(card.number)}</i></div>`;
  const fail=message=>{target.innerHTML=`<section><div class="report-empty"><span class="kicker">Reading unavailable</span><h2>${escapeHtml(message)}</h2><a class="btn fill" href="account.html">Return to My Account</a></div></section>`;};
  async function load(){
    try{
      if(!id) throw new Error('No saved reading was selected.');
      const reading=await window.SIAOSAccount.getReading(id); const payload=reading.payload||{};
      if(reading.readingType==='compatibility'){
        const cards=(payload.sections||[]).map(section=>`<article><span>${escapeHtml(section.label)}</span><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.copy)}</p></article>`).join('');
        target.innerHTML=`<section><div class="account-reading-heading"><span class="kicker">Saved ${escapeHtml(formatDate(reading.createdAt))}</span><h2>${escapeHtml(reading.title)}</h2></div><div class="compatibility-overview report-overview"><div class="compatibility-score"><strong>${escapeHtml(payload.score)}%</strong><span>Compatibility</span></div><div class="number-pair"><article><span>You</span><b>${escapeHtml(payload.yourMulank)}</b><small>Mulank</small><b>${escapeHtml(payload.yourBhagyank)}</b><small>Bhagyank</small></article><article><span>Partner</span><b>${escapeHtml(payload.partnerMulank)}</b><small>Mulank</small><b>${escapeHtml(payload.partnerBhagyank)}</b><small>Bhagyank</small></article></div></div><div class="compatibility-details report-details">${cards}</div></section>`;
      }else if(reading.readingType==='tarot'&&payload.card){
        const card=payload.card;target.innerHTML=`<section><div class="account-reading-heading"><span class="kicker">Saved ${escapeHtml(formatDate(reading.createdAt))}</span><h2>${escapeHtml(reading.title)}</h2></div><div class="tarot-report-layout"><article class="tarot-card report-tarot-card"><small>${escapeHtml(card.number)}</small>${cardVisual(card)}<h3>${escapeHtml(card.name)}</h3><span>${escapeHtml(card.keywords)}</span></article><div class="tarot-report-copy"><span class="kicker">Your question</span><blockquote>“${escapeHtml(payload.question)}”</blockquote><article><span>What this card is saying</span><h2>${escapeHtml(card.name)}</h2><p>${escapeHtml(card.message)}</p></article><article><span>How this guidance can benefit you</span><h2>The practical value</h2><p>${escapeHtml(card.benefit)}</p></article></div></div></section>`;
      }else target.innerHTML=`<section><div class="account-reading-heading"><span class="kicker">Saved ${escapeHtml(formatDate(reading.createdAt))}</span><h2>${escapeHtml(reading.title)}</h2><p>${escapeHtml(Object.values(reading.summary||{}).join(' · '))}</p></div></section>`;
    }catch(error){fail(error.message||'This reading could not be opened.');}
  }
  load();
})();
