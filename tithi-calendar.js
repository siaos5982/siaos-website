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
  const tithiNumbers = {
    Pratipada:1,Dwitiya:2,Tritiya:3,Chaturthi:4,Panchami:5,Shashthi:6,Saptami:7,
    Ashtami:8,Navami:9,Dashami:10,Ekadashi:11,Dwadashi:12,Trayodashi:13,
    Chaturdashi:14,Purnima:15,Amavasya:15
  };

  const escapeHtml = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const formatDate = value => new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(`${value}T12:00:00+05:30`));
  const formatBoundary = value => new Intl.DateTimeFormat('en-IN',{
    day:'numeric',month:'long',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'
  }).format(value);

  function getTithiNumber(event) {
    const detail = event.tithi_detail || '';
    const paksha = detail.includes('Krishna') ? 'Krishna' : 'Shukla';
    const name = Object.keys(tithiNumbers).find(tithi => detail.includes(tithi));
    if (!name) return null;
    const fortnightNumber = tithiNumbers[name];
    return paksha === 'Krishna' ? 15 + fortnightNumber : fortnightNumber;
  }

  function getTithiBoundaries(event) {
    if (!window.Astronomy?.SearchMoonPhase) return null;
    const number = getTithiNumber(event);
    if (!number) return null;
    const searchFrom = new Date(`${event.date}T00:00:00+05:30`);
    searchFrom.setUTCDate(searchFrom.getUTCDate() - 2);
    const beginsAt = Astronomy.SearchMoonPhase(((number - 1) * 12) % 360,searchFrom,5)?.date;
    if (!beginsAt) return null;
    const endsAt = Astronomy.SearchMoonPhase((number * 12) % 360,new Date(beginsAt.getTime() + 60000),3)?.date;
    return endsAt ? {beginsAt,endsAt} : null;
  }

  function renderTithiTiming(event) {
    const boundaries = getTithiBoundaries(event);
    if (!boundaries) return '';
    return `<div class="tithi-timing"><span><b>Begins</b><time datetime="${boundaries.beginsAt.toISOString()}">${escapeHtml(formatBoundary(boundaries.beginsAt))}</time></span><span><b>Ends</b><time datetime="${boundaries.endsAt.toISOString()}">${escapeHtml(formatBoundary(boundaries.endsAt))}</time></span></div>`;
  }

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

    results.innerHTML = filtered.map(event => `<article class="tithi-card"><div class="tithi-date"><span>${escapeHtml(event.weekday)}</span><strong>${escapeHtml(formatDate(event.date))}</strong></div><div class="tithi-card-copy"><span class="tithi-type">${escapeHtml(event.tithi_type)}</span><h3>${escapeHtml(event.name)}</h3><p>${escapeHtml(event.tithi_detail)}</p>${renderTithiTiming(event)}</div></article>`).join('');
    empty.hidden = filtered.length > 0;
  }

  form.addEventListener('change',render);
  form.addEventListener('submit',event => { event.preventDefault(); render(); });
  render();
})();
