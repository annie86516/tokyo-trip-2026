/* Paper reader. StPageFlip 2.0.7 is vendored locally with its MIT license.
   The unmodified itinerary remains available if enhancement cannot load. */
(() => {
  'use strict';
  window.TripBook = class {
    constructor() {
      this.positions = new Map();
      this.stage = document.createElement('section');
      this.stage.className = 'book-reader';
      this.stage.setAttribute('aria-label', '可翻頁的行程書');
      this.stage.innerHTML = '<div class="book-toolbar"><span class="book-chapter"></span><span>拖曳頁角・左右滑動</span></div><div class="book-desk"><div class="paper-book"></div></div><nav class="book-controls" aria-label="書本翻頁"><button type="button" data-paper="prev" aria-label="翻到上一頁">← 上一頁</button><span class="book-counter" role="status" aria-live="polite"></span><button type="button" data-paper="next" aria-label="翻到下一頁">下一頁 →</button></nav><p class="book-hint">每一天是一個章節，上方日期可直接換日。餐飲與交通補充資料在書本下方。</p>';
      this.book = this.stage.querySelector('.paper-book');
      this.previous = this.stage.querySelector('[data-paper=prev]');
      this.next = this.stage.querySelector('[data-paper=next]');
      this.previous.addEventListener('click', () => this.turn(-1));
      this.next.addEventListener('click', () => this.turn(1));
      this.stage.addEventListener('keydown', event => {
        if(event.target.closest('a,input,select,textarea') || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
        event.preventDefault(); this.turn(event.key === 'ArrowLeft' ? -1 : 1);
      });
      // Links and vertically scrollable overflow must never start a page drag.
      for(const type of ['mousedown','touchstart']) this.book.addEventListener(type,event => {
        if(event.target.closest('a,button,.paper-overflow')) event.stopPropagation();
      }, {capture:true,passive:true});
      this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
      this.stage.tabIndex = 0;
      this.resizeObserver = new ResizeObserver(() => this.checkOverflow());
      this.resizeObserver.observe(this.book);
    }
    page(label) {
      const page = document.createElement('article');
      page.className = 'paper-page';
      page.dataset.density = 'soft';
      const inner = document.createElement('div'); inner.className = 'paper-inner';
      const head = document.createElement('div'); head.className = 'paper-head';
      const chapter = document.createElement('span'); chapter.textContent = this.chapter;
      const type = document.createElement('span'); type.textContent = label;
      head.append(chapter,type);
      const body = document.createElement('div'); body.className = 'paper-body';
      const foot = document.createElement('div'); foot.className = 'paper-foot';
      inner.append(head,body,foot); page.append(inner);
      return page;
    }
    mount(main, {group,day,route}) {
      const source = main.querySelector('.itinerary-layout');
      if(!source || source.classList.contains('book-original')) return;
      this.key = `${group}-${day}-${route}`;
      this.chapter = `DAY ${String(day).padStart(2,'0')} · ${group} 組`;
      source.before(this.stage);
      this.stage.querySelector('.book-chapter').textContent = this.chapter + '的旅行手帳';
      // Measure at the smallest supported page width, so widening never clips text.
      const available = this.stage.querySelector('.book-desk').clientWidth;
      const pageWidth = Math.min(500, available < 560 ? available : available / 2);
      const pageHeight = pageWidth * 1.55;
      const measurement = document.createElement('div');
      measurement.className = 'paper-measure';
      measurement.style.width = pageWidth+'px';
      measurement.style.height = pageHeight+'px';
      this.stage.append(measurement);
      const pages = [];
      const cover = this.page('旅程扉頁');
      const hero = source.querySelector('.hero').cloneNode(true);
      cover.classList.add('paper-cover');
      cover.querySelector('.paper-body').append(hero);
      const coverNote = document.createElement('p');
      coverNote.className = 'paper-cover-note';
      coverNote.textContent = '東京・日光・成田 / 2026 秋';
      cover.querySelector('.paper-body').append(coverNote);
      pages.push(cover);
      const blocks = [source.querySelector('.route').cloneNode(true)];
      for(const item of source.querySelectorAll('.timeline > li')) {
        const list = document.createElement('ol'); list.className = 'timeline';
        list.append(item.cloneNode(true)); blocks.push(list);
      }
      let current = null;
      const fresh = label => {
        current = this.page(label);
        measurement.replaceChildren(current);
        return current.querySelector('.paper-body');
      };
      let body = fresh('今日路線與安排');
      for(const block of blocks) {
        body.append(block);
        if(body.scrollHeight > body.clientHeight + 2 && body.children.length > 1) {
          block.remove(); pages.push(current);
          body = fresh('今日安排・續'); body.append(block);
        }
        if(body.scrollHeight > body.clientHeight + 2) {
          // Unusually long indivisible entries remain fully readable, never truncated.
          body.classList.add('paper-overflow'); body.tabIndex = 0;
          body.setAttribute('aria-label','本頁較長，可上下捲動閱讀完整內容');
          current.querySelector('.paper-foot').dataset.overflow = '本頁可上下捲動';
          pages.push(current); body = fresh('今日安排・續');
        }
      }
      if(body.children.length) pages.push(current);
      if(pages.length % 2) {
        const closing = this.page('旅途筆記');
        const title = document.createElement('h2'); title.textContent = '這一天，慢慢走。';
        const note = document.createElement('p');
        note.textContent = '本日的餐飲、交通與補充資料在書本下方。準備好下一天時，點日期書籤或下方「後一天」。';
        closing.querySelector('.paper-body').append(title,note); pages.push(closing);
      }
      measurement.remove();
      pages.forEach((page,index) => {
        const footer = page.querySelector('.paper-foot');
        footer.textContent = `${footer.dataset.overflow || '楓葉之旅'}　·　${index+1} / ${pages.length}`;
        page.setAttribute('aria-label',`${this.chapter}，第 ${index+1} 頁，共 ${pages.length} 頁`);
      });
      this.pageElements = pages;
      const start = Math.min(this.positions.get(this.key) || 0, pages.length-1);
      if(!this.flip) {
        this.flip = new St.PageFlip(this.book, {
          width:400,height:620,size:'stretch',minWidth:280,maxWidth:500,minHeight:434,maxHeight:775,
          startPage:start,usePortrait:true,showCover:false,autoSize:true,drawShadow:true,
          maxShadowOpacity:.32,flippingTime:850,mobileScrollSupport:true,
          clickEventForward:true,useMouseEvents:!this.reduceMotion.matches,
          showPageCorners:!this.reduceMotion.matches,disableFlipByClick:true
        });
        this.flip.on('flip', () => this.update());
        this.flip.on('changeOrientation', () => this.update());
        this.flip.on('changeState', () => this.update());
        this.flip.loadFromHTML(pages);
      } else {
        this.flip.updateFromHtml(pages);
        this.flip.update();
        this.flip.turnToPage(start);
      }
      source.classList.add('book-original');
      this.update();
    }
    update() {
      if(!this.flip || !this.pageElements) return;
      const index = this.flip.getCurrentPageIndex();
      const spread = this.flip.getOrientation() === 'landscape' ? 2 : 1;
      const total = this.pageElements.length;
      const last = Math.min(index+spread,total);
      this.positions.set(this.key,index);
      this.previous.disabled = index === 0;
      this.next.disabled = last >= total;
      this.stage.querySelector('.book-counter').textContent = spread === 2 ? `${index+1}–${last} / ${total} 頁` : `${index+1} / ${total} 頁`;
      // Hide nonvisible leaves from keyboard and assistive technology, not from rendering.
      this.pageElements.forEach((page,i) => {
        const visible = i >= index && i < last;
        page.inert = !visible;
        page.setAttribute('aria-hidden',String(!visible));
      });
      this.checkOverflow();
    }
    checkOverflow() {
      cancelAnimationFrame(this.overflowFrame);
      this.overflowFrame = requestAnimationFrame(() => {
        for(const page of this.pageElements || []) {
          if(page.inert || page.classList.contains('paper-cover')) continue;
          const body = page.querySelector('.paper-body');
          if(body.clientHeight && body.scrollHeight > body.clientHeight+2) {
            body.classList.add('paper-overflow'); body.tabIndex = 0;
            body.setAttribute('aria-label','本頁較長，可上下捲動閱讀完整內容');
            const foot = page.querySelector('.paper-foot');
            foot.textContent = foot.textContent.replace('楓葉之旅','本頁可上下捲動');
          }
        }
      });
    }
    turn(direction) {
      if(!this.flip || this.flip.getState() !== 'read') return;
      if(direction < 0 ? this.previous.disabled : this.next.disabled) return;
      if(this.reduceMotion.matches) {
        direction > 0 ? this.flip.turnToNextPage() : this.flip.turnToPrevPage();
      } else {
        direction > 0 ? this.flip.flipNext('bottom') : this.flip.flipPrev('bottom');
      }
    }
  };
})();
