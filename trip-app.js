/* Mobile reading view. The original document remains the source of truth:
   shared itinerary edits therefore appear here without maintaining a second copy. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const pages = [...document.querySelectorAll('.page-sheet')];
  if (!$('#day1') || !$('#flight-info')) return;
  const GROUPS = ['A', 'B', 'C'];
  const STAY_KEYS = ['tokyo','nikko','narita'];
  const COUPON_KEYS = ['bic','alpen','donki','matsukiyo','cocokara','sundrug','sugi','yam','laox','odakyu','aeon','edion','tsuruha','sapporo','seibu','daimaru','cosmos','shinseido','tobu','kintetsu','narita-dutyfree','sundrug-shinjuku-online','donki-shinjuku-online','daimaru-tokyo-online','alpen-tokyo-online'];
  const STAY_INFO = {
    tokyo:{label:'東京',id:'stay-tokyo',image:'./stay-tokyo.jpg',alt:'東京本所吾妻橋包棟民宿的客廳與用餐空間',source:'https://www.airbnb.com/rooms/1661217093593003826'},
    nikko:{label:'日光',id:'stay-nikko',image:'./stay-nikko.jpg',alt:'日光山景包棟民宿的和室空間',source:'https://www.airbnb.com/rooms/52815877'},
    narita:{label:'成田',id:'stay-narita',image:'./stay-narita.jpg',alt:'成田里士滿飯店外觀',source:'https://richmondhotel.jp/'}
  };
  const STAY_DIRECTIONS = {
    tokyo:{name:'東京民宿',destination:'4-21-4 Higashikomagata, Sumida City, Tokyo 130-0005, Japan'},
    nikko:{name:'日光民宿',destination:'1-687-1 Inarimachi, Nikko, Tochigi 321-1411, Japan'},
    narita:{name:'成田飯店',destination:'Richmond Hotel Narita, 970 Hanasakicho, Narita, Chiba, Japan'}
  };
  const icon = name => {
    const paths = {
      calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h2m-8 3h2"/>',
      plane:'<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
      bed:'<path d="M3 18v3m18-3v3M3 18h18V9H3v9ZM5 9V4h14v5M7 9V7h3v2m4 0V7h3v2M3 14h18"/>',
      ticket:'<path d="M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Zm10 0v3m0 3v4m0 3v3"/>',
      coupon:'<path d="m20.5 13.5-7 7L3 10V3h7l10.5 10.5Z"/><circle cx="7.5" cy="7.5" r="1"/>',
      wallet:'<path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6h2Zm0 0V4h13v2m0 6h4v4h-4a2 2 0 0 1 0-4Z"/>',
      book:'<path d="M12 5v16m0-16C8 2 4 3 2 4v16c3-1 6-1 10 1 4-2 7-2 10-1V4c-2-1-6-2-10 1Z"/>',
      pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      add:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M9 10h6m-3-3v6m-1 5h2"/>'
    };
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
  };
  const STORE = 'tokyo-trip-2026.preferences.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch {}
  const params = new URL(location.href).searchParams;
  const initialGroup = params.get('group') || saved.group;
  const initialStay = params.get('stay') || saved.stay;
  const state = {
    group: GROUPS.includes(initialGroup) ? initialGroup : 'A',
    day: Number(params.get('day') || saved.day) || 1,
    stay: STAY_KEYS.includes(initialStay) ? initialStay : 'tokyo',
    view: ['days', 'flights', 'stays', 'bookings', 'money', 'restaurants', 'airport', 'guide', 'coupons'].includes(params.get('view')) ? params.get('view') : 'days',
    bookingDay: [1,5,6,8].includes(Number(params.get('bday') || saved.bookingDay)) ? Number(params.get('bday') || saved.bookingDay) : 1,
    coupon: COUPON_KEYS.includes(params.get('cpn') || saved.coupon) ? (params.get('cpn') || saved.coupon) : 'bic',
    routes: saved.routes && typeof saved.routes === 'object' ? saved.routes : {}
  };
  const firstDay = () => state.group === 'C' ? 3 : 1;
  function clampDay() { state.day = Math.max(firstDay(), Math.min(state.view==='restaurants'?8:9, Math.floor(state.day) || firstDay())); }
  clampDay();
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const departures = [...$('#flight-info').querySelectorAll(':scope > .container > table')][0];
  const returns = [...$('#flight-info').querySelectorAll(':scope > .container > table')][1];
  const flightRow = (table, group) => [...table.tBodies[0].rows].find(row => row.cells[0].textContent.includes(group));
  const daySources = {};
  let currentDay = 0;
  pages.forEach(source => {
    if (source.dataset.dayAnchor) {
      currentDay = Number(source.dataset.dayAnchor.replace('day', ''));
      daySources[currentDay] = {summary:source, extra:[]};
    } else if (source.id === 'restaurant-main') currentDay = 0;
    else if (currentDay) daySources[currentDay].extra.push(source);
  });

  function tableCards(table) {
    const list = document.createElement('div');
    list.className = 'table-cards';
    const headers = [...table.querySelectorAll('thead tr:last-child th')].map(th => th.textContent.trim());
    const bodies = table.tBodies.length ? [...table.tBodies] : [table];
    bodies.forEach(body => {
      const spans = [];
      [...body.rows].forEach(row => {
        if (row.closest('thead')) return;
        const columns = [];
        spans.forEach((span,i) => { if (span && span.remaining > 0) { columns[i] = span.html; span.remaining--; } });
        let i = 0;
        [...row.cells].forEach(cell => {
          while (columns[i] !== undefined) i++;
          columns[i] = cell.innerHTML;
          if (cell.rowSpan > 1) spans[i] = {html:cell.innerHTML, remaining:cell.rowSpan - 1};
          for (let c=1;c<cell.colSpan;c++) columns[i+c] = '';
          i += cell.colSpan;
        });
        const card = document.createElement('dl');
        card.className = 'table-card';
        columns.forEach((html,index) => {
          if (!html || /^(序|序號|順序)$/.test(headers[index] || '')) return;
          const field = document.createElement('div');
          field.innerHTML = `<dt>${escape(headers[index] || (index ? '內容' : '項目'))}</dt><dd>${html}</dd>`;
          card.append(field);
        });
        list.append(card);
      });
    });
    return list;
  }

  function readable(source, options = {}) {
    if (!source) return '';
    const clone = source.cloneNode(true);
    clone.querySelectorAll('script,style,.maple-page-background,.day-eyebrow,.day-number,.day-item-icon,.day-credit').forEach(el => el.remove());
    if (source.id?.startsWith('stay-')) clone.querySelectorAll('.hotel-hero').forEach(el=>el.remove());
    clone.querySelectorAll('.return-address').forEach(el => {
      const address=document.createElement('address'); address.textContent=el.textContent; el.replaceWith(address);
    });
    if (options.omitTitle) clone.querySelector('h2,h3.day-title')?.remove();
    if (source.id === 'day3-route-detail-b1') clone.querySelectorAll('.group-c-divider-row,.group-c-arrival-row').forEach(el => el.remove());
    if (source.id?.startsWith('restaurant-')) {
      clone.querySelectorAll('tbody tr').forEach(row => {
        const day = Number(row.cells[1]?.textContent.match(/第\s*(\d+)\s*天/)?.[1]);
        const text = row.textContent;
        if (state.group === 'C' && (day < 3 || (day === 3 && !text.includes('炭火焼肉おくさこ')))) row.remove();
        if (state.group === 'B' && day === 1 && !text.includes('鳥貴族')) row.remove();
      });
      // Old note described pink paper highlighting, which has no role in this view.
      clone.querySelectorAll('.summary-lead').forEach(el => {
        if (el.textContent.includes('粉紅色')) el.textContent = '各組一起走行程；11/25 牛たんの檸檬已訂 5 人，另 2 位自由用餐（1 位不吃牛、1 位陪同），當天選店；餐後會合。';
      });
      if (state.group==='C' && source.id==='restaurant-main') {
        const arrivalMeal=document.createElement('p');
        arrivalMeal.innerHTML='<strong>第 3 天晚餐：燒肉・炭火焼肉おくさこ。</strong>民宿放行李後到炭火焼肉おくさこ與大家會合；餐後晴空塔選逛，累了就回民宿。<a href="https://maps.app.goo.gl/rWTxzYh2HwmYyaoX8" target="_blank" rel="noopener noreferrer">開啟地圖 ↗</a>';
        clone.querySelector('table')?.before(arrivalMeal);
      }
    }
    if (source.id === 'tax-refund') {
      const note = clone.querySelector('.narita-box');
      if (note) note.textContent = `${state.group} 組：依第 9 天共同接駁安排前往成田 T2，托運前完成免稅品攜出確認；護照、商品、收據與退款說明放在方便取用的位置。`;
    }
    // Read booking context before parent classes are removed below.
    const bookedDinnerLinks = new Set([...clone.querySelectorAll('a[href]')].filter(el =>
      (el.closest('.day-item')?.textContent || '').includes('鳥貴族')));
    [clone,...clone.querySelectorAll('*')].forEach(el => {
      const urgent = /立即.*登記/.test(el.textContent) && el.children.length === 0;
      const mealClass=el.classList.contains('day5-meal-groups')?'meal-split-grid':el.classList.contains('day5-meal-card')?'meal-split-card meal-split-pending':el.classList.contains('meal-status')?'meal-split-head':el.classList.contains('meal-links')?'meal-split-links':'';
      [...el.attributes].forEach(attr => {
        if (!['href','src','alt','title','target','rel','colspan','rowspan'].includes(attr.name)) el.removeAttribute(attr.name);
      });
      if (urgent) el.className = 'important-reminder';
      if (mealClass) el.className = mealClass;
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (href.includes('site-one/index.html')) {
          const isBookedDinner=bookedDinnerLinks.has(el);
          const isBookedTransfer=source.id==='day8-route-detail';
          const bookingDay=isBookedDinner?1:isBookedTransfer?8:0;
          el.setAttribute('href',bookingDay?`./?view=bookings&bday=${bookingDay}`:'./?view=bookings');
          if(bookingDay)el.textContent='查看已預約資料 ↗';
          el.removeAttribute('target');
        }
        else if (/restaurant-guide\/?index\.html/.test(href)) { el.setAttribute('href','./?view=restaurants'); el.removeAttribute('target'); }
        else if (el.getAttribute('target') === '_blank') el.setAttribute('rel','noopener noreferrer');
      }
      if (el.tagName === 'IMG') { el.loading = 'lazy'; el.decoding = 'async'; }
    });
    clone.querySelectorAll('table').forEach(table => table.replaceWith(tableCards(table)));
    return clone.outerHTML;
  }

  const host = document.createElement('div');
  host.id = 'trip-app';
  const root = host.attachShadow({mode:'open'});
  // Image errors do not bubble; capture also covers cards inserted after fetch.
  root.addEventListener('load', event => {
    const img=event.target;
    if(img.tagName!=='IMG' || !img.naturalWidth)return;
    img.hidden=false;
    img.parentElement.classList.remove("image-unavailable");
    if(!img.dataset.fallbackTried && img.nextElementSibling?.className==='image-load-note') {
      img.nextElementSibling.remove();
    }
  }, true);
  root.addEventListener('error', event => {
    const img=event.target;
    if(img.tagName!=='IMG')return;
    // Ignore a delayed error from an earlier URL if the current image loaded.
    if(img.complete && img.naturalWidth>0)return;
    const photoUrl=new URL(img.src,document.baseURI);
    if(photoUrl.origin===location.origin && !img.dataset.imageRetry && !img.dataset.fallbackTried) {
      img.dataset.imageRetry='true';
      photoUrl.searchParams.set('photo_retry','1');
      setTimeout(()=>{if(img.isConnected)img.src=photoUrl.href;},800);
      return;
    }
    img.hidden=true;
    img.parentElement.classList.add('image-unavailable');
    if(img.nextElementSibling?.className!=='image-load-note') {
      const note=document.createElement('p');
      note.className='image-load-note';
      note.textContent='照片暫時無法載入'+(img.alt?'：'+img.alt:'');
      img.after(note);
    }
  }, true);
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('./trip-app.css?v=20261106-reading-compact', document.baseURI).href;
  root.append(sheet);
  const shell = document.createElement('div');
  shell.className = 'shell';
  shell.innerHTML = `
    <header class="app-header"><div class="header-inner">
      <div class="brand-row"><img class="brand-icon" src="./trip-icon-192.png" alt=""/>
        <div class="brand"><strong>楓葉之旅<span class="brand-year">2026</span></strong><small>JAPAN / AUTUMN</small></div>
        <button class="utility" type="button" data-action="install">${icon('add')}<span>加入主畫面</span></button>
      </div>
      <nav class="section-nav" aria-label="主要導覽">
        <button type="button" data-view="days">${icon('calendar')}<span>每日行程</span></button>
        <button type="button" data-view="flights">${icon('plane')}<span>航班交通</span></button>
        <button type="button" data-view="stays">${icon('bed')}<span>住宿</span></button>
        <button type="button" data-view="bookings">${icon('ticket')}<span>已預約</span></button>        <button type="button" data-view="restaurants">${icon('pin')}<span>餐廳攻略</span></button>
        <button type="button" data-view="airport">${icon('plane')}<span>機場購物</span></button>
        <button type="button" data-view="guide">${icon('book')}<span>旅行資料</span></button>
        <button type="button" data-view="coupons">${icon('coupon')}<span>優惠券</span></button>
        <button type="button" data-view="money">${icon('wallet')}<span>分帳</span></button>
      </nav>
    </div></header>
    <main class="main" id="main"></main>
    <aside class="group-dock" aria-label="航班組別">
      <div class="groups" role="group" aria-label="選擇旅行組別（全部成人）">${GROUPS.map(g=>`<button type="button" data-group="${g}" aria-pressed="false">${g} 組</button>`).join('')}</div>
      <p class="group-context"></p>
    </aside>
    <nav class="stay-dock" aria-label="選擇住宿地點">${STAY_KEYS.map(key=>`<button type="button" data-stay="${key}" aria-pressed="false">${STAY_INFO[key].label}</button>`).join('')}</nav>
    <div class="sr-only" role="status" aria-live="polite" id="announcement"></div>
    <dialog aria-labelledby="install-title"><button type="button" class="dialog-close" data-action="close-install" aria-label="關閉安裝說明">×</button>
      <h2 id="install-title">把旅程放進手機</h2><p>加入主畫面後，就能像 App 一樣開啟；組別會記在這支手機上。</p>
      <p><strong>iPhone／iPad</strong><br/>用 Safari 開啟此網站 → 分享 →「加入主畫面」。</p>
      <p><strong>Android</strong><br/>用 Chrome 開啟此網站 → 選單 →「安裝應用程式」或「加到主畫面」。</p>
      <p>第一次請保持連線，等頁尾顯示「行程已可離線閱讀」。地圖與外部網站仍需網路。</p>
      <button type="button" data-action="native-install" hidden>安裝楓葉之旅</button>
    </dialog>
    <dialog id="food-phrase-dialog" class="food-phrase-dialog" aria-labelledby="food-phrase-title">
      <button type="button" class="dialog-close" data-action="close-food-card" aria-label="關閉不吃牛肉日文卡">×</button>
      <h2 id="food-phrase-title">不吃牛肉日文卡</h2>
      <p class="phrase-caption">點餐時可直接出示這段日文</p>
      <div class="phrase-japanese" lang="ja">
        <p>牛肉を食べない者が1名います。</p>
        <p>牛肉・牛骨だし・牛脂を使っていない料理はありますか？</p>
        <p>スープやソース、具材にも入っていないか、確認していただけますか？</p>
      </div>
      <p class="phrase-translation">我們有一位不吃牛肉。請問有不使用牛肉、牛骨高湯、牛脂的料理嗎？也請幫忙確認湯、醬汁和配料。</p>
      <button type="button" class="phrase-done" data-action="close-food-card">關閉</button>
    </dialog>`;
  root.append(shell);
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    root.querySelector('[data-action=install]').textContent='使用說明';
  }
  const main = root.querySelector('main');
  let pendingInstall = null;
  let offlineReady = false;
  let offlineFailed = false;
  let detailSources = new Map();

  function persist() {
    try { localStorage.setItem(STORE,JSON.stringify(state)); } catch {}
    const url = new URL(location.href);
    url.searchParams.set('group',state.group);
    url.searchParams.set('day',String(state.day));
    url.searchParams.set('view',state.view);
    if(state.view==='stays')url.searchParams.set('stay',state.stay);else url.searchParams.delete('stay');
    if(state.view==='bookings')url.searchParams.set('bday',String(state.bookingDay));else url.searchParams.delete('bday');
    if(state.view==='coupons')url.searchParams.set('cpn',state.coupon);else url.searchParams.delete('cpn');
    history.replaceState(null,'',url);
  }
  function detail(title,source,key) {
    detailSources.set(key,source);
    return `<details data-detail="${escape(key)}"><summary>${escape(title)}</summary><div class="document"></div></details>`;
  }
  function dailyDeparture() {
    if (state.day === 1) return '';
    let rows;
    let note = '';
    if (state.day === 3 && state.group === 'C') {
      rows = [{time:'出關後',label:'抵達日・從成田機場出發',text:'全員領完行李、通過海關後再往車站；依實際出關時間選班或修改原訂班次。'}];
      note = '當天從台灣住家出門的時間，請依航班與前往機場所需時間另行安排。';
    } else if (state.day === 3) {
      const route = state.routes[state.group];
      const yanaka = {time:'09:00',label:'谷根千路線',text:'步行至晴空塔站前 2 番，搭上 26 往上野公園的巴士至根津駅前；出門前確認假日時刻，候車延誤就順延午餐。'};
      const sumida = {time:'09:00',label:'京島・向島路線',text:'從東京民宿出門，先往押上、飛木稻荷神社，再逛麵包店與商店街。'};
      rows = route === 'yanaka' ? [yanaka] : route === 'sumida' ? [sumida] : [yanaka,sumida];
      note = '上午兩條路線擇一，與 A、B 航班組別無關。';
    } else {
      rows = {
        2:[{time:'09:00',label:'東京民宿出門',text:'先吃好早餐，搭車前往豪德寺；步行、候車與轉乘共留約 75–90 分鐘，預計 10:30 開始參拜。'}],
        4:[{time:'09:00',label:'東京民宿出門',text:'先吃好早餐，前往神宮外苑銀杏大道，預計 10:00 開始散步。'}],
        5:[{time:'09:00',label:'上午・東京民宿出門',text:'步行前往 Mūya，預計 09:30 早餐，再逛淺草寺；12:00 牛舌訂位時間不變。'},
           {time:'16:30',label:'下午・休息後再出門',text:'從民宿搭車前往新橋、日比谷 OKUROJI；TEN& 傍晚外帶 17:30 開始。'}],
        6:[{time:'07:50',label:'東京民宿退房出門',text:'帶好行李，預留步行與找月台時間；08:30 前到東武淺草站，搭已訂 09:00 SPACIA X。'}],
        7:[{time:'08:40',label:'日光民宿出門',text:'08:50 前到東武日光站 2A 排隊，搭 09:05 往湯元溫泉、停靠中禪寺溫泉的巴士。'}],
        8:[{time:'07:45',label:'退房完成・民宿門口集合',text:'全員與行李到齊、聯絡司機並裝車；已訂包車 08:00 出發往成田飯店。'}],
        9:[{time:'08:05',label:'飯店大廳集合・已登記到接駁座位',text:'08:15 前上車，08:20 發車，約 08:40 抵達成田 T2；先辦退稅商品海關確認，再托運。'}]
      }[state.day] || [];
      if (state.day === 9) note = '若未登記到接駁座位，改為 08:00 從飯店出門，步行至京成成田站搭電車。';
    }
    if (!rows.length) return '';
    return `<section class="departure-card" aria-labelledby="departure-title"><div class="departure-heading"><h2 id="departure-title">建議出門時間</h2><span>日本時間</span></div><div class="departure-rows">${rows.map(row=>`<div class="departure-row"><strong class="departure-time">${escape(row.time)}</strong><div><h3>${escape(row.label)}</h3><p>${escape(row.text)}</p></div></div>`).join('')}</div>${note?`<p class="departure-note">${escape(note)}</p>`:''}</section>`;
  }
  // Suggestions are local Japan times, not reservations. Fixed entries come
  // from the existing itinerary; unbooked services remain explicitly pending.
  function dailyPassRecommendation() {
    const entry = {
      4:{source:'tokyo-subway-pass-info',title:'東京地鐵 48 小時券',status:'可選購',note:'11/24 上午首次進站啟用，11/25 續用。官方成人 ¥1,500；可樂參考價 NT$307（11/06）。'},
      5:{source:'tokyo-subway-pass-info',title:'東京地鐵 48 小時券',status:'續用提醒',note:'若昨天已啟用，今天地鐵續用同張券；本日淺草橋、新橋、日比谷、六本木路線可用。'},
      6:{source:'nikko-bus-pass-info',title:'中禪寺溫泉 2 日巴士券',status:'建議購買',note:'10:50 抵達東武日光後購買，使用日期 11/26–11/27。成人每人 ¥2,300。'},
      7:{source:'nikko-bus-pass-info',title:'中禪寺溫泉 2 日巴士券',status:'續用提醒',note:'若昨天已依建議購票，今天續用同張券往返中禪寺溫泉。適用車程不用再刷 IC 卡；瀑布電梯另付。'}
    }[state.day];
    if (!entry) return '';
    return `<section class="daily-pass-card" aria-label="本日推薦交通票券"><div class="daily-pass-heading"><h2>${escape(entry.title)}</h2><span>${escape(entry.status)}</span></div><p>${escape(entry.note)}</p>${detail('購買、範圍與使用方式',$('#'+entry.source),'daily-transport-pass-'+state.day)}</section>`;
  }
  function markNikkoBusPassRides() {
    if (state.view !== 'days') return;
    // Same zero-based stop order as dailyTimes; only the covered bus legs.
    const rides = {
      6:{2:{
        time:'11/26 12:45–13:30 為候車、搭車與步行時段；到站搭下一班適用車，不是 12:45 固定發車。',
        route:'在 mekke 附近的日光郷土センター前（5 號站），找往神橋／中禪寺方向的站牌，搭停靠西参道入口的 C／M／SP／Y／YK 系統；在西参道入口（9 號站）下車，再依指標步行到東照宮。上車前核對站牌與車頭方向。',
        scope:'票券只抵這段巴士車資；步行參拜不需車票，東照宮門票與 SPACIA X 另付。'}},
      7:{0:{
        time:'11/27 08:50 前到站排隊；09:05 發車，表定 09:50 到中禪寺溫泉。',
        route:'在東武日光站 2A 乘車處，搭 YK 系統、車頭寫「湯元温泉」且經中禪寺溫泉的巴士；途中經伊呂波坂，在中禪寺溫泉（26 號站）下車，再步行約 5 分鐘到華嚴瀑布。',
        scope:'東武日光 → 中禪寺溫泉可用；不要跟車搭到湯元溫泉。華嚴瀑布電梯另付。'},
         5:{
        time:'11/27 14:10–14:15 到站排隊；14:30 發車，表定 15:06 到東武日光。',
        route:'在中禪寺溫泉 26B 乘車處，搭 YK 系統往 JR／東武日光站方向的巴士，在東武日光站（2 號站）下車，不必坐到 JR 日光站；不要排 26A 往湯元溫泉的車。',
        scope:'中禪寺溫泉 → 東武日光全段可用，續用 11/26 啟用的同一張有效券。'}}
    }[state.day];
    if (!rides) return;
    main.querySelectorAll('.stop-content').forEach((stop,index)=>{
      const ride=rides[index];
      if (!ride) return;
      stop.closest('li').classList.add('has-bus-pass');
      const body=stop.querySelector('.schedule-detail-body');
      if (!body) return;
      const instructions=document.createElement('section');
      instructions.className='bus-pass-detail';
      instructions.setAttribute('aria-label','巴士搭乘與票券使用方式');
      const facts=[['班次／候車',ride.time],['搭乘方式',ride.route]];
      instructions.innerHTML=`<dl class="bus-pass-facts">${facts.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
        <h4>紙本券使用方式</h4>
        <ol><li>上車先備好票券。前門上車向司機出示；中門上車則在下車時出示。</li><li>車內顯示目的站時按下車鈴，下車時各自清楚出示有效券。這段不用再刷 IC 卡或另付車資。</li></ol>
        <details class="bus-pass-digital"><summary>使用電子券時</summary><p>NIKKO MaaS／TOBU Japan Trip Tickets：先開啟「巴士乘車用 QR」，上、下車各掃一次車內讀取器。</p><p>Jorudan：向司機出示使用中的票券畫面；依購買平台的方式使用。</p></details>
        <p class="bus-pass-scope"><strong>適用範圍：</strong>${escape(ride.scope)}</p>
        <p class="bus-pass-reminder">巴士券不保留座位，滿車須等後續班次；時刻與乘車處如有異動，以當日站牌公告為準。</p>
        <a href="https://www.tobu-bus.com/pc/area/nikko/guide.html" target="_blank" rel="noopener noreferrer">東武巴士乘車方式 ↗</a>`;
      body.prepend(instructions);
      const toggle=stop.querySelector('.schedule-toggle');
      if (toggle) {
        toggle.querySelector('.schedule-toggle-label').innerHTML='詳細行程・票券 <span aria-hidden="true">＋</span>';
        toggle.setAttribute('aria-label',`${dailyTimes()[index].time} 詳細行程與巴士券使用方式`);
      }
    });
  }
  function dailyTimes() {
    const suggested = time => ({time, label:'建議時間'});
    const fixed = (time, label='固定時間') => ({time, label, fixed:true});
    if (state.day === 1 && state.group === 'B') return [
      fixed('18:30','航班抵達'), suggested('出關後選班次'),
      suggested('依實際列車抵達本所吾妻橋'), fixed('21:30 鳥貴族訂位・A 組先入座','已訂位'), suggested('B 組抵達後加入；延誤請聯絡店家')
    ];
    if (state.day === 3 && state.group === 'C') return [
      fixed('12:10','航班抵達'), suggested('出關後，依實際班次前往民宿'),
      suggested('17:30–19:00（依用餐進度）'), suggested('19:00 起（晴空塔選逛）')
    ];
    return {
      1:[suggested('15:20–16:00'),suggested('入住後，約 16:00–17:15'),suggested('17:15–17:35'),suggested('18:30–20:00'),fixed('21:30 鳥貴族','已訂位')],
      2:[suggested('09:00–10:30'),suggested('10:30–11:15'),suggested('約 12:00；現場候位'),suggested('約 14:30–18:00；依午餐調整'),suggested('18:00–19:00')],
      3:[suggested('09:00 出門；13:00 左右起晴空塔'),suggested('17:30–19:00（依用餐進度）')],
      4:[suggested('09:00–10:00'),suggested('10:00–10:45'),suggested('11:00–14:15（與午餐調整順序）'),suggested('11:00–14:15 午餐三選一'),suggested('14:15–14:45 步行往澀谷'),suggested('14:45–15:30 FREAK\'S STORE'),suggested('15:30–17:00 澀谷 PARCO'),suggested('17:00–19:00 PARCO B1 分開晚餐・依候位'),suggested('19:00–20:00 唐吉訶德選逛'),suggested('依集合時間返回民宿')],
      5:[suggested('09:30–10:15'),suggested('10:30–11:30'),fixed('12:00 牛舌訂位・用餐 1 小時','5 位已訂；另 2 位自由用餐'),suggested('午餐後順路選買；約 13:15 會合'),suggested('13:30–15:00 淺草橋神社・シモジマ'),suggested('15:30–16:30 回民宿放物品、休息'),suggested('17:30–18:00 TEN& 外帶（建議）'),suggested('18:00–19:00 有樂町 HARBS（有位內用／滿席外帶）'),suggested('19:30 左右 六本木新城聖誕市集・大屋頂廣場')],
      6:[fixed('淺草 09:00 → 東武日光 10:50','SPACIA X 003・已訂妥'),suggested('10:50–11:30 寄物'),suggested('11:30–12:45 午餐；12:45–13:30 搭車'),suggested('13:30–15:15 東照宮'),suggested('15:15–15:40 步行往神橋、拍照'),suggested('15:40–16:15 往寄物處'),fixed('16:15–16:30 取件；最晚 17:00','建議提早取件・17:00 關門'),suggested('16:45–17:15 入住')],
      7:[fixed('09:05 → 09:50；08:50 前候車','東武日光 2A・往湯元溫泉'),suggested('10:00–11:00 華嚴瀑布'),suggested('11:00–11:30 湖畔短走'),suggested('11:30–13:00 午餐、休息'),suggested('13:00–14:15 自由活動、回站候車'),fixed('14:30 → 15:06','中禪寺溫泉 26B・往日光站'),suggested('15:15–16:15 站前自由逛・可略過'),suggested('約 16:30 回民宿休息')],
      8:[fixed('08:00','已訂包車・建議 07:45 完成退房並集合'),suggested('13:00–14:30'),suggested('14:30–16:40'),fixed('去程 17:15／17:47；回程 20:28／20:29','行程所列巴士班次・行前確認')],
      9:[suggested('08:20（前晚登記座位）'),suggested(state.group==='B'?'11:30–12:30':'10:30–11:00'),fixed(state.group==='B'?'14:35':'13:00','回程航班起飛')]
    }[state.day] || [];
  }
  // Explicit mapping of detail rows to daily time slots (zero based).
  const SLOT_ROWS = {
    1:[0,0,1,2,3,3,4], 2:[0,1,2,2,3,3,4,4],
    3:[0,0,0,0,0,0,0,0], 4:[0,1,2,2,3,4,6,7,8,9],
    5:[0,1,2,3,4,4,5,6,7,8], 6:[0,1,2,2,3,4,5,6,7],
    7:[0,1,2,3,4,5,6,7], 8:[0,0,1,2,3,3,3,3,3]
  };
  function inlineDetails(items, sources) {
    const slots = items.map(() => []);
    const add = (index, source, label) => {
      const target = Math.min(Math.max(index, 0), slots.length - 1);
      const anchors=[source,...source.querySelectorAll('[id]')].filter(el=>el.id).map(el=>`<span data-inline-source="${escape(el.id)}"></span>`).join('');
      slots[target].push(`${anchors}${label ? `<h3>${escape(label)}</h3>` : ''}${readable(source)}`);
    };
    const addRow = (index, row, table, sourceId = '') => {
      if(!row) return;
      const part=table.cloneNode(false);
      if(table.tHead) part.append(table.tHead.cloneNode(true));
      const body=document.createElement('tbody');body.append(row.cloneNode(true));part.append(body);
      const wrap=document.createElement('section');wrap.id=sourceId;wrap.append(part);add(index,wrap);
    };
    if((state.day===1 && state.group==='B') || (state.day===3 && state.group==='C')) {
      const rail=$('.narita-combined-table').cloneNode(true);
      [...rail.tBodies].forEach(body=>{if(!body.classList.contains('group-'+state.group.toLowerCase())) body.remove();});
      add(1,rail,'成田機場到民宿');
      if(state.group==='B') {
        const table=$('#day1-route-detail .route-detail-table');
        addRow(3,[...table.tBodies[0].rows].at(-1),table,'day1-route-detail');
      } else {
        const dinner=$('.day3-food .diet-inline-card');
        const meeting=dinner?.querySelector('p');
        if(meeting) add(2,meeting);
      }
    }
    sources.forEach(source => {
      const clone = source.cloneNode(true);
      clone.querySelectorAll('.group-c-divider-row,.group-c-arrival-row,#day6-pass-guide,#day7-pass-guide').forEach(el => el.remove());
      const tables = [...clone.querySelectorAll('.route-detail-table')];
      if (tables.length) {
        let rowIndex = 0;
        tables.forEach(table => {
          const label = state.day === 3 ? table.closest('.route-detail-section')?.querySelector('h3')?.textContent : '';
          const grouped = new Map();
          [...table.tBodies].flatMap(body => [...body.rows]).forEach(row => {
            const index = (SLOT_ROWS[state.day] || [])[rowIndex++] ?? slots.length - 1;
            if (!grouped.has(index)) grouped.set(index, []);
            grouped.get(index).push(row.cloneNode(true));
          });
          grouped.forEach((rows, index) => {
            const part = table.cloneNode(false);
            if (table.tHead) part.append(table.tHead.cloneNode(true));
            const body = document.createElement('tbody'); body.append(...rows); part.append(body);
            const wrap = document.createElement('section'); wrap.id=source.id; wrap.append(part);
            slots[index].push(`<span data-inline-source="${escape(source.id)}"></span>`);
            add(index, wrap, label);
          });
        });
        clone.querySelectorAll('.route-detail-table,h2,.route-detail-section-head,.route-final-note').forEach(el => el.remove());
        clone.querySelectorAll('.route-map-bar').forEach(bar => {
          [...bar.children].forEach((link, index) => {
            const wrap = document.createElement('div'); wrap.append(link.cloneNode(true));
            const target = state.day === 6 ? [3,3][index] ?? 3 : state.day === 7 ? 0 : state.day === 8 ? [2,2,3,0,0][index] ?? 3 : state.day === 5 ? [1,6,7][index] ?? 8 : state.day === 4 ? (index ? 6 : 4) : state.day === 2 ? (index ? 3 : 1) : state.day === 1 ? (index ? 3 : 0) : 0;
            add(target, wrap);
          });
          bar.remove();
        });
        if (clone.textContent.trim()) add([6,8].includes(state.day) ? 3 : 0, clone);
      } else {
        clone.querySelectorAll('.day-header').forEach(el=>el.remove());
        if(state.day===5) {
          clone.querySelectorAll('.meeting-plan .plan-box').forEach((box,index)=>{add(index ? 6 : 4,box);box.remove();});
        }
        if (state.day === 3) {
          clone.querySelectorAll('.diet-inline-card').forEach(card => {
            const meeting=card.querySelector('p');
            if(meeting) add(1,meeting);
            card.remove();
          });
          clone.querySelectorAll('.food-card-grid,.food-detail-card,.food-photo,.food-copy,.full-phrase-box,h2').forEach(el=>el.remove());
          if (clone.textContent.trim()) add(source.textContent.includes('炭火焼肉おくさこ') && !source.classList.contains('day3-food') ? 1 : 0, clone);
        } else if(!source.classList.contains('day-food-extension')) {
          clone.querySelectorAll('.food-card-grid,.food-detail-card,.food-photo,.food-copy,.diet-inline-card,.full-phrase-box').forEach(el=>el.remove());
          if(clone.textContent.trim()) add(slots.length - 1,clone);
        }
      }
    });
    return slots;
  }
  function list(items, sources = []) {
    const slotDetails = inlineDetails(items, sources);
    const times = dailyTimes();
    return `<ol class="timeline">${items.map((html,i)=>{
      const slot=times[i];
      const time=slot?`<div class="schedule-time${slot.fixed?' is-fixed':''}"><span>${escape(slot.label)}</span><b>${escape(slot.time)}</b></div>`:'';
      const toggle = slotDetails[i].length ? `<button type="button" class="schedule-toggle" aria-expanded="false" aria-controls="slot-detail-${state.day}-${i}" aria-label="${escape(slot?.time || `第 ${i+1} 項`)} 詳細行程">${time}<span class="schedule-toggle-label">詳細行程 <span aria-hidden="true">＋</span></span></button>` : time;
      const body = slotDetails[i].length ? `<div class="document schedule-detail-body" id="slot-detail-${state.day}-${i}" hidden>${slotDetails[i].join('')}</div>` : '';
      return `<li><span class="step" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div class="stop-content">${toggle}${html}${body}</div></li>`;
    }).join('')}</ol>`;
  }
  function groupArrival() {
    const row = flightRow(departures,state.group);
    return `<strong>抵達成田：</strong>${row.cells[2].innerHTML}。${row.cells[3].innerHTML}`;
  }
  function daily() {
    const day = daySources[state.day];
    const source = day.summary;
    let title = source.querySelector('.day-title').textContent;
    let route = readable(source.querySelector('.day-route-text'));
    let items = [...source.querySelectorAll('.day-items-grid > .day-item')].map(el=>readable(el));
    let photo = source.querySelector('.day-photo img');
    let extras = day.extra;
    let custom = '';
    if (state.day === 1 && state.group === 'B') {
      title = '抵達東京・晚餐會合';
      route = '18:30 抵達成田 T2 → 入境與領行李 → Skyliner、青砥轉乘 → 本所吾妻橋民宿 → A 組先入店，B 組抵達後會合';
      items = [groupArrival(), '<strong>機場交通：</strong>19:23、20:23、21:23 均停靠青砥，再轉本所吾妻橋。出關後依時間與空位選班；若搭 21:23，會晚於 21:30 晚餐訂位，請先通知店家與 A 組。', '<strong>先放行李：</strong>到本所吾妻橋民宿後在群組回報，再確認晚餐集合位置與抵達時間。', readable([...source.querySelectorAll('.day-item')].at(-1)), '<strong>晚餐會合：</strong>A 組先憑訂位姓名報到入座；B 組抵達後加入。若航班或入境延誤，請先通知店家。'];
      extras = [];
    }
    if (state.day === 3 && state.group === 'C') {
      title = '抵達東京・燒肉與晴空塔';
      photo = source.querySelectorAll('.day-photo img')[1];
      route = '成田 T2 → Skyliner、青砥轉乘 → 本所吾妻橋民宿放行李 → 炭火焼肉おくさこ與大家會合吃晚餐 → 晴空塔（選逛）';
      items = [groupArrival(), ...[...$('#day3-route-detail-b1').querySelectorAll('.group-c-arrival-row')].map(row=>`<strong>${row.cells[1].textContent}</strong><p>${row.cells[2].textContent}</p><p>${row.cells[3].textContent}</p>`)];
      items.push('<strong>餐後安排：</strong>炭火焼肉おくさこ用餐後，想看夜景再去晴空塔；累了就回民宿，不必折返。<br/><a href="https://maps.app.goo.gl/rWTxzYh2HwmYyaoX8" target="_blank" rel="noopener noreferrer">燒肉・炭火焼肉おくさこ地圖 ↗</a>');
      extras = [];
    } else if (state.day === 3) {
      const selected = ['yanaka','sumida'].includes(state.routes[state.group]) ? state.routes[state.group] : 'all';
      route = `本所吾妻橋 → ${selected==='yanaka'?'谷根千（根津神社・谷中銀座）':selected==='sumida'?'京島・向島（飛木稻荷・ハト屋・キラキラ橘・MUUMUU COFFEE）':'谷根千／京島・向島（二選一）'} → 晴空塔 Solamachi → 炭火焼肉おくさこ晚餐 → 晴空塔夜景（選逛）`;
      items[0] = '<strong>上午自由選線：</strong>09:00 出門。谷根千：根津神社、谷中銀座；京島・向島：麵包店與咖啡散步。上午擇一，13:00 左右到晴空塔用餐，依交通與散步進度順延。';
      custom = `<h2 class="section-label">上午路線</h2><p class="intro">A、B 組都可自由選擇，與航班組別無關。</p><div class="route-select" role="group" aria-label="第 3 天散步路線">${[['all','兩條都看'],['yanaka','谷根千'],['sumida','京島・向島']].map(([key,label])=>`<button type="button" data-route="${key}" aria-pressed="${selected===key}">${label}</button>`).join('')}</div>`;
      extras = extras.filter(el => selected === 'all' || (selected === 'yanaka' ? el.id !== 'day3-route-detail-b1' : el.id !== 'day3-route-detail'));
      if (selected === 'yanaka') extras = extras.map(el=>{
        if(!el.classList.contains('day3-food')) return el;
        const dinner=document.createElement('section');
        dinner.innerHTML='<h2>炭火焼肉おくさこ晚餐</h2>';
        dinner.append(el.querySelector('.diet-inline-card').cloneNode(true));
        return dinner;
      });
    }
    if (state.day === 5) {
      const lunchIndex = items.findIndex(html => html.includes('A～C 組午餐') || html.includes('分開用餐'));
      if (lunchIndex >= 0) items[lunchIndex] = `<strong>11/25 午餐｜分開用餐</strong><div class="meal-split-grid" aria-label="午餐分組">
        <article class="meal-split-card meal-split-booked"><div class="meal-split-head"><strong>牛舌訂位・5 人</strong><span>已訂位</span></div><h3><a href="https://maps.app.goo.gl/K4QdwtcbFczYAsTPA" target="_blank" rel="noopener noreferrer">牛たんの檸檬 淺草店</a></h3><p><b>11/25 12:00</b>｜兩筆訂位：3 人＋2 人</p><a href="./?view=bookings&amp;bday=5">查看已預約資料 ↗</a></article>
        <article class="meal-split-card meal-split-pending"><div class="meal-split-head"><strong>自由用餐・2 人</strong><span>當天選店</span></div><h3>淺草自由用餐</h3><p>1 位不吃牛、1 位陪同。當天在淺草找想吃的店；麺 みつヰ、天麩羅秋光可供參考。</p><p class="meal-split-caution">下單前向店家確認湯底、醬汁與配料沒有牛肉、牛骨或牛脂。</p><div class="meal-split-links"><a href="https://tabelog.com/tokyo/A1311/A131102/13284327/" target="_blank" rel="noopener noreferrer">麺 みつヰ ↗</a><a href="https://akimitsu.tokyo/asakusa/" target="_blank" rel="noopener noreferrer">天麩羅秋光 ↗</a></div></article>
      </div>`;
    }
    if (state.day === 9) {
      const row = flightRow(returns,state.group);
      items = items.map(html => html.includes('IT281') || html.includes('CI101') ? '<strong>行程流程：</strong>全體預計 08:20 飯店接駁（前晚登記座位，約 08:40 抵達 T2）→ 保留免稅品在身邊 → 托運前完成海關攜出確認 → 航空報到／托運。' : html);
      items.push(`<strong>${state.group} 組回程：</strong>${row.cells[3].innerHTML}<br/>${row.cells[1].innerHTML} → ${row.cells[2].innerHTML}`);
    }
    const date = source.querySelector('.day-date').textContent;
    return `<div class="journey-heading"><div><div class="eyebrow">NOVEMBER IN JAPAN</div><p class="journey-title">${state.group} 組行程</p></div><span class="trip-duration">${state.group==='C'?'7 天 6 夜':'9 天 8 夜'}</span></div>
      <p class="intro journey-intro">${state.group==='C'?'11.23':'11.21'} — 11.29<span>本組行程與共同活動</span></p>
      ${dayNavigation()}

      <section class="weather-section" aria-label="當日行程天氣"><p>天氣資料載入中…</p></section>
      <div class="itinerary-layout"><aside class="day-overview"><section class="hero">${photo ? `<img src="${escape(photo.getAttribute('src'))}" alt="${escape(photo.alt)}" fetchpriority="high"/>` : ''}<span class="day-stamp" aria-hidden="true">DAY <b>${String(state.day).padStart(2,'0')}</b></span><div class="hero-copy"><small>${escape(date)} · ${state.group} 組</small><h1>${escape(title)}</h1><span class="photo-caption">${icon('pin')}${escape(photo?.alt || '日本之旅')}</span></div></section>
      <div class="route"><span class="route-label">${icon('pin')}今日路線<span>TODAY'S ROUTE</span></span>${route}</div>${dailyDeparture()}${dailyPassRecommendation()}</aside>
      <section class="day-plan" aria-label="每日安排"><h2 class="section-label">今日安排<span class="section-sub">ITINERARY</span></h2>${custom}${list(items, extras)}${dayPracticalInfo()}${dayResources()}${dayQuickActions()}
      ${source.querySelector('.day-alert-grid') ? `<div class="document">${readable(source.querySelector('.day-alert-grid'))}</div>` : ''}

      <div class="day-footer"><button type="button" data-day="${state.day-1}" ${state.day===firstDay()?'disabled':''}>← 前一天</button><span>DAY ${String(state.day).padStart(2,'0')} / 09</span><button type="button" data-day="${state.day+1}" ${state.day===9?'disabled':''}>後一天 →</button></div></section></div>`;
  }
  function practicalDetail(key) {
    const source = $('#'+key);
    return source ? detail(source.querySelector('h2').textContent, source, key) : '';
  }
  function dayPracticalInfo() {
    if(state.day===6) return practicalDetail('nikko-luggage-info');
    if(state.day===8 || state.day===9) return practicalDetail('narita-shuttle-fallback');
    return '';
  }
  function foodCardButton() {
    return '<button type="button" data-action="food-card" aria-haspopup="dialog">不吃牛肉日文卡</button>';
  }
  function dayQuickActions() {
    const key = state.day<=5?'tokyo':state.day<=7?'nikko':state.day===8?'narita':null;
    const stay = key && STAY_DIRECTIONS[key];
    const url = stay ? 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(stay.destination) : '';
    const home = stay ? '<a href="'+url+'" target="_blank" rel="noopener noreferrer" aria-label="回'+stay.name+'，開啟 Google 地圖路線">'+icon('pin')+'回住宿｜'+stay.name+' ↗</a>' : '';
    return '<nav class="trip-quick-actions" aria-label="旅途快捷功能">'+home+'<a href="https://www.google.com/maps/search/?api=1&query=restaurants+near+me" target="_blank" rel="noopener noreferrer">附近找吃的 ↗</a>'+foodCardButton()+'</nav>';
  }
  function dayResources() {
    const resources = state.day===6||state.day===7 ? [['./site-two/index.html','日光巴士：站牌、班次與票券']] : state.day===9 ? [['./?view=airport','機場購物：安檢前／後分區']] : [];
    return resources.length ? '<nav class="resource-links" aria-label="當日延伸資料">'+resources.map(([url,title])=>'<a href="'+url+'">'+title+' ↗</a>').join('')+'</nav>' : '';
  }
  function flightPanel(table,title) {
    const row = flightRow(table,state.group);
    const departure = row.cells[1].innerHTML.replace(/\b(\d{1,2}:\d{2})\b/, '<strong class="flight-departure-time">$1</strong>');
    const arrival = row.cells[2].innerHTML.replace(/\b(\d{1,2}:\d{2})\b/, '<strong class="flight-arrival-time">$1</strong>');
    return `<section class="panel flight-ticket"><div class="ticket-header"><span class="pill">${escape(title)} · ${state.group} 組</span><span>BOARDING PASS</span></div><div class="flight"><div>${departure}</div><span class="arrow" aria-hidden="true">${icon('plane')}</span><div class="flight-arrival">${arrival}</div></div><div class="ticket-footer"><strong>${row.cells[3].innerHTML}</strong>${row.cells[4]?`<p class="intro">建議抵達機場時間：${row.cells[4].innerHTML}</p>`:''}</div></section>`;
  }

  function skylinerNotice() {
    return `<p class="transit-alert"><strong>搭車提醒：</strong>${state.group==='A'?'A 組原訂 14:22 的 136 號。出關後想改早或改晚，可在原班發車前到京成訂票網站改搭仍有 3 席且停青砥的班次；新班距發車須超過 1 分鐘。':'出關後依時間與空位選班。'}本所吾妻橋抵達時間為轉乘估計。<a href="https://www.keisei.co.jp/keisei/tetudou/skyliner/jp/traffic/skyliner_timetable_1121.php" target="_blank" rel="noopener noreferrer">官方時刻表 ↗</a></p>`;
  }
  function bookedSkyliner() {
    return '<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 01 · 11/21（六）</span><span class="booking-status">已購票 · A 組 3 人</span></div><h2>Skyliner 136 號｜成田 → 青砥</h2><div class="booking-facts"><div><span>空港第 2 ビル出發</span><strong>14:22</strong></div><div><span>青砥抵達</span><strong>14:54</strong></div><div><span>座位</span><strong>8 號車 1A・1B・1C</strong></div><div><span>指定席券</span><strong>3 人共 ¥3,150</strong></div></div><p>當天可在原班 14:22 發車前於京成訂票網站更改班次；新班須停青砥、有空位，距發車超過 1 分鐘。改票後依新票時間與座位搭乘。基本車資另付；每人使用自己的 Suica／PASMO 進站，在青砥轉車時不出站，到本所吾妻橋再刷同一張卡出站。查票時開啟京成訂票網站的票券畫面。</p><a href="https://www.keisei.co.jp/srweb/info/pc/faq.html" target="_blank" rel="noopener noreferrer">京成電子票與改票說明 ↗</a></article>';
  }
  function majorTransitGuide(kind, open=false) {
    const isNikko=kind==='spacia';
    const title=isNikko?'SPACIA X 003｜手機開票與搭車步驟':'Skyliner｜成田入境、買票與青砥轉乘';
    const body=isNikko ? `
      <p><strong>11/26（四）東武淺草 09:00 → 東武日光 10:50</strong>。7 位成人，Premium seat；建議 08:30 到東武淺草站。</p>
      <ol>
        <li>手機登入 <a href="https://tobu-japantrip-tickets.com/" target="_blank" rel="noopener noreferrer">TOBU Japan Trip Tickets</a> → My page → Ticket list → Limited Express Ticket，開啟 11/26 的 SPACIA X 003 訂單。</li>
        <li><strong>不用到櫃檯換紙本特急券。</strong>查票時按 View Tickets，出示手機網站上的票券畫面。先確認能登入、可收驗證信，手機保持網路與電量；訂購截圖只作備份。</li>
        <li>每人另備<strong>基本乘車票</strong>：自己的 Suica／PASMO、淺草至東武日光乘車票，或涵蓋此段的有效周遊券。這筆電子特急券不能單獨當基本乘車票使用。</li>
        <li>找<strong>東武淺草站</strong>，不是都營或 Metro 月台。用基本乘車票或 IC 卡進閘，跟隨特急指標前往 <strong>3・4 號月台入口</strong>；Information Counter 由站員確認特急券，實際月台看當日電子看板。</li>
        <li>核對「SPACIA X 003／09:00／東武日光」，依手機票券上的車廂及座位入座。先放好大件行李、確認 7 人都上車；09:00 發車。</li>
        <li>10:50 抵達東武日光，取齊行李，用同一張 IC 卡或基本乘車票出站。先寄放行李，再找午餐。</li>
      </ol>
      <p class="transit-alert"><strong>可能趕不上時：</strong>這個購票網站改日期、區間或座位需退票重買；本班退票截止為 08:45（發車前 15 分鐘）。先確認後續安排，退票後原座位會釋出。錯過列車不能直接拿原特急券搭下一班。</p>
      <div class="action-row"><a href="https://tobu-japantrip-tickets.com/faq" target="_blank" rel="noopener noreferrer">電子票與退票官方說明 ↗</a><a href="https://www.tobu.co.jp/railway/special_express/platform/" target="_blank" rel="noopener noreferrer">東武淺草特急月台 ↗</a><a href="https://www.tobu.co.jp/railway/special_express/purchase/" target="_blank" rel="noopener noreferrer">基本車資與特急券 ↗</a></div>` : `
      ${skylinerNotice()}
      <ol>
        <li>完成入境審查、領行李與海關後，跟「鐵道／京成電鐵」到<strong>成田第 2 航廈 B1</strong>。${state.group==='A'?'A 組已訂 14:22 Skyliner 136 號，到青砥 14:54。':'全員及行李到齊再買票。'}</li>
        <li>${state.group==='A'?'開啟京成訂票網站上的電子指定席券，確認 8 號車 1A、1B、1C；查票時出示票券畫面。':'告知櫃檯：搭<strong>停靠青砥</strong>的 Skyliner，再轉車到<strong>本所吾妻橋</strong>。不是每班 Skyliner 都停青砥；核對車次、時間、青砥停靠與座位後才付款。'}</li>
        <li>${state.group==='A'?'已購票為指定席券，<strong>基本車資另付</strong>；3 人各用自己的 Suica／PASMO 進站，到本所吾妻橋再刷同一張卡出站。':'每人需要<strong>基本車資＋Skyliner 指定席券</strong>。用 Suica／PASMO 付基本車資時，另買到青砥的指定席券；出站前基本車資須涵蓋到本所吾妻橋。若買含基本車資的票券，依票券方式進站，不要重複刷 IC。'}</li>
        <li>依票面班次、月台、車廂和座位乘車。行李放指定區，到青砥前先整理好。</li>
        <li><strong>青砥不出閘門。</strong>通常在 2 樓的 2 號月台下車，走到同一座月台對側的 1 號；通常不用上下樓。看「押上・都營淺草線方面」，再確認列車停靠<strong>本所吾妻橋 A19</strong>。機場快特不停 A19，不要只看終點就上車；月台以現場看板為準。</li>
        <li>到本所吾妻橋，用進站時同一張 IC 卡出站；紙票區間不足找站員補票。依住宿地圖步行，大件行李可看電梯出口標誌。</li>
      </ol>
      <p lang="ja"><strong>櫃檯可出示：</strong>青砥に停まるスカイライナーで、本所吾妻橋まで行きたいです。</p>
      <div class="action-row"><a href="./site-four/index.html">Skyliner 交通 ↗</a><a href="https://www.keisei.co.jp/keisei/tetudou/skyliner/us/skyliner/purchase.php" target="_blank" rel="noopener noreferrer">京成購票說明 ↗</a><a href="https://www.keisei.co.jp/keisei/tetudou/stationmap/pdf/us/110.pdf" target="_blank" rel="noopener noreferrer">青砥站內圖 ↗</a></div>`;
    return `<details class="major-transit-guide"${open?' open':''}><summary>${title}</summary><div class="transit-guide-body">${body}</div></details>`;
  }
  function airportArrivalItem() {
    const row=flightRow(departures,state.group);
    const arrival=row.cells[2].textContent.match(/\b\d{1,2}:\d{2}\b/)?.[0] || '';
    const rail=$('.narita-combined-table').cloneNode(true);
    [...rail.tBodies].forEach(body=>{if(!body.classList.contains('group-'+state.group.toLowerCase()))body.remove();});
    rail.querySelector('caption')?.remove();
    const mobileTimes=[...rail.tBodies[0].rows].map(tr=>{
      const cells=[...tr.cells];
      const train=cells[0].textContent.trim().split('／');
      return `<article class="skyliner-time-card"><div class="skyliner-time-card-head"><strong>Skyliner ${escape(train[1] || '')}</strong></div>
        <dl><div><dt>成田 T2 出發</dt><dd>${escape(train[0])}</dd></div><div><dt>青砥抵達</dt><dd>${escape(cells[1].textContent.trim())}</dd></div><div><dt>本所吾妻橋<br>預估抵達</dt><dd>${escape(cells[2].textContent.trim())}</dd></div></dl>
      </article>`;
    }).join('');

    return `<li class="airport-arrival-stop"><span class="step" aria-hidden="true">01</span><div class="stop-content">
      <button type="button" class="schedule-toggle" aria-expanded="false" aria-controls="airport-reading-detail"><div class="schedule-time is-fixed"><span>航班抵達</span><b>${escape(arrival)} 成田 T2</b></div><span class="schedule-toggle-label">詳細行程 <span aria-hidden="true">＋</span></span></button>
      <div class="stop-summary"><strong class="stop-summary-title">成田機場 → 青砥轉乘 → 本所吾妻橋</strong><p>${state.group==='A'?'已訂 Skyliner 136 號，14:22 成田 T2 → 14:54 青砥。青砥不出閘，轉往押上／都營淺草線、會停本所吾妻橋的列車，再步行到民宿。':'出關取行李後，到 T2 地下 1 樓選停靠青砥的 Skyliner。青砥不出閘，轉往押上／都營淺草線、會停本所吾妻橋的列車，再去民宿。'}</p></div>
      <div class="document transit-guide-body schedule-detail-body" id="airport-reading-detail" hidden>
        <p class="reading-note"><strong>青砥轉車：</strong>先看月台停站表，勿搭不停本所吾妻橋 A19 的 Airport 快特。持網路指定席券時，基本車資另用自己的 IC 卡；同一張卡在機場進站、本所吾妻橋出站。</p>
        <p><strong>本所吾妻橋出站：</strong>往東駒形民宿走 A2；帶大行李優先找 A0 電梯，再依住宿地圖步行。</p>
        ${state.group==='B'?'<p>若只能搭 21:23 班，會趕不上 21:30 晚餐；先通知餐廳，A 組先入座。</p>':''}
        ${state.group==='A'?'<p class="transit-alert"><strong>已訂｜11/21 Skyliner 136 號</strong><br>成田 T2 14:22 → 青砥 14:54｜3 人，8 號車 1A・1B・1C。指定席券共 ¥3,150；基本車資另付，每人用自己的交通卡。<br><a href="./?view=bookings&amp;bday=1">查看已預約資料 ↗</a></p>':''}
        <h3>${state.group==='A'?'班次時間｜136 號已訂，其餘為備選':'班次時間'}</h3><div class="skyliner-desktop-times">${readable(rail)}</div><div class="skyliner-mobile-times" aria-label="Skyliner 班次">${mobileTimes}</div>
        <nav class="trip-quick-actions airport-arrival-actions" aria-label="機場交通">
          <a href="./site-four/index.html">Skyliner 交通 ↗</a>
        </nav>
      </div>
    </div></li>`;
  }
  function attachMajorTransitGuide() {
    if(state.view==='flights') {
      main.querySelector('.section-label')?.insertAdjacentHTML('afterend', majorTransitGuide('skyliner'));
    } else if(state.view==='days') {
      if((state.day===1 && state.group!=='C') || (state.day===3 && state.group==='C')) {
        const timeline=main.querySelector('.timeline');
        if(timeline) {
          // Merge the legacy arrival and rail entries after the Word layout pass.
          // Other stops keep their existing detail IDs and event handlers.
          if(state.group==='B' || state.group==='C') {
            [...timeline.children].slice(0,2).forEach(item=>item.remove());
          }
          if(state.group==='B')timeline.lastElementChild?.remove();
          timeline.insertAdjacentHTML('afterbegin', airportArrivalItem());
          timeline.querySelectorAll(':scope > li > .step').forEach((step,i)=>step.textContent=String(i+1).padStart(2,'0'));
        }
      }
      if(state.day===6) {
        const boarding=main.querySelector('.schedule-detail-body');
        if(boarding)boarding.insertAdjacentHTML('beforeend',majorTransitGuide('spacia'));
      }
    }
  }

  function flights() {
    const rail = $('.narita-combined-table').cloneNode(true);
    rail.querySelectorAll('tbody').forEach(body=>{ if(!body.classList.contains('group-'+state.group.toLowerCase())) body.remove(); });
    const wrap = document.createElement('div'); wrap.append(rail);
    return `<div class="eyebrow">MY FLIGHTS</div><h1>${state.group} 組航班與交通</h1><p class="intro">只顯示本組班機與機場接駁資訊。</p>${flightPanel(departures,'去程')}${flightPanel(returns,'回程')}<div class="note">11/29 預計 08:20 搭飯店接駁到成田 T2，前晚登記座位；免稅品攜出確認須在托運前完成。</div>${practicalDetail('narita-shuttle-fallback')}<h2 class="section-label">成田 → 本所吾妻橋</h2><div class="document">${readable(wrap)}${readable($('.narita-prev-fare-wrap'))}</div><div class="resource-links"><a href="./site-four/index.html">Skyliner 交通 ↗</a></div>`;
  }
  function stays() {
    const stay=STAY_INFO[state.stay], source=$('#'+stay.id);
    return `<div class="eyebrow">OUR STAYS</div><h1>${stay.label}住宿</h1><p class="intro">使用下方按鈕切換東京、日光與成田。</p><article class="stay-focus"><figure class="stay-cover"><img src="${stay.image}" alt="${stay.alt}" fetchpriority="high"><figcaption>${stay.alt}</figcaption></figure><div class="document stay-document">${readable(source,{omitTitle:true})}</div></article>${state.stay==='nikko'?practicalDetail('nikko-luggage-info'):state.stay==='narita'?practicalDetail('narita-shuttle-fallback'):''}`;
  }
  function moneyView() {
    return `<div class="eyebrow">TRIP EXPENSES</div><h1>旅費分帳</h1><p class="intro">選付款者與分擔者，填入金額；日圓按每筆匯率換算台幣。紀錄可在「全部項目」編輯，需要結算時再按計算。</p><div class="money-app"></div>`;
  }
  function bookingNavigation() {
    const days=[{day:1,date:'11/21',label:'鳥貴族'},{day:5,date:'11/25',label:'淺草午餐'},{day:6,date:'11/26',label:'SPACIA X'},{day:8,date:'11/28',label:'日光接送'}];
    return `<nav class="day-rail booking-rail" aria-label="選擇已預約日期">${days.map(item=>`<button class="day-button" type="button" data-booking-day="${item.day}" aria-label="${item.date} ${item.label}" aria-pressed="${item.day===state.bookingDay}"><span>DAY ${String(item.day).padStart(2,'0')}</span><b>${item.date.slice(3)}</b><small>${item.label}</small></button>`).join('')}</nav>`;
  }
  function bookings() {
    const content=state.bookingDay===1?`${bookedSkyliner()}<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 01 · 11/21（六）</span><span class="booking-status">已訂位</span></div><h2>鳥貴族 淺草店</h2><div class="booking-facts"><div><span>時間</span><strong>21:30</strong></div><div><span>人數</span><strong>5 位成人</strong></div><div><span>同行</span><strong>A＋B 組</strong></div><div><span>訂位姓名</span><strong>請見私人訂位信</strong></div></div><p>訂位已確認。A 組可先憑私人訂位信上的姓名報到入座；B 組抵達後加入。若 B 組交通延誤，請盡早通知店家。</p><a href="https://maps.app.goo.gl/EvEaCawMVivVVJDC9" target="_blank" rel="noopener noreferrer">開啟鳥貴族淺草店地圖 ↗</a></article>`
      :state.bookingDay===5?`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 05 · 11/25（三）</span><span class="booking-status">已訂位 · 共 5 人</span></div><h2>牛たんの檸檬 淺草店</h2><div class="booking-facts"><div><span>時間</span><strong>12:00</strong></div><div><span>預約一</span><strong>3 人</strong></div><div><span>預約二</span><strong>2 人</strong></div></div><div class="booking-codes"><div><span>3 人訂位代碼</span><strong>請見私人訂位信</strong><small>訂位姓名：請見私人訂位信</small></div><div><span>2 人訂位代碼</span><strong>請見私人訂位信</strong><small>訂位姓名：請見私人訂位信</small></div></div><p>兩筆各停留 1 小時，分別報上代碼；能否安排相鄰座位依店家現場為準。3 人訂位為禁菸桌；2 人訂位未指定座位。</p><a href="https://maps.app.goo.gl/K4QdwtcbFczYAsTPA" target="_blank" rel="noopener noreferrer">開啟淺草店地圖 ↗</a></article>`
      :state.bookingDay===6?`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 06 · 11/26（四）</span><span class="booking-status">已訂妥 · 7 位成人</span></div><h2>SPACIA X 003｜豪華座位</h2><div class="booking-facts"><div><span>淺草出發（日本時間）</span><strong>09:00</strong></div><div><span>東武日光抵達</span><strong>10:50</strong></div><div><span>席種</span><strong>Premium seat</strong></div></div>${majorTransitGuide('spacia',true)}</article>`
      :`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 08 · 11/28（六）</span><span class="booking-status">已訂妥 · 已付款</span></div><h2>關東專車接送｜日光民宿 → Richmond Hotel Narita</h2><div class="booking-facts"><div><span>上車時間（日本時間）</span><strong>08:00</strong></div><div><span>人數</span><strong>7 位成人</strong></div><div><span>車輛</span><strong>Toyota Hiace 10 人座 × 1</strong></div></div><div class="booking-followup"><strong>上車地點</strong><p>1-chōme-687-1 Inarimachi, Nikko, Tochigi 321-1411</p><strong>下車地點</strong><p>Richmond Hotel Narita</p><p>憑證註明：乘客需備妥護照與憑證；上車前請主動聯絡司機確認等候位置。司機資訊預計前一天透過 WeChat／WhatsApp 提供，請允許好友邀請。</p><p>出發前將原始接送憑證 PDF 存到手機，搭車時出示。</p><div class="action-row"><a href="./assets/nikko-narita-transfer-voucher-2026-11-28.pdf" target="_blank" rel="noopener noreferrer">開啟關東專車接送憑證 PDF ↗</a><a href="./assets/nikko-narita-transfer-voucher-2026-11-28.pdf" download="nikko-narita-transfer-voucher-2026-11-28.pdf">下載原始憑證</a></div></div><div class="booking-followup"><strong>11/29 飯店機場接駁</strong><p>全團 7 人預計搭 08:20 班次，約 08:40 抵達成田 T2；此為飯店接駁，尚未登記。11/28 入住後立即替 7 人登記並確認集合位置。08:15 前上車，沒有出發廣播；每人限 1 件行李箱，超額行李須先詢問飯店。</p><a href="https://www.jalan.net/yad399679/topics/entry0006705029.html" target="_blank" rel="noopener noreferrer">飯店接駁時刻表 ↗</a></div></article>`;
    return `<div class="eyebrow">CONFIRMED BOOKINGS</div><h1>已預約資料</h1><p class="intro">選日期查看訂位與接送。訂位姓名、代碼見私人訂位信；包車憑證在 11/28。</p>${bookingNavigation()}<div class="booking-content">${content}</div>${state.bookingDay===8?practicalDetail('narita-shuttle-fallback'):''}`;
  }
  function dayNavigation(lastDay = 9) {
    return `<nav class="day-rail" aria-label="選擇行程日期">${Array.from({length:lastDay+1-firstDay()},(_,i)=>i+firstDay()).map(n=>`<button class="day-button" type="button" data-day="${n}" aria-label="第 ${n} 天，11 月 ${20+n} 日" aria-pressed="${n===state.day}"><span>DAY ${String(n).padStart(2,'0')}</span><b>${20+n}</b><small>11月・${['六','日','一','二','三','四','五','六','日'][n-1]}</small></button>`).join('')}</nav>`;
  }
  function restaurants() {
    return `<div class="eyebrow">TOKYO FOOD GUIDE</div><h1>餐廳攻略</h1><p class="intro">按日期查看餐廳、餐點與候位資訊。</p>${dayNavigation(8)}<nav class="trip-quick-actions" aria-label="點餐輔助">${foodCardButton()}</nav><div class="supplement-root" data-supplement="restaurants"><section class="panel supplement-loading">餐廳資料載入中…</section></div>`;
  }
  function airportGuide(doc, baseUrl) {
    const zones={before:'安檢前 · 4F',after:'安檢後 · 3F',check:'店況待確認'};
    const cards=[...doc.querySelectorAll('#gifts .card')];
    const counts=key=>key==='all'?cards.length:cards.filter(card=>card.dataset.zone===key).length;
    const picks=[...doc.querySelectorAll('#priority .priority h3')].map(el=>`<span>${escape(el.textContent)}</span>`).join('');
    const navigation=`<nav class="airport-filters" aria-label="依購買區域查看">${[['all','全部'],['before','安檢前'],['after','安檢後'],['check','待確認']].map(([key,label])=>`<button type="button" data-airport-zone="${key}" aria-pressed="${key==='all'}">${label}<small>${counts(key)}</small></button>`).join('')}</nav>`;
    const list=cards.map((card,index)=>{
      const title=card.querySelector('.card-title')?.textContent||'';
      const subtitle=card.querySelector('.jp')?.textContent||'';
      const zone=card.dataset.zone||'check';
      const photo=card.querySelector('img');
      const image=photo?cleanRemote(photo.cloneNode(true),baseUrl).outerHTML:'';
      const rows=[...card.querySelectorAll('.meta-row')];
      const location=rows.find(row=>/位置/.test(row.querySelector('b')?.textContent||''));
      const locationText=location?.querySelector('span')?.textContent||'店鋪與庫存請現場確認';
      const facts=rows.filter(row=>row!==location).map(row=>`<div><dt>${escape(row.querySelector('b')?.textContent||'資訊')}</dt><dd>${escape(row.querySelector('span')?.textContent||'')}</dd></div>`).join('');
      const note=card.querySelector('.status-note')?.textContent;
      return `<article class="airport-product" data-airport-card="${escape(zone)}"><div class="airport-product-top"><figure>${image}</figure><div class="airport-product-title"><span class="airport-zone airport-zone-${escape(zone)}">${zones[zone]||zones.check}</span><h2>${escape(title)}</h2><p>${escape(subtitle)}</p></div></div><p class="airport-location">${icon('pin')}<span>${escape(locationText)}</span></p><details class="airport-product-detail"><summary>口味・價格與購買提醒</summary><div class="airport-product-copy"><p>${escape(card.querySelector('.taste')?.textContent||'')}</p><dl>${facts}</dl>${note?`<p class="airport-product-note">${escape(note)}</p>`:''}</div></details></article>`;
    }).join('');
    const steps=[...doc.querySelectorAll('#route .timeline-item')].map(step=>`<li><span>${escape(step.querySelector('.timeline-time')?.textContent||'')}</span><div><strong>${escape(step.querySelector('strong')?.textContent||'')}</strong><p>${escape(step.querySelector('p')?.textContent||'')}</p></div></li>`).join('');
    const tips=[...doc.querySelectorAll('#route .tips li')].map(tip=>`<li>${escape(tip.textContent)}</li>`).join('');
    return `<section class="airport-reading-guide"><div class="airport-wayfinding"><div><b>01</b><span>4F 安檢前<small>先買專店與 ANA FESTA</small></span></div><span aria-hidden="true">→</span><div><b>02</b><span>安檢・出境<small>通關時間另外預留</small></span></div><span aria-hidden="true">→</span><div><b>03</b><span>3F 安檢後<small>Fa-So-La 免稅伴手禮</small></span></div></div><details class="airport-shortlist"><summary>5 款伴手禮參考</summary><div>${picks}</div></details>${navigation}<p class="airport-results" role="status">共 ${cards.length} 款推薦</p><div class="airport-products">${list}</div><details class="airport-shopping-plan"><summary>購物順序與注意事項</summary><div class="airport-plan-copy"><h2>採買約 45–60 分鐘，通關另計</h2><ol class="airport-route">${steps}</ol><h2>購買注意事項</h2><ul>${tips}</ul></div></details></section>`;
  }
  function airport() {
    return `<div class="eyebrow">NARITA AIRPORT SHOPPING</div><h1>機場購物</h1><p class="intro">成田 T2 伴手禮、店家位置與購物順序。</p><div class="supplement-root airport-shopping" data-supplement="airport"><section class="panel supplement-loading">正在載入機場購物推薦…</section></div>`;
  }
  function guide() {
    const sections = [
      ['推薦交通票券',['tokyo-subway-pass-info','nikko-bus-pass-info']],
      ['交通與寄物',['nikko-luggage-info','narita-shuttle-fallback']],
      ['行前準備',['packing-list-1','packing-list-2']],
      ['日本國內寄件',['japan-post-domestic-1']]
    ];
    return `<div class="eyebrow">TRAVEL NOTES</div><h1>旅行資料</h1><p class="intro">交通票券、入出境、退稅、行李與寄件。</p><nav class="resource-links" aria-label="機場與交通資料"><a href="./airport-guide/index.html">成田機場入境・退稅・出境 ↗</a><a href="./site-two/index.html">日光巴士 ↗</a></nav><nav class="trip-quick-actions" aria-label="點餐輔助">${foodCardButton()}</nav>${sections.map(([title,ids])=>`<h2 class="section-label">${title}</h2>${ids.map(id=>detail($('#'+id).querySelector('h2').textContent,$('#'+id),id)).join('')}`).join('')}`;
  }
  const couponItems = {
    "bic": {
      "short": "Bic Camera",
      "name": "BicCamera／Kojima",
      "category": "家電・藥妝",
      "image": "./assets/coupons/bic.png",
      "alt": "BicCamera／Kojima 優惠券原始券面",
      "headline": "家電 7%・日用品 5%・清酒 3% OFF",
      "expiry": "至 2027/04/30",
      "where": "DAY 2｜新宿 Bic Camera",
      "body": "券面含兩個條碼；不同商品類別適用不同折扣，另依資格辦理退稅。",
      "caution": "付款前出示護照及兩個條碼；部分商品不適用。",
      "url": "https://livejapan.com/en/article-a0006089/?sc_lid=lj_pc_article_new_frame_4",
      "link": "LIVE JAPAN 優惠券與退稅說明 ↗",
      "conditions": [
        [
          "折扣",
          "日用品、藥品、化妝品、食品 5%；家電、3C 7%；日本清酒 3%（獺祭、八海山除外）；免稅同店同日未稅消費滿 ¥5,000。"
        ],
        [
          "使用",
          "付款前出示護照及券面兩個條碼；免稅依資格辦理。"
        ],
        [
          "限制",
          "部分商品排除且不可與其他折扣併用；券面標示退稅費用 ¥0。"
        ]
      ]
    },
    "alpen": {
      "short": "Alpen",
      "name": "Alpen／SPORTS DEPO／GOLF5",
      "category": "運動・戶外",
      "image": "./assets/coupons/alpen.png",
      "alt": "Alpen／SPORTS DEPO／GOLF5 優惠券原始券面",
      "headline": "參與免稅門市指定商品 5% OFF",
      "expiry": "券面未標示效期",
      "where": "DAY 2｜新宿 Alpen TOKYO",
      "body": "券面列 Alpen TOKYO、福岡、名古屋及全國免稅店。",
      "caution": "免稅購物含稅 ¥5,500 起；部分商品除外、不能併用。",
      "url": "https://store.alpen-group.jp/alpentokyo/CSfTokyoTop.jsp",
      "link": "Alpen TOKYO 官方店舖 ↗",
      "conditions": [
        [
          "折扣",
          "指定商品 5% OFF。"
        ],
        [
          "使用",
          "免稅購物含稅 ¥5,500 起，結帳前出示券面。"
        ],
        [
          "限制",
          "部分商品不適用，免稅資格以門市核對為準。"
        ]
      ]
    },
    "donki": {
      "short": "唐吉訶德",
      "name": "Don Quijote",
      "category": "折扣店・免稅",
      "image": "./assets/coupons/donki.png",
      "imageOpensCoupon": true,
      "liveNote": "點圖開啟即時券。結帳時須連網操作，截圖無效。",
      "headline": "免稅交易滿額享最高 5% 或 7% 折扣",
      "expiry": "券面未標日期；結帳前確認",
      "where": "新宿／澀谷購物區；分店與商品先核對",
      "body": "11 月適用含稅門檻。滿 ¥11,000 最高折 5%，滿 ¥33,000 最高折 7%。含減輕稅率商品時，門檻可能不同。",
      "caution": "酒、菸、POSA 卡、遊戲主機及單件未稅 ¥100,000 以上等商品除外。每筆免稅交易限用一次。",
      "url": "https://livejapan.com/public/operation/coupon/donki/zh-tw.html",
      "link": "開啟唐吉訶德即時領券頁 ↗",
      "conditions": [
        [
          "折扣級距",
          "符合門檻的商品享 5% 或 7% 優惠，消費稅另依旅客資格辦理退稅。"
        ],
        [
          "使用",
          "在領券頁點橫幅，依消費額選券，出示護照與手機條碼。店員掃碼後再按 Next 並確認，掃完商品後出示第二次條碼。"
        ],
        [
          "限制",
          "限參與門市。付款前出示，不可與其他折扣或 majica 卡併用。"
        ]
      ],
      "alt": "唐吉訶德折扣級距說明圖，點圖開啟即時券"
    },
    "matsukiyo": {
      "short": "松本清",
      "name": "松本清 Matsumoto Kiyoshi",
      "category": "藥妝・美容",
      "image": "./assets/coupons/matsukiyo.png",
      "alt": "松本清 Matsumoto Kiyoshi 優惠券原始券面",
      "headline": "滿 ¥10,000 起 3%／5%／7% OFF",
      "expiry": "至 2027/03/31，限在日本停留期間使用，活動可能提前結束",
      "where": "東京藥妝店；指定商品、門市結帳前確認",
      "body": "¥10,000–29,999：3%；¥30,000–49,999：5%；¥50,000 以上：7%。",
      "caution": "專櫃化妝品、菸、雜誌、嬰兒尿布及嬰兒食品等除外。部分門市不適用。",
      "url": "https://www.matsukiyococokara-online.com/",
      "link": "松本清官方網站 ↗",
      "conditions": [
        [
          "優惠級距",
          "¥10,000–29,999：3%；¥30,000–49,999：5%；¥50,000 以上：7%。"
        ],
        [
          "限制",
          "不能與其他折扣併用。部分 Outlet 等門市不收此券。"
        ],
        [
          "使用",
          "日本停留期間有效；結帳前出示券面。"
        ]
      ]
    },
    "cocokara": {
      "short": "CocokaraFine",
      "name": "CocokaraFine",
      "category": "藥妝・免稅",
      "image": "./assets/coupons/cocokara.png",
      "alt": "CocokaraFine 優惠券原始券面",
      "headline": "滿額 3%／5%／7% OFF",
      "expiry": "至 2027/03/31",
      "where": "新宿購物可先詢問參與免稅門市",
      "body": "未稅滿 ¥10,000 折 3%，滿 ¥30,000 折 5%，滿 ¥50,000 且未達 ¥500,000 折 7%。",
      "caution": "限免稅購物；指定商品排除、不可併券。",
      "url": "https://www.matsukiyococokara-online.com/",
      "link": "官方網站 ↗",
      "conditions": [
        [
          "折扣級距",
          "3%、5%、7% 依單筆未稅購物額計算，最高級距到 ¥499,999。"
        ],
        [
          "適用門市",
          "僅限參與的日本免稅店。券面銀座四丁目、新宿三丁目等門市照片供辨識，結帳前先問店員。"
        ],
        [
          "限制",
          "限免稅交易，部分化妝品、菸品、雜誌、POSA 等除外。"
        ]
      ]
    },
    "sundrug": {
      "short": "SUNDRUG",
      "name": "SUNDRUG 尚都樂客",
      "category": "藥妝・免稅",
      "image": "./assets/coupons/sundrug.png",
      "alt": "SUNDRUG 尚都樂客 優惠券原始券面",
      "headline": "未稅滿額 3%／5%／7% OFF",
      "expiry": "券面未標示效期",
      "where": "DAY 2｜新宿周邊；先核對券面指定店",
      "body": "未稅 ¥10,000–29,999：3%；¥30,000–49,999：5%；¥50,000 以上：7%。",
      "caution": "部分商品除外且不可併用；門檻按券面。",
      "url": "https://www.sundrug.co.jp/",
      "link": "SUNDRUG 官方網站 ↗",
      "conditions": [
        [
          "折扣級距",
          "未稅 ¥10,000–29,999：3%；¥30,000–49,999：5%；¥50,000 以上：7%。"
        ],
        [
          "限制",
          "部分商品排除，不能與其他優惠券併用。"
        ],
        [
          "使用",
          "結帳前出示券面，免稅依門市規定。"
        ]
      ]
    },
    "sugi": {
      "short": "杉藥局",
      "name": "SUGI 杉藥局",
      "category": "藥妝・免稅",
      "image": "./assets/coupons/sugi.png",
      "alt": "SUGI 杉藥局 優惠券原始券面",
      "headline": "指定商品滿額折 4%、6% 或 8%",
      "expiry": "至 2027/02/28",
      "where": "東京行程未指定分店，逛到參與門市可用",
      "body": "購物滿 ¥10,000 折 4%，滿 ¥30,000 折 6%，滿 ¥50,000 折 8%。",
      "caution": "部分品項排除，折扣不可與其他券併用；退稅依資格辦理。",
      "url": "https://www.sugi-net.jp/",
      "link": "杉藥局官方網站 ↗",
      "conditions": [
        [
          "優惠級距",
          "券面大字的 14%、16%、18% 已包含最高 10% 的稅額宣傳。商品按上列折扣，實際退稅依合資格金額計算。"
        ],
        [
          "門檻",
          "限符合免稅資格的交易，付款前出示相應級距的條碼。"
        ],
        [
          "限制",
          "處方藥、專櫃化妝品、食品、POSA 卡等除外。同一商品不可疊加折扣。"
        ]
      ]
    },
    "yam": {
      "short": "YAMADA",
      "name": "YAMADA 山田電機",
      "category": "家電・免稅",
      "image": "./assets/coupons/yam.png",
      "alt": "YAMADA 山田電機 優惠券原始券面",
      "headline": "指定商品 7% OFF＋退稅",
      "expiry": "至 2027/03/31",
      "where": "行程未指定山田電機門市",
      "body": "免稅未稅金額達 ¥5,000 可使用；食品退稅按券面。",
      "caution": "Apple、遊戲機、二手品及指定商品除外，不可與其他優惠併用。",
      "url": "https://www.yamada-denki.jp/",
      "link": "YAMADA 官方網站 ↗",
      "conditions": [
        [
          "優惠",
          "指定商品 7% OFF。"
        ],
        [
          "使用",
          "結帳前出示券面；免稅商品未稅購買額 ¥5,000 起；食品稅率依券面以 8% 計算。"
        ],
        [
          "限制",
          "Apple、遊戲機、二手品、部分 Dyson／Panasonic 等商品不適用。"
        ]
      ]
    },
    "laox": {
      "short": "LAOX",
      "name": "LAOX",
      "category": "免稅・折扣",
      "image": "./assets/coupons/laox.png",
      "alt": "LAOX 優惠券原始券面",
      "headline": "8% OFF＋免稅",
      "expiry": "至 2026/12/31",
      "where": "指定 LAOX 門市，行程店址先確認",
      "body": "指定門市消費滿 ¥5,000，結帳前出示護照與券面。",
      "caution": "遊戲、Apple、名牌包／錶、藥品、特價品等除外；不可併用。",
      "url": "https://www.laox.co.jp/en/",
      "link": "LAOX 官方網站 ↗",
      "conditions": [
        [
          "優惠",
          "指定商品 8% OFF，並依資格退稅。"
        ],
        [
          "使用",
          "指定門市滿 ¥5,000，付款前出示券面及護照。"
        ],
        [
          "限制",
          "部分電子產品、精品、藥品、特價品等除外。"
        ]
      ]
    },
    "odakyu": {
      "short": "小田急",
      "name": "小田急百貨 新宿店",
      "category": "百貨／服飾",
      "image": "https://highway-buses.jp/chi/images/coupon/odakyu_01.png",
      "alt": "小田急百貨新宿店京王電鐵巴士合作優惠券完整券面",
      "headline": "指定商品單價含稅 ¥1,000 起折 6%",
      "expiry": "有效至 2028/3/31",
      "where": "DAY 2｜新宿購物備用",
      "body": "新增新宿小田急百貨旅客券；購買服飾等適用商品時可比較使用，不因此增加購物站。",
      "caution": "食品、餐廳、咖啡店不適用；同棟 Bic Camera 也不能使用這張百貨券。",
      "url": "https://highway-buses.jp/chi/coupon/04",
      "link": "開啟小田急百貨完整券面與條件 ↗",
      "conditions": [
        [
          "折扣與門檻",
          "以適用商品的含稅單價計算，每件 ¥1,000 起折 6%。"
        ],
        [
          "資格與門市",
          "非日本居民的外國旅客，持本人護照於小田急百貨新宿店適用櫃位使用。"
        ],
        [
          "如何使用",
          "付款前出示這張券與本人護照；店員確認商品適用後折扣。"
        ],
        [
          "不適用商品",
          "食品、特價品、餐廳／咖啡店及指定品牌與商品等；不能在 Bic Camera 使用。"
        ],
        [
          "併用與付款",
          "不可併用其他優惠。券面列明可用現金、信用卡、銀聯卡、Alipay、WeChat Pay；各櫃支援方式仍請確認。"
        ]
      ]
    },
    "aeon": {
      "short": "AEON",
      "name": "AEON MALL 成田",
      "category": "購物中心",
      "image": null,
      "liveNote": "這是服務台兌換券。請開啟官方頁面的 QR 碼到館內服務台兌換，取得購物券後再到適用店舖結帳。",
      "headline": "含稅滿 ¥5,500：¥500 購物券",
      "expiry": "官方常設頁・未明示截止日",
      "where": "DAY 8｜11/28 AEON MALL 成田",
      "body": "成田館在官方適用名單內。抵達購物中心後先到服務台，依現場供應兌換購物券或贈品。",
      "caution": "QR 碼不是可直接結帳的 ¥500 折價券。沒有公布固定活動截止日；11/28 能否領券、剩餘數量與領到的券效期，仍須現場確認。",
      "url": "https://tw.aeonmall.global/coupons/discount?couponid=22&mall=mall09",
      "link": "開啟 AEON 官方兌換 QR 碼與條件 ↗",
      "conditions": [
        [
          "折扣與門檻",
          "兌換 ¥500 購物券後，於適用店舖單次購物含稅滿 ¥5,500 使用；不能當作全館或超市通用現金。"
        ],
        [
          "資格與門市",
          "僅限外國旅客；本行程使用 AEON MALL 成田館，部分品牌／店舖不適用。"
        ],
        [
          "如何使用",
          "開啟官方 QR 碼 → 館內服務台兌換 → 確認實體券適用店、效期與門檻 → 付款前出示兌換取得的購物券。"
        ],
        [
          "次數與贈品",
          "購物券每人每日一次；贈品每人一次、送完為止。可領內容依現場供應，未必能自行選擇。"
        ],
        [
          "併用與限制",
          "不可與其他券併用；影印或列印無效。付款方式及不適用品牌依兌換券和店舖規定。"
        ]
      ]
    },
    "edion": {
      "short": "EDION",
      "name": "EDION 愛電王",
      "category": "家電・藥妝",
      "headline": "家電 7% 或食品藥妝 5% OFF",
      "expiry": "至 2027/12/31",
      "where": "東京行程未指定 EDION 門市",
      "body": "家電、相機、手錶等 7%；食品、藥品、化妝品等 5%。",
      "caution": "部分商品排除；需出示券面並符合免稅資格。",
      "url": "https://www.edion.com/",
      "link": "EDION 官方網站 ↗",
      "conditions": [
        [
          "折扣",
          "指定家電類 7%；指定食品、藥品、化妝品類 5%。"
        ],
        [
          "使用",
          "付款前出示券面與護照，請店員掃描兩組條碼；免稅商品同店單日未稅滿 ¥5,000。"
        ],
        [
          "限制",
          "部分商品、門市及品類不適用；免稅門檻依現場。"
        ]
      ],
      "image": "./assets/coupons/edion.png",
      "alt": "EDION 愛電王 優惠券原始券面"
    },
    "tsuruha": {
      "short": "鶴羽藥妝",
      "name": "鶴羽藥妝 Tsuruha Drug",
      "category": "藥妝・免稅",
      "headline": "滿額 3%／5%／7% OFF＋免稅",
      "expiry": "券面未標效期",
      "where": "東京行程未指定分店",
      "body": "含稅 ¥10,000／30,000／50,000 起分級折扣。",
      "caution": "指定商品除外，不可與其他券併用。",
      "url": "https://www.tsuruha.co.jp/",
      "link": "鶴羽官方網站 ↗",
      "conditions": [
        [
          "折扣級距",
          "含稅 ¥10,000–29,999：3%；¥30,000–49,999：5%；¥50,000 以上：7%。"
        ],
        [
          "限制",
          "部分化妝品、菸品、嬰兒用品等排除；不可併用。"
        ],
        [
          "使用",
          "結帳前出示券面，免稅依現行資格辦理。"
        ]
      ],
      "image": "./assets/coupons/tsuruha.png",
      "alt": "鶴羽藥妝 Tsuruha Drug 優惠券原始券面"
    },
    "sapporo": {
      "short": "札幌藥妝",
      "name": "札幌藥妝 Satudora",
      "category": "藥妝・免稅",
      "headline": "指定商品折 5%，未稅滿 ¥38,888 折 7%",
      "expiry": "日期未列",
      "where": "券面指定門市以北海道為主；東京路線無已核實分店",
      "body": "先核對免稅門市。付款前出示護照與對應條碼，5% 與 7% 擇一使用。",
      "caution": "指定店舖和效期需先核對；暫列備查。",
      "url": "https://satudora.jp/",
      "link": "札幌藥妝官方網站 ↗",
      "conditions": [
        [
          "優惠",
          "一般級距折 5%，未稅購物額達 ¥38,888 可用 7% 條碼。"
        ],
        [
          "店舖",
          "限券面指定店，東京行程未核實到合用分店。"
        ],
        [
          "限制",
          "活動及商品排除依券面與門市規定。"
        ]
      ],
      "image": "./assets/coupons/sapporo.png",
      "alt": "札幌藥妝 Satudora 優惠券原始券面"
    },
    "seibu": {
      "short": "西武・SOGO",
      "name": "西武・SOGO 百貨",
      "category": "百貨・免稅",
      "headline": "滿 ¥1,000 未稅 95 折＋免稅",
      "expiry": "至 2027/12/31",
      "where": "指定分店；本行程未經池袋西武",
      "body": "訪日旅客於券面列出分店使用。",
      "caution": "食品、餐飲、精品等部分排除，不可與其他折扣併用。",
      "url": "https://www.sogo-seibu.jp/",
      "link": "西武・SOGO 官網 ↗",
      "conditions": [
        [
          "優惠",
          "單筆未稅 ¥1,000 起 95 折。"
        ],
        [
          "門市",
          "西武池袋／福井；SOGO 橫濱、千葉、廣島、大宮。"
        ],
        [
          "限制",
          "食品、餐廳咖啡廳、禮券、菸品與指定精品等除外。"
        ]
      ],
      "image": "./assets/coupons/seibu.png",
      "alt": "西武・SOGO 百貨 優惠券原始券面"
    },
    "daimaru": {
      "short": "大丸・松坂屋",
      "name": "大丸・松坂屋百貨",
      "category": "百貨・退稅",
      "headline": "退稅＋5% OFF＋美食券",
      "expiry": "至 2027/08/31",
      "where": "指定大丸／松坂屋銷售樓層；東京可留意大丸店",
      "body": "券面說明訪日外國旅客使用，期間內可重複使用。",
      "caution": "食品、餐廳及咖啡廳除外；出示護照。",
      "url": "https://www.daimaru.co.jp/tokyo/",
      "link": "大丸東京官方網站 ↗",
      "conditions": [
        [
          "優惠",
          "5% OFF 並贈美食券；退稅依資格辦理。"
        ],
        [
          "使用",
          "券面指定銷售樓層；出示護照與優惠券。"
        ],
        [
          "限制",
          "食品、餐廳、咖啡廳除外。"
        ]
      ],
      "image": "./assets/coupons/daimaru.png",
      "alt": "大丸・松坂屋百貨 優惠券原始券面"
    },
    "cosmos": {
      "short": "COSMOS",
      "name": "COSMOS 科摩思藥妝",
      "category": "藥妝・免稅",
      "headline": "滿額 5%／7%／9% OFF＋免稅",
      "expiry": "至 2027/12/31",
      "where": "DAY 2｜新宿歌舞伎町一丁目店",
      "body": "未稅 ¥10,000–29,999：5%；¥30,000–49,999：7%；¥50,000 起：9%。",
      "caution": "免稅旅客限定、一天一次、不可併券。",
      "url": "https://www.cosmospc.co.jp/",
      "link": "COSMOS 官方網站 ↗",
      "conditions": [
        [
          "折扣級距",
          "未稅 ¥10,000–29,999：5%；¥30,000–49,999：7%；¥50,000 以上：9%。"
        ],
        [
          "限制",
          "指定分店限定、一天一次、不能與其他券併用。"
        ],
        [
          "店舖",
          "限歌舞伎町一丁目、廣尾站、道頓堀及天神大丸前四店。酒類除外。"
        ]
      ],
      "image": "./assets/coupons/cosmos.png",
      "alt": "COSMOS 科摩思藥妝 優惠券原始券面"
    },
    "shinseido": {
      "short": "新生堂",
      "name": "新生堂藥妝",
      "category": "藥妝・免稅",
      "headline": "指定商品 5% OFF",
      "expiry": "至 2026/12/31",
      "where": "福岡／九州指定門市；東京行程不適用",
      "body": "券面列藥院、天神南、百道濱、五條等門市。",
      "caution": "免稅未稅單筆 ¥5,000 門檻；部分商品除外。",
      "url": "https://sinseido-co.jp/",
      "link": "新生堂官方網站 ↗",
      "conditions": [
        [
          "優惠",
          "券面指定商品 5% OFF。"
        ],
        [
          "門市",
          "福岡、九州券面所列門市，不在本次路線。"
        ],
        [
          "退稅",
          "未稅 ¥5,000 起且符合免稅資格。"
        ]
      ],
      "image": "./assets/coupons/shinseido.png",
      "alt": "新生堂藥妝 優惠券原始券面"
    },
    "tobu": {
      "short": "東武百貨",
      "name": "TOBU 池袋店",
      "category": "百貨・免稅",
      "headline": "先到 2F 換券，指定商品折 5%",
      "expiry": "至 2027/09/30",
      "where": "池袋東武；本行程未安排池袋",
      "body": "本人帶護照與這張兌換券，到 2F 1 號區旅客服務處領取購物優惠券，每人一張。",
      "caution": "食品、特價品等排除，不可併用其他券。",
      "url": "https://livejapan.com/public/operation/coupon/tobudepartmentstore/zh-tw.html",
      "link": "查看池袋東武兌換地點與用券條件 ↗",
      "conditions": [
        [
          "優惠",
          "5% OFF，退稅依實際稅率。"
        ],
        [
          "條件",
          "短期停留旅客可領券，適用商品單件未稅 ¥1,000 起。限日圓現金、銀聯卡、Alipay+ 或微信支付。"
        ],
        [
          "限制",
          "食品、特價品、部分指定商品除外。"
        ]
      ],
      "image": "./assets/coupons/tobu.png",
      "alt": "TOBU 池袋店 優惠券原始券面"
    },
    "kintetsu": {
      "short": "近鐵百貨",
      "name": "近鐵百貨",
      "category": "百貨・免稅",
      "headline": "未稅 ¥2,000 起 95 折",
      "expiry": "至 2026/12/31",
      "where": "近鐵指定門市；本次東京行程無分店",
      "body": "付款時出示優惠券。",
      "caution": "食品、特價品、餐廳咖啡店及指定商品除外。",
      "url": "https://www.d-kintetsu.co.jp/",
      "link": "近鐵百貨官網 ↗",
      "conditions": [
        [
          "優惠",
          "單筆未稅 ¥2,000 起享 95 折。"
        ],
        [
          "門市",
          "海闊天空、和歌山、奈良、生駒、上本町、橿原、四日市、草津等。"
        ],
        [
          "限制",
          "食品、餐廳咖啡廳、特價品及指定商品除外。"
        ]
      ],
      "image": "./assets/coupons/kintetsu.png",
      "alt": "近鐵百貨 優惠券原始券面"
    },
    "narita-dutyfree": {
      "short": "成田免稅店",
      "name": "JAPAN DUTY FREE 成田",
      "category": "機場免稅店",
      "headline": "指定商品折 5%，菸酒也適用",
      "expiry": "至 2027/03/31",
      "where": "DAY 9｜成田 T2 本館 3F，國際線安檢後的 JAPAN DUTY FREE",
      "body": "限 JAPAN DUTY FREE 店舖。購買適用商品時可折 5%，加熱式菸品除外。",
      "caution": "部分商品不折扣，且不可與其他優惠券併用。",
      "url": "https://duty-free-japan.jp/narita/jp/",
      "link": "JAPAN DUTY FREE 官網 ↗",
      "conditions": [
        [
          "折扣",
          "適用商品折 5%，包含菸酒，加熱式菸品及其他指定商品除外。"
        ],
        [
          "使用",
          "到指定 JAPAN DUTY FREE 店舖，在付款前出示券面條碼。"
        ],
        [
          "限制",
          "部分商品除外，不能與其他優惠券併用。"
        ]
      ],
      "image": "./assets/coupons/narita-dutyfree.png",
      "alt": "JAPAN DUTY FREE 成田 優惠券原始券面"
    },
    "sundrug-shinjuku-online": {
      "short": "SUNDRUG新宿線上券",
      "name": "SUNDRUG 新宿中央東口店（網路券）",
      "category": "網路補充・新宿限定",
      "headline": "指定免稅交易 7% OFF",
      "expiry": "至 2026/12/31",
      "where": "DAY 2｜新宿中央東口店，步行約 2 分",
      "body": "網路券頁列指定 Sundrug 新宿中央東口店。",
      "caution": "部分商品不適用且不可併券；和級距券是兩張獨立券。",
      "url": "https://www.taxfreeshops.jp/en/shop/900000487/coupon/470",
      "link": "開啟網路券與店址 ↗",
      "conditions": [
        [
          "折扣",
          "指定免稅交易 7% OFF。"
        ],
        [
          "效期",
          "來源券頁列至 2026/12/31。"
        ],
        [
          "限制",
          "限指定店及適用免稅交易，Direx 不適用，不可與其他券併用。"
        ]
      ],
      "liveNote": "網路查到的指定店舖券。開啟來源券頁核對即時效期、店舖與使用資格。"
    },
    "donki-shinjuku-online": {
      "short": "唐吉訶德新宿券",
      "name": "Don Quijote 新宿店（網路券）",
      "category": "網路補充・新宿限定",
      "headline": "未稅 ¥10,000 起免稅交易 5% OFF",
      "expiry": "至 2026/12/31",
      "where": "新宿購物備用，限發券頁所列門市",
      "body": "付款前開啟發券頁，點頁內橫幅叫出折扣券，每筆符合條件的交易限用一次。",
      "caution": "酒、菸、POSA、遊戲機及高價商品等除外；不與你提供的券疊加。",
      "url": "https://www.taxfreeshops.jp/en/shop/1306/coupon/189",
      "link": "開啟網路券與條件 ↗",
      "conditions": [
        [
          "折扣",
          "免稅交易未稅 ¥10,000 以上 5% OFF，每筆限用一次。"
        ],
        [
          "效期",
          "來源券頁列至 2026/12/31。"
        ],
        [
          "限制",
          "酒、菸、POSA 卡、遊戲主機、未稅 ¥100,000 以上商品等除外。"
        ]
      ],
      "liveNote": "網路查到的指定店舖券。開啟來源券頁核對即時效期、店舖與使用資格。"
    },
    "daimaru-tokyo-online": {
      "short": "大丸東京網路券",
      "name": "大丸東京店（網路券）",
      "category": "網路補充・東京站",
      "headline": "免稅＋5% OFF",
      "expiry": "至 2026/12/31",
      "where": "東京站八重洲北口直結；行程經東京站時可用",
      "body": "網路券頁列訪日旅客憑護照使用，效期內可重複使用。",
      "caution": "這是店舖限定券，和你提供的大丸／松坂屋券不同。",
      "url": "https://www.taxfreeshops.jp/zhtw/shop/900001075/coupon/317",
      "link": "開啟大丸東京網路券 ↗",
      "conditions": [
        [
          "優惠",
          "來源券頁標示免稅＋5% OFF。"
        ],
        [
          "效期",
          "至 2026/12/31；訪日旅客適用。"
        ],
        [
          "使用",
          "出示護照與券面，效期內可重複使用。"
        ]
      ],
      "liveNote": "網路查到的指定店舖券。開啟來源券頁核對即時效期、店舖與使用資格。"
    },
    "alpen-tokyo-online": {
      "short": "AlpenTOKYO 網路券",
      "name": "AlpenTOKYO 新宿（網路券）",
      "category": "網路補充・新宿限定",
      "headline": "免稅＋5% OFF",
      "expiry": "來源店舖頁列 2027/06/30",
      "where": "DAY 2｜Alpen TOKYO 新宿，東口步行約 1 分",
      "body": "網路店舖資料另列 AlpenTOKYO 免稅＋5% 優惠；可能與你提供的券面是不同活動。",
      "caution": "此券頁是門市限定資訊，使用前開啟來源確認實際券面、商品限制及能否與紙本券併用。",
      "url": "https://www.taxfreeshops.jp/en/shop/900001262",
      "link": "查看 AlpenTOKYO 線上門市優惠 ↗",
      "liveNote": "網路店舖資料列免稅＋5% 優惠，至 2027/06/30。付款前請再確認券面及折扣是否與你提供的圖片券相同。",
      "conditions": [
        [
          "網路資料",
          "AlpenTOKYO 新宿門市資訊列免稅＋5% 優惠，效期至 2027/06/30。"
        ],
        [
          "使用",
          "僅適用指定新宿店；出示護照並按門市免稅流程結帳。"
        ],
        [
          "提醒",
          "可能是另一張活動券；不能假設可與圖片券疊加，商品及併用條件以現場為準。"
        ]
      ]
    }
  };
  function coupons() {
    const item=couponItems[state.coupon] || couponItems.bic;
    const note=item.liveNote ? `<p class="coupon-live-note">${escape(item.liveNote)}</p>` : '';
    const imageLabel=item.imageOpensCoupon ? item.link : `放大查看${item.name}完整優惠券`;
    const photo=item.image
      ? `<a class="coupon-image-link" href="${item.imageOpensCoupon ? item.url : item.image}" target="_blank" rel="noopener noreferrer" aria-label="${escape(imageLabel)}"><img class="coupon-art" src="${item.image}" alt="${escape(item.alt)}" loading="lazy" decoding="async"/></a>`
      : '';
    const visual=note+photo;
    return `<div class="eyebrow">TRIP SAVINGS</div><h1>旅行優惠券</h1><p class="intro">11/21–11/29 購物備查。選店家查看券面、適用分店與使用方式。</p><nav class="day-rail coupon-rail" aria-label="選擇優惠券">${Object.entries(couponItems).map(([key,value])=>`<button class="day-button" type="button" data-coupon="${key}" aria-pressed="${key===state.coupon}"><span>優惠券</span><b>${escape(value.short)}</b><small>${escape(value.category)}</small></button>`).join('')}</nav>
      <article class="panel coupon-card coupon-photo-card"><div class="coupon-top"><span class="pill">${escape(item.category)}｜${escape(item.name)}</span><span class="coupon-status">${escape(item.expiry)}</span></div><h2>${escape(item.headline)}</h2><p><strong>${escape(item.where)}</strong></p><p>${escape(item.body)}</p><div class="coupon-layout"><section class="coupon-visual" aria-label="完整優惠券">${visual}</section><section class="coupon-rules" aria-label="優惠券使用條件"><h3>使用條件</h3><dl>${item.conditions.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section></div><p class="coupon-caution">${escape(item.caution)}</p><a href="${item.url}" target="_blank" rel="noopener noreferrer">${escape(item.link)}</a></article>
      <details class="coupon-tax-note"><summary>11 月退稅與券面折扣如何看？</summary><p>2026/11/1 起，市區免稅購物先付含稅價格；出境時須在託運前、通過安檢前的一般區域完成海關確認，並於購買日起 90 日內攜出日本，確認後由店家或受託業者退款。免稅門檻為同店同日未稅滿 ¥5,000。食品、飲料、化妝品等消耗品若在日本境內使用或消耗，可能不符合退稅條件。券面若寫「10% 免稅＋折扣」，免稅退款與優惠券折扣分開計算，不能直接相加當成總折扣。<a href="https://www.mlit.go.jp/kankocho/tax-free/page01_000001_00028.html" target="_blank" rel="noopener noreferrer">觀光廳新制說明 ↗</a></p></details><p class="coupon-footnote">付款前出示護照與對應券面。先看適用門市、門檻與效期；未標效期的券，先請店員確認。</p>`;
  }
  
  function cleanRemote(node, baseUrl) {
    node.querySelectorAll('button.calendar-btn').forEach(button=>{
      const date=button.dataset.date||'', title=button.dataset.title||'旅行提醒', time=button.dataset.time||'';
      if(!date)return button.remove();
      const compact=date.replaceAll('-','');
      const nextDate=new Date(`${date}T00:00:00+08:00`);nextDate.setDate(nextDate.getDate()+1);
      const next=`${nextDate.getFullYear()}${String(nextDate.getMonth()+1).padStart(2,'0')}${String(nextDate.getDate()).padStart(2,'0')}`;
      const dates=time?`${compact}T${time.replace(':','')}00/${compact}T${String(Number(time.slice(0,2))+1).padStart(2,'0')}${time.slice(3)}00`:`${compact}/${next}`;
      const link=document.createElement('a');link.className='reserve-calendar';link.target='_blank';link.rel='noopener noreferrer';link.textContent='加入行事曆';
      link.href=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&ctz=Asia%2FTaipei`;
      button.replaceWith(link);
    });
    node.querySelectorAll('button.copy-btn[data-copy]').forEach(button=>{button.dataset.reserveCopy=button.dataset.copy;button.removeAttribute('data-copy');});
    node.querySelectorAll('script,style,nav,button:not(.copy-btn),form,.page-num,.screen-only,.filterbar,input:not(.task-check),textarea,select').forEach(el=>el.remove());
    node.querySelectorAll('table').forEach(table=>table.replaceWith(tableCards(table)));
    [node,...node.querySelectorAll('*')].forEach(el=>{
      if(el.tagName==='A') {
        const href=el.getAttribute('href');
        if(href?.startsWith('#') && baseUrl.pathname.includes('/site-one/')) {
          const url=new URL(location.href);url.hash='';url.searchParams.set('view','reserve');url.searchParams.set('section',href.slice(1));el.setAttribute('href',url.href);
        } else if(href && !href.startsWith('javascript:')) el.setAttribute('href',new URL(href,baseUrl).href);
        if(el.getAttribute('target')==='_blank') el.setAttribute('rel','noopener noreferrer');
      }
      if(el.tagName==='IMG') {
        const src=el.getAttribute('src');
        // Read only the known static fallback path; never execute inline code.
        const fallback=el.getAttribute('onerror')?.match(/this\.src\s*=\s*['"]([^'"]+)['"]/)?.[1];
        if(fallback) {
          const url=new URL(fallback,baseUrl);
          if(url.origin===baseUrl.origin)el.dataset.imageFallback=url.href;
        }
        // Keep the source page's no-referrer policy for external photo hosts.
        el.setAttribute('referrerpolicy','no-referrer');
        if(src) el.setAttribute('src',new URL(src,baseUrl).href);
        el.loading='lazy';el.decoding='async';
      }
      [...el.attributes].forEach(attr=>{
        if(!['href','src','alt','title','target','rel','colspan','rowspan','loading','decoding','referrerpolicy','data-image-fallback','class','id','type','checked','disabled','data-task','data-reserve-copy'].includes(attr.name))el.removeAttribute(attr.name);
      });
    });
    return node;
  }

  async function hydrateSupplement(kind) {
    const target=main.querySelector(`[data-supplement="${kind}"]`);
    if(!target)return;
    const selectedDay=state.day;
    const path=kind==='airport'?'./site-three/index.html':kind==='reserve'?'./site-one/index.html?v=20261003-daily-pass':'./restaurant-guide/index.html?v=20261003-daily-pass';
    const baseUrl=new URL(path,document.baseURI);
    try {
      const response=await fetch(baseUrl.href,{cache:'no-cache'});
      if(!response.ok)throw new Error('資料讀取失敗');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      if(!target.isConnected)return;
      target.innerHTML='';
      if(kind==='airport') {
        target.innerHTML=airportGuide(doc,baseUrl);
      } else if(kind==='reserve') {
        const wanted=new URL(location.href).searchParams.get('section');
        [...doc.querySelectorAll('section.page')].filter(section=>['timeline','tickets','restaurants'].includes(section.id)).forEach((section,index)=>{
          const content=(section.querySelector('.content')||section).cloneNode(true);
          const heading=content.querySelector('h2');

          if(section.id==='restaurants') {
            content.querySelectorAll('.restaurant-grid > article').forEach(card=>{
              const title=card.querySelector('h3')?.textContent||'';
              if(title.includes('鳥貴族')||title.includes('牛たんの檸檬'))card.remove();
            });
            if(heading)heading.textContent='尚待處理的餐廳安排';
          }
          const title=heading?.textContent.trim()||`行前資料 ${index+1}`;
          heading?.remove();
          cleanRemote(content,baseUrl);
          const details=document.createElement('details');
          details.className='supplement-section';details.id=`reserve-${section.id||index}`;details.open=index===0||wanted===section.id;
          details.innerHTML=`<summary>${escape(title)}</summary><div class="document supplement-document"></div>`;
          details.querySelector('.supplement-document').append(...content.childNodes);
          target.append(details);
        });
        let completed={};try{completed=JSON.parse(localStorage.getItem('tokyo-trip-2026.reserve-tasks')||'{}')||{};}catch{}
        target.querySelectorAll('.task[data-task]').forEach(task=>{const check=task.querySelector('.task-check');if(check)check.checked=Boolean(completed[task.dataset.task]);});
        target.addEventListener('change',event=>{
          const check=event.target.closest('.task-check');if(!check)return;const task=check.closest('.task[data-task]');if(!task)return;
          let saved={};try{saved=JSON.parse(localStorage.getItem('tokyo-trip-2026.reserve-tasks')||'{}')||{};}catch{}
          saved[task.dataset.task]=check.checked;localStorage.setItem('tokyo-trip-2026.reserve-tasks',JSON.stringify(saved));
        });
      } else {
        [...doc.querySelectorAll('section.day-section')].filter(section=>Number(section.dataset.daySection)===selectedDay).forEach((section,index)=>{
          const heading=section.querySelector('h2')?.textContent.trim()||`第 ${index+1} 天餐廳`;
          const details=document.createElement('details');details.className='supplement-section';details.open=true;
          details.innerHTML=`<summary>${escape(heading)}</summary><div class="supplement-grid"></div>`;
          const grid=details.querySelector('.supplement-grid');
          [...section.querySelectorAll('.cards > *')].forEach(card=>{
            const article=document.createElement('article');article.className='supplement-card';
            const clone=cleanRemote(card.cloneNode(true),baseUrl);article.append(clone);grid.append(article);
          });
          target.append(details);
        });
      }
      if(!target.children.length && kind==='restaurants') {
        target.innerHTML=`<section class="panel"><h2>第 ${selectedDay} 天餐廳攻略</h2><p>當天沒有餐廳資料。</p></section>`;
      }
      if(!target.children.length)throw new Error('找不到可顯示的資料');
    } catch(error) {
      target.innerHTML=`<section class="panel supplement-error"><h2>暫時無法載入</h2><p>${escape(error.message||'請稍後再試')}</p><a href="${baseUrl.href}">開啟原始資料頁 ↗</a></section>`;
    }
  }
  function statusText() {
    if (!navigator.onLine) return offlineReady ? '離線閱讀中 · 地圖與外部連結需連線' : '目前離線 · 本次顯示已載入的行程';
    if (offlineReady) return '行程已可離線閱讀 · 地圖與外部連結需連線';
    return offlineFailed ? '離線儲存未完成，請保持連線閱讀' : '正在準備離線行程，請保持連線…';
  }
  function revealActiveDay() {
    const active = main.querySelector('.day-button[aria-pressed=true]');
    if (!active) return;
    const rail = active.parentElement;
    rail.scrollLeft += active.getBoundingClientRect().left - rail.getBoundingClientRect().left - (rail.clientWidth - active.offsetWidth) / 2;
  }
  const wordModelPatches = [];
  function applyWordModel() {
    if(state.view==='days') {
      const mirror=main.cloneNode(true), live=new WeakMap();
      const pair=(a,b)=>{live.set(a,b);[...a.childNodes].forEach((c,i)=>pair(c,b.childNodes[i]));};
      pair(mirror,main);
      mirror.querySelectorAll('.schedule-detail-body').forEach(e=>e.removeAttribute('hidden'));
      mirror.querySelectorAll('.weather-section,.day-rail,.day-footer,.status,.journey-heading,.journey-intro,.step,.schedule-toggle-label,.route-select,script,style,[hidden],.money-app,h1').forEach(e=>e.remove());
      const norm=t=>t.replace(/\s+/g,'').replace(/^•/,'');
      const blocks=new Set('div section article main aside header footer figure ul ol dl details form fieldset p li h1 h2 h3 h4 table img dt dd summary figcaption address pre blockquote label button input select textarea'.split(' '));
      const pending=[],misses=[];
      for(const op of wordModelPatches) {
        if(state.view==='days' && [6,7].includes(state.day))continue;
        if(['WEB00155','WEB00156'].includes(op.id))continue;
        const day=Number(op.chapter.split('-')[2]);
        if(day!==state.day || (day===1 && state.group!=='A') || (day<=3 && state.group==='C'))continue;
        let node=mirror;const parts=op.locator.split('/').slice(1);const last=parts.at(-1);
        for(const part of parts.filter(x=>x!=='inline')) {
          const m=part.match(/^([^[]+)\[(\d+)\]$/);
          if(!m){node=null;break;}
          node=[...(node?.childNodes||[])].filter(e=>e.nodeType===1||e.nodeType===8)[Number(m[2])-1];
          if(!node || node.nodeName.toLowerCase()!==m[1]){node=null;break;}
        }
        let nodes=[];
        if(node && last==='inline') {
          let group=[];const groups=[];
          for(const child of node.childNodes){if(child.nodeType===1&&blocks.has(child.localName)){groups.push(group);group=[];}else group.push(child);}
          groups.push(group);nodes=groups.find(g=>norm(g.map(e=>e.textContent).join(''))===norm(op.old))||[];
        } else if(node && norm(node.textContent)===norm(op.old))nodes=[node];
        if(!nodes.length){if(!/\/section\[1\]\/div\[3\]\/inline$/.test(op.locator))misses.push(op.id);continue;}
        pending.push({op,nodes:nodes.map(e=>live.get(e)),inline:last==='inline'});
      }
      for(const {op,nodes,inline} of pending){
        if(op.html===null){nodes.forEach(e=>e?.remove());continue;}
        const template=document.createElement('template');template.innerHTML=op.html;
        const anchors=nodes.flatMap(n=>n.nodeType===1?[...(n.matches('a')?[n]:[]),...n.querySelectorAll('a')]:[]).sort((a,b)=>b.textContent.length-a.textContent.length);
        for(const a of anchors){
          const label=a.textContent.trim();if(!label || template.content.querySelector('a')?.textContent===label)continue;
          const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT);let t;
          while(t=walker.nextNode()){
            const at=t.textContent.indexOf(label);if(at<0||t.parentElement?.closest('a'))continue;
            const before=t.textContent.slice(0,at),after=t.textContent.slice(at+label.length);
            t.replaceWith(document.createTextNode(before),a.cloneNode(true),document.createTextNode(after));break;
          }
        }
        if(!inline){
          if(nodes[0].matches('button.schedule-toggle')) {
            const t=document.createElement('span');t.innerHTML=op.html;
            const time=nodes[0].querySelector('.schedule-time b');if(time)time.textContent=t.textContent.replace(/^建議時間/,'');
          } else nodes[0].replaceChildren(template.content);
          continue;
        }
        nodes[0].before(template.content);nodes.forEach(e=>e.remove());
      }
      main.dataset.wordPatchMisses=misses.join(',');
      main.querySelectorAll('.route>strong').forEach(e=>{if(e.textContent.trim()==='今日路線')e.classList.add('route-label');});
      main.querySelectorAll('.route-label>span,.section-sub,.hero-copy small,.photo-caption').forEach(e=>e.remove());
      main.querySelectorAll('.schedule-detail-body a').forEach(e=>{if(e.textContent.trim()==='實拍攻略')e.remove();});
      main.querySelectorAll('.table-card>div').forEach(e=>{
        const label=e.querySelector('dt')?.textContent.trim(),value=e.querySelector('dd')?.textContent.trim()||'';
        if((label==='移動方式' && /^(步行|參拜|拍照|散步|參拜與拍照|參拜、拍照)([／、與及\s]*(步行|參拜|拍照|散步))*$/.test(value)) || (label==='安排與提醒' && /^[—－\-\s]*$/.test(value)))e.remove();
        else if(!e.querySelector('dt')&&!value)e.remove();
      });
      main.querySelectorAll('.table-card dl').forEach(e=>{if(!e.textContent.trim())e.remove();});
      main.querySelectorAll('.timeline>li').forEach(e=>{if(!e.querySelector('.item-body')?.textContent.trim()&&!e.querySelector('.schedule-time'))e.remove();});
      main.querySelectorAll('.timeline>li .step').forEach((e,i)=>e.textContent=String(i+1).padStart(2,'0'));
    }
    if(state.view==='flights') {
      main.querySelectorAll('.eyebrow,.main>p.intro,.ticket-header>span:last-child,.note').forEach(e=>e.remove());
      main.querySelectorAll('.ticket-footer>strong').forEach(e=>{e.innerHTML=e.innerHTML.replace(/\b([A-Z]{2}\s?\d{2,4})\b/g,'<span class="flight-number">$1</span>');});
      main.querySelectorAll('.ticket-footer p').forEach(e=>{e.innerHTML=e.innerHTML.replace('原行程預留','行程預留');});
      main.querySelectorAll('.table-card>div').forEach(e=>{
        const dt=e.querySelector('dt');if(!dt)return;
        if(['組別','抵達成田 T2','狀況'].includes(dt.textContent.trim()))e.remove();
        else if(dt.textContent.trim()==='T2 出發／Skyliner')dt.textContent='Skyliner';
      });
    }
  }


  const dailyCompactPlan = {"append":[{"id":"WEB00701","day":8,"text":"主要景點：成田山表參道 → 新勝寺大本堂 → 成田山公園紅葉祭 → なごみの米屋。","add":"16:40 左右開始往京成成田站移動。"},{"id":"WEB00709","day":8,"text":"傍晚購物：京成成田站 6 號搭付費直行巴士前往 AEON MALL；主搭 17:15／17:47，回程主搭 20:28（星巴克前）或 20:29（Mall East）。查看時刻表 ↓","add":"去程延誤可改 18:30；逛至閉店可改搭 21:05／21:06 回程。前門上車先付費，成人單程 220 円，可用 IC 卡，車程約 10 分鐘。專門店 21:00 關門，全團先約定回程站牌。"}],"remove":[{"id":"WEB00699","day":8,"text":"川豐先取號，等太久就在表參道附近另找想吃的店。"},{"id":"WEB00707","day":8,"text":"新勝寺後到成田山公園賞楓約 45–60 分鐘，再逛米屋；16:40 左右開始往京成成田站移動。"},{"id":"WEB00715","day":8,"text":"前門上車先付；成人 220 円，可用 IC 卡。"},{"id":"WEB00721","day":8,"text":"主搭 17:15／17:47 直行；延誤可改 18:30。"},{"id":"WEB00727","day":8,"text":"專門店 21:00 關門；全團先約定回程站牌。"},{"id":"WEB00733","day":8,"text":"主搭 20:28／20:29；逛至閉店可改 21:05／21:06。"},{"id":"WEB00740","day":8,"text":"主要安排飯店寄放行李 → 表參道午餐 → 新勝寺大本堂 → 成田山公園紅葉祭 → 米屋 → 17:15／17:47 巴士 → AEON MALL → 20:28／20:29 返回。"},{"id":"WEB00743","day":8,"text":"不是免費接駁車：這是京成成田站與 AEON MALL 成田之間的付費直行路線巴士。京成成田站從 6 號乘車處上車，成人單程 220 円、可使用 IC 卡，車程約 10 分鐘。"},{"id":"WEB00744","day":8,"text":"建議搭法"},{"id":"WEB00745","day":8,"text":"去程：17:15 或 17:47 直行。回程：20:28（星巴克前）／20:29（Mall East）；逛至專門店閉店可改 21:05／21:06。"},{"id":"WEB00695","day":8,"text":"成田山表參道／川豐本店"},{"id":"WEB00703","day":8,"text":"新勝寺大本堂 → なごみの米屋"},{"id":"WEB00711","day":8,"text":"京成成田站 6 號乘車處"},{"id":"WEB00717","day":8,"text":"京成成田站 → AEON MALL 成田"},{"id":"WEB00723","day":8,"text":"AEON MALL 成田"},{"id":"WEB00729","day":8,"text":"AEON MALL 成田 → 京成成田站"}]};
  function compactDailyPresentation() {
    if(state.view!=='days')return;
    const normalize=t=>t.replace(/[\s\u3000]+/g,'').replace(/實拍攻略/g,'');
    const relevant=op=>![6,7].includes(op.day) && op.day===state.day && !(state.group==='B'&&state.day===1) && !(state.group==='C'&&state.day===3);
    const stops=[...main.querySelectorAll('.stop-content')];
    // Keep the original source DOM intact: Word-import locators run first.
    const additions=[];
    for(const op of dailyCompactPlan.append.filter(relevant)) {
      const stop=stops.find(s=>{const c=s.cloneNode(true);c.querySelectorAll('.schedule-detail-body,.schedule-toggle,.schedule-time').forEach(e=>e.remove());return normalize(c.textContent).includes(normalize(op.text));});
      if(stop){const p=document.createElement('p');p.className='summary-addition';p.textContent=op.add;const detail=stop.querySelector('.schedule-detail-body');detail?detail.before(p):stop.append(p);}
      else additions.push(op.id);
    }
    main.dataset.compactMisses=additions.join(',');
    for(const op of dailyCompactPlan.remove.filter(relevant)) {
      const candidates=[...main.querySelectorAll('.schedule-detail-body dd,.schedule-detail-body p,.schedule-detail-body h3,.schedule-detail-body div')].filter(e=>normalize(e.textContent)===normalize(op.text));
      for(const e of candidates.filter(e=>!candidates.some(other=>other!==e&&e.contains(other)))) {
        if(e.tagName==='DD')e.parentElement.remove();else e.remove();
      }
    }
    main.querySelectorAll('.table-card>div').forEach(field=>{
      const dt=field.querySelector('dt'),dd=field.querySelector('dd');
      if(dt?.textContent.trim()==='移動方式'&&!/\d{1,2}[:：]\d{2}/.test(dd?.textContent||''))field.remove();
    });
    for(const stop of stops){
      const detail=stop.querySelector('.schedule-detail-body');if(!detail)continue;
      const summary=stop.cloneNode(true);summary.querySelectorAll('.schedule-detail-body,.schedule-toggle').forEach(e=>e.remove());
      const text=normalize(summary.textContent);
      detail.querySelectorAll('.table-card>div').forEach(field=>{
        const dt=field.querySelector('dt')?.textContent.trim(),dd=field.querySelector('dd');
        // Remove exact duplicates only; retain timing exceptions and unique details.
        if(dd&&['路段／地點','安排與提醒'].includes(dt)&&normalize(dd.textContent)&&text.includes(normalize(dd.textContent)))field.remove();
      });
      detail.querySelectorAll('.table-card').forEach(card=>{if(!card.querySelector('dd')||!card.textContent.trim())card.remove();});
      for(const e of [...detail.querySelectorAll('div,section')].reverse())if(!e.textContent.trim()&&!e.querySelector('img,table,a'))e.remove();
      if(!detail.textContent.trim()&&!detail.querySelector('img,a')){
        const toggle=stop.querySelector('.schedule-toggle'),time=toggle?.querySelector('.schedule-time');
        if(toggle&&time)toggle.replaceWith(time);else toggle?.remove();detail.remove();
      }
    }
    const hero=main.querySelector('.day-overview>.hero'),caption=hero?.querySelector('.hero-copy');
    if(caption){caption.classList.add('day-hero-caption');hero.append(caption);}
  }


  const dailyPlaceMaps = {"野口鮮魚店":"https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E3%81%95%E3%81%AA%E9%AD%9A%E3%81%8C%E3%81%97+%E9%87%8E%E5%8F%A3%E9%AE%AE%E9%AD%9A%E5%BA%97+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A2%A8%E7%94%B0%E5%8D%80%E6%9D%B1%E9%A7%92%E5%BD%A24-6-9+%E3%83%AA%E3%83%90%E3%83%BC%E3%83%8F%E3%82%A4%E3%83%84%E3%83%AF%E3%82%B3%E3%83%BC+1F","塩パン屋 パンメゾン":"https://www.google.com/maps/search/?api=1&query=%E5%A1%A9%E3%83%91%E3%83%B3%E5%B1%8B+%E3%83%91%E3%83%B3%E3%83%A1%E3%82%BE%E3%83%B3+%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E5%BA%97","鳥貴族 淺草店":"https://maps.app.goo.gl/EvEaCawMVivVVJDC9","本所吾妻橋站":"https://www.google.com/maps/search/?api=1&query=%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E9%A7%85","RARASAND":"https://www.google.com/maps/search/?api=1&query=RARASAND+%E8%B1%AA%E5%BE%B3%E5%AF%BA+%E6%9D%B1%E4%BA%AC","IRON COFFEE":"https://www.google.com/maps/search/?api=1&query=IRON+COFFEE+%E8%B1%AA%E5%BE%B3%E5%AF%BA+%E6%9D%B1%E4%BA%AC","梅丘寿司の美登利 総本店":"https://www.google.com/maps/search/?api=1&query=%E6%A2%85%E4%B8%98%E5%AF%BF%E5%8F%B8%E3%81%AE%E7%BE%8E%E7%99%BB%E5%88%A9+%E7%B7%8F%E6%9C%AC%E5%BA%97","梅丘站":"https://www.google.com/maps/search/?api=1&query=%E6%A2%85%E3%83%B6%E4%B8%98%E9%A7%85","新宿站":"https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%AE%BF%E9%A7%85","一蘭 新宿歌舞伎町店":"https://www.google.com/maps/search/?api=1&query=%E4%B8%80%E8%98%AD+%E6%96%B0%E5%AE%BF%E6%AD%8C%E8%88%9E%E4%BC%8E%E7%94%BA%E5%BA%97+%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%96%B0%E5%AE%BF%E5%8D%80%E6%AD%8C%E8%88%9E%E4%BC%8E%E7%94%BA1-17-10","東京民宿":"https://maps.app.goo.gl/QZX3Ty983HxajN197","日暮里站":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E6%9A%AE%E9%87%8C%E9%A7%85","根津神社":"https://www.google.com/maps/search/?api=1&query=%E6%A0%B9%E6%B4%A5%E7%A5%9E%E7%A4%BE%20%E6%9D%B1%E4%BA%AC","千駄木":"https://www.google.com/maps/search/?api=1&query=%E5%8D%83%E9%A7%84%E6%9C%A8%E9%A7%85","谷中銀座商店街":"https://www.google.com/maps/search/?api=1&query=%E8%B0%B7%E4%B8%AD%E9%8A%80%E5%BA%A7%E5%95%86%E5%BA%97%E8%A1%97","夕やけだんだん":"https://www.google.com/maps/search/?api=1&query=%E5%A4%95%E3%82%84%E3%81%91%E3%81%A0%E3%82%93%E3%81%A0%E3%82%93%20%E8%B0%B7%E4%B8%AD","押上站":"https://www.google.com/maps/search/?api=1&query=%E6%8A%BC%E4%B8%8A%E9%A7%85","飛木稻荷神社":"https://www.google.com/maps/search/?api=1&query=%E9%A3%9B%E6%9C%A8%E7%A8%B2%E8%8D%B7%E7%A5%9E%E7%A4%BE%20%E5%A2%A8%E7%94%B0%E5%8C%BA%E6%8A%BC%E4%B8%8A","ハト屋パン店":"https://www.google.com/maps/search/?api=1&query=%E3%83%8F%E3%83%88%E5%B1%8B%E3%83%91%E3%83%B3%E5%BA%97%20%E4%BA%AC%E5%B3%B6","キラキラ橘商店街":"https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%A9%E3%82%AD%E3%83%A9%E6%A9%98%E5%95%86%E5%BA%97%E8%A1%97%20%E5%A2%A8%E7%94%B0%E5%8C%BA%E4%BA%AC%E5%B3%B6","MUUMUU COFFEE":"https://www.google.com/maps/search/?api=1&query=MUUMUU%20COFFEE%20%E4%BA%AC%E5%B3%B6","吉備子屋":"https://www.google.com/maps/search/?api=1&query=%E5%90%89%E5%82%99%E5%AD%90%E5%B1%8B%20%E5%90%91%E5%B3%B6","志満ん草餅":"https://www.google.com/maps/search/?api=1&query=%E5%BF%97%E6%BA%80%E3%82%93%E8%8D%89%E9%A4%85%20%E5%A2%A8%E7%94%B0%E5%8C%BA%E6%9D%B1%E5%90%91%E5%B3%B6","炭火焼肉おくさこ":"https://maps.app.goo.gl/rWTxzYh2HwmYyaoX8","外苑前站":"https://www.google.com/maps/search/?api=1&query=%E5%A4%96%E8%8B%91%E5%89%8D%E9%A7%85","表參道站":"https://www.google.com/maps/search/?api=1&query=%E8%A1%A8%E5%8F%82%E9%81%93%E9%A7%85","Sweet Check 蛋包飯":"https://maps.app.goo.gl/cq6P7DPSL1NEdmQT8","BASO 蕎麥麵":"https://maps.app.goo.gl/XfhefUXyvnTHNSra8","うどん 麺散":"https://maps.app.goo.gl/Nf1bBBnExek1mAus5","FREAK'S STORE Shibuya":"https://maps.app.goo.gl/zfRiMG347oqCoXQQ6","極味屋 澀谷 PARCO 店":"https://maps.app.goo.gl/PW2hqEnuummDrjFH8","MEGA 唐吉訶德 澀谷本店":"https://www.google.com/maps/search/?api=1&query=MEGA%E3%83%89%E3%83%B3%E3%83%BB%E3%82%AD%E3%83%9B%E3%83%BC%E3%83%86%E6%B8%8B%E8%B0%B7%E6%9C%AC%E5%BA%97","Mūya":"https://www.google.com/maps/search/?api=1&query=%E3%82%80%E3%81%86%E3%82%84%20%E6%9D%B1%E4%BA%AC%E3%83%9F%E3%82%BA%E3%83%9E%E3%83%81","隅田川步道":"https://www.google.com/maps/search/?api=1&query=%E9%9A%85%E7%94%B0%E5%B7%9D%E3%83%86%E3%83%A9%E3%82%B9%20%E5%90%BE%E5%A6%BB%E6%A9%8B","花月堂菠蘿麵包":"https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E8%8A%B1%E6%9C%88%E5%A0%82+%E6%9C%AC%E5%BA%97","壽壽喜園抹茶冰淇淋":"https://www.google.com/maps/search/?api=1&query=%E5%A3%BD%E3%80%85%E5%96%9C%E5%9C%92+%E6%B5%85%E8%8D%89%E6%9C%AC%E5%BA%97","龜十銅鑼燒":"https://www.google.com/maps/search/?api=1&query=%E4%BA%80%E5%8D%81+%E6%B5%85%E8%8D%89","牛たんの檸檬 淺草店":"https://maps.app.goo.gl/K4QdwtcbFczYAsTPA","東武淺草站":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%B5%85%E8%8D%89%E9%A7%85","東京晴空塔站":"https://www.google.com/maps/search/?api=1&query=%E3%81%A8%E3%81%86%E3%81%8D%E3%82%87%E3%81%86%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC%E9%A7%85","日光さかえや 揚げゆばまんじゅう本舗":"https://maps.app.goo.gl/BP5Dz4o8puYm7j7TA","日光東照宮":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E6%9D%B1%E7%85%A7%E5%AE%AE","鉢石町・日光街道":"https://www.google.com/maps/search/?api=1&query=%E9%89%A2%E7%9F%B3%E7%94%BA%20%E6%97%A5%E5%85%89","日光 Airbnb":"https://maps.app.goo.gl/xPXoTRvUER7Yosbm6","東武日光站巴士站":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85%20%E3%83%90%E3%82%B9%E4%B9%97%E3%82%8A%E5%A0%B4","東武日光站":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85","中禪寺溫泉":"https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B8%A9%E6%B3%89%20%E3%83%90%E3%82%B9%E5%81%9C%20%E6%97%A5%E5%85%89","站前・日光街道":"https://www.google.com/maps/search/?api=1&query=%E9%89%A2%E7%9F%B3%E7%94%BA%20%E6%97%A5%E5%85%89","憾滿之淵（選逛）":"https://www.google.com/maps/search/?api=1&query=%E6%86%BE%E6%BA%80%E3%83%B6%E6%B7%B5","成田里士滿飯店":"https://maps.app.goo.gl/2XG4HEaMg9eHVKVZ6","川豐本店":"https://www.google.com/maps/search/?api=1&query=%E5%B7%9D%E8%B1%8A+%E6%9C%AC%E5%BA%97+%E6%88%90%E7%94%B0","成田江戶人壽司":"https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E6%B1%9F%E6%88%B8%E3%81%A3%E5%AD%90%E5%AF%BF%E5%8F%B8","淺草橋銀杏岡八幡神社":"https://www.google.com/maps/search/?api=1&query=%E9%8A%80%E6%9D%8F%E5%B2%A1%E5%85%AB%E5%B9%A1%E7%A5%9E%E7%A4%BE%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-29-11","銀杏岡八幡神社":"https://www.google.com/maps/search/?api=1&query=%E9%8A%80%E6%9D%8F%E5%B2%A1%E5%85%AB%E5%B9%A1%E7%A5%9E%E7%A4%BE%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-29-11","シモジマ淺草橋本店":"https://www.google.com/maps/search/?api=1&query=%E3%82%B7%E3%83%A2%E3%82%B8%E3%83%9E%20%E6%B5%85%E8%8D%89%E6%A9%8B%E6%9C%AC%E5%BA%97%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-30-10","シモジマ":"https://www.google.com/maps/search/?api=1&query=%E3%82%B7%E3%83%A2%E3%82%B8%E3%83%9E%20%E6%B5%85%E8%8D%89%E6%A9%8B%E6%9C%AC%E5%BA%97%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-30-10","日比谷公園":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E6%AF%94%E8%B0%B7%E5%85%AC%E5%9C%92%20%E6%9D%B1%E4%BA%AC","丸之內仲通り":"https://www.google.com/maps/search/?api=1&query=%E4%B8%B8%E3%81%AE%E5%86%85%E4%BB%B2%E9%80%9A%E3%82%8A%20%E6%9D%B1%E4%BA%AC","丸之內仲通":"https://www.google.com/maps/search/?api=1&query=%E4%B8%B8%E3%81%AE%E5%86%85%E4%BB%B2%E9%80%9A%E3%82%8A%20%E6%9D%B1%E4%BA%AC","東京車站丸之內廣場":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E9%A7%85%20%E4%B8%B8%E3%81%AE%E5%86%85%E9%A7%85%E5%89%8D%E5%BA%83%E5%A0%B4","東京車站丸之內":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E9%A7%85%20%E4%B8%B8%E3%81%AE%E5%86%85%E9%A7%85%E5%89%8D%E5%BA%83%E5%A0%B4","豪德寺":"https://www.google.com/maps/search/?api=1&query=%E8%B1%AA%E5%BE%B3%E5%AF%BA%20%E4%B8%96%E7%94%B0%E8%B0%B7%E5%8C%BA%E8%B1%AA%E5%BE%B3%E5%AF%BA2-24-7","新宿 Bic Camera":"https://www.google.com/maps/search/?api=1&query=%E3%83%93%E3%83%83%E3%82%AF%E3%82%AB%E3%83%A1%E3%83%A9%20%E6%96%B0%E5%AE%BF%E6%9D%B1%E5%8F%A3%E5%BA%97","Bic Camera 新宿東口店":"https://www.google.com/maps/search/?api=1&query=%E3%83%93%E3%83%83%E3%82%AF%E3%82%AB%E3%83%A1%E3%83%A9%20%E6%96%B0%E5%AE%BF%E6%9D%B1%E5%8F%A3%E5%BA%97","Alpen Tokyo 旗艦店":"https://www.google.com/maps/search/?api=1&query=Alpen%20TOKYO%20%E6%96%B0%E5%AE%BF","Alpen TOKYO":"https://www.google.com/maps/search/?api=1&query=Alpen%20TOKYO%20%E6%96%B0%E5%AE%BF","Alpen Tokyo":"https://www.google.com/maps/search/?api=1&query=Alpen%20TOKYO%20%E6%96%B0%E5%AE%BF","明治神宮外苑銀杏大道":"https://www.google.com/maps/search/?api=1&query=%E6%98%8E%E6%B2%BB%E7%A5%9E%E5%AE%AE%E5%A4%96%E8%8B%91%20%E3%81%84%E3%81%A1%E3%82%87%E3%81%86%E4%B8%A6%E6%9C%A8","神宮外苑":"https://www.google.com/maps/search/?api=1&query=%E6%98%8E%E6%B2%BB%E7%A5%9E%E5%AE%AE%E5%A4%96%E8%8B%91%20%E6%9D%B1%E4%BA%AC","KIDDY LAND 原宿店":"https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%87%E3%82%A4%E3%83%A9%E3%83%B3%E3%83%89%20%E5%8E%9F%E5%AE%BF%E5%BA%97%20%E6%B8%8B%E8%B0%B7%E5%8C%BA%E7%A5%9E%E5%AE%AE%E5%89%8D6-1-9","KIDDY LAND":"https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%87%E3%82%A4%E3%83%A9%E3%83%B3%E3%83%89%20%E5%8E%9F%E5%AE%BF%E5%BA%97%20%E6%B8%8B%E8%B0%B7%E5%8C%BA%E7%A5%9E%E5%AE%AE%E5%89%8D6-1-9","NUMBER SUGAR 表參道店":"https://www.google.com/maps/search/?api=1&query=NUMBER%20SUGAR%20%E8%A1%A8%E5%8F%82%E9%81%93%E6%9C%AC%E5%BA%97","NUMBER SUGAR":"https://www.google.com/maps/search/?api=1&query=NUMBER%20SUGAR%20%E8%A1%A8%E5%8F%82%E9%81%93%E6%9C%AC%E5%BA%97","宮下公園":"https://www.google.com/maps/search/?api=1&query=MIYASHITA%20PARK%20%E6%B8%8B%E8%B0%B7","貓街":"https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%A3%E3%83%83%E3%83%88%E3%82%B9%E3%83%88%E3%83%AA%E3%83%BC%E3%83%88%20%E6%B8%8B%E8%B0%B7","澀谷 PARCO":"https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7PARCO%20%E5%AE%87%E7%94%B0%E5%B7%9D%E7%94%BA15-1","澀谷站八公口外":"https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7%E9%A7%85%20%E3%83%8F%E3%83%81%E5%85%AC%E5%8F%A3","澀谷站八公口":"https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7%E9%A7%85%20%E3%83%8F%E3%83%81%E5%85%AC%E5%8F%A3","真さか":"https://www.google.com/maps/search/?api=1&query=%E3%83%B4%E3%82%A3%E3%83%BC%E3%82%AC%E3%83%B3%E5%B1%85%E9%85%92%E5%B1%8B%20%E7%9C%9F%E3%81%95%E3%81%8B%20%E6%B8%8B%E8%B0%B7PARCO%20B1","淺草寺参道":"https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E5%AF%BA%20%E4%BB%B2%E8%A6%8B%E4%B8%96%E9%80%9A%E3%82%8A","淺草寺":"https://www.google.com/maps/search/?api=1&query=%E6%B7%BA%E8%8D%89%E5%AF%BA%20%E6%9D%B1%E4%BA%AC","雷門":"https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E5%AF%BA%20%E9%9B%B7%E9%96%80","PATISSERIE TEN&（日比谷 OKUROJI）":"https://www.google.com/maps/search/?api=1&query=PATISSERIE%20TEN%26%20%E6%97%A5%E6%AF%94%E8%B0%B7OKUROJI","PATISSERIE TEN&":"https://www.google.com/maps/search/?api=1&query=PATISSERIE%20TEN%26%20%E6%97%A5%E6%AF%94%E8%B0%B7OKUROJI","日比谷 PATISSERIE TEN&":"https://www.google.com/maps/search/?api=1&query=PATISSERIE%20TEN%26%20%E6%97%A5%E6%AF%94%E8%B0%B7OKUROJI","大屋頂廣場":"https://www.google.com/maps/search/?api=1&query=%E5%85%AD%E6%9C%AC%E6%9C%A8%E3%83%92%E3%83%AB%E3%82%BA%20%E5%A4%A7%E5%B1%8B%E6%A0%B9%E3%83%97%E3%83%A9%E3%82%B6","六本木新城":"https://www.google.com/maps/search/?api=1&query=%E5%85%AD%E6%9C%AC%E6%9C%A8%E3%83%92%E3%83%AB%E3%82%BA%20%E6%9D%B1%E4%BA%AC","神橋":"https://www.google.com/maps/search/?api=1&query=%E7%A5%9E%E6%A9%8B%20%E6%97%A5%E5%85%89%E5%B8%82%E4%B8%8A%E9%89%A2%E7%9F%B3%E7%94%BA","東照宮":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E6%9D%B1%E7%85%A7%E5%AE%AE%20%E6%97%A5%E5%85%89%E5%B8%82%E5%B1%B1%E5%86%852301","東京晴空塔":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC","晴空塔":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC","華嚴瀑布":"https://www.google.com/maps/search/?api=1&query=%E8%8F%AF%E5%8E%B3%E3%81%AE%E6%BB%9D%20%E6%97%A5%E5%85%89","中禪寺湖":"https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B9%96%20%E6%97%A5%E5%85%89","憾滿之淵":"https://www.google.com/maps/search/?api=1&query=%E6%86%BE%E6%BA%80%E3%83%B6%E6%B7%B5%20%E6%97%A5%E5%85%89","田母澤御用邸":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E7%94%B0%E6%AF%8D%E6%B2%A2%E5%BE%A1%E7%94%A8%E9%82%B8%E8%A8%98%E5%BF%B5%E5%85%AC%E5%9C%92","日光街道":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E8%A1%97%E9%81%93%20%E9%89%A2%E7%9F%B3%E7%94%BA%20%E6%97%A5%E5%85%89%E5%B8%82","成田山表參道":"https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E8%A1%A8%E5%8F%82%E9%81%93","新勝寺大本堂":"https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E6%96%B0%E5%8B%9D%E5%AF%BA%20%E5%A4%A7%E6%9C%AC%E5%A0%82","成田山公園":"https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E5%85%AC%E5%9C%92","なごみの米屋":"https://www.google.com/maps/search/?api=1&query=%E3%81%AA%E3%81%94%E3%81%BF%E3%81%AE%E7%B1%B3%E5%B1%8B%20%E7%B7%8F%E6%9C%AC%E5%BA%97%20%E6%88%90%E7%94%B0%E5%B8%82%E4%B8%8A%E7%94%BA500","京成成田站":"https://www.google.com/maps/search/?api=1&query=%E4%BA%AC%E6%88%90%E6%88%90%E7%94%B0%E9%A7%85","AEON MALL 成田":"https://www.google.com/maps/search/?api=1&query=%E3%82%A4%E3%82%AA%E3%83%B3%E3%83%A2%E3%83%BC%E3%83%AB%E6%88%90%E7%94%B0","青山一丁目站":"https://www.google.com/maps/search/?api=1&query=%E9%9D%92%E5%B1%B1%E4%B8%80%E4%B8%81%E7%9B%AE%E9%A7%85","原宿站":"https://www.google.com/maps/search/?api=1&query=%E5%8E%9F%E5%AE%BF%E9%A7%85","澀谷站":"https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7%E9%A7%85","麺 みつヰ":"https://www.google.com/maps/search/?api=1&query=%E9%BA%BA%20%E3%81%BF%E3%81%A4%E3%83%B0%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E5%AF%BF2-9-15","天麩羅秋光":"https://www.google.com/maps/search/?api=1&query=%E5%A4%A9%E9%BA%A9%E7%BE%85%20%E7%A7%8B%E5%85%89%20%E6%B5%85%E8%8D%89%E6%9C%AC%E5%BA%97","HARBS LUMINE 有樂町店":"https://www.google.com/maps/search/?api=1&query=HARBS%20%E3%83%AB%E3%83%9F%E3%83%8D%E6%9C%89%E6%A5%BD%E7%94%BA%E5%BA%97%20%E6%9C%89%E6%A5%BD%E7%94%BA2-5-1","有樂町 HARBS":"https://www.google.com/maps/search/?api=1&query=HARBS%20%E3%83%AB%E3%83%9F%E3%83%8D%E6%9C%89%E6%A5%BD%E7%94%BA%E5%BA%97%20%E6%9C%89%E6%A5%BD%E7%94%BA2-5-1","豪德寺站":"https://www.google.com/maps/search/?api=1&query=%E8%B1%AA%E5%BE%B7%E5%AF%BA%E7%AB%99%20%E6%9D%B1%E4%BA%AC","仲見世商店街":"https://www.google.com/maps/search/?api=1&query=%E4%BB%B2%E8%A6%8B%E4%B8%96%E5%95%86%E5%BA%97%E8%A1%97%20%E6%9D%B1%E4%BA%AC","とうきょうスカイツリー駅前":"https://www.google.com/maps/search/?api=1&query=%E3%81%A8%E3%81%86%E3%81%8D%E3%82%87%E3%81%86%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC%E9%A7%85%E5%89%8D%20%E6%9D%B1%E4%BA%AC","根津駅前":"https://www.google.com/maps/search/?api=1&query=%E6%A0%B9%E6%B4%A5%E9%A7%85%E5%89%8D%20%E6%9D%B1%E4%BA%AC"};
  const readableDailyStops = {
  "1-0": {
    "title": "抵達民宿｜放行李",
    "summary": "先到民宿；能否提早放行李依房東回覆。若需等 16:00 入住，放好行李再出發，野口鮮魚店順延到約 16:15。",
    "directions": "本所吾妻橋出站後，依民宿地圖步行；往東駒形可用 A2，帶大行李優先找 A0 電梯。",
    "note": "未取得房東同意前，不把提前寄放視為已安排。",
    "links": [
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      },
      {
        "label": "本所吾妻橋站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E9%A7%85"
      }
    ],
    "rail": true,
    "car": "往東駒形可用 A2 樓梯；大行李優先找 A0 電梯。第 4 車廂附近接 A0～A2／跨月台通道；列車車廂編號請對照站內圖。"
  },
  "1-1": {
    "title": "晚午餐｜野口鮮魚店",
    "summary": "放好行李後步行到野口鮮魚店，可分桌。候位超過 45 分鐘、17:00 仍未入座或已售罄，就改吃 CHICO。",
    "directions": "民宿 → 野口鮮魚店，步行約 5–10 分鐘。",
    "note": "不接受訂位；保留後面夜景與 21:30 晚餐的時間。",
    "links": [
      {
        "label": "野口鮮魚店攻略",
        "url": "restaurant-guide/venues/09-noguchi-sengyoten.html"
      },
      {
        "label": "CHICO 備案",
        "url": "restaurant-guide/venues/01-monjayaki-chico.html"
      },
      {
        "label": "野口鮮魚店",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E3%81%95%E3%81%AA%E9%AD%9A%E3%81%8C%E3%81%97+%E9%87%8E%E5%8F%A3%E9%AE%AE%E9%AD%9A%E5%BA%97+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A2%A8%E7%94%B0%E5%8D%80%E6%9D%B1%E9%A7%92%E5%BD%A24-6-9+%E3%83%AA%E3%83%90%E3%83%BC%E3%83%8F%E3%82%A4%E3%83%84%E3%83%AF%E3%82%B3%E3%83%BC+1F"
      }
    ]
  },
  "1-2": {
    "title": "點心｜塩パン屋 パンメゾン",
    "summary": "野口用餐後順路買鹽麵包，想吃可各買 1 個。吃飽、排隊太長或時間延後，就直接前往日比谷。",
    "directions": "野口鮮魚店 → 塩パン屋 パンメゾン，依地圖步行。",
    "note": "點心可略過，不影響當天主要安排。",
    "links": [
      {
        "label": "鹽麵包攻略",
        "url": "restaurant-guide/venues/02-pain-maison.html"
      },
      {
        "label": "塩パン屋 パンメゾン",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%A1%A9%E3%83%91%E3%83%B3%E5%B1%8B+%E3%83%91%E3%83%B3%E3%83%A1%E3%82%BE%E3%83%B3+%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E5%BA%97"
      }
    ]
  },
  "1-3": {
    "title": "夜景｜日比谷・丸之內",
    "summary": "日比谷公園 → 丸之內仲通 → 丸大樓 → 東京站前，沿路散步看燈飾。20:00 左右結束，留時間回淺草赴 21:30 晚餐。",
    "directions": "本所吾妻橋 A19 搭淺草線往西馬込／羽田方向，到東銀座 A11；轉日比谷線 H10 往中目黑，到日比谷 H08。出站後依步行地圖順走。",
    "note": "11/21 不安排尚未開始的東京站限定裝置；下雨沿原雨備改走地下街。",
    "links": [
      {
        "label": "丸之內活動官網",
        "url": "https://www.marunouchi.com/lp/brightholiday2026/"
      }
    ],
    "extra": "下雨時沿原雨備改走丸之內地下街；20:00 左右離開，保留返回淺草的時間。"
  },
  "1-4": {
    "title": "晚餐｜鳥貴族 淺草店",
    "summary": "21:30 已訂位，A 組先報到入座；B 組到民宿放好行李後加入。B 組若趕不上，先聯絡餐廳說明。",
    "directions": "東京站前 → 丸之內線 M17 東京（紅色，荻窪方向）搭 1 站到 M16 銀座 → 轉銀座線 G09（橘色，淺草方向）到 G19 淺草 → 依餐廳地圖步行到鳥貴族。",
    "note": "報到時出示訂位信，資料見「已預約」。",
    "links": [
      {
        "label": "鳥貴族地圖",
        "url": "https://maps.app.goo.gl/EvEaCawMVivVVJDC9"
      },
      {
        "label": "鳥貴族攻略",
        "url": "restaurant-guide/venues/03-torikizoku-asakusa.html"
      },
      {
        "label": "已預約資料",
        "url": "./?view=bookings&bday=1"
      },
      {
        "label": "東京站／丸之內線",
        "url": "https://www.tokyometro.jp/station/tokyo/index.html"
      }
    ],
    "rail": true
  },
  "1-B-2": {
    "title": "先放行李",
    "summary": "抵達本所吾妻橋後，先回民宿放好行李，回報預計到餐廳的時間，再去鳥貴族與 A 組會合。",
    "directions": "本所吾妻橋出站 → 民宿 → 鳥貴族淺草店；分別使用民宿、餐廳地圖導航。",
    "note": "不要為趕 21:30 而忽略行李與轉車所需時間。",
    "links": [
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      },
      {
        "label": "鳥貴族地圖",
        "url": "https://maps.app.goo.gl/EvEaCawMVivVVJDC9"
      }
    ]
  },
  "1-B-3": {
    "title": "晚餐｜鳥貴族 淺草店",
    "summary": "21:30 已訂位，由 A 組先進店。B 組放好行李後加入；若延誤，請提前聯絡餐廳。",
    "directions": "",
    "note": "延誤時先聯絡店家。",
    "links": [
      {
        "label": "鳥貴族攻略",
        "url": "restaurant-guide/venues/03-torikizoku-asakusa.html"
      },
      {
        "label": "已預約資料",
        "url": "./?view=bookings&bday=1"
      }
    ]
  },
  "1-B-4": {
    "title": "晚餐會合",
    "summary": "A 組先報到入座，B 組抵達後加入。",
    "directions": "",
    "note": "",
    "links": []
  },
  "2-0": {
    "title": "出發｜民宿 → 豪德寺",
    "summary": "09:00 從民宿出門，經淺草橋、新宿轉往豪德寺。全段含步行、等車約 75–90 分鐘；早餐先吃完，抵達後直接參拜。",
    "directions": "本所吾妻橋 A19 搭淺草線往西馬込／羽田，到淺草橋 A16；轉黃色 JR 中央・總武各站停車往新宿；新宿再轉小田急各駅停車，到豪德寺 OH10，步行約 10–15 分鐘。",
    "note": "小田急要搭各駅停車，急行不停豪德寺。",
    "links": [
      {
        "label": "豪德寺站官方資訊",
        "url": "https://www.odakyu.jp/station/gotokuji/"
      },
      {
        "label": "豪德寺站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E8%B1%AA%E5%BE%B7%E5%AF%BA%E7%AB%99%20%E6%9D%B1%E4%BA%AC"
      }
    ],
    "rail": true
  },
  "2-1": {
    "title": "豪德寺參拜 → 新宿",
    "summary": "10:30–11:15 參拜豪德寺，看招福貓與寺院庭園。",
    "directions": "參拜後步行至豪德寺站，搭小田急各站停車往新宿，車程約 15–16 分鐘。到站沿東西自由通路往東口，再走到 SUBNADE 地下街 B1。"
  },
  "2-2": {
    "title": "午餐｜和幸 SUBNADE 新宿店",
    "summary": "約 12:00 到店現場候位。週日可點里肌豬排定食 ¥1,630 或腰內豬排定食 ¥1,800。",
    "directions": "和幸位於 SUBNADE 地下街 B1、201 區。",
    "note": "不可訂位，依現場候位。",
    "links": [
      {
        "label": "Google 地圖",
        "url": "https://www.google.com/maps/search/?api=1&query=とんかつ和幸サブナード新宿店"
      },
      {
        "label": "官方菜單",
        "url": "https://wako-group.co.jp/wp/wp-content/uploads/2025/11/D24.pdf"
      }
    ]
  },
  "2-3": {
    "title": "新宿購物｜BicCamera → Alpen TOKYO",
    "summary": "午餐後到新宿東口，先逛 BicCamera，再到 Alpen TOKYO。先約好集合點；抵達若比預期晚，少逛幾間即可。",
    "directions": "午餐後從 SUBNADE 地下街走到新宿東口商圈。",
    "note": "14:30 為預估開始時間，以午餐結束時間為準。",
    "links": [
      {
        "label": "BicCamera 優惠券",
        "url": "./?view=coupons&cpn=bic"
      },
      {
        "label": "Alpen 優惠券",
        "url": "./?view=coupons&cpn=alpen"
      },
      {
        "label": "新宿站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%AE%BF%E9%A7%85"
      }
    ],
    "rail": true
  },
  "2-4": {
    "title": "晚餐｜一蘭 新宿歌舞伎町店",
    "summary": "18:00–19:00 於一蘭用餐，可分開入座；候位超過 45 分鐘，就改附近餐廳。餐後搭車回本所吾妻橋休息。",
    "directions": "新宿搭黃色 JR 中央・總武各站停車往千葉方向，到淺草橋；轉都營淺草線往押上，到本所吾妻橋 A19，再步行回民宿。",
    "note": "一蘭為吧台座位，不保證坐在一起。",
    "links": [
      {
        "label": "一蘭攻略",
        "url": "restaurant-guide/venues/08-ichiran-kabukicho.html"
      },
      {
        "label": "一蘭 新宿歌舞伎町店",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%B8%80%E8%98%AD+%E6%96%B0%E5%AE%BF%E6%AD%8C%E8%88%9E%E4%BC%8E%E7%94%BA%E5%BA%97+%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%96%B0%E5%AE%BF%E5%8D%80%E6%AD%8C%E8%88%9E%E4%BC%8E%E7%94%BA1-17-10"
      },
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      }
    ]
  },
  "3-0": {
    "title": "上午自由選線",
    "summary": "09:00 出門，谷根千或京島・向島擇一；A、B 組都能自由選。約 13:00 到晴空塔 Solamachi 吃午餐、逛街，時間可隨散步進度順延。",
    "directions": "谷根千走根津神社 → 谷中銀座 → 日暮里；京島・向島走飛木稻荷 → ハト屋 → キラキラ橘 → MUUMUU COFFEE。兩路最後都回晴空塔。",
    "note": "上午只選一條路線；兩路都在晴空塔用餐，17:30 前往燒肉店與 C 組會合。",
    "links": []
  },
  "3-1": {
    "title": "晚餐｜炭火焼肉おくさこ",
    "summary": "17:30 前往炭火焼肉おくさこ，與 C 組會合用餐。晚餐後想看夜景再去晴空塔，累了就回民宿。",
    "directions": "晴空塔／Solamachi → 餐廳，依餐廳地圖步行；C 組由民宿直接前往會合。",
    "note": "17:30 是用餐安排，尚未確認訂位；有 1 人不吃牛，點餐時再確認肉品、湯底與調味。",
    "links": [
      {
        "label": "餐廳地圖",
        "url": "https://maps.app.goo.gl/rWTxzYh2HwmYyaoX8"
      },
      {
        "label": "現有菜單頁",
        "url": "https://tabelog.com/tokyo/A1312/A131203/13295810/dtlmenu/"
      },
      {
        "label": "餐廳電話",
        "url": "tel:+81363813166"
      }
    ],
    "extra": "目前週一、假日 17:00–23:00，餐點最後點餐 22:30；同桌安排仍需店家確認。"
  },
  "3-yanaka": {
    "title": "谷根千｜神社與老街",
    "summary": "先搭上 26 到根津，依序走根津神社、谷中銀座、夕やけだんだん，從日暮里搭京成回晴空塔；一路向前走，不回頭取車。",
    "directions": "民宿步行約 15–20 分鐘，到「とうきょうスカイツリー駅前」2 番站牌；搭上 26「上野公園行」，在根津駅前下車。回程從日暮里搭京成普通列車到青砥，轉往押上／都營淺草線的列車，到押上下車。",
    "note": "11/23 用假日班表；上車站是「駅前」，不是「駅入口」。巴士塞車就縮短參拜，仍照原路走到日暮里。",
    "links": [
      {
        "label": "上 26 官方時刻",
        "url": "https://tobus.jp/sp/blsys/stop/time?ln=ja&poleno=2&routecode=79&stopid=2028&ud=1"
      },
      {
        "label": "既有步行地圖",
        "url": "https://www.google.com/maps/dir/?api=1&origin=%E6%A0%B9%E6%B4%A5%E9%A7%85%E5%89%8D%20%E3%83%90%E3%82%B9%E5%81%9C&destination=%E6%97%A5%E6%9A%AE%E9%87%8C%E9%A7%85&travelmode=walking&waypoints=%E6%A0%B9%E6%B4%A5%E7%A5%9E%E7%A4%BE%7C%E8%B0%B7%E4%B8%AD%E9%8A%80%E5%BA%A7%E5%95%86%E5%BA%97%E8%A1%97%7C%E5%A4%95%E3%82%84%E3%81%91%E3%81%A0%E3%82%93%E3%81%A0%E3%82%93"
      }
    ]
  },
  "3-sumida": {
    "title": "京島・向島｜麵包與咖啡",
    "summary": "從押上開始逛飛木稻荷、ハト屋、キラキラ橘與 MUUMUU COFFEE。12:15 前離開京島，直接回晴空塔吃午餐，不先繞回民宿。",
    "directions": "本所吾妻橋 A19 搭淺草線往押上 A20，只坐 1 站；依步行地圖串聯各店。返晴空塔可步行，走累了沿用原計畫搭計程車。",
    "note": "麵包店排隊長、咖啡店客滿或未開就略過；若改走吉備子屋與志満ん草餅，沿原備案取捨，勿把所有店疊加。",
    "links": [
      {
        "label": "既有步行地圖",
        "url": "https://www.google.com/maps/dir/?api=1&origin=%E6%8A%BC%E4%B8%8A%E9%A7%85&destination=MUUMUU%20COFFEE&travelmode=walking&waypoints=%E9%A3%9B%E6%9C%A8%E7%A8%B2%E8%8D%B7%E7%A5%9E%E7%A4%BE%7C%E3%83%8F%E3%83%88%E5%B1%8B%E3%83%91%E3%83%B3%E5%BA%97%7C%E3%82%AD%E3%83%A9%E3%82%AD%E3%83%A9%E6%A9%98%E5%95%86%E5%BA%97%E8%A1%97"
      },
      {
        "label": "既有步行地圖",
        "url": "https://www.google.com/maps/dir/?api=1&origin=%E3%83%8F%E3%83%88%E5%B1%8B%E3%83%91%E3%83%B3%E5%BA%97&destination=%E5%BF%97%E6%BA%80%E3%82%93%E8%8D%89%E9%A4%85&travelmode=walking&waypoints=%E5%90%89%E5%82%99%E5%AD%90%E5%B1%8B"
      }
    ]
  },
  "3-C-2": {
    "title": "放好行李 → 燒肉晚餐會合",
    "summary": "先在民宿放行李、休息，17:30 到炭火焼肉おくさこ與 A、B 組會合。若提早抵達，行李寄放須依房東同意方式辦理。",
    "directions": "民宿 → 餐廳依地圖步行，不用先去晴空塔找 A、B 組。",
    "note": "民宿 16:00 入住；沒有房東允許，不能保證提前放行李。",
    "links": [
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      },
      {
        "label": "晚餐地圖",
        "url": "https://maps.app.goo.gl/rWTxzYh2HwmYyaoX8"
      }
    ]
  },
  "3-C-3": {
    "title": "餐後安排",
    "summary": "晚餐後若還有體力，可去晴空塔看夜景；想休息就直接回民宿。",
    "directions": "",
    "note": "晴空塔為選逛，沒有預約觀景台。",
    "links": [
      {
        "label": "東京晴空塔",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC"
      },
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      }
    ]
  },
  "4-0": {
    "title": "出發｜本所吾妻橋 → 青山一丁目",
    "summary": "09:00 出門，搭淺草線到淺草，轉銀座線到青山一丁目；從 1 號出口走到銀杏大道。含轉乘與步行預留約 1 小時。",
    "directions": "本所吾妻橋 A19 搭淺草線（玫瑰紅，西馬込／羽田方向）到淺草 A18，出閘轉銀座線 G19（橘色，澀谷方向）至青山一丁目 G04；1 號出口後步行約 5–10 分鐘。",
    "note": "淺草轉銀座線須依指標換線；不要搭往押上方向。",
    "links": [
      {
        "label": "本所吾妻橋站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E9%A7%85"
      },
      {
        "label": "青山一丁目站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E9%9D%92%E5%B1%B1%E4%B8%80%E4%B8%81%E7%9B%AE%E9%A7%85"
      },
      {
        "label": "明治神宮外苑銀杏大道",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%98%8E%E6%B2%BB%E7%A5%9E%E5%AE%AE%E5%A4%96%E8%8B%91%20%E3%81%84%E3%81%A1%E3%82%87%E3%81%86%E4%B8%A6%E6%9C%A8"
      }
    ],
    "meal": false,
    "rail": true
  },
  "4-1": {
    "title": "上午｜明治神宮外苑銀杏大道",
    "summary": "沿銀杏大道散步、拍照，10:45 左右繼續往表參道；接下來一路往原宿、澀谷，避免逛完再折回外苑。",
    "directions": "散步後往外苑前站；可搭銀座線 1 站至表參道，或依原訂步行路線前往。",
    "note": "",
    "links": [
      {
        "label": "明治神宮外苑銀杏大道",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%98%8E%E6%B2%BB%E7%A5%9E%E5%AE%AE%E5%A4%96%E8%8B%91%20%E3%81%84%E3%81%A1%E3%82%87%E3%81%86%E4%B8%A6%E6%9C%A8"
      },
      {
        "label": "外苑前站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%A4%96%E8%8B%91%E5%89%8D%E9%A7%85"
      },
      {
        "label": "表參道站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E8%A1%A8%E5%8F%82%E9%81%93%E9%A7%85"
      }
    ],
    "meal": false
  },
  "4-2": {
    "title": "逛街｜表參道・原宿",
    "summary": "KIDDY LAND、NUMBER SUGAR 順路選逛。Sweet Check 組先吃再逛；BASO／麺散組先逛再吃，14:15 各自朝澀谷方向走。",
    "directions": "由表參道朝原宿方向逛街；依午餐店位置調整購物先後，餐後不折回 KIDDY LAND。",
    "note": "各組先約好 14:45 在 FREAK’S STORE Shibuya 會合。",
    "links": [
      {
        "label": "KIDDY LAND",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%87%E3%82%A4%E3%83%A9%E3%83%B3%E3%83%89%20%E5%8E%9F%E5%AE%BF%E5%BA%97%20%E6%B8%8B%E8%B0%B7%E5%8C%BA%E7%A5%9E%E5%AE%AE%E5%89%8D6-1-9"
      },
      {
        "label": "NUMBER SUGAR",
        "url": "https://www.google.com/maps/search/?api=1&query=NUMBER%20SUGAR%20%E8%A1%A8%E5%8F%82%E9%81%93%E6%9C%AC%E5%BA%97"
      }
    ],
    "meal": false
  },
  "4-3": {
    "title": "午餐｜三選一",
    "summary": "Sweet Check 11:00、BASO 11:30、麺散 11:30 起可用餐；當天選店，與購物穿插安排。餐後直接往澀谷，不再回原宿集合。",
    "directions": "Sweet Check 在南青山；BASO、麺散在神宮前。依各店地圖到店，14:15 左右往澀谷出發。",
    "note": "BASO 備現金；麺散不收現金與 QR 支付，備信用卡或電子支付。",
    "links": [
      {
        "label": "Sweet Check 蛋包飯",
        "url": "https://maps.app.goo.gl/cq6P7DPSL1NEdmQT8"
      },
      {
        "label": "BASO 蕎麥麵",
        "url": "https://maps.app.goo.gl/XfhefUXyvnTHNSra8"
      },
      {
        "label": "うどん 麺散",
        "url": "https://maps.app.goo.gl/Nf1bBBnExek1mAus5"
      }
    ],
    "meal": true
  },
  "4-4": {
    "title": "步行往澀谷",
    "summary": "午餐與購物結束後，沿貓街、宮下公園方向走到 FREAK’S STORE Shibuya；14:45 會合，途中點心看時間選買。",
    "directions": "原宿／表參道 → 貓街南段 → 宮下公園周邊 → FREAK’S STORE Shibuya。",
    "note": "午餐後不折返原宿；笑たこ等點心在原宿逛街時順買。",
    "links": [
      {
        "label": "FREAK'S STORE Shibuya",
        "url": "https://maps.app.goo.gl/zfRiMG347oqCoXQQ6"
      }
    ],
    "meal": false
  },
  "4-5": {
    "title": "FREAK’S STORE Shibuya",
    "summary": "各組在 FREAK’S STORE Shibuya 會合、逛店，15:30 再一起步行去 PARCO。認明神南 1-13-1 的澀谷店，避免走到其他分店。",
    "directions": "集合地點：FREAK’S STORE Shibuya，神南 1-13-1。集合後依地圖步行至 PARCO。",
    "note": "",
    "links": [
      {
        "label": "FREAK'S STORE Shibuya",
        "url": "https://maps.app.goo.gl/zfRiMG347oqCoXQQ6"
      },
      {
        "label": "澀谷 PARCO",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7PARCO%20%E5%AE%87%E7%94%B0%E5%B7%9D%E7%94%BA15-1"
      }
    ],
    "meal": false,
    "extra": "週二 12:00–20:00。"
  },
  "4-6": {
    "title": "購物｜澀谷 PARCO",
    "summary": "從 FREAK’S STORE 走到 PARCO，先逛想看的樓層，17:00 到 B1 分開吃晚餐；把候位時間留給極味屋。",
    "directions": "FREAK’S STORE Shibuya → 澀谷 PARCO；餐廳在 B1。",
    "note": "一般商店與餐廳營業時間不同；先逛商店再用餐。",
    "links": [
      {
        "label": "澀谷 PARCO",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7PARCO%20%E5%AE%87%E7%94%B0%E5%B7%9D%E7%94%BA15-1"
      }
    ],
    "meal": false,
    "extra": "一般商店 11:00–21:00。"
  },
  "4-7": {
    "title": "晚餐｜PARCO B1 分開用餐",
    "summary": "吃牛的 5 位排極味屋；另 2 位（1 位不吃牛、1 位陪同）在館內選店，真さか可作候選。先約好餐後會合點，再各自入座。",
    "directions": "兩組都在 PARCO B1 用餐；餐後在約定地點會合，接著往唐吉訶德或澀谷站。",
    "note": "極味屋不接受訂位，5 位可能分開入座；候位較久就縮短後面的自由購物。",
    "links": [
      {
        "label": "極味屋 澀谷 PARCO 店",
        "url": "https://maps.app.goo.gl/PW2hqEnuummDrjFH8"
      },
      {
        "label": "真さか",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%83%B4%E3%82%A3%E3%83%BC%E3%82%AC%E3%83%B3%E5%B1%85%E9%85%92%E5%B1%8B%20%E7%9C%9F%E3%81%95%E3%81%8B%20%E6%B8%8B%E8%B0%B7PARCO%20B1"
      }
    ],
    "meal": true
  },
  "4-8": {
    "title": "晚餐後｜MEGA 唐吉訶德",
    "summary": "餐後有時間就逛 MEGA 唐吉訶德，再往澀谷站；若候位較久或想休息，可直接回民宿，不必為購物繞回 PARCO。",
    "directions": "PARCO → MEGA 唐吉訶德澀谷本店 → 澀谷站。",
    "note": "先回民宿的人在群組告知，避免大家等候。",
    "links": [
      {
        "label": "MEGA 唐吉訶德 澀谷本店",
        "url": "https://www.google.com/maps/search/?api=1&query=MEGA%E3%83%89%E3%83%B3%E3%83%BB%E3%82%AD%E3%83%9B%E3%83%BC%E3%83%86%E6%B8%8B%E8%B0%B7%E6%9C%AC%E5%BA%97"
      },
      {
        "label": "澀谷站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7%E9%A7%85"
      }
    ],
    "meal": false
  },
  "4-9": {
    "title": "回程｜澀谷站八公口",
    "summary": "依約定時間在八公口站外會合、點名，再一起搭地鐵回本所吾妻橋；八公口是集合地標，乘車請找半藏門線 Z 的指標。",
    "directions": "澀谷 Z01 搭半藏門線（紫色，押上方向）至押上 Z14，轉淺草線 A20（玫瑰紅，西馬込／羽田方向）至本所吾妻橋 A19。",
    "note": "八公口附近有 JR 與地鐵入口，不要直接跟著 JR 人潮進閘。",
    "links": [
      {
        "label": "澀谷站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7%E9%A7%85"
      },
      {
        "label": "本所吾妻橋站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E9%A7%85"
      },
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      }
    ],
    "meal": false,
    "rail": true
  },
  "5-0": {
    "title": "早餐｜Mūya",
    "summary": "09:00 從民宿出門，沿隅田川方向走到 Mūya；09:30–10:15 早餐後往淺草寺。若候位久就外帶，留時間逛寺院與準時午餐。",
    "directions": "東京民宿 → 隅田川步道 → Mūya，步行約 20–30 分鐘。",
    "note": "",
    "links": [
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      },
      {
        "label": "隅田川步道",
        "url": "https://www.google.com/maps/search/?api=1&query=%E9%9A%85%E7%94%B0%E5%B7%9D%E3%83%86%E3%83%A9%E3%82%B9%20%E5%90%BE%E5%A6%BB%E6%A9%8B"
      },
      {
        "label": "Mūya",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%82%80%E3%81%86%E3%82%84%20%E6%9D%B1%E4%BA%AC%E3%83%9F%E3%82%BA%E3%83%9E%E3%83%81"
      }
    ],
    "meal": false
  },
  "5-1": {
    "title": "淺草寺・仲見世散步",
    "summary": "從 Mūya 過河往淺草寺、仲見世，10:30–11:30 參拜逛街；11:30 起往各自午餐店移動，牛舌組須在 12:00 訂位前到店。",
    "directions": "Mūya → 隅田公園／吾妻橋過河 → 淺草寺 → 仲見世。",
    "note": "12:00 牛舌訂位優先，排隊買小吃不要壓縮到店時間。",
    "links": [
      {
        "label": "淺草寺",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%B7%BA%E8%8D%89%E5%AF%BA%20%E6%9D%B1%E4%BA%AC"
      },
      {
        "label": "仲見世商店街",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%BB%B2%E8%A6%8B%E4%B8%96%E5%95%86%E5%BA%97%E8%A1%97%20%E6%9D%B1%E4%BA%AC"
      }
    ],
    "meal": false
  },
  "5-2": {
    "title": "午餐｜5 人訂位、2 人自由選店",
    "summary": "12:00 牛舌店已訂 5 位，分 3 人與 2 人兩筆；另 2 位（1 位不吃牛、1 位陪同）自由選店，麺みつヰ、秋光保留候選。13:15 雷門會合。",
    "directions": "牛舌組到牛たんの檸檬淺草店；另 2 位依候選店地圖前往。餐後一起到雷門，再搭車往淺草橋。",
    "note": "牛舌訂位停留 1 小時；兩筆訂位資訊見「已預約 → DAY 05」。候選店湯底、醬汁是否含牛需向店員確認。",
    "links": [
      {
        "label": "牛たんの檸檬 淺草店",
        "url": "https://maps.app.goo.gl/K4QdwtcbFczYAsTPA"
      },
      {
        "label": "麺 みつヰ",
        "url": "https://www.google.com/maps/search/?api=1&query=%E9%BA%BA%20%E3%81%BF%E3%81%A4%E3%83%B0%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E5%AF%BF2-9-15"
      },
      {
        "label": "天麩羅秋光",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%A4%A9%E9%BA%A9%E7%BE%85%20%E7%A7%8B%E5%85%89%20%E6%B5%85%E8%8D%89%E6%9C%AC%E5%BA%97"
      },
      {
        "label": "訂位資料",
        "url": "?view=bookings&bday=5"
      }
    ],
    "meal": true
  },
  "5-3": {
    "title": "淺草小吃｜順路選一",
    "summary": "午餐前後有空再選買花月堂、壽壽喜園或龜十，選一家分食即可；遇到長隊就略過，13:15 回雷門會合，留足淺草橋與休息時間。",
    "directions": "各自用餐後向雷門方向集合；小吃店位置不同，按地圖挑順路的一家。",
    "note": "小吃為選逛，不須全部買齊；不要為排隊延後集合。",
    "links": [
      {
        "label": "花月堂菠蘿麵包",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E8%8A%B1%E6%9C%88%E5%A0%82+%E6%9C%AC%E5%BA%97"
      },
      {
        "label": "壽壽喜園抹茶冰淇淋",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%A3%BD%E3%80%85%E5%96%9C%E5%9C%92+%E6%B5%85%E8%8D%89%E6%9C%AC%E5%BA%97"
      },
      {
        "label": "龜十銅鑼燒",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%BA%80%E5%8D%81+%E6%B5%85%E8%8D%89"
      }
    ],
    "meal": false,
    "extra": "花月堂本店、壽壽喜園 11:00 開門；龜十依現場排隊決定。"
  },
  "5-4": {
    "title": "午後｜銀杏岡八幡神社・シモジマ",
    "summary": "雷門會合後搭淺草線到淺草橋，A3 出口先去銀杏岡八幡神社，再逛シモジマ本店；15:00 左右離開，保留回民宿休息的時間。",
    "directions": "淺草 A18 搭淺草線（玫瑰紅，西馬込／羽田方向）2 站至淺草橋 A16；A3 出口步行約 2–3 分鐘到神社，再步行約 5 分鐘到シモジマ。",
    "note": "淺草與淺草橋是不同車站；搭車會經過藏前。",
    "links": [
      {
        "label": "銀杏岡八幡神社",
        "url": "https://www.google.com/maps/search/?api=1&query=%E9%8A%80%E6%9D%8F%E5%B2%A1%E5%85%AB%E5%B9%A1%E7%A5%9E%E7%A4%BE%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-29-11"
      },
      {
        "label": "シモジマ淺草橋本店",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%82%B7%E3%83%A2%E3%82%B8%E3%83%9E%20%E6%B5%85%E8%8D%89%E6%A9%8B%E6%9C%AC%E5%BA%97%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-30-10"
      }
    ],
    "meal": false,
    "rail": true,
    "extra": "銀杏岡八幡神社授與所 09:30–16:30；シモジマ淺草橋本店 09:30–19:00。"
  },
  "5-5": {
    "title": "回民宿休息",
    "summary": "15:00 左右從淺草橋搭車回本所吾妻橋，約 15:30 到民宿放購物袋、休息；16:30 再出發去日比谷，晚間不用提著白天買的物品。",
    "directions": "淺草橋 A16 搭淺草線（玫瑰紅，押上方向）3 站至本所吾妻橋 A19，再步行回民宿。",
    "note": "",
    "links": [
      {
        "label": "本所吾妻橋站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E9%A7%85"
      },
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      }
    ],
    "meal": false,
    "rail": true
  },
  "5-6": {
    "title": "外帶｜PATISSERIE TEN&",
    "summary": "16:30 民宿出門，到日比谷 OKUROJI 的 TEN& 外帶，預計 17:30–18:00 取餐。指定甜點可先選外帶預訂，取餐後步行去有樂町 HARBS。",
    "directions": "本所吾妻橋 A19 搭淺草線（玫瑰紅，西馬込／羽田方向）至新橋 A10，往 JR 日比谷口一側出地面，沿鐵路高架旁步行到 OKUROJI。",
    "note": "週三傍晚外帶自 17:30 起；店內採無現金支付，外帶預訂須信用卡預付。",
    "links": [
      {
        "label": "PATISSERIE TEN&",
        "url": "https://www.google.com/maps/search/?api=1&query=PATISSERIE%20TEN%26%20%E6%97%A5%E6%AF%94%E8%B0%B7OKUROJI"
      },
      {
        "label": "TEN& 外帶預訂",
        "url": "https://www.tablecheck.com/ja/shops/patisserie-ten-okuroji/reserve"
      }
    ],
    "meal": false,
    "extra": "週三傍晚外帶 17:30–20:00。",
    "rail": true
  },
  "5-7": {
    "title": "甜點｜HARBS LUMINE 有樂町店",
    "summary": "沿高架旁步行約 10–15 分鐘，到 LUMINE 有樂町 1 館 2F。18:00–19:00 有位內用、滿席外帶，再去日比谷站搭車往六本木。",
    "directions": "TEN& → 有樂町方向 → LUMINE 有樂町 1 館 2F；用餐後步行往日比谷站。",
    "note": "外帶前告知店員稍後還要逛市集，確認保冷時間。",
    "links": [
      {
        "label": "HARBS LUMINE 有樂町店",
        "url": "https://www.google.com/maps/search/?api=1&query=HARBS%20%E3%83%AB%E3%83%9F%E3%83%8D%E6%9C%89%E6%A5%BD%E7%94%BA%E5%BA%97%20%E6%9C%89%E6%A5%BD%E7%94%BA2-5-1"
      },
      {
        "label": "HARBS 保冷說明",
        "url": "https://www.harbs.co.jp/qa/"
      }
    ],
    "meal": false,
    "extra": "不接受座位預約。內用最後點餐 20:00、外帶至 21:00；冬季外帶建議 1 小時內冷藏，有保冷袋約 2 小時。"
  },
  "5-8": {
    "title": "六本木新城聖誕市集",
    "summary": "由日比谷搭地鐵到六本木，約 19:30 到大屋頂廣場逛聖誕市集，再沿周邊看點燈；晚餐現場選擇，市集 21:00 結束。",
    "directions": "日比谷 H08 搭日比谷線（灰色，中目黑方向）至六本木 H04；1c 出口通往六本木新城，依指標到大屋頂廣場。",
    "note": "市集在大屋頂廣場；點燈區與市集位置不同，跟著步行指標走。",
    "links": [
      {
        "label": "六本木聖誕官方網站",
        "url": "https://www.christmas.hills-site.com/"
      }
    ],
    "meal": false,
    "extra": "市集 11/21–12/25，11:00–21:00；櫸樹坂點燈至 22:00。",
    "rail": true,
    "car": "往中目黑方向：第 5 車廂附近接 Hills 手扶梯，第 7 車廂附近為電梯／樓梯；不是往大江戶線的第 1～2 車廂端。"
  },
  "6-0": {
    "title": "東京 → 日光｜已訂妥",
    "summary": "07:50 退房出門，08:30 到東武淺草站。搭已訂 09:00 SPACIA X 003，10:50 抵達東武日光；已訂 Premium seat。",
    "directions": "從東京民宿步行前往東武淺草站，依 SPACIA X 指標找月台；車廂與座位看手機車票。",
    "note": "要找「東武」淺草站，避免走進都營或 Metro 淺草站。",
    "links": [
      {
        "label": "東武淺草站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%B5%85%E8%8D%89%E9%A7%85"
      },
      {
        "label": "東武日光站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85"
      },
      {
        "label": "已預約車票",
        "url": "./?view=bookings&bday=6"
      }
    ],
    "meal": false,
    "extra": "10:50 抵達後，可先在站內旅客服務中心購買中禪寺溫泉兩日券，再前往 mekke。"
  },
  "6-1": {
    "title": "抵達後先寄物",
    "summary": "出站後先寄行李再用餐。沿日光街道往神橋方向走到 mekke，拖行李預留約 20 分鐘；民宿不接受提前寄放，mekke 尚待確認空位。",
    "directions": "東武日光站 → 沿日光街道往神橋方向 → mekke 日光郷土センター（日光市御幸町591）。",
    "note": "行李收件空間先確認；30 吋箱要提供含輪子、把手的外尺寸。",
    "links": [
      {
        "label": "東武日光站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85"
      },
      {
        "label": "mekke 日光郷土センター",
        "url": "https://www.google.com/maps/search/?api=1&query=mekke%20%E6%97%A5%E5%85%89%E9%83%B7%E5%9C%9F%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%20%E6%97%A5%E5%85%89%E5%B8%82%E5%BE%A1%E5%B9%B8%E7%94%BA591"
      },
      {
        "label": "寄物預約",
        "url": "https://www.mekke-nikko.com/luggagestorage-reservation"
      },
      {
        "label": "寄物費用與備案",
        "url": "./?view=guide#nikko-luggage-info"
      }
    ],
    "meal": false,
    "extra": "mekke 09:00–17:00；每人最多 2 件、2 件以內 ¥1,000。行李合計費用先詢問，保留收據，16:15–16:30 回來取件。"
  },
  "6-2": {
    "title": "午餐後前往東照宮",
    "summary": "11:30–12:45 在日光街道午餐。餐後從 mekke 附近搭巴士到西参道入口，再步行去東照宮；直接順路上山，省去折返車站。",
    "directions": "",
    "note": "午餐候位太久就換附近店家；可分桌，1 位不吃牛，點餐前確認湯底與醬汁。",
    "links": [
      {
        "label": "日光郷土センター前",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E9%83%B7%E5%9C%9F%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%E5%89%8D%20%E3%83%90%E3%82%B9%E5%81%9C"
      },
      {
        "label": "西参道入口",
        "url": "https://www.google.com/maps/search/?api=1&query=%E8%A5%BF%E5%8F%82%E9%81%93%E5%85%A5%E5%8F%A3%20%E6%97%A5%E5%85%89%20%E3%83%90%E3%82%B9%E5%81%9C"
      },
      {
        "label": "日光巴士站牌與班次",
        "url": "site-two/index.html"
      }
    ],
    "meal": false
  },
  "6-3": {
    "title": "日光東照宮",
    "summary": "13:30–15:15 參觀東照宮，先看陽明門、三猿、眠貓與主要社殿。奧宮階梯依體力決定；成人參拜券 ¥1,600，不含寶物館。",
    "directions": "從西参道入口站下車，依東照宮指標步行進入參道；參觀後沿表參道下坡往神橋。",
    "note": "11 月 16:00 關門、15:30 最後入場；若前段延誤，縮短奧宮或購物，保留取件時間。",
    "links": [
      {
        "label": "日光東照宮",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E6%9D%B1%E7%85%A7%E5%AE%AE"
      },
      {
        "label": "參拜與門票",
        "url": "https://toshogu.jp/pages/25/"
      }
    ],
    "meal": false,
    "extra": "11 月 09:00–16:00，15:30 最後入場。"
  },
  "6-4": {
    "title": "神橋外觀拍照",
    "summary": "15:15 從東照宮沿參道下坡，步行約 10–15 分鐘到神橋，在橋外拍照後往寄物處走。這段不安排付費渡橋。",
    "directions": "東照宮 → 表參道下坡 → 神橋；在公共道路一側拍照。",
    "note": "渡橋 15:30 結束，目前時段以橋外拍照為主。",
    "links": [
      {
        "label": "日光東照宮",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E6%9D%B1%E7%85%A7%E5%AE%AE"
      },
      {
        "label": "神橋",
        "url": "https://www.google.com/maps/search/?api=1&query=%E7%A5%9E%E6%A9%8B%20%E6%97%A5%E5%85%89%E5%B8%82%E4%B8%8A%E9%89%A2%E7%9F%B3%E7%94%BA"
      }
    ],
    "meal": false
  },
  "6-5": {
    "title": "日光街道順路散步",
    "summary": "從神橋沿日光街道往 mekke 走，沿途短逛或買布丁；約 16:15 回到寄物處。不要先走回車站，mekke 就在途中。",
    "directions": "神橋 → 沿日光街道往東武日光站方向 → mekke；日光ぷりん亭可順路短停。",
    "note": "布丁店若排隊就略過，先確保能在關門前取行李。",
    "links": [
      {
        "label": "神橋",
        "url": "https://www.google.com/maps/search/?api=1&query=%E7%A5%9E%E6%A9%8B%20%E6%97%A5%E5%85%89%E5%B8%82%E4%B8%8A%E9%89%A2%E7%9F%B3%E7%94%BA"
      },
      {
        "label": "mekke 日光郷土センター",
        "url": "https://www.google.com/maps/search/?api=1&query=mekke%20%E6%97%A5%E5%85%89%E9%83%B7%E5%9C%9F%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%20%E6%97%A5%E5%85%89%E5%B8%82%E5%BE%A1%E5%B9%B8%E7%94%BA591"
      },
      {
        "label": "日光ぷりん亭",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E3%81%B7%E3%82%8A%E3%82%93%E4%BA%AD%20%E6%97%A5%E5%85%89%E6%9C%AC%E5%BA%97"
      }
    ],
    "meal": false,
    "extra": "日光ぷりん亭 10:00–17:00、不定休；不為購物延後取件。"
  },
  "6-6": {
    "title": "取回行李",
    "summary": "16:15–16:30 回原寄物處出示收據取件，最晚 17:00 前完成。若早上改寄站內 Yamato，就回車站取件，不必再去 mekke。",
    "directions": "mekke 取件後直接前往民宿；改用 Yamato 的話，先回原寄放車站取件，再去民宿。",
    "note": "17:00 後無法取件；前段延誤時，先縮短沿街購物。",
    "links": [
      {
        "label": "mekke 日光郷土センター",
        "url": "https://www.google.com/maps/search/?api=1&query=mekke%20%E6%97%A5%E5%85%89%E9%83%B7%E5%9C%9F%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%20%E6%97%A5%E5%85%89%E5%B8%82%E5%BE%A1%E5%B9%B8%E7%94%BA591"
      },
      {
        "label": "東武日光站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85"
      },
      {
        "label": "寄物費用與備案",
        "url": "./?view=guide#nikko-luggage-info"
      }
    ],
    "meal": false
  },
  "6-7": {
    "title": "民宿入住、自由晚餐",
    "summary": "取件後前往日光民宿，約 16:45–17:15 入住；依房東訊息操作玄關鑰匙盒。晚餐當天決定，晚上備好隔天湖區的保暖與暈車用品。",
    "directions": "從原寄物處依民宿地圖前往，不再多排站前購物；站前商店已留在隔天下午。",
    "note": "民宿 15:00 起可入住，未包含溫泉晚餐。",
    "links": [
      {
        "label": "日光民宿",
        "url": "https://maps.app.goo.gl/xPXoTRvUER7Yosbm6"
      }
    ],
    "meal": false
  },
  "7-0": {
    "title": "早餐後搭車上山",
    "summary": "08:40 出門，08:50 前到東武日光站 2A 排隊。搭 09:05 YK 往湯元溫泉，09:50 在中禪寺溫泉下車；之後步行到華嚴瀑布。",
    "directions": "",
    "note": "伊呂波坂彎道多，會暈車的人先準備。出門前看運行公告；強風、雨雪、結冰或巴士停駛時，留日光市區，不勉強上山。",
    "links": [
      {
        "label": "東武日光站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85"
      },
      {
        "label": "中禪寺溫泉巴士站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B8%A9%E6%B3%89%20%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB"
      },
      {
        "label": "官方巴士時刻表",
        "url": "https://www.tobu-bus.com/pc/assets/pdf/nikko_timetable_summer.pdf?20260408="
      },
      {
        "label": "日光巴士站牌與班次",
        "url": "site-two/index.html"
      }
    ],
    "meal": false
  },
  "7-1": {
    "title": "華嚴瀑布",
    "summary": "從中禪寺溫泉站步行約 5 分鐘到華嚴瀑布，10:00–11:00 留給觀瀑、排隊與拍照。電梯成人往返 ¥600，濃霧或停運時縮短停留。",
    "directions": "中禪寺溫泉巴士站 → 步行到華嚴瀑布；搭電梯可到下方觀瀑台。",
    "note": "巴士券不含電梯；水量、能見度及運行依現場情況。",
    "links": [
      {
        "label": "中禪寺溫泉巴士站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B8%A9%E6%B3%89%20%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB"
      },
      {
        "label": "華嚴瀑布",
        "url": "https://www.google.com/maps/search/?api=1&query=%E8%8F%AF%E5%8E%B3%E3%81%AE%E6%BB%9D%20%E6%97%A5%E5%85%89"
      },
      {
        "label": "電梯營業與費用",
        "url": "https://www.kegon.jp/info/"
      }
    ],
    "meal": false,
    "extra": "11 月電梯 08:00–17:00。"
  },
  "7-2": {
    "title": "湖畔短程散步",
    "summary": "11:00–11:30 從瀑布走回中禪寺湖畔，在巴士站附近看湖、拍男體山。這段只作短程散步，不環湖，保留午餐與休息時間。",
    "directions": "華嚴瀑布 → 返回中禪寺溫泉站附近 → 站前湖岸。",
    "note": "強風、雨雪或結冰時改進室內休息。",
    "links": [
      {
        "label": "華嚴瀑布",
        "url": "https://www.google.com/maps/search/?api=1&query=%E8%8F%AF%E5%8E%B3%E3%81%AE%E6%BB%9D%20%E6%97%A5%E5%85%89"
      },
      {
        "label": "中禪寺湖",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B9%96%20%E6%97%A5%E5%85%89"
      },
      {
        "label": "中禪寺溫泉巴士站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B8%A9%E6%B3%89%20%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB"
      }
    ],
    "meal": false
  },
  "7-3": {
    "title": "湖區午餐、坐下休息",
    "summary": "11:30–13:00 在湖畔或巴士站附近午餐。留 60 分鐘吃飯、30 分鐘候位與休息；可分桌，隊伍太長就換附近店家。",
    "directions": "沿站前湖畔就近選店，不另外搭車或走到遠處。",
    "note": "餐廳未預約；1 位不吃牛肉，先確認湯底、醬汁與配料。",
    "links": [],
    "meal": false
  },
  "7-4": {
    "title": "湖畔自由時間",
    "summary": "午餐後在站前湖畔小逛或喝咖啡；約 14:00 開始回站，14:10–14:15 到 26B 排隊。這段也預留給上午巴士或用餐延誤。",
    "directions": "從湖畔步行回中禪寺溫泉巴士站，找往 JR／東武日光方向的 26B 乘車處。",
    "note": "天冷就提早回候車室，不另加遠處景點。",
    "links": [
      {
        "label": "中禪寺湖",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B9%96%20%E6%97%A5%E5%85%89"
      },
      {
        "label": "中禪寺溫泉巴士站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B8%A9%E6%B3%89%20%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB"
      }
    ],
    "meal": false
  },
  "7-5": {
    "title": "14:30 搭車下山",
    "summary": "在中禪寺溫泉 26B 搭 14:30 YK 下山，表定 15:06 到東武日光。回程仍用同張有效兩日券；若延誤，就縮短站前自由購物。",
    "directions": "",
    "note": "14:30 不是末班車；若滿車，向站務人員確認後續車班。",
    "links": [
      {
        "label": "中禪寺溫泉巴士站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B8%A9%E6%B3%89%20%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB"
      },
      {
        "label": "東武日光站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85"
      },
      {
        "label": "官方巴士時刻表",
        "url": "https://www.tobu-bus.com/pc/assets/pdf/nikko_timetable_summer.pdf?20260408="
      },
      {
        "label": "日光巴士站牌與班次",
        "url": "site-two/index.html"
      }
    ],
    "meal": false
  },
  "7-6": {
    "title": "站前自由逛｜可直接回民宿",
    "summary": "15:15–16:15 在東武日光站前挑 1～2 家店：さかえや炸湯波饅頭、CHEESE GARDEN 或 ACCESS 土產店；排隊長就略過，累了可直接回民宿。",
    "directions": "三家都在東武日光站前；ACCESS 在改札外候車室，其他兩家沿站前街道步行前往。",
    "note": "店家可自由選逛，不用走滿一小時。",
    "links": [
      {
        "label": "日光さかえや",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E3%81%95%E3%81%8B%E3%81%88%E3%82%84%20%E6%9D%BE%E5%8E%9F%E7%94%BA10-1"
      },
      {
        "label": "CHEESE GARDEN THE NIKKO",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%83%81%E3%83%BC%E3%82%BA%E3%82%AC%E3%83%BC%E3%83%87%E3%83%B3%20THE%20NIKKO%20%E6%9D%BE%E5%8E%9F%E7%94%BA8-1"
      },
      {
        "label": "ACCESS 東武日光站店",
        "url": "https://www.google.com/maps/search/?api=1&query=ACCESS%20%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85"
      },
      {
        "label": "さかえや攻略",
        "url": "restaurant-guide/venues/27-nikko-sakaeya.html"
      },
      {
        "label": "CHEESE GARDEN",
        "url": "https://shoplist.cheesegarden.jp/detail/002/"
      },
      {
        "label": "ACCESS",
        "url": "https://www.tobushoji.co.jp/service/ekinaka/"
      }
    ],
    "meal": false,
    "extra": "さかえや 09:30–17:00；CHEESE GARDEN 09:00–18:00（部分甜食 17:00、飲料等 17:30 最後點餐）；ACCESS 08:00–18:10。"
  },
  "7-7": {
    "title": "回民宿休息、自由晚餐",
    "summary": "約 16:30 回日光民宿，晚餐當天決定。晚上洗衣、整理行李並休息；隔天 07:45 集合，08:00 已訂包車往成田。",
    "directions": "從東武日光站步行回民宿，約 7 分鐘，依步速預留 10–15 分鐘。",
    "note": "隔天需帶全部行李退房，今晚先整理。",
    "links": [
      {
        "label": "日光民宿",
        "url": "https://maps.app.goo.gl/xPXoTRvUER7Yosbm6"
      },
      {
        "label": "隔日包車資料",
        "url": "./?view=bookings&bday=8"
      }
    ],
    "meal": false
  },
  "8-0": {
    "title": "日光 → 成田｜包車",
    "summary": "07:45 退房集合，08:00 搭已訂 Hiace 往成田里士滿飯店，先寄行李並詢問隔日 08:20 接駁登記。表參道有交通管制，從飯店步行前往。",
    "directions": "日光民宿門口上車 → Richmond Hotel Narita 下車寄物 → 步行往成田山表參道。",
    "note": "若接駁須入住後登記，14:00 後、去 AEON 前先辦入住；7 個座位未確認。",
    "links": [
      {
        "label": "日光民宿",
        "url": "https://maps.app.goo.gl/xPXoTRvUER7Yosbm6"
      },
      {
        "label": "成田里士滿飯店",
        "url": "https://maps.app.goo.gl/2XG4HEaMg9eHVKVZ6"
      },
      {
        "label": "已預約包車",
        "url": "./?view=bookings&bday=8"
      },
      {
        "label": "接送憑證PDF",
        "url": "assets/nikko-narita-transfer-voucher-2026-11-28.pdf"
      },
      {
        "label": "官方交通管制",
        "url": "https://www.nrtk.jp/news/20261013.html"
      }
    ],
    "meal": false,
    "extra": "已訂 Toyota Hiace，車資已付。預計前一天透過 WeChat／WhatsApp 收到司機資料；上車前主動確認等候位置。"
  },
  "8-1": {
    "title": "午餐｜成田山表參道",
    "summary": "從飯店步行到成田山表參道，先到川豐本店取號，再依叫號用餐；若候位太久或想吃其他料理，就在表參道附近選店。",
    "directions": "Richmond Hotel Narita → 成田山表參道 → 川豐本店。",
    "note": "先取號才知道候位時間，之後再決定是否等候。",
    "links": [
      {
        "label": "成田山表參道",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E8%A1%A8%E5%8F%82%E9%81%93"
      },
      {
        "label": "川豐本店",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%B7%9D%E8%B1%8A+%E6%9C%AC%E5%BA%97+%E6%88%90%E7%94%B0"
      }
    ],
    "meal": false
  },
  "8-2": {
    "title": "下午｜新勝寺・紅葉祭・米屋",
    "summary": "步行逛新勝寺大本堂、成田山公園紅葉祭，再回表參道買米屋。公園約留 45–60 分鐘，16:40 左右往京成成田站；提早抵達才加看演奏或茶會。",
    "directions": "表參道 → 新勝寺大本堂 → 成田山公園 → 原路回表參道的なごみの米屋 → 京成成田站。",
    "note": "13:30 演奏早於下午主行程；只有提早抵達才參加，不為活動更動路線。",
    "links": [
      {
        "label": "新勝寺大本堂",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E6%96%B0%E5%8B%9D%E5%AF%BA%20%E5%A4%A7%E6%9C%AC%E5%A0%82"
      },
      {
        "label": "成田山公園",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E5%85%AC%E5%9C%92"
      },
      {
        "label": "なごみの米屋",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%81%AA%E3%81%94%E3%81%BF%E3%81%AE%E7%B1%B3%E5%B1%8B%20%E7%B7%8F%E6%9C%AC%E5%BA%97%20%E6%88%90%E7%94%B0%E5%B8%82%E4%B8%8A%E7%94%BA500"
      },
      {
        "label": "京成成田站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%BA%AC%E6%88%90%E6%88%90%E7%94%B0%E9%A7%85"
      },
      {
        "label": "紅葉祭活動資訊",
        "url": "https://www.nrtk.jp/enjoy/shikisaisai/autumn-festival.html"
      }
    ],
    "meal": false,
    "extra": "紅葉祭 11/14–11/29；11/28 演奏 11:00、13:30，茶會約 10:00–15:00，額滿提早結束。若接駁需入住後登記，去 AEON 前先回飯店辦理。"
  },
  "8-3": {
    "title": "傍晚｜AEON MALL 成田",
    "summary": "京成成田站 6 號搭 17:15／17:47 直行巴士，單程 ¥220、可刷 IC。回程選 20:28 星巴克前或 20:29 Mall East；這是同一班車的相鄰兩站。",
    "directions": "京成成田站 6 號 → AEON MALL；回程在全團約好的站牌上車 → 京成成田站，再步行約 5 分鐘回飯店。",
    "note": "前門上車先付費；回程兩站擇一集合，不要把 20:28／20:29 當成兩班車。",
    "links": [
      {
        "label": "京成成田站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E4%BA%AC%E6%88%90%E6%88%90%E7%94%B0%E9%A7%85"
      },
      {
        "label": "AEON MALL 成田",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%82%A4%E3%82%AA%E3%83%B3%E3%83%A2%E3%83%BC%E3%83%AB%E6%88%90%E7%94%B0"
      },
      {
        "label": "AEON巴士時刻表",
        "url": "#day8-aeon-bus"
      },
      {
        "label": "成田里士滿飯店",
        "url": "https://maps.app.goo.gl/2XG4HEaMg9eHVKVZ6"
      }
    ],
    "meal": false,
    "extra": "去程備案 18:30；回程備案 21:05 星巴克前／21:06 Mall East。車程約 10 分鐘，專門店 21:00 關門。"
  },
  "9-0": {
    "title": "飯店 → 成田 T2",
    "summary": "已登記接駁座位者 08:05 大廳集合、08:20 發車，約 08:40 到成田 T2。先完成免稅品海關攜出確認，再辦報到與托運。",
    "directions": "飯店接駁 → 成田 T2 → 依指標完成護照／免稅品攜出確認 → 航空公司報到櫃檯。",
    "note": "免稅商品完成海關確認前不要托運；接駁座位前晚登記，滿位就用京成電車備案。",
    "links": [
      {
        "label": "成田里士滿飯店",
        "url": "https://maps.app.goo.gl/2XG4HEaMg9eHVKVZ6"
      },
      {
        "label": "接駁備案",
        "url": "./?view=guide#narita-shuttle-fallback"
      },
      {
        "label": "成田入境退稅出境說明",
        "url": "airport-guide/index.html#departure"
      }
    ],
    "meal": false,
    "extra": "08:15 前上車。虎航約 10:30 開櫃，以當天公告為準；若無接駁座位，08:00 離開飯店改搭京成電車。"
  },
  "9-1": {
    "title": "機場伴手禮",
    "summary": "完成海關確認與托運後，先逛本館 4F 安檢前商店，再過安檢到本館 3F Fa-So-La。想買的先看清單，接近登機時間就直接往登機門。",
    "directions": "成田 T2 本館 4F（安檢前）→ 安檢與出境審查 → 本館 3F Fa-So-La（安檢後）→ 登機門。",
    "note": "安檢前、後的店不能自由往返；先完成海關與托運，再按登機時間安排購物。",
    "links": [
      {
        "label": "機場購物清單",
        "url": "./?view=airport"
      },
      {
        "label": "成田T2購物詳細",
        "url": "site-three/index.html"
      }
    ],
    "meal": false
  },
  "9-2": {
    "title": "回台灣",
    "summary": "A、C 組搭 IT281，13:00 從成田起飛；B 組搭 CI101，14:35 起飛、17:45 抵達桃園。依登機證與當天看板確認登機門及登機時間。",
    "directions": "通過安檢與出境審查後，依當天看板的登機門號碼前進，按登機證所列時間到門口集合。",
    "note": "起飛時間不是登機時間；以登機證列出的時間到登機門集合。",
    "links": [
      {
        "label": "航班交通",
        "url": "./?view=flights"
      }
    ],
    "meal": false
  }
};

  const readingRoutes = [
  {
    "key": "yanaka",
    "title": "谷根千｜根津 → 谷中銀座 → 日暮里",
    "steps": [
      {
        "time": "09:00 出門",
        "title": "民宿 → 晴空塔站前 → 根津",
        "text": "步行約 15–20 分鐘到「とうきょうスカイツリー駅前」2 番站牌，搭上 26「上野公園行」，在根津駅前下車。前門上車刷 IC 卡付款、後門下車；11/23 查假日班表，不預設固定班次。"
      },
      {
        "time": "約 10:10–10:50",
        "title": "根津神社",
        "text": "根津駅前下車後步行約 5–10 分鐘，參拜樓門、社殿與千本鳥居。巴士若延誤，就縮短停留，仍照原路往谷中銀座走。"
      },
      {
        "time": "約 10:50–11:15",
        "title": "根津 → 千駄木 → 谷中銀座",
        "text": "沿步行地圖往谷中銀座走，路上拍照可短停。不另繞住宅巷弄，保留老街散步時間。"
      },
      {
        "time": "約 11:15–12:00",
        "title": "谷中銀座商店街",
        "text": "逛老街、買小吃分食；部分店家較晚開門，遇長隊就略過。接著往夕やけだんだん方向走，不走回頭路。"
      },
      {
        "time": "約 12:00–12:15",
        "title": "夕やけだんだん → 日暮里站",
        "text": "經夕やけだんだん階梯走到日暮里站，準備搭京成線回晴空塔。"
      },
      {
        "time": "約 12:15 起",
        "title": "日暮里 → 青砥 → 押上",
        "text": "搭京成本線往青砥方向，在青砥依指標轉京成押上線往押上；用一般列車，不需 Skyliner 特急券。含候車約 40–50 分鐘，到押上後步行至 Solamachi。"
      },
      {
        "time": "約 13:00 起",
        "title": "晴空塔 Solamachi",
        "text": "自行午餐、逛街，午餐沒有訂位，可依到達時間順延。晚餐前到炭火焼肉おくさこ與 C 組會合。"
      }
    ],
    "note": "延誤時縮短根津神社或谷中銀座停留，不追加景點；日暮里本來就是回程上車站。",
    "alternatives": [],
    "links": [
      {
        "label": "谷根千步行地圖 ↗",
        "url": "https://www.google.com/maps/dir/?api=1&origin=%E6%A0%B9%E6%B4%A5%E9%A7%85%E5%89%8D%20%E3%83%90%E3%82%B9%E5%81%9C&destination=%E6%97%A5%E6%9A%AE%E9%87%8C%E9%A7%85&travelmode=walking&waypoints=%E6%A0%B9%E6%B4%A5%E7%A5%9E%E7%A4%BE%7C%E8%B0%B7%E4%B8%AD%E9%8A%80%E5%BA%A7%E5%95%86%E5%BA%97%E8%A1%97%7C%E5%A4%95%E3%82%84%E3%81%91%E3%81%A0%E3%82%93%E3%81%A0%E3%82%93"
      },
      {
        "label": "東京民宿",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A2%A8%E7%94%B0%E5%8C%BA%E6%9D%B1%E9%A7%92%E5%BD%A24-21-4"
      },
      {
        "label": "とうきょうスカイツリー駅前 2 番站牌",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%81%A8%E3%81%86%E3%81%8D%E3%82%87%E3%81%86%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC%E9%A7%85%E5%89%8D%20%E4%B8%8A26%20%E3%83%90%E3%82%B9%E5%81%9C"
      },
      {
        "label": "根津駅前",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%A0%B9%E6%B4%A5%E9%A7%85%E5%89%8D%20%E3%83%90%E3%82%B9%E5%81%9C"
      },
      {
        "label": "根津神社",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%A0%B9%E6%B4%A5%E7%A5%9E%E7%A4%BE"
      },
      {
        "label": "千駄木",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%8D%83%E9%A7%84%E6%9C%A8%E9%A7%85"
      },
      {
        "label": "谷中銀座",
        "url": "https://www.google.com/maps/search/?api=1&query=%E8%B0%B7%E4%B8%AD%E9%8A%80%E5%BA%A7%E5%95%86%E5%BA%97%E8%A1%97"
      },
      {
        "label": "夕やけだんだん",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%A4%95%E3%82%84%E3%81%91%E3%81%A0%E3%82%93%E3%81%A0%E3%82%93"
      },
      {
        "label": "日暮里站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E6%9A%AE%E9%87%8C%E9%A7%85"
      },
      {
        "label": "青砥站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E9%9D%92%E7%A0%A5%E9%A7%85"
      },
      {
        "label": "押上站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%8A%BC%E4%B8%8A%E9%A7%85"
      },
      {
        "label": "東京晴空塔／Solamachi",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%BD%E3%83%A9%E3%83%9E%E3%83%81"
      },
      {
        "label": "都營巴士班次查詢 ↗",
        "url": "https://www.kotsu.metro.tokyo.jp/bus/"
      },
      {
        "label": "上 26 晴空塔站前 2 番官方時刻",
        "url": "https://tobus.jp/sp/blsys/stop/time?ln=ja&poleno=2&routecode=79&stopid=2028&ud=1"
      }
    ]
  },
  {
    "key": "sumida",
    "title": "京島・向島｜神社、麵包與商店街",
    "steps": [
      {
        "time": "09:00 出門",
        "title": "民宿 → 押上",
        "text": "從民宿到本所吾妻橋站，搭都營淺草線往押上，只坐 1 站。押上下車後，依步行地圖前往飛木稻荷。"
      },
      {
        "time": "上午",
        "title": "飛木稻荷神社",
        "text": "參拜、拍照後，繼續往京島的ハト屋パン店走。"
      },
      {
        "time": "上午",
        "title": "ハト屋パン店",
        "text": "沿京島巷弄步行到麵包店；排隊太長就略過，接著走商店街。"
      },
      {
        "time": "上午",
        "title": "キラキラ橘商店街",
        "text": "沿商店街散步、看店家；各自逛之前先約好在商店街出口集合。"
      },
      {
        "time": "上午",
        "title": "MUUMUU COFFEE",
        "text": "步行到咖啡店休息；客滿或臨休就略過。想改逛向島，可選下方替換路線，不把所有店疊加。"
      },
      {
        "time": "最晚 12:15 離開京島",
        "title": "京島 → 晴空塔 Solamachi",
        "text": "直接步行回晴空塔，走累了可依原計畫搭計程車。不先回民宿，以免折返。"
      },
      {
        "time": "約 13:00 起",
        "title": "晴空塔 Solamachi",
        "text": "自行午餐、自由逛街，晚餐前到炭火焼肉おくさこ與 C 組會合。"
      }
    ],
    "note": "此路線保留較多隨走隨停的時間；麵包、咖啡店不必硬排。",
    "alternatives": [
      {
        "title": "向島替換路線｜不是全部必去",
        "text": "想去吉備子屋與志満ん草餅，離開ハト屋後改走向島，略過 MUUMUU；MUUMUU、吉備子屋、志満ん草餅三處最多選兩處。碰到臨休就略過，仍最晚 12:15 往晴空塔。"
      }
    ],
    "links": [
      {
        "label": "京島、向島步行地圖 ↗",
        "url": "https://www.google.com/maps/dir/?api=1&origin=%E6%8A%BC%E4%B8%8A%E9%A7%85&destination=MUUMUU%20COFFEE&travelmode=walking&waypoints=%E9%A3%9B%E6%9C%A8%E7%A8%B2%E8%8D%B7%E7%A5%9E%E7%A4%BE%7C%E3%83%8F%E3%83%88%E5%B1%8B%E3%83%91%E3%83%B3%E5%BA%97%7C%E3%82%AD%E3%83%A9%E3%82%AD%E3%83%A9%E6%A9%98%E5%95%86%E5%BA%97%E8%A1%97"
      },
      {
        "label": "東京民宿",
        "url": "https://maps.app.goo.gl/QZX3Ty983HxajN197"
      },
      {
        "label": "押上站",
        "url": "https://www.google.com/maps/search/?api=1&query=%E6%8A%BC%E4%B8%8A%E9%A7%85"
      },
      {
        "label": "飛木稻荷神社",
        "url": "https://www.google.com/maps/search/?api=1&query=%E9%A3%9B%E6%9C%A8%E7%A8%B2%E8%8D%B7%E7%A5%9E%E7%A4%BE"
      },
      {
        "label": "ハト屋パン店",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%83%8F%E3%83%88%E5%B1%8B%E3%83%91%E3%83%B3%E5%BA%97%20%E4%BA%AC%E5%B3%B6"
      },
      {
        "label": "キラキラ橘商店街",
        "url": "https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%A9%E3%82%AD%E3%83%A9%E6%A9%98%E5%95%86%E5%BA%97%E8%A1%97"
      },
      {
        "label": "MUUMUU COFFEE",
        "url": "https://www.google.com/maps/search/?api=1&query=MUUMUU%20COFFEE%20%E4%BA%AC%E5%B3%B6"
      },
      {
        "label": "吉備子屋",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%90%89%E5%82%99%E5%AD%90%E5%B1%8B%20%E5%90%91%E5%B3%B6"
      },
      {
        "label": "志満ん草餅",
        "url": "https://www.google.com/maps/search/?api=1&query=%E5%BF%97%E6%BA%80%E3%82%93%E8%8D%89%E9%A4%85"
      },
      {
        "label": "向島步行地圖 ↗",
        "url": "https://www.google.com/maps/dir/?api=1&origin=%E3%83%8F%E3%83%88%E5%B1%8B%E3%83%91%E3%83%B3%E5%BA%97&destination=%E5%BF%97%E6%BA%80%E3%82%93%E8%8D%89%E9%A4%85&travelmode=walking&waypoints=%E5%90%89%E5%82%99%E5%AD%90%E5%B1%8B"
      }
    ]
  }
];

  function readingDayThreeRoutes() {
    const selected=state.routes[state.group];
    return readingRoutes.filter(route=>!['yanaka','sumida'].includes(selected)||route.key===selected).map(route=>{
      const links=route.links.filter(link=>link.url.includes('/dir/')||link.label.includes('官方時刻'));
      return `<section class="reading-route"><h3>${escape(route.title)}</h3><ol class="reading-steps">${route.steps.map(step=>`<li><small>${escape(step.time)}</small><h4>${escape(step.title)}</h4><p>${escape(step.text)}</p></li>`).join('')}</ol>${route.alternatives.map(a=>`<details><summary>${escape(a.title)}</summary><p>${escape(a.text)}</p></details>`).join('')}<nav class="reading-links" aria-label="散步路線地圖">${links.map(link=>`<a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.label)}</a>`).join('')}</nav></section>`;
    }).join('');
  }

  function readingStop(index) {
    const special=(state.day===1&&state.group==='B')||(state.day===3&&state.group==='C');
    let value=readableDailyStops[special?`${state.day}-${state.group}-${index}`:`${state.day}-${index}`];
    if(state.day===3 && state.group!=='C' && index===0) {
      const route=state.routes[state.group];
      if(route==='yanaka'||route==='sumida') value={...value,title:readableDailyStops['3-'+route].title,summary:readableDailyStops['3-'+route].summary};
    }
    if(state.day===9 && index===2) {
      const row=flightRow(returns,state.group);
      value={...value,title:state.group+' 組回程',summary:row.cells[3].textContent.trim()+'｜'+row.cells[1].textContent.trim()+' → '+row.cells[2].textContent.trim()+'。登機時間與登機門看登機證。'};
    }
    return value;
  }
  function applyRevisedDailyCopy() {
    if(state.view!=='days')return;
    main.querySelectorAll('.stop-content').forEach((stop,i)=>{
      const copy=readingStop(i);if(!copy)return;
      const keep=[...stop.children].filter(e=>e.matches('.schedule-toggle,.schedule-time,.schedule-detail-body'));
      const detail=stop.querySelector('.schedule-detail-body');
      if(copy.meal) {
        const p=document.createElement('p');p.className='meal-meeting-note';
        p.textContent=state.day===5?'餐後 13:15 在雷門會合，再一起往淺草橋。':i===3?'餐後各自往澀谷，14:45 在 FREAK’S STORE Shibuya 會合。':'先約好 PARCO B1 的餐後會合點，再分開入座。';
        detail?detail.before(p):stop.append(p);return;
      }
      const original=stop.cloneNode(true);original.querySelectorAll('.schedule-toggle,.schedule-time,.schedule-detail-body').forEach(e=>e.remove());
      const links=[],seen=new Set();
      original.querySelectorAll('a[href]').forEach(a=>{const href=a.getAttribute('href');if(!seen.has(href)){seen.add(href);links.push(a.cloneNode(true));}});
      for(const node of [...stop.childNodes])if(!keep.includes(node))node.remove();
      const content=document.createElement('div');content.className='stop-summary';
      const title=document.createElement('strong');title.className='stop-summary-title';title.textContent=copy.title;content.append(title);
      const description=document.createElement('p');description.textContent=copy.summary;content.append(description);
      if(links.length){const row=document.createElement('p');row.className='stop-summary-links';links.forEach((a,j)=>{if(j)row.append('　');row.append(a);});content.append(row);}
      detail?detail.before(content):stop.append(content);
      stop.dataset.revisedCopy='true';
    });
  }
  function markReadingStations(text) {
    const colors={M:'#f62e36',A:'#e85298',G:'#f39700',H:'#9caeb7',Z:'#9b7cb6',OH:'#2385c4',KS:'#2564a8',JB:'#d5b400'};
    return escape(text).replace(/\b(OH|KS|JB|M|A|G|H|Z)(\d{2})\b/g,(_,line,no)=>`<span class="rail-station-badge" style="--rail-color:${colors[line]}">${line} ${no}</span>`);
  }
  function readingDetail(copy) {
    const paragraphs=[['怎麼走',copy.directions],['留意',copy.note],['補充',copy.extra]].filter(([,text])=>text);
    let html='<div class="reading-directions">'+paragraphs.map(([label,text])=>`<p class="${label==='留意'?'reading-note':''}"><strong>${label}</strong>${markReadingStations(text)}</p>`).join('')+'</div>';
    if(copy.car)html+=`<details class="reading-car"><summary>出口與車廂參考</summary><p>${escape(copy.car)}</p></details>`;
    const links=(copy.links||[]).filter(link=>!link.url.includes('maps')&&!link.url.includes('goo.gl')&&!link.url.includes('restaurant-guide/venues'));
    if(links.length)html+='<nav class="reading-links" aria-label="交通與預約連結">'+links.map(link=>`<a href="${escape(link.url)}"${link.url.startsWith('http')?' target="_blank" rel="noopener noreferrer"':''}>${escape(link.label)} ↗</a>`).join('')+'</nav>';
    return html;
  }
  function organizeDailyDetails() {
    if(state.view!=='days')return;
    main.querySelectorAll('.stop-content').forEach((stop,i)=>{
      const copy=readingStop(i);if(!copy)return;
      let detail=stop.querySelector('.schedule-detail-body');
      const time=stop.querySelector('.schedule-time');if(!time)return;
      if(!detail){detail=document.createElement('div');detail.className='document schedule-detail-body';detail.hidden=true;stop.append(detail);}
      const anchors=[...detail.querySelectorAll('[data-inline-source]')].map(e=>e.outerHTML).join('');
      const walkingMaps=[...detail.querySelectorAll('a[href*="/maps/dir/"]')].map(a=>a.cloneNode(true));
      if(state.day===3&&state.group!=='C'&&i===0) {
        detail.innerHTML=anchors+readingDayThreeRoutes()+readingDetail({...copy,directions:'',note:'兩條路線擇一，完成後都前往晴空塔午餐、購物。',links:[]});
      } else detail.innerHTML=anchors+readingDetail(copy);
      const known=new Set([...stop.querySelectorAll('a[href]')].filter(a=>!detail.contains(a)).map(a=>a.href));
      detail.querySelectorAll('.reading-links a').forEach(a=>{if(known.has(a.href))a.remove();else known.add(a.href);});
      const maps=document.createElement('nav');maps.className='reading-links';maps.setAttribute('aria-label','路線導航');
      walkingMaps.forEach(a=>{if(!known.has(a.href)){known.add(a.href);maps.append(a);}});
      if(maps.children.length)detail.append(maps);
      if(state.day===8&&i===3){
        const source=$('#day8-aeon-bus'),full=document.createElement('details');
        full.className='reading-timetable';full.innerHTML='<summary>完整巴士時刻表與站牌</summary>';
        source?.querySelectorAll('.aeon-section-title,.aeon-time-table,.guide-callout,.guide-button-row,.small-print').forEach(el=>{const wrap=document.createElement('div');wrap.append(el.cloneNode(true));full.insertAdjacentHTML('beforeend',readable(wrap));});
        detail.append(full);
      }
      let toggle=stop.querySelector('.schedule-toggle');
      if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='schedule-toggle';toggle.setAttribute('aria-expanded','false');time.before(toggle);toggle.append(time);const label=document.createElement('span');label.className='schedule-toggle-label';label.innerHTML='詳細行程 <span aria-hidden="true">＋</span>';toggle.append(label);}
      detail.id=`revised-detail-${state.group}-${state.day}-${i}`;toggle.setAttribute('aria-controls',detail.id);
    });
  }
  function polishDailyLinks() {
    const makeMap=(name,url)=>{const a=document.createElement('a');a.href=url;a.textContent=name;a.target='_blank';a.rel='noopener noreferrer';a.title='開啟 Google Maps';return a;};
    const joinFlight=e=>{for(const br of [...e.querySelectorAll('br')]){const before=br.previousSibling?.textContent?.trim()||'',after=br.nextSibling?.textContent?.trim()||'';if(/(?:台灣虎航|中華航空|樂桃航空|Peach)$/.test(before)&&/^(?:IT|CI|MM)\s?\d{2,4}/.test(after))br.replaceWith(document.createTextNode('  '));}};
    if(state.view==='flights')main.querySelectorAll('.ticket-footer>strong').forEach(e=>{joinFlight(e);e.classList.add('flight-identity');});
    if(state.view!=='days')return;
    main.querySelectorAll('.stop-content').forEach(joinFlight);
    main.querySelectorAll('.summary-addition').forEach(e=>{if(!e.querySelector('strong')){const b=document.createElement('strong');b.textContent='提醒：';e.prepend(b);}});
    const names=Object.keys(dailyPlaceMaps).sort((a,b)=>b.length-a.length);
    const scope=[...main.querySelectorAll('.route,.stop-content')];
    for(const section of scope){
      const walker=document.createTreeWalker(section,NodeFilter.SHOW_TEXT);const texts=[];let node;
      while(node=walker.nextNode())if(!node.parentElement.closest('a,button,.schedule-time,.step,dt,script'))texts.push(node);
      for(const t of texts){let rest=t.textContent,changed=false;const frag=document.createDocumentFragment();
        while(rest){let best=null;for(const name of names){const i=rest.indexOf(name);if(i>=0&&(!best||i<best.i||(i===best.i&&name.length>best.name.length)))best={i,name};}
          if(!best){frag.append(document.createTextNode(rest));break;}changed=true;frag.append(document.createTextNode(rest.slice(0,best.i)),makeMap(best.name,dailyPlaceMaps[best.name]));rest=rest.slice(best.i+best.name.length);
        }if(changed)t.replaceWith(frag);
      }
      for(const a of [...section.querySelectorAll('a')]){const label=a.textContent.trim(),url=dailyPlaceMaps[label];if(url&&!/maps|goo.gl/.test(a.href)&&!a.nextElementSibling?.classList.contains('place-map-link')){const m=makeMap('地圖 ↗',url);m.className='place-map-link';a.after(m);}}
    }
  }




  function consolidateDailySummaryLinks() {
    if(state.view!=='days') return;
    const urlKey=href=>{
      const url=new URL(href,document.baseURI);
      url.hash='';url.searchParams.sort();
      return url.origin+url.pathname+'?'+url.searchParams.toString();
    };
    const isMap=a=>/google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(a.href);
    const isGuide=a=>/\/restaurant-guide\/venues\/[^/]+\.html$/.test(new URL(a.href,document.baseURI).pathname);
    main.querySelectorAll('.stop-summary').forEach(summary=>{
      const title=summary.querySelector('.stop-summary-title');
      const row=summary.querySelector('.stop-summary-links');
      if(!title||!row) return;
      const places=[...title.querySelectorAll('a[href]')].filter(isMap);
      let activePlace=null;
      for(const link of [...row.querySelectorAll('a[href]')]){
        if(isMap(link)){
          activePlace=places.find(place=>urlKey(place.href)===urlKey(link.href)) || null;
          if(activePlace) link.remove();
          continue;
        }
        if(isGuide(link)){
          let pair=activePlace?.parentElement||link.parentElement;
          if(activePlace&&!pair.classList.contains('stop-title-place')){
            pair=document.createElement('span');pair.className='stop-title-place';
            activePlace.before(pair);pair.append(activePlace);
          }
          if([...pair.querySelectorAll('a')].some(a=>a!==link&&urlKey(a.href)===urlKey(link.href))){link.remove();continue;}
          link.classList.add('stop-title-guide');
          const slug=new URL(link.href,document.baseURI).pathname.split('/').pop();
          link.textContent=slug==='01-monjayaki-chico.html'?'第二方案｜文字燒 CHICO 實拍攻略':slug==='09-noguchi-sengyoten.html'?'野口鮮魚店實拍攻略':'實拍攻略';
          link.setAttribute('aria-label',link.textContent);
          pair.append(link);
        } else {
          activePlace=null;
        }
      }
      if(!row.querySelector('a')&&!row.textContent.replace(/[\s\u3000／|｜→↗]/g,'')) row.remove();
    });
  }

  function addDayCouponShortcuts() {
    if(state.view!=='days') return;
    const targets=state.day===9?[['機場購物：安檢前／後分區 ↗','narita-dutyfree']]:[['Bic Camera 新宿東口店','bic'],['新宿 Bic Camera','bic'],['Alpen TOKYO','alpen']];
    const added=new Set();
    for(const [label,key] of targets){
      if(added.has(key)) continue;
      const anchor=[...main.querySelectorAll('a[href]')].find(a=>a.textContent.trim()===label);
      if(!anchor) continue;
      const shortcut=document.createElement('a');shortcut.className='restaurant-mini-link';shortcut.href='./?view=coupons&cpn='+key;shortcut.textContent='看優惠券';shortcut.setAttribute('aria-label',label+' 優惠券');
      anchor.insertAdjacentElement('afterend',shortcut);added.add(key);
    }
  }

  function render(scroll = false) {
    clampDay(); detailSources = new Map();
    main.dataset.view = state.view;
    const grouped = state.view === 'days' || state.view === 'flights';
    const staying = state.view === 'stays';
    shell.classList.toggle('has-group-dock',grouped);
    shell.classList.toggle('has-stay-dock',staying);
    root.querySelector('.group-dock').hidden = !grouped;
    root.querySelector('.stay-dock').hidden = !staying;
    root.querySelectorAll('[data-group]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.group===state.group)));
    root.querySelectorAll('[data-stay]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stay===state.stay)));
    root.querySelectorAll('[data-view]').forEach(button=>{
      if(button.dataset.view===state.view) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    const row = flightRow(departures,state.group);
    root.querySelector('.group-context').textContent = `${state.group} 組 · ${row.cells[3].textContent.trim()} · ${row.cells[1].textContent.trim()}`;
    const content = state.view==='days'?daily():state.view==='flights'?flights():state.view==='stays'?stays():state.view==='bookings'?bookings():state.view==='money'?moneyView():state.view==='restaurants'?restaurants():state.view==='airport'?airport():state.view==='coupons'?coupons():guide();
    main.innerHTML = content+`<p class="status" role="status">${statusText()}</p>`;
    applyWordModel();
    compactDailyPresentation();
    applyRevisedDailyCopy();
    organizeDailyDetails();
    polishDailyLinks();
    consolidateDailySummaryLinks();
    markNikkoBusPassRides();
    addDayCouponShortcuts();
    attachMajorTransitGuide();
    main.querySelectorAll('details[data-detail]').forEach(el=>el.addEventListener('toggle',()=>{
      if(el.open && !el.dataset.loaded) {
        el.querySelector('.document').innerHTML=readable(detailSources.get(el.dataset.detail),{omitTitle:true});
        el.dataset.loaded='true';
      }
    }));
    persist();
    if (scroll) window.scrollTo({top:0,behavior:'instant'});
    revealActiveDay();
    if(state.view === 'days') {
      const weather = main.querySelector('.weather-section');
      if(window.TripWeather) window.TripWeather.render(weather,state.day);
      else weather.textContent = '天氣資料暫時無法載入。';
    }
    if(state.view === 'money' && window.TripMoney) window.TripMoney.mount(main.querySelector('.money-app'));
    else if(window.TripMoney) window.TripMoney.unmount();
    if(['restaurants','airport'].includes(state.view)) hydrateSupplement(state.view);
  }
  root.addEventListener('click',async event=>{
    const button = event.target.closest('button');
    if(!button) {
      const card=event.target.closest('.stop-content');
      if(card && !event.target.closest('a,input,select,textarea,label,.schedule-detail-body')) card.querySelector('.schedule-toggle')?.click();
      return;
    }
    if(button.classList.contains('schedule-toggle')) {
      const body = root.getElementById(button.getAttribute('aria-controls'));
      if(!body) return;
      body.hidden = !body.hidden;
      button.setAttribute('aria-expanded', String(!body.hidden));
      button.querySelector('.schedule-toggle-label span').textContent = body.hidden ? '＋' : '−';
      return;
    }
    if(button.dataset.airportZone) {
      const zone=button.dataset.airportZone;
      main.querySelectorAll('[data-airport-zone]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
      let count=0;
      main.querySelectorAll('[data-airport-card]').forEach(card=>{card.hidden=zone!=='all' && card.dataset.airportCard!==zone;if(!card.hidden)count++;});
      main.querySelector('.airport-results').textContent=`${button.textContent.replace(/\d+$/,'')} · ${count} 款推薦`;
    } else if(button.dataset.group) {
      state.group=button.dataset.group; render();
      root.querySelector('#announcement').textContent=`已切換為 ${state.group} 組，顯示本組與共同行程。`;
    } else if(button.dataset.day) { state.day=Number(button.dataset.day); render(true); }
    else if(button.dataset.bookingDay) { state.bookingDay=Number(button.dataset.bookingDay); render(true); }
    else if(button.dataset.coupon) { state.coupon=button.dataset.coupon; render(true); }
    else if(button.dataset.stay) { state.stay=button.dataset.stay; render(true); }
    else if(button.dataset.view) { state.view=button.dataset.view; render(true); }
    else if(button.dataset.route) { state.routes[state.group]=button.dataset.route; const y=window.scrollY; render(); window.scrollTo(0,y); }
    else if(button.dataset.reserveCopy) {
      const template=main.querySelector(`#${CSS.escape(button.dataset.reserveCopy)}`);if(!template)return;
      try{await navigator.clipboard.writeText(template.textContent.trim());button.textContent='已複製';setTimeout(()=>{if(button.isConnected)button.textContent='複製';},1800);}
      catch{root.querySelector('#announcement').textContent='無法自動複製，請長按文字後複製。';}
    }
    else if(button.dataset.action==='food-card') root.querySelector('#food-phrase-dialog').showModal();
    else if(button.dataset.action==='close-food-card') root.querySelector('#food-phrase-dialog').close();
    else if(button.dataset.action==='install') { root.querySelector('dialog').showModal(); }
    else if(button.dataset.action==='close-install') root.querySelector('dialog').close();
    else if(button.dataset.action==='native-install' && pendingInstall) {
      await pendingInstall.prompt(); await pendingInstall.userChoice; pendingInstall=null;
      button.hidden=true;
    }
  });
  // Preserve links from the old table of contents and bookmarks.
  function applyHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if(!id) return;
    const match = id.match(/^day(\d+)/);
    if(match) { state.day=Number(match[1]); state.view='days'; }
    else if(id==='tax-refund') { location.replace(new URL('./airport-guide/index.html#refund',document.baseURI).href); return; }
    else if(id==='flight-info' || id==='narita-honjo-guide') state.view='flights';
    else if(['stay-tokyo','stay-nikko','stay-narita'].includes(id)) { state.view='stays'; state.stay=id.replace('stay-',''); }
    else if(id==='day8-aeon-bus') { state.day=8; state.view='days'; }
    else if($('#'+CSS.escape(id))) state.view='guide';
    render();
    let details = root.querySelector(`details[data-detail="${CSS.escape(id)}"]`);
    if(!details) {
      const sourceKey = [...detailSources].find(([,source]) => source.id === id)?.[0];
      if(sourceKey) details = root.querySelector(`details[data-detail="${CSS.escape(sourceKey)}"]`);
    }
    if(details) { details.open=true; details.scrollIntoView({block:'center'}); }
    const inline = id === 'day8-aeon-bus' ? root.getElementById(`revised-detail-${state.group}-8-3`) : root.querySelector(`[data-inline-source="${CSS.escape(id)}"]`)?.closest('.schedule-detail-body');
    if(inline) {
      inline.hidden=false;
      const button=main.querySelector(`[aria-controls="${inline.id}"]`);
      button?.setAttribute('aria-expanded','true');
      if(button) button.querySelector('.schedule-toggle-label span').textContent='−';
      button?.scrollIntoView({block:'center'});
    }
  }
  window.addEventListener('hashchange',applyHash);
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault(); pendingInstall=event; root.querySelector('[data-action=native-install]').hidden=false;
  });
  window.addEventListener('appinstalled',()=>{ pendingInstall=null; root.querySelector('dialog').close(); root.querySelector('[data-action=install]').textContent='使用說明'; });
  ['online','offline'].forEach(type=>window.addEventListener(type,()=>{ root.querySelector('.status').textContent=statusText(); }));

  // Show the enhanced view only once its stylesheet loaded successfully.
  sheet.onload=()=>{
    const reset=document.createElement('style');
    reset.textContent='html.trip-app-ready,html.trip-app-ready body{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:#f6f7f9!important;overflow-x:clip!important}html.trip-app-ready body>*:not(#trip-app):not(script):not(style){display:none!important}#trip-app{display:block!important}';
    document.head.append(reset);
    document.documentElement.classList.add('trip-app-ready');
    document.documentElement.classList.remove('mobile-page-fit');
    applyHash();
    requestAnimationFrame(revealActiveDay);
  };
  sheet.onerror=()=>host.remove();
  render();
  document.body.prepend(host);
  // Navigation wraps on tablets; anchor offsets must follow its actual height.
  const updateHeaderHeight = () => host.style.setProperty('--app-header-height', `${Math.ceil(root.querySelector('.app-header').getBoundingClientRect().height)}px`);
  if ('ResizeObserver' in window) new ResizeObserver(updateHeaderHeight).observe(root.querySelector('.app-header'));
  else window.addEventListener('resize', updateHeaderHeight);
  updateHeaderHeight();
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(async()=>{
      await navigator.serviceWorker.ready; offlineReady=true;
      root.querySelector('.status').textContent=statusText();
    }).catch(()=>{ offlineFailed=true; root.querySelector('.status').textContent=statusText(); });
  } else { offlineFailed=true; root.querySelector('.status').textContent=statusText(); }
})();

