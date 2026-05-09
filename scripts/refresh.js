#!/usr/bin/env node
/**
 * Master refresh script - runs every Sunday via GitHub Actions.
 *
 * Pipeline:
 * 1. Pull music events for selected artists across US (May-Dec) + EU (Sep-Dec) - Ticketmaster + SeatGeek + Songkick
 * 2. Pull ALL comedy events across all cities (no artist filter) - Ticketmaster
 * 3. Add static Sphere shows (Metallica, Backstreet Boys)
 * 4. Apply NYC borough filter (Manhattan / Brooklyn / Queens only)
 * 5. Filter past events
 * 6. Build index.html
 *
 * On failure of any single search, falls back to existing concert-results.json data
 * for that source so we never lose everything.
 */
const fs = require('fs');
const path = require('path');
const { TM_KEY, SG_KEY, US_CITIES, EU_CITIES, VENUE_MAP, EU_CITY_KEYS, sleep, classifyTheaterEvent } = require('./config');

const REPO_ROOT = path.join(__dirname, '..');
const SELECTED_PATH = path.join(REPO_ROOT, 'data', 'selected-artists.json');
const RESULTS_PATH = path.join(REPO_ROOT, 'data', 'concert-results.json');
const META_PATH = path.join(REPO_ROOT, 'data', 'last-refresh.json');

const TODAY = new Date().toISOString().substring(0, 10);

const selected = JSON.parse(fs.readFileSync(SELECTED_PATH, 'utf8'));
const SELECTED_SET = new Set(selected.map(a => a.toLowerCase()));
const isSelected = n => SELECTED_SET.has((n || '').toLowerCase());

console.log(`[${new Date().toISOString()}] Refresh starting`);
console.log(`Selected artists: ${selected.length}`);

let priorEvents = [];
try {
  priorEvents = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  console.log(`Prior events: ${priorEvents.length}`);
} catch (e) {
  console.log('No prior data');
}

// ============================================================
// SEARCH FUNCTIONS
// ============================================================

async function searchTM_Music_US(cityKey, cityInfo) {
  const events = [];
  let page = 0;
  while (page < 5) {
    const params = new URLSearchParams({
      apikey: TM_KEY,
      classificationName: 'music',
      startDateTime: '2026-05-01T00:00:00Z',
      endDateTime: '2026-12-31T23:59:59Z',
      size: '200', page: String(page), sort: 'date,asc',
    });
    if (cityInfo.kind === 'dma') params.set('dmaId', cityInfo.dmaId);
    else { params.set('city', cityInfo.city); params.set('stateCode', cityInfo.state); }
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    if (res.status === 429) { await sleep(2000); continue; }
    if (!res.ok) break;
    const data = await res.json();
    if (!data._embedded || !data._embedded.events) break;
    for (const ev of data._embedded.events) {
      const venue = (ev._embedded?.venues || [{}])[0];
      const vc = (venue.city?.name || '').toLowerCase();
      const resolvedCity = VENUE_MAP[vc];
      if (!resolvedCity || !US_CITIES[resolvedCity]) continue;
      const attractions = ev._embedded?.attractions || [];
      const matched = attractions.map(a => a.name).filter(isSelected);
      const title = (ev.name || '').toLowerCase();
      for (const sel of selected) {
        if (sel.length > 4 && title.includes(sel.toLowerCase()) && !matched.some(a => a.toLowerCase() === sel.toLowerCase())) matched.push(sel);
      }
      if (matched.length === 0) continue;
      const start = ev.dates?.start || {};
      const pr = ev.priceRanges || [];
      events.push({
        id: ev.id, name: ev.name || '', artists: matched,
        date: start.localDate || '', time: start.localTime || '',
        venue: venue.name || '', venueCity: venue.city?.name || '',
        url: ev.url || '',
        minPrice: pr[0]?.min || null, maxPrice: pr[0]?.max || null,
        city: resolvedCity, cityLabel: US_CITIES[resolvedCity].label, region: 'US',
        source: 'ticketmaster', category: 'music',
      });
    }
    if (page >= (data.page?.totalPages || 1) - 1) break;
    page++;
    await sleep(250);
  }
  return events;
}

