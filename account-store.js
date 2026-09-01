(() => {
  const config = window.SIAOS_AUTH_CONFIG || {};
  const isLocalPreview = ['localhost','127.0.0.1','::1','siaos5982.github.io'].includes(location.hostname);
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
  const keys = {
    demoAccount:'siaosDemoAccountV1',demoReadings:'siaosDemoReadingsV1',demoReports:'siaosDemoReportsV1',
    pendingPhone:'siaosPendingOtpPhone',pendingCountryCode:'siaosPendingOtpCountryCode',backlog:'siaosReadingBacklogV1'
  };
  const listeners = new Set();

  const readJson = (storage,key,fallback) => {
    try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const writeJson = (storage,key,value) => storage.setItem(key,JSON.stringify(value));
  const normalisePhone = (countryCode,phone) => `+${String(countryCode || '').replace(/\D/g,'')}${String(phone || '').replace(/\D/g,'')}`;
  const makeId = prefix => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const demoAccount = () => readJson(localStorage,keys.demoAccount,null);
  const notify = session => listeners.forEach(listener => listener(session));

  async function getSession() {
    if (client) {
      const {data,error} = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    }
    const account = demoAccount();
    return account ? {user:{id:account.id,phone:account.phone,email:account.email,user_metadata:{full_name:account.fullName}},demo:true} : null;
  }

  async function sendOtp({countryCode,phone,mode='signup'}) {
    const fullPhone = normalisePhone(countryCode,phone);
    if (fullPhone.length < 8) throw new Error('Enter a valid phone number.');
    sessionStorage.setItem(keys.pendingPhone,fullPhone);
    sessionStorage.setItem(keys.pendingCountryCode,String(countryCode || '').replace(/\D/g,''));
    if (client) {
      const {error} = await client.auth.signInWithOtp({phone:fullPhone,options:{shouldCreateUser:mode !== 'signin'}});
      if (error) throw error;
      return {phone:fullPhone};
    }
    if (!isLocalPreview) throw new Error('Secure OTP login is awaiting the live authentication configuration.');
    if (mode === 'signin' && demoAccount()?.phone !== fullPhone) throw new Error('No preview account was found for this phone number. Create an account first.');
    return {phone:fullPhone,demoCode:'123456'};
  }

  async function verifyOtp({token,profile={}}) {
    const phone = sessionStorage.getItem(keys.pendingPhone);
    const countryCode = sessionStorage.getItem(keys.pendingCountryCode);
    if (!phone) throw new Error('Request a new OTP first.');
    let session;
    if (client) {
      const {data,error} = await client.auth.verifyOtp({phone,token:String(token),type:'sms'});
      if (error) throw error;
      session = data.session;
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
    } else {
      if (!isLocalPreview || String(token) !== '123456') throw new Error('The OTP is incorrect or has expired.');
      const existing = demoAccount();
      const isSignIn = profile.mode === 'signin';
      const account = {
        id:existing?.id || makeId('demo-user'),phone,
        countryCode:countryCode || existing?.countryCode || '',
        fullName:String(profile.fullName || existing?.fullName || 'SIAOS Member').trim(),
        email:String(profile.email || existing?.email || '').trim(),
        marketingOptIn:isSignIn ? Boolean(existing?.marketingOptIn) : Boolean(profile.marketingOptIn),createdAt:existing?.createdAt || new Date().toISOString()
      };
      writeJson(localStorage,keys.demoAccount,account);
      session = await getSession();
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
    if (!client) return demoAccount();
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
    const session = await getSession();
    if (!session) return item;
    await syncPendingReadings();
    return item;
  }

  async function syncPendingReadings() {
    const session = await getSession();
    if (!session) return;
    const backlog = readJson(localStorage,keys.backlog,[]);
    if (!backlog.length) return;
    if (!client) {
      const current = readJson(localStorage,keys.demoReadings,[]);
      const known = new Set(current.map(item => item.fingerprint));
      backlog.forEach(item => { if (!known.has(item.fingerprint)) current.push({...item,userId:session.user.id}); });
      writeJson(localStorage,keys.demoReadings,current);
      localStorage.removeItem(keys.backlog);
      return;
    }
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
    const session = await getSession();
    if (!session) return [];
    await syncPendingReadings();
    if (!client) return readJson(localStorage,keys.demoReadings,[]).filter(item => item.userId === session.user.id).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    const {data,error} = await client.from('readings').select('id,reading_type,title,summary,created_at').order('created_at',{ascending:false});
    if (error) throw error;
    return (data || []).map(item => ({id:item.id,readingType:item.reading_type,title:item.title,summary:item.summary,createdAt:item.created_at}));
  }

  async function getReading(id) {
    const session = await getSession();
    if (!session) throw new Error('Sign in to open this reading.');
    if (!client) {
      const item = readJson(localStorage,keys.demoReadings,[]).find(reading => reading.id === id && reading.userId === session.user.id);
      if (!item) throw new Error('This reading could not be found.');
      return item;
    }
    const {data,error} = await client.from('readings').select('id,reading_type,title,summary,payload,created_at').eq('id',id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This reading could not be found.');
    return {id:data.id,readingType:data.reading_type,title:data.title,summary:data.summary,payload:data.payload,createdAt:data.created_at};
  }

  async function getReports() {
    const session = await getSession();
    if (!session) return [];
    if (!client) return readJson(localStorage,keys.demoReports,[]).filter(item => item.userId === session.user.id).sort((a,b) => new Date(b.purchasedAt)-new Date(a.purchasedAt));
    const {data,error} = await client.from('report_purchases').select('id,report_type,title,status,purchased_at,access_expires_at').order('purchased_at',{ascending:false});
    if (error) throw error;
    return (data || []).map(item => ({id:item.id,reportType:item.report_type,title:item.title,status:item.status,purchasedAt:item.purchased_at,accessExpiresAt:item.access_expires_at}));
  }

  async function getReport(id) {
    const session = await getSession();
    if (!session) throw new Error('Sign in to open this report.');
    if (!client) {
      const report = readJson(localStorage,keys.demoReports,[]).find(item => item.id === id && item.userId === session.user.id);
      if (!report || new Date(report.accessExpiresAt) <= new Date()) throw new Error('This report access period has ended.');
      return report;
    }
    const {data,error} = await client.from('report_documents').select('report_id,payload').eq('report_id',id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This report is unavailable or its 15-day access period has ended.');
    return {id:data.report_id,payload:data.payload};
  }

  async function signOut() {
    if (client) {
      const {error} = await client.auth.signOut();
      if (error) throw error;
    } else localStorage.removeItem(keys.demoAccount);
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
    configured,isLocalPreview,client,getSession,getProfile,sendOtp,verifyOtp,signOut,
    saveReading,getReadings,getReading,getReports,getReport,captureExistingReadings,
    onAuthChange(listener){listeners.add(listener);return () => listeners.delete(listener);}
  };
})();
