/* Mobile reading view. The original document remains the source of truth:
   shared itinerary edits therefore appear here without maintaining a second copy. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const pages = [...document.querySelectorAll('.page-sheet')];
  if (!$('#day1') || !$('#flight-info')) return;
  const GROUPS = ['A', 'B', 'C'];
  const STAY_KEYS = ['tokyo','nikko','narita'];
  const COUPON_KEYS = ['bic','alpen','donki','matsukiyo','cocokara','sundrug','sugi','yam','laox','odakyu','aeon'];
  const STAY_INFO = {
    tokyo:{label:'東京',id:'stay-tokyo',image:'./stay-tokyo.jpg',alt:'東京本所吾妻橋包棟民宿的客廳與用餐空間',source:'https://www.airbnb.com/rooms/1661217093593003826'},
    nikko:{label:'日光',id:'stay-nikko',image:'./stay-nikko.jpg',alt:'日光山景包棟民宿的和室空間',source:'https://www.airbnb.com/rooms/52815877'},
    narita:{label:'成田',id:'stay-narita',image:'./stay-narita.jpg',alt:'成田里士滿飯店外觀',source:'https://richmondhotel.jp/narita/'}
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
        if (el.textContent.includes('粉紅色')) el.textContent = '各組一起走行程；11/25 牛たんの檸檬已訂 5 人，不吃牛的 2 位在麺 みつヰ／秋光候選中擇一，尚未決定；餐後會合。';
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
      [...el.attributes].forEach(attr => {
        if (!['href','src','alt','title','target','rel','colspan','rowspan'].includes(attr.name)) el.removeAttribute(attr.name);
      });
      if (urgent) el.className = 'important-reminder';
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
  sheet.href = new URL('./trip-app.css?v=20261026-transit-dinner', document.baseURI).href;
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
      <div class="groups" role="group" aria-label="選擇旅行組別（全部成人）">${GROUPS.map(g=>`<button type="button" data-group="${g}" aria-pressed="false">${g} 組 · ${g==='A'?3:2} 人</button>`).join('')}</div>
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
        <p>牛肉を食べない者が2名います。</p>
        <p>牛肉・牛骨だし・牛脂を使っていない料理はありますか？</p>
        <p>スープやソース、具材にも入っていないか、確認していただけますか？</p>
      </div>
      <p class="phrase-translation">我們有兩位不吃牛肉。請問有不使用牛肉、牛骨高湯、牛脂的料理嗎？也請幫忙確認湯、醬汁和配料。</p>
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
  // Suggestions are local Japan times, not reservations. Fixed entries come
  // from the existing itinerary; unbooked services remain explicitly pending.
  function dailyTimes() {
    const suggested = time => ({time, label:'建議時間'});
    const fixed = (time, label='固定時間') => ({time, label, fixed:true});
    if (state.day === 1 && state.group === 'B') return [
      fixed('18:30','航班抵達'), suggested('出關後選班次・11/21 起改點'),
      suggested('依實際列車抵達本所吾妻橋'), fixed('21:30 鳥貴族訂位・A 組先入座','已訂位'), suggested('B 組抵達後加入；延誤請聯絡店家')
    ];
    if (state.day === 3 && state.group === 'C') return [
      fixed('12:10','航班抵達'), suggested('出關後，依實際班次前往民宿'),
      suggested('17:30–19:00（依用餐進度）'), suggested('19:00 起（晴空塔選逛）')
    ];
    return {
      1:[suggested('15:20–16:00'),suggested('16:00–17:00'),suggested('17:00–17:20'),suggested('17:30–18:15'),suggested('18:45–20:00'),fixed('21:30 鳥貴族','已訂位')],
      2:[suggested('09:00–09:25'),suggested('10:00–10:30'),suggested('豪德寺後，順路選逛'),suggested('到店一起取號，依叫號入座'),suggested('14:30–18:00'),suggested('18:00–19:00')],
      3:[suggested('09:00–12:15；13:00 起晴空塔'),suggested('17:30–19:00（依用餐進度）')],
      4:[suggested('09:00–09:45'),suggested('09:45–10:45'),suggested('11:00–14:15（與午餐調整順序）'),suggested('11:00–14:15 午餐三選一'),suggested('14:15–14:45 步行往澀谷'),suggested('14:45–15:30 FREAK\'S STORE'),suggested('15:30–17:00 澀谷 PARCO'),suggested('17:00–19:00 PARCO B1 分開晚餐・依候位'),suggested('19:00–20:00 唐吉訶德選逛'),suggested('依集合時間返回民宿')],
      5:[suggested('09:00–09:45'),suggested('10:00–11:30'),fixed('12:00 牛舌訂位・用餐 1 小時','5 位已訂；另 2 位自由用餐'),suggested('午餐後順逛'),suggested('14:00–15:30 淺草自由活動'),suggested('15:30–16:30 回民宿放物品、休息'),suggested('17:30–18:00 TEN& 外帶（建議）'),suggested('18:30–19:20 HARBS（有位內用／否則外帶）'),suggested('19:20 起 六本木新城聖誕市集・大屋頂廣場')],
      6:[fixed('淺草 09:00 → 東武日光 10:50','SPACIA X 003・已訂妥'),suggested('搭車期間'),suggested('10:50 抵達後'),suggested('13:00–14:30 神橋、日光街道；15:00–15:30 入住')],
      7:[suggested('09:15 左右出門；10:00–12:00 東照宮'),suggested('中午後自由用餐、回民宿休息'),suggested('傍晚、晚上')],
      8:[fixed('08:00','已訂包車・建議 07:45 完成退房並集合'),suggested('13:00–14:30'),suggested('14:30–16:40'),fixed('去程 17:15／17:47；回程 20:28／20:29','行程所列巴士班次・行前確認')],
      9:[suggested('08:20（前晚登記座位）'),suggested(state.group==='B'?'11:30–12:30':'10:30–11:00'),fixed(state.group==='B'?'14:35':'13:00','回程航班起飛')]
    }[state.day] || [];
  }
  // Explicit mapping of detail rows to daily time slots (zero based).
  const SLOT_ROWS = {
    1:[0,0,1,2,3,4,4,5], 2:[0,0,1,1,2,3,4,5,5],
    3:[0,0,0,0,0,0,0,0], 4:[0,1,2,2,3,4,6,7,8,9],
    5:[0,1,1,2,3,5,6,7,8], 6:[0,1,2,2,3,3,3],
    7:[0,0,0,1,2], 8:[0,0,1,2,3,3,3,3,3]
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
      clone.querySelectorAll('.group-c-divider-row,.group-c-arrival-row').forEach(el => el.remove());
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
            const target = state.day === 6 ? [3,3][index] ?? 3 : state.day === 7 ? 0 : state.day === 8 ? [2,2,3,0,0][index] ?? 3 : state.day === 5 ? [1,6,7][index] ?? 8 : state.day === 4 ? (index ? 6 : 4) : state.day === 2 ? (index ? 4 : 1) : state.day === 1 ? (index ? 4 : 0) : 0;
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
      items = [groupArrival(), '<strong>機場交通：</strong>京成 11/21 起改點；出關後選擇停靠青砥的 Skyliner，再轉本所吾妻橋。20:23 等舊班表時間僅供參考，以當日看板與空位為準。', '<strong>先放行李：</strong>到本所吾妻橋民宿後在群組回報，再確認晚餐集合位置與抵達時間。', readable([...source.querySelectorAll('.day-item')].at(-1)), '<strong>晚餐會合：</strong>A 組先憑訂位姓名報到入座；B 組抵達後加入。若航班或入境延誤，請先通知店家。'];
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
      route = '本所吾妻橋 → 自選谷根千或京島・向島 → 晴空塔 Solamachi → 炭火焼肉おくさこ晚餐 → 晴空塔夜景（選逛）';
      items[0] = '<strong>上午自由選線：</strong>谷根千保留根津神社、蛇道與谷中銀座；天王寺與靈園只順路短停，略過上野櫻木。京島・向島維持麵包、咖啡散步。最晚 12:15 離開上午路線，直接前往晴空塔。';
      custom = `<h2 class="section-label">上午想走哪一條？</h2><p class="intro">A、B 組都可自由選擇，與航班組別無關。</p><div class="route-select" role="group" aria-label="第 3 天散步路線">${[['all','兩條都看'],['yanaka','谷根千'],['sumida','京島・向島']].map(([key,label])=>`<button type="button" data-route="${key}" aria-pressed="${selected===key}">${label}</button>`).join('')}</div>`;
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
        <article class="meal-split-card meal-split-booked"><div class="meal-split-head"><strong>吃牛肉・5 人</strong><span>已訂位</span></div><h3><a href="https://maps.app.goo.gl/K4QdwtcbFczYAsTPA" target="_blank" rel="noopener noreferrer">牛たんの檸檬 淺草店</a></h3><p><b>11/25 12:00</b>｜兩筆訂位：3 人＋2 人</p><a href="./?view=bookings&amp;bday=5">查看已預約資料與代碼 ↗</a></article>
        <article class="meal-split-card meal-split-pending"><div class="meal-split-head"><strong>不吃牛肉・2 人</strong><span>自由用餐</span></div><h3>淺草自由用餐</h3><p>當天在淺草找想吃的店；麺 みつヰ、天麩羅秋光可供參考。</p><p class="meal-split-caution">下單前向店家確認湯底、醬汁與配料沒有牛肉、牛骨或牛脂。</p><div class="meal-split-links"><a href="https://tabelog.com/tokyo/A1311/A131102/13284327/" target="_blank" rel="noopener noreferrer">麺 みつヰ ↗</a><a href="https://akimitsu.tokyo/asakusa/" target="_blank" rel="noopener noreferrer">天麩羅秋光 ↗</a></div></article>
      </div>`;
    }
    if (state.day === 9) {
      const row = flightRow(returns,state.group);
      items = items.map(html => html.includes('IT281') || html.includes('CI101') ? '<strong>行程流程：</strong>全體預計 08:20 飯店接駁（前晚登記座位，約 08:40 抵達 T2）→ 保留免稅品在身邊 → 托運前完成海關攜出確認 → 航空報到／托運。' : html);
      items.push(`<strong>${state.group} 組回程：</strong>${row.cells[3].innerHTML}<br/>${row.cells[1].innerHTML} → ${row.cells[2].innerHTML}`);
    }
    const date = source.querySelector('.day-date').textContent;
    return `<div class="journey-heading"><div><div class="eyebrow">NOVEMBER IN JAPAN</div><p class="journey-title">${state.group} 組的秋日旅程</p></div><span class="trip-duration">${state.group==='C'?'7 天 6 夜':'9 天 8 夜'}</span></div>
      <p class="intro journey-intro">${state.group==='C'?'11.23':'11.21'} — 11.29<span>本組行程與共同活動</span></p>
      ${dayNavigation()}
      <section class="weather-section" aria-label="當日行程天氣"><p>天氣資料載入中；尚未提供的預報不會以目前天氣代替。</p></section>
      <div class="itinerary-layout"><aside class="day-overview"><section class="hero">${photo ? `<img src="${escape(photo.getAttribute('src'))}" alt="${escape(photo.alt)}" fetchpriority="high"/>` : ''}<span class="day-stamp" aria-hidden="true">DAY <b>${String(state.day).padStart(2,'0')}</b></span><div class="hero-copy"><small>${escape(date)} · ${state.group} 組</small><h1>${escape(title)}</h1><span class="photo-caption">${icon('pin')}${escape(photo?.alt || '日本之旅')}</span></div></section>
      <div class="route"><span class="route-label">${icon('pin')}今日路線<span>TODAY'S ROUTE</span></span>${route}</div></aside>
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
    return '<nav class="trip-quick-actions" aria-label="旅途快捷功能">'+home+foodCardButton()+'</nav>';
  }
  function dayResources() {
    const resources = state.day===6||state.day===7 ? [['./site-two/index.html','日光巴士：站牌、班次與票券']] : state.day===9 ? [['./?view=airport','機場購物：安檢前／後分區'],['./site-four/index.html','成田入境與 Skyliner 交通']] : state.day===1||state.day===3 ? [['./site-four/index.html','成田入境與 Skyliner 交通']] : [];
    return resources.length ? '<nav class="resource-links" aria-label="當日延伸資料">'+resources.map(([url,title])=>'<a href="'+url+'">'+title+' ↗</a>').join('')+'</nav>' : '';
  }
  function flightPanel(table,title) {
    const row = flightRow(table,state.group);
    const departure = row.cells[1].innerHTML.replace(/\b(\d{1,2}:\d{2})\b/, '<strong class="flight-departure-time">$1</strong>');
    const arrival = row.cells[2].innerHTML.replace(/\b(\d{1,2}:\d{2})\b/, '<strong class="flight-arrival-time">$1</strong>');
    return `<section class="panel flight-ticket"><div class="ticket-header"><span class="pill">${escape(title)} · ${state.group} 組</span><span>BOARDING PASS</span></div><div class="flight"><div>${departure}</div><span class="arrow" aria-hidden="true">${icon('plane')}</span><div class="flight-arrival">${arrival}</div></div><div class="ticket-footer"><strong>${row.cells[3].innerHTML}</strong>${row.cells[4]?`<p class="intro">建議抵達機場時間：${row.cells[4].innerHTML}</p>`:''}</div></section>`;
  }

  function skylinerNotice() {
    return '<p class="transit-alert"><strong>11/21 起京成改點：</strong>下列候選時間來自舊班表，尚未確認新時刻。出關後依當日看板與空位選擇停靠青砥的 Skyliner；轉乘和抵達時間一併調整。<a href="https://www.keisei.co.jp/news/detail.php?CN=8045" target="_blank" rel="noopener noreferrer">京成改點公告 ↗</a></p>';
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
        <li>完成入境審查、領行李與海關後，跟「鐵道／京成電鐵」到<strong>成田第 2 航廈 B1</strong>。全員及行李到齊再買票。</li>
        <li>告知櫃檯：搭<strong>停靠青砥</strong>的 Skyliner，再轉車到<strong>本所吾妻橋</strong>。不是每班 Skyliner 都停青砥；核對車次、時間、青砥停靠與座位後才付款。</li>
        <li>每人需要<strong>基本車資＋Skyliner 指定席券</strong>。用 Suica／PASMO 付基本車資時，另買到青砥的指定席券；出站前基本車資須涵蓋到本所吾妻橋。若買含基本車資的票券，依票券方式進站，不要重複刷 IC。</li>
        <li>依票面班次、月台、車廂和座位乘車。行李放指定區，到青砥前先整理好。</li>
        <li><strong>青砥不出閘門。</strong>通常在 2 樓的 2 號月台下車，走到同一座月台對側的 1 號；通常不用上下樓。看「押上・都營淺草線方面」，再確認列車停靠<strong>本所吾妻橋 A19</strong>。機場快特不停 A19，不要只看終點就上車；月台以現場看板為準。</li>
        <li>到本所吾妻橋，用進站時同一張 IC 卡出站；紙票區間不足找站員補票。依住宿地圖步行，大件行李可看電梯出口標誌。</li>
      </ol>
      <p lang="ja"><strong>櫃檯可出示：</strong>青砥に停まるスカイライナーで、本所吾妻橋まで行きたいです。</p>
      <div class="action-row"><a href="./site-four/index.html">入境與轉乘圖解 ↗</a><a href="https://www.keisei.co.jp/keisei/tetudou/skyliner/us/skyliner/purchase.php" target="_blank" rel="noopener noreferrer">京成購票說明 ↗</a><a href="https://www.keisei.co.jp/keisei/tetudou/stationmap/pdf/us/110.pdf" target="_blank" rel="noopener noreferrer">青砥站內圖 ↗</a></div>`;
    return `<details class="major-transit-guide"${open?' open':''}><summary>${title}</summary><div class="transit-guide-body">${body}</div></details>`;
  }
  function attachMajorTransitGuide() {
    if(state.view==='flights') {
      main.querySelector('.section-label')?.insertAdjacentHTML('afterend', majorTransitGuide('skyliner')+skylinerNotice());
    } else if(state.view==='days') {
      if(state.day===1 || (state.day===3 && state.group==='C')) {
        main.querySelector('.timeline')?.insertAdjacentHTML('beforebegin', majorTransitGuide('skyliner'));
      }
      if(state.day===6) {
        const boarding=main.querySelector('.schedule-detail-body');
        if(boarding)boarding.innerHTML=majorTransitGuide('spacia',true);
      }
    }
  }

  function flights() {
    const rail = $('.narita-combined-table').cloneNode(true);
    rail.querySelectorAll('tbody').forEach(body=>{ if(!body.classList.contains('group-'+state.group.toLowerCase())) body.remove(); });
    const wrap = document.createElement('div'); wrap.append(rail);
    return `<div class="eyebrow">MY FLIGHTS</div><h1>${state.group} 組航班與交通</h1><p class="intro">只顯示本組班機與機場接駁資訊。</p>${flightPanel(departures,'去程')}${flightPanel(returns,'回程')}<div class="note">11/29 預計 08:20 搭飯店接駁到成田 T2，前晚登記座位；免稅品攜出確認須在托運前完成。</div>${practicalDetail('narita-shuttle-fallback')}<h2 class="section-label">成田 → 本所吾妻橋</h2><div class="document">${readable(wrap)}${readable($('.narita-prev-fare-wrap'))}</div><div class="resource-links"><a href="./site-four/index.html">成田入境、Skyliner 與青砥轉乘 ↗</a></div>`;
  }
  function stays() {
    const stay=STAY_INFO[state.stay], source=$('#'+stay.id);
    return `<div class="eyebrow">OUR STAYS</div><h1>${stay.label}住宿</h1><p class="intro">使用下方按鈕切換東京、日光與成田。</p><article class="stay-focus"><figure class="stay-cover"><img src="${stay.image}" alt="${stay.alt}" fetchpriority="high"><figcaption>${stay.alt} · <a href="${stay.source}" target="_blank" rel="noopener noreferrer">查看來源 ↗</a></figcaption></figure><div class="document stay-document">${readable(source,{omitTitle:true})}</div></article>${state.stay==='nikko'?practicalDetail('nikko-luggage-info'):state.stay==='narita'?practicalDetail('narita-shuttle-fallback'):''}`;
  }
  function moneyView() {
    return `<div class="eyebrow">TRIP EXPENSES</div><h1>旅費分帳</h1><p class="intro">先選付款者、勾選分擔者，再設定平均或自訂金額；所有紀錄都列在「全部項目」。要結算時再按下計算，查看精簡的轉帳清單；日圓依每筆匯率換算成台幣。</p><div class="money-app"></div>`;
  }
  function bookingNavigation() {
    const days=[{day:1,date:'11/21',label:'鳥貴族'},{day:5,date:'11/25',label:'淺草午餐'},{day:6,date:'11/26',label:'SPACIA X'},{day:8,date:'11/28',label:'日光接送'}];
    return `<nav class="day-rail booking-rail" aria-label="選擇已預約日期">${days.map(item=>`<button class="day-button" type="button" data-booking-day="${item.day}" aria-label="${item.date} ${item.label}" aria-pressed="${item.day===state.bookingDay}"><span>DAY ${String(item.day).padStart(2,'0')}</span><b>${item.date.slice(3)}</b><small>${item.label}</small></button>`).join('')}</nav>`;
  }
  function bookings() {
    const content=state.bookingDay===1?`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 01 · 11/21（六）</span><span class="booking-status">已訂位</span></div><h2>鳥貴族 淺草店</h2><div class="booking-facts"><div><span>時間</span><strong>21:30</strong></div><div><span>人數</span><strong>5 位成人</strong></div><div><span>同行</span><strong>A＋B 組</strong></div><div><span>訂位姓名</span><strong>請見私人訂位信</strong></div></div><p>訂位已確認。A 組可先憑私人訂位信上的姓名報到入座；B 組抵達後加入。若 B 組交通延誤，請盡早通知店家。</p><a href="https://maps.app.goo.gl/EvEaCawMVivVVJDC9" target="_blank" rel="noopener noreferrer">開啟鳥貴族淺草店地圖 ↗</a></article>`
      :state.bookingDay===5?`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 05 · 11/25（三）</span><span class="booking-status">已訂位 · 共 5 人</span></div><h2>牛たんの檸檬 淺草店</h2><div class="booking-facts"><div><span>時間</span><strong>12:00</strong></div><div><span>預約一</span><strong>3 人</strong></div><div><span>預約二</span><strong>2 人</strong></div></div><div class="booking-codes"><div><span>3 人訂位代碼</span><strong>請見私人訂位信</strong><small>訂位姓名：請見私人訂位信</small></div><div><span>2 人訂位代碼</span><strong>請見私人訂位信</strong><small>訂位姓名：請見私人訂位信</small></div></div><p>兩筆各停留 1 小時，分別報上代碼；能否安排相鄰座位依店家現場為準。3 人訂位為禁菸桌；2 人訂位未指定座位。</p><a href="https://maps.app.goo.gl/K4QdwtcbFczYAsTPA" target="_blank" rel="noopener noreferrer">開啟淺草店地圖 ↗</a></article>`
      :state.bookingDay===6?`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 06 · 11/26（四）</span><span class="booking-status">已訂妥 · 7 位成人</span></div><h2>SPACIA X 003｜豪華座位</h2><div class="booking-facts"><div><span>淺草出發（日本時間）</span><strong>09:00</strong></div><div><span>東武日光抵達</span><strong>10:50</strong></div><div><span>席種</span><strong>Premium seat</strong></div></div>${majorTransitGuide('spacia',true)}</article>`
      :`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 08 · 11/28（六）</span><span class="booking-status">已訂妥 · 已付款</span></div><h2>關東專車接送｜日光民宿 → Richmond Hotel Narita</h2><div class="booking-facts"><div><span>上車時間（日本時間）</span><strong>08:00</strong></div><div><span>人數</span><strong>7 位成人</strong></div><div><span>車輛</span><strong>Toyota Hiace 10 人座 × 1</strong></div></div><div class="booking-followup"><strong>上車地點</strong><p>1-chōme-687-1 Inarimachi, Nikko, Tochigi 321-1411</p><strong>下車地點</strong><p>Richmond Hotel Narita</p><p>憑證註明：乘客需備妥護照與憑證；上車前請主動聯絡司機確認等候位置。司機資訊預計前一天透過 WeChat／WhatsApp 提供，請允許好友邀請。</p><p>出發前將原始接送憑證 PDF 存到手機，搭車時出示。</p><div class="action-row"><a href="./assets/nikko-narita-transfer-voucher-2026-11-28.pdf" target="_blank" rel="noopener noreferrer">開啟關東專車接送憑證 PDF ↗</a><a href="./assets/nikko-narita-transfer-voucher-2026-11-28.pdf" download="nikko-narita-transfer-voucher-2026-11-28.pdf">下載原始憑證</a></div></div><div class="booking-followup"><strong>11/29 飯店機場接駁</strong><p>全團 7 人預計搭 08:20 班次，約 08:40 抵達成田 T2；此為飯店接駁，尚未登記。11/28 入住後立即替 7 人登記並確認集合位置。08:15 前上車，沒有出發廣播；每人限 1 件行李箱，超額行李須先詢問飯店。</p><a href="https://richmondhotel.jp/narita/access/" target="_blank" rel="noopener noreferrer">Richmond 官方交通與接駁 ↗</a></div></article>`;
    return `<div class="eyebrow">CONFIRMED BOOKINGS</div><h1>已預約資料</h1><p class="intro">已確認的訂位與已付款接送集中在這裡；選日期即可查看時間、人數及現場資訊；餐廳訂位姓名與代碼請另存私人備忘或訂位信；第 8 天關東專車接送卡片可開啟、下載原始接送憑證。</p>${bookingNavigation()}<div class="booking-content">${content}</div>${state.bookingDay===8?practicalDetail('narita-shuttle-fallback'):''}`;
  }
  function dayNavigation(lastDay = 9) {
    return `<nav class="day-rail" aria-label="選擇行程日期">${Array.from({length:lastDay+1-firstDay()},(_,i)=>i+firstDay()).map(n=>`<button class="day-button" type="button" data-day="${n}" aria-label="第 ${n} 天，11 月 ${20+n} 日" aria-pressed="${n===state.day}"><span>DAY ${String(n).padStart(2,'0')}</span><b>${20+n}</b><small>11月・${['六','日','一','二','三','四','五','六','日'][n-1]}</small></button>`).join('')}</nav>`;
  }
  function restaurants() {
    return `<div class="eyebrow">TOKYO FOOD GUIDE</div><h1>餐廳攻略</h1><p class="intro">選擇日期，查看當天的店面、招牌餐點、營業與候位提醒。</p>${dayNavigation(8)}<nav class="trip-quick-actions" aria-label="點餐輔助">${foodCardButton()}</nav><div class="supplement-root" data-supplement="restaurants"><section class="panel supplement-loading">正在整理餐廳攻略…</section></div>`;
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
    return `<section class="airport-reading-guide"><div class="airport-wayfinding"><div><b>01</b><span>4F 安檢前<small>先買專店與 ANA FESTA</small></span></div><span aria-hidden="true">→</span><div><b>02</b><span>安檢・出境<small>通關時間另外預留</small></span></div><span aria-hidden="true">→</span><div><b>03</b><span>3F 安檢後<small>Fa-So-La 免稅伴手禮</small></span></div></div><details class="airport-shortlist"><summary>時間不夠，先看這 5 款</summary><div>${picks}</div></details>${navigation}<p class="airport-results" role="status">共 ${cards.length} 款推薦</p><div class="airport-products">${list}</div><details class="airport-shopping-plan"><summary>建議採買動線與購物提醒</summary><div class="airport-plan-copy"><h2>採買約 45–60 分鐘，通關另計</h2><ol class="airport-route">${steps}</ol><h2>購買前小提醒</h2><ul>${tips}</ul></div></details></section>`;
  }
  function airport() {
    return `<div class="eyebrow">NARITA AIRPORT SHOPPING</div><h1>機場購物</h1><p class="intro">成田第二航廈的伴手禮推薦、店家位置與安檢前後採買動線。</p><div class="supplement-root airport-shopping" data-supplement="airport"><section class="panel supplement-loading">正在載入機場購物推薦…</section></div>`;
  }
  function guide() {
    const sections = [
      ['交通與寄物',['nikko-luggage-info','narita-shuttle-fallback']],
      ['行前準備',['packing-list-1','packing-list-2']],
      ['退稅與寄件',['tax-refund','japan-post-domestic-1']]
    ];
    return `<div class="eyebrow">TRAVEL NOTES</div><h1>旅行資料</h1><p class="intro">行李清單、機場交通、退稅與寄件資料。</p><nav class="resource-links" aria-label="完整交通資料"><a href="./site-two/index.html">日光巴士完整攻略 ↗</a><a href="./site-four/index.html">成田入境與 Skyliner 交通 ↗</a></nav><nav class="trip-quick-actions" aria-label="點餐輔助">${foodCardButton()}</nav>${sections.map(([title,ids])=>`<h2 class="section-label">${title}</h2>${ids.map(id=>detail($('#'+id).querySelector('h2').textContent,$('#'+id),id)).join('')}`).join('')}`;
  }
  const couponItems = {
  "bic": {
    "short": "Bic Camera",
    "name": "Bic Camera",
    "category": "家電／藥妝",
    "image": "https://highway-buses.jp/chi/images/coupon/biccamera_01.jpg",
    "alt": "Bic Camera 京王電鐵巴士合作優惠券完整券面",
    "headline": "家電 7%・藥妝日用品 5%・清酒 3%",
    "expiry": "有效至 2026/12/31",
    "where": "DAY 2｜新宿 Bic Camera；DAY 4｜澀谷購物備用",
    "body": "使用效期至 12/31 的京王電鐵巴士合作券；原本 10/31 到期的版本不適用本次旅程。",
    "caution": "只有符合免稅資格的交易可用。清酒折扣限酒類櫃檯；兩個條碼都須出示給店員。",
    "url": "https://highway-buses.jp/chi/coupon/07",
    "link": "開啟 Bic Camera 券面與使用條件 ↗",
    "conditions": [
      [
        "折扣與門檻",
        "適用家電等 7%；藥品、化妝品、食品與日用品等 5%；日本清酒 3%。券頁未另外列出折扣最低消費額，仍須符合免稅資格及門檻。"
      ],
      [
        "適用店舖",
        "Bic Camera／Kojima 合作券指定門市；新宿、澀谷購物前先確認店舖與商品可用。"
      ],
      [
        "如何使用",
        "付款前出示護照正本與完整券面，請店員掃描上、下兩個條碼；免稅與優惠折扣分開計算。"
      ],
      [
        "不適用商品",
        "Apple、進口手錶、Grand Seiko、遊戲主機與原廠配件、遊戲軟體、PlayStation VR、Meta Quest、指定 Panasonic、DJI、FUJIFILM、部分威士忌等酒類、特價、Outlet、二手品等。清酒的獺祭、八海山不打折。"
      ],
      [
        "併用與付款",
        "不可與其他優惠券、活動折扣併用；券頁未列專屬付款方式，依門市規定。活動及排除商品可能調整。"
      ]
    ]
  },
  "alpen": {
    "short": "Alpen",
    "name": "Alpen TOKYO",
    "category": "運動／戶外用品",
    "image": "https://store.alpen-group.jp/campaign/group/coupon/matcha-coupon/media_MATCHA_coupon.png",
    "alt": "Alpen Group 官方合作優惠券完整券面",
    "headline": "指定商品 5% 折扣",
    "expiry": "有效至 2026/12/31",
    "where": "DAY 2｜新宿 Alpen TOKYO",
    "body": "新宿 Alpen TOKYO 購物可備用；使用品牌官方刊登的 MATCHA 合作券。",
    "caution": "5% 是購物折扣，不是再把券面 10% 免稅直接相加成 15% 總折扣。",
    "url": "https://store.alpen-group.jp/campaign/group/coupon/matcha-coupon/media_MATCHA_coupon.png",
    "link": "開啟 Alpen 官方完整券面 ↗",
    "conditions": [
      [
        "折扣與門檻",
        "5% 折扣。券面另列免稅購物門檻為含稅 ¥5,500，並非另一筆折扣；11 月退稅依新制及店舖確認。"
      ],
      [
        "適用店舖",
        "Alpen TOKYO、Alpen FUKUOKA、Alpen NAGOYA，以及日本其他指定可辦理免稅的集團門市。"
      ],
      [
        "如何使用",
        "付款前出示券面；辦理免稅須持護照等資格證明。"
      ],
      [
        "併用與限制",
        "不得與其他折扣併用。券面未逐項列出排除品牌、使用次數或限定支付方式；購買前請店員確認實際品項。"
      ]
    ]
  },
  "donki": {
    "short": "唐吉訶德",
    "name": "唐吉訶德",
    "category": "藥妝／零食／雜貨",
    "image": null,
    "liveNote": "請連網開啟唐吉訶德官方領券頁，依金額選券並出示即時條碼。截圖無法使用。",
    "headline": "未稅滿 ¥10,000／¥30,000：最高 5%／7%",
    "expiry": "即時券・效期以領券頁為準",
    "where": "DAY 2／4／5｜新宿、澀谷、淺草等分店",
    "body": "使用 WAmazing 合作連結開啟官方電子券。必須連網，不能用儲存的圖片或截圖結帳。",
    "caution": "未公布固定截止日，不能保證 11 月仍是相同優惠；請在購物當日開啟官方券頁確認。",
    "url": "https://japanportal.donki-global.com/coupon/?ptcd=0281000002",
    "link": "開啟唐吉訶德官方即時領券頁 ↗",
    "conditions": [
      [
        "折扣與門檻",
        "單次符合免稅資格的消費：未稅 ¥10,000 起 5%；未稅 ¥30,000 起 7%。不可把兩級折扣疊加。"
      ],
      [
        "適用店舖",
        "官方電子券指定的日本門市；新宿、澀谷、淺草購物時先確認該店可用。"
      ],
      [
        "如何使用",
        "付款前開啟官方頁並依畫面出示即時條碼；需要網路。付款後不能補用，截圖無效。"
      ],
      [
        "不適用商品",
        "酒、菸、POSA 儲值卡、遊戲主機、單件未稅 ¥100,000 以上商品及限價商品等；這些商品也不計入用券門檻。"
      ],
      [
        "次數與併用",
        "單次使用券，使用後不可再次用同一張。不可與其他折扣或服務併用；支付方式及當日券狀態以官方頁與門市為準。"
      ]
    ]
  },
  "matsukiyo": {
    "short": "松本清",
    "name": "松本清 Matsumoto Kiyoshi",
    "category": "藥妝／日用品",
    "image": "https://content.fun-japan.jp/renewal-prod/cms/light_coupon/TW---_2026-02-24-12-10-22.jpg",
    "alt": "松本清 FUN! JAPAN 優惠券完整券面",
    "headline": "滿 ¥10,000／¥30,000／¥50,000：3%／5%／7%",
    "expiry": "有效至 2027/3/31",
    "where": "東京購物備用｜遇到合適門市再使用",
    "body": "提供給居住日本以外旅客的一般讀者券，不需要加入 FUN! JAPAN 會員；請選購物店家對應的券面。",
    "caution": "松本清與 Cocokara Fine 的券不可拿錯。部分門市／商品不適用；第一類醫藥品在藥師不在場時不能販售。",
    "url": "https://fun-japan.jp/tw/light-coupons/27",
    "link": "開啟松本清優惠券與條件 ↗",
    "conditions": [
      [
        "折扣與門檻",
        "¥10,000～29,999：3%；¥30,000～49,999：5%；¥50,000 起：7%。券面未明示含稅／未稅口徑，付款前請店員確認符合門檻的商品小計；不要把排除品項直接算入。"
      ],
      [
        "資格與門市",
        "居住日本以外的旅客適用；部分門市除外，先向結帳店員確認。"
      ],
      [
        "如何使用",
        "結帳前出示這家店的手機券面；適用的折扣級距由店員核算。"
      ],
      [
        "不適用商品",
        "諮詢／專櫃化妝品、香菸、雜誌、嬰兒尿布、嬰兒食品等指定商品除外；不是全部食品一律排除。"
      ],
      [
        "併用與付款",
        "不可與其他優惠券或折扣併用。券面未另列指定付款方式或使用次數，依門市確認。"
      ]
    ]
  },
  "cocokara": {
    "short": "Cocokara",
    "name": "Cocokara Fine",
    "category": "藥妝／日用品",
    "image": "https://content.fun-japan.jp/renewal-prod/cms/light_coupon/-TW---_2026-02-24-12-08-59.jpg",
    "alt": "Cocokara Fine FUN! JAPAN 優惠券完整券面",
    "headline": "滿 ¥10,000／¥30,000／¥50,000：3%／5%／7%",
    "expiry": "有效至 2027/3/31",
    "where": "東京購物備用｜與松本清分開選對應券",
    "body": "提供給居住日本以外旅客的一般讀者券，不需要加入 FUN! JAPAN 會員；請選購物店家對應的券面。",
    "caution": "松本清與 Cocokara Fine 的券不可拿錯。部分門市／商品不適用；第一類醫藥品在藥師不在場時不能販售。",
    "url": "https://fun-japan.jp/tw/light-coupons/44",
    "link": "開啟 Cocokara Fine 優惠券與條件 ↗",
    "conditions": [
      [
        "折扣與門檻",
        "¥10,000～29,999：3%；¥30,000～49,999：5%；¥50,000 起：7%。券面未明示含稅／未稅口徑，付款前請店員確認符合門檻的商品小計；不要把排除品項直接算入。"
      ],
      [
        "資格與門市",
        "居住日本以外的旅客適用；部分門市除外，先向結帳店員確認。"
      ],
      [
        "如何使用",
        "結帳前出示這家店的手機券面；適用的折扣級距由店員核算。"
      ],
      [
        "不適用商品",
        "諮詢／專櫃化妝品、香菸、雜誌、嬰兒尿布、嬰兒食品等指定商品除外；不是全部食品一律排除。"
      ],
      [
        "併用與付款",
        "不可與其他優惠券或折扣併用。券面未另列指定付款方式或使用次數，依門市確認。"
      ]
    ]
  },
  "sundrug": {
    "short": "SUNDRUG",
    "name": "尚都樂客 SUNDRUG",
    "category": "藥妝／日用品",
    "image": "https://taxfreeshops.sakura.ne.jp/cms/wp-content/uploads/2025/11/coupon_en_2026.jpg",
    "alt": "SUNDRUG TAXFREESHOPS.JP 特別優惠券完整券面",
    "headline": "滿 ¥10,000／¥30,000／¥50,000：3%／5%／7%",
    "expiry": "有效至 2026/12/31",
    "where": "DAY 2｜新宿通店購物備用",
    "body": "新宿通店刊登的 SUNDRUG 特別券；完整券面包含三個折扣級距。",
    "caution": "只限免稅交易，Direx 不適用；不要因為同屬集團就使用這張券。",
    "url": "https://www.taxfreeshops.jp/zhtw/shop/900000440/coupon/10001254",
    "link": "開啟 SUNDRUG 新宿通店券頁 ↗",
    "conditions": [
      [
        "折扣與門檻",
        "¥10,000～29,999：3%；¥30,000～49,999：5%；¥50,000 起：7%。券面未明示含稅／未稅口徑，付款前請店員確認符合門檻的商品小計；不要把排除品項直接算入。"
      ],
      [
        "資格與門市",
        "限符合免稅資格的交易；指定 SUNDRUG 店舖適用，Direx 除外。"
      ],
      [
        "如何使用",
        "結帳前出示完整券面，讓店員依購物金額選擇對應條碼。"
      ],
      [
        "不適用與併用",
        "諮詢化妝品等指定品項除外，不可與其他優惠券併用。券面未另列付款方式及使用次數。"
      ]
    ]
  },
  "sugi": {
    "short": "杉藥局",
    "name": "SUGI 杉藥局",
    "category": "藥妝／日用品",
    "image": "https://content.fun-japan.jp/renewal-prod/cms/light_coupon/JTB35---_2026-04-16-06-13-40.png",
    "alt": "杉藥局 FUN! JAPAN 合作優惠券完整券面",
    "headline": "滿 ¥10,000／¥30,000／¥50,000：4%／6%／8%",
    "expiry": "有效至 2027/2/28",
    "where": "東京購物備用｜不為用券另外繞路",
    "body": "新增 FUN! JAPAN 合作券，效期涵蓋旅程。此版本僅適用免稅交易，不是官方另一張單品 15% 券。",
    "caution": "依這張券面，「所有食品」列為排除項目；不要套用其他版本的食品規則。券面 14%／16%／18% 字樣不是可直接相加的總折扣。",
    "url": "https://fun-japan.jp/tw/light-coupons/50",
    "link": "開啟杉藥局優惠券與完整條件 ↗",
    "conditions": [
      [
        "折扣與門檻",
        "¥10,000～29,999：4%；¥30,000～49,999：6%；¥50,000 起：8%。券面未明示含稅／未稅口徑，付款前請店員確認符合門檻的商品小計；不要把排除品項直接算入。"
      ],
      [
        "資格與門市",
        "日本以外居住的旅客，於可辦理免稅的杉藥局門市使用；請先確認門市與品項適用。"
      ],
      [
        "如何使用",
        "付款前出示整張券面及護照，由店員選擇符合購物金額的條碼。結帳後不可補用。"
      ],
      [
        "不適用商品",
        "處方藥、百貨／專櫃化妝品、所有食品、POSA 卡等；部分商品可能折扣較低或不適用。"
      ],
      [
        "併用與限制",
        "同一商品不可重複用折扣券、減價券或其他優惠。不接受因個人因素退貨；付款方式與次數未另列，依店舖規定。"
      ]
    ]
  },
  "yam": {
    "short": "LABI",
    "name": "山田電機 LABI",
    "category": "家電",
    "image": "https://livejapan.com/public/operation/coupon/assets/image/summary-yamadadenki-coupon-en2.png",
    "alt": "山田電機 LABI 完整優惠券券面",
    "headline": "指定商品最高 7% 折扣",
    "expiry": "有效至 2026/12/31",
    "where": "DAY 2｜新宿西口；DAY 4｜澀谷 LABI 比價備用",
    "body": "指定商品最高 7%，不是每件商品都打 7% 折扣；不需註冊或下載 App。",
    "caution": "付款方式依分店，不限定只能刷卡；先讓店員核對商品與用券資格。",
    "url": "https://livejapan.com/public/operation/coupon/yamadadenki/en.html",
    "link": "開啟 LABI 即時券頁與指定店舖（英文）↗",
    "conditions": [
      [
        "折扣與門檻",
        "指定商品最高 7%。券頁未另列折扣最低金額；免稅資格與退稅門檻仍需另外符合。"
      ],
      [
        "適用店舖",
        "日本指定免稅店，包括 LABI 澀谷、新宿西口，以及活動列出的 Tecc Land、Tecc LIFE SELECT、Best Denki 等；非所有分店適用。"
      ],
      [
        "如何使用",
        "付款前開啟條碼給店員掃描，帶護照正本。可在效期內多次消費使用，但同一筆交易只可用一張一次。"
      ],
      [
        "不適用商品",
        "Apple、遊戲主機、Outlet／二手品、指定 Panasonic／Dyson、限量與特價清倉商品、禮券及商品券等。"
      ],
      [
        "併用與付款",
        "不可併用其他促銷，不可拆券或兌換現金；付款方式依各店規定。"
      ]
    ]
  },
  "laox": {
    "short": "LAOX",
    "name": "LAOX 樂購仕",
    "category": "家電／伴手禮",
    "image": "https://rimage.gnst.jp/livejapan.com/public/operation/coupon/assets/image/laox_zh-tw_NP2.jpg",
    "alt": "LAOX 樂購仕完整優惠券券面",
    "headline": "滿 ¥5,000：指定商品 8% 折扣",
    "expiry": "有效至 2026/12/31",
    "where": "DAY 5｜淺草店；DAY 9｜成田 T2 店",
    "body": "目前指定 7 間門市，淺草店與成田第二航廈店都在名單內。",
    "caution": "券面沒有註明 ¥5,000 是含稅或未稅，因此不再標成「未稅滿 ¥5,000」；結帳前先確認。",
    "url": "https://livejapan.com/public/operation/coupon/laox/en.html",
    "link": "開啟 LAOX 券面與適用門市（英文）↗",
    "conditions": [
      [
        "折扣與門檻",
        "單店購物滿 ¥5,000，適用商品 8% 折扣；含稅／未稅口徑及排除品項是否計入門檻，須由門市確認。"
      ],
      [
        "適用店舖",
        "淺草、成田機場 T2、秋葉原本店、GINZA、心齋橋筋、新千歲國際線、Watch. DiverCity Tokyo Plaza 指定店。"
      ],
      [
        "如何使用",
        "付款前出示手機券面；若辦理退稅，另須符合旅客資格與門檻。"
      ],
      [
        "不適用商品",
        "遊戲、周大福商品、精品品牌、進口手錶、藥品、特價商品等。"
      ],
      [
        "併用與付款",
        "不得與其他折扣券併用；券頁列可使用主要信用卡及條碼支付，實際支援支付工具請詢問門市。"
      ]
    ]
  },
  "odakyu": {
    "short": "小田急",
    "name": "小田急百貨 新宿店",
    "category": "百貨／服飾",
    "image": "https://highway-buses.jp/chi/images/coupon/odakyu_01.png",
    "alt": "小田急百貨新宿店京王電鐵巴士合作優惠券完整券面",
    "headline": "單筆含稅滿 ¥1,000：指定商品 6% 折扣",
    "expiry": "有效至 2028/3/31",
    "where": "DAY 2｜新宿購物備用",
    "body": "新增新宿小田急百貨旅客券；購買服飾等適用商品時可比較使用，不因此增加購物站。",
    "caution": "食品、餐廳、咖啡店不適用；同棟 Bic Camera 也不能使用這張百貨券。",
    "url": "https://highway-buses.jp/chi/coupon/04",
    "link": "開啟小田急百貨完整券面與條件 ↗",
    "conditions": [
      [
        "折扣與門檻",
        "單張收據含稅金額 ¥1,000 起，適用商品 6% 折扣。"
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
  }
};

  function coupons() {
    const item=couponItems[state.coupon] || couponItems.bic;
    const visual=item.image
      ? `<a class="coupon-image-link" href="${item.image}" target="_blank" rel="noopener noreferrer" aria-label="放大查看${escape(item.name)}完整優惠券"><img class="coupon-art" src="${item.image}" alt="${escape(item.alt)}" loading="lazy" decoding="async"/></a>`
      : `<p class="coupon-live-note">${escape(item.liveNote)}</p>`;
    return `<div class="eyebrow">TRIP SAVINGS</div><h1>旅行優惠券</h1><p class="intro">依 2026/11/21–11/29 行程重新查核。選擇店家查看完整條件，點券面可放大；唐吉訶德與 AEON 須於即時頁／現場確認效期。</p><nav class="day-rail coupon-rail" aria-label="選擇優惠券">${Object.entries(couponItems).map(([key,value])=>`<button class="day-button" type="button" data-coupon="${key}" aria-pressed="${key===state.coupon}"><span>優惠券</span><b>${escape(value.short)}</b><small>${escape(value.category)}</small></button>`).join('')}</nav>
      <article class="panel coupon-card coupon-photo-card"><div class="coupon-top"><span class="pill">${escape(item.category)}｜${escape(item.name)}</span><span class="coupon-status">${escape(item.expiry)}</span></div><h2>${escape(item.headline)}</h2><p><strong>${escape(item.where)}</strong></p><p>${escape(item.body)}</p><div class="coupon-layout"><section class="coupon-visual" aria-label="完整優惠券">${visual}</section><section class="coupon-rules" aria-label="優惠券使用條件"><h3>使用條件</h3><dl>${item.conditions.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section></div><p class="coupon-caution">${escape(item.caution)}</p><a href="${item.url}" target="_blank" rel="noopener noreferrer">${escape(item.link)}</a></article>
      <details class="coupon-tax-note"><summary>11 月退稅與券面折扣如何看？</summary><p>2026/11/1 起，市區免稅購物先付含稅價格，出境時在託運行李前完成海關確認，再依店家方式退還消費稅。券面若寫「10% 免稅＋折扣」，仍須依 11 月新制辦理退稅；優惠券折扣與消費稅退稅分開看，不能直接相加當成總折扣。<a href="https://www.mlit.go.jp/kankocho/tax-free/page01_000001_00021.html" target="_blank" rel="noopener noreferrer">觀光廳新制說明 ↗</a></p></details><p class="coupon-footnote">查核日期：2026/10/16。9 張券有明示效期並涵蓋旅程；唐吉訶德、AEON 為即時／現場券，旅期可用性仍待當日確認。優惠內容、適用品項及店舖以發行頁與結帳確認為準；請在付款前出示護照和對應券面。</p>`;
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
        target.innerHTML=`<section class="panel"><h2>第 ${selectedDay} 天餐廳攻略</h2><p>這一天尚未收錄餐廳攻略，可切換其他日期查看。</p></section>`;
      }
      if(!target.children.length)throw new Error('找不到可顯示的資料');
    } catch(error) {
      target.innerHTML=`<section class="panel supplement-error"><h2>暫時無法載入</h2><p>${escape(error.message||'請稍後再試')}</p><a href="${baseUrl.href}">開啟原始資料頁 ↗</a></section>`;
    }
  }
  function statusText() {
    if (!navigator.onLine) return offlineReady ? '離線閱讀中 · 地圖與外部連結需連線' : '目前離線 · 本次顯示已載入的行程';
    if (offlineReady) return '行程已可離線閱讀 · 地圖與外部連結需連線';
    return offlineFailed ? '目前可線上閱讀 · 下次連線時會再次嘗試儲存離線行程' : '正在準備離線行程，請保持連線…';
  }
  function revealActiveDay() {
    const active = main.querySelector('.day-button[aria-pressed=true]');
    if (!active) return;
    const rail = active.parentElement;
    rail.scrollLeft += active.getBoundingClientRect().left - rail.getBoundingClientRect().left - (rail.clientWidth - active.offsetWidth) / 2;
  }
  const wordModelPatches = [{"id": "WEB00006", "chapter": "days-A-1", "locator": "root/div[1]/aside[1]/div[2]/inline", "old": "今日路線TODAY'S ROUTE", "html": "今日路線"}, {"id": "WEB00007", "chapter": "days-A-1", "locator": "root/div[1]/aside[1]/div[2]/div[2]/inline", "old": "A 組 12:10 抵達成田 T2 → 14:22 Skyliner 為主 → 約 15:05–15:15 抵達本所吾妻橋 → 依房東回覆寄放行李或 16:00 入住 → 野口鮮魚店 → 視時間略過淺草橋 → 丸之內點燈 → 與 B 組會合晚餐。", "html": "依房東回覆寄放行李或 16:00 入住 → 野口鮮魚店 → 視時間略過淺草橋 → 丸之內點燈 → 與 B 組會合晚餐。"}, {"id": "WEB00008", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/h2[1]", "old": "今日安排ITINERARY", "html": "今日安排"}, {"id": "WEB00027", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[2]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[1]/dd[2]", "old": "野口鮮魚店 實拍攻略", "html": "野口鮮魚店 "}, {"id": "WEB00035", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[3]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[1]/dd[2]", "old": "塩パン屋 パンメゾン 實拍攻略", "html": "塩パン屋 パンメゾン "}, {"id": "WEB00041", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[4]/div[1]/div[2]/inline", "old": "彈性景點：淺草橋銀杏岡八幡神社、シモジマ；時間不足時整段略過", "html": "<strong>彈性景點：</strong>淺草橋銀杏岡八幡神社、シモジマ"}, {"id": "WEB00043", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[4]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[1]/dd[2]", "old": "銀杏岡八幡神社 → シモジマ淺草橋本店", "html": "銀杏岡八幡神社 "}, {"id": "WEB00049", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[5]/div[1]/div[2]/inline", "old": "夜晚點燈：日比谷公園 Hibiya Art Park（11/13–11/29，09:00–21:00，免費、免預約）→ 丸之內仲通與 Marunouchi Bright Holiday 2026「哈利波特・魔法之雪」（11/12–12/25）；細節預計 10 月下旬公布，出發前核對。丸之內活動官網 ↗", "html": "<strong>夜晚點燈：</strong>日比谷公園（11/13–11/29，09:00–21:00，免費、免預約）→ 丸之內仲通與2026「哈利波特・魔法之雪」（11/12–12/25）。丸之內活動官網 ↗"}, {"id": "WEB00064", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[2]/inline", "old": "晚餐：鳥貴族 淺草店 實拍攻略（11/21 21:30 已訂位｜A＋B 共 5 位成人；A 組先報到入座，B 組抵達後加入） 訂位資料見「已預約」 ↗", "html": "<strong>晚餐：</strong>鳥貴族 淺草店 實拍攻略（11/21 21:30 已訂位） 訂位資料見「已預約」 ↗"}, {"id": "WEB00066", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[1]/dd[2]", "old": "鳥貴族淺草店 實拍攻略", "html": "鳥貴族淺草店 "}, {"id": "WEB00077", "chapter": "days-A-2", "locator": "root/div[1]/aside[1]/div[2]/inline", "old": "今日路線TODAY'S ROUTE", "html": "<strong>今日路線</strong>"}, {"id": "WEB00079", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/h2[1]", "old": "今日安排ITINERARY", "html": "今日安排"}, {"id": "WEB00080", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/button[1]", "old": "建議時間09:00–09:25", "html": "建議時間<strong>09:00–09:25</strong>"}, {"id": "WEB00081", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[2]/inline", "old": "早餐：三軒茶屋 nukumuku 實拍攻略 手作麵包店（09:00–09:25 建議外帶；11/22 的店舖與咖啡時段待官方公告確認）", "html": "<strong>早餐：</strong>三軒茶屋 nukumuku 實拍攻略 手作麵包店（09:00–09:25 建議外帶）"}, {"id": "WEB00093", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[3]/dd[2]", "old": "約 09:00–09:25，一起買麵包外帶。", "html": "約 09:00–09:25 買麵包，優先外帶。"}, {"id": "WEB00094", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[2]/div[1]/button[1]", "old": "建議時間10:00–10:30", "html": "建議時間<strong>10:00–10:30</strong>"}, {"id": "WEB00095", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[2]/div[1]/div[2]/inline", "old": "上午景點：豪德寺（約 10:00–10:30）；參拜後大家一起走到梅丘美登利取號", "html": "<strong>上午景點：</strong><strong>豪德寺（約 10:00–10:30）；參拜後大家一起走到梅丘美登利取號</strong>"}, {"id": "WEB00107", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[2]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[3]/dd[2]", "old": "約 10:00–10:30 參拜，之後一起往梅丘；奉納的招福貓請勿移動。", "html": "勿觸碰奉納招福貓。"}, {"id": "WEB00112", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[3]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[1]/dd[2]", "old": "RARASAND 實拍攻略／IRON COFFEE 實拍攻略", "html": "RARASAND ／IRON COFFEE "}, {"id": "WEB00118", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[4]/div[1]/div[2]/inline", "old": "午餐：梅丘寿司の美登利 総本店 實拍攻略 (週日 11:00–21:00、L.O.20:30 | 早餐、豪德寺後，5 人一起到店取號；依現場叫號用餐)", "html": "<strong>午餐：</strong>梅丘寿司の美登利 総本店 實拍攻略 (週日 11:00–21:00、L.O.20:30 | 早餐、豪德寺後，5 人一起到店取號；依現場叫號用餐)"}, {"id": "WEB00120", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[4]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[1]/dd[2]", "old": "梅丘寿司の美登利 総本店 實拍攻略", "html": "梅丘寿司の美登利 総本店 "}, {"id": "WEB00124", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[4]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dd[2]", "old": "5 人一起到店取號，依現場叫號入座。", "html": "5 人一起到店取號，依現場叫號入座。"}, {"id": "WEB00135", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[2]/inline", "old": "晚餐：一蘭 新宿歌舞伎町店 實拍攻略（24 小時營業｜25 個單人座位｜A＋B 組 5 人接受分開入座）", "html": "<strong>晚餐：</strong>一蘭 新宿歌舞伎町店 實拍攻略（24 小時營業｜25 個單人座位）"}, {"id": "WEB00147", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[3]/dd[2]", "old": "—", "html": "     "}, {"id": "WEB00153", "chapter": "days-A-3", "locator": "root/div[1]/aside[1]/div[2]/inline", "old": "今日路線TODAY'S ROUTE本所吾妻橋 → 自選谷根千或京島・向島 → 晴空塔 Solamachi → 炭火焼肉おくさこ晚餐 → 晴空塔夜景（選逛）", "html": "<strong>今日路線</strong><strong>本所吾妻橋 → 自選谷根千或京島・向島 → 晴空塔 Solamachi → 炭火焼肉おくさこ晚餐 → 晴空塔夜景（選逛）</strong>"}, {"id": "WEB00165", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[1]/div[3]/dd[2]", "old": "09:00 前到站牌；11/23 為國定假日，依休日班次與即時位置出發。", "html": "09:00 前到站牌；11/23 為國定假日。"}, {"id": "WEB00261", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/inline", "old": "成田入境與 Skyliner 交通 ↗              ", "html": " "}, {"id": "WEB00267", "chapter": "days-A-4", "locator": "root/div[1]/aside[1]/div[2]/inline", "old": "今日路線TODAY'S ROUTE", "html": "今日路線"}, {"id": "WEB00005", "chapter": "days-A-1", "locator": "root/div[1]/aside[1]/section[1]/div[3]/inline", "old": "2026/11/21（六） · A 組丸之內冬季點燈", "html": null}, {"id": "WEB00009", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/button[1]", "old": "建議時間15:20–16:00", "html": null}, {"id": "WEB00010", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[2]/inline", "old": "先處理行李：出發前向民宿確認約 15:20 能否先寄放 A 組 3 位成人行李；未獲明確同意時，等 16:00 自助入住後再離開。", "html": null}, {"id": "WEB00011", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[1]/dt[1]", "old": "路段／地點", "html": null}, {"id": "WEB00012", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[1]/dd[2]", "old": "成田機場第二航廈 → 本所吾妻橋站 ", "html": null}, {"id": "WEB00013", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00014", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dd[2]", "old": "Skyliner＋京成押上線／都營淺草線", "html": null}, {"id": "WEB00015", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00016", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dd[2]", "old": "A 組以 14:22 Skyliner 136 號為主；能趕上時可搭 13:22 班。", "html": null}, {"id": "WEB00017", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[1]/dt[1]", "old": "路段／地點", "html": null}, {"id": "WEB00018", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[1]/dd[2]", "old": "東京包棟民宿", "html": null}, {"id": "WEB00019", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00020", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[2]/dd[2]", "old": "步行", "html": null}, {"id": "WEB00021", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00022", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[3]/dd[2]", "old": "未獲房東明確同意，不可提前寄放行李。", "html": null}, {"id": "WEB00023", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/div[4]/inline", "old": "下町散步地圖 ↗", "html": null}, {"id": "WEB00028", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[2]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00029", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[2]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dd[2]", "old": "民宿步行約 5–10 分鐘", "html": null}, {"id": "WEB00036", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[3]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00037", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[3]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dd[2]", "old": "步行", "html": null}, {"id": "WEB00054", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[5]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00055", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[5]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dd[2]", "old": "—", "html": null}, {"id": "WEB00058", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[5]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00059", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[5]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[2]/dd[2]", "old": "步行", "html": null}, {"id": "WEB00060", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[5]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00061", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[5]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[3]/dd[2]", "old": "下雨改走地下通道與 KITTE。", "html": null}, {"id": "WEB00069", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00070", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dd[2]", "old": "21:30 已訂位，A＋B 共 5 位成人；A 組先報到入座，B 組抵達後加入。若 B 組延誤，請儘早聯絡店家。", "html": null}, {"id": "WEB00071", "chapter": "days-A-1", "locator": "root/div[1]/section[2]/inline", "old": "成田入境與 Skyliner 交通 ↗              ", "html": null}, {"id": "WEB00076", "chapter": "days-A-2", "locator": "root/div[1]/aside[1]/section[1]/div[3]/inline", "old": "2026/11/22（日） · A 組豪德寺招福貓群", "html": null}, {"id": "WEB00086", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00087", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[3]/dd[2]", "old": "抵達後在同一出口集合。", "html": null}, {"id": "WEB00090", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00091", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[1]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[2]/dd[2]", "old": "步行", "html": null}, {"id": "WEB00113", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[3]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00114", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[3]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dd[2]", "old": "步行／擇一", "html": null}, {"id": "WEB00121", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[4]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00122", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[4]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dd[2]", "old": "步行至梅丘", "html": null}, {"id": "WEB00133", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[5]/div[1]/div[3]/div[4]/inline", "old": "新宿購物地圖 ↗", "html": null}, {"id": "WEB00138", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00139", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[3]/section[3]/div[1]/dl[1]/div[2]/dd[2]", "old": "步行", "html": null}, {"id": "WEB00146", "chapter": "days-A-2", "locator": "root/div[1]/section[2]/ol[2]/li[6]/div[1]/div[3]/section[3]/div[1]/dl[2]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00152", "chapter": "days-A-3", "locator": "root/div[1]/aside[1]/section[1]/div[3]/inline", "old": "2026/11/23（一） · A 組谷根千老街散步", "html": null}, {"id": "WEB00155", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/h2[2]", "old": "上午想走哪一條？", "html": null}, {"id": "WEB00156", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/p[3]", "old": "A、B 組都可自由選擇，與航班組別無關。", "html": null}, {"id": "WEB00162", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[1]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00163", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[1]/div[2]/dd[2]", "old": "步行", "html": null}, {"id": "WEB00174", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[3]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00175", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[3]/div[2]/dd[2]", "old": "步行", "html": null}, {"id": "WEB00180", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[4]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00181", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[4]/div[2]/dd[2]", "old": "巷弄步行", "html": null}, {"id": "WEB00186", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[5]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00187", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[5]/div[2]/dd[2]", "old": "步行＋自由逛街", "html": null}, {"id": "WEB00192", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[6]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00193", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[4]/div[1]/dl[6]/div[2]/dd[2]", "old": "步行", "html": null}, {"id": "WEB00215", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[10]/div[1]/dl[1]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00216", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[10]/div[1]/dl[1]/div[3]/dd[2]", "old": "—", "html": null}, {"id": "WEB00219", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[10]/div[1]/dl[2]/div[2]/dt[1]", "old": "移動方式", "html": null}, {"id": "WEB00220", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[10]/div[1]/dl[2]/div[2]/dd[2]", "old": "參拜／拍照", "html": null}, {"id": "WEB00221", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[10]/div[1]/dl[2]/div[3]/dt[1]", "old": "安排與提醒", "html": null}, {"id": "WEB00222", "chapter": "days-A-3", "locator": "root/div[1]/section[2]/ol[4]/li[1]/div[1]/div[3]/section[10]/div[1]/dl[2]/div[3]/dd[2]", "old": "—", "html": null}, {"id": "WEB00266", "chapter": "days-A-4", "locator": "root/div[1]/aside[1]/section[1]/div[3]/inline", "old": "2026/11/24（二） · A 組明治神宮外苑銀杏大道", "html": null}];
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


  const dailyCompactPlan = {"append":[{"id":"WEB00041","day":1,"text":"彈性景點：淺草橋銀杏岡八幡神社、シモジマ","add":"時間不足時整段略過。"},{"id":"WEB00049","day":1,"text":"夜晚點燈：日比谷公園（11/13–11/29，09:00–21:00，免費、免預約）→ 丸之內仲通與2026「哈利波特・魔法之雪」（11/12–12/25）。丸之內活動官網 ↗","add":"沿丸之內仲通り點燈路線走到東京車站丸之內廣場。"},{"id":"WEB00095","day":2,"text":"上午景點：豪德寺（約 10:00–10:30）；參拜後大家一起走到梅丘美登利取號","add":"勿觸碰奉納招福貓。"},{"id":"WEB00110","day":2,"text":"點心：RARASAND 實拍攻略 / IRON COFFEE 實拍攻略 （想吃點心或喝咖啡時擇一）","add":"豪德寺後順路買點心，再一起去梅丘。"},{"id":"WEB00118","day":2,"text":"午餐：梅丘寿司の美登利 総本店 實拍攻略 (週日 11:00–21:00、L.O.20:30 | 早餐、豪德寺後，5 人一起到店取號；依現場叫號用餐)","add":"取號時詢問拆桌與叫號規則。"},{"id":"WEB00135","day":2,"text":"晚餐：一蘭 新宿歌舞伎町店 實拍攻略（24 小時營業｜25 個單人座位）","add":"Alpen TOKYO 後前往，A＋B 組 5 人可分批入座；候位超過 45 分鐘就改店。"},{"id":"WEB00279","day":4,"text":"上午景點：明治神宮外苑銀杏大道。人潮多時先拍團體照，再自由拍攝，之後前往表參道、原宿。","add":"人潮多時縮短停留。"},{"id":"WEB00287","day":4,"text":"表參道／原宿分組逛街：KIDDY LAND 原宿店、NUMBER SUGAR等由各組自選；依午餐店別調整先後，午餐後直接往澀谷，不再折返集合。","add":"分組前確認集合時間與出口。"},{"id":"WEB00321","day":4,"text":"步行往澀谷：午餐順序依選店調整：選 Sweet Check 時先用餐，再往西逛 KIDDY LAND；選 BASO／麺散時先逛 KIDDY LAND，再用餐。各組午餐後不回 KIDDY LAND，直接往 FREAK'S STORE Shibuya；BASO／麺散沿貓街南行，經宮下公園步行約 15–20 分鐘。","add":"Sweet Check 組依地圖走西南向路線。"},{"id":"WEB00338","day":4,"text":"澀谷 PARCO：從 FREAK'S STORE 步行前往 澀谷 PARCO（宇田川町 15-1）。先逛想去的樓層，再到 B1 晚餐；一般商店營業至 21:00，部分店家不同。","add":"一般商店 11:00 開店。"},{"id":"WEB00357","day":4,"text":"飯後購物：時間與體力允許再往 MEGA 唐吉訶德 澀谷本店；候位太久就跳過，直接到車站會合。","add":"不為購物折返 PARCO。"},{"id":"WEB00365","day":4,"text":"回程集合：先約好時間，在澀谷站八公口外集合；點名後一起入站，返回本所吾妻橋民宿。","add":"先回者在群組回報。"},{"id":"WEB00404","day":5,"text":"小吃美食：花月堂菠蘿麵包 實拍攻略、壽壽喜園抹茶冰淇淋 實拍攻略、龜十銅鑼燒 實拍攻略","add":"午餐後看想吃哪一家，順路買。"},{"id":"WEB00412","day":5,"text":"11/25 午餐｜分開用餐","add":"餐後兩組在淺草會合。"},{"id":"WEB00433","day":5,"text":"民宿休息：放物品、稍作休息，再一起出發。","add":"約 15:30 回民宿，休息至 16:30。"},{"id":"WEB00452","day":5,"text":"六本木 HARBS：再到 HARBS 六本木 Hills 店；座位不能預約，有位就內用、滿席直接外帶，不為等位耽誤市集。週三營業至 20:00，蛋糕／飲料最後點餐 19:30、餐點最後點餐 17:00；傍晚只安排蛋糕與飲料。","add":"TEN& 外帶與轉乘時間請抓彈性。"},{"id":"WEB00461","day":5,"text":"六本木聖誕市集：HARBS 後步行到六本木新城大屋頂廣場逛聖誕市集；2026 市集 11/21–12/25、11:00–21:00。活動官網 ↗","add":"交通或排隊延誤時，依實際時間調整停留。"},{"id":"WEB00701","day":8,"text":"主要景點：成田山表參道 → 新勝寺大本堂 → 成田山公園紅葉祭 → なごみの米屋。","add":"16:40 左右開始往京成成田站移動。"},{"id":"WEB00709","day":8,"text":"傍晚購物：京成成田站 6 號搭付費直行巴士前往 AEON MALL；主搭 17:15／17:47，回程主搭 20:28（星巴克前）或 20:29（Mall East）。查看時刻表 ↓","add":"去程延誤可改 18:30；逛至閉店可改搭 21:05／21:06 回程。前門上車先付費，成人單程 220 円，可用 IC 卡，車程約 10 分鐘。專門店 21:00 關門，全團先約定回程站牌。"}],"remove":[{"id":"WEB00031","day":1,"text":"不可預約；建議候位最多 45 分鐘，17:00 仍未入座或已售罄就改文字燒 CHICO。"},{"id":"WEB00039","day":1,"text":"若用餐延誤，直接略過。"},{"id":"WEB00047","day":1,"text":"時間不足時整段略過。"},{"id":"WEB00057","day":1,"text":"丸之內仲通り點燈 → 東京車站丸之內廣場"},{"id":"WEB00093","day":2,"text":"約 09:00–09:25 買麵包，優先外帶。"},{"id":"WEB00107","day":2,"text":"勿觸碰奉納招福貓。"},{"id":"WEB00116","day":2,"text":"豪德寺後順路擇一買點心，再一起前往梅丘取號。"},{"id":"WEB00124","day":2,"text":"5 人一起到店取號，依現場叫號入座。"},{"id":"WEB00141","day":2,"text":"A＋B 組 5 人可分批入座；候位超過 45 分鐘就改店。"},{"id":"WEB00285","day":4,"text":"人潮多時縮短停留。"},{"id":"WEB00299","day":4,"text":"分組前確認集合時間與出口。"},{"id":"WEB00319","day":4,"text":"Sweet Check 11:00 開店、備妥非現金支付；BASO 平日 11:30 開店、收現金；麺散營業時間依店家當日公告；可備信用卡或電子支付。"},{"id":"WEB00327","day":4,"text":"午餐後不回 KIDDY LAND 集合；各組依所選店家直接到 FREAK'S STORE Shibuya 會合，Sweet Check 組依地圖走西南向路線。"},{"id":"WEB00336","day":4,"text":"PARCO 宇田川町 15-1；先逛想去的樓層，再到 B1 用餐。一般商店 11:00–21:00。"},{"id":"WEB00355","day":4,"text":"吃牛肉 5 人到極味屋現場候位，不接受訂位；不吃牛肉 2 人在館內另選無牛餐廳（B1「真さか」為候選）。極味屋候位受理可能提早結束，以現場公告為準，建議 17:00–18:00 到場；餐後再會合。"},{"id":"WEB00363","day":4,"text":"候位或用餐較久時直接略過，不為購物折返 PARCO。"},{"id":"WEB00371","day":4,"text":"依約定時間在站外點名後一起入站；先回者在群組回報。"},{"id":"WEB00410","day":5,"text":"花月堂本店、壽壽喜園 11:00 開門，排在午餐後順逛；龜十可看排隊情況決定。"},{"id":"WEB00427","day":5,"text":"牛舌店兩筆共 5 人；另 2 位自由用餐，餐後在淺草會合。"},{"id":"WEB00439","day":5,"text":"約 15:30 回民宿放物品、休息至 16:30。"},{"id":"WEB00447","day":5,"text":"外帶；週三外帶時段為 17:30–20:00，外帶後往六本木。"},{"id":"WEB00458","day":5,"text":"有空位就內用，滿席或候位太久直接外帶；週三 20:00 打烊、蛋糕／飲料 L.O. 19:30、餐點 L.O. 17:00。TEN& 外帶與轉乘時間請抓彈性。"},{"id":"WEB00467","day":5,"text":"市集 11/21–12/25、11:00–21:00；甜點後前往，若交通或排隊延誤，依實際時間調整停留。"},{"id":"WEB00699","day":8,"text":"川豐先取號，等太久就在表參道附近另找想吃的店。"},{"id":"WEB00707","day":8,"text":"新勝寺後到成田山公園賞楓約 45–60 分鐘，再逛米屋；16:40 左右開始往京成成田站移動。"},{"id":"WEB00715","day":8,"text":"前門上車先付；成人 220 円，可用 IC 卡。"},{"id":"WEB00721","day":8,"text":"主搭 17:15／17:47 直行；延誤可改 18:30。"},{"id":"WEB00727","day":8,"text":"專門店 21:00 關門；全團先約定回程站牌。"},{"id":"WEB00733","day":8,"text":"主搭 20:28／20:29；逛至閉店可改 21:05／21:06。"},{"id":"WEB00740","day":8,"text":"主要安排飯店寄放行李 → 表參道午餐 → 新勝寺大本堂 → 成田山公園紅葉祭 → 米屋 → 17:15／17:47 巴士 → AEON MALL → 20:28／20:29 返回。"},{"id":"WEB00743","day":8,"text":"不是免費接駁車：這是京成成田站與 AEON MALL 成田之間的付費直行路線巴士。京成成田站從 6 號乘車處上車，成人單程 220 円、可使用 IC 卡，車程約 10 分鐘。"},{"id":"WEB00744","day":8,"text":"建議搭法"},{"id":"WEB00745","day":8,"text":"去程：17:15 或 17:47 直行。回程：20:28（星巴克前）／20:29（Mall East）；逛至專門店閉店可改 21:05／21:06。"},{"id":"WEB00027","day":1,"text":"野口鮮魚店 "},{"id":"WEB00035","day":1,"text":"塩パン屋 パンメゾン "},{"id":"WEB00043","day":1,"text":"銀杏岡八幡神社 "},{"id":"WEB00051","day":1,"text":"日比谷公園 "},{"id":"WEB00066","day":1,"text":"鳥貴族淺草店 "},{"id":"WEB00089","day":2,"text":"nukumuku "},{"id":"WEB00103","day":2,"text":"豪德寺"},{"id":"WEB00112","day":2,"text":"RARASAND ／IRON COFFEE "},{"id":"WEB00120","day":2,"text":"梅丘寿司の美登利 総本店 "},{"id":"WEB00137","day":2,"text":"Bic Camera 新宿東口店 → Alpen TOKYO → 一蘭 新宿歌舞伎町店 "},{"id":"WEB00281","day":4,"text":"明治神宮外苑銀杏大道"},{"id":"WEB00295","day":4,"text":"KIDDY LAND 原宿店／NUMBER SUGAR 表參道店 "},{"id":"WEB00315","day":4,"text":"Sweet Check 蛋包飯／BASO 蕎麥麵／うどん 麺散 "},{"id":"WEB00323","day":4,"text":"午餐店 → 宮下公園一帶 → FREAK'S STORE Shibuya"},{"id":"WEB00332","day":4,"text":"FREAK'S STORE Shibuya → 澀谷 PARCO"},{"id":"WEB00359","day":4,"text":"MEGA 唐吉訶德 澀谷本店"},{"id":"WEB00367","day":4,"text":"澀谷站八公口外 → 本所吾妻橋站"},{"id":"WEB00391","day":5,"text":"今戶神社"},{"id":"WEB00397","day":5,"text":"待乳山聖天 → 淺草寺"},{"id":"WEB00406","day":5,"text":"淺草花月堂 ／壽壽喜園 ／龜十 "},{"id":"WEB00423","day":5,"text":"牛たんの檸檬 淺草店 已訂 12:00／預約號／不吃牛 2 位：麺 みつヰ或秋光（候選）"},{"id":"WEB00435","day":5,"text":"淺草自由逛 → 東京民宿"},{"id":"WEB00443","day":5,"text":"東京民宿 → PATISSERIE TEN& 日比谷 OKUROJI"},{"id":"WEB00454","day":5,"text":"TEN& → HARBS 六本木 Hills 店"},{"id":"WEB00463","day":5,"text":"HARBS → 六本木新城聖誕市集（大屋頂廣場）"},{"id":"WEB00695","day":8,"text":"成田山表參道／川豐本店"},{"id":"WEB00703","day":8,"text":"新勝寺大本堂 → なごみの米屋"},{"id":"WEB00711","day":8,"text":"京成成田站 6 號乘車處"},{"id":"WEB00717","day":8,"text":"京成成田站 → AEON MALL 成田"},{"id":"WEB00723","day":8,"text":"AEON MALL 成田"},{"id":"WEB00729","day":8,"text":"AEON MALL 成田 → 京成成田站"}]};
  function compactDailyPresentation() {
    if(state.view!=='days')return;
    const normalize=t=>t.replace(/[\s\u3000]+/g,'').replace(/實拍攻略/g,'');
    const relevant=op=>op.day===state.day && !(state.group==='B'&&state.day===1) && !(state.group==='C'&&state.day===3);
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


  const dailyPlaceMaps = {"野口鮮魚店":"https://www.google.com/maps/search/?api=1&query=%E5%B0%8F%E3%81%95%E3%81%AA%E9%AD%9A%E3%81%8C%E3%81%97+%E9%87%8E%E5%8F%A3%E9%AE%AE%E9%AD%9A%E5%BA%97+%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%A2%A8%E7%94%B0%E5%8D%80%E6%9D%B1%E9%A7%92%E5%BD%A24-6-9+%E3%83%AA%E3%83%90%E3%83%BC%E3%83%8F%E3%82%A4%E3%83%84%E3%83%AF%E3%82%B3%E3%83%BC+1F","塩パン屋 パンメゾン":"https://www.google.com/maps/search/?api=1&query=%E5%A1%A9%E3%83%91%E3%83%B3%E5%B1%8B+%E3%83%91%E3%83%B3%E3%83%A1%E3%82%BE%E3%83%B3+%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E5%BA%97","鳥貴族 淺草店":"https://maps.app.goo.gl/EvEaCawMVivVVJDC9","nukumuku":"https://www.google.com/maps/search/?api=1&query=nukumuku+%E4%B8%89%E8%BB%92%E8%8C%B6%E5%B1%8B+%E6%9D%B1%E4%BA%AC","本所吾妻橋站":"https://www.google.com/maps/search/?api=1&query=%E6%9C%AC%E6%89%80%E5%90%BE%E5%A6%BB%E6%A9%8B%E9%A7%85","三軒茶屋站":"https://www.google.com/maps/search/?api=1&query=%E4%B8%89%E8%BB%92%E8%8C%B6%E5%B1%8B%E9%A7%85","三軒茶屋站 世田谷線":"https://www.google.com/maps/search/?api=1&query=%E4%B8%89%E8%BB%92%E8%8C%B6%E5%B1%8B%E9%A7%85%20%E4%B8%96%E7%94%B0%E8%B0%B7%E7%B7%9A","宮之坂站":"https://www.google.com/maps/search/?api=1&query=%E5%AE%AE%E3%81%AE%E5%9D%82%E9%A7%85","RARASAND":"https://www.google.com/maps/search/?api=1&query=RARASAND+%E8%B1%AA%E5%BE%B3%E5%AF%BA+%E6%9D%B1%E4%BA%AC","IRON COFFEE":"https://www.google.com/maps/search/?api=1&query=IRON+COFFEE+%E8%B1%AA%E5%BE%B3%E5%AF%BA+%E6%9D%B1%E4%BA%AC","梅丘寿司の美登利 総本店":"https://www.google.com/maps/search/?api=1&query=%E6%A2%85%E4%B8%98%E5%AF%BF%E5%8F%B8%E3%81%AE%E7%BE%8E%E7%99%BB%E5%88%A9+%E7%B7%8F%E6%9C%AC%E5%BA%97","梅丘站":"https://www.google.com/maps/search/?api=1&query=%E6%A2%85%E3%83%B6%E4%B8%98%E9%A7%85","新宿站":"https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%AE%BF%E9%A7%85","一蘭 新宿歌舞伎町店":"https://www.google.com/maps/search/?api=1&query=%E4%B8%80%E8%98%AD+%E6%96%B0%E5%AE%BF%E6%AD%8C%E8%88%9E%E4%BC%8E%E7%94%BA%E5%BA%97+%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%96%B0%E5%AE%BF%E5%8D%80%E6%AD%8C%E8%88%9E%E4%BC%8E%E7%94%BA1-17-10","東京民宿":"https://maps.app.goo.gl/QZX3Ty983HxajN197","天王寺":"https://www.google.com/maps/search/?api=1&query=%E5%A4%A9%E7%8E%8B%E5%AF%BA%20%E8%B0%B7%E4%B8%AD%20%E6%9D%B1%E4%BA%AC","日暮里站":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E6%9A%AE%E9%87%8C%E9%A7%85","谷中靈園":"https://www.google.com/maps/search/?api=1&query=%E8%B0%B7%E4%B8%AD%E9%9C%8A%E5%9C%92","根津神社":"https://www.google.com/maps/search/?api=1&query=%E6%A0%B9%E6%B4%A5%E7%A5%9E%E7%A4%BE%20%E6%9D%B1%E4%BA%AC","蛇道":"https://www.google.com/maps/search/?api=1&query=%E3%81%B8%E3%81%B3%E9%81%93%20%E5%8D%83%E9%A7%84%E6%9C%A8","千駄木":"https://www.google.com/maps/search/?api=1&query=%E5%8D%83%E9%A7%84%E6%9C%A8%E9%A7%85","谷中銀座商店街":"https://www.google.com/maps/search/?api=1&query=%E8%B0%B7%E4%B8%AD%E9%8A%80%E5%BA%A7%E5%95%86%E5%BA%97%E8%A1%97","夕やけだんだん":"https://www.google.com/maps/search/?api=1&query=%E5%A4%95%E3%82%84%E3%81%91%E3%81%A0%E3%82%93%E3%81%A0%E3%82%93%20%E8%B0%B7%E4%B8%AD","押上站":"https://www.google.com/maps/search/?api=1&query=%E6%8A%BC%E4%B8%8A%E9%A7%85","飛木稻荷神社":"https://www.google.com/maps/search/?api=1&query=%E9%A3%9B%E6%9C%A8%E7%A8%B2%E8%8D%B7%E7%A5%9E%E7%A4%BE%20%E5%A2%A8%E7%94%B0%E5%8C%BA%E6%8A%BC%E4%B8%8A","ハト屋パン店":"https://www.google.com/maps/search/?api=1&query=%E3%83%8F%E3%83%88%E5%B1%8B%E3%83%91%E3%83%B3%E5%BA%97%20%E4%BA%AC%E5%B3%B6","キラキラ橘商店街":"https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%A9%E3%82%AD%E3%83%A9%E6%A9%98%E5%95%86%E5%BA%97%E8%A1%97%20%E5%A2%A8%E7%94%B0%E5%8C%BA%E4%BA%AC%E5%B3%B6","MUUMUU COFFEE":"https://www.google.com/maps/search/?api=1&query=MUUMUU%20COFFEE%20%E4%BA%AC%E5%B3%B6","吉備子屋":"https://www.google.com/maps/search/?api=1&query=%E5%90%89%E5%82%99%E5%AD%90%E5%B1%8B%20%E5%90%91%E5%B3%B6","志満ん草餅":"https://www.google.com/maps/search/?api=1&query=%E5%BF%97%E6%BA%80%E3%82%93%E8%8D%89%E9%A4%85%20%E5%A2%A8%E7%94%B0%E5%8C%BA%E6%9D%B1%E5%90%91%E5%B3%B6","炭火焼肉おくさこ":"https://maps.app.goo.gl/rWTxzYh2HwmYyaoX8","外苑前站":"https://www.google.com/maps/search/?api=1&query=%E5%A4%96%E8%8B%91%E5%89%8D%E9%A7%85","表參道站":"https://www.google.com/maps/search/?api=1&query=%E8%A1%A8%E5%8F%82%E9%81%93%E9%A7%85","Sweet Check 蛋包飯":"https://maps.app.goo.gl/cq6P7DPSL1NEdmQT8","BASO 蕎麥麵":"https://maps.app.goo.gl/XfhefUXyvnTHNSra8","うどん 麺散":"https://maps.app.goo.gl/Nf1bBBnExek1mAus5","FREAK'S STORE Shibuya":"https://maps.app.goo.gl/zfRiMG347oqCoXQQ6","極味屋 澀谷 PARCO 店":"https://maps.app.goo.gl/PW2hqEnuummDrjFH8","MEGA 唐吉訶德 澀谷本店":"https://www.google.com/maps/search/?api=1&query=MEGA%E3%83%89%E3%83%B3%E3%83%BB%E3%82%AD%E3%83%9B%E3%83%BC%E3%83%86%E6%B8%8B%E8%B0%B7%E6%9C%AC%E5%BA%97","Mūya":"https://www.google.com/maps/search/?api=1&query=%E3%82%80%E3%81%86%E3%82%84%20%E6%9D%B1%E4%BA%AC%E3%83%9F%E3%82%BA%E3%83%9E%E3%83%81","隅田川步道":"https://www.google.com/maps/search/?api=1&query=%E9%9A%85%E7%94%B0%E5%B7%9D%E3%83%86%E3%83%A9%E3%82%B9%20%E5%90%BE%E5%A6%BB%E6%A9%8B","花月堂菠蘿麵包":"https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E8%8A%B1%E6%9C%88%E5%A0%82+%E6%9C%AC%E5%BA%97","壽壽喜園抹茶冰淇淋":"https://www.google.com/maps/search/?api=1&query=%E5%A3%BD%E3%80%85%E5%96%9C%E5%9C%92+%E6%B5%85%E8%8D%89%E6%9C%AC%E5%BA%97","龜十銅鑼燒":"https://www.google.com/maps/search/?api=1&query=%E4%BA%80%E5%8D%81+%E6%B5%85%E8%8D%89","牛たんの檸檬 淺草店":"https://maps.app.goo.gl/K4QdwtcbFczYAsTPA","東武淺草站":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%B5%85%E8%8D%89%E9%A7%85","東京晴空塔站":"https://www.google.com/maps/search/?api=1&query=%E3%81%A8%E3%81%86%E3%81%8D%E3%82%87%E3%81%86%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC%E9%A7%85","日光さかえや 揚げゆばまんじゅう本舗":"https://maps.app.goo.gl/BP5Dz4o8puYm7j7TA","日光東照宮":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E6%9D%B1%E7%85%A7%E5%AE%AE","鉢石町・日光街道":"https://www.google.com/maps/search/?api=1&query=%E9%89%A2%E7%9F%B3%E7%94%BA%20%E6%97%A5%E5%85%89","日光 Airbnb":"https://maps.app.goo.gl/xPXoTRvUER7Yosbm6","東武日光站巴士站":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85%20%E3%83%90%E3%82%B9%E4%B9%97%E3%82%8A%E5%A0%B4","東武日光站":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E6%AD%A6%E6%97%A5%E5%85%89%E9%A7%85","中禪寺溫泉":"https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B8%A9%E6%B3%89%20%E3%83%90%E3%82%B9%E5%81%9C%20%E6%97%A5%E5%85%89","站前・日光街道":"https://www.google.com/maps/search/?api=1&query=%E9%89%A2%E7%9F%B3%E7%94%BA%20%E6%97%A5%E5%85%89","憾滿之淵（選逛）":"https://www.google.com/maps/search/?api=1&query=%E6%86%BE%E6%BA%80%E3%83%B6%E6%B7%B5","成田里士滿飯店":"https://maps.app.goo.gl/FTSRu1WMKEDXw1dQ8","川豐本店":"https://www.google.com/maps/search/?api=1&query=%E5%B7%9D%E8%B1%8A+%E6%9C%AC%E5%BA%97+%E6%88%90%E7%94%B0","成田江戶人壽司":"https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E6%B1%9F%E6%88%B8%E3%81%A3%E5%AD%90%E5%AF%BF%E5%8F%B8","淺草橋銀杏岡八幡神社":"https://www.google.com/maps/search/?api=1&query=%E9%8A%80%E6%9D%8F%E5%B2%A1%E5%85%AB%E5%B9%A1%E7%A5%9E%E7%A4%BE%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-29-11","銀杏岡八幡神社":"https://www.google.com/maps/search/?api=1&query=%E9%8A%80%E6%9D%8F%E5%B2%A1%E5%85%AB%E5%B9%A1%E7%A5%9E%E7%A4%BE%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-29-11","シモジマ淺草橋本店":"https://www.google.com/maps/search/?api=1&query=%E3%82%B7%E3%83%A2%E3%82%B8%E3%83%9E%20%E6%B5%85%E8%8D%89%E6%A9%8B%E6%9C%AC%E5%BA%97%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-30-10","シモジマ":"https://www.google.com/maps/search/?api=1&query=%E3%82%B7%E3%83%A2%E3%82%B8%E3%83%9E%20%E6%B5%85%E8%8D%89%E6%A9%8B%E6%9C%AC%E5%BA%97%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%89%E6%A9%8B1-30-10","日比谷公園":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E6%AF%94%E8%B0%B7%E5%85%AC%E5%9C%92%20%E6%9D%B1%E4%BA%AC","丸之內仲通り":"https://www.google.com/maps/search/?api=1&query=%E4%B8%B8%E3%81%AE%E5%86%85%E4%BB%B2%E9%80%9A%E3%82%8A%20%E6%9D%B1%E4%BA%AC","丸之內仲通":"https://www.google.com/maps/search/?api=1&query=%E4%B8%B8%E3%81%AE%E5%86%85%E4%BB%B2%E9%80%9A%E3%82%8A%20%E6%9D%B1%E4%BA%AC","東京車站丸之內廣場":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E9%A7%85%20%E4%B8%B8%E3%81%AE%E5%86%85%E9%A7%85%E5%89%8D%E5%BA%83%E5%A0%B4","東京車站丸之內":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E9%A7%85%20%E4%B8%B8%E3%81%AE%E5%86%85%E9%A7%85%E5%89%8D%E5%BA%83%E5%A0%B4","豪德寺":"https://www.google.com/maps/search/?api=1&query=%E8%B1%AA%E5%BE%B3%E5%AF%BA%20%E4%B8%96%E7%94%B0%E8%B0%B7%E5%8C%BA%E8%B1%AA%E5%BE%B3%E5%AF%BA2-24-7","新宿 Bic Camera":"https://www.google.com/maps/search/?api=1&query=%E3%83%93%E3%83%83%E3%82%AF%E3%82%AB%E3%83%A1%E3%83%A9%20%E6%96%B0%E5%AE%BF%E6%9D%B1%E5%8F%A3%E5%BA%97","Bic Camera 新宿東口店":"https://www.google.com/maps/search/?api=1&query=%E3%83%93%E3%83%83%E3%82%AF%E3%82%AB%E3%83%A1%E3%83%A9%20%E6%96%B0%E5%AE%BF%E6%9D%B1%E5%8F%A3%E5%BA%97","Alpen Tokyo 旗艦店":"https://www.google.com/maps/search/?api=1&query=Alpen%20TOKYO%20%E6%96%B0%E5%AE%BF","Alpen TOKYO":"https://www.google.com/maps/search/?api=1&query=Alpen%20TOKYO%20%E6%96%B0%E5%AE%BF","Alpen Tokyo":"https://www.google.com/maps/search/?api=1&query=Alpen%20TOKYO%20%E6%96%B0%E5%AE%BF","明治神宮外苑銀杏大道":"https://www.google.com/maps/search/?api=1&query=%E6%98%8E%E6%B2%BB%E7%A5%9E%E5%AE%AE%E5%A4%96%E8%8B%91%20%E3%81%84%E3%81%A1%E3%82%87%E3%81%86%E4%B8%A6%E6%9C%A8","神宮外苑":"https://www.google.com/maps/search/?api=1&query=%E6%98%8E%E6%B2%BB%E7%A5%9E%E5%AE%AE%E5%A4%96%E8%8B%91%20%E6%9D%B1%E4%BA%AC","KIDDY LAND 原宿店":"https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%87%E3%82%A4%E3%83%A9%E3%83%B3%E3%83%89%20%E5%8E%9F%E5%AE%BF%E5%BA%97%20%E6%B8%8B%E8%B0%B7%E5%8C%BA%E7%A5%9E%E5%AE%AE%E5%89%8D6-1-9","KIDDY LAND":"https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%87%E3%82%A4%E3%83%A9%E3%83%B3%E3%83%89%20%E5%8E%9F%E5%AE%BF%E5%BA%97%20%E6%B8%8B%E8%B0%B7%E5%8C%BA%E7%A5%9E%E5%AE%AE%E5%89%8D6-1-9","NUMBER SUGAR 表參道店":"https://www.google.com/maps/search/?api=1&query=NUMBER%20SUGAR%20%E8%A1%A8%E5%8F%82%E9%81%93%E6%9C%AC%E5%BA%97","NUMBER SUGAR":"https://www.google.com/maps/search/?api=1&query=NUMBER%20SUGAR%20%E8%A1%A8%E5%8F%82%E9%81%93%E6%9C%AC%E5%BA%97","宮下公園":"https://www.google.com/maps/search/?api=1&query=MIYASHITA%20PARK%20%E6%B8%8B%E8%B0%B7","貓街":"https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%A3%E3%83%83%E3%83%88%E3%82%B9%E3%83%88%E3%83%AA%E3%83%BC%E3%83%88%20%E6%B8%8B%E8%B0%B7","澀谷 PARCO":"https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7PARCO%20%E5%AE%87%E7%94%B0%E5%B7%9D%E7%94%BA15-1","澀谷站八公口外":"https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7%E9%A7%85%20%E3%83%8F%E3%83%81%E5%85%AC%E5%8F%A3","澀谷站八公口":"https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7%E9%A7%85%20%E3%83%8F%E3%83%81%E5%85%AC%E5%8F%A3","真さか":"https://www.google.com/maps/search/?api=1&query=%E3%83%B4%E3%82%A3%E3%83%BC%E3%82%AC%E3%83%B3%E5%B1%85%E9%85%92%E5%B1%8B%20%E7%9C%9F%E3%81%95%E3%81%8B%20%E6%B8%8B%E8%B0%B7PARCO%20B1","今戶神社":"https://www.google.com/maps/search/?api=1&query=%E4%BB%8A%E6%88%B8%E7%A5%9E%E7%A4%BE%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E4%BB%8A%E6%88%B81-5-22","待乳山聖天":"https://www.google.com/maps/search/?api=1&query=%E5%BE%85%E4%B9%B3%E5%B1%B1%E8%81%96%E5%A4%A9%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%897-4-1","淺草寺参道":"https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E5%AF%BA%20%E4%BB%B2%E8%A6%8B%E4%B8%96%E9%80%9A%E3%82%8A","淺草寺":"https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E5%AF%BA%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E6%B5%85%E8%8D%892-3-1","雷門":"https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E5%AF%BA%20%E9%9B%B7%E9%96%80","PATISSERIE TEN&（日比谷 OKUROJI）":"https://www.google.com/maps/search/?api=1&query=PATISSERIE%20TEN%26%20%E6%97%A5%E6%AF%94%E8%B0%B7OKUROJI","PATISSERIE TEN&":"https://www.google.com/maps/search/?api=1&query=PATISSERIE%20TEN%26%20%E6%97%A5%E6%AF%94%E8%B0%B7OKUROJI","日比谷 PATISSERIE TEN&":"https://www.google.com/maps/search/?api=1&query=PATISSERIE%20TEN%26%20%E6%97%A5%E6%AF%94%E8%B0%B7OKUROJI","HARBS 六本木 Hills 店":"https://www.google.com/maps/search/?api=1&query=HARBS%20%E5%85%AD%E6%9C%AC%E6%9C%A8%E3%83%92%E3%83%AB%E3%82%BA%E5%BA%97","六本木 HARBS":"https://www.google.com/maps/search/?api=1&query=HARBS%20%E5%85%AD%E6%9C%AC%E6%9C%A8%E3%83%92%E3%83%AB%E3%82%BA%E5%BA%97","大屋頂廣場":"https://www.google.com/maps/search/?api=1&query=%E5%85%AD%E6%9C%AC%E6%9C%A8%E3%83%92%E3%83%AB%E3%82%BA%20%E5%A4%A7%E5%B1%8B%E6%A0%B9%E3%83%97%E3%83%A9%E3%82%B6","六本木新城":"https://www.google.com/maps/search/?api=1&query=%E5%85%AD%E6%9C%AC%E6%9C%A8%E3%83%92%E3%83%AB%E3%82%BA%20%E6%9D%B1%E4%BA%AC","神橋":"https://www.google.com/maps/search/?api=1&query=%E7%A5%9E%E6%A9%8B%20%E6%97%A5%E5%85%89%E5%B8%82%E4%B8%8A%E9%89%A2%E7%9F%B3%E7%94%BA","東照宮":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E6%9D%B1%E7%85%A7%E5%AE%AE%20%E6%97%A5%E5%85%89%E5%B8%82%E5%B1%B1%E5%86%852301","東京晴空塔":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC","晴空塔":"https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%84%E3%83%AA%E3%83%BC","華嚴瀑布":"https://www.google.com/maps/search/?api=1&query=%E8%8F%AF%E5%8E%B3%E3%81%AE%E6%BB%9D%20%E6%97%A5%E5%85%89","中禪寺湖":"https://www.google.com/maps/search/?api=1&query=%E4%B8%AD%E7%A6%85%E5%AF%BA%E6%B9%96%20%E6%97%A5%E5%85%89","憾滿之淵":"https://www.google.com/maps/search/?api=1&query=%E6%86%BE%E6%BA%80%E3%83%B6%E6%B7%B5%20%E6%97%A5%E5%85%89","田母澤御用邸":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E7%94%B0%E6%AF%8D%E6%B2%A2%E5%BE%A1%E7%94%A8%E9%82%B8%E8%A8%98%E5%BF%B5%E5%85%AC%E5%9C%92","日光街道":"https://www.google.com/maps/search/?api=1&query=%E6%97%A5%E5%85%89%E8%A1%97%E9%81%93%20%E9%89%A2%E7%9F%B3%E7%94%BA%20%E6%97%A5%E5%85%89%E5%B8%82","成田山表參道":"https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E8%A1%A8%E5%8F%82%E9%81%93","新勝寺大本堂":"https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E6%96%B0%E5%8B%9D%E5%AF%BA%20%E5%A4%A7%E6%9C%AC%E5%A0%82","成田山公園":"https://www.google.com/maps/search/?api=1&query=%E6%88%90%E7%94%B0%E5%B1%B1%E5%85%AC%E5%9C%92","なごみの米屋":"https://www.google.com/maps/search/?api=1&query=%E3%81%AA%E3%81%94%E3%81%BF%E3%81%AE%E7%B1%B3%E5%B1%8B%20%E7%B7%8F%E6%9C%AC%E5%BA%97%20%E6%88%90%E7%94%B0%E5%B8%82%E4%B8%8A%E7%94%BA500","京成成田站":"https://www.google.com/maps/search/?api=1&query=%E4%BA%AC%E6%88%90%E6%88%90%E7%94%B0%E9%A7%85","AEON MALL 成田":"https://www.google.com/maps/search/?api=1&query=%E3%82%A4%E3%82%AA%E3%83%B3%E3%83%A2%E3%83%BC%E3%83%AB%E6%88%90%E7%94%B0","青山一丁目站":"https://www.google.com/maps/search/?api=1&query=%E9%9D%92%E5%B1%B1%E4%B8%80%E4%B8%81%E7%9B%AE%E9%A7%85","原宿站":"https://www.google.com/maps/search/?api=1&query=%E5%8E%9F%E5%AE%BF%E9%A7%85","澀谷站":"https://www.google.com/maps/search/?api=1&query=%E6%B8%8B%E8%B0%B7%E9%A7%85","麺 みつヰ":"https://www.google.com/maps/search/?api=1&query=%E9%BA%BA%20%E3%81%BF%E3%81%A4%E3%83%B0%20%E5%8F%B0%E6%9D%B1%E5%8C%BA%E5%AF%BF2-9-15","天麩羅秋光":"https://www.google.com/maps/search/?api=1&query=%E5%A4%A9%E9%BA%A9%E7%BE%85%20%E7%A7%8B%E5%85%89%20%E6%B5%85%E8%8D%89%E6%9C%AC%E5%BA%97"};
  const revisedDailyCopy = {
  "1": [
    [
      "晚午餐｜野口鮮魚店",
      "民宿放好行李後前往，約 16:00 用餐。A 組 3 人可分桌；排隊太久或售罄就改 CHICO。"
    ],
    [
      "點心｜塩パン屋 パンメゾン",
      "飯後順路買鹽可頌，吃飽或時間不夠就跳過。"
    ],
    [
      "散步｜淺草橋",
      "銀杏岡八幡神社、シモジマ淺草橋本店。這段可看時間決定要不要去。"
    ],
    [
      "夜景｜日比谷・丸之內",
      "日比谷公園 → 丸之內仲通り → 東京車站丸之內廣場，之後回淺草吃晚餐。"
    ],
    [
      "晚餐｜鳥貴族 淺草店",
      "21:30 已訂 A＋B 組 5 人。A 組先報到，B 組放好行李後加入；來不及就先聯絡餐廳。"
    ]
  ],
  "2": [
    [
      "早餐｜三軒茶屋 nukumuku",
      "大家一起買麵包外帶，再搭世田谷線去豪德寺。"
    ],
    [
      "上午｜豪德寺",
      "參拜、拍招福貓，約停留 30 分鐘。奉納的招福貓請勿移動。"
    ],
    [
      "點心｜RARASAND／IRON COFFEE",
      "想吃點心或喝咖啡可以擇一，之後一起往梅丘。"
    ],
    [
      "午餐｜梅丘寿司の美登利 総本店",
      "5 人一起到店取號，依現場叫號入座。10:00 開始發號、11:00 開店；等太久就當天另找想吃的店。"
    ],
    [
      "下午購物｜新宿",
      "梅丘搭小田急線到新宿，逛 Bic Camera 新宿東口店、Alpen TOKYO。"
    ],
    [
      "晚餐｜一蘭 新宿歌舞伎町店",
      "逛完 Alpen TOKYO 再去。24 小時營業，以單人吧台為主，5 人可分批入座。"
    ]
  ],
  "3": [
    [
      "上午散步・下午晴空塔",
      "谷根千：根津神社 → 蛇道 → 谷中銀座；或京島・向島麵包咖啡散步。約 12:15 出發，13:00 起逛晴空塔，傍晚到炭火焼肉おくさこ會合。"
    ],
    [
      "晚餐｜炭火焼肉おくさこ",
      "預計 17:30，全團 7 人；C 組放好行李後加入。店家目前週一、假日 17:00–23:00（餐點最後點餐 22:30）。尚未訂位，7 人同桌需確認；不吃牛的 2 位可選豬、雞、海鮮，湯汁先問。餐後晴空塔可看體力略過。"
    ]
  ],
  "4": [
    [
      "出發｜本所吾妻橋 → 青山一丁目",
      "搭車路線、站號與出口見下方交通說明，出站後步行到銀杏大道。"
    ],
    [
      "上午｜明治神宮外苑銀杏大道",
      "散步、拍銀杏，接著往表參道與原宿。"
    ],
    [
      "逛街｜表參道・原宿",
      "KIDDY LAND、NUMBER SUGAR 等各自選逛，午餐後往澀谷。"
    ],
    null,
    [
      "步行往澀谷",
      "Sweet Check 組先吃再逛原宿；BASO／麺散組先逛再吃。午餐後往 FREAK’S STORE，途中可逛貓街與宮下公園。"
    ],
    [
      "FREAK’S STORE Shibuya",
      "神南 1-13-1，週二 12:00–20:00。各組在這裡會合，再往 PARCO。"
    ],
    [
      "購物｜澀谷 PARCO",
      "從 FREAK’S STORE 步行前往。一般商店 11:00–21:00，晚餐在 B1。"
    ],
    null,
    [
      "晚餐後｜MEGA 唐吉訶德",
      "還想逛就去，累了可以直接回民宿。"
    ],
    [
      "回程｜澀谷站八公口",
      "約好時間在八公口外集合，一起搭車回本所吾妻橋。"
    ]
  ],
  "5": [
    [
      "早餐｜Mūya",
      "吐司與咖啡，08:00–18:00。吃完往淺草散步。"
    ],
    [
      "淺草散步",
      "今戶神社 → 待乳山聖天 → 淺草寺参道。牛舌午餐訂在 12:00。"
    ],
    null,
    [
      "午餐後小吃｜花月堂・壽壽喜園・龜十",
      "花月堂本店、壽壽喜園 11:00 開門，午餐後再逛。菠蘿麵包、抹茶冰淇淋、銅鑼燒，看想吃哪家就買哪家。"
    ],
    [
      "午餐後｜淺草自由活動",
      "吃完在附近逛街，約 15:30 回民宿集合。"
    ],
    [
      "回民宿休息",
      "放購物袋、休息，約 16:30 出發去日比谷。"
    ],
    [
      "外帶｜PATISSERIE TEN&",
      "日比谷 OKUROJI，週三傍晚外帶 17:30–20:00，只收無現金支付。買完往六本木。"
    ],
    [
      "甜點｜HARBS 六本木 Hills 店",
      "有座位就內用，等太久可外帶。蛋糕與飲品最後點餐 19:30，20:00 打烊；餐點最後點餐 17:00。"
    ],
    [
      "六本木新城聖誕市集",
      "HARBS 走到大屋頂廣場。市集 11/21–12/25、11:00–21:00，晚餐當天決定。"
    ]
  ],
  "6": [
    [
      "東京 → 日光｜SPACIA X",
      "已訂 SPACIA X 003：11/26 淺草 09:00 → 東武日光 10:50（日本時間）。"
    ],
    [
      "7 人豪華座位",
      "已訂 Premium seat 豪華座位；車廂與座位請看手機票券。"
    ],
    [
      "抵達後｜寄物、自由午餐",
      "先安頓行李，午餐當天看想吃什麼，站前或日光街道都可以。"
    ],
    [
      "下午｜神橋・日光街道",
      "搭巴士到神橋，再沿街往車站方向逛。順路可選日光ぷりん亭的原味／豆乳布丁（10:00–17:00），回到站前再看要不要買さかえや炸湯波饅頭（09:30–17:00）；兩家皆不定休。不排吃點心的時間，排隊長就略過，さかえや已吃過就不再買。約 14:30–15:00 取行李，15:00–15:30 入住。"
    ]
  ],
  "7": [
    [
      "上午｜東照宮",
      "約 09:15 出門，搭市區巴士前往，10:00–12:00 慢慢參觀。奧宮階梯依體力決定，中途想休息就停一下。"
    ],
    [
      "下午｜自由午餐、順路咖啡",
      "午餐當天決定。往神橋回程優先本宮カフェ，喝咖啡或吃冰淇淋紅豆寒天（10:00–17:00，週四休）。若參觀完已累，就近選新寶物館 1 樓的上島珈琲（11 月 09:00–16:00）。兩家擇一，不排固定時間，客滿就略過；已在上島休息就不再去本宮，之後搭車回民宿。"
    ],
    [
      "晚上｜回民宿",
      "晚餐當天決定。整理行李，隔天 07:45 集合、08:00 包車出發。"
    ]
  ],
  "8": [
    [
      "日光 → 成田｜包車",
      "07:45 集合，08:00 出發。7 人搭 Toyota Hiace，車資已付；到 Richmond Hotel Narita 後先寄放行李。"
    ],
    [
      "午餐｜成田山表參道",
      "川豐本店取號吃鰻魚飯；等太久或想吃別的，就在表參道附近選店。"
    ],
    [
      "下午｜新勝寺・紅葉祭・米屋",
      "新勝寺大本堂 → 成田山公園紅葉祭 → なごみの米屋。公園賞楓抓約 45–60 分鐘，約 16:40 往京成成田站。若提早抵達，可看 13:30 演奏；茶會至約 15:00、額滿提早結束，有名額再參加。"
    ],
    [
      "傍晚｜AEON MALL 成田",
      "京成成田站 6 號搭直行巴士，去程 17:15／17:47，下一班 18:30。單程 ¥220，可刷 IC 卡，前門上車付費。回程 20:28 星巴克前／20:29 Mall East 是同一班車相鄰兩站；較晚可搭 21:05／21:06。"
    ]
  ],
  "9": [
    [
      "飯店 → 成田 T2",
      "預計 08:20 接駁、08:40 抵達，前晚登記座位。虎航約 10:30 開櫃，以當天公告為準；含退稅商品的行李完成海關確認後再托運。"
    ],
    [
      "機場伴手禮",
      "安檢前逛本館 4F，安檢後到 3F Fa-So-La。PRESS BUTTER SAND、PISTA & TOKYO、桂新堂、S’more 可依清單購買。"
    ],
    [
      "回台灣",
      "A、C 組 IT281：13:00 成田起飛；B 組 CI101：14:35 起飛、17:45 抵達桃園，均為當地時間。登機時間與登機門看登機證。"
    ]
  ]
};
  function applyRevisedDailyCopy() {
    if(state.view!=='days' || (state.group==='B' && state.day===1) || (state.group==='C' && state.day===3))return;
    const copies=revisedDailyCopy[state.day];
    if(!copies)return;
    const stops=[...main.querySelectorAll('.stop-content')];
    // Copy follows the same ordered stop list used by the independent preview.
    if(stops.length!==copies.length)return;
    stops.forEach((stop,i)=>{
      const copy=copies[i];if(!copy)return; // Keep split-meal cards in their existing layout.
      const keep=[...stop.children].filter(e=>e.matches('.schedule-toggle,.schedule-time,.schedule-detail-body'));
      const summary=stop.cloneNode(true);
      summary.querySelectorAll('.schedule-toggle,.schedule-time,.schedule-detail-body').forEach(e=>e.remove());
      const links=[],seen=new Set();
      summary.querySelectorAll('a[href]').forEach(a=>{
        const href=a.getAttribute('href');if(seen.has(href))return;seen.add(href);links.push(a.cloneNode(true));
      });
      for(const node of [...stop.childNodes])if(!keep.includes(node))node.remove();
      const content=document.createElement('div');
      const title=document.createElement('strong');title.textContent=copy[0];content.append(title);
      const description=document.createElement('p');description.textContent=copy[1];content.append(description);
      if(links.length){const row=document.createElement('p');links.forEach((a,j)=>{if(j)row.append(document.createTextNode('　'));row.append(a);});content.append(row);}
      const detail=stop.querySelector('.schedule-detail-body');detail?detail.before(content):stop.append(content);
      stop.dataset.revisedCopy='true';
    });
  }
  const dailyAccessNotes = {
    1:['民宿放妥行李後前往野口鮮魚店，位置可點地圖查看。','由野口鮮魚店順路前往塩パン屋 パンメゾン；不另排繞路行程。','由本所吾妻橋往淺草橋，依序走銀杏岡八幡神社、シモジマ；再往日比谷。','抵達日比谷公園後，沿丸之內仲通り步行至東京車站丸之內廣場。','看完夜景後回淺草；A 組先到鳥貴族報到，B 組從民宿加入。'],
    2:['大家一起到三軒茶屋 nukumuku 買早餐。','早餐後到豪德寺，參拜後一起往梅丘。','兩家在豪德寺站一帶，可在參拜後順路擇一，再往梅丘。','5 人一起到梅丘美登利總本店取號。','用餐後從梅丘搭車到新宿；依序走 Bic Camera 新宿東口店、Alpen TOKYO。','從 Alpen TOKYO 前往一蘭新宿歌舞伎町店，用餐後返回民宿。'],
    3:['上午先選谷根千或京島・向島其中一路；兩路之後都前往晴空塔，傍晚再到炭火焼肉おくさこ。','A、B 組從晴空塔前往；C 組抵達東京民宿、放妥行李後到餐廳會合。'],
    4:['本所吾妻橋 → 青山一丁目，出站後步行到明治神宮外苑銀杏大道。','沿銀杏大道散步拍照，接著朝表參道、原宿前進。','銀杏大道 → 表參道 → 原宿；依午餐店別安排購物先後。','原宿、表參道午餐可參考這三家，當天再決定。','午餐後朝澀谷前進，沿貓街、宮下公園順走至 FREAK’S STORE，不回原宿集合。','在 FREAK’S STORE Shibuya 會合，之後一起往 PARCO。','FREAK’S STORE → 澀谷 PARCO；先逛選定樓層，再到 B1。','晚餐在 PARCO B1 分組；吃牛肉 5 位與不吃牛肉 2 位各自用餐後會合。','從 PARCO 前往 MEGA 唐吉訶德；若候位耽誤，就直接往澀谷站。','到澀谷站八公口站外點名，確認人齊後一起進站回民宿。'],
    5:['早餐後沿隅田川一帶往淺草散步。','今戶神社 → 待乳山聖天 → 淺草寺参道，接近午餐時間就縮短停留。','吃牛 5 人到牛舌店，另 2 人自由用餐；餐後在淺草會合。','午餐後在淺草順路買點心。','兩組在淺草會合後附近自由逛街，再回東京民宿；不去阿美橫丁。','淺草 → 東京民宿，先放物品與休息，再出發往日比谷。','東京民宿 → 日比谷 OKUROJI，TEN& 外帶後直接往六本木。','日比谷 → 六本木 Hills，先到 HARBS 詢問座位。','HARBS → 六本木新城大屋頂廣場；市集與周邊點燈採步行串聯。'],
    6:['11/26 從東武淺草站上車，建議 08:30 到站；SPACIA X 003 於 09:00 出發、10:50 抵達東武日光。','核對車票上的班次、上車站、車廂與座位，依票入座。','先安頓行李，午餐當天決定；民宿不能提前寄物時，先找站內 Yamato，詳細地點與取件時間見下方「日光行李寄放」。','寄好行李後搭巴士到神橋，再沿日光街道往車站方向散步；取行李後回民宿，15:00 起可入住。'],
    7:['民宿 → 東武日光站搭市區巴士 → 東照宮；到站後依表参道或西参道入口的步行路線前往。','本宮カフェ在往神橋的回程，離開後從神橋站搭往東武日光站的巴士。若選上島珈琲，就從寺社區搭車回站，不再去本宮；兩家擇一、客滿就略過。','晚餐當天決定，回民宿整理行李，準備隔日包車接送。'],
    8:['日光民宿上車，搭已訂包車到 Richmond Hotel Narita；先寄放行李。11/28 表參道分段交通管制，從飯店步行前往，不安排包車開進表參道。','由飯店往成田山表參道，先確認川豐抽號與候位情況。','沿表參道到新勝寺大本堂，再進成田山公園逛紅葉祭；返回表參道米屋後，約 16:40 往京成成田站。','京成成田站 6 號乘付費直行巴士到 AEON MALL；回程先確認星巴克前或 Mall East 上車站。'],
    9:['前晚先登記飯店接駁；早上搭車到成田 T2，依各組航空公司找報到櫃檯。','安檢前與後分區採買；先完成需要在托運前處理的購物事項。','通過安檢後，依當天航班資訊前往正確登機門。']
  };
  // Checked against operator station maps, 2026-10-21. Car numbers are directional.
  const transitWayfinding = {
    home:{title:'本所吾妻橋：回民宿與出發',lines:'A 都營淺草線・玫瑰紅色',route:'本所吾妻橋（本所吾妻橋）A19。往市區看「西馬込・羽田空港方面」；往押上看「押上・京成線方面」。',exit:'往東駒形民宿走南側出口；A2 為樓梯出口選項。大行李優先看 A0 地上電梯；另一側月台可看 A5 電梯，出站後依地圖步行。',car:'官方圖示第 4 車廂附近接 A0～A2／跨月台通道；押上方向第 8 車廂附近接 A5。直通車車廂編號可能不同，對照月台圖再上車。',url:'https://www.kotsu.metro.tokyo.jp/subway/stations/honjo-azumabashi.html'},
    sangen:{title:'前往三軒茶屋',lines:'A 淺草線・玫瑰紅 → Z 半藏門線・紫 → DT 田園都市線・綠',route:'A19 本所吾妻橋 → A20 押上；站內依 Z 指標轉 Z14 押上，搭往澀谷、直通田園都市線的列車到 DT03 三軒茶屋。若列車只到澀谷，需在 Z01／DT01 澀谷改搭往中央林間方向。',exit:'三軒茶屋出站依太子堂方向與早餐店地圖走；北口 A／B 為太子堂側出口選項，不要往南口繞。',car:'押上換半藏門線可先靠列車中段，依轉乘指標走；直通列車長度不同，不指定未確認的車廂號。',url:'https://www.tokyu.co.jp/area/sangen-jaya/station/'},
    gotokuji:{title:'三軒茶屋 → 豪德寺',lines:'SG 東急世田谷線・黃色',route:'SG01 三軒茶屋 → SG07 宮之坂（宮の坂），搭往下高井戶方向；下車後步行到豪德寺。SG08 山下與小田急豪德寺站是另一處，勿把站名當成寺院入口。',exit:'宮之坂為地面月台，依豪德寺地圖步行，沒有地鐵式出口編號。',car:'世田谷線為短編成，不需為轉乘指定車廂；依現場上車門指示排隊。',url:'https://www.tokyu.co.jp/railway/sg/'},
    shinjuku:{title:'梅丘 → 新宿購物',lines:'OH 小田急小田原線・藍色',route:'OH09 梅丘（梅ヶ丘）搭各站停車往新宿 → OH01 新宿。梅丘不是急行停靠站；不必為了改搭快車多轉一次。',exit:'購物目的地在新宿東側。出小田急閘門後沿「東口／東西自由通路」指標走，再依 Bic Camera／Alpen 地圖前往。不要為穿越車站誤入 JR 付費區。',car:'車種與新宿到達月台不同；未確認通用的最佳車廂，依到站月台出口圖走。',url:'https://www.odakyu.jp/station/umegaoka/'},
    asakusabashi:{title:'本所吾妻橋 → 淺草橋',lines:'A 都營淺草線・玫瑰紅色',route:'A19 本所吾妻橋 → A16 淺草橋（浅草橋），往西馬込・羽田空港方向。確認列車停靠淺草橋。',exit:'銀杏岡八幡神社、シモジマ依各自地圖導航；淺草橋 A16 與淺草 A18 是不同站。',car:'出口最近車廂尚未核實，先看下方官方站內圖。',url:'https://www.kotsu.metro.tokyo.jp/subway/stations/asakusabashi.html'},
    ginzaHibiya:{title:'前往日比谷公園／丸之內',lines:'A 淺草線・玫瑰紅 → H 日比谷線・銀灰',route:'淺草橋 A16 往西馬込方向 → A11 東銀座；轉 H10 東銀座，搭往中目黑方向 → H08 日比谷。之後日比谷公園 → 丸之內採步行串聯。',exit:'日比谷站出口分布很廣，先按公園／目的地的地圖選出口；不要只見「日比谷」就任意出站。',car:'東銀座轉乘最近車廂未核實；跟 H 日比谷線指標，不把銀座線 G 當成同一條線。',url:'https://www.tokyometro.jp/station/hibiya/index.html'},
    gaien:{title:'本所吾妻橋 → 銀杏大道',lines:'A 淺草線・玫瑰紅 → G 銀座線・橘色',route:'易辨識走法：A19 本所吾妻橋搭西馬込方向一站到 A18 淺草；出閘依 G 指標轉 G19 淺草，搭往澀谷方向到 G04 青山一丁目。轉乘含步行，請以當天路線查詢估時。',exit:'青山一丁目走 1 號出口，往青山通、銀杏大道方向；出站後約 5～10 分鐘步行為規劃估計。',car:'青山一丁目最近出口車廂未確認，附官方站內圖；不要套用半藏門線或大江戶線的車廂位置。',url:'https://www.tokyometro.jp/station/aoyama-itchome/index.html'},
    shibuyaHome:{title:'澀谷 → 本所吾妻橋',lines:'Z 半藏門線・紫 → A 淺草線・玫瑰紅',route:'Z01 澀谷搭往押上方向 → Z14 押上；站內轉 A20 押上，搭西馬込・羽田空港方向 → A19 本所吾妻橋。',exit:'八公口是會合地標；會合後依地下鐵 Z／半藏門線指標進站，不要進 JR 閘門。到本所吾妻橋再依東駒形側出口回民宿。',car:'押上最近轉乘車廂未確認；選能全員一起上車的位置，再依站內 A 指標轉乘。',url:'https://www.tokyometro.jp/station/oshiage/index.html'},
    ten:{title:'民宿 → 日比谷 OKUROJI',lines:'A 都營淺草線・玫瑰紅色',route:'A19 本所吾妻橋搭往西馬込・羽田空港方向 → A10 新橋；出站後步行到日比谷 OKUROJI 的 TEN&。',exit:'先沿 JR 新橋站日比谷口方向到地面，再走向高架下 OKUROJI。日比谷口是 JR 出口名稱，不是都營地下鐵的出口編號。',car:'新橋出口最近車廂未核實，依站內圖和「日比谷口方面」指標走。',url:'https://www.jrtk.jp/hibiya-okuroji/access/'},
    roppongi:{title:'TEN& → 六本木 Hills／HARBS',lines:'H 日比谷線・銀灰色',route:'TEN& 外帶後步行至 H08 日比谷，搭「中目黒方面」→ H04 六本木（六本木）。',exit:'六本木走 1c 出口、六本木 Hills 連通方向，接著依 HARBS 店址前往；不是往 Tokyo Midtown 的出口。',car:'只適用往中目黑方向：第 5 車廂附近為往 Hills 的手扶梯，第 7 車廂附近為電梯／樓梯。日比谷線第 1～2 車廂偏向大江戶線／Midtown 端。',url:'https://www.tokyometro.jp/station/line_hibiya/position.html'},
    nikko:{title:'東京出發搭 SPACIA X',lines:'SPACIA X 003・09:00 → 10:50',route:'11/26 從東武淺草站 09:00 出發，10:50 抵達東武日光。建議 08:30 到站，預留行李與月台移動時間。',exit:'從淺草上車要找「東武」淺草站，不是都營 A18 或 Metro G19 的月台。',car:'已訂豪華座位（Premium seat），7 位成人；車廂與座位請看手機票券。',url:'https://www.tobu.co.jp/spaciax/'},
    narita:{title:'京成成田 → AEON MALL',lines:'此段是巴士，不是地鐵',route:'京成成田 KS40 只是集合定位站；到站外 6 號巴士站找 AEON MALL 直行巴士，不進鐵路閘門。',exit:'依行程指定的 6 號巴士站搭乘；飯店與成田山方向的步行路線分開看。',car:'巴士不分地鐵車廂；依乘車規則排隊，回程站點要和同行者先約好。',url:'https://new-www.keisei.co.jp/keisei/tetudou/accessj/keisei-narita.php'}
  };
  function appendTransitWayfinding(detail,i) {
    const byDay={1:{2:['asakusabashi'],3:['ginzaHibiya']},2:{0:['sangen'],1:['gotokuji'],4:['shinjuku']},4:{0:['gaien'],9:['shibuyaHome']},5:{5:['home'],6:['ten'],7:['roppongi']},6:{0:['nikko']},8:{3:['narita']}};
    const arrival=(state.group==='B'&&state.day===1)||(state.group==='C'&&state.day===3);
    const keys=arrival?(i===0?['home']:[]):(byDay[state.day]?.[i]||[]);
    if(i===0 && !arrival && state.day<=5)keys.unshift('home');
    if(!keys.length)return;
    const colors={A:'#e85298',G:'#f39700',H:'#9caeb7',Z:'#9b7cb6',DT:'#20a288',SG:'#e8b800',OH:'#2385c4',KS:'#2564a8'};
    const marked=text=>{const fragment=document.createDocumentFragment();let end=0;const regex=/\b(DT|SG|OH|KS|A|G|H|Z)(\d{2})\b/g;for(const m of text.matchAll(regex)){fragment.append(document.createTextNode(text.slice(end,m.index)));const badge=document.createElement('span');badge.className='rail-station-badge';badge.style.setProperty('--rail-color',colors[m[1]]);badge.textContent=m[1]+' '+m[2];fragment.append(badge);end=m.index+m[0].length;}fragment.append(document.createTextNode(text.slice(end)));return fragment;};
    const block=document.createElement('section');block.className='transit-wayfinding';
    for(const key of keys){const info=transitWayfinding[key],card=document.createElement('section'),h=document.createElement('h3');h.textContent=info.title;card.append(h);const facts=document.createElement('dl');facts.className='table-card';for(const [label,value]of [['路線／顏色',info.lines],['方向／站號',info.route],['出口',info.exit],['車廂／轉乘',info.car]]){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.append(marked(value));row.append(dt,dd);facts.append(row);}card.append(facts);const a=document.createElement('a');a.href=info.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='車站圖與出口指引 ↗';card.append(a);block.append(card);}
    detail.prepend(block);
  }
  function organizeDailyDetails() {
    if(state.view!=='days')return;
    const shared=!(state.group==='B'&&state.day===1)&&!(state.group==='C'&&state.day===3);
    main.querySelectorAll('.stop-content').forEach((stop,i)=>{
      const copy=shared?revisedDailyCopy[state.day]?.[i]:null;
      let detail=stop.querySelector('.schedule-detail-body');
      const time=stop.querySelector('.schedule-time');
      if(!time)return;
      const summary=stop.cloneNode(true);summary.querySelectorAll('.schedule-detail-body,.schedule-toggle,.schedule-time').forEach(e=>e.remove());
      const text=copy?.[1]||summary.textContent.trim();
      const access=shared?dailyAccessNotes[state.day]?.[i]:null;
      if(!detail){detail=document.createElement('div');detail.className='document schedule-detail-body';detail.id=`slot-detail-${state.day}-${i}`;detail.hidden=true;stop.append(detail);}
      // Preserve existing station-by-station and alternative-route instructions.
      const briefing=document.createElement('section');briefing.className='supplement-section';
      const heading=document.createElement('h3');heading.textContent='交通與店家資訊';briefing.append(heading);
      const facts=document.createElement('dl');facts.className='table-card';
      const sentences=text.match(/[^。！？；]+[。！？；]?/g)||[text];
      const isCaution=s=>/勿|不可|不能|不接受|尚未|待確認|候位|延誤|略過|確認|以.*為準|最晚|訂位|分桌/.test(s);
      const cautions=sentences.filter(isCaution).join('');
      const order=sentences.filter(s=>!isCaution(s)).join('');
      const rows=[['怎麼去',access],['走訪順序',copy?order:null],['時間安排',time.textContent.trim()],['注意事項',cautions||null]];
      rows.forEach(([label,value])=>{if(!value)return;const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);facts.append(row);});
      briefing.append(facts);detail.prepend(briefing);
      appendTransitWayfinding(detail,i);
      let toggle=stop.querySelector('.schedule-toggle');
      if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='schedule-toggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',detail.id);time.before(toggle);toggle.append(time);const label=document.createElement('span');label.className='schedule-toggle-label';label.innerHTML='詳細行程 <span aria-hidden="true">＋</span>';toggle.append(label);}
      detail.id=`revised-detail-${state.group}-${state.day}-${i}`;
      toggle.setAttribute('aria-controls',detail.id);
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
      else weather.textContent = '天氣服務暫時無法載入，行程仍可正常閱讀。';
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

