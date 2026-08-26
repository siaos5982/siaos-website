(() => {
  const form = document.querySelector('#muhuratForm');
  if (!form) return;

  const dateInput = document.querySelector('#muhuratDate');
  const cityInput = document.querySelector('#muhuratCity');
  const citySuggestions = document.querySelector('#muhuratCitySuggestions');
  const cityStatus = document.querySelector('#muhuratCityStatus');
  const badge = document.querySelector('#muhuratBadge');
  const verdict = document.querySelector('#muhuratVerdict');
  const message = document.querySelector('#muhuratMessage');
  const dayGrid = document.querySelector('#dayMuhuratGrid');
  const nightGrid = document.querySelector('#nightMuhuratGrid');
  const cityCache = new Map();
  let selectedCity = {name:'Surat, Gujarat, India',lat:21.1702,lon:72.8311,height:13,timeZone:'Asia/Kolkata'};
  let searchTimer;
  let searchRequest;
  let timeZoneRequest;
  let currentSuggestions = [];
  let activeSuggestion = -1;

  const qualities = {
    Udveg:{meaning:'Unfavourable',tone:'caution'},
    Char:{meaning:'Auspicious',tone:'auspicious'},
    Labh:{meaning:'Auspicious',tone:'auspicious'},
    Amrit:{meaning:'Most auspicious',tone:'auspicious best'},
    Kaal:{meaning:'Unfavourable',tone:'caution'},
    Shubh:{meaning:'Auspicious',tone:'auspicious'},
    Rog:{meaning:'Unfavourable',tone:'caution'}
  };
  const daySequences = [
    ['Udveg','Char','Labh','Amrit','Kaal','Shubh','Rog','Udveg'],
    ['Amrit','Kaal','Shubh','Rog','Udveg','Char','Labh','Amrit'],
    ['Rog','Udveg','Char','Labh','Amrit','Kaal','Shubh','Rog'],
    ['Labh','Amrit','Kaal','Shubh','Rog','Udveg','Char','Labh'],
    ['Shubh','Rog','Udveg','Char','Labh','Amrit','Kaal','Shubh'],
    ['Char','Labh','Amrit','Kaal','Shubh','Rog','Udveg','Char'],
    ['Kaal','Shubh','Rog','Udveg','Char','Labh','Amrit','Kaal']
  ];
  const nightSequences = [
    ['Shubh','Amrit','Char','Rog','Kaal','Labh','Udveg','Shubh'],
    ['Char','Rog','Kaal','Labh','Udveg','Shubh','Amrit','Char'],
    ['Kaal','Labh','Udveg','Shubh','Amrit','Char','Rog','Kaal'],
    ['Udveg','Shubh','Amrit','Char','Rog','Kaal','Labh','Udveg'],
    ['Amrit','Char','Rog','Kaal','Labh','Udveg','Shubh','Amrit'],
    ['Rog','Kaal','Labh','Udveg','Shubh','Amrit','Char','Rog'],
    ['Labh','Udveg','Shubh','Amrit','Char','Rog','Kaal','Labh']
  ];

  const indiaParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type,part.value]));
  const today = indiaParts(new Date());
  const currentDate = `${today.year}-${today.month}-${today.day}`;
  dateInput.value = currentDate < dateInput.min ? dateInput.min : currentDate > dateInput.max ? dateInput.max : currentDate;

  const formatTime = (date,timeZone) => new Intl.DateTimeFormat('en-IN',{timeZone,hour:'numeric',minute:'2-digit',hour12:true}).format(date);
  const formatDate = (date,timeZone) => new Intl.DateTimeFormat('en-IN',{timeZone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);
  const setText = (id,value) => { const node = document.querySelector(`#${id}`); if (node) node.textContent = value; };
  const escapeHtml = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function localDateTime(dateString,hour,timeZone) {
    const [year,month,day] = dateString.split('-').map(Number);
    const wanted = Date.UTC(year,month - 1,day,hour);
    let instant = wanted;
    const formatter = new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    for (let pass = 0; pass < 3; pass += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(part => part.type !== 'literal').map(part => [part.type,part.value]));
      const represented = Date.UTC(Number(parts.year),Number(parts.month) - 1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
      instant += wanted - represented;
    }
    return new Date(instant);
  }

  const cityName = city => [...new Set([city.name,city.admin1,city.country].filter(Boolean))].join(', ');

  function hideSuggestions() {
    citySuggestions.hidden = true;
    citySuggestions.innerHTML = '';
    cityInput.setAttribute('aria-expanded','false');
    cityInput.removeAttribute('aria-activedescendant');
    currentSuggestions = [];
    activeSuggestion = -1;
  }

  function setCityStatus(text,isError = false) {
    cityStatus.textContent = text;
    cityStatus.classList.toggle('error',isError);
  }

  async function chooseCity(city) {
    const candidate = {
      name:cityName(city),
      lat:Number(city.latitude),
      lon:Number(city.longitude),
      height:Number.isFinite(Number(city.elevation)) ? Number(city.elevation) : 0
    };
    selectedCity = null;
    cityInput.value = candidate.name;
    cityInput.setCustomValidity('');
    hideSuggestions();
    setCityStatus(`Confirming local time for ${candidate.name}…`);
    if (timeZoneRequest) timeZoneRequest.abort();
    timeZoneRequest = new AbortController();
    try {
      const endpoint = new URL('https://timeapi.io/api/timezone/coordinate');
      endpoint.searchParams.set('latitude',candidate.lat);
      endpoint.searchParams.set('longitude',candidate.lon);
      const response = await fetch(endpoint,{signal:timeZoneRequest.signal});
      if (!response.ok) throw new Error('Time zone lookup failed');
      const data = await response.json();
      if (!data.timeZone) throw new Error('Time zone unavailable');
      candidate.timeZone = data.timeZone;
      selectedCity = candidate;
      setCityStatus(`Selected: ${candidate.name}`);
      calculate();
    } catch (error) {
      if (error.name !== 'AbortError') {
        selectedCity = null;
        cityInput.setCustomValidity('Please choose the city again.');
        setCityStatus('The city’s local time could not be confirmed. Please choose it again.',true);
      }
    }
  }

  function setActiveSuggestion(index) {
    const options = [...citySuggestions.querySelectorAll('.muhurat-city-option')];
    if (!options.length) return;
    activeSuggestion = (index + options.length) % options.length;
    options.forEach((option,optionIndex) => option.classList.toggle('active',optionIndex === activeSuggestion));
    options[activeSuggestion].scrollIntoView({block:'nearest'});
    cityInput.setAttribute('aria-activedescendant',options[activeSuggestion].id);
  }

  function renderCitySuggestions(cities) {
    currentSuggestions = cities;
    activeSuggestion = -1;
    if (!cities.length) {
      hideSuggestions();
      setCityStatus('No matching city found. Try the city name with its state or country.',true);
      return;
    }
    citySuggestions.innerHTML = cities.map((city,index) => {
      const detail = [city.admin1,city.country].filter(Boolean).join(' · ');
      return `<button id="muhuratCityOption${index}" class="muhurat-city-option" type="button" role="option" data-index="${index}"><strong>${escapeHtml(city.name)}</strong><small>${escapeHtml(detail)}</small></button>`;
    }).join('');
    citySuggestions.hidden = false;
    cityInput.setAttribute('aria-expanded','true');
    citySuggestions.querySelectorAll('.muhurat-city-option').forEach(option => {
      option.addEventListener('pointerdown',event => event.preventDefault());
      option.addEventListener('click',() => chooseCity(currentSuggestions[Number(option.dataset.index)]));
    });
    setCityStatus(`${cities.length} matching ${cities.length === 1 ? 'city' : 'cities'} found. Choose one to continue.`);
  }

  async function searchCities(query) {
    const cacheKey = query.toLocaleLowerCase('en-IN');
    if (cityCache.has(cacheKey)) return renderCitySuggestions(cityCache.get(cacheKey));
    if (searchRequest) searchRequest.abort();
    searchRequest = new AbortController();
    cityInput.setAttribute('aria-busy','true');
    setCityStatus('Finding matching cities…');
    try {
      const endpoint = new URL('https://photon.komoot.io/api/');
      endpoint.searchParams.set('q',query);
      endpoint.searchParams.set('limit','8');
      endpoint.searchParams.set('lang','en');
      endpoint.searchParams.append('layer','city');
      const response = await fetch(endpoint,{signal:searchRequest.signal});
      if (!response.ok) throw new Error('Location search failed');
      const data = await response.json();
      const features = Array.isArray(data.features) ? data.features : [];
      const results = features.map(feature => {
        const properties = feature.properties || {};
        const coordinates = feature.geometry?.coordinates || [];
        return {
          name:properties.name || properties.city || properties.locality,
          admin1:properties.state || properties.county,
          country:properties.country,
          placeType:properties.type,
          latitude:coordinates[1],
          longitude:coordinates[0],
          elevation:0
        };
      }).filter(city => city.placeType === 'city' && city.name && Number.isFinite(Number(city.latitude)) && Number.isFinite(Number(city.longitude)));
      cityCache.set(cacheKey,results);
      renderCitySuggestions(results);
    } catch (error) {
      if (error.name !== 'AbortError') {
        hideSuggestions();
        setCityStatus('City search is temporarily unavailable. Please check your internet connection and try again.',true);
      }
    } finally {
      cityInput.removeAttribute('aria-busy');
    }
  }

  function eightWindows(start,end,sequence) {
    const length = (end.getTime() - start.getTime()) / 8;
    return Array.from({length:8},(_,index) => {
      const periodStart = new Date(start.getTime() + index * length);
      const periodEnd = new Date(start.getTime() + (index + 1) * length);
      const name = sequence[index];
      return {name,...qualities[name],start:periodStart,end:periodEnd};
    });
  }

  function renderWindows(target,windows,timeZone) {
    target.innerHTML = windows.map(window => `<article class="choghadiya-card ${window.tone}"><span class="muhurat-quality">${escapeHtml(window.meaning)}</span><h5>${escapeHtml(window.name)} Muhurat</h5><strong>${formatTime(window.start,timeZone)} – ${formatTime(window.end,timeZone)}</strong></article>`).join('');
  }

  function showError() {
    badge.className = 'muhurat-badge error';
    badge.textContent = 'Unavailable';
    verdict.textContent = 'Muhurat timings could not be calculated';
    message.textContent = 'Please refresh the page and try again.';
    dayGrid.innerHTML = '';
    nightGrid.innerHTML = '';
  }

  function calculate() {
    if (!window.Astronomy) return showError();
    if (!selectedCity) return;
    const city = selectedCity;
    const localMidnight = localDateTime(dateInput.value,0,city.timeZone);
    const localNoon = localDateTime(dateInput.value,12,city.timeZone);
    const [year,month,day] = dateInput.value.split('-').map(Number);
    const weekday = new Date(Date.UTC(year,month - 1,day,12)).getUTCDay();

    try {
      const observer = new Astronomy.Observer(city.lat,city.lon,city.height);
      const sunriseEvent = Astronomy.SearchRiseSet(Astronomy.Body.Sun,observer,+1,localMidnight,1);
      const sunsetEvent = Astronomy.SearchRiseSet(Astronomy.Body.Sun,observer,-1,localMidnight,1);
      if (!sunriseEvent || !sunsetEvent) return showError();
      const sunrise = sunriseEvent.date;
      const sunset = sunsetEvent.date;
      const nextSunriseEvent = Astronomy.SearchRiseSet(Astronomy.Body.Sun,observer,+1,new Date(sunset.getTime()+60000),1);
      if (!nextSunriseEvent) return showError();
      const nextSunrise = nextSunriseEvent.date;
      setText('sunriseValue',formatTime(sunrise,city.timeZone));
      setText('sunsetValue',formatTime(sunset,city.timeZone));
      setText('nextSunriseValue',formatTime(nextSunrise,city.timeZone));
      badge.className = 'muhurat-badge good';
      badge.textContent = 'Daily Choghadiya';
      verdict.textContent = `${formatDate(localNoon,city.timeZone)} · ${city.name}`;
      message.textContent = 'Auspicious Muhurats are illuminated in gold; Kaal, Rog and Udveg remain unhighlighted.';
      renderWindows(dayGrid,eightWindows(sunrise,sunset,daySequences[weekday]),city.timeZone);
      renderWindows(nightGrid,eightWindows(sunset,nextSunrise,nightSequences[weekday]),city.timeZone);
    } catch (error) {
      showError();
    }
  }

  form.addEventListener('submit',event => {
    event.preventDefault();
    if (!selectedCity) {
      cityInput.setCustomValidity('Please choose a city from the suggestions.');
      cityInput.reportValidity();
      setCityStatus('Choose one city from the suggestions before showing Muhurat timings.',true);
      return;
    }
    calculate();
  });
  dateInput.addEventListener('change',calculate);
  cityInput.addEventListener('input',() => {
    cityInput.setCustomValidity('');
    selectedCity = null;
    if (timeZoneRequest) timeZoneRequest.abort();
    clearTimeout(searchTimer);
    const query = cityInput.value.trim();
    if (query.length < 2) {
      if (searchRequest) searchRequest.abort();
      hideSuggestions();
      setCityStatus('Type at least 2 letters, then choose a suggested city.');
      return;
    }
    searchTimer = setTimeout(() => searchCities(query),400);
  });
  cityInput.addEventListener('keydown',event => {
    if (citySuggestions.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion(activeSuggestion + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion(activeSuggestion - 1);
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      chooseCity(currentSuggestions[activeSuggestion]);
    } else if (event.key === 'Escape') {
      hideSuggestions();
    }
  });
  cityInput.addEventListener('blur',() => setTimeout(hideSuggestions,150));
  calculate();
})();
