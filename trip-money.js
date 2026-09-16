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
  let editingExpenseId = '';
  let settlementVisible = false;
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
      <p>不需要邀請碼。選好後，這台裝置會記住你，並預選為新增花費的付款人。</p>
      ${members.length?`<div class="money-person-picker" role="list" aria-label="選擇同行者">${members.map(person=>`<button type="button" data-money-action="sign-in" data-name="${esc(person.name)}">${esc(person.name)}</button>`).join('')}</div>`:'<div class="money-empty"><strong>還沒有同行者</strong><p>請先在下方加入第一個姓名。</p></div>'}
      <form class="money-add-person" data-money-form="member"><label><span class="sr-only">新增姓名</span><input name="name" maxlength="12" autocomplete="name" placeholder="輸入新姓名" required></label><button class="money-primary">＋ 新增並登入</button></form>
    </section><p class="money-message" role="status">請選擇姓名</p>`;
  }

  function settlements() {
    const members = ledger.room.members || [];
    const result = [];
    ['JPY','TWD'].forEach(currency => {
      const balances = members.map(()=>0);
      (ledger.debts || []).filter(debt=>currencyOf(debt.note)===currency).forEach(debt=>{
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
    (ledger.debts||[]).forEach(debt=>{
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

  function groupShareMap(group) {
    const shares=new Map();
    group.debts.forEach(debt=>{
      const index=Number(debt.debtorIndex),amount=Number(debt.amount)||0;
      shares.set(index,(shares.get(index)||0)+amount);
    });
    const payerShare=Math.max(0,(Number(group.total)||0)-[...shares.values()].reduce((sum,amount)=>sum+amount,0));
    if(payerShare>0)shares.set(group.payerIndex,(shares.get(group.payerIndex)||0)+payerShare);
    return shares;
  }

  function expenseForm(current, groups) {
    const members=people(),editing=groups.find(group=>group.id===editingExpenseId)||null;
    if(!members.length) return '<section class="money-card money-empty money-no-people"><strong>先新增同行者姓名</strong><p>名單中有人之後，就可以開始記錄誰先付款、大家各自分擔多少。</p></section>';
    const shareMap=editing?groupShareMap(editing):new Map();
    const currency=editing?.currency||'JPY',payerIndex=editing?.payerIndex??current.index;
    const rate=editing?.rate||fx.rate||null;
    return `<details class="money-card expense-editor" ${editing?'open':''}><summary>${editing?`✎ 編輯「${esc(editing.title)}」`:'＋ 新增一筆共同花費'}</summary><form data-money-form="expense"${editing?` data-expense-id="${esc(editing.id)}"`:''}>
      <div class="money-grid-two"><label>項目<input name="title" maxlength="80" value="${editing?esc(editing.title):''}" placeholder="例如：晚餐、計程車、住宿" required></label><label>幣別<select name="currency"><option value="JPY" ${currency==='JPY'?'selected':''}>JPY 日圓</option><option value="TWD" ${currency==='TWD'?'selected':''}>TWD 台幣</option></select></label></div>
      <div class="money-grid-two"><label>誰先付款<select name="payer">${members.map(person=>`<option value="${person.index}" ${person.index===payerIndex?'selected':''}>${esc(person.name)}</option>`).join('')}</select></label><label>總金額<input name="total" type="number" min="1" step="1" inputmode="numeric" value="${editing?editing.total:''}" placeholder="例如 12000" required></label></div>
      <section class="money-fx-panel" ${currency==='TWD'?'hidden':''}>
        <div class="money-fx-grid"><label>日圓換台幣匯率（1 JPY）<input name="fxRate" type="number" min="0.000001" step="0.000001" inputmode="decimal" value="${rate?Number(rate).toFixed(6):''}" placeholder="例如 0.205207" ${editing&&editing.rate?'data-manual="1"':''} ${currency==='JPY'?'required':''}></label><button type="button" data-money-action="refresh-rate">更新當日匯率</button></div>
        <p class="money-fx-status">${fxStatusMarkup()}</p>
      </section>
      <fieldset><legend>哪些人一起分擔</legend><div class="money-checks">${members.map(person=>`<label><input type="checkbox" name="participant" value="${person.index}" ${editing?(shareMap.has(person.index)?'checked':''):'checked'}><span>${esc(person.name)}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>分擔方式</legend><div class="money-modes"><label><input type="radio" name="mode" value="equal" ${editing?'':'checked'}> 平均分攤</label><label><input type="radio" name="mode" value="custom" ${editing?'checked':''}> 自訂每人金額</label></div></fieldset>
      <div class="money-custom" ${editing?'':'hidden'}>${members.map(person=>`<label data-share-row="${person.index}"><span>${esc(person.name)}</span><input name="share-${person.index}" type="number" min="0" step="1" inputmode="numeric" value="${shareMap.get(person.index)||0}"></label>`).join('')}</div>
      <div class="money-split-preview">填入總金額後，這裡會顯示每人應分擔的金額。</div><label>備註<textarea name="note" maxlength="120" placeholder="選填，例如：Day 5 淺草午餐">${editing?esc(editing.detail):''}</textarea></label>
      <div class="money-form-actions"><button type="button" data-money-action="cancel-expense">${editing?'取消編輯':'取消'}</button><button class="money-primary">${editing?'儲存修改':'儲存分帳'}</button></div>
    </form></details>`;
  }

  function memberListMarkup(current) {
    const members=people();
    return `<section class="money-card money-members"><div class="money-member-head"><div><span class="money-kicker">TRAVELERS</span><h2>同行者名單（共 ${members.length} 人）</h2><p>目前使用：<strong>${esc(current.name)}</strong></p></div><div class="money-member-tools"><button type="button" data-money-action="switch-person">切換姓名</button><button type="button" data-money-action="refresh">同步</button></div></div>
      <form class="money-add-person" data-money-form="member"><label><span class="sr-only">新增姓名</span><input name="name" maxlength="12" autocomplete="name" placeholder="輸入新姓名" required></label><button class="money-primary">＋ 新增姓名</button></form>
      <div class="money-member-list">${members.map(person=>`<div class="money-member-item"><span>${esc(person.name)}${person.index===current.index?'<b>目前使用</b>':''}</span><button type="button" class="money-member-remove" data-money-action="delete-member" data-member-index="${person.index}" aria-label="刪除成員 ${esc(person.name)}">刪除</button></div>`).join('')}</div>
      <p>只能刪除尚未有任何分帳或行程紀錄的成員；刪除時會要求管理密碼。</p>
    </section>`;
  }

  function expenseListMarkup(groups, allMembers) {
    return `<section class="money-records">
      <div class="money-section-head"><div><span class="money-kicker">ALL EXPENSES</span><h3>全部項目</h3></div><span class="money-count">${groups.length} 項</span></div>
      ${groups.length?`<div class="money-expense-list">${groups.map(group=>{
        const payer=allMembers[group.payerIndex]||'成員',shares=groupShareMap(group);
        const converted=group.currency==='JPY'&&group.rate?money(twdValue(group.total,group.rate),'TWD'):'';
        return `<article class="money-expense">
          <header class="money-expense-head"><div><h4>${esc(group.title)}</h4><span>${esc(payer)} 先付款</span></div><div><strong>${money(group.total,group.currency)}</strong>${converted?`<small>約 ${converted}</small>`:''}</div></header>
          <p class="money-expense-meta">${group.currency==='JPY'&&group.rate?`使用匯率 ${rateText(group.rate)}`:'台幣項目'}</p>
          ${group.detail?`<p class="money-expense-note">${esc(group.detail)}</p>`:''}
          <div class="money-expense-actions"><button type="button" data-money-action="edit-expense" data-expense-id="${esc(group.id)}">編輯</button><button type="button" class="money-delete" data-money-action="delete-expense" data-expense-id="${esc(group.id)}">刪除項目</button></div>
          <div class="money-share-list">${[...shares.entries()].map(([index,amount])=>{
            const participant=allMembers[index]||'成員';
            const approx=group.currency==='JPY'&&group.rate?money(twdValue(amount,group.rate),'TWD'):'';
            return `<div class="money-share-row"><p><strong>${esc(participant)}</strong><span>分擔</span></p><b>${money(amount,group.currency)}${approx?`<small>約 ${approx}</small>`:''}</b></div>`;
          }).join('')}</div>
        </article>`;
      }).join('')}</div>`:'<div class="money-empty"><strong>目前還沒有分帳項目</strong><p>新增共同花費後，全部項目與每人的分擔金額會顯示在這裡。</p></div>'}
    </section>`;
  }

  function settlementMarkup(allMembers) {
    if(!settlementVisible) return `<section class="money-card money-settlement"><div><span class="money-kicker">SETTLEMENT</span><h3>誰付給誰</h3><p>需要結算時再按下計算，系統會把全部已登錄項目合併成最少的付款筆數。</p></div><button type="button" class="money-primary money-calculate" data-money-action="calculate-settlement" aria-expanded="false" aria-controls="money-settlement-result">計算誰付給誰</button></section>`;
    const convertedSettlement=twdSettlements(),transfers=convertedSettlement.missingRate?settlements():convertedSettlement.items;
    return `<section class="money-card money-settlement money-settlement-result" id="money-settlement-result"><div class="money-section-head"><div><span class="money-kicker">SETTLEMENT RESULT</span><h3>誰付給誰${convertedSettlement.missingRate?'（分幣別）':'（台幣結算）'}</h3></div><button type="button" data-money-action="hide-settlement">收起結果</button></div>${transfers.length?`<div class="money-transfers">${transfers.map(item=>`<div><strong>${esc(allMembers[item.from]||'成員')}</strong><span>付給</span><strong>${esc(allMembers[item.to]||'成員')}</strong><b>${money(item.amount,item.currency)}</b></div>`).join('')}</div>`:'<div class="money-clear">✓ 目前沒有需要互相付款的金額</div>'}<p class="money-settlement-note">${convertedSettlement.missingRate?'部分舊日圓紀錄沒有保存匯率，因此暫時分幣別顯示。':'日圓項目依各筆儲存的匯率換算，再與台幣項目合併計算。'}</p></section>`;
  }

  function ledgerMarkup() {
    const current=currentPerson();
    if(!current) return signInMarkup();
    const allMembers=ledger.room.members || [],groups=expenseGroups();
    const totals=groups.reduce((sum,group)=>{sum[group.currency]+=Number(group.total)||0;if(group.currency==='JPY'&&group.rate)sum.converted+=twdValue(group.total,group.rate);return sum;},{JPY:0,TWD:0,converted:0});
    return `<div class="money-ledger">
      ${memberListMarkup(current)}
      <div class="money-stats money-stats-simple">
        <div><span>已登錄項目</span><strong>${groups.length} 項</strong></div>
        <div><span>全部總額</span><strong>${money(totals.JPY,'JPY')}</strong><small>台幣支出 ${money(totals.TWD,'TWD')}${totals.converted?` · 換算合計 ${money(totals.TWD+totals.converted,'TWD')}`:''}</small></div>
      </div>
      <p class="money-rate-note">日圓換算使用每日參考匯率，實際刷卡或換匯時可自行修改。資料來源：<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">ExchangeRate-API</a></p>
      ${expenseForm(current,groups)}
      ${expenseListMarkup(groups,allMembers)}
      ${settlementMarkup(allMembers)}
      <p class="money-message" role="status">資料已同步</p>
    </div>`;
  }

  function renderLedger(){
    if(!host||!ledger)return;
    host.innerHTML=ledgerMarkup();
    host.querySelectorAll('[data-money-form="expense"]').forEach(updateSplitPreview);
  }

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

  function expenseDraft(form, expenseId) {
    const payer=Number(form.elements.payer.value),{total,shares}=selectedShares(form,true);
    if(!shares.length)throw new Error('請至少選擇一位分擔者');
    const currency=form.elements.currency.value,title=form.elements.title.value.trim(),extra=form.elements.note.value.trim();
    const rate=currency==='JPY'?Number(form.elements.fxRate.value):null;
    if(!title)throw new Error('請輸入項目名稱');
    if(currency==='JPY'&&(!Number.isFinite(rate)||rate<=0))throw new Error('請輸入有效的日圓換台幣匯率');
    const debtShares=shares.filter(item=>item.index!==payer&&item.amount>0);
    if(!debtShares.length)throw new Error('目前沒有其他人需要分擔，請再確認付款人與成員');
    const metadata=`[${currency}][EXP:${expenseId}]${currency==='JPY'?`[FX:${rate.toFixed(6)}]`:''}[TOTAL:${total}]`;
    const converted=currency==='JPY'?` · 約 ${money(twdValue(total,rate),'TWD')}`:'';
    const note=`${metadata} ${title} · 總額 ${money(total,currency)}${currency==='JPY'?` · 匯率 ${rateText(rate)}${converted}`:''}${extra?' · '+extra:''}`.slice(0,280);
    return{expenseId,payer,total,shares,debtShares,currency,title,rate,note};
  }

  async function saveExpenseRows(draft) {
    for(const share of draft.debtShares){
      ledger=await rpc('save_ticket_debt_v2',{p_code:ROOM_CODE,p_pin:PIN,p_payload:{debtorIndex:share.index,creditorIndex:draft.payer,amount:share.amount,eventId:null,note:draft.note}});
    }
  }

  async function deleteDebtRows(rows) {
    const deleted=[];
    for(const debt of rows){
      ledger=await rpc('mutate_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_action:'delete_debt',p_payload:{id:debt.id}});
      deleted.push(debt);
    }
    return deleted;
  }

  async function cleanupExpense(expenseId) {
    const rows=(ledger?.debts||[]).filter(debt=>expenseIdOf(debt)===expenseId);
    for(const debt of rows){
      try{ledger=await rpc('mutate_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_action:'delete_debt',p_payload:{id:debt.id}});}catch{}
    }
  }

  async function restoreDebtRows(rows) {
    for(const debt of rows){
      ledger=await rpc('save_ticket_debt_v2',{p_code:ROOM_CODE,p_pin:PIN,p_payload:{debtorIndex:Number(debt.debtorIndex),creditorIndex:Number(debt.creditorIndex),amount:Number(debt.amount),eventId:debt.eventId||null,note:debt.note||''}});
    }
  }

  async function replaceExpense(oldGroup, draft) {
    try{
      await saveExpenseRows(draft);
    }catch(error){
      try{await loadLedger();}catch{}
      await cleanupExpense(draft.expenseId);
      throw error;
    }
    const deleted=[];
    try{
      for(const debt of oldGroup.debts){
        ledger=await rpc('mutate_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_action:'delete_debt',p_payload:{id:debt.id}});
        deleted.push(debt);
      }
    }catch(error){
      let restored=true;
      try{await restoreDebtRows(deleted);}catch{restored=false;}
      if(restored)await cleanupExpense(draft.expenseId);
      await loadLedger();
      throw new Error(restored?'修改時連線中斷，原項目已保留，請再試一次':'修改時連線中斷，資料可能重複，請先按同步後再檢查');
    }
  }

  async function removeExpense(group) {
    const deleted=[];
    try{
      for(const debt of group.debts){
        ledger=await rpc('mutate_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_action:'delete_debt',p_payload:{id:debt.id}});
        deleted.push(debt);
      }
    }catch(error){
      try{
        await restoreDebtRows(deleted);
        await loadLedger();
        throw new Error('刪除時連線中斷，原項目已還原，請再試一次');
      }catch(restoreError){
        if(restoreError.message.startsWith('刪除時'))throw restoreError;
        await loadLedger();
        throw new Error('刪除時連線中斷，請先同步並檢查項目');
      }
    }
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
        const oldExpenseId=form.dataset.expenseId||'',oldGroup=oldExpenseId?expenseGroups().find(group=>group.id===oldExpenseId):null;
        if(oldExpenseId&&!oldGroup)throw new Error('找不到要編輯的項目，請先同步後再試');
        const newExpenseId=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
        const draft=expenseDraft(form,newExpenseId);
        if(oldGroup)await replaceExpense(oldGroup,draft);
        else{
          try{await saveExpenseRows(draft);}catch(error){try{await loadLedger();}catch{}await cleanupExpense(newExpenseId);throw error;}
        }
        editingExpenseId='';
        settlementVisible=false;
        renderLedger();
        setMessage(oldGroup?'項目已完整更新':'分帳已儲存，已保留這筆消費使用的匯率');
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
        editingExpenseId='';
        settlementVisible=false;
        renderLedger();
        setMessage(`已登入「${currentName}」`);
      }else if(action==='switch-person'){
        rememberPerson('');
        editingExpenseId='';
        settlementVisible=false;
        renderLedger();
      }else if(action==='cancel-expense'){
        if(editingExpenseId){editingExpenseId='';renderLedger();}
        else button.closest('details').open=false;
      }else if(action==='edit-expense'){
        const group=expenseGroups().find(item=>item.id===button.dataset.expenseId);
        if(!group)throw new Error('找不到這個項目，請先同步');
        editingExpenseId=group.id;
        settlementVisible=false;
        renderLedger();
        requestAnimationFrame(()=>host?.querySelector('.expense-editor')?.scrollIntoView({behavior:'smooth',block:'start'}));
      }else if(action==='delete-expense'){
        const group=expenseGroups().find(item=>item.id===button.dataset.expenseId);
        if(!group)throw new Error('找不到這個項目，請先同步');
        if(!confirm(`確定刪除「${group.title}」整筆項目？`))return;
        button.disabled=true;
        await removeExpense(group);
        if(editingExpenseId===group.id)editingExpenseId='';
        settlementVisible=false;
        renderLedger();
        setMessage('整筆項目已刪除');
      }else if(action==='calculate-settlement'){
        settlementVisible=true;
        renderLedger();
        requestAnimationFrame(()=>host?.querySelector('#money-settlement-result')?.scrollIntoView({behavior:'smooth',block:'nearest'}));
      }else if(action==='hide-settlement'){
        settlementVisible=false;
        renderLedger();
      }else if(action==='refresh'){
        button.disabled=true;
        await loadLedger(true);
      }else if(action==='refresh-rate'){
        button.disabled=true;
        const form=button.closest('form');
        if(form?.elements.fxRate)delete form.elements.fxRate.dataset.manual;
        await loadFxRate(true);
        setMessage(fx.cached?'目前無法連線，已套用先前儲存的匯率':'已更新當日參考匯率');
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