async function searchSG_Music_US(cityKey, cityInfo) {
  const events = [];
  let page = 1;
  while (page <= 5) {
    const params = new URLSearchParams({
      client_id: SG_KEY,
      'taxonomies.name': 'concert',
      lat: cityInfo.lat, lon: cityInfo.lon, range: cityInfo.sgRange,
      'datetime_utc.gte': '2026-05-01', 'datetime_utc.lte': '2026-12-31',
      per_page: '100', page: String(page),
    });
    const res = await fetch(`https://api.seatgeek.com/2/events?${params}`);
    if (!res.ok) break;
    const data = await res.json();
    if (!data.events?.length) break;
    for (const ev of data.events) {
      const venue = ev.venue || {};
      const vc = (venue.city || '').toLowerCase();
      const resolvedCity = VENUE_MAP[vc];
      if (!resolvedCity || !US_CITIES[resolvedCity]) continue;
      const performers = ev.performers || [];
      const matched = performers.map(p => p.name).filter(isSelected);
      const title = (ev.title || '').toLowerCase();
      for (const sel of selected) {
        if (sel.length > 4 && title.includes(sel.toLowerCase()) && !matched.some(a => a.toLowerCase() === sel.toLowerCase())) matched.push(sel);
      }
      if (matched.length === 0) continue;
      events.push({
        id: 'sg-' + ev.id, name: ev.title || '', artists: matched,
        date: (ev.datetime_local || '').substring(0, 10),
        time: (ev.datetime_local || '').substring(11, 16),
        venue: venue.name || '', venueCity: venue.city || '',
        url: ev.url || '',
        minPrice: ev.stats?.lowest_price || null,
        city: resolvedCity, cityLabel: US_CITIES[resolvedCity].label, region: 'US',
        source: 'seatgeek', category: 'music',
      });
    }
    if (data.events.length < 100) break;
    page++;
    await sleep(300);
  }
  return events;
}

async function searchTM_Music_EU(cityKey, cityInfo) {
  const events = [];
  // Two windows: April 24-30 + Sep-Dec
  const windows = [
    { start: '2026-04-24T00:00:00Z', end: '2026-04-30T23:59:59Z' },
    { start: '2026-09-01T00:00:00Z', end: '2026-12-31T23:59:59Z' },
  ];
  for (const w of windows) {
    let page = 0;
    while (page < 5) {
      const params = new URLSearchParams({
        apikey: TM_KEY, classificationName: 'music',
        countryCode: cityInfo.countryCode, city: cityInfo.city,
        startDateTime: w.start, endDateTime: w.end,
        size: '200', page: String(page),
      });
      const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
      if (res.status === 429) { await sleep(2000); continue; }
      if (!res.ok) break;
      const data = await res.json();
      if (!data._embedded?.events) break;
      for (const ev of data._embedded.events) {
        const attractions = ev._embedded?.attractions || [];
        const venue = (ev._embedded?.venues || [{}])[0];
        const matched = attractions.map(a => a.name).filter(isSelected);
        const title = (ev.name || '').toLowerCase();
        for (const sel of selected) {
          if (sel.length > 4 && title.includes(sel.toLowerCase()) && !matched.some(a => a.toLowerCase() === sel.toLowerCase())) matched.push(sel);
        }
        if (matched.length === 0) continue;
        const start = ev.dates?.start || {};
        const pr = ev.priceRanges || [];
        events.push({
          id: ev.id, name: ev.name || '', artists: matched,
          date: start.localDate || '', time: start.localTime || '',
          venue: venue.name || '', venueCity: venue.city?.name || '',
          url: ev.url || '',
          minPrice: pr[0]?.min || null,
          city: cityKey, cityLabel: cityInfo.label, region: 'EU',
          source: 'ticketmaster', category: 'music',
        });
      }
      if (page >= (data.page?.totalPages || 1) - 1) break;
      page++;
      await sleep(250);
    }
    await sleep(300);
  }
  return events;
}

