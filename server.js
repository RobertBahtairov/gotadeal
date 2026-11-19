// GotADeal – kohalik veebiserver. Käivita: npm start, ava http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { resolveSteamId, getWishlist, getAppInfo } = require('./steam');
const { loadStores, searchStore } = require('./stores');

const PORT = Number(process.env.PORT) || 3000;
const MAX_GAMES = Number(process.env.MAX_GAMES) || 100; // piir, et Steami ja poode mitte üle koormata
const STORE_DELAY_MS = Number(process.env.STORE_DELAY_MS ?? 1000); // paus poe päringute vahel
const SITES_FILE = path.join(__dirname, 'sites.txt');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handleSearch(req, res, userInput) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  let aborted = false;
  req.on('close', () => {
    aborted = true;
  });
  const send = (event, data) => {
    if (!aborted) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const stores = loadStores(SITES_FILE); // loetakse igal otsingul uuesti
    if (stores.length === 0) throw new Error('sites.txt failis pole ühtegi poodi');

    send('status', { message: 'Otsin Steami kontot...' });
    const steamId = await resolveSteamId(userInput);

    send('status', { message: 'Loen wishlisti...' });
    const allIds = await getWishlist(steamId);
    const appIds = allIds.slice(0, MAX_GAMES);
    send('start', {
      steamId,
      total: appIds.length,
      wishlistSize: allIds.length,
      stores: stores.map((s) => s.name),
    });

    for (let i = 0; i < appIds.length && !aborted; i++) {
      let info;
      try {
        info = await getAppInfo(appIds[i]);
      } catch {
        info = null;
      }
      if (!info) {
        send('game', { index: i, appid: appIds[i], name: `Tundmatu mäng (appid ${appIds[i]})`, offers: [], storeNotes: [], skipped: true });
        continue;
      }

      const offers = [];
      const storeNotes = [];
      for (const store of stores) {
        if (aborted) break;
        try {
          const { offer, seen } = await searchStore(store, info.name);
          if (offer) {
            if (offer.currency === 'EUR' && info.price != null && info.currency === 'EUR') {
              offer.diffVsSteam = Math.round((info.price - offer.price) * 100) / 100;
            }
            offers.push(offer);
          } else {
            storeNotes.push({ store: store.name, note: seen === 0 ? 'lehelt ei leitud ühtegi toodet (kontrolli selektoreid)' : `${seen} tulemust, ükski ei sobinud nimega` });
          }
        } catch (err) {
          storeNotes.push({ store: store.name, note: 'viga: ' + (err.message || err) });
        }
        await sleep(STORE_DELAY_MS);
      }
      offers.sort((a, b) => a.price - b.price);

      send('game', {
        index: i,
        appid: info.appid,
        name: info.name,
        steam: {
          url: info.steamUrl,
          price: info.price,
          priceText: info.priceText,
          discountPercent: info.discountPercent,
          initialPrice: info.initialPrice,
        },
        offers,
        storeNotes,
      });
      await sleep(250); // Steami päringute piirang
    }
    send('done', {});
  } catch (err) {
    let message = err.message || String(err);
    if (err.isAxiosError) {
      const host = err.config && err.config.url ? new URL(err.config.url).hostname : 'server';
      message = err.response
        ? `${host} vastas veaga ${err.response.status}`
        : `Ühendus ${host} külge ebaõnnestus (${err.code || 'võrguviga'})`;
    }
    send('fail', { message });
  }
  res.end();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  } else if (url.pathname === '/api/search') {
    handleSearch(req, res, url.searchParams.get('user'));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ei leitud');
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`GotADeal töötab: http://localhost:${PORT}`);
  });
}

module.exports = { server };