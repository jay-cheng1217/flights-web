// flyawait.com's share pages with the shared trip's own preview card (the user asked on 2026-11-05 that a link
// pasted in LINE, Threads, Messenger and the like show the trip, not the app's icon). Crawlers run no script, so
// the card's words go into the exported page's <head> here, from the Supabase function share-card, and its
// picture is share-card's PNG passed on from this site's /card/…, kept an hour. Only the paths _routes.json lists
// come here; every other file is served as it is. When share-card cannot answer, the page keeps its own words and
// gets the site's picture (og.png) rather than none. Published to the cloudflare branch alone
// (scripts/deploy-pages.mjs); GitHub Pages runs no functions.
const CARDS = 'https://qrvhbudymqlczqtyxjwy.supabase.co/functions/v1/share-card';

// flyawait.com/app, one link for every phone (the user, 2026-11-12: 「商店連結跟IOS聯結有可能共用一條連結讓user打開自動
// 導入嗎」): an iPhone or an iPad to the App Store, an Android phone to Google Play once it lists the app for everyone
// (since 2026-11-14, 1.0.6), anything else (a computer) to /download, which has both stores and this link's QR code.
// Kept in step with app/src/lib/stores.ts.
const STORES = {
  ios: 'https://apps.apple.com/app/id6831221946',
  android: 'https://play.google.com/store/apps/details?id=com.flyawait.app',
  androidLive: true,
};

// The links an iPhone with the app opens in the app rather than the browser (iOS Universal Links, the user, 2026-11-12:
// 「現在就先做IOS可以先用，安卓等開放後加入」; app.json ios.associatedDomains): the shared fares, plans and flights the app
// has pages for, in Chinese and in English; trips too (分享連結 and 同行's invitations, app/share/trip/[id].tsx, which
// opened in Safari, the user, 2026-11-12: 「為什麼我開連結沒有連去APP 還是再網頁開啟」). Android's
// /.well-known/assetlinks.json waits for Google Play's release.
const APPLE_APP_SITE = JSON.stringify({
  applinks: {
    details: [
      {
        appIDs: ['N4DXV88YDY.com.flyawait.app'],
        components: [
          '/share/fare/*',
          '/share/plan/*',
          '/share/trip/*',
          '/share/flight',
          '/en/share/fare/*',
          '/en/share/plan/*',
          '/en/share/trip/*',
          '/en/share/flight',
        ].map((path) => ({ '/': path })),
      },
    ],
  },
});
const APPLE_APP_SITE_PATHS = ['/.well-known/apple-app-site-association', '/apple-app-site-association'];

// Android's App Links, the same links as the iPhone's (the user, 2026-11-12: 「這個一並做啊」; app.json
// android.intentFilters). The app as Google Play hands it out is signed by Play's app signing key, and as built on this
// PC (the emulator's builds) by the upload key: both are named.
const ANDROID_KEYS = [
  // Google Play's app signing key (Play Console's 應用程式簽署金鑰憑證, the user gave it, 2026-11-12).
  '9D:4C:4F:9D:F0:17:67:84:60:D0:D4:A2:7A:73:BE:BD:76:BF:01:03:B4:68:76:90:49:8C:12:CF:AB:AD:FB:76',
  // The upload key (EAS's keystore), read from the 1.0.4 (41) AAB.
  '59:FB:CF:54:B4:FB:0E:95:A2:D4:F6:D7:B9:87:6C:BC:DD:C2:50:A7:C4:04:D9:53:B0:A1:3B:33:10:C8:26:AB',
];
const ANDROID_APP_LINKS = JSON.stringify([
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: 'com.flyawait.app', sha256_cert_fingerprints: ANDROID_KEYS },
  },
]);

