const grid=document.querySelector('#productGrid');
if(grid){
  grid.innerHTML=window.SIAOS_PRODUCTS.map(product=>`<article class="product catalogue-card">
    <a class="product-card-image" href="product-detail.html?product=${encodeURIComponent(product.slug)}"><img src="assets/products/${product.slug}/${product.images[0]}" alt="${product.name}"></a>
    <div class="product-meta"><span>${product.category}</span>${product.badge?`<b>${product.badge}</b>`:''}</div>
    <h3>${product.name}</h3><div class="product-rating" aria-label="Rated ${product.rating} out of 5">★★★★★ <span>${product.rating} (${product.reviews})</span></div>
    <p class="product-price">${product.price}</p><a class="btn fill buy" href="product-detail.html?product=${encodeURIComponent(product.slug)}">Buy Now</a>
  </article>`).join('');
}
