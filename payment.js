(() => {
  const summaryTarget = document.querySelector('#paymentSummary');
  const checkoutTarget = document.querySelector('#paymentCheckout');
  const backTop = document.querySelector('#paymentBackTop');
  const kicker = document.querySelector('#paymentKicker');
  const title = document.querySelector('#paymentTitle');
  const intro = document.querySelector('#paymentIntro');
  const params = new URLSearchParams(window.location.search);
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const safeSessionJson = key => {
    try {
      return JSON.parse(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  };

  const renderCompatibilityReport = () => {
    const report = safeSessionJson('siaosCompatibility');
    const whatsappText = encodeURIComponent(
      `Namaste SIAOS, I would like to unlock my detailed Mulank & Bhagyank Compatibility Report for ₹99${report?.score ? ` (preview score: ${report.score}%)` : ''}. Please share the payment instructions.`
    );

    document.title = '₹99 Compatibility Report | SIAOS';
    kicker.textContent = 'Private Report';
    title.textContent = 'Unlock your compatibility report';
    intro.textContent = 'Continue securely to request the complete numerology guidance prepared from both dates of birth.';
    backTop.href = 'index.html#compatibility';
    backTop.textContent = 'Back to Compatibility';

    summaryTarget.innerHTML = report ? `
      <span class="kicker">Your saved preview</span>
      <div class="payment-order-grid">
        <div><strong>${escapeHtml(report.score)}%</strong><span>Compatibility score</span></div>
        <div><strong>${escapeHtml(report.yourMulank)} · ${escapeHtml(report.yourBhagyank)}</strong><span>Your Mulank · Bhagyank</span></div>
        <div><strong>${escapeHtml(report.partnerMulank)} · ${escapeHtml(report.partnerBhagyank)}</strong><span>Partner Mulank · Bhagyank</span></div>
      </div>` : `
      <h2>Your ₹99 compatibility report</h2>
      <p>Your preview was not found in this browser. Calculate both numbers first so the report request includes your result.</p>
      <a class="btn fill" href="index.html#compatibility">Calculate Compatibility</a>`;

    checkoutTarget.innerHTML = `
      <span class="kicker">Report access</span>
      <div class="payment-price"><span>Complete report</span><strong>₹99</strong></div>
      <p>The online payment gateway is being connected. For now, continue on WhatsApp to receive the official payment instructions. Your report will be released after payment is confirmed.</p>
      <div class="payment-action-row">
        <a class="btn fill" href="https://wa.me/919173569555?text=${whatsappText}" target="_blank" rel="noopener">Continue on WhatsApp to Pay ₹99</a>
        <a class="btn" href="index.html#compatibility">Return to Preview</a>
      </div>
      <small class="payment-security-note">No card or banking details are collected on this website.</small>`;
  };

  const renderConsultation = () => {
    const booking = safeSessionJson('siaosBooking');
    summaryTarget.innerHTML = booking ? `
      <span class="kicker">Selected consultation</span>
      <h2>${escapeHtml(booking.serviceName)}</h2>
      <p>Your completed details are ready. Payment choices will be connected in the next update.</p>` : `
      <h2>No consultation selected</h2>
      <p>Please choose a service and complete its form first.</p>
      <a class="btn fill" href="booking.html">Choose a Service</a>`;

    checkoutTarget.innerHTML = `
      <span class="kicker">Payment setup</span>
      <h2>Payment options will be added next</h2>
      <p>No payment will be taken on this page yet. Your selected service and completed form are ready for the payment card integration.</p>
      <a class="btn" href="booking.html">Back to Booking</a>`;
  };

  if (params.get('product') === 'compatibility-report') {
    renderCompatibilityReport();
  } else {
    renderConsultation();
  }
})();
