(() => {
  'use strict';

  const API_URL = 'https://iykqldpzciqelmrjzlng.supabase.co';
  const API_KEY = 'sb_publishable_hgxM-twdEVzZRztE78Tpqw_rqMnwVL2';
  const PIN = '000000';
  const ROOM_CODE = 'D85EE3';
  const SYSTEM_MEMBER = '__系統__';
  const MEMBER_KEY = `trip_money_member_${ROOM_CODE}`;
  const FX_CACHE_KEY = 'trip_money_jpy_twd_rate_v1';
  const FX_API_URL = 'https://open.er-api.com/v6/latest/JPY';

  let host = null;
  let ledger = null;
  let poller = null;
  let currentName = localStorage.getItem(MEMBER_KEY) || '';
  let itemFilter = 'mine';
  let fxRequest = null;
  let fx = {rate:null, updatedAt:null, nextUpdate:null, status:'idle', cached:false};

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const integer = value => new Intl.NumberFormat('zh-TW', {maximumFractionDigits:0}).format(Number(value) || 0);
  const money = (value, currency = 'JPY') => `${currency==='TWD'?'NT$':'¥'}${integer(value)}`;
  const rateText = value => Number(value).toLocaleString('zh-TW', {minimumFractionDigits:4,maximumFractionDigits:6});
  const currencyOf = note => /^\[(JPY|TWD)\]/.exec(String(note || ''))?.[1] || 'TWD';
  const fxRateOf = note => {
    const value = Number(/\[FX:([0-9.]+)\]/.exec(String(note || ''))?.[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  const expenseIdOf = debt => /\[EXP:([^\]]+)\]/.exec(String(debt.note || ''))?.[1] || `legacy-${debt.creditorIndex}-${currencyOf(debt.note)}-${String(debt.note || '')}`;
  const totalOf = note => {
    const tagged = Number(/\[TOTAL:([0-9]+)\]/.exec(String(note || ''))?.[1]);
    if (Number.isFinite(tagged) && tagged > 0) return tagged;
    const legacy = /(?:^|·)\s*總額\s*[^0-9]*([0-9][0-9,]*)/.exec(String(note || ''));
    return legacy ? Number(legacy[1].replace(/,/g,'')) : 0;
  };
  const visibleNote = note => String(note || '旅費').replace(/^\[(JPY|TWD)\](?:\[(?:EXP|FX|TOTAL):[^\]]+\])*\s*/, '');
  const twdValue = (amount, rate) => Math.round((Number(amount) || 0) * (Number(rate) || 0));
  const sameName = (a,b) => String(a || '').trim().toLocaleLowerCase('zh-TW') === String(b || '').trim().toLocaleLowerCase('zh-TW');

  async function rpc(name, args) {
    const response = await fetch(`${API_URL}/rest/v1/rpc/${name}`, {
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:API_KEY},
      body:JSON.stringify(args)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data.message || data.error || '帳本連線失敗').replace('邀請碼或密碼不正確','目前無法開啟共同帳本'));
    return data;
  }

  function setMessage(text, error = false) {
    const output = host?.querySelector('.money-message');
    if (!output) return;
    output.textContent = text;
    output.classList.toggle('is-error', error);
  }

  function people() {
    return (ledger?.room?.members || []).map((name,index)=>({name,index})).filter(person=>person.name !== SYSTEM_MEMBER);
  }

  function currentPerson() {
    const person = people().find(item=>sameName(item.name,currentName));
    if (!person && currentName) {
      currentName = '';
      localStorage.removeItem(MEMBER_KEY);
    }
    return person || null;
  }

  function rememberPerson(name) {
    currentName = String(name || '').trim();
    if (currentName) localStorage.setItem(MEMBER_KEY,currentName);
    else localStorage.removeItem(MEMBER_KEY);
  }

  function loadingMarkup(error = '') {
    return `<section class="money-card money-welcome"><span class="money-seal">旅費</span><div><h2>${error?'共同帳本暫時連不上':'正在開啟共同帳本'}</h2><p>${error?esc(error):'請稍候，正在同步同行名單與分帳紀錄。'}</p>${error?'<button class="money-primary money-retry" data-money-action="retry">再試一次</button>':''}</div></section><p class="money-message ${error?'is-error':''}" role="status">${esc(error)}</p>`;
  }

  function signInMarkup() {
    const members = people();
    return `<section class="money-card money-signin">
      <span class="money-kicker">WHO ARE YOU?</span>
      <h2>選擇你的姓名</h2>
      <p>不需要邀請碼。選好後，這台裝置會記住你，並顯示「我的項目」。</p>
      ${members.length?`<div class="money-person-picker" role="list" aria-label="選擇同行者">${members.map(person=>`<button type="button" data-money-action="sign-in" data-name="${esc(person.name)}">${esc(person.name)}</button>`).join('')}</div>`:'<div class="money-empty"><strong>還沒有同行者</strong><p>請先在下方加入第一個姓名。</p></div>'}
      <form class="money-add-person" data-money-form="member"><label><span class="sr-only">新增姓名</span><input name="name" maxlength="12" autocomplete="name" placeholder="輸入新姓名" required></label><button class="money-primary">＋ 新增並登入</button></form>
    </section><p class="money-message" role="status">請選擇姓名</p>`;
  }

  function settlements() {
    const members = ledger.room.members || [];
    const result = [];
    ['JPY','TWD'].forEach(currency => {
      const balances = members.map(()=>0);
      (ledger.debts || []).filter(debt=>!debt.settled && currencyOf(debt.note)===currency).forEach(debt=>{
        if (balances[debt.debtorIndex] === undefined || balances[debt.creditorIndex] === undefined) return;
        balances[debt.debtorIndex] -= Number(debt.amount) || 0;
        balances[debt.creditorIndex] += Number(debt.amount) || 0;
      });
      const owe = balances.map((amount,index)=>({index,amount:-amount})).filter(item=>item.amount>0);
      const receive = balances.map((amount,index)=>({index,amount})).filter(item=>item.amount>0);
      let i=0,j=0;
      while(i<owe.length && j<receive.length) {
        const amount=Math.min(owe[i].amount,receive[j].amount);
        result.push({from:owe[i].index,to:receive[j].index,amount,currency});
        owe[i].amount-=amount;
        receive[j].amount-=amount;
        if(!owe[i].amount) i++;
        if(!receive[j].amount) j++;
      }
    });
    return result;
  }

  function twdSettlements() {
    const members=ledger.room.members||[],balances=members.map(()=>0);
    let missingRate=false;
    (ledger.debts||[]).filter(debt=>!debt.settled).forEach(debt=>{
      let amount=Number(debt.amount)||0;
      if(currencyOf(debt.note)==='JPY'){
        const rate=fxRateOf(debt.note);
        if(!rate){missingRate=true;return;}
        amount=twdValue(amount,rate);
      }
      if(balances[debt.debtorIndex]===undefined||balances[debt.creditorIndex]===undefined)return;
      balances[debt.debtorIndex]-=amount;
      balances[debt.creditorIndex]+=amount;
    });
    const owe=balances.map((amount,index)=>({index,amount:-amount})).filter(item=>item.amount>0);
    const receive=balances.map((amount,index)=>({index,amount})).filter(item=>item.amount>0);
    const items=[];
    let i=0,j=0;
    while(i<owe.length&&j<receive.length){
      const amount=Math.min(owe[i].amount,receive[j].amount);
      items.push({from:owe[i].index,to:receive[j].index,amount,currency:'TWD'});
      owe[i].amount-=amount;
      receive[j].amount-=amount;
      if(!owe[i].amount)i++;
      if(!receive[j].amount)j++;
    }
    return{items,missingRate};
  }

  function expenseGroups() {
    const groups = new Map();
    (ledger.debts || []).forEach(debt=>{
      const id = expenseIdOf(debt);
      if (!groups.has(id)) {
        const visible = visibleNote(debt.note);
        const parts = visible.split(' · ');
        groups.set(id,{
          id,
          currency:currencyOf(debt.note),
          rate:fxRateOf(debt.note),
          total:totalOf(debt.note),
          title:parts.shift() || '共同花費',
          detail:parts.filter(part=>!/^總額\s/.test(part)&&!/^匯率\s/.test(part)&&!/^約\s*NT\$/.test(part)).join(' · '),
          payerIndex:Number(debt.creditorIndex),
          debts:[]
        });
      }
      groups.get(id).debts.push(debt);
    });
    return [...groups.values()].map(group=>{
      if (!group.total) group.total=group.debts.reduce((sum,debt)=>sum+(Number(debt.amount)||0),0);
      group.settled=group.debts.every(debt=>debt.settled);
      group.memberIndexes=[...new Set([group.payerIndex,...group.debts.map(debt=>Number(debt.debtorIndex))])];
      return group;
    }).reverse();
  }

  function fxStatusMarkup() {
    const source = '<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">ExchangeRate-API</a>';
    if (fx.status === 'loading') return `正在取得當日參考匯率 · ${source}`;
    if (fx.rate) {
      const date = fx.updatedAt ? new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(fx.updatedAt*1000)) : '最近更新';
      return `${fx.cached?'已儲存的':'當日'}參考匯率：1 JPY ≈ NT$${rateText(fx.rate)} · ${date} · ${source}`;
    }
    if (fx.status === 'error') return `目前無法取得自動匯率，可直接手動輸入 · ${source}`;
    return `將自動取得當日參考匯率，也可以改成實際刷卡／換匯匯率 · ${source}`;
  }

  function expenseForm(current) {
    const members=people();
    if(!members.length) return '<section class="money-card money-empty money-no-people"><strong>先新增同行者姓名</strong><p>名單中有人之後，就可以開始記錄誰先付款、大家各自分擔多少。</p></section>';
    return `<details class="money-card expense-editor"><summary>＋ 新增一筆共同花費</summary><form data-money-form="expense">
      <div class="money-grid-two"><label>項目<input name="title" maxlength="80" placeholder="例如：晚餐、計程車、住宿" required></label><label>幣別<select name="currency"><option value="JPY">JPY 日圓</option><option value="TWD">TWD 台幣</option></select></label></div>
      <div class="money-grid-two"><label>誰先付款<select name="payer">${members.map(person=>`<option value="${person.index}" ${person.index===current.index?'selected':''}>${esc(person.name)}</option>`).join('')}</select></label><label>總金額<input name="total" type="number" min="1" step="1" inputmode="numeric" placeholder="例如 12000" required></label></div>
      <section class="money-fx-panel">
        <div class="money-fx-grid"><label>日圓換台幣匯率（1 JPY）<input name="fxRate" type="number" min="0.000001" step="0.000001" inputmode="decimal" value="${fx.rate?fx.rate.toFixed(6):''}" placeholder="例如 0.205207" required></label><button type="button" data-money-action="refresh-rate">更新當日匯率</button></div>
        <p class="money-fx-status">${fxStatusMarkup()}</p>
      </section>
      <fieldset><legend>哪些人一起分擔</legend><div class="money-checks">${members.map(person=>`<label><input type="checkbox" name="participant" value="${person.index}" checked><span>${esc(person.name)}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>分擔方式</legend><div class="money-modes"><label><input type="radio" name="mode" value="equal" checked> 平均分攤</label><label><input type="radio" name="mode" value="custom"> 自訂每人金額</label></div></fieldset>
      <div class="money-custom" hidden>${members.map(person=>`<label data-share-row="${person.index}"><span>${esc(person.name)}</span><input name="share-${person.index}" type="number" min="0" step="1" inputmode="numeric" value="0"></label>`).join('')}</div>
      <div class="money-split-preview">填入總金額後，這裡會顯示每人應分擔的金額。</div><label>備註<textarea name="note" maxlength="120" placeholder="選填，例如：Day 5 淺草午餐"></textarea></label>
      <div class="money-form-actions"><button type="button" data-money-action="cancel-expense">取消</button><button class="money-primary">儲存分帳</button></div>
    </form></details>`;
  }

  function memberListMarkup(current) {
    const members=people();
    return `<section class="money-card money-members"><div class="money-section-head"><div><span class="money-kicker">TRAVELERS</span><h3>同行者名單（共 ${members.length} 人）</h3></div><button data-money-action="refresh">同步</button></div>
      <form class="money-add-person" data-money-form="member"><label><span class="sr-only">新增姓名</span><input name="name" maxlength="12" autocomplete="name" placeholder="輸入新姓名" required></label><button class="money-primary">＋ 新增姓名</button></form>
      <div class="money-member-list">${members.map(person=>`<div class="money-member-item"><span>${esc(person.name)}${person.index===current.index?'<b>我</b>':''}</span><button type="button" class="money-member-remove" data-money-action="delete-member" data-member-index="${person.index}" aria-label="刪除成員 ${esc(person.name)}">刪除</button></div>`).join('')}</div>
      <p>只能刪除尚未有任何分帳或行程紀錄的成員；刪除時會要求管理密碼。</p>
    </section>`;
  }

  function expenseListMarkup(groups, current, allMembers) {
    const mine=groups.filter(group=>group.memberIndexes.includes(current.index));
    const shown=itemFilter==='mine'?mine:groups;
    return `<section class="money-records">
      <div class="money-section-head"><div><span class="money-kicker">EXPENSES</span><h3>已登錄項目</h3></div><span class="money-count">${groups.length} 項</span></div>
      <div class="money-view-tabs" role="group" aria-label="篩選分帳項目"><button type="button" data-money-action="filter-items" data-filter="mine" aria-pressed="${itemFilter==='mine'}">我的項目（${mine.length}）</button><button type="button" data-money-action="filter-items" data-filter="all" aria-pressed="${itemFilter==='all'}">全部項目（${groups.length}）</button></div>
      ${shown.length?`<div class="money-expense-list">${shown.map(group=>{
        const payer=allMembers[group.payerIndex]||'成員';
        const converted=group.currency==='JPY'&&group.rate?money(twdValue(group.total,group.rate),'TWD'):'';
        return `<article class="money-expense ${group.settled?'is-paid':''}">
          <header class="money-expense-head"><div><span>${group.settled?'已結清':'待付款'}</span><h4>${esc(group.title)}</h4></div><div><strong>${money(group.total,group.currency)}</strong>${converted?`<small>約 ${converted}</small>`:''}</div></header>
          <p class="money-expense-meta">${esc(payer)} 先付款${group.currency==='JPY'&&group.rate?` · 匯率 ${rateText(group.rate)}`:''}</p>
          ${group.detail?`<p class="money-expense-note">${esc(group.detail)}</p>`:''}
          <div class="money-share-list">${group.debts.map(debt=>{
            const debtor=allMembers[debt.debtorIndex]||'成員';
            const approx=group.currency==='JPY'&&group.rate?money(twdValue(debt.amount,group.rate),'TWD'):'';
            return `<div class="money-share-row ${debt.settled?'is-paid':''}"><label><input type="checkbox" data-money-action="toggle" data-id="${esc(debt.id)}" ${debt.settled?'checked':''}><span>${debt.settled?'已付':'待付'}</span></label><p><strong>${esc(debtor)}</strong> 付給 ${esc(payer)}</p><b>${money(debt.amount,group.currency)}${approx?`<small>約 ${approx}</small>`:''}</b><button type="button" class="money-delete" data-money-action="delete" data-id="${esc(debt.id)}" aria-label="刪除 ${esc(debtor)} 的這筆分帳">刪除</button></div>`;
          }).join('')}</div>
        </article>`;
      }).join('')}</div>`:`<div class="money-empty"><strong>${itemFilter==='mine'?'目前沒有你的分帳項目':'目前還沒有分帳項目'}</strong><p>${itemFilter==='mine'&&groups.length?'可切換到「全部項目」查看其他人的紀錄。':'新增共同花費後，會在這裡顯示完整項目與每人的分擔金額。'}</p></div>`}
    </section>`;
  }

  function ledgerMarkup() {
    const current=currentPerson();
    if(!current) return signInMarkup();
    const allMembers=ledger.room.members || [], debts=ledger.debts || [], groups=expenseGroups(), convertedSettlement=twdSettlements();
    const transfers=convertedSettlement.missingRate?settlements():convertedSettlement.items;
    const outstanding=debts.filter(debt=>!debt.settled).reduce((totals,debt)=>{const currency=currencyOf(debt.note);totals[currency]+=Number(debt.amount)||0;return totals;},{JPY:0,TWD:0});
    const totals=groups.reduce((sum,group)=>{sum[group.currency]+=Number(group.total)||0;if(group.currency==='JPY'&&group.rate)sum.converted+=twdValue(group.total,group.rate);return sum;},{JPY:0,TWD:0,converted:0});
    return `<div class="money-ledger">
      <section class="money-card money-identity"><div><span class="money-kicker">SIGNED IN</span><h2>目前登入：${esc(current.name)}</h2><p>這個姓名只記在此裝置，用來顯示你的項目與預選付款人。</p></div><button type="button" data-money-action="switch-person">切換姓名</button></section>
      <div class="money-stats">
        <div><span>同行成員</span><strong>${people().length} 人</strong></div>
        <div><span>已登錄項目</span><strong>${groups.length} 項</strong></div>
        <div><span>全部總額</span><strong>${money(totals.JPY,'JPY')}</strong><small>台幣支出 ${money(totals.TWD,'TWD')}${totals.converted?` · 換算合計 ${money(totals.TWD+totals.converted,'TWD')}`:''}</small></div>
        <div><span>未結清代墊</span><strong>${money(outstanding.JPY,'JPY')}</strong><small>${money(outstanding.TWD,'TWD')}</small></div>
      </div>
      <p class="money-rate-note">日圓換算使用每日參考匯率，實際刷卡或換匯時可自行修改。資料來源：<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">ExchangeRate-API</a></p>
      ${expenseForm(current)}
      ${expenseListMarkup(groups,current,allMembers)}
      <section class="money-card money-settlement"><div class="money-section-head"><div><span class="money-kicker">SETTLEMENT</span><h3>目前誰該付誰${convertedSettlement.missingRate?'（分幣別）':'（台幣結算）'}</h3></div></div>${transfers.length?`<div class="money-transfers">${transfers.map(item=>`<div><strong>${esc(allMembers[item.from]||'成員')}</strong><span>付給</span><strong>${esc(allMembers[item.to]||'成員')}</strong><b>${money(item.amount,item.currency)}</b></div>`).join('')}</div>`:'<div class="money-clear">✓ 目前沒有未結清款項</div>'}<p class="money-settlement-note">${convertedSettlement.missingRate?'部分舊日圓紀錄沒有保存匯率，因此暫時分幣別顯示。':'日圓款項依各筆儲存的匯率換算，再與台幣款項合併結算。'}</p></section>
      ${memberListMarkup(current)}
      <p class="money-message" role="status">資料已同步</p>
    </div>`;
  }

  function renderLedger(){if(host&&ledger)host.innerHTML=ledgerMarkup();}

  function selectedShares(form, strict=false) {
    const total=Math.round(Number(form.elements.total.value)||0);
    const selected=[...form.querySelectorAll('[name="participant"]:checked')].map(input=>Number(input.value));
    if(!selected.length||total<1)return{total,selected,shares:[]};
    if(form.elements.mode.value==='equal'){
      const base=Math.floor(total/selected.length),remainder=total%selected.length;
      return{total,selected,shares:selected.map((index,position)=>({index,amount:base+(position<remainder?1:0)}))};
    }
    const shares=selected.map(index=>({index,amount:Math.round(Number(form.elements[`share-${index}`].value)||0)}));
    if(strict&&shares.reduce((sum,item)=>sum+item.amount,0)!==total)throw new Error('自訂金額加總必須等於總金額');
    return{total,selected,shares};
  }

  function updateSplitPreview(form){
    const custom=form.elements.mode.value==='custom';
    const currency=form.elements.currency.value;
    const rate=currency==='JPY'?Number(form.elements.fxRate.value)||0:0;
    const fxPanel=form.querySelector('.money-fx-panel');
    fxPanel.hidden=currency!=='JPY';
    form.elements.fxRate.required=currency==='JPY';
    form.querySelector('.money-custom').hidden=!custom;
    form.querySelectorAll('[data-share-row]').forEach(row=>{
      const picked=form.querySelector(`[name="participant"][value="${row.dataset.shareRow}"]`)?.checked;
      row.hidden=!picked;
      row.querySelector('input').disabled=!custom||!picked;
    });
    const{shares,total}=selectedShares(form),members=ledger.room.members||[];
    form.querySelector('.money-split-preview').innerHTML=shares.length?`<strong>總額 ${money(total,currency)}${currency==='JPY'&&rate?`（約 ${money(twdValue(total,rate),'TWD')}）`:''}</strong>${shares.map(item=>`<span>${esc(members[item.index])}<b>${money(item.amount,currency)}${currency==='JPY'&&rate?`<small>約 ${money(twdValue(item.amount,rate),'TWD')}</small>`:''}</b></span>`).join('')}`:'請輸入總金額並至少選擇一位分擔者。';
  }

  function updateFxControls() {
    if(!host)return;
    host.querySelectorAll('[data-money-form="expense"]').forEach(form=>{
      const status=form.querySelector('.money-fx-status');
      if(status)status.innerHTML=fxStatusMarkup();
      const input=form.elements.fxRate;
      if(input&&fx.rate&&!input.dataset.manual)input.value=fx.rate.toFixed(6);
      updateSplitPreview(form);
    });
  }

  function cachedFx() {
    try {
      const value=JSON.parse(localStorage.getItem(FX_CACHE_KEY)||'null');
      if(!value||!Number.isFinite(Number(value.rate))||Number(value.rate)<=0)return null;
      return value;
    } catch { return null; }
  }

  async function loadFxRate(force=false) {
    const saved=cachedFx(), now=Date.now();
    if(saved){
      fx={rate:Number(saved.rate),updatedAt:Number(saved.updatedAt)||null,nextUpdate:Number(saved.nextUpdate)||null,status:'ready',cached:true};
      updateFxControls();
      if(!force&&now-(Number(saved.fetchedAt)||0)<24*60*60*1000)return fx.rate;
    }
    if(fxRequest&&!force)return fxRequest;
    fx.status='loading';
    updateFxControls();
    fxRequest=fetch(FX_API_URL,{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('匯率服務暫時無法使用');
      const data=await response.json(),rate=Number(data?.rates?.TWD);
      if(data?.result!=='success'||!Number.isFinite(rate)||rate<=0)throw new Error('匯率資料格式不正確');
      fx={rate,updatedAt:Number(data.time_last_update_unix)||null,nextUpdate:Number(data.time_next_update_unix)||null,status:'ready',cached:false};
      localStorage.setItem(FX_CACHE_KEY,JSON.stringify({...fx,fetchedAt:Date.now()}));
      return rate;
    }).catch(error=>{
      if(saved){
        fx={rate:Number(saved.rate),updatedAt:Number(saved.updatedAt)||null,nextUpdate:Number(saved.nextUpdate)||null,status:'ready',cached:true};
        return fx.rate;
      }
      fx={rate:null,updatedAt:null,nextUpdate:null,status:'error',cached:false};
      throw error;
    }).finally(()=>{fxRequest=null;updateFxControls();});
    return fxRequest;
  }

  async function loadLedger(showNotice=false){
    ledger=await rpc('get_ticket_room',{p_code:ROOM_CODE,p_pin:PIN});
    renderLedger();
    if(showNotice)setMessage('已同步最新分帳資料');
  }

  function startPolling(){
    clearInterval(poller);
    poller=setInterval(async()=>{
      if(!host?.isConnected||host.querySelector('.expense-editor[open]')||host.querySelector('[data-money-form="member"]:focus-within'))return;
      try{await loadLedger();}catch{}
    },15000);
  }

  async function handleSubmit(event){
    const form=event.target.closest('[data-money-form]');
    if(!form)return;
    event.preventDefault();
    const submit=form.querySelector('button:not([type="button"])');
    if(submit)submit.disabled=true;
    try{
      if(form.dataset.moneyForm==='member'){
        const name=form.elements.name.value.trim();
        if(!name||name===SYSTEM_MEMBER)throw new Error('請輸入正確姓名');
        if(people().some(person=>sameName(person.name,name))){
          rememberPerson(people().find(person=>sameName(person.name,name)).name);
          renderLedger();
          setMessage(`已登入「${currentName}」`);
        }else{
          ledger=await rpc('join_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_name:name});
          rememberPerson(name);
          renderLedger();
          setMessage(`已新增並登入「${name}」`);
        }
      }else if(form.dataset.moneyForm==='expense'){
        const payer=Number(form.elements.payer.value),{total,shares}=selectedShares(form,true);
        if(!shares.length)throw new Error('請至少選擇一位分擔者');
        const currency=form.elements.currency.value,title=form.elements.title.value.trim(),extra=form.elements.note.value.trim();
        const rate=currency==='JPY'?Number(form.elements.fxRate.value):null;
        if(currency==='JPY'&&(!Number.isFinite(rate)||rate<=0))throw new Error('請輸入有效的日圓換台幣匯率');
        const debtShares=shares.filter(item=>item.index!==payer&&item.amount>0);
        if(!debtShares.length)throw new Error('目前沒有其他人需要分擔，請再確認付款人與成員');
        const expenseId=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
        const metadata=`[${currency}][EXP:${expenseId}]${currency==='JPY'?`[FX:${rate.toFixed(6)}]`:''}[TOTAL:${total}]`;
        const converted=currency==='JPY'?` · 約 ${money(twdValue(total,rate),'TWD')}`:'';
        const note=`${metadata} ${title} · 總額 ${money(total,currency)}${currency==='JPY'?` · 匯率 ${rateText(rate)}${converted}`:''}${extra?' · '+extra:''}`.slice(0,280);
        for(const share of debtShares)ledger=await rpc('save_ticket_debt_v2',{p_code:ROOM_CODE,p_pin:PIN,p_payload:{debtorIndex:share.index,creditorIndex:payer,amount:share.amount,eventId:null,note}});
        renderLedger();
        setMessage('分帳已儲存，已保留這筆消費使用的匯率');
      }
    }catch(error){
      setMessage(error.message||'無法儲存，請稍後再試',true);
    }finally{
      if(submit?.isConnected)submit.disabled=false;
    }
  }

  function personHasRecords(index) {
    const debts=(ledger.debts||[]).some(debt=>Number(debt.debtorIndex)===index||Number(debt.creditorIndex)===index);
    const events=(ledger.events||[]).some(event=>(event.assignees||[]).map(Number).includes(index));
    return debts||events;
  }

  async function handleClick(event){
    const button=event.target.closest('[data-money-action]');
    if(!button)return;
    const action=button.dataset.moneyAction;
    try{
      if(action==='retry'){
        host.innerHTML=loadingMarkup();
        await loadLedger();
        startPolling();
        loadFxRate().catch(()=>{});
      }else if(action==='sign-in'){
        rememberPerson(button.dataset.name);
        itemFilter='mine';
        renderLedger();
        setMessage(`已登入「${currentName}」`);
      }else if(action==='switch-person'){
        rememberPerson('');
        itemFilter='mine';
        renderLedger();
      }else if(action==='filter-items'){
        itemFilter=button.dataset.filter==='all'?'all':'mine';
        renderLedger();
      }else if(action==='cancel-expense'){
        button.closest('details').open=false;
      }else if(action==='refresh'){
        button.disabled=true;
        await loadLedger(true);
      }else if(action==='refresh-rate'){
        button.disabled=true;
        const form=button.closest('form');
        if(form?.elements.fxRate)delete form.elements.fxRate.dataset.manual;
        await loadFxRate(true);
        setMessage(fx.cached?'目前無法連線，已套用先前儲存的匯率':'已更新當日參考匯率');
      }else if(action==='delete'){
        if(!confirm('確定刪除這筆分帳紀錄？'))return;
        ledger=await rpc('mutate_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_action:'delete_debt',p_payload:{id:button.dataset.id}});
        renderLedger();
        setMessage('分帳紀錄已刪除');
      }else if(action==='delete-member'){
        const index=Number(button.dataset.memberIndex),person=people().find(item=>item.index===index);
        if(!person)throw new Error('找不到這位同行者');
        if(people().length<=1)throw new Error('名單至少要保留一位同行者');
        if(personHasRecords(index))throw new Error(`「${person.name}」已有分帳或行程紀錄，請先處理相關紀錄後再刪除`);
        if(!confirm(`確定刪除同行者「${person.name}」？`))return;
        const password=prompt('為避免誤刪，請輸入共同帳本的管理密碼（不是邀請碼）');
        if(password===null)return;
        button.disabled=true;
        ledger=await rpc('remove_ticket_member',{p_code:ROOM_CODE,p_pin:PIN,p_admin_password:password,p_member_index:index});
        if(sameName(currentName,person.name))rememberPerson('');
        renderLedger();
        setMessage(`已刪除「${person.name}」`);
      }
    }catch(error){
      setMessage(error.message||'操作失敗，請稍後再試',true);
    }finally{
      if(button?.isConnected)button.disabled=false;
    }
  }

  async function handleChange(event){
    const form=event.target.closest('[data-money-form="expense"]');
    if(form&&event.target.matches('[name="total"],[name="currency"],[name="mode"],[name="participant"],[name^="share-"],[name="fxRate"]')){
      if(event.target.name==='fxRate')event.target.dataset.manual='1';
      updateSplitPreview(form);
    }
    if(event.target.dataset.moneyAction==='toggle'){
      try{
        ledger=await rpc('mutate_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_action:'toggle_debt',p_payload:{id:event.target.dataset.id,settled:event.target.checked}});
        renderLedger();
        setMessage(event.target.checked?'已標記為付清':'已改為待付款');
      }catch(error){
        event.target.checked=!event.target.checked;
        setMessage(error.message||'無法更新',true);
      }
    }
  }

  function handleInput(event){
    const form=event.target.closest('[data-money-form="expense"]');
    if(!form)return;
    if(event.target.name==='fxRate')event.target.dataset.manual='1';
    if(event.target.matches('[name="total"],[name="fxRate"],[name^="share-"]'))updateSplitPreview(form);
  }

  async function mount(target){
    unmount();
    host=target;
    host.addEventListener('submit',handleSubmit);
    host.addEventListener('click',handleClick);
    host.addEventListener('change',handleChange);
    host.addEventListener('input',handleInput);
    host.innerHTML=loadingMarkup();
    try{
      await loadLedger();
      startPolling();
      loadFxRate().catch(()=>{});
    }catch(error){
      host.innerHTML=loadingMarkup(error.message||'請檢查網路後再試');
    }
  }

  function unmount(){
    clearInterval(poller);
    poller=null;
    if(host){
      host.removeEventListener('submit',handleSubmit);
      host.removeEventListener('click',handleClick);
      host.removeEventListener('change',handleChange);
      host.removeEventListener('input',handleInput);
    }
    host=null;
  }

  window.TripMoney={mount,unmount};
})();
