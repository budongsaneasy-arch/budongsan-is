// _src 의 조각들을 화면별 HTML 페이지로 조립합니다.
//
//   node _tools/build.mjs
//
// 내용을 고칠 때는 _src/pages/*.html 과 _src/pages.json 을 고치고 이 명령을 다시 실행하세요.
// index.html, why/index.html … 은 전부 이 스크립트가 만들어 내는 결과물입니다. 직접 고치지 마세요.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://budongsanis.com';
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');

// 브라우저가 쓰는 것과 똑같은 데이터·카드 함수를 그대로 읽어 옵니다.
// 카드 모양을 고칠 곳은 assets/data.js 한 곳뿐입니다.
const ctx = vm.createContext({});
vm.runInContext(
  read('assets/data.js') +
    '\n;globalThis.__D = { CONFIG, PARTNERS, REGIONS, FACULTY, VIDEOS, GALLERY, POSTS, CARDS, sortByPin };',
  ctx
);
const D = ctx.__D;

const layout = read('_src/layout.html');
const { pages } = JSON.parse(read('_src/pages.json'));
const urlOf = (p) => ORIGIN + '/' + (p ? p + '/' : '');

// 라우트 이름 → 주소. 해시 링크(#why)를 실제 주소(/why/)로 바꿀 때 씁니다.
const href = Object.fromEntries(pages.map((p) => [p.route, '/' + (p.path ? p.path + '/' : '')]));
href.post = '/news/';

// 라우트가 아닌 해시(#main, #fp-apply, # )는 그대로 둡니다.
const linkify = (html) =>
  html.replace(/href="#([a-z-]+)"/g, (m, name) => (href[name] ? `href="${href[name]}"` : m));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '부동산이즈',
  alternateName: '㈜네오비 부동산중개법인',
  url: ORIGIN + '/',
  logo: ORIGIN + '/assets/img/logo.svg',
  telephone: '1877-4121',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'KR',
    addressRegion: '서울특별시',
    addressLocality: '서초구',
    streetAddress: '방배천로 18길 11, A상가 201호',
  },
  sameAs: ['https://www.youtube.com/@THENEOB', 'https://cafe.naver.com/f-e/cafes/15119168'],
};

const crumbs = (page) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '홈', item: urlOf('') },
    { '@type': 'ListItem', position: 2, name: page.ogTitle || page.title.split(' | ')[0], item: urlOf(page.path) },
  ],
});

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

// ── 목록을 미리 그려 넣기 ────────────────────────────────────
// 자바스크립트가 채우던 칸을 빌드할 때 HTML 로 채웁니다. 구글·네이버가
// 스크립트를 실행하지 않아도 사무소명·교수진·영상 제목을 바로 읽습니다.
// 브라우저에서는 이미 채워진 칸을 다시 그리지 않습니다(assets/site.js 의 fill).
// 구글 시트에 적은 소식도 빌드할 때 가져와 미리 그려 넣습니다. 이렇게 하지 않으면
// 방문자가 소식 화면을 열고 2초쯤 기다려야 글이 나타나고, 검색엔진은 아예 읽지 못합니다.
// 가져오지 못하면 코드에 든 글만으로 만들고 그대로 진행합니다(빌드는 실패하지 않습니다).
async function sheetPosts() {
  const url = D.CONFIG && D.CONFIG.ENDPOINT;
  if (!url) return [];
  try {
    const res = await fetch(url + '?type=posts', { signal: AbortSignal.timeout(20000) });
    const j = await res.json();
    const ids = new Set(D.POSTS.map((p) => p.id));
    const got = (Array.isArray(j.items) ? j.items : []).filter((p) => p && p.id && p.title && !ids.has(p.id));
    console.log(`  시트 소식 ${got.length}건을 함께 넣습니다.`);
    return got;
  } catch (e) {
    console.log(`  ! 시트 소식을 가져오지 못했습니다 (${e.message}). 코드에 든 글만 넣습니다.`);
    return [];
  }
}
const extraPosts = await sheetPosts();
const posts = D.sortByPin(D.POSTS.concat(extraPosts));
// 목록 모양(1단/2단)과 분류 버튼은 글 수에 따라 달라집니다. 브라우저가 구글 응답을
// 기다리는 동안 1건 기준으로 잘못 그리지 않도록, 시트 소식을 페이지에 함께 심어 둡니다.
const seedTag = extraPosts.length
  ? `
<script type="application/json" id="seed-posts">${JSON.stringify(extraPosts).replace(/</g, '\u003c')}</script>`
  : '';
