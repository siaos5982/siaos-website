(() => {
  const config = window.SIAOS_AUTH_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
  const keys = {pendingPhone:'siaosPendingOtpPhone',pendingCountryCode:'siaosPendingOtpCountryCode',backlog:'siaosReadingBacklogV1'};
  const listeners = new Set();

  const readJson = (storage,key,fallback) => {
    try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const writeJson = (storage,key,value) => storage.setItem(key,JSON.stringify(value));
  const normalisePhone = (countryCode,phone) => `+${String(countryCode || '').replace(/\D/g,'')}${String(phone || '').replace(/\D/g,'')}`;
  const makeId = prefix => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const notify = session => listeners.forEach(listener => listener(session));

  async function getSession() {
    if (!client) return null;
    const {data,error} = await client.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function sendOtp({countryCode,phone,mode='signup',captchaToken}) {
    if (!client) throw new Error('Secure OTP login is temporarily unavailable. Please try again later.');
    const fullPhone = normalisePhone(countryCode,phone);
    if (!/^\+[1-9]\d{7,14}$/.test(fullPhone)) throw new Error('Enter a valid international phone number.');
    sessionStorage.setItem(keys.pendingPhone,fullPhone);
    sessionStorage.setItem(keys.pendingCountryCode,String(countryCode || '').replace(/\D/g,''));
    const {error} = await client.auth.signInWithOtp({phone:fullPhone,options:{shouldCreateUser:mode !== 'signin',captchaToken}});
    if (error) throw error;
    return {phone:fullPhone};
  }

  async function verifyOtp({token,profile={}}) {
    if (!client) throw new Error('Secure OTP login is temporarily unavailable. Please try again later.');
    const phone = sessionStorage.getItem(keys.pendingPhone);
    const countryCode = sessionStorage.getItem(keys.pendingCountryCode);
    if (!phone) throw new Error('Request a new OTP first.');
    const {data,error} = await client.auth.verifyOtp({phone,token:String(token),type:'sms'});
    if (error) throw error;
    const session = data.session;
    const userId = data.user?.id;
    if (userId && profile.mode !== 'signin') {
      const payload = {
        user_id:userId,
        full_name:String(profile.fullName || data.user.user_metadata?.full_name || '').trim(),
        email:String(profile.email || '').trim() || null,
        phone:data.user?.phone || phone,
        country_code:countryCode || null,
        marketing_opt_in:Boolean(profile.marketingOptIn),
        updated_at:new Date().toISOString()
      };
      const {error:profileError} = await client.from('profiles').upsert(payload,{onConflict:'user_id'});
      if (profileError) throw profileError;
    }
    sessionStorage.removeItem(keys.pendingPhone);
    sessionStorage.removeItem(keys.pendingCountryCode);
    await syncPendingReadings();
    notify(session);
    return session;
  }

  async function getProfile() {
    const session = await getSession();
    if (!session) return null;
    const {data,error} = await client.from('profiles').select('user_id,full_name,email,phone,country_code,marketing_opt_in,created_at').eq('user_id',session.user.id).maybeSingle();
    if (error) throw error;
    return data || {user_id:session.user.id,full_name:session.user.user_metadata?.full_name || '',email:session.user.email || '',phone:session.user.phone || ''};
  }

  function queueReading(reading) {
    const backlog = readJson(localStorage,keys.backlog,[]);
    const item = {...reading,id:reading.id || makeId('reading'),createdAt:reading.createdAt || new Date().toISOString()};
    const fingerprint = `${item.readingType}|${item.createdAt.slice(0,10)}|${item.title}|${JSON.stringify(item.summary || {})}`;
    if (!backlog.some(entry => entry.fingerprint === fingerprint)) backlog.unshift({...item,fingerprint});
    writeJson(localStorage,keys.backlog,backlog.slice(0,100));
    return item;
  }

  async function saveReading(reading) {
    const item = queueReading(reading);
    if (await getSession()) await syncPendingReadings();
    return item;
  }

  async function syncPendingReadings() {
    const session = await getSession();
    if (!session) return;
    const backlog = readJson(localStorage,keys.backlog,[]);
    if (!backlog.length) return;
    const rows = backlog.map(item => ({
      user_id:session.user.id,reading_type:item.readingType,title:item.title,
      summary:item.summary || {},payload:item.payload || {},created_at:item.createdAt,
      client_fingerprint:item.fingerprint
    }));
    const {error} = await client.from('readings').upsert(rows,{onConflict:'user_id,client_fingerprint',ignoreDuplicates:true});
    if (error) throw error;
    localStorage.removeItem(keys.backlog);
  }

  async function getReadings() {
    if (!await getSession()) return [];
    await syncPendingReadings();
    const {data,error} = await client.from('readings').select('id,reading_type,title,summary,created_at').order('created_at',{ascending:false});
    if (error) throw error;
    return (data || []).map(item => ({id:item.id,readingType:item.reading_type,title:item.title,summary:item.summary,createdAt:item.created_at}));
  }

  async function getReading(id) {
    if (!await getSession()) throw new Error('Sign in to open this reading.');
    const {data,error} = await client.from('readings').select('id,reading_type,title,summary,payload,created_at').eq('id',id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This reading could not be found.');
    return {id:data.id,readingType:data.reading_type,title:data.title,summary:data.summary,payload:data.payload,createdAt:data.created_at};
  }

  async function getReports() {
    if (!await getSession()) return [];
    const {data,error} = await client.from('report_purchases').select('id,report_type,title,status,purchased_at,access_expires_at').order('purchased_at',{ascending:false});
    if (error) throw error;
    return (data || []).map(item => ({id:item.id,reportType:item.report_type,title:item.title,status:item.status,purchasedAt:item.purchased_at,accessExpiresAt:item.access_expires_at}));
  }

  async function getReport(id) {
    if (!await getSession()) throw new Error('Sign in to open this report.');
    const {data,error} = await client.from('report_documents').select('report_id,payload').eq('report_id',id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This report is unavailable or its 15-day access period has ended.');
    return {id:data.report_id,payload:data.payload};
  }

  async function getOrders() {
    if(!await getSession()) return [];
    const {data,error}=await client.from('product_orders').select('id,order_number,status,payment_status,currency,subtotal,shipping_amount,total,items,delivery_address,tracking_reference,ordered_at,updated_at').order('ordered_at',{ascending:false});
    if(error) throw error;
    return (data||[]).map(item=>({id:item.id,orderNumber:item.order_number,status:item.status,paymentStatus:item.payment_status,currency:item.currency,subtotal:item.subtotal,shippingAmount:item.shipping_amount,total:item.total,items:item.items,deliveryAddress:item.delivery_address,trackingReference:item.tracking_reference,orderedAt:item.ordered_at,updatedAt:item.updated_at}));
  }

  async function signOut() {
    if (client) {
      const {error} = await client.auth.signOut();
      if (error) throw error;
    }
    localStorage.removeItem(keys.backlog);
    sessionStorage.removeItem(keys.pendingPhone);
    sessionStorage.removeItem(keys.pendingCountryCode);
    sessionStorage.removeItem('siaosCheckoutIntent');
    sessionStorage.removeItem('siaosCompatibility');
    sessionStorage.removeItem('siaosTarotReport');
    localStorage.removeItem('siaosTarotDailyDrawV2');
    notify(null);
  }

  async function captureExistingReadings() {
    const compatibility = readJson(sessionStorage,'siaosCompatibility',null);
    if (compatibility?.score) queueReading({
      readingType:'compatibility',title:'Mulank & Bhagyank Compatibility',
      summary:{score:compatibility.score,yourMulank:compatibility.yourMulank,partnerMulank:compatibility.partnerMulank},payload:compatibility,
      createdAt:compatibility.createdAt || new Date().toISOString()
    });
    const tarot = readJson(localStorage,'siaosTarotDailyDrawV2',null);
    if (tarot?.card) queueReading({
      readingType:'tarot',title:`Tarot · ${tarot.card.name}`,
      summary:{card:tarot.card.name,question:tarot.question},payload:tarot,
      createdAt:tarot.createdAt || new Date().toISOString()
    });
    if (await getSession()) await syncPendingReadings();
  }

  if (client) client.auth.onAuthStateChange((_event,session) => notify(session));

  window.SIAOSAccount = {
    configured,client,getSession,getProfile,sendOtp,verifyOtp,signOut,
    saveReading,getReadings,getReading,getReports,getReport,getOrders,captureExistingReadings,
    onAuthChange(listener){listeners.add(listener);return () => listeners.delete(listener);}
  };
})();