async function searchSongkick_EU(cityKey, cityInfo) {
  const events = [];
  const seenUrls = new Set();
  const months = ['april-2026','september-2026','october-2026','november-2026','december-2026'];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0',
    'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
  };
  for (const m of months) {
    let page = 1;
    while (page <= 8) {
      const url = `https://www.songkick.com/metro-areas/${cityInfo.sk}/${m}${page > 1 ? '?page=' + page : ''}`;
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) break;
        const html = await res.text();
        const scripts = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
        let newOnPage = 0;
        for (const sm of scripts) {
          try {
            const data = JSON.parse(sm[1]);
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
              if (!['MusicEvent','Event','Festival'].includes(item['@type'])) continue;
              if (seenUrls.has(item.url)) continue;
              seenUrls.add(item.url);
              newOnPage++;
              const date = (item.startDate || '').substring(0, 10);
              if (!date || (date < '2026-04-24') || (date > '2026-12-31')) continue;
              if (date >= '2026-05-01' && date < '2026-09-01') continue; // EU only Apr 24-30 & Sep-Dec
              const performers = Array.isArray(item.performer) ? item.performer : (item.performer ? [item.performer] : []);
              const matched = performers.map(p => p.name || p).filter(isSelected);
              const evName = item.name || '';
              for (const sel of selected) {
                if (sel.length > 4 && evName.toLowerCase().includes(sel.toLowerCase()) && !matched.some(a => a.toLowerCase() === sel.toLowerCase())) matched.push(sel);
              }
              if (matched.length === 0) continue;
              events.push({
                id: 'sk-' + (item.url || '').split('/').pop(),
                name: item.name || '', artists: matched,
                date, time: '',
                venue: item.location?.name || '', venueCity: item.location?.address?.addressLocality || '',
                url: item.url || '',
                city: cityKey, cityLabel: cityInfo.label, region: 'EU',
                source: 'songkick', category: 'music',
              });
            }
          } catch (e) {}
        }
        if (newOnPage < 30) break;
        page++;
        await sleep(500);
      } catch (e) { break; }
    }
    await sleep(300);
  }
  return events;
}

async function searchTM_Comedy(cityKey, cityInfo) {
  const events = [];
  let page = 0;
  while (page < 5) {
    const params = new URLSearchParams({
      apikey: TM_KEY, classificationName: 'Comedy',
      startDateTime: TODAY + 'T00:00:00Z',
      endDateTime: '2026-12-31T23:59:59Z',
      size: '200', page: String(page), sort: 'date,asc',
    });
    if (cityInfo.kind === 'dma') params.set('dmaId', cityInfo.dmaId);
    else { params.set('city', cityInfo.city); params.set('stateCode', cityInfo.state); }
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    if (res.status === 429) { await sleep(2000); continue; }
    if (!res.ok) break;
    const data = await res.json();
    if (!data._embedded?.events) break;
    for (const ev of data._embedded.events) {
      const venue = (ev._embedded?.venues || [{}])[0];
      const vc = (venue.city?.name || '').toLowerCase();
      const resolvedCity = VENUE_MAP[vc];
      if (!resolvedCity || !US_CITIES[resolvedCity]) continue;  // strict: must match venue map
      const attractions = ev._embedded?.attractions || [];
      let artists = attractions.map(a => a.name).filter(Boolean);
      if (artists.length === 0) artists = [ev.name || 'Comedy Show'];
      const start = ev.dates?.start || {};
      const pr = ev.priceRanges || [];
      events.push({
        id: ev.id, name: ev.name || '', artists,
        date: start.localDate || '', time: start.localTime || '',
        venue: venue.name || '', venueCity: venue.city?.name || '',
        url: ev.url || '',
        minPrice: pr[0]?.min || null,
        city: resolvedCity, cityLabel: US_CITIES[resolvedCity].label, region: 'US',
        source: 'ticketmaster', category: 'comedy',
      });
    }
    if (page >= (data.page?.totalPages || 1) - 1) break;
    page++;
    await sleep(250);
  }
  return events;
}

