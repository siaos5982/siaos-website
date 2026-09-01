(() => {
  const articles = Array.isArray(window.SIAOS_BLOGS) ? window.SIAOS_BLOGS : [];
  const grid = document.querySelector('#blogGrid');
  const filters = document.querySelector('#blogFilters');
  const search = document.querySelector('#blogSearch');
  const results = document.querySelector('#blogResults');
  const loadMore = document.querySelector('#blogLoadMore');
  if (!grid || !filters || !search || !results || !loadMore) return;

  const categories = ['All', ...new Set(articles.map(article => article.category))];
  const query = new URLSearchParams(location.search);
  let category = categories.includes(query.get('category')) ? query.get('category') : 'All';
  let limit = 12;

  const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function renderFilters() {
    filters.innerHTML = categories.map(item => `<button type="button" class="${item === category ? 'active' : ''}" data-category="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('');
  }

  function matches(article) {
    const text = search.value.trim().toLowerCase();
    const inCategory = category === 'All' || article.category === category;
    const haystack = `${article.title} ${article.category} ${article.keywords} ${article.excerpt}`.toLowerCase();
    return inCategory && (!text || haystack.includes(text));
  }

  function render() {
    const filtered = articles.filter(matches);
    const shown = filtered.slice(0, limit);
    grid.innerHTML = shown.map((article, index) => `<article class="blog-library-card ${index === 0 && category === 'All' && !search.value ? 'featured' : ''}"><a class="blog-card-cover" href="${article.slug}.html"><img src="${article.cover}" alt="Cover artwork for ${escapeHtml(article.title)}" loading="lazy"></a><div class="blog-card-copy"><div class="blog-card-meta"><span>${escapeHtml(article.category)}</span><span>${article.readTime} min read</span></div><h3><a href="${article.slug}.html">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt)}</p><a class="blog-card-read" href="${article.slug}.html">Read article <span>→</span></a></div></article>`).join('');
    results.textContent = `${filtered.length} article${filtered.length === 1 ? '' : 's'} found`;
    loadMore.hidden = shown.length >= filtered.length;
  }

  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    limit = 12;
    renderFilters();
    render();
  });
  search.addEventListener('input', () => { limit = 12; render(); });
  loadMore.addEventListener('click', () => { limit += 12; render(); });
  renderFilters();
  render();
})();
