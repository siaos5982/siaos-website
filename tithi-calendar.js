(() => {
  const dataset = window.SIAOS_TITHI_DATA;
  const form = document.querySelector('#tithiFilterForm');
  if (!dataset || !form) return;

  const yearInput = document.querySelector('#tithiYear');
  const typeInput = document.querySelector('#tithiType');
  const monthInput = document.querySelector('#tithiMonth');
  const count = document.querySelector('#tithiCount');
  const countLabel = document.querySelector('#tithiCountLabel');
  const summary = document.querySelector('#tithiSummary');
  const results = document.querySelector('#tithiResults');
  const empty = document.querySelector('#tithiEmpty');
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const escapeHtml = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const formatDate = value => new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(`${value}T12:00:00+05:30`));

  function render() {
    const year = Number(yearInput.value);
    const type = typeInput.value;
    const month = monthInput.value;
    const filtered = dataset.events.filter(event => event.year === year && event.tithi_type === type && (!month || event.date.slice(5,7) === month));
    const annualCount = dataset.events.filter(event => event.year === year && event.tithi_type === type).length;

    count.textContent = month ? filtered.length : annualCount;
    countLabel.textContent = `${type} date${(month ? filtered.length : annualCount) === 1 ? '' : 's'}`;
    summary.textContent = month
      ? `${filtered.length} ${type} date${filtered.length === 1 ? '' : 's'} in ${monthNames[Number(month)-1]} ${year}`
      : `${annualCount} ${type} date${annualCount === 1 ? '' : 's'} in ${year}`;

    results.innerHTML = filtered.map(event => `<article class="tithi-card"><div class="tithi-date"><span>${escapeHtml(event.weekday)}</span><strong>${escapeHtml(formatDate(event.date))}</strong></div><div class="tithi-card-copy"><span class="tithi-type">${escapeHtml(event.tithi_type)}</span><h3>${escapeHtml(event.name)}</h3><p>${escapeHtml(event.tithi_detail)}</p></div></article>`).join('');
    empty.hidden = filtered.length > 0;
  }

  form.addEventListener('change',render);
  form.addEventListener('submit',event => { event.preventDefault(); render(); });
  render();
})();
