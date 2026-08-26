(() => {
  const target = document.querySelector('#tarotReportContent');
  const bookingUrl = 'booking.html?service=tarot&subservice=Single%20Question%20Reading';
  const escapeHtml = value => String(value).replace(/[&<>'"]/g,character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  let report = null;
  try { report = JSON.parse(sessionStorage.getItem('siaosTarotReport')) || JSON.parse(localStorage.getItem('siaosTarotDailyDrawV2')); } catch {}

  if (!report?.card) {
    target.innerHTML = `<div class="report-empty"><span class="kicker">No saved card</span><h2>Ask your question first</h2><p>Your report page is created after the Tarot deck completes its shuffle.</p><a class="btn fill" href="index.html#tarot-draw">Draw Your Complimentary Card</a></div>`;
    return;
  }

  const card = report.card;
  target.innerHTML = `
    <div class="tarot-report-layout">
      <article class="tarot-card report-tarot-card">
        <small>${escapeHtml(card.number)}</small>
        <div class="tarot-card-sigil"><img src="assets/siaos-logo.webp" alt="SIAOS crest"></div>
        <h3>${escapeHtml(card.name)}</h3>
        <span>${escapeHtml(card.keywords)}</span>
      </article>
      <div class="tarot-report-copy">
        <span class="kicker">Your question</span>
        <blockquote>“${escapeHtml(report.question)}”</blockquote>
        <article><span>What this card is saying</span><h2>${escapeHtml(card.name)}</h2><p>${escapeHtml(card.message)}</p></article>
        <article><span>How this guidance can benefit you</span><h2>The practical value</h2><p>${escapeHtml(card.benefit)}</p></article>
        <a class="btn fill" href="${bookingUrl}">Get Your Full Tarot Reading</a>
      </div>
    </div>
    <p class="compatibility-disclaimer">Tarot is offered as reflective spiritual guidance and does not guarantee an outcome or replace medical, legal, financial or other licensed professional advice.</p>`;
})();
