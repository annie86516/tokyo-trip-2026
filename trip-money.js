(() => {
  'use strict';
  const API_URL = 'https://iykqldpzciqelmrjzlng.supabase.co';
  const API_KEY = 'sb_publishable_hgxM-twdEVzZRztE78Tpqw_rqMnwVL2';
  const PIN = '000000';
  const ROOM_CODE = 'D85EE3';
  const SYSTEM_MEMBER = '__系統__';
  let host = null;
  let ledger = null;
  let poller = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = (value, currency = 'JPY') => new Intl.NumberFormat('zh-TW', {style:'currency',currency,maximumFractionDigits:0}).format(Number(value) || 0);
  const currencyOf = note => /^\[(JPY|TWD)\]/.exec(String(note || ''))?.[1] || 'TWD';
  const visibleNote = note => String(note || '旅費').replace(/^\[(JPY|TWD)\]\s*/, '');

  async function rpc(name, args) {
    const response = await fetch(`${API_URL}/rest/v1/rpc/${name}`, {
      method:'POST', headers:{'Content-Type':'application/json',apikey:API_KEY}, body:JSON.stringify(args)
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

  function loadingMarkup(error = '') {
    return `<section class="money-card money-welcome"><span class="money-seal">旅費</span><div><h2>${error?'共同帳本暫時連不上':'正在開啟共同帳本'}</h2><p>${error?esc(error):'請稍候，正在同步同行名單與分帳紀錄。'}</p>${error?'<button class="money-primary money-retry" data-money-action="retry">再試一次</button>':''}</div></section><p class="money-message ${error?'is-error':''}" role="status">${esc(error)}</p>`;
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
        owe[i].amount-=amount; receive[j].amount-=amount;
        if(!owe[i].amount) i++; if(!receive[j].amount) j++;
      }
    });
    return result;
  }

  function expenseForm() {
    const members=people();
    if(!members.length) return `<section class="money-card money-empty money-no-people"><strong>先新增同行者姓名</strong><p>名單中有人之後，就可以開始記錄誰先付款、大家各自分擔多少。</p></section>`;
    return `<details class="money-card expense-editor"><summary>＋ 新增一筆共同花費</summary><form data-money-form="expense">
      <div class="money-grid-two"><label>項目<input name="title" maxlength="80" placeholder="例如：晚餐、計程車、住宿" required></label><label>幣別<select name="currency"><option value="JPY">JPY 日圓</option><option value="TWD">TWD 台幣</option></select></label></div>
      <div class="money-grid-two"><label>誰先付款<select name="payer">${members.map(person=>`<option value="${person.index}">${esc(person.name)}</option>`).join('')}</select></label><label>總金額<input name="total" type="number" min="1" step="1" inputmode="numeric" placeholder="例如 12000" required></label></div>
      <fieldset><legend>哪些人一起分擔</legend><div class="money-checks">${members.map(person=>`<label><input type="checkbox" name="participant" value="${person.index}" checked><span>${esc(person.name)}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>分擔方式</legend><div class="money-modes"><label><input type="radio" name="mode" value="equal" checked> 平均分攤</label><label><input type="radio" name="mode" value="custom"> 自訂每人金額</label></div></fieldset>
      <div class="money-custom" hidden>${members.map(person=>`<label data-share-row="${person.index}"><span>${esc(person.name)}</span><input name="share-${person.index}" type="number" min="0" step="1" inputmode="numeric" value="0"></label>`).join('')}</div>
      <div class="money-split-preview">填入總金額後，這裡會顯示每人應分擔的金額。</div><label>備註<textarea name="note" maxlength="120" placeholder="選填，例如：Day 5 淺草午餐"></textarea></label>
      <div class="money-form-actions"><button type="button" data-money-action="cancel-expense">取消</button><button class="money-primary">儲存分帳</button></div>
    </form></details>`;
  }

  function ledgerMarkup() {
    const allMembers=ledger.room.members || [], members=people(), debts=ledger.debts || [], transfers=settlements();
    const outstanding=debts.filter(debt=>!debt.settled).reduce((totals,debt)=>{const currency=currencyOf(debt.note);totals[currency]+=Number(debt.amount)||0;return totals;},{JPY:0,TWD:0});
    return `<div class="money-ledger">
      <section class="money-card money-room-head"><div><span class="money-kicker">SHARED TRIP WALLET</span><h2>${esc(ledger.room.name || '旅行帳本')}</h2><p>所有人共用同一份名單與分帳紀錄，不用邀請碼。</p></div></section>
      <div class="money-stats"><div><span>同行成員</span><strong>${members.length} 人</strong></div><div><span>未結清代墊</span><strong>${money(outstanding.JPY,'JPY')}</strong><small>${outstanding.TWD?money(outstanding.TWD,'TWD'):'目前無台幣款項'}</small></div></div>
      <section class="money-card money-members"><div class="money-section-head"><div><span class="money-kicker">TRAVELERS</span><h3>同行者名單</h3></div><button data-money-action="refresh">同步</button></div>
        <form class="money-add-person" data-money-form="member"><label><span class="sr-only">姓名</span><input name="name" maxlength="12" autocomplete="name" placeholder="輸入姓名" required></label><button class="money-primary">＋ 新增姓名</button></form>
        <div class="money-member-list">${members.length?members.map(person=>`<span>${esc(person.name)}</span>`).join(''):'<p>還沒有姓名，請先新增同行者。</p>'}</div><p>新增後，其他人打開這個網站也會看到相同名單。</p>
      </section>${expenseForm()}
      <section class="money-card money-settlement"><div class="money-section-head"><div><span class="money-kicker">SETTLEMENT</span><h3>目前誰該付誰</h3></div></div>${transfers.length?`<div class="money-transfers">${transfers.map(item=>`<div><strong>${esc(allMembers[item.from]||'成員')}</strong><span>付給</span><strong>${esc(allMembers[item.to]||'成員')}</strong><b>${money(item.amount,item.currency)}</b></div>`).join('')}</div>`:'<div class="money-clear">✓ 目前沒有未結清款項</div>'}</section>
      <section class="money-records"><div class="money-section-head"><div><span class="money-kicker">HISTORY</span><h3>分帳紀錄</h3></div></div>${debts.length?debts.map(debt=>`<article class="money-debt ${debt.settled?'is-paid':''}"><label class="money-paid"><input type="checkbox" data-money-action="toggle" data-id="${esc(debt.id)}" ${debt.settled?'checked':''}><span>${debt.settled?'已付清':'待付款'}</span></label><div><p><strong>${esc(allMembers[debt.debtorIndex]||'成員')}</strong> 要付給 <strong>${esc(allMembers[debt.creditorIndex]||'成員')}</strong></p><small>${esc(visibleNote(debt.note))}</small></div><b>${money(debt.amount,currencyOf(debt.note))}</b><button class="money-delete" data-money-action="delete" data-id="${esc(debt.id)}" aria-label="刪除這筆分帳">刪除</button></article>`).join(''):'<div class="money-empty"><strong>還沒有分帳紀錄</strong><p>有人先付餐費、交通費或住宿費時，就新增在這裡。</p></div>'}</section>
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
    const custom=form.elements.mode.value==='custom';form.querySelector('.money-custom').hidden=!custom;
    form.querySelectorAll('[data-share-row]').forEach(row=>{const picked=form.querySelector(`[name="participant"][value="${row.dataset.shareRow}"]`)?.checked;row.hidden=!picked;row.querySelector('input').disabled=!custom||!picked;});
    const{shares}=selectedShares(form),currency=form.elements.currency.value,members=ledger.room.members||[];
    form.querySelector('.money-split-preview').innerHTML=shares.length?shares.map(item=>`<span>${esc(members[item.index])}<b>${money(item.amount,currency)}</b></span>`).join(''):'請輸入總金額並至少選擇一位分擔者。';
  }

  async function loadLedger(showNotice=false){ledger=await rpc('get_ticket_room',{p_code:ROOM_CODE,p_pin:PIN});renderLedger();if(showNotice)setMessage('已同步最新分帳資料');}
  function startPolling(){clearInterval(poller);poller=setInterval(async()=>{if(!host?.isConnected||host.querySelector('.expense-editor[open]')||host.querySelector('[data-money-form="member"]:focus-within'))return;try{await loadLedger();}catch{}},15000);}

  async function handleSubmit(event){
    const form=event.target.closest('[data-money-form]');if(!form)return;event.preventDefault();
    const submit=form.querySelector('button:not([type="button"])');if(submit)submit.disabled=true;
    try{
      if(form.dataset.moneyForm==='member'){
        const name=form.elements.name.value.trim();if(!name||name===SYSTEM_MEMBER)throw new Error('請輸入正確姓名');
        ledger=await rpc('join_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_name:name});renderLedger();setMessage(`已新增「${name}」`);
      }else if(form.dataset.moneyForm==='expense'){
        const payer=Number(form.elements.payer.value),{total,shares}=selectedShares(form,true);if(!shares.length)throw new Error('請至少選擇一位分擔者');
        const currency=form.elements.currency.value,title=form.elements.title.value.trim(),extra=form.elements.note.value.trim();
        const debtShares=shares.filter(item=>item.index!==payer&&item.amount>0);if(!debtShares.length)throw new Error('目前沒有其他人需要分擔，請再確認付款人與成員');
        const note=`[${currency}] ${title} · 總額 ${money(total,currency)}${extra?' · '+extra:''}`.slice(0,280);
        for(const share of debtShares)ledger=await rpc('save_ticket_debt_v2',{p_code:ROOM_CODE,p_pin:PIN,p_payload:{debtorIndex:share.index,creditorIndex:payer,amount:share.amount,eventId:null,note}});
        renderLedger();setMessage('分帳已儲存，同行成員會看到最新資料');
      }
    }catch(error){setMessage(error.message||'無法儲存，請稍後再試',true);}finally{if(submit?.isConnected)submit.disabled=false;}
  }

  async function handleClick(event){
    const button=event.target.closest('[data-money-action]');if(!button)return;const action=button.dataset.moneyAction;
    try{
      if(action==='retry'){host.innerHTML=loadingMarkup();await loadLedger();startPolling();}
      else if(action==='cancel-expense')button.closest('details').open=false;
      else if(action==='refresh'){button.disabled=true;await loadLedger(true);}
      else if(action==='delete'){if(!confirm('確定刪除這筆分帳紀錄？'))return;ledger=await rpc('mutate_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_action:'delete_debt',p_payload:{id:button.dataset.id}});renderLedger();setMessage('分帳紀錄已刪除');}
    }catch(error){setMessage(error.message||'操作失敗，請稍後再試',true);}finally{if(button?.isConnected)button.disabled=false;}
  }

  async function handleChange(event){
    const form=event.target.closest('[data-money-form="expense"]');
    if(form&&event.target.matches('[name="total"],[name="currency"],[name="mode"],[name="participant"],[name^="share-"]'))updateSplitPreview(form);
    if(event.target.dataset.moneyAction==='toggle')try{ledger=await rpc('mutate_ticket_room',{p_code:ROOM_CODE,p_pin:PIN,p_action:'toggle_debt',p_payload:{id:event.target.dataset.id,settled:event.target.checked}});renderLedger();setMessage(event.target.checked?'已標記為付清':'已改為待付款');}catch(error){event.target.checked=!event.target.checked;setMessage(error.message||'無法更新',true);}
  }

  async function mount(target){unmount();host=target;host.addEventListener('submit',handleSubmit);host.addEventListener('click',handleClick);host.addEventListener('change',handleChange);host.innerHTML=loadingMarkup();try{await loadLedger();startPolling();}catch(error){host.innerHTML=loadingMarkup(error.message||'請檢查網路後再試');}}
  function unmount(){clearInterval(poller);poller=null;if(host){host.removeEventListener('submit',handleSubmit);host.removeEventListener('click',handleClick);host.removeEventListener('change',handleChange);}host=null;}
  window.TripMoney={mount,unmount};
})();
