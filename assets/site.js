/* 부동산이즈 홈페이지 — 동작
   설정과 내용은 assets/data.js 에 있습니다. 이 파일보다 먼저 불러와야 합니다. */

/* ===== 방문자 분석 =====
   · 위 CONFIG에 아이디를 넣기 전에는 아무 스크립트도 불러오지 않습니다.
   · 이 사이트는 주소의 '#'으로 화면을 바꾸므로 화면이 바뀔 때마다 조회수를 따로 보냅니다.
     이 처리가 없으면 모든 방문이 첫 화면 하나로만 잡힙니다.
   · 보내는 값에 성함·연락처·이메일·문의 내용은 넣지 않습니다. */
const Analytics = (function () {
  function gaPage() {
    if (!CONFIG.GA4_ID || !window.gtag) return;
    try {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: location.href,
        page_path: location.pathname + (location.hash || '')
      });
    } catch (e) {}
  }
  function naverPage() {
    if (!CONFIG.NAVER_ID || !window.wcs) return;
    try {
      window.wcs_add = window.wcs_add || {};
      window.wcs_add.wa = CONFIG.NAVER_ID;
      window.wcs_do();
    } catch (e) {}
  }
  return {
    load: function () {
      if (CONFIG.GA4_ID) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', CONFIG.GA4_ID, { send_page_view: false });
        const g = document.createElement('script');
        g.async = true;
        g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.GA4_ID);
        document.head.appendChild(g);
        gaPage();
      }
      if (CONFIG.NAVER_ID) {
        const n = document.createElement('script');
        n.async = true;
        n.src = 'https://wcs.naver.net/wcslog.js';
        n.onload = naverPage;
        document.head.appendChild(n);
      }
    },
    page: function () { gaPage(); naverPage(); },
    event: function (name, params) {
      if (!CONFIG.GA4_ID || !window.gtag) return;
      try { window.gtag('event', name, params || {}); } catch (e) {}
    }
  };
})();
Analytics.load();

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  /* 빌드할 때 이미 그려 넣은 칸은 다시 그리지 않습니다 (화면이 깜빡이지 않도록).
     force 가 true 면 필터를 바꾼 경우이므로 다시 그립니다. */
  const fill = (el, html, force) => { if (el && (force || !el.firstElementChild)) el.innerHTML = html; };
  const canEmbed = /^https:$/.test(location.protocol) && !/claude|anthropic|usercontent/.test(location.hostname);

  /* ---------- config text ---------- */
  $$('[data-cfg]').forEach((el) => {
    const k = el.dataset.cfg; const v = k === 'version' ? CONFIG.POLICY_VERSION : CONFIG[k];
    if (v) { el.textContent = v; el.classList.remove('ph'); }
  });
  if ($('#hubLink')) { if (CONFIG.HUB_URL) $('#hubLink').href = CONFIG.HUB_URL; else { $('#hubLink').removeAttribute('target'); $('#hubLink').href = '#contact'; $('#hubLink').firstChild.textContent = '지도 연결 준비 중 · 문의하기'; } }

  /* ---------- router ---------- */
  /* 화면마다 주소가 따로 있습니다(/why/ 처럼). 그래서 여기서 하는 일은 두 가지뿐입니다.
       1) 예전 해시 주소(#why)로 들어오면 해당 페이지로 넘겨 줍니다
       2) 소식 페이지에서 #news/<아이디> 로 게시글을 펼칩니다                      */
  const PATHS = { home: '/', why: '/why/', join: '/join/', stories: '/stories/', partners: '/partners/',
                  brand: '/brand/', faculty: '/faculty/', news: '/news/', post: '/news/',
                  contact: '/contact/', privacy: '/privacy/' };
  const firstRoute = $('#main .route');
  const here = firstRoute ? firstRoute.dataset.route : 'home';
  const BASE_TITLE = document.title;

  function show() {
    const raw = (location.hash || '').slice(1);
    if (raw === 'main') { const m = $('#main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } return; }
    let id = raw, anchor = null, postId = null;
    if (id.indexOf('news/') === 0) { postId = decodeURIComponent(id.slice(5)); id = 'news'; }
    else if (id && !PATHS[id]) {
      /* 라우트 이름이 아니면 페이지 안의 앵커입니다 */
      const el = document.getElementById(id);
      const host = el && el.closest('.route');
      if (!host) return;
      anchor = el;
      id = host.dataset.route === 'post' ? 'news' : host.dataset.route;
      const art = el.closest('[data-post]');
      if (art) postId = art.dataset.post;
    }

    if (id && id !== here) {   /* 다른 화면이면 그 주소로 넘깁니다 */
      location.replace(PATHS[id] + (postId ? '#news/' + encodeURIComponent(postId) : anchor ? '#' + anchor.id : ''));
      return;
    }

    if (here === 'news') {
      const open = !!(postId && openPost(postId));
      $$('.route').forEach((r) => { r.hidden = r.dataset.route !== (open ? 'post' : 'news'); });
      document.title = open && curPost ? curPost.title + ' | 부동산이즈' : BASE_TITLE;
    }
    closeMenu();
    if (anchor) anchor.scrollIntoView();
    else if (postId) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', show);
  // show() 다음에 등록해서, 바뀐 화면 제목이 반영된 뒤 조회수가 올라갑니다
  window.addEventListener('hashchange', () => Analytics.page());
  /* 대표전화 클릭도 전환으로 셉니다 — 번호 자체 대신 구분 이름만 보냅니다 */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="tel:"]');
    if (!a) return;
    const num = (a.getAttribute('href') || '').replace(/[^0-9]/g, '');
    Analytics.event('phone_click', { phone_label: num === '18774121' ? '대표전화' : '직통번호' });
  });

  /* ---------- mobile menu ---------- */
  const gnb = $('#gnb'), mb = $('#menuBtn'), scrim = $('#scrim');
  function closeMenu() { gnb.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-label', '메뉴 열기'); scrim.hidden = true; }
  mb.addEventListener('click', () => { const o = !gnb.classList.contains('open'); gnb.classList.toggle('open', o); mb.setAttribute('aria-expanded', String(o)); mb.setAttribute('aria-label', o ? '메뉴 닫기' : '메뉴 열기'); scrim.hidden = !o; });
  scrim.addEventListener('click', closeMenu);
  $('#toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- videos ---------- */
  fill($('#homeVideos'), [VIDEOS[0], VIDEOS[2], VIDEOS[1]].map(CARDS.video).join(''));
  fill($('#allVideos'), VIDEOS.map(CARDS.video).join(''));
  if ($('#vcount')) { $('#vcount').textContent = `인터뷰 영상 ${VIDEOS.length}편`; }
  const vm = $('#vmodal'), vf = $('#vframe');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-vid]'); if (!a || !canEmbed) return;
    e.preventDefault(); const id = a.dataset.vid;
    vf.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`; $('#vlink').href = `https://www.youtube.com/watch?v=${id}`; vm.hidden = false; $('#vclose').focus();
  });
  const closeV = () => { vm.hidden = true; vf.src = 'about:blank'; };
  $('#vclose').addEventListener('click', closeV);
  vm.addEventListener('click', (e) => { if (e.target === vm) closeV(); });

  /* ---------- gallery ---------- */
  fill($('#gallery'), GALLERY.map(CARDS.gallery).join(''));

  /* ---------- partners ---------- */
  if ($('#regionChips')) {
    let region = '전체', q = '';
    const chips = $('#regionChips');
    fill(chips, ['전체'].concat(REGIONS)
      .map((r) => CARDS.regionChip(r, r === '전체', r === '전체' ? PARTNERS.length : PARTNERS.filter((p) => p.region === r).length))
      .join(''));
    chips.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; region = b.dataset.r; $$('.chip', chips).forEach((c) => c.setAttribute('aria-pressed', String(c === b))); renderP(); });
    $('#pq').addEventListener('input', (e) => { q = e.target.value.trim(); renderP(); });
    function renderP(first) {
      const list = PARTNERS.filter((p) => (region === '전체' || p.region === region) && (!q || (p.center + p.office + p.ceo + p.region).includes(q)));
      fill($('#pgrid'), list.map(CARDS.partner).join(''), !first);
      $('#pcount').textContent = `${region === '전체' ? '전체' : region} ${list.length}개 센터`;
      $('#pempty').hidden = list.length > 0;
    }
    renderP(true);
  }

  /* ---------- faculty ---------- */
  fill($('#fgrid'), FACULTY.map(CARDS.faculty).join(''));

  /* ---------- lead submit ---------- */
  const digits = (s) => String(s || '').replace(/[^0-9]/g, '');
  async function send(data) {
    const payload = Object.assign({}, data, { consentAt: new Date().toISOString(), policyVersion: CONFIG.POLICY_VERSION, page: location.pathname + (location.hash || '') });
    if (!CONFIG.ENDPOINT) { await new Promise((r) => setTimeout(r, 400)); return { demo: true }; }
    const res = await fetch(CONFIG.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || 'save failed');
    return { demo: false };
  }
  function fieldErr(el, on) { if (el) el.setAttribute('aria-invalid', on ? 'true' : 'false'); }

  if ($('#leadForm')) {
    const lf = $('#leadForm');
    lf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(lf); const d = Object.fromEntries(fd.entries());
      if (d.website) return; // spam trap
      let err = '', focus = null;
      ['f-name', 'f-phone', 'f-area'].forEach((id) => fieldErr($('#' + id), false));
      if (!d.name?.trim()) { err = '성함을 입력해 주세요.'; focus = $('#f-name'); }
      else if (digits(d.phone).length < 10) { err = '연락 가능한 휴대전화 번호를 입력해 주세요.'; focus = $('#f-phone'); }
      else if (!d.status) { err = '현재 상황을 선택해 주세요.'; focus = $('#f-st1'); }
      else if (!d.area?.trim()) { err = '희망 지역을 입력해 주세요.'; focus = $('#f-area'); }
      else if (!$('#f-agree').checked) { err = '개인정보 수집·이용에 동의해 주셔야 상담 신청이 접수됩니다.'; focus = $('#f-agree'); }
      const em = $('#formErr');
      if (err) { em.textContent = err; em.hidden = false; if (focus && focus.classList.contains('inp')) fieldErr(focus, true); focus && focus.focus(); return; }
      em.hidden = true;
      const btn = $('#submitBtn'); btn.disabled = true; btn.textContent = '보내는 중…';
      try {
        const r = await send({ form: '상담신청 페이지', name: d.name.trim(), phone: d.phone.trim(), status: d.status, career: d.career, area: d.area.trim(), when: d.when, master: d.master, email: d.email, source: d.source, message: d.message, agree: true, marketing: $('#f-mkt').checked });
        Analytics.event('generate_lead', { form_name: '상담신청 페이지', when: d.when || '미선택' });
        lf.hidden = true; $('#formDone').hidden = false; $('#doneText').textContent = `${d.name.trim()}님, 남겨주신 연락처로 담당자가 확인 후 순차적으로 연락드리겠습니다. 급하신 경우 대표전화 1877-4121로 연락 주세요.`;
        $('#demoNote').hidden = !r.demo; $('#formDone').focus();
      } catch (x) { em.textContent = '전송하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하시거나 1877-4121로 전화 주세요.'; em.hidden = false; }
      finally { btn.disabled = false; btn.textContent = '상담 신청하기'; }
    });
    $('#againBtn').addEventListener('click', () => { lf.reset(); lf.hidden = false; $('#formDone').hidden = true; $('#f-name').focus(); });
  }

  /* ---------- popup ---------- */
  const pop = $('#pop'), popNews = $('#popNews');
  let news = DEFAULT_NEWS.slice(), slides = news.slice(), idx = 0;
  const EV_SHOT = '/assets/img/store-neob-night.jpg';   // 설명회 카드 기본 배경 (시트의 '배경 사진'으로 바꿀 수 있습니다)
  const POP_TEXT = {
    news:  { tag: 'NEW', title: '부동산이즈 새 가족 소식', eyebrow: '가맹 상담 신청',
             h2: '나도 부동산이즈 대표가<br>되고 싶다면', lead: '이름과 연락처만 남겨주세요. 담당자가 연락드립니다.',
             purpose: '가맹 상담', submit: '상담 신청하기' },
    event: { tag: '창업설명회', eyebrow: '창업설명회 참석 신청',
             lead: '이름과 연락처만 남겨주세요. 담당자가 참석 안내를 드립니다.',
             purpose: '설명회 참석 안내와 가맹 상담', submit: '설명회 신청하기' }
  };
  const isEvent = () => (slides[idx] || {}).kind === 'event';
  const evRow = (k, v) => v ? `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>` : '';
  const today = () => new Date().toISOString().slice(0, 10);
  function renderSlide() {
    const n = slides[idx] || {}, ev = n.kind === 'event', t = ev ? POP_TEXT.event : POP_TEXT.news;
    popNews.classList.toggle('evb', ev);
    popNews.style.setProperty('--shot', ev ? `url("${n.img || EV_SHOT}")` : 'none');
    $('#popSlide').className = 'pop-slide' + (ev ? ' ev' : '');
    $('#popSlide').innerHTML = ev
      ? `<span class="ev-d">${esc(n.date)}</span><span class="ev-t">${esc(n.time)}</span>
         <ul class="ev-meta">${evRow('장소', n.place)}${evRow('오시는 길', n.way)}${evRow('대상', n.target)}${evRow('참가비', n.fee)}</ul>
         <button class="ev-cta" type="button" id="evCta">설명회 신청하기<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></button>`
      : `<img src="${esc(n.img || '/assets/img/logo.svg')}"${n.img ? '' : ' class="logo-fb"'} alt="${esc(n.ceo)}"><span class="tag">${esc(n.badge || 'NEW')}</span><span class="ar">${esc(n.area)}</span><span class="ct">${esc(n.center)}</span><b>${esc(n.ceo)}</b>`;
    $('#popTag').textContent = t.tag;
    $('#popTitle').textContent = ev ? (n.title || '부동산이즈 창업설명회') : t.title;
    $('#popTagline').hidden = ev;
    $('#popEyebrow').textContent = t.eyebrow;
    $('#popH2').innerHTML = ev ? `${esc(n.date)} 설명회에<br>참석하시겠어요?` : t.h2;
    $('#popLead').textContent = t.lead;
    $('#popPurpose').textContent = t.purpose;
    $('#popSubmit').textContent = t.submit;
    $('#popIdx').textContent = `${idx + 1} / ${slides.length}`;
    $('#popDots').innerHTML = slides.map((_, i) => `<button type="button" aria-label="${i + 1}번째" aria-current="${i === idx}" data-i="${i}"></button>`).join('');
    const multi = slides.length > 1; $('#popPrev').hidden = !multi; $('#popNext').hidden = !multi;
  }
  /* 설명회 카드의 '신청하기'를 누르면 옆(모바일에서는 아래)의 신청 칸으로 이동합니다 */
  $('#popSlide').addEventListener('click', (e) => {
    if (!e.target.closest('#evCta')) return;
    const el = $('#p-name'); el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => el.focus({ preventScroll: true }), 320);
  });
  $('#popPrev').addEventListener('click', () => { idx = (idx + slides.length - 1) % slides.length; renderSlide(); });
  $('#popNext').addEventListener('click', () => { idx = (idx + 1) % slides.length; renderSlide(); });
  $('#popDots').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { idx = +b.dataset.i; renderSlide(); } });
  let lastFocus = null;
  function openPop() { lastFocus = document.activeElement; pop.hidden = false; $('#reopen').hidden = true; setTimeout(() => { $('#popBox').focus({ preventScroll: true }); $('#popBox').scrollTop = 0; }, 30); }
  function closePop() { pop.hidden = true; $('#reopen').hidden = false; lastFocus && lastFocus.focus && lastFocus.focus(); }
  $('#popClose').addEventListener('click', closePop);
  $('#popToday').addEventListener('click', () => { store.set('popHide', today()); closePop(); });
  $('#reopen').addEventListener('click', openPop);
  pop.addEventListener('click', (e) => { if (e.target === pop) closePop(); if (e.target.closest('[data-close-pop]')) closePop(); });
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!vm.hidden) closeV(); else if (!pop.hidden) closePop(); else closeMenu(); });

  const pf = $('#popForm');
  pf.addEventListener('submit', async (e) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(pf).entries()); if (d.website) return;
    let err = '';
    if (!d.name?.trim()) err = '성함을 입력해 주세요.';
    else if (digits(d.phone).length < 10) err = '연락 가능한 휴대전화 번호를 입력해 주세요.';
    else if (!$('#p-agree').checked) err = '개인정보 수집·이용에 동의해 주셔야 신청이 접수됩니다.';
    const em = $('#popErr'); if (err) { em.textContent = err; em.hidden = false; return; } em.hidden = true;
    try {
      const ev = isEvent();   // 설명회 카드에서 넣은 신청은 시트에서 바로 구분됩니다
      const r = await send({ form: ev ? '창업설명회 팝업' : '팝업 간편 신청', name: d.name.trim(), phone: d.phone.trim(), status: ev ? '창업설명회 신청' : '팝업 간편 신청', area: (d.area || '').trim(), agree: true, marketing: false });
      Analytics.event('generate_lead', { form_name: ev ? '창업설명회 팝업' : '팝업 간편 신청' });
      pf.hidden = true; $('#popDone').hidden = false; $('#popDoneText').textContent = `${d.name.trim()}님, 신청이 접수되었습니다.`; $('#popDemo').hidden = !r.demo;
    } catch (x) { em.textContent = '전송하지 못했습니다. 1877-4121로 전화 주세요.'; em.hidden = false; }
  });

  /* ---------- 부동산이즈 소식 (게시판) ---------- */
  let posts = POSTS.slice(), curPost = null, cat = '전체';
  const sortPosts = () => { posts = sortByPin(posts); };
  function renderPosts(first) {
    sortPosts();
    const cats = ['전체'].concat(Array.from(new Set(posts.map((p) => p.cat || '소식'))));
    if (!cats.includes(cat)) cat = '전체';
    if ($('#newsFilter')) { $('#newsFilter').innerHTML = cats.length > 2 ? cats.map((c) => CARDS.newsCat(c, c === cat)).join('') : ''; }
    const list = posts.filter((p) => cat === '전체' || (p.cat || '소식') === cat);
    fill($('#newsList'), list.map(CARDS.news).join(''), !first);
    fill($('#homeNews'), posts.slice(0, 3).map(CARDS.news).join(''), !first);
    if ($('#newsEmpty')) { $('#newsEmpty').hidden = list.length > 0; }
    if ($('#homeNews')) { $('#homeNews').classList.toggle('solo', posts.length === 1); }
    if ($('#newsList')) { $('#newsList').classList.toggle('solo', list.length === 1); }
    if ($('#homeNews')) { $('#homeNews').closest('section').hidden = posts.length === 0; }
  }
  if ($('#newsFilter')) { $('#newsFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; renderPosts(); } }); }
  /* 시트에 적은 글을 보기 좋게 그립니다. 줄 단위로 아래 표시를 알아봅니다.
       ■ 제목      01. 번호 항목      "인용문"
       · 라벨 : 값 (안내 표)          · 항목 (체크 목록)        [사진2] (그 자리에 사진) */
  function postBodyHtml(p) {
    const imgs = (Array.isArray(p.imgs) && p.imgs.length ? p.imgs : (p.img ? [p.img] : [])).filter(Boolean);
    const used = new Set();
    const pic = (i, cls) => (imgs[i] && !used.has(i) ? (used.add(i), `<img class="${cls}" src="${esc(imgs[i])}" alt="" loading="lazy">`) : '');

    const out = [];
    let nums = [], buf = [], bul = [];
    const flushNums = () => { if (nums.length) { out.push(`<div class="ps-nums">${nums.join('')}</div>`); nums = []; } };
    const flushText = () => { if (buf.length) { out.push(`<p>${buf.map(esc).join('<br>')}</p>`); buf = []; } };
    const flushBul = () => {
      if (!bul.length) return;
      const items = bul; bul = [];
      out.push(items.every((t) => / : /.test(t))
        ? `<dl class="ps-info">${items.map((t) => {
            const i = t.indexOf(' : ');
            return `<dt>${esc(t.slice(0, i))}</dt><dd>${esc(t.slice(i + 3))}</dd>`;
          }).join('')}</dl>`
        : `<ul class="ps-list">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`);
    };
    const flushAll = () => { flushText(); flushBul(); flushNums(); };

    const isNum = (l) => /^\d{1,2}[.)]\s/.test(l);
    const isBul = (l) => /^[·•▪-]\s/.test(l);

    for (const raw of String(p.body || p.summary || '').replace(/\r\n/g, '\n').split(/\n{2,}/)) {
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      let i = 0;
      while (i < lines.length) {
        const L = lines[i];

        const mark = L.match(/^\[사진\s*(\d+)\]$/);
        if (mark) { flushAll(); out.push(pic(+mark[1] - 1, 'ps-img')); i++; continue; }

        if (L.startsWith('■')) {
          flushAll();
          out.push(`<h2 class="ps-h">${esc(L.replace(/^■\s*/, ''))}</h2>`);
          i++; continue;
        }

        if (isNum(L)) {                                   // 01. 제목 + 이어지는 설명 줄
          flushText(); flushBul();
          const title = L.replace(/^\d{1,2}[.)]\s*/, '');
          const no = L.match(/^(\d{1,2})/)[1];
          const desc = [];
          i++;
          while (i < lines.length && !isNum(lines[i]) && !isBul(lines[i]) && !lines[i].startsWith('■')) { desc.push(lines[i]); i++; }
          nums.push(`<div class="ps-num"><b>${esc(no)}</b><strong>${esc(title)}</strong>` +
                    (desc.length ? `<p>${desc.map(esc).join('<br>')}</p>` : '') + '</div>');
          continue;
        }

        if (isBul(L)) { flushText(); flushNums(); bul.push(L.replace(/^[·•▪-]\s*/, '')); i++; continue; }

        if (/^["\u201C].*["\u201D]$/.test(L)) {           // "인용문"
          flushAll();
          out.push(`<blockquote class="ps-quote">${esc(L.replace(/^["\u201C]|["\u201D]$/g, ''))}</blockquote>`);
          i++; continue;
        }

        flushBul(); flushNums();
        buf.push(L); i++;
      }
      flushText(); flushBul();
    }
    flushAll();

    const head = pic(0, 'ps-hero');
    const rest = imgs.map((_, i) => pic(i, 'ps-img')).join('');
    return head + out.join('') + rest +
      (p.link ? `<p><a class="btn navy" href="${esc(p.link)}" target="_blank" rel="noopener">자세히 보기</a></p>` : '');
  }

  function openPost(id) {
    if (!$('#postTitle')) return false;
    const p = posts.find((x) => x.id === id); if (!p) return false;
    curPost = p;
    $('#postCat').textContent = p.cat || '소식'; $('#postDate').textContent = fmtDate(p.date); $('#postDate').setAttribute('datetime', p.date || '');
    $('#postTitle').textContent = p.title;
    const art = $$('[data-post]'); let found = false;
    art.forEach((a) => { const on = a.dataset.post === p.id; a.hidden = !on; if (on) found = true; });
    const sh = $('#postSheet');
    if (found) { sh.hidden = true; }
    else {
      $('#postSheetBody').innerHTML = postBodyHtml(p);
      sh.hidden = false;
    }
    return true;
  }
  /* 문자 신청 (현장 실습) */
  const fpText = () => { const el = $('#fpForm'); return el ? el.textContent : ''; };
  const fpSms = $('#fpSms');
  if (fpSms) fpSms.href = 'sms:01048475350' + (/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? '&' : '?') + 'body=' + encodeURIComponent(fpText());
  async function copyText(t, okMsg) {
    const st = $('#fpStatus');
    if (!st) return;
    try { await navigator.clipboard.writeText(t); st.textContent = okMsg; }
    catch (x) {
      const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (y) {} ta.remove();
      st.textContent = ok ? okMsg : '복사하지 못했습니다. 양식을 길게 눌러 직접 복사해 주세요.';
    }
  }
  $('#fpCopy') && $('#fpCopy').addEventListener('click', () => copyText(fpText(), '양식을 복사했습니다. 문자 창에 붙여넣고 빈칸을 채워 보내주세요.'));
  $('#fpCopyNum') && $('#fpCopyNum').addEventListener('click', () => copyText('010-4847-5350', '번호(010-4847-5350)를 복사했습니다.'));
  async function loadPosts() {
    if (!CONFIG.ENDPOINT) return;
    try {
      const res = await fetch(CONFIG.ENDPOINT + '?type=posts', { cache: 'no-store' });
      const j = await res.json();
      if (Array.isArray(j.items) && j.items.length) {
        const ids = new Set(POSTS.map((p) => p.id));
        posts = POSTS.concat(j.items.filter((p) => p && p.id && p.title && !ids.has(p.id)));
        renderPosts();
        if (location.hash.indexOf('#news/') === 0) show();
      }
    } catch (x) { /* 시트를 못 읽으면 기본 게시글만 표시 */ }
  }

  async function loadNews() {
    if (!CONFIG.ENDPOINT) return;
    try {
      const res = await fetch(CONFIG.ENDPOINT + '?type=news', { cache: 'no-store' });
      const j = await res.json();
      if (Array.isArray(j.items) && j.items.length) {
        /* 시트에 사진 주소가 비어 있으면, 홈페이지에 내장된 같은 센터의 사진을 그대로 사용 */
        news = j.items.map((it) => {
          if (!it.img) { const d = DEFAULT_NEWS.find((x) => x.center === it.center); if (d) it.img = d.img; }
          return it;
        });
      }
      /* 진행 중인 창업설명회가 있으면 맨 앞에 보여줍니다 */
      const events = Array.isArray(j.events) ? j.events.map((e) => Object.assign({ kind: 'event' }, e)) : [];
      slides = events.concat(news); idx = 0; renderSlide();
    } catch (x) { /* 시트를 못 읽으면 기본 소식 유지 */ }
  }

  renderPosts(true);
  show();
  renderSlide();
  const hidden = store.get('popHide') === today();
  if (hidden || here !== 'home' || location.hash) { $('#reopen').hidden = false; } else openPop();
  loadNews();
  loadPosts();
})();

