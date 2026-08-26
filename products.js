document.querySelectorAll('.product-thumbs button').forEach(button=>button.addEventListener('click',()=>{
  const gallery=button.closest('.product-gallery');
  gallery.querySelector('.product-main-image').src=button.querySelector('img').src;
  gallery.querySelectorAll('.product-thumbs button').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
}));

const productPrices={
  'Clear Quartz Bracelet':'₹1,100',
  'Green Aventurine Bracelet':'₹1,100',
  'Lapis Lazuli Bracelet':'₹1,100',
  'Moon Stone Bracelet':'₹1,100',
  'Pyrite Bracelet':'₹1,100',
  'Red Hakik Bracelet':'₹1,100',
  'Red Jesper Bracelet':'₹1,100',
  'Rose Quartz Bracelet':'₹1,100',
  'Tiger Eye Bracelet':'₹1,100',
  'Yellow Citrine Bracelet':'₹1,100',
  'Raksha Nazar Kavach':'₹22,000',
  'Sarkar Kajal':'₹5,100',
  'Mohini Ittar':'₹2,500'
};

document.querySelectorAll('.catalogue-card').forEach(card=>{
  const name=card.querySelector('h3').textContent.trim();
  const price=productPrices[name];
  if(price) card.querySelector('.price-on-request').textContent=price;
});
