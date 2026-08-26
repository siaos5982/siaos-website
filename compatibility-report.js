(() => {
  const target = document.querySelector('#compatibilityReportContent');
  const escapeHtml = value => String(value).replace(/[&<>'"]/g,character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  let report = null;
  try { report = JSON.parse(sessionStorage.getItem('siaosCompatibility')); } catch {}

  if (!report || !Array.isArray(report.sections)) {
    target.innerHTML = `<div class="report-empty"><span class="kicker">No saved calculation</span><h2>Calculate both birth dates first</h2><p>This private report is created after the Mulank and Bhagyank calculator is completed.</p><a class="btn fill" href="index.html#compatibility">Open Compatibility Calculator</a></div>`;
    return;
  }

  const cards = report.sections.map(section => `<article><span>${escapeHtml(section.label)}</span><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.copy)}</p></article>`).join('');
  target.innerHTML = `
    <div class="compatibility-overview report-overview">
      <div class="compatibility-score"><strong>${escapeHtml(report.score)}%</strong><span>Compatibility</span></div>
      <div class="number-pair">
        <article><span>You</span><b>${escapeHtml(report.yourMulank)}</b><small>Mulank</small><b>${escapeHtml(report.yourBhagyank)}</b><small>Bhagyank</small></article>
        <article><span>Partner</span><b>${escapeHtml(report.partnerMulank)}</b><small>Mulank</small><b>${escapeHtml(report.partnerBhagyank)}</b><small>Bhagyank</small></article>
      </div>
    </div>
    <div class="compatibility-details report-details">${cards}</div>
    <div class="compatibility-lock">
      <div class="blurred-report" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="unlock-overlay"><span class="lock-mark">◇</span><h3>Your personalised solution is ready</h3><p>Unlock the complete communication guidance, balance practices and personalised compatibility solution.</p><a class="btn fill" href="payment.html?product=compatibility-report">Unlock Full Report · ₹99</a></div>
    </div>
    <p class="compatibility-disclaimer">This numerology score is a reflective guide, not a guarantee or verdict about a relationship. Real compatibility also depends on communication, consent, behaviour and shared values.</p>`;
})();
