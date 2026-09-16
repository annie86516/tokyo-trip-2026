/* Destination forecasts, never today's weather substituted for a future trip.
   Personal/noncommercial use of Open-Meteo; destination coordinates only, no GPS. */
(() => {
  'use strict';
  const places = {
    tokyo:{name:'東京',lat:35.6812,lon:139.7671},
    nikko:{name:'日光市區',lat:36.75,lon:139.6},
    lake:{name:'中禪寺湖・華嚴瀑布',lat:36.738,lon:139.49},
    narita:{name:'成田',lat:35.776,lon:140.318}
  };
  const pending = new Map();
  const memory = new Map();
  const TTL = 60*60*1000;
  const tokyoDate = now => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  function forecastWindow(date,now=new Date()) {
    const delta = Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(tokyoDate(now)+'T00:00:00Z'))/86400000);
    return delta < 0 ? 'past' : delta > 15 ? 'future' : 'available';
  }
  function describe(code) {
    if(code===0) return ['☀','晴朗'];
    if([1,2].includes(code)) return ['⛅','晴時多雲'];
    if(code===3) return ['☁','陰天'];
    if([45,48].includes(code)) return ['☁','有霧'];
    if([51,53,55,56,57].includes(code)) return ['☂','毛毛雨'];
    if([61,63,65,66,67,80,81,82].includes(code)) return ['☂','有雨'];
    if([71,73,75,77,85,86].includes(code)) return ['❄','降雪'];
    if([95,96,99].includes(code)) return ['ϟ','雷雨'];
    return ['—','天氣狀態未提供'];
  }
  function readDay(data,date) {
    const daily=data?.daily;
    const i=Array.isArray(daily?.time)?daily.time.indexOf(date):-1;
    if(i<0) return null;
    const low=daily.temperature_2m_min?.[i], high=daily.temperature_2m_max?.[i];
    if(!Number.isFinite(low)||!Number.isFinite(high)) return null;
    return {low,high,code:daily.weather_code?.[i],rain:daily.precipitation_probability_max?.[i]};
  }
  function getCached(key) {
    if(memory.has(key)) return memory.get(key);
    try {
      const cached=JSON.parse(localStorage.getItem('tokyo-trip-weather.v1.'+key)||'null');
      if(cached && Number.isFinite(cached.at) && cached.data?.daily) return cached;
    } catch {}
    return null;
  }
  async function request(key) {
    if(pending.has(key)) return pending.get(key);
    const promise=(async()=>{
      const place=places[key], abort=new AbortController();
      const timer=setTimeout(()=>abort.abort(),8000);
      try {
        const query=new URLSearchParams({latitude:place.lat,longitude:place.lon,
          daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
          timezone:'Asia/Tokyo',forecast_days:'16'});
        const response=await fetch('https://api.open-meteo.com/v1/forecast?'+query,{signal:abort.signal});
        if(!response.ok) throw new Error('Forecast unavailable');
        const data=await response.json();
        if(!Array.isArray(data?.daily?.time)) throw new Error('Incomplete forecast');
        const result={at:Date.now(),data}; memory.set(key,result);
        try { localStorage.setItem('tokyo-trip-weather.v1.'+key,JSON.stringify(result)); } catch {}
        return result;
      } finally {clearTimeout(timer);}
    })();
    pending.set(key,promise);
    try {return await promise;} finally {pending.delete(key);}
  }
  function line(className,text) {
    const node=document.createElement('div'); node.className=className; node.textContent=text; return node;
  }
  function show(card,key,date,result,stale=false) {
    const value=readDay(result.data,date);
    if(!value) {card.querySelector('.weather-message').textContent='此日期的預報尚未提供，稍後連線時會再更新。';return;}
    const [symbol,description]=describe(value.code);
    card.querySelector('.weather-symbol').textContent=symbol;
    card.querySelector('.weather-value').textContent=`${Math.round(value.low)}–${Math.round(value.high)}°C`;
    card.querySelector('.weather-message').textContent=description+' · 降雨機率 '+(Number.isFinite(value.rain)?Math.round(value.rain)+'%':'未提供');
    const time=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(result.at));
    card.querySelector('.weather-updated').textContent=(stale?'先前儲存，尚未更新 · ':'預報更新 · ')+time+' 日本時間';
  }
  async function fill(card,key,date) {
    const windowState=forecastWindow(date);
    if(windowState!=='available') {
      card.querySelector('.weather-message').textContent=windowState==='future'?'當日預報尚未發布，行程日前約 15 天起可查詢。':'行程日期已過，此處不以現在天氣代替當日天氣。';
      card.querySelector('.weather-updated').textContent='依行程日期顯示 · 非目前即時天氣';
      return;
    }
    const cached=getCached(key);
    const usable=cached && readDay(cached.data,date);
    if(usable) {
      const age=Date.now()-cached.at;
      const fresh=age>=0&&age<TTL;
      show(card,key,date,cached,!fresh||!navigator.onLine);
      if(fresh&&navigator.onLine) return;
    }
    if(!navigator.onLine) {
      if(!usable) card.querySelector('.weather-message').textContent='目前離線，尚無此日已儲存的天氣預報。';
      return;
    }
    try {
      const result=await request(key);
      if(card.isConnected) show(card,key,date,result);
    } catch {
      if(card.isConnected) {
        if(usable) show(card,key,date,cached,true);
        else card.querySelector('.weather-message').textContent='天氣暫時無法取得，稍後重新開啟此日期再試。';
      }
    }
  }
  function render(container,day) {
    const date='2026-11-'+String(20+day);
    const keys=day===7?['nikko','lake']:day===6?['nikko']:day>=8?['narita']:['tokyo'];
    container.replaceChildren();
    const heading=document.createElement('div'); heading.className='weather-heading';
    heading.append(line('weather-label','行程天氣'),line('weather-date',`11/${20+day} · 日本時間`));
    const grid=document.createElement('div'); grid.className='weather-grid';
    container.append(heading,grid);
    for(const key of keys) {
      const card=document.createElement('article'); card.className='weather-card';
      card.setAttribute('aria-label',places[key].name+' '+date+' 天氣');
      const symbol=line('weather-symbol','—'); symbol.setAttribute('aria-hidden','true');
      const content=document.createElement('div'); content.className='weather-content';
      content.append(line('weather-place',places[key].name),line('weather-message','正在查詢當日預報…'),line('weather-updated',''));
      card.append(symbol,content,line('weather-value','—°C')); grid.append(card);
      fill(card,key,date);
    }
    const note=document.createElement('p'); note.className='weather-credit';
    if(day===7) note.append('山區與市區分開看；湖畔天氣可能不同。 ');
    note.append('預報可能變動 · 資料：');
    const link=document.createElement('a'); link.href='https://open-meteo.com/'; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent='Open-Meteo';
    note.append(link); container.append(note);
  }
  window.TripWeather={render,forecastWindow,readDay,describe};
})();
