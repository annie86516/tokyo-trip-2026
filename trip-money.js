(() => {
  'use strict';
  const API_URL = 'https://iykqldpzciqelmrjzlng.supabase.co';
  const API_KEY = 'sb_publishable_hgxM-twdEVzZRztE78Tpqw_rqMnwVL2';
  const PIN = '000000';
  const ROOM_STORE = 'tokyo-trip-2026.expense-room';
  let host = null;
  let ledger = null;
  let roomCode = '';
  let memberName = '';
  let poller = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = (value, currency = 'JPY') => new Intl.NumberFormat('zh-TW', {
    style:'currency', currency, maximumFractionDigits:0
  }).format(Number(value) || 0);
  const currencyOf = note => /^\[(JPY|TWD)\]/.exec(String(note || ''))?.[1] || 'TWD';
  const visibleNote = note => String(note || '旅費').replace(/^\[(JPY|TWD)\]\s*/, '');
  const savedNameKey = code => `tokyo-trip-2026.expense-name.${code}`;

  async function rpc(name, args) {
    const response = await fetch(`${API_URL}/rest/v1/rpc/${name}`, {
      method:'POST',
      headers:{'Content-Type':'application/json', apikey:API_KEY},
      body:JSON.stringify(args)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data.message || data.error || '帳本連線失敗').replace('邀請碼或密碼不正確','找不到這個旅費群組'));
    return data;
  }

  function setMessage(text, error = false) {
    const output = host?.querySelector('.money-message');
    if (!output) return;
    output.textContent = text;
    output.classList.toggle('is-error', error);
  }

  function shareUrl() {
    const url = new URL(location.href);
    url.searchParams.set('view','money');
    url.searchParams.set('expenseRoom',roomCode);
    return url.href;
  }

  function entryMarkup() {
    const invited = /^[A-Z0-9]{6}$/.test(roomCode);
    return `<div class="money-entry">
      <section class="money-card money-welcome">
        <span class="money-seal">旅費</span>
        <div><h2>${invited ? '加入旅行帳本' : '大家一起記帳'}</h2><p>${invited ? `邀請碼 ${esc(roomCode)}，輸入自己的名字即可加入。` : '第一位先建立群組，再把邀請連結傳給同行的人。'}</p></div>
      </section>
      <div class="money-entry-grid">
        <form class="money-card money-form" data-money-form="join">
          <h3>輸入名字加入</h3>
          <label>邀請碼<input name="code" value="${esc(roomCode)}" maxlength="6" autocapitalize="characters" placeholder="例如 ABC123" required></label>
          <label>你的名字<input name="name" maxlength="12" autocomplete="name" placeholder="例如 Annie" required></label>
          <button class="money-primary">進入共同帳本</button>
        </form>
        <form class="money-card money-form" data-money-form="create">
          <h3>建立新的旅費群組</h3>
          <label>群組名稱<input name="roomName" value="2026 東京旅行" maxlength="30" required></label>
          <label>你的名字<input name="name" maxlength="12" autocomplete="name" placeholder="例如 Annie" required></label>
          <button class="money-secondary">建立並取得邀請連結</button>
        </form>
      </div>
      <p class="money-privacy">使用名字與邀請碼加入，不需要帳號密碼。只有拿到邀請連結的人才能查看與修改這本帳。</p>
      <p class="money-message" role="status"></p>
    </div>`;
  }

  function settlements() {
    const members = ledger.room.members || [];
    const result = [];
    ['JPY','TWD'].forEach(currency => {
      const balances = members.map(() => 0);
      (ledger.debts || []).filter(debt => !debt.settled && currencyOf(debt.note) === currency).forEach(debt => {
        if (balances[debt.debtorIndex] === undefined || balances[debt.creditorIndex] === undefined) return;
        balances[debt.debtorIndex] -= Number(debt.amount) || 0;
        balances[debt.creditorIndex] += Number(debt.amount) || 0;
      });
      const owe = balances.map((amount,index) => ({index,amount:-amount})).filter(item => item.amount > 0);
      const receive = balances.map((amount,index) => ({index,amount})).filter(item => item.amount > 0);
      let i = 0, j = 0;
      while (i < owe.length && j < receive.length) {
        const amount = Math.min(owe[i].amount, receive[j].amount);
        result.push({from:owe[i].index,to:receive[j].index,amount,currency});
        owe[i].amount -= amount; receive[j].amount -= amount;
        if (!owe[i].amount) i++;
        if (!receive[j].amount) j++;
      }
    });
    return result;
  }

  function expenseForm() {
    const members = ledger.room.members || [];
    const payer = Math.max(0,members.findIndex(name => name === memberName));
    return `<details class="money-card expense-editor">
      <summary>＋ 新增一筆共同花費</summary>
      <form data-money-form="expense">
        <div class="money-grid-two">
          <label>項目<input name="title" maxlength="80" placeholder="例如：晚餐、計程車、住宿" required></label>
          <label>幣別<select name="currency"><option value="JPY">JPY 日圓</option><option value="TWD">TWD 台幣</option></select></label>
        </div>
        <div class="money-grid-two">
          <label>誰先付款<select name="payer">${members.map((name,index)=>`<option value="${index}" ${index===payer?'selected':''}>${esc(name)}</option>`).join('')}</select></label>
          <label>總金額<input name="total" type="number" min="1" step="1" inputmode="numeric" placeholder="例如 12000" required></label>
        </div>
        <fieldset><legend>哪些人一起分擔</legend><div class="money-checks">${members.map((name,index)=>`<label><input type="checkbox" name="participant" value="${index}" checked><span>${esc(name)}</span></label>`).join('')}</div></fieldset>
        <fieldset><legend>分擔方式</legend><div class="money-modes"><label><input type="radio" name="mode" value="equal" checked> 平均分攤</label><label><input type="radio" name="mode" value="custom"> 自訂每人金額</label></div></fieldset>
        <div class="money-custom" hidden>${members.map((name,index)=>`<label data-share-row="${index}"><span>${esc(name)}</span><input name="share-${index}" type="number" min="0" step="1" inputmode="numeric" value="0"></label>`).join('')}</div>
        <div class="money-split-preview">填入總金額後，這裡會顯示每人應分擔的金額。</div>
        <label>備註<textarea name="note" maxlength="120" placeholder="選填，例如：Day 5 淺草午餐"></textarea></label>
        <div class="money-form-actions"><button type="button" data-money-action="cancel-expense">取消</button><button class="money-primary">儲存分帳</button></div>
      </form>
    </details>`;
  }

  function ledgerMarkup() {
    const members = ledger.room.members || [];
    const debts = ledger.debts || [];
    const transfers = settlements();
    const outstanding = debts.filter(debt => !debt.settled).reduce((totals,debt) => {
      const currency = currencyOf(debt.note); totals[currency] += Number(debt.amount) || 0; return totals;
    },{JPY:0,TWD:0});
    return `<div class="money-ledger">
      <section class="money-card money-room-head">
        <div><span class="money-kicker">SHARED TRIP WALLET</span><h2>${esc(ledger.room.name || '旅行帳本')}</h2><p>${esc(memberName)} 已加入 · 邀請碼 <strong>${esc(roomCode)}</strong></p></div>
        <div class="money-room-actions"><button data-money-action="copy">複製邀請連結</button><button data-money-action="leave">離開</button></div>
      </section>
      <div class="money-stats"><div><span>同行成員</span><strong>${members.length} 人</strong></div><div><span>未結清代墊</span><strong>${money(outstanding.JPY,'JPY')}</strong><small>${outstanding.TWD ? money(outstanding.TWD,'TWD') : '目前無台幣款項'}</small></div></div>
      <section class="money-card money-members"><h3>這本帳有哪些人</h3><div>${members.map(name=>`<span>${esc(name)}</span>`).join('')}</div><p>把邀請連結傳給同行的人，對方輸入名字後會自動加入。</p></section>
      ${expenseForm()}
      <section class="money-card money-settlement"><div class="money-section-head"><div><span class="money-kicker">SETTLEMENT</span><h3>目前誰該付誰</h3></div><button data-money-action="refresh">同步</button></div>
        ${transfers.length ? `<div class="money-transfers">${transfers.map(item=>`<div><strong>${esc(members[item.from] || '成員')}</strong><span>付給</span><strong>${esc(members[item.to] || '成員')}</strong><b>${money(item.amount,item.currency)}</b></div>`).join('')}</div>` : '<div class="money-clear">✓ 目前沒有未結清款項</div>'}
      </section>
      <section class="money-records"><div class="money-section-head"><div><span class="money-kicker">HISTORY</span><h3>分帳紀錄</h3></div></div>
        ${debts.length ? debts.map(debt=>`<article class="money-debt ${debt.settled?'is-paid':''}"><label class="money-paid"><input type="checkbox" data-money-action="toggle" data-id="${esc(debt.id)}" ${debt.settled?'checked':''}><span>${debt.settled?'已付清':'待付款'}</span></label><div><p><strong>${esc(members[debt.debtorIndex] || '成員')}</strong> 要付給 <strong>${esc(members[debt.creditorIndex] || '成員')}</strong></p><small>${esc(visibleNote(debt.note))}</small></div><b>${money(debt.amount,currencyOf(debt.note))}</b><button class="money-delete" data-money-action="delete" data-id="${esc(debt.id)}" aria-label="刪除這筆分帳">刪除</button></article>`).join('') : '<div class="money-empty"><strong>還沒有分帳紀錄</strong><p>有人先付餐費、交通費或住宿費時，就新增在這裡。</p></div>'}
      </section>
      <p class="money-message" role="status">資料已同步</p>
    </div>`;
  }

  function renderEntry() {
    if (host) host.innerHTML = entryMarkup();
  }

  function renderLedger() {
    if (host && ledger) host.innerHTML = ledgerMarkup();
  }

  function enter(data, name) {
    ledger = data;
    memberName = name;
    roomCode = String(data.room?.code || roomCode).toUpperCase();
    localStorage.setItem(ROOM_STORE,roomCode);
    localStorage.setItem(savedNameKey(roomCode),memberName);
    const url = new URL(location.href);
    url.searchParams.set('expenseRoom',roomCode);
    url.searchParams.set('view','money');
    history.replaceState({},'',url);
    renderLedger();
    clearInterval(poller);
    poller = setInterval(async () => {
      if (!host?.isConnected || host.querySelector('.expense-editor[open]')) return;
      try { ledger = await rpc('get_ticket_room',{p_code:roomCode,p_pin:PIN}); renderLedger(); } catch {}
    },15000);
  }

  function selectedShares(form, strict = false) {
    const total = Math.round(Number(form.elements.total.value) || 0);
    const selected = [...form.querySelectorAll('[name="participant"]:checked')].map(input => Number(input.value));
    if (!selected.length || total < 1) return {total,selected,shares:[]};
    if (form.elements.mode.value === 'equal') {
      const base = Math.floor(total / selected.length), remainder = total % selected.length;
      return {total,selected,shares:selected.map((index,position)=>({index,amount:base+(position<remainder?1:0)}))};
    }
    const shares = selected.map(index=>({index,amount:Math.round(Number(form.elements[`share-${index}`].value)||0)}));
    if (strict && shares.reduce((sum,item)=>sum+item.amount,0) !== total) throw new Error('自訂金額加總必須等於總金額');
    return {total,selected,shares};
  }

  function updateSplitPreview(form) {
    const custom = form.elements.mode.value === 'custom';
    form.querySelector('.money-custom').hidden = !custom;
    form.querySelectorAll('[data-share-row]').forEach(row => {
      const picked = form.querySelector(`[name="participant"][value="${row.dataset.shareRow}"]`)?.checked;
      row.hidden = !picked;
      row.querySelector('input').disabled = !custom || !picked;
    });
    const {shares} = selectedShares(form);
    const currency = form.elements.currency.value;
    const members = ledger.room.members || [];
    form.querySelector('.money-split-preview').innerHTML = shares.length ? shares.map(item=>`<span>${esc(members[item.index])}<b>${money(item.amount,currency)}</b></span>`).join('') : '請輸入總金額並至少選擇一位分擔者。';
  }

  async function refresh(showNotice = true) {
    ledger = await rpc('get_ticket_room',{p_code:roomCode,p_pin:PIN});
    renderLedger();
    if (showNotice) setMessage('已同步最新分帳資料');
  }

  async function handleSubmit(event) {
    const form = event.target.closest('[data-money-form]');
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('button:not([type="button"])');
    if (submit) submit.disabled = true;
    try {
      if (form.dataset.moneyForm === 'create') {
        const name = form.elements.name.value.trim();
        const data = await rpc('create_ticket_room',{p_room_name:form.elements.roomName.value.trim(),p_members:[name],p_pin:PIN});
        enter(data,name); setMessage('旅費群組已建立，請把邀請連結傳給同行的人');
      } else if (form.dataset.moneyForm === 'join') {
        const code = form.elements.code.value.trim().toUpperCase(), name = form.elements.name.value.trim();
        const data = await rpc('join_ticket_room',{p_code:code,p_pin:PIN,p_name:name});
        roomCode = code; enter(data,name); setMessage(`已用「${name}」加入旅行帳本`);
      } else if (form.dataset.moneyForm === 'expense') {
        const payer = Number(form.elements.payer.value);
        const {total,shares} = selectedShares(form,true);
        if (!shares.length) throw new Error('請至少選擇一位分擔者');
        const currency = form.elements.currency.value;
        const title = form.elements.title.value.trim();
        const extra = form.elements.note.value.trim();
        const debtShares = shares.filter(item=>item.index!==payer && item.amount>0);
        if (!debtShares.length) throw new Error('目前沒有其他人需要分擔，請再確認付款人與成員');
        const note = `[${currency}] ${title} · 總額 ${money(total,currency)}${extra?' · '+extra:''} · 記錄者：${memberName}`.slice(0,280);
        for (const share of debtShares) {
          ledger = await rpc('save_ticket_debt_v2',{p_code:roomCode,p_pin:PIN,p_payload:{debtorIndex:share.index,creditorIndex:payer,amount:share.amount,eventId:null,note}});
        }
        renderLedger(); setMessage('分帳已儲存，同行成員會看到最新資料');
      }
    } catch (error) {
      setMessage(error.message || '無法儲存，請稍後再試',true);
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  }

  async function handleClick(event) {
    const button = event.target.closest('[data-money-action]');
    if (!button) return;
    const action = button.dataset.moneyAction;
    try {
      if (action === 'copy') {
        await navigator.clipboard.writeText(`${shareUrl()}\n旅費帳本邀請碼：${roomCode}`);
        setMessage('邀請連結已複製');
      } else if (action === 'leave') {
        if (!confirm('要從這台裝置離開旅費群組嗎？共同帳本不會被刪除。')) return;
        localStorage.removeItem(savedNameKey(roomCode)); localStorage.removeItem(ROOM_STORE);
        ledger=null; memberName=''; roomCode=''; clearInterval(poller);
        const url=new URL(location.href);url.searchParams.delete('expenseRoom');history.replaceState({},'',url);renderEntry();
      } else if (action === 'cancel-expense') {
        button.closest('details').open=false;
      } else if (action === 'refresh') {
        button.disabled=true; await refresh();
      } else if (action === 'delete') {
        if (!confirm('確定刪除這筆分帳紀錄？')) return;
        ledger=await rpc('mutate_ticket_room',{p_code:roomCode,p_pin:PIN,p_action:'delete_debt',p_payload:{id:button.dataset.id}});renderLedger();setMessage('分帳紀錄已刪除');
      }
    } catch (error) { setMessage(error.message || '操作失敗，請稍後再試',true); }
    finally { if(button?.isConnected) button.disabled=false; }
  }

  async function handleChange(event) {
    const form = event.target.closest('[data-money-form="expense"]');
    if (form && (event.target.matches('[name="total"],[name="currency"],[name="mode"],[name="participant"],[name^="share-"]'))) updateSplitPreview(form);
    if (event.target.dataset.moneyAction === 'toggle') {
      try {
        ledger=await rpc('mutate_ticket_room',{p_code:roomCode,p_pin:PIN,p_action:'toggle_debt',p_payload:{id:event.target.dataset.id,settled:event.target.checked}});renderLedger();setMessage(event.target.checked?'已標記為付清':'已改為待付款');
      } catch(error) { event.target.checked=!event.target.checked;setMessage(error.message || '無法更新',true); }
    }
  }

  async function mount(target) {
    unmount();
    host = target;
    host.addEventListener('submit',handleSubmit);
    host.addEventListener('click',handleClick);
    host.addEventListener('change',handleChange);
    roomCode = (new URL(location.href).searchParams.get('expenseRoom') || localStorage.getItem(ROOM_STORE) || '').toUpperCase();
    memberName = roomCode ? localStorage.getItem(savedNameKey(roomCode)) || '' : '';
    renderEntry();
    if (roomCode && memberName) {
      setMessage('正在載入共同帳本…');
      try { enter(await rpc('get_ticket_room',{p_code:roomCode,p_pin:PIN}),memberName); }
      catch(error) { localStorage.removeItem(savedNameKey(roomCode)); memberName=''; renderEntry(); setMessage(error.message,true); }
    }
  }

  function unmount() {
    clearInterval(poller); poller=null;
    if (host) {
      host.removeEventListener('submit',handleSubmit);
      host.removeEventListener('click',handleClick);
      host.removeEventListener('change',handleChange);
    }
    host=null;
  }

  window.TripMoney = {mount,unmount};
})();