// Theater pull (Arts & Theatre segment) - tagged broadway or off-broadway by venue
async function searchTM_Theatre(cityKey, cityInfo) {
  const events = [];
  let page = 0;
  while (page < 5) {
    const params = new URLSearchParams({
      apikey: TM_KEY, segmentName: 'Arts & Theatre',
      startDateTime: TODAY + 'T00:00:00Z',
      endDateTime: '2026-12-31T23:59:59Z',
      size: '200', page: String(page), sort: 'date,asc',
    });
    if (cityInfo.kind === 'dma') params.set('dmaId', cityInfo.dmaId);
    else { params.set('city', cityInfo.city); params.set('stateCode', cityInfo.state); }
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    if (res.status === 429) { await sleep(2000); continue; }
    if (!res.ok) break;
    const data = await res.json();
    if (!data._embedded?.events) break;
    for (const ev of data._embedded.events) {
      const venue = (ev._embedded?.venues || [{}])[0];
      const vc = (venue.city?.name || '').toLowerCase();
      const resolvedCity = VENUE_MAP[vc];
      if (!resolvedCity || !US_CITIES[resolvedCity]) continue;  // strict: must match venue map

      const cat = classifyTheaterEvent(ev.name, venue.name);
      if (!cat) continue; // skip if not Broadway or Off-Broadway

      const attractions = ev._embedded?.attractions || [];
      let artists = attractions.map(a => a.name).filter(Boolean);
      if (artists.length === 0) artists = [ev.name || 'Theater Show'];
      const start = ev.dates?.start || {};
      const pr = ev.priceRanges || [];
      events.push({
        id: ev.id, name: ev.name || '', artists,
        date: start.localDate || '', time: start.localTime || '',
        venue: venue.name || '', venueCity: venue.city?.name || '',
        url: ev.url || '',
        minPrice: pr[0]?.min || null,
        city: resolvedCity, cityLabel: US_CITIES[resolvedCity].label, region: 'US',
        source: 'ticketmaster', category: cat,  // 'broadway' or 'off-broadway'
      });
    }
    if (page >= (data.page?.totalPages || 1) - 1) break;
    page++;
    await sleep(250);
  }
  return events;
}

// Static Sphere shows (Metallica + Backstreet Boys residencies)
function getSphereShows() {
  const events = [];
  const bsbDates = ['2026-08-06','2026-08-07','2026-08-08','2026-08-13','2026-08-14','2026-08-15','2026-08-20','2026-08-21','2026-08-22','2026-08-27','2026-08-28','2026-08-29'];
  for (const d of bsbDates) events.push({
    id: 'sphere-bsb-' + d, name: 'Backstreet Boys at Sphere', artists: ['Backstreet Boys'],
    date: d, time: '20:00', venue: 'Sphere', venueCity: 'Las Vegas',
    url: 'https://www.ticketmaster.com/sphere-tickets-las-vegas/venue/189524',
    minPrice: 182, city: 'vegas', cityLabel: 'Las Vegas, NV', region: 'US',
    source: 'manual', category: 'music',
  });
  const metDates = ['2026-10-01','2026-10-03','2026-10-08','2026-10-10','2026-10-15','2026-10-17','2026-10-22','2026-10-24','2026-10-29','2026-10-31','2026-11-05','2026-11-07'];
  const metPrices = [676,785,600,616,617,728,644,720,624,662,556,676];
  for (let i = 0; i < metDates.length; i++) events.push({
    id: 'sphere-met-' + metDates[i], name: 'Metallica: Life Burns Faster at Sphere',
    artists: ['Metallica'], date: metDates[i], time: '20:00',
    venue: 'Sphere', venueCity: 'Las Vegas',
    url: 'https://www.ticketmaster.com/metallica-tickets/artist/735647?venueId=189524',
    minPrice: metPrices[i], city: 'vegas', cityLabel: 'Las Vegas, NV', region: 'US',
    source: 'manual', category: 'music',
  });
  return events;
}

// ============================================================
// PIPELINE
// ============================================================

async function safeRun(name, fn) {
  try {
    const result = await fn();
    console.log(`  ✓ ${name}: ${result.length}`);
    return result;
  } catch (e) {
    console.error(`  ✗ ${name} failed: ${e.message}`);
    return null; // null = use prior data for this source
  }
}

