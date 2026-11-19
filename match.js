// Mängu nime sobitamine: leiab, kas poe toote pealkiri on SAMA mäng, mida kasutaja tahab.
// Nt. "@dom" ja "adom" on kaks eri mängu, aga "Hades" ja "Hades Steam Key GLOBAL" on sama.

// Sõnad, mida poed lisavad pealkirja otsa ja mis ei muuda mängu ennast.
const NOISE = new Set([
  'pc', 'steam', 'key', 'global', 'eu', 'europe', 'row', 'digital', 'download',
  'cd', 'code', 'region', 'free', 'worldwide', 'emea', 'ww',
]);

function tokens(text) {
  return String(text)
    .replace(/[™®©]/g, ' ') // enne NFKD-d, muidu muutub ™ tekstiks "TM"
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '') // diakriitikud: é -> e
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // kogu kirjavahemärgid (sh @, ™, ®) -> tühik
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function core(text) {
  return tokens(text).filter((t) => !NOISE.has(t));
}

function isMatch(gameName, productTitle) {
  const g = core(gameName);
  const t = core(productTitle);
  if (g.length === 0 || g.length !== t.length) return false;
  return g.every((word, i) => word === t[i]);
}

// Hinna tekstist (nt "12,99 €", "€1 299.00", "$14.99") number ja valuuta.
function parsePrice(text) {
  if (!text) return null;
  const s = String(text).replace(/ /g, ' ');
  const m = s.match(/\d[\d ]*(?:[.,]\d+)*/);
  if (!m) return null;
  let num = m[0].replace(/ /g, '');
  const lastDot = num.lastIndexOf('.');
  const lastComma = num.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // mõlemad olemas: viimane on kümnendkoha eraldaja
    const dec = Math.max(lastDot, lastComma);
    num = num.slice(0, dec).replace(/[.,]/g, '') + '.' + num.slice(dec + 1);
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? ',' : '.';
    const parts = num.split(sep);
    const last = parts[parts.length - 1];
    if (parts.length > 2 || last.length === 3) {
      num = parts.join(''); // tuhandete eraldaja
    } else {
      num = parts[0] + '.' + last; // kümnendkoht
    }
  }
  const value = parseFloat(num);
  if (Number.isNaN(value)) return null;

  let currency = null;
  if (/€|eur/i.test(s)) currency = 'EUR';
  else if (/\$|usd/i.test(s)) currency = 'USD';
  else if (/£|gbp/i.test(s)) currency = 'GBP';
  return { value, currency };
}

module.exports = { isMatch, parsePrice, tokens };
