// Steam: kasutajanime/ID -> SteamID64 -> wishlist -> mängu nimi ja Steami hind.
const axios = require('axios');
const cheerio = require('cheerio');

const http = axios.create({
  timeout: 20000,
  headers: { 'User-Agent': 'GotADeal/0.1 (oppeprojekt)', 'Accept-Language': 'en' },
});

// Aktsepteerib: kasutajanimi (vanity), 17-kohaline SteamID64 või profiili link.
async function resolveSteamId(input) {
  let value = String(input || '').trim();
  if (!value) throw new Error('Sisesta Steami konto nimi või ID');

  let m = value.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (m) return m[1];
  m = value.match(/steamcommunity\.com\/id\/([^/?#]+)/);
  if (m) value = m[1];
  if (/^\d{17}$/.test(value)) return value;

  const res = await http.get(
    `https://steamcommunity.com/id/${encodeURIComponent(value)}/?xml=1`,
    { responseType: 'text' },
  );
  const $ = cheerio.load(res.data, { xmlMode: true });
  const id = $('steamID64').first().text().trim();
  if (!/^\d{17}$/.test(id)) {
    throw new Error(`Steami kontot "${value}" ei leitud`);
  }
  return id;
}

// Tagastab wishlisti appid-de massiivi. Wishlist peab olema avalik.
async function getWishlist(steamId) {
  const res = await http.get('https://api.steampowered.com/IWishlistService/GetWishlist/v1/', {
    params: { steamid: steamId },
  });
  const items = res.data && res.data.response && res.data.response.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(
      'Wishlist on tühi või privaatne. Kontrolli Steamis: Profiil -> Muuda profiili -> Privaatsusseaded -> "Game details" = Public.',
    );
  }
  return items.sort((a, b) => (a.priority || 0) - (b.priority || 0)).map((x) => x.appid);
}

const infoCache = new Map();

// Mängu nimi ja Steami hind eurodes.
async function getAppInfo(appid) {
  if (infoCache.has(appid)) return infoCache.get(appid);
  const res = await http.get('https://store.steampowered.com/api/appdetails', {
    params: { appids: appid, cc: 'ee', l: 'english', filters: 'basic,price_overview' },
  });
  const entry = res.data && res.data[appid];
  let info = null;
  if (entry && entry.success && entry.data && entry.data.name) {
    const p = entry.data.price_overview;
    info = {
      appid,
      name: entry.data.name,
      steamUrl: `https://store.steampowered.com/app/${appid}`,
      price: p ? p.final / 100 : null,
      initialPrice: p ? p.initial / 100 : null,
      discountPercent: p ? p.discount_percent : 0,
      priceText: p ? p.final_formatted : null,
      currency: p ? p.currency : null,
    };
  }
  infoCache.set(appid, info);
  return info;
}

module.exports = { resolveSteamId, getWishlist, getAppInfo };
