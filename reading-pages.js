(() => {
  'use strict';
  const venue=document.querySelector('.venue-main');
  const fold=(section,heading,open=false)=>{
    if(!heading)return;
    const details=document.createElement('details');details.className='reading-section';details.open=open;
    const summary=document.createElement('summary');summary.textContent=heading.textContent;
    if(section.id){details.id=section.id;section.removeAttribute('id');}
    heading.remove();section.before(details);details.append(summary,section);
  };
  if(venue){
    const day=venue.querySelector('.eyebrow')?.textContent.match(/DAY\s*(\d+)/)?.[1]||'1';
    document.querySelectorAll('a[href="../index.html"]').forEach(a=>{a.href='../../index.html?view=restaurants&day='+day;a.textContent='← 當日餐廳攻略';});
    const quick=venue.querySelector('.quick-grid'),hero=venue.querySelector('.venue-hero');
    if(quick&&hero)hero.after(quick);
    venue.querySelectorAll('.hero-photo').forEach(p=>p.remove());
    venue.querySelectorAll('.content-grid .panel').forEach(p=>fold(p,p.querySelector('h2'),/營業|不吃牛/.test(p.querySelector('h2')?.textContent||'')));
    // Do not silently substitute a generic dish picture for a specific restaurant.
    venue.querySelectorAll('img[data-commons-query]').forEach(img=>{
      img.removeAttribute('data-commons-query');img.closest('.dish-visual')?.remove();
    });
    venue.querySelectorAll('.photo-panel .intro').forEach(p=>p.textContent='店面與招牌餐點供行前辨識；實際菜色與供應以當日為準。');
  }else{
    document.querySelectorAll('section.page').forEach((p,i)=>fold(p,p.querySelector('h2'),i===0));
  }
  document.querySelectorAll('table').forEach(table=>{
    const wrap=document.createElement('div');wrap.className='reading-table-scroll';wrap.tabIndex=0;
    wrap.setAttribute('role','region');wrap.setAttribute('aria-label','表格，可左右滑動');table.before(wrap);wrap.append(table);
  });
  const reveal=()=>{
    if(!location.hash)return;
    let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return;}
    if(!target)return;
    for(let el=target;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;
    requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  };
  window.addEventListener('hashchange',reveal);reveal();
  document.querySelectorAll('img').forEach(img=>{
    const failed=()=>{
      const figure=img.closest('figure');if(!figure)return;
      figure.classList.add('reading-image-failed');
      if(figure.querySelector('.reading-image-missing'))return;
      const message=document.createElement('p');message.className='reading-image-missing';message.textContent='這張照片目前無法載入。';
      const source=figure.querySelector('a[href]');if(source){const link=source.cloneNode(true);link.textContent='開啟原頁查看照片 ↗';message.append(link);}
      img.hidden=true;figure.append(message);
    };
    img.removeAttribute('onerror');img.onerror=null;
    img.removeAttribute('data-direct-photo');
    img.addEventListener('error',failed);
    const checkFallback=()=>{if(/\/food-[^/]+\.svg(?:$|[?#])/.test(img.src))failed();};
    new MutationObserver(checkFallback).observe(img,{attributes:true,attributeFilter:['src']});
    checkFallback();
    if(img.complete&&!img.naturalWidth)failed();
  });
})();
