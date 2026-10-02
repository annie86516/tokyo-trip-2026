/* Mobile reading view. The original document remains the source of truth:
   shared itinerary edits therefore appear here without maintaining a second copy. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const pages = [...document.querySelectorAll('.page-sheet')];
  if (!$('#day1') || !$('#flight-info')) return;
  const GROUPS = ['A', 'B', 'C'];
  const STAY_KEYS = ['tokyo','nikko','narita'];
  const STAY_INFO = {
    tokyo:{label:'東京',id:'stay-tokyo',image:'./stay-tokyo.jpg',alt:'東京本所吾妻橋包棟民宿的客廳與用餐空間',source:'https://www.airbnb.com/rooms/1661217093593003826'},
    nikko:{label:'日光',id:'stay-nikko',image:'./stay-nikko.jpg',alt:'日光山景包棟民宿的和室空間',source:'https://www.airbnb.com/rooms/52815877'},
    narita:{label:'成田',id:'stay-narita',image:'./stay-narita.jpg',alt:'成田里士滿飯店外觀',source:'https://richmondhotel.jp/narita/'}
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
    view: ['days', 'flights', 'stays', 'bookings', 'money', 'reserve', 'restaurants', 'guide', 'coupons'].includes(params.get('view')) ? params.get('view') : 'days',
    bookingDay: [1,5,8].includes(Number(params.get('bday') || saved.bookingDay)) ? Number(params.get('bday') || saved.bookingDay) : 1,
    coupon: ['yam','laox','donki'].includes(params.get('cpn') || saved.coupon) ? (params.get('cpn') || saved.coupon) : 'yam',
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
        if (state.group === 'C' && (day < 3 || (day === 3 && !text.includes('大東縁')))) row.remove();
        if (state.group === 'B' && day === 1 && !text.includes('鳥貴族')) row.remove();
      });
      // Old note described pink paper highlighting, which has no role in this view.
      clone.querySelectorAll('.summary-lead').forEach(el => {
        if (el.textContent.includes('粉紅色')) el.textContent = '各組一起走行程；11/25 牛たんの檸檬已訂 5 人，不吃牛的 2 位在麺 みつヰ／秋光候選中擇一，尚未決定；餐後會合。';
      });
      if (state.group==='C' && source.id==='restaurant-main') {
        const arrivalMeal=document.createElement('p');
        arrivalMeal.innerHTML='<strong>第 3 天晚餐：燒肉・大東縁。</strong>民宿放行李後到大東縁與大家會合，用餐後再前往晴空塔。<a href="https://maps.app.goo.gl/KTH72UYA1GzS5AFs8" target="_blank" rel="noopener noreferrer">開啟地圖 ↗</a>';
        clone.querySelector('table')?.before(arrivalMeal);
      }
    }
    if (source.id === 'tax-vjw') {
      const note = clone.querySelector('.narita-box');
      if (note) note.textContent = `${state.group} 組：依第 9 天共同接駁安排前往成田 T2，托運前完成免稅品攜出確認；護照、商品、收據與退款說明放在方便取用的位置。`;
    }
    [clone,...clone.querySelectorAll('*')].forEach(el => {
      [...el.attributes].forEach(attr => {
        if (!['href','src','alt','title','target','rel','colspan','rowspan'].includes(attr.name)) el.removeAttribute(attr.name);
      });
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (href.includes('site-one/index.html')) {
          const context=el.closest('.day-item')?.textContent||'';
          const isBookedDinner=context.includes('鳥貴族');
          const isBookedTransfer=source.id==='day8-route-detail';
          const bookingDay=isBookedDinner?1:isBookedTransfer?8:0;
          el.setAttribute('href',bookingDay?`./?view=bookings&bday=${bookingDay}`:'./?view=reserve');
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
    const fallback=img.dataset.imageFallback;
    if(fallback && !img.dataset.fallbackTried) {
      img.dataset.fallbackTried='true';
      img.alt='照片暫時無法載入，以下為餐點示意圖';
      const note=document.createElement('p');
      note.className='image-load-note';
      note.textContent='照片暫時無法載入・餐點示意圖';
      img.after(note);
      img.src=fallback;
    } else {
      img.hidden=true;
      if(img.dataset.fallbackTried && img.nextElementSibling?.className==='image-load-note') {
        img.nextElementSibling.textContent='照片暫時無法載入';
      }
      if(!img.dataset.fallbackTried && img.alt) {
        const note=document.createElement('p');
        note.className='image-load-note';
        note.textContent='照片暫時無法載入：'+img.alt;
        img.after(note);
      }
    }
  }, true);
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('./trip-app.css?v=20261002-itinerary-fixes', document.baseURI).href;
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
        <button type="button" data-view="bookings">${icon('ticket')}<span>已預約</span></button>
        <button type="button" data-view="reserve">${icon('calendar')}<span>待辦事項</span></button>
        <button type="button" data-view="restaurants">${icon('pin')}<span>餐廳攻略</span></button>
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
      fixed('18:30','航班抵達'), fixed('20:23','預定班次・依出關調整'),
      suggested('21:05–21:15 抵達本所吾妻橋'), fixed('21:30 鳥貴族訂位・A 組先入座','已訂位'), suggested('B 組抵達後加入；延誤請聯絡店家')
    ];
    if (state.day === 3 && state.group === 'C') return [
      fixed('12:10','航班抵達'), suggested('13:00–15:00'),
      suggested('17:30–18:30'), suggested('18:30–19:00')
    ];
    return {
      1:[suggested('15:20–16:00'),suggested('16:00–17:00'),suggested('17:00–17:20'),suggested('17:30–18:15'),suggested('18:45–20:00'),fixed('21:30 鳥貴族','已訂位')],
      2:[suggested('09:00–09:45'),suggested('10:15–11:15'),suggested('11:15–11:45'),suggested('12:00–13:30'),suggested('14:30–18:00'),suggested('18:00–19:00')],
      3:[suggested('09:00–12:15；13:00 起晴空塔'),suggested('17:30–18:30')],
      4:[suggested('09:00–09:45'),suggested('09:45–10:45'),suggested('11:00–14:15（與午餐調整順序）'),suggested('11:00–14:15 午餐三選一'),suggested('14:15–14:45 步行往澀谷'),suggested('14:45–15:30 FREAK\'S STORE'),suggested('15:30–17:00 澀谷 PARCO'),suggested('17:00–19:00 PARCO B1 分開晚餐・依候位'),suggested('19:00–20:00 唐吉訶德選逛'),suggested('依集合時間返回民宿')],
      5:[suggested('09:00–09:45'),suggested('10:00–11:30'),suggested('11:30–12:00'),suggested('12:00–14:00（檸檬 5 位已訂；另 2 位候選待選）'),suggested('14:00–15:30 淺草自由活動'),suggested('15:30–16:30 回民宿放物品、休息'),suggested('17:30–18:00 TEN& 外帶（建議）'),suggested('18:30–19:20 HARBS（有位內用／否則外帶）'),suggested('19:20 起 六本木新城聖誕市集・大屋頂廣場')],
      6:[fixed('晴空塔 09:03 或 10:03','候選列車班次・上車站以車票為準'),suggested('搭車期間'),suggested('11:00–12:30（依班次）'),suggested('13:00–16:30')],
      7:[suggested('07:50 前出發；湖區午餐；12:55／13:15 候選下山'),suggested('14:00–16:00（依末班入場取捨）'),suggested('17:30–18:30')],
      8:[suggested('12:30–13:00（依交通調整）'),suggested('13:00–14:30'),suggested('14:30–16:40'),fixed('去程 17:15／17:47；回程 20:28／20:29','行程所列巴士班次・行前確認')],
      9:[fixed('08:20','飯店接駁・前一晚登記'),suggested(state.group==='B'?'11:30–12:30':'10:30–11:00'),fixed(state.group==='B'?'14:35':'13:00','回程航班起飛')]
    }[state.day] || [];
  }
  function list(items) {
    const times = dailyTimes();
    return `<ol class="timeline">${items.map((html,i)=>{
      const slot=times[i];
      const time=slot?`<div class="schedule-time${slot.fixed?' is-fixed':''}"><span>${escape(slot.label)}</span><b>${escape(slot.time)}</b></div>`:'';
      return `<li><span class="step" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div class="stop-content">${time}${html}</div></li>`;
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
      items = [groupArrival(), '<strong>機場交通：</strong>以 20:23 Skyliner 172 號為預定班次；出關順利可搭 19:23，較晚可搭 21:23。詳細班次請看下方「航班交通」。', '<strong>先放行李：</strong>到本所吾妻橋民宿後在群組回報，再確認晚餐集合位置與抵達時間。', readable([...source.querySelectorAll('.day-item')].at(-1)), '<strong>晚餐會合：</strong>A 組先憑訂位姓名報到入座；B 組抵達後加入。若航班或入境延誤，請先通知店家。'];
      extras = [];
    }
    if (state.day === 3 && state.group === 'C') {
      title = '抵達東京・燒肉與晴空塔';
      photo = source.querySelectorAll('.day-photo img')[1];
      route = '成田 T2 → Skyliner、青砥轉乘 → 本所吾妻橋民宿放行李 → 大東縁與大家會合吃晚餐 → 晴空塔';
      items = [groupArrival(), ...[...$('#day3-route-detail-b1').querySelectorAll('.group-c-arrival-row')].map(row=>`<strong>${row.cells[1].textContent}</strong><p>${row.cells[2].textContent}</p><p>${row.cells[3].textContent}</p>`)];
      items.push('<strong>餐後安排：</strong>大東縁用餐結束後，再一起前往晴空塔；依實際用餐進度調整出發時間。<br/><a href="https://maps.app.goo.gl/KTH72UYA1GzS5AFs8" target="_blank" rel="noopener noreferrer">燒肉・大東縁地圖 ↗</a>');
      extras = [];
    } else if (state.day === 3) {
      const selected = ['yanaka','sumida'].includes(state.routes[state.group]) ? state.routes[state.group] : 'all';
      route = '本所吾妻橋 → 自選谷根千或京島・向島 → 晴空塔 Solamachi → 大東縁晚餐 → 晴空塔夜景';
      items[0] = '<strong>上午自由選線：</strong>谷根千適合老街與神社散步；京島・向島適合麵包、咖啡與輕鬆慢走。最晚 12:15 離開上午路線，直接前往晴空塔。';
      custom = `<h2 class="section-label">上午想走哪一條？</h2><p class="intro">A、B 組都可自由選擇，與航班組別無關。</p><div class="route-select" role="group" aria-label="第 3 天散步路線">${[['all','兩條都看'],['yanaka','谷根千'],['sumida','京島・向島']].map(([key,label])=>`<button type="button" data-route="${key}" aria-pressed="${selected===key}">${label}</button>`).join('')}</div>`;
      extras = extras.filter(el => selected === 'all' || (selected === 'yanaka' ? el.id !== 'day3-route-detail-b1' : el.id !== 'day3-route-detail'));
      if (selected === 'yanaka') extras = extras.map(el=>{
        if(!el.classList.contains('day3-food')) return el;
        const dinner=document.createElement('section');
        dinner.innerHTML='<h2>大東縁晚餐</h2>';
        dinner.append(el.querySelector('.diet-inline-card').cloneNode(true));
        return dinner;
      });
    }
    if (state.day === 5) {
      const lunchIndex = items.findIndex(html => html.includes('A～C 組午餐') || html.includes('分開用餐'));
      if (lunchIndex >= 0) items[lunchIndex] = `<strong>11/25 午餐｜分開用餐</strong><div class="meal-split-grid" aria-label="午餐分組">
        <article class="meal-split-card meal-split-booked"><div class="meal-split-head"><strong>吃牛肉・5 人</strong><span>已訂位</span></div><h3><a href="https://maps.app.goo.gl/K4QdwtcbFczYAsTPA" target="_blank" rel="noopener noreferrer">牛たんの檸檬 淺草店</a></h3><p><b>11/25 12:00</b>｜兩筆訂位：3 人＋2 人</p><a href="./?view=bookings&amp;bday=5">查看已預約資料與代碼 ↗</a></article>
        <article class="meal-split-card meal-split-pending"><div class="meal-split-head"><strong>不吃牛肉・2 人</strong><span>待選店</span></div><h3>淺草午餐二選一</h3><p>麺 みつヰ／天麩羅秋光；目前都只是候選，尚未決定或預約。</p><p class="meal-split-caution">下單前向店家確認湯底、醬汁與配料沒有牛肉、牛骨或牛脂。</p><div class="meal-split-links"><a href="https://tabelog.com/tokyo/A1311/A131102/13284327/" target="_blank" rel="noopener noreferrer">麺 みつヰ ↗</a><a href="https://akimitsu.tokyo/asakusa/" target="_blank" rel="noopener noreferrer">天麩羅秋光 ↗</a></div></article>
      </div>`;
    }
    if (state.day === 9) {
      const row = flightRow(returns,state.group);
      items = items.map(html => html.includes('IT281') || html.includes('CI101') ? '<strong>行程流程：</strong>全體 08:20 飯店接駁（約 08:40 抵達 T2）→ 保留免稅品在身邊 → 托運前完成海關攜出確認 → 航空報到／托運。' : html);
      items.push(`<strong>${state.group} 組回程：</strong>${row.cells[3].innerHTML}<br/>${row.cells[1].innerHTML} → ${row.cells[2].innerHTML}`);
    }
    const date = source.querySelector('.day-date').textContent;
    return `<div class="journey-heading"><div><div class="eyebrow">NOVEMBER IN JAPAN</div><p class="journey-title">${state.group} 組的秋日旅程</p></div><span class="trip-duration">${state.group==='C'?'7 天 6 夜':'9 天 8 夜'}</span></div>
      <p class="intro journey-intro">${state.group==='C'?'11.23':'11.21'} — 11.29<span>本組行程與共同活動</span></p>
      ${dayNavigation()}
      <section class="weather-section" aria-label="當日行程天氣"><p>天氣資料載入中；尚未提供的預報不會以目前天氣代替。</p></section>
      <div class="itinerary-layout"><aside class="day-overview"><section class="hero">${photo ? `<img src="${escape(photo.getAttribute('src'))}" alt="${escape(photo.alt)}" fetchpriority="high"/>` : ''}<span class="day-stamp" aria-hidden="true">DAY <b>${String(state.day).padStart(2,'0')}</b></span><div class="hero-copy"><small>${escape(date)} · ${state.group} 組</small><h1>${escape(title)}</h1><span class="photo-caption">${icon('pin')}${escape(photo?.alt || '日本之旅')}</span></div></section>
      <div class="route"><span class="route-label">${icon('pin')}今日路線<span>TODAY'S ROUTE</span></span>${route}</div></aside>
      <section class="day-plan" aria-label="每日安排"><h2 class="section-label">今日安排<span class="section-sub">ITINERARY</span></h2>${list(items)}${custom}
      ${source.querySelector('.day-alert-grid') ? `<div class="document">${readable(source.querySelector('.day-alert-grid'))}</div>` : ''}
      ${extras.length?'<h2 class="section-label">交通細節與餐飲</h2>':''}${extras.map((el,i)=>detail(el.querySelector('h2,.day-title')?.textContent || '補充資料',el,`day-${state.day}-${i}`)).join('')}
      <div class="day-footer"><button type="button" data-day="${state.day-1}" ${state.day===firstDay()?'disabled':''}>← 前一天</button><span>DAY ${String(state.day).padStart(2,'0')} / 09</span><button type="button" data-day="${state.day+1}" ${state.day===9?'disabled':''}>後一天 →</button></div></section></div>`;
  }
  function flightPanel(table,title) {
    const row = flightRow(table,state.group);
    return `<section class="panel flight-ticket"><div class="ticket-header"><span class="pill">${escape(title)} · ${state.group} 組</span><span>BOARDING PASS</span></div><div class="flight"><div>${row.cells[1].innerHTML}</div><span class="arrow" aria-hidden="true">${icon('plane')}</span><div>${row.cells[2].innerHTML}</div></div><div class="ticket-footer"><strong>${row.cells[3].innerHTML}</strong>${row.cells[4]?`<p class="intro">原行程預留抵達機場時間：${row.cells[4].innerHTML}</p>`:''}</div></section>`;
  }
  function flights() {
    const rail = $('.narita-combined-table').cloneNode(true);
    rail.querySelectorAll('tbody').forEach(body=>{ if(!body.classList.contains('group-'+state.group.toLowerCase())) body.remove(); });
    const wrap = document.createElement('div'); wrap.append(rail);
    return `<div class="eyebrow">MY FLIGHTS</div><h1>${state.group} 組航班與交通</h1><p class="intro">只顯示本組班機與機場接駁資訊。</p>${flightPanel(departures,'去程')}${flightPanel(returns,'回程')}<div class="note">第 9 天原訂全體 08:20 搭飯店接駁前往成田 T2；免稅品攜出確認須在托運前完成。</div><h2 class="section-label">成田 → 本所吾妻橋</h2><div class="document">${readable(wrap)}${readable($('.narita-prev-fare-wrap'))}</div><div class="resource-links"><a href="./site-four/index.html">Skyliner 購票與青砥轉乘圖解 ↗</a><a href="./?view=reserve">行前預約與票券 ↗</a></div>`;
  }
  function stays() {
    const stay=STAY_INFO[state.stay], source=$('#'+stay.id);
    return `<div class="eyebrow">OUR STAYS</div><h1>${stay.label}住宿</h1><p class="intro">使用下方按鈕切換東京、日光與成田。</p><article class="stay-focus"><figure class="stay-cover"><img src="${stay.image}" alt="${stay.alt}" fetchpriority="high"><figcaption>${stay.alt} · <a href="${stay.source}" target="_blank" rel="noopener noreferrer">查看來源 ↗</a></figcaption></figure><div class="document stay-document">${readable(source,{omitTitle:true})}</div></article>`;
  }
  function moneyView() {
    return `<div class="eyebrow">TRIP EXPENSES</div><h1>旅費分帳</h1><p class="intro">先選付款者、勾選分擔者，再設定平均或自訂金額；所有紀錄都列在「全部項目」。要結算時再按下計算，查看精簡的轉帳清單；日圓依每筆匯率換算成台幣。</p><div class="money-app"></div>`;
  }
  function reserve() {
    return `<div class="eyebrow">TO-DO LIST</div><h1>待辦事項</h1><p class="intro">只列出尚未完成的餐廳決定、票券與出發前待辦；已確認訂位與接送請看「已預約」，</p><div class="supplement-root" data-supplement="reserve"><section class="panel supplement-loading">正在整理待辦事項…</section></div>`;
  }
  function bookingNavigation() {
    const days=[{day:1,date:'11/21',label:'鳥貴族'},{day:5,date:'11/25',label:'淺草午餐'},{day:8,date:'11/28',label:'日光接送'}];
    return `<nav class="day-rail booking-rail" aria-label="選擇已預約日期">${days.map(item=>`<button class="day-button" type="button" data-booking-day="${item.day}" aria-label="${item.date} ${item.label}" aria-pressed="${item.day===state.bookingDay}"><span>DAY ${String(item.day).padStart(2,'0')}</span><b>${item.date.slice(3)}</b><small>${item.label}</small></button>`).join('')}</nav>`;
  }
  function bookings() {
    const content=state.bookingDay===1?`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 01 · 11/21（六）</span><span class="booking-status">已訂位</span></div><h2>鳥貴族 淺草店</h2><div class="booking-facts"><div><span>時間</span><strong>21:30</strong></div><div><span>人數</span><strong>5 位成人</strong></div><div><span>同行</span><strong>A＋B 組</strong></div><div><span>訂位姓名</span><strong>CHEN, KUANTING</strong></div></div><p>訂位已確認。A 組可先憑 CHEN, KUANTING 的訂位報到入座；B 組抵達後加入。若 B 組交通延誤，請盡早通知店家。</p><a href="https://maps.app.goo.gl/EvEaCawMVivVVJDC9" target="_blank" rel="noopener noreferrer">開啟鳥貴族淺草店地圖 ↗</a></article>`
      :state.bookingDay===5?`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 05 · 11/25（三）</span><span class="booking-status">已訂位 · 共 5 人</span></div><h2>牛たんの檸檬 淺草店</h2><div class="booking-facts"><div><span>時間</span><strong>12:00</strong></div><div><span>預約一</span><strong>3 人</strong></div><div><span>預約二</span><strong>2 人</strong></div></div><div class="booking-codes"><div><span>3 人訂位代碼</span><strong>M9FTDRY6WV</strong><small>訂位姓名：CHEN, KUANTING</small></div><div><span>2 人訂位代碼</span><strong>88C8NLC65V</strong><small>訂位姓名：MA XIN YA</small></div></div><p>兩筆各停留 1 小時，分別報上代碼；能否安排相鄰座位依店家現場為準。2 人訂位為禁菸桌。</p><a href="https://maps.app.goo.gl/K4QdwtcbFczYAsTPA" target="_blank" rel="noopener noreferrer">開啟淺草店地圖 ↗</a></article>`
      :`<article class="panel booking-card"><div class="booking-card-head"><span class="pill">DAY 08 · 11/28（六）</span><span class="booking-status">已訂妥 · 已付款</span></div><h2>日光民宿 → Richmond Hotel Narita</h2><div class="booking-facts"><div><span>上車時間（日本時間）</span><strong>08:00</strong></div><div><span>人數</span><strong>7 位成人</strong></div><div><span>車輛</span><strong>Toyota Hiace 10 人座 × 1</strong></div><div><span>預約人</span><strong>CHEN / KUANTING</strong></div><div><span>訂單編號</span><strong>673314</strong></div></div><div class="booking-followup"><strong>上車地點</strong><p>1-chōme-687-1 Inarimachi, Nikko, Tochigi 321-1411</p><strong>下車地點</strong><p>Richmond Hotel Narita</p><p>憑證註明：乘客需備妥護照與憑證；上車前請主動聯絡司機確認等候位置。司機資訊預計前一天透過 WeChat／WhatsApp 提供，請允許好友邀請。</p><a href="./assets/nikko-narita-transfer-voucher-2026-11-28.pdf" target="_blank" rel="noopener noreferrer">開啟接送憑證 PDF ↗</a></div><div class="booking-followup"><strong>另有待辦｜11/29 飯店機場接駁</strong><p>全團 7 人預計搭 08:20 班次，約 08:40 抵達成田 T2；此為飯店接駁，尚未登記。11/28 入住後立即替 7 人登記並確認集合位置。</p><a href="https://richmondhotel.jp/narita/access/" target="_blank" rel="noopener noreferrer">Richmond 官方交通與接駁 ↗</a></div></article>`;
    return `<div class="eyebrow">CONFIRMED BOOKINGS</div><h1>已預約資料</h1><p class="intro">已確認的訂位與已付款接送集中在這裡；選日期即可查看姓名、時間、人數、訂位代碼及現場資訊。</p>${bookingNavigation()}<div class="booking-content">${content}</div>`;
  }
  function dayNavigation(lastDay = 9) {
    return `<nav class="day-rail" aria-label="選擇行程日期">${Array.from({length:lastDay+1-firstDay()},(_,i)=>i+firstDay()).map(n=>`<button class="day-button" type="button" data-day="${n}" aria-label="第 ${n} 天，11 月 ${20+n} 日" aria-pressed="${n===state.day}"><span>DAY ${String(n).padStart(2,'0')}</span><b>${20+n}</b><small>11月・${['六','日','一','二','三','四','五','六','日'][n-1]}</small></button>`).join('')}</nav>`;
  }
  function restaurants() {
    return `<div class="eyebrow">TOKYO FOOD GUIDE</div><h1>餐廳攻略</h1><p class="intro">選擇日期，查看當天的店面、招牌餐點、營業與候位提醒。</p>${dayNavigation(8)}<div class="supplement-root" data-supplement="restaurants"><section class="panel supplement-loading">正在整理餐廳攻略…</section></div>`;
  }
  function guide() {
    const sections = [
      ['行前準備',['packing-list-1','packing-list-2']],
      ['退稅與寄件',['tax-vjw','japan-post-domestic-1']]
    ];
    return `<div class="eyebrow">TRAVEL NOTES</div><h1>旅行資料</h1><p class="intro">這裡只保留行李準備、退稅與寄件等共用筆記。</p>${sections.map(([title,ids])=>`<h2 class="section-label">${title}</h2>${ids.map(id=>detail($('#'+id).querySelector('h2').textContent,$('#'+id),id)).join('')}`).join('')}`;
  }
  const couponItems = {
    yam:{short:'LABI',name:'山田電機 LABI',category:'家電',image:'https://livejapan.com/public/operation/coupon/assets/image/summary-yamadadenki-coupon-en2.png',alt:'山田電機 LABI 完整優惠券券面，10%免稅加最高7%折扣',headline:'退稅＋最高 7% 折扣',expiry:'有效至 2026/12/31',body:'可到指定免稅店使用；LABI 澀谷、LABI 新宿西口等店適用情形，請以即時券頁中的店舖名單為準。',caution:'Apple、遊戲主機、特價／Outlet 等部分商品不適用額外折扣。請開下方即時券頁出示條碼，並帶護照。',url:'https://livejapan.com/public/operation/coupon/yamadadenki/zh-tw.html',link:'開啟即時優惠券與指定店舖 ↗'},
    laox:{short:'LAOX',name:'LAOX 樂購仕',category:'家電／伴手禮',image:'https://rimage.gnst.jp/livejapan.com/public/operation/coupon/assets/image/laox_zh-tw_NP2.jpg',alt:'LAOX 樂購仕完整優惠券券面，滿額享8%折扣與退稅',headline:'滿 ¥5,000 再折 8%',expiry:'有效至 2026/12/31',body:'指定商品、指定門市可用；淺草店在適用店舖名單內，適合 11/25 淺草行程順路查看。',caution:'不適用遊戲、藥品、特價品等部分商品，且不可和其他折扣併用。結帳前請確認折扣適用條件。',url:'https://livejapan.com/public/operation/coupon/laox/zh-tw.html',link:'開啟優惠券、使用條件與淺草店資料 ↗'},
    donki:{short:'唐吉訶德',name:'唐吉訶德',category:'藥妝／零食／雜貨',image:null,alt:'唐吉訶德即時優惠券須到官方網頁開啟',headline:'滿額最高 5%／7% 折扣',expiry:'官方即時券・出發前複查',body:'LIVE JAPAN 頁面列出未稅滿 ¥10,000 可享最高 5%，滿 ¥30,000 最高 7%；東京沿線有淺草、上野、新宿、澀谷、六本木等分店。',caution:'不可使用截圖結帳；請連網開啟即時券頁，讓店員掃描動態條碼。酒類、香菸、遊戲主機及部分高價商品排除。',url:'https://livejapan.com/public/operation/coupon/donki/zh-tw.html',link:'開啟即時優惠券與使用說明 ↗'}
  };
  function coupons() {
    const item=couponItems[state.coupon];
    const visual=item.image
      ? `<a class="coupon-image-link" href="${item.image}" target="_blank" rel="noopener noreferrer" aria-label="放大查看${escape(item.name)}完整優惠券"><img class="coupon-art" src="${item.image}" alt="${escape(item.alt)}" loading="lazy" decoding="async"/></a>`
      : '<p class="coupon-live-note">唐吉訶德使用即時條碼，不能保存券面或用截圖結帳。請點下方按鈕開啟官方即時優惠券。</p>';
    return `<div class="eyebrow">TRIP SAVINGS</div><h1>旅行優惠券</h1><p class="intro">像切換每日行程一樣選擇優惠券；可保存的券面會顯示整張圖片。唐吉訶德須開啟即時條碼，結帳以官方券頁為準。</p><nav class="day-rail coupon-rail" aria-label="選擇優惠券">${Object.entries(couponItems).map(([key,value])=>`<button class="day-button" type="button" data-coupon="${key}" aria-pressed="${key===state.coupon}"><span>優惠券</span><b>${escape(value.short)}</b><small>${escape(value.category)}</small></button>`).join('')}</nav>
      <article class="panel coupon-card coupon-photo-card"><div class="coupon-top"><span class="pill">${escape(item.category)}｜${escape(item.name)}</span><span class="coupon-status">${escape(item.expiry)}</span></div>${visual}<h2>${escape(item.headline)}</h2><p>${escape(item.body)}</p><p class="coupon-caution">${escape(item.caution)}</p><a href="${item.url}" target="_blank" rel="noopener noreferrer">${escape(item.link)}</a></article><p class="coupon-footnote">整理日期：2026/10/2。效期、適用店舖與商品以即時官方券頁／店員當日確認為準。</p>`;
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
    const path=kind==='reserve'?'./site-one/index.html?v=20261002-itinerary-fixes':'./restaurant-guide/index.html?v=20261002-parco-dinner';
    const baseUrl=new URL(path,document.baseURI);
    try {
      const response=await fetch(baseUrl.href,{cache:'no-cache'});
      if(!response.ok)throw new Error('資料讀取失敗');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      if(!target.isConnected)return;
      target.innerHTML='';
      if(kind==='reserve') {
        const wanted=new URL(location.href).searchParams.get('section');
        [...doc.querySelectorAll('section.page')].filter(section=>['timeline','tickets','restaurants'].includes(section.id)).forEach((section,index)=>{
          const content=(section.querySelector('.content')||section).cloneNode(true);
          const heading=content.querySelector('h2');
          if(section.id==='timeline') content.querySelectorAll('[data-task="vjw"],[data-task="driver-info"],[data-task="luggage-final"],[data-task="richmond-shuttle"]').forEach(task=>task.remove());
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
    const content = state.view==='days'?daily():state.view==='flights'?flights():state.view==='stays'?stays():state.view==='bookings'?bookings():state.view==='money'?moneyView():state.view==='reserve'?reserve():state.view==='restaurants'?restaurants():state.view==='coupons'?coupons():guide();
    main.innerHTML = content+`<p class="status" role="status">${statusText()}</p>`;
    main.querySelectorAll('details[data-detail]').forEach(el=>el.addEventListener('toggle',()=>{
      if(el.open && !el.dataset.loaded) {
        el.querySelector('.document').innerHTML=readable(detailSources.get(el.dataset.detail),{omitTitle:true});
        el.dataset.loaded='true';
      }
    }));
    persist();
    if (scroll) window.scrollTo({top:0,behavior:'instant'});
    const active = main.querySelector('.day-button[aria-pressed=true]');
    if(active) active.parentElement.scrollLeft=Math.max(0,active.offsetLeft-active.parentElement.offsetLeft-110);
    if(state.view === 'days') {
      const weather = main.querySelector('.weather-section');
      if(window.TripWeather) window.TripWeather.render(weather,state.day);
      else weather.textContent = '天氣服務暫時無法載入，行程仍可正常閱讀。';
    }
    if(state.view === 'money' && window.TripMoney) window.TripMoney.mount(main.querySelector('.money-app'));
    else if(window.TripMoney) window.TripMoney.unmount();
    if(state.view === 'reserve' || state.view === 'restaurants') hydrateSupplement(state.view);
  }
  root.addEventListener('click',async event=>{
    const button = event.target.closest('button'); if(!button) return;
    if(button.dataset.group) {
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
    else if($('#'+CSS.escape(id))) state.view='guide';
    render();
    let details = root.querySelector(`details[data-detail="${CSS.escape(id)}"]`);
    if(!details) {
      const sourceKey = [...detailSources].find(([,source]) => source.id === id)?.[0];
      if(sourceKey) details = root.querySelector(`details[data-detail="${CSS.escape(sourceKey)}"]`);
    }
    if(details) { details.open=true; details.scrollIntoView({block:'center'}); }
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
  };
  sheet.onerror=()=>host.remove();
  render();
  document.body.prepend(host);
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(async()=>{
      await navigator.serviceWorker.ready; offlineReady=true;
      root.querySelector('.status').textContent=statusText();
    }).catch(()=>{ offlineFailed=true; root.querySelector('.status').textContent=statusText(); });
  } else { offlineFailed=true; root.querySelector('.status').textContent=statusText(); }
})();
