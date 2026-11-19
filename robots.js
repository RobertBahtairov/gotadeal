// Kontrollib poe robots.txt faili enne skreipimist (README etapp 3).
const axios = require('axios');

const cache = new Map(); // origin -> reeglite massiiv
const UA = 'GotADeal/0.1 (oppeprojekt)';

function parseRobots(text) {
  // Võtab reeglid gruppidest, mis kehtivad kõigile ("User-agent: *").
  const rules = [];
  let agents = [];
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) agents = [];
      agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if ((key === 'disallow' || key === 'allow') && agents.includes('*')) {
        rules.push({ allow: key === 'allow', path: value });
      }
    }
  }
  return rules;
}

function pathMatches(path, pattern) {
  const re = new RegExp(
    '^' +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\\\$$/, '$'),
  );
  return re.test(path);
}

async function loadRules(origin) {
  try {
    const res = await axios.get(origin + '/robots.txt', {
      timeout: 10000,
      headers: { 'User-Agent': UA },
      responseType: 'text',
      validateStatus: () => true,
    });
    if (res.status !== 200 || typeof res.data !== 'string') return [];
    return parseRobots(res.data);
  } catch {
    return []; // kui robots.txt-d ei saa kätte, ei keela miski
  }
}

async function isAllowed(url) {
  const u = new URL(url);
  let rules = cache.get(u.origin);
  if (!rules) {
    rules = await loadRules(u.origin);
    cache.set(u.origin, rules);
  }
  const path = u.pathname + u.search;
  let best = { len: -1, allow: true };
  for (const r of rules) {
    if (!r.path) continue; // "Disallow:" tühjana = lubab kõike
    if (pathMatches(path, r.path)) {
      if (r.path.length > best.len || (r.path.length === best.len && r.allow)) {
        best = { len: r.path.length, allow: r.allow };
      }
    }
  }
  return best.allow;
}

module.exports = { isAllowed, parseRobots };
