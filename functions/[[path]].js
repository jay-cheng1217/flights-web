// flyawait.com's share pages with the shared trip's own preview card (the user asked on 2026-11-05 that a link
// pasted in LINE, Threads, Messenger and the like show the trip, not the app's icon). Crawlers run no script, so
// the card's words go into the exported page's <head> here, from the Supabase function share-card, and its
// picture is share-card's PNG passed on from this site's /card/…, kept an hour. Only the paths _routes.json lists
// come here; every other file is served as it is. When share-card cannot answer, the page keeps its own words and
// gets the site's picture (og.png) rather than none. Published to the cloudflare branch alone
// (scripts/deploy-pages.mjs); GitHub Pages runs no functions.
const CARDS = 'https://qrvhbudymqlczqtyxjwy.supabase.co/functions/v1/share-card';
const LINK = /^[0-9A-Za-z]{10}$/;
const FLIGHT_PARAMS = ['c', 'd', 'e', 's'];

// The card a path names: its share-card query (without format) and, for a page, the exported page that serves it.
function cardOf(url) {
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const lang = parts[0] === 'en' ? 'en' : 'zh';
  const rest = lang === 'en' ? parts.slice(1) : parts;
  const query = new URLSearchParams({ lang });
  // /card/zh/fare/<id>.png, /card/en/plan/<id>.png, /card/zh/flight.png?c=…&d=…&e=…&s=…
  if (parts[0] === 'card') {
    const [, cardLang, kind, file] = parts;
    query.set('lang', cardLang === 'en' ? 'en' : 'zh');
    if ((kind === 'fare' || kind === 'plan') && file && LINK.test(file.replace(/\.png$/, ''))) {
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
  // /share/fare/<id>, /share/plan/<id>, /share/flight?c=…, each also under /en
  if (rest[0] !== 'share') return null;
  const page = `${lang === 'en' ? '/en' : ''}/share/${rest[1]}`;
  if ((rest[1] === 'fare' || rest[1] === 'plan') && rest[2] && LINK.test(rest[2])) {
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
  const [page, meta] = await Promise.all([
    env.ASSETS.fetch(new Request(new URL(card.page, url.origin), request)),
    // share-card answers in well under a second, or about 3 when it has just started; a page that gave up would
    // leave LINE and Facebook showing the site's picture for that link for days.
    fetch(`${CARDS}?${card.query}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  if (!page.ok) return page;
  // The picture's address carries share-card's version of the card, so an hour-old picture is not shown beside new words.
  const version = meta && meta.version ? `${card.picture.includes('?') ? '&' : '?'}v=${encodeURIComponent(meta.version)}` : '';
  const picture = meta ? `${url.origin}${card.picture}${version}` : `${url.origin}/og.png`;
  const extra = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Flyawait'],
    ['property', 'og:url', url.href],
    ['property', 'og:image', picture],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
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