async function main() {
  const all = [];
  const failures = [];

  console.log('\n=== US Music ===');
  for (const [k, info] of Object.entries(US_CITIES)) {
    console.log(info.label);
    const tm = await safeRun('TM', () => searchTM_Music_US(k, info));
    await sleep(300);
    const sg = await safeRun('SG', () => searchSG_Music_US(k, info));
    if (tm) all.push(...tm); else failures.push(`tm-music-${k}`);
    if (sg) all.push(...sg); else failures.push(`sg-music-${k}`);
    await sleep(300);
  }

  console.log('\n=== EU Music ===');
  for (const [k, info] of Object.entries(EU_CITIES)) {
    console.log(info.label);
    const tm = await safeRun('TM', () => searchTM_Music_EU(k, info));
    const sk = await safeRun('SK', () => searchSongkick_EU(k, info));
    if (tm) all.push(...tm); else failures.push(`tm-music-${k}`);
    if (sk) all.push(...sk); else failures.push(`sk-music-${k}`);
    await sleep(500);
  }

  console.log('\n=== US Comedy (all events) ===');
  for (const [k, info] of Object.entries(US_CITIES)) {
    console.log(info.label);
    const tm = await safeRun('TM', () => searchTM_Comedy(k, info));
    if (tm) {
      // Re-classify theater events that came in via Comedy classification
      for (const ev of tm) {
        const cat = classifyTheaterEvent(ev.name, ev.venue);
        if (cat) ev.category = cat;
      }
      all.push(...tm);
    } else failures.push(`tm-comedy-${k}`);
    await sleep(300);
  }

  console.log('\n=== US Theater (Broadway / Off-Broadway) ===');
  for (const [k, info] of Object.entries(US_CITIES)) {
    console.log(info.label);
    const tm = await safeRun('TM', () => searchTM_Theatre(k, info));
    if (tm) all.push(...tm); else failures.push(`tm-theater-${k}`);
    await sleep(300);
  }

  console.log('\n=== Sphere static ===');
  all.push(...getSphereShows());

  // For sources that failed, fall back to prior data
  if (failures.length > 0 && priorEvents.length > 0) {
    console.log(`\nFallback: ${failures.length} failed sources, restoring prior data for those`);
    for (const f of failures) {
      // Match prior events by source-city
      const [src, cat, city] = f.split('-');
      const sourceMap = { tm: 'ticketmaster', sg: 'seatgeek', sk: 'songkick' };
      const prior = priorEvents.filter(e => e.source === sourceMap[src] && e.category === cat && e.city === city);
      all.push(...prior);
    }
  }

  // Apply filters
  console.log('\nFiltering and dedup...');
  const filtered = all.filter(ev => {
    if (!ev.date || ev.date < '2026-04-24' || ev.date > '2026-12-31') return false;
    // EU: only Apr 24-30 & Sep-Dec
    if (EU_CITY_KEYS.includes(ev.city) && ev.date >= '2026-05-01' && ev.date < '2026-09-01') return false;
    // NYC: Manhattan/Brooklyn/Queens only
    if (ev.city === 'nyc') {
      const allowed = new Set(['new york','manhattan','brooklyn','queens','forest hills','long island city','astoria','flushing','williamsburg','bushwick']);
      const vc = (ev.venueCity || '').toLowerCase();
      if (vc && !allowed.has(vc)) return false;
    }
    // Filter past events (older than today)
    if (ev.date < TODAY) return false;
    return true;
  });

  // Dedup
  const seen = new Set();
  const deduped = [];
  for (const ev of filtered) {
    const key = `${ev.date}|${(ev.venue || '').toLowerCase()}|${(ev.artists[0] || '').toLowerCase().substring(0, 30)}|${ev.city}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(ev); }
  }
  deduped.sort((a, b) => a.date.localeCompare(b.date));

  // Compute delta
  const priorIds = new Set(priorEvents.map(e => `${e.date}|${(e.venue||'').toLowerCase()}|${(e.artists[0]||'').toLowerCase().substring(0,30)}|${e.city}`));
  const newCount = deduped.filter(e => !priorIds.has(`${e.date}|${(e.venue||'').toLowerCase()}|${(e.artists[0]||'').toLowerCase().substring(0,30)}|${e.city}`)).length;

  const musicCount = deduped.filter(e => e.category === 'music').length;
  const comedyCount = deduped.filter(e => e.category === 'comedy').length;

  console.log(`\nTotal: ${deduped.length} | Music: ${musicCount} | Comedy: ${comedyCount} | New since last refresh: ${newCount}`);

  // Save data
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(deduped, null, 2));
  fs.writeFileSync(META_PATH, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: deduped.length,
    music: musicCount,
    comedy: comedyCount,
    newCount,
    failedSources: failures,
  }, null, 2));

  console.log('\nBuilding HTML...');
  // Defer to build script
  require('./build');
  console.log('Done.');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
