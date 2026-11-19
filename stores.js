// Poodide nimekirja lugemine (sites.txt) ja poe lehelt pakkumiste skreipimine.
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { isMatch, parsePrice } = require('./match');
const { isAllowed } = require('./robots');

const UA = 'GotADeal/0.1 (oppeprojekt)';
const MAX_ITEMS_PER_PAGE = 15;

function loadStores(file) {
  const stores = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const f = line.split('|').map((x) => x.trim());
    // "auto:/game/" kolmandas väljas = automaatne režiim (selektoreid pole vaja)
    const isAuto = /^auto:/i.test(f[2] || '');
    const autoLink = isAuto ? f[2].slice(5).trim() : '';
    const valid =
      f.length >= 3 && f[1].includes('{query}') && (isAuto ? autoLink !== '' : f.length >= 5);
    if (!valid) {
      console.warn(`sites.txt rida ${i + 1}: vigane formaat, jätan vahele`);
      return;
    }
    stores.push({
      name: f[0],
      searchUrl: f[1],
      autoLink,
      itemSel: isAuto ? '' : f[2],
      titleSel: f[3] || '',
      priceSel: f[4] || '',
      linkSel: f[5] || '',
      durationSel: f[6] || '',
    });
  });
  return stores;
}

function cleanText(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// ---------- Automaatne režiim (ilma CSS-selektoriteta) ----------
// Idee: tootelingid tuntakse ära URL-i mustri järgi (nt "/game/"). Iga toote ümbert otsitakse
// väikseim ümbritsev plokk, kus on hind ja mis ei sisalda teisi tooteid. Pealkiri tuleb lingist/pealkirjast,
// hind plokist (läbikriipsutatud vana hind eemaldatakse, ülejäänutest võetakse odavaim).
const NUM = '\\d+(?:[.,]\\d+)*';
const PRICE_RE = new RegExp(`(?:[€$£]\\s*${NUM}|${NUM}\\s*(?:€|EUR|\\$|USD|£|GBP))`, 'g');
const OLD_PRICE_CLASS = /(^|[\s_-])(old|original|strike|struck|was|msrp|before|regular)([\s_-]|$)/i;
const DURATION_RE =
  /(\d+\s*(?:days?|hours?|tage?|stunden?)\s*(?:left|remaining|übrig)|ends?\s+(?:in|on|at)\s+[^.|]{1,30}|endet\s+[^.|]{1,30})/i;

function stripOldPrices($, node) {
  const clone = $(node).clone();
  clone.find('*').append(' '); // tühikud elementide vahele, et "Pealkiri9,99 €" ei liituks
  clone.find('del, s, strike').remove();
  clone
    .find('[class]')
    .filter((_, e) => OLD_PRICE_CLASS.test($(e).attr('class') || ''))
    .remove();
  return cleanText(clone.text());
}

function parseAuto(html, store, baseUrl) {
  const $ = cheerio.load(html);
  const isProduct = (href) => href && href.includes(store.autoLink);
  const abs = (href) => {
    try {
      const u = new URL(href, baseUrl);
      u.hash = '';
      return u.toString();
    } catch {
      return null;
    }
  };
  const productUrlsIn = (node) => {
    const set = new Set();
    $(node)
      .find('a[href]')
      .each((_, a) => {
        const h = $(a).attr('href');
        if (isProduct(h) && abs(h)) set.add(abs(h));
      });
    return set;
  };

  const offers = [];
  const done = new Set();
  $('a[href]').each((_, a) => {
    if (offers.length >= MAX_ITEMS_PER_PAGE) return false;
    const href = $(a).attr('href');
    if (!isProduct(href)) return;
    const url = abs(href);
    if (!url || done.has(url)) return;

    // väikseim ümbritsev plokk, kus on hind ja ainult see toode
    let container = null;
    let node = $(a).parent();
    for (let depth = 0; depth < 8 && node.length && !node.is('body, html'); depth++) {
      if (productUrlsIn(node[0]).size > 1) break;
      const text = stripOldPrices($, node[0]);
      if (text.match(PRICE_RE)) {
        container = node;
        break;
      }
      node = node.parent();
    }
    if (!container) return;
    done.add(url);

    const text = stripOldPrices($, container[0]);
    const prices = (text.match(PRICE_RE) || []).map(parsePrice).filter(Boolean);
    if (prices.length === 0) return;
    const best = prices.reduce((x, y) => (y.value < x.value ? y : x));
    const priceText = (text.match(PRICE_RE) || [])[prices.indexOf(best)];

    // pealkiri: esimene kandidaat, mis ei sisalda hinda
    const links = container.find('a[href]').filter((_, l) => abs($(l).attr('href')) === url);
    const candidates = [];
    links.each((_, l) => {
      candidates.push(cleanText($(l).find('h1,h2,h3,h4,h5,h6').first().text()));
    });
    links.each((_, l) => candidates.push(cleanText($(l).text())));
    candidates.push(cleanText(container.find('h1,h2,h3,h4,h5,h6').first().text()));
    links.each((_, l) => candidates.push(cleanText(($(l).attr('title') || '').split('|')[0])));
    links.each((_, l) => candidates.push(cleanText($(l).find('img').first().attr('alt') || '')));
    const title = candidates.find((c) => c && !c.match(PRICE_RE));
    if (!title) return;

    const dm = text.match(DURATION_RE);
    offers.push({
      store: store.name,
      title,
      price: best.value,
      currency: best.currency,
      priceText,
      url,
      duration: dm ? cleanText(dm[0]) : null,
    });
  });
  return offers;
}

// Parsib otsingulehe HTML-i. Eraldi funktsioon, et seda saaks testida ilma võrguta.
function parseSearchPage(html, store, baseUrl) {
  if (store.autoLink) return parseAuto(html, store, baseUrl);
  const $ = cheerio.load(html);
  const offers = [];
  $(store.itemSel)
    .slice(0, MAX_ITEMS_PER_PAGE)
    .each((_, el) => {
      const item = $(el);
      const title = cleanText(item.find(store.titleSel).first().text());
      const priceText = cleanText(item.find(store.priceSel).first().text());

      let href;
      if (store.linkSel) {
        const link = item.find(store.linkSel).first();
        href = link.attr('href') || (item.is(store.linkSel) ? item.attr('href') : undefined);
      }
      if (!href) href = item.find('a[href]').first().attr('href') || item.attr('href');

      if (!title || !priceText || !href) return;
      const price = parsePrice(priceText);
      if (!price) return;

      let url;
      try {
        url = new URL(href, baseUrl).toString();
      } catch {
        return;
      }
      const duration = store.durationSel
        ? cleanText(item.find(store.durationSel).first().text()) || null
        : null;

      offers.push({
        store: store.name,
        title,
        price: price.value,
        currency: price.currency,
        priceText,
        url,
        duration,
      });
    });
  return offers;
}

// Otsib poest mängu. Tagastab odavaima sobiva pakkumise (või null).
async function searchStore(store, gameName) {
  const url = store.searchUrl.replace('{query}', encodeURIComponent(gameName));
  if (!(await isAllowed(url))) {
    throw new Error('robots.txt keelab selle otsingu');
  }
  const res = await axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en,et;q=0.8' },
    responseType: 'text',
  });
  const all = parseSearchPage(res.data, store, url);
  const matching = all.filter((o) => isMatch(gameName, o.title));
  matching.sort((a, b) => a.price - b.price);
  return { offer: matching[0] || null, seen: all.length };
}

module.exports = { loadStores, searchStore, parseSearchPage };