// The picture a link was shared with (社群分享卡, the user, 2026-11-12: 「LINE 等要連結，縮圖就是分享圖」): kept in storage's
// share-cards by the app (20261112000100_share_cards.sql), named by the link's ?c=, served from /card/c/<id>.png and
// made the page's og:image in place of share-card's. Named by ten letters and figures (the user, 2026-11-12: 「c= 改 10
// 字短碼」), 16:9 (1280 × 720, as LINE's frame: 「分享圖能滿版嗎」), square in 1.0.4's builds 24 and 42 (720 × 720), the
// two told apart only by looking, so their size is left for the reader to see; before that named by a UUID, 720 × 900.
const KEPT = 'https://qrvhbudymqlczqtyxjwy.supabase.co/storage/v1/object/public/share-cards';
const KEPT_ID = /^[0-9A-Za-z]{10}$/;
const KEPT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const keptSize = (id) => (KEPT_UUID.test(id) ? { width: '720', height: '900' } : null);
// The og:image size tags for a picture of a known size; none otherwise.
const sizeTags = (size) => (size ? [['property', 'og:image:width', size.width], ['property', 'og:image:height', size.height]] : []);
const keptOf = (url) => {
  const id = url.searchParams.get('c');
  return id && (KEPT_ID.test(id) || KEPT_UUID.test(id)) ? id : null;
};
// The kept picture's id once storage has it: the website names it before it is up (the link goes out with the tap), and
// one may never go up. Until then the link shows its own preview.
async function keptThere(url) {
  const id = keptOf(url);
  if (!id) return null;
  const got = await fetch(`${KEPT}/${id}.png`, { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null);
  return got && got.ok ? id : null;
}
// What reads a link for its preview rather than a person opening it.
const PREVIEWER = /facebookexternalhit|facebot|whatsapp|twitterbot|slackbot|discordbot|telegrambot|linkedinbot|line-poker|skypeuripreview|applebot|googlebot|bingbot|bot\b|crawler|spider/i;

function storeFor(agent) {
  if (/iPhone|iPad|iPod/i.test(agent)) return STORES.ios;
  if (/Android/i.test(agent) && STORES.androidLive) return STORES.android;
  return '/download';
}
const LINK = /^[0-9A-Za-z]{10}$/;
const FLIGHT_PARAMS = ['c', 'd', 'e', 's'];
// The links share-card draws a card for by their id: a fare, a plan, a booked trip (我的航班).
const BY_ID = ['fare', 'plan', 'trip'];

// The card a path names: its share-card query (without format) and, for a page, the exported page that serves it.
function cardOf(url) {
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const lang = parts[0] === 'en' ? 'en' : 'zh';
  const rest = lang === 'en' ? parts.slice(1) : parts;
  const query = new URLSearchParams({ lang });
  // /card/zh/fare/<id>.png, /card/en/plan/<id>.png, /card/zh/trip/<id>.png, /card/zh/flight.png?c=…&d=…&e=…&s=…
  if (parts[0] === 'card') {
    const [, cardLang, kind, file] = parts;
    query.set('lang', cardLang === 'en' ? 'en' : 'zh');
    if (BY_ID.includes(kind) && file && LINK.test(file.replace(/\.png$/, ''))) {
      query.set('kind', kind);
      query.set('id', file.replace(/\.png$/, ''));
      return { query, image: true };
    }
    if (kind === 'flight.png') {
      query.set('kind', 'flight');
      for (const name of FLIGHT_PARAMS) query.set(name, url.searchParams.get(name) ?? '');
      return { query, image: true };
    }
    return null;
  }
  // /share/fare/<id>, /share/plan/<id>, /share/trip/<id>, /share/flight?c=…, each also under /en
  if (rest[0] !== 'share') return null;
  const page = `${lang === 'en' ? '/en' : ''}/share/${rest[1]}`;
  if (BY_ID.includes(rest[1]) && rest[2] && LINK.test(rest[2])) {
    query.set('kind', rest[1]);
    query.set('id', rest[2]);
    return { query, page, picture: `/card/${lang}/${rest[1]}/${rest[2]}.png` };
  }
  if (rest[1] === 'flight' && rest.length === 2 && FLIGHT_PARAMS.every((name) => url.searchParams.get(name))) {
    query.set('kind', 'flight');
    const own = new URLSearchParams();
    for (const name of FLIGHT_PARAMS) {
      query.set(name, url.searchParams.get(name));
      own.set(name, url.searchParams.get(name));
    }
    return { query, page, picture: `/card/${lang}/flight.png?${own}` };
  }
  return null;
}

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function onRequest({ request, env, waitUntil }) {
  const url = new URL(request.url);
  if (APPLE_APP_SITE_PATHS.includes(url.pathname)) {
    return new Response(APPLE_APP_SITE, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (url.pathname === '/.well-known/assetlinks.json') {
    return new Response(ANDROID_APP_LINKS, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (url.pathname.replace(/\/+$/, '') === '/app') {
    const agent = request.headers.get('User-Agent') ?? '';
    const to = new URL(storeFor(agent), url.origin);
    // A share card's link (連假便宜排行's): its preview is the card, read by LINE and the like; people go on to the store.
    const kept = keptOf(url) && PREVIEWER.test(agent) ? await keptThere(url) : null;
    if (kept) {
      const picture = `${url.origin}/card/c/${kept}.png`;
      const tags = [
        ['property', 'og:type', 'website'],
        ['property', 'og:site_name', 'Flyawait'],
        ['property', 'og:title', 'Flyawait'],
        ['property', 'og:url', url.href],
        ['property', 'og:image', picture],
        ...sizeTags(keptSize(kept)),
        ['name', 'twitter:card', 'summary_large_image'],
        ['name', 'twitter:image', picture],
      ]
        .map(([key, name, value]) => `<meta ${key}="${name}" content="${escape(value)}" />`)
        .join('');
      const page = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8" /><title>Flyawait</title>${tags}</head><body><a href="${escape(to.href)}">Flyawait</a></body></html>`;
      return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', Vary: 'User-Agent' } });
    }
    // Asked each time: the same address answers each phone differently.
    return new Response(null, { status: 302, headers: { Location: to.href, 'Cache-Control': 'no-store', Vary: 'User-Agent' } });
  }
  // A kept share card's picture, as storage has it, kept here a day (it never changes).
  const keptPicture = url.pathname.match(/^\/card\/c\/([0-9A-Za-z-]{10,36})\.png$/);
  if (keptPicture && (KEPT_ID.test(keptPicture[1]) || KEPT_UUID.test(keptPicture[1]))) {
    const cache = caches.default;
    const held = await cache.match(request);
    if (held) return held;
    const got = await fetch(`${KEPT}/${keptPicture[1]}.png`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!got || !got.ok) return new Response('Not found', { status: 404 });
    const response = new Response(got.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
    waitUntil(cache.put(request, response.clone()));
    return response;
  }
  const card = cardOf(url);
  if (!card) return env.ASSETS.fetch(request);

  if (card.image) {
    const cache = caches.default;
    const kept = await cache.match(request);
    if (kept) return kept;
    card.query.set('format', 'png');
    const made = await fetch(`${CARDS}?${card.query}`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!made || !made.ok) return new Response('Not found', { status: 404 });
    const response = new Response(made.body, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
    waitUntil(cache.put(request, response.clone()));
    return response;
  }

  card.query.set('format', 'meta');
  const [page, meta, kept] = await Promise.all([
    env.ASSETS.fetch(new Request(new URL(card.page, url.origin), request)),
    // share-card answers in well under a second, or about 3 when it has just started; a page that gave up would
    // leave LINE and Facebook showing the site's picture for that link for days.
    fetch(`${CARDS}?${card.query}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    keptThere(url),
  ]);
  if (!page.ok) return page;
  // The picture's address carries share-card's version of the card, so an hour-old picture is not shown beside new words.
  // A link shared with a card of the app's own (?c=) shows that card instead, once storage has it.
  const version = meta && meta.version ? `${card.picture.includes('?') ? '&' : '?'}v=${encodeURIComponent(meta.version)}` : '';
  const picture = kept ? `${url.origin}/card/c/${kept}.png` : meta ? `${url.origin}${card.picture}${version}` : `${url.origin}/og.png`;
  const extra = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Flyawait'],
    ['property', 'og:url', url.href],
    ['property', 'og:image', picture],
    ...sizeTags(kept ? keptSize(kept) : { width: '1200', height: '630' }),
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:image', picture],
  ]
    .map(([key, name, value]) => `<meta ${key}="${name}" content="${escape(value)}" />`)
    .join('');
  let rewriter = new HTMLRewriter().on('head', { element: (head) => head.append(extra, { html: true }) });
  if (meta && meta.title) {
    rewriter = rewriter
      .on('title', { element: (title) => title.setInnerContent(`${meta.title} · Flyawait`) })
      .on('meta[property="og:title"]', { element: (tag) => tag.setAttribute('content', meta.title) })
      .on('meta[property="og:description"]', { element: (tag) => tag.setAttribute('content', meta.description) })
      .on('meta[name="description"]', { element: (tag) => tag.setAttribute('content', meta.description) });
  }
  const response = rewriter.transform(page);
  const headers = new Headers(response.headers);
  // The words follow the trip's latest price: kept no longer than share-card keeps them.
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(response.body, { status: response.status, headers });
}
