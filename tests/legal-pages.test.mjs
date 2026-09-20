import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const pages=['contact.html','privacy-policy.html','terms.html','shipping-policy.html','refund-policy.html'];

test('all public customer-policy pages use the established SIAOS theme and fonts',async()=>{
  for(const page of pages){
    const html=await readFile(new URL('../'+page,import.meta.url),'utf8');
    assert.match(html,/theme\.css/);
    assert.match(html,/legal\.css/);
    assert.match(html,/family=Cormorant/);
    assert.match(html,/class="brand"/);
    assert.match(html,/assets\/siaos-logo\.webp/);
  }
});

test('all footer policy targets exist and are linked from the customer directory',async()=>{
  const contact=await readFile(new URL('../contact.html',import.meta.url),'utf8');
  for(const page of pages.slice(1))assert.match(contact,new RegExp('href="'+page.replace('.','\\.')+'"'));
});

test('privacy and support pages prohibit collection of authentication and card secrets',async()=>{
  const privacy=await readFile(new URL('../privacy-policy.html',import.meta.url),'utf8');
  const contact=await readFile(new URL('../contact.html',import.meta.url),'utf8');
  for(const content of [privacy,contact]){
    assert.match(content,/OTP/i);
    assert.match(content,/password/i);
    assert.match(content,/card/i);
  }
});

test('commerce policies preserve applicable statutory consumer rights',async()=>{
  for(const page of ['terms.html','refund-policy.html']){
    const html=await readFile(new URL('../'+page,import.meta.url),'utf8');
    assert.match(html,/applicable (Indian )?consumer law|rights that cannot lawfully be excluded/i);
  }
});

test('consultation percentage policy and cancellation page are removed',async()=>{
  const [contact,terms,refund,site]=await Promise.all(['contact.html','terms.html','refund-policy.html','site.js'].map(page=>readFile(new URL('../'+page,import.meta.url),'utf8')));
  for(const content of [contact,terms,refund,site]){
    assert.doesNotMatch(content,/cancellation-policy\.html/i);
    assert.doesNotMatch(content,/75%|50%|25%|20 hours|under 20 hours|under 12 hours|under 5 hours/i);
  }
  assert.match(refund,/consultation payments[\s\S]*handled directly in the verified SIAOS WhatsApp conversation/i);
  assert.doesNotMatch(refund,/consultation refund percentage|cancellation schedule/i);
});

test('physical products are final sale while non-waivable remedies remain',async()=>{
  const html=await readFile(new URL('../refund-policy.html',import.meta.url),'utf8');
  assert.match(html,/no voluntary return, refund, replacement, exchange or cancellation/i);
  assert.match(html,/wrong, defective, damaged, spurious/i);
  assert.match(html,/cannot lawfully be excluded/i);
});
