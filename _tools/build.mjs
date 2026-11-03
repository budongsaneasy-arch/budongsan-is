// _src 의 조각들을 화면별 HTML 페이지로 조립합니다.
//
//   node _tools/build.mjs
//
// 내용을 고칠 때는 _src/pages/*.html 과 _src/pages.json 을 고치고 이 명령을 다시 실행하세요.
// index.html, why/index.html … 은 전부 이 스크립트가 만들어 내는 결과물입니다. 직접 고치지 마세요.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://budongsanis.com';
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');

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

let made = 0;
for (const page of pages) {
  // 첫 조각만 펼치고 나머지(소식 페이지의 게시글 화면)는 접어 둡니다
  const content = page.parts
    .map((name, i) => {
      const frag = read(`_src/pages/${name}.html`).trim();
      return i === 0 ? frag.replace(/^(<section class="route"[^>]*?) hidden>/, '$1>') : frag;
    })
    .join('\n\n');

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
  console.log(`  ${(page.path ? '/' + page.path + '/' : '/').padEnd(12)} ${String(html.length).padStart(6)}자  ${page.title}`);
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