const newsCats = ['전체'].concat(Array.from(new Set(posts.map((p) => p.cat || '소식'))));
const chips = ['전체'].concat(D.REGIONS).map((r) =>
  D.CARDS.regionChip(r, r === '전체', r === '전체' ? D.PARTNERS.length : D.PARTNERS.filter((p) => p.region === r).length)
).join('');

const GRIDS = {
  homeVideos: [D.VIDEOS[0], D.VIDEOS[2], D.VIDEOS[1]].map(D.CARDS.video).join(''),
  allVideos: D.VIDEOS.map(D.CARDS.video).join(''),
  fgrid: D.FACULTY.map(D.CARDS.faculty).join(''),
  gallery: D.GALLERY.map(D.CARDS.gallery).join(''),
  regionChips: chips,
  pgrid: D.PARTNERS.map(D.CARDS.partner).join(''),
  pcount: `전체 ${D.PARTNERS.length}개 센터`,
  newsFilter: newsCats.length > 2 ? newsCats.map((c) => D.CARDS.newsCat(c, c === '전체')).join('') : '',
  newsList: posts.map(D.CARDS.news).join(''),
  homeNews: posts.slice(0, 3).map(D.CARDS.news).join(''),
};

// <div id="pgrid"></div> 처럼 비어 있는 칸 안에 넣습니다
const putInto = (html, id, inner) =>
  html.replace(new RegExp(`(<(\\w+)[^>]*\\bid="${id}"[^>]*>)</\\2>`), (m, open, tag) => `${open}${inner}</${tag}>`);

function prerender(html) {
  let out = html;
  let filled = [];
  for (const [id, inner] of Object.entries(GRIDS)) {
    const next = putInto(out, id, inner);
    if (next !== out) { filled.push(id); out = next; }
  }
  // 인터뷰 영상 제목에 편수를 붙입니다
  out = out.replace(/(<h2[^>]*\bid="vcount"[^>]*>)인터뷰 영상(<\/h2>)/,
                    `$1인터뷰 영상 ${D.VIDEOS.length}편$2`);
  return { html: out, filled };
}

let made = 0;
for (const page of pages) {
  // 첫 조각만 펼치고 나머지(소식 페이지의 게시글 화면)는 접어 둡니다
  const raw = page.parts
    .map((name, i) => {
      const frag = read(`_src/pages/${name}.html`).trim();
      return i === 0 ? frag.replace(/^(<section class="route"[^>]*?) hidden>/, '$1>') : frag;
    })
    .join('\n\n');
  let { html: content, filled } = prerender(raw);
  if (/id="(newsList|homeNews)"/.test(content)) content += seedTag;

  const head = [
    page.noindex ? '<meta name="robots" content="noindex,follow">' : '',
    ld(page.path ? crumbs(page) : ORG),
  ].filter(Boolean).join('\n');

  let html = layout
    .replace('{{CONTENT}}', content)
    .replace('{{HEADEXTRA}}', head)
    .replaceAll('{{TITLE}}', esc(page.title))
    .replaceAll('{{OGTITLE}}', esc(page.ogTitle || page.title))
    .replaceAll('{{DESC}}', esc(page.desc))
    .replaceAll('{{URL}}', urlOf(page.path));

  html = linkify(html);
  // 현재 보고 있는 메뉴에 표시
  html = html.replace(`<a href="${href[page.route]}" data-nav="${page.route}">`,
                      `<a href="${href[page.route]}" data-nav="${page.route}" aria-current="page">`);

  const out = page.path ? path.join(SITE, page.path, 'index.html') : path.join(SITE, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  made++;
  console.log(`  ${(page.path ? '/' + page.path + '/' : '/').padEnd(12)} ${String(html.length).padStart(6)}자  ${page.title}` +
              (filled.length ? `\n${' '.repeat(22)}미리 그림: ${filled.join(', ')}` : ''));
}

// ── 사이트맵 ─────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.filter((p) => !p.noindex).map((p) =>
    `  <url>\n    <loc>${urlOf(p.path)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`),
  '</urlset>',
  '',
].join('\n');
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), sitemap);

console.log(`\n페이지 ${made}개, 사이트맵 ${pages.filter((p) => !p.noindex).length}개 주소.`);
