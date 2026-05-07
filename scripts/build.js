#!/usr/bin/env node
/**
 * Build index.html from concert-results.json + selected-artists.json
 *
 * Categories: 'music', 'comedy', 'broadway', 'off-broadway'
 * UI: multi-select category pills, multi-band filter with chips, day-click modal, auto-prune past months
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'concert-results.json'), 'utf8'));
const selectedArtists = new Set(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'selected-artists.json'),'utf8')).map(a => a.toLowerCase()));

const TODAY = new Date().toISOString().substring(0, 10);
const TODAY_MONTH = parseInt(TODAY.substring(5, 7));

const CITY_ORDER = [
  'ac','charleston','chicago','denver','vegas','la','nyc','philadelphia','phoenix','syracuse','tampa','dc',
  'amsterdam','athens','barcelona','berlin','dublin','lisbon','london','madrid','manchester','milan','paris','porto','rome','zagreb',
];
const CITY_LABELS = {
  ac: 'Atlantic City, NJ', charleston: 'Charleston, SC', chicago: 'Chicago, IL', denver: 'Denver, CO',
  vegas: 'Las Vegas, NV', la: 'Los Angeles, CA', nyc: 'New York City, NY',
  philadelphia: 'Philadelphia, PA', phoenix: 'Phoenix / Scottsdale, AZ',
  syracuse: 'Syracuse, NY', tampa: 'Tampa / St. Pete, FL', dc: 'Washington, DC',
  amsterdam: 'Amsterdam, Netherlands', athens: 'Athens, Greece', barcelona: 'Barcelona, Spain',
  berlin: 'Berlin, Germany', dublin: 'Dublin, Ireland', lisbon: 'Lisbon, Portugal',
  london: 'London, UK', madrid: 'Madrid, Spain', manchester: 'Manchester, UK',
  milan: 'Milan, Italy', paris: 'Paris, France', porto: 'Porto, Portugal',
  rome: 'Rome, Italy', zagreb: 'Zagreb, Croatia',
};
const CITY_COLORS = {
  ac: '#6d28d9', charleston: '#0891b2', chicago: '#dc2626', denver: '#7c3aed',
  dc: '#2563eb', la: '#ea580c', nyc: '#16a34a', philadelphia: '#0f4c5c',
  phoenix: '#d97706', syracuse: '#059669', tampa: '#db2777', vegas: '#b91c1c',
  amsterdam: '#f97316', athens: '#0284c7', barcelona: '#eab308', berlin: '#78716c',
  dublin: '#15803d', lisbon: '#be123c', london: '#1e3a8a', madrid: '#991b1b',
  manchester: '#7c2d12', milan: '#1e40af', paris: '#be185d', porto: '#0f766e',
  rome: '#92400e', zagreb: '#4338ca',
};
const CITY_SHORT = {
  ac: 'AC', charleston: 'Charleston', chicago: 'Chicago', denver: 'Denver',
  dc: 'DC', la: 'LA', nyc: 'NYC', philadelphia: 'Philly', phoenix: 'Phoenix',
  syracuse: 'Syracuse', tampa: 'Tampa', vegas: 'Vegas',
  amsterdam: 'Amsterdam', athens: 'Athens', barcelona: 'Barcelona', berlin: 'Berlin',
  dublin: 'Dublin', lisbon: 'Lisbon', london: 'London', madrid: 'Madrid',
  manchester: 'Manchester', milan: 'Milan', paris: 'Paris', porto: 'Porto',
  rome: 'Rome', zagreb: 'Zagreb',
};
const EU_CITY_KEYS = ['amsterdam','athens','barcelona','berlin','dublin','lisbon','london','madrid','manchester','milan','paris','porto','rome','zagreb'];
const US_STATES = {
  phoenix: 'Arizona', la: 'California', denver: 'Colorado', dc: 'District of Columbia',
  tampa: 'Florida', chicago: 'Illinois', ac: 'New Jersey', vegas: 'Nevada',
  nyc: 'New York', syracuse: 'New York', philadelphia: 'Pennsylvania', charleston: 'South Carolina',
};
const EU_COUNTRIES = {
  zagreb: 'Croatia', paris: 'France', berlin: 'Germany', athens: 'Greece',
  dublin: 'Ireland', rome: 'Italy', milan: 'Italy', amsterdam: 'Netherlands',
  lisbon: 'Portugal', porto: 'Portugal', madrid: 'Spain', barcelona: 'Spain',
  london: 'United Kingdom', manchester: 'United Kingdom',
};

const ARTIST_URLS = {
  'pearl jam':'https://pearljam.com/tour','bruce springsteen':'https://brucespringsteen.net/shows/',
  'foo fighters':'https://foofighters.com/tour-dates/','metallica':'https://www.metallica.com/tour/',
  'ed sheeran':'https://www.edsheeran.com/tour/','zach bryan':'https://www.zachbryan.com/tour',
  'sting':'https://www.sting.com/','dave matthews band':'https://www.davematthewsband.com/tours/',
  'guns n\' roses':'https://www.gunsnroses.com/tour','eric clapton':'https://www.ericclapton.com/tour/',
  'harry styles':'https://www.hstyles.co.uk/tour/','backstreet boys':'https://www.backstreetboys.com/events/',
  'billy joel':'https://www.billyjoel.com/tour/','mumford & sons':'https://www.mumfordandsons.com/tour/',
  'twenty one pilots':'https://www.twentyonepilots.com/tour/','iron maiden':'https://ironmaiden.com/tour/',
  'matchbox twenty':'https://matchboxtwenty.com/tour/','goo goo dolls':'https://www.googoodolls.com/tour/',
  'hootie & the blowfish':'https://www.hootie.com/tour/','third eye blind':'https://3eb.com/tour/',
  'weezer':'https://weezer.com/tour/','jimmy eat world':'https://www.jimmyeatworld.com/',
  'muse':'https://muse.mu/tour/','blues traveler':'https://bluestraveler.com/tour/',
  'green day':'https://greenday.com/tour','the strokes':'https://www.thestrokes.com/',
};
const getArtistUrl = n => {
  const known = ARTIST_URLS[(n||'').toLowerCase()];
  if (known) return known;
  return `https://www.google.com/search?q=${encodeURIComponent((n||'').trim() + ' tour 2026')}`;
};

// Category metadata
const CAT_INFO = {
  'music':         { label: 'Music',          color: '#1e3a8a', bg: '#dbeafe' },
  'comedy':        { label: 'Comedy',         color: '#92400e', bg: '#fef3c7' },
  'broadway':      { label: 'Broadway',       color: '#7c2d12', bg: '#fed7aa' },
  'off-broadway':  { label: 'Off-Broadway',   color: '#581c87', bg: '#e9d5ff' },
};

// Filter & process
let events = [];
for (const ev of data) {
  const cleanArtists = [];
  for (const a of (ev.artists || [])) {
    if (selectedArtists.has(a.toLowerCase())) cleanArtists.push(a);
  }
  // For comedy/theater, accept all artists (no selection filter)
  if (ev.category && ev.category !== 'music') {
    if (cleanArtists.length === 0) cleanArtists.push(...(ev.artists || []));
  }
  if (cleanArtists.length === 0) continue;
  if (!CITY_ORDER.includes(ev.city)) continue;
  // Filter past events
  if (ev.date < TODAY) continue;
  ev.artists = cleanArtists;
  ev.region = EU_CITY_KEYS.includes(ev.city) ? 'EU' : 'US';
  if (!ev.category) ev.category = 'music';
  events.push(ev);
}

// Dedup
const deduped = new Map();
for (const ev of events) {
  const key = `${ev.date}|${ev.venue}|${ev.artists[0]}|${ev.city}|${ev.category}`;
  if (!deduped.has(key)) deduped.set(key, ev);
}
events = Array.from(deduped.values());
events.sort((a, b) => a.date.localeCompare(b.date));

function formatDate(d) {
  if (!d) return 'TBD';
  const dt = new Date(d + 'T12:00:00');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[dt.getDay()]}, ${months[dt.getMonth()]} ${dt.getDate()}`;
}
function formatPrice(ev) {
  if (ev.minPrice && ev.maxPrice) return `$${Math.round(ev.minPrice)} - $${Math.round(ev.maxPrice)}`;
  if (ev.minPrice) return `From $${Math.round(ev.minPrice)}`;
  return '';
}
function monthLabel(d) {
  if (!d) return 'TBD';
  const m = parseInt(d.substring(5, 7));
  const names = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  return names[m] + ' 2026';
}

function eventCard(ev, showCityTag) {
  const price = formatPrice(ev);
  const primary = ev.artists[0];
  const supporting = ev.artists.slice(1);
  const favId = (ev.date + '-' + primary + '-' + ev.city).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const cc = CITY_COLORS[ev.city] || '#525252';
  const cityLabel = CITY_LABELS[ev.city] || ev.cityLabel;
  const primaryUrl = getArtistUrl(primary);
  const artistDisp = `<a href="${primaryUrl}" target="_blank" rel="noopener noreferrer" style="font-size:18px;font-weight:700;color:#1a1a1a;text-decoration:none;border-bottom:1px dashed #a3a3a3">${primary}</a>`;
  const supportingHtml = supporting.map(s => `<a href="${getArtistUrl(s)}" target="_blank" rel="noopener noreferrer" style="color:#525252;text-decoration:none;border-bottom:1px dashed #d4d4d4">${s}</a>`).join(', ');
  const cityTagHtml = showCityTag ? `<div style="margin-top:10px"><span style="display:inline-block;font-size:14px;font-weight:700;background:${cc};color:#fff;padding:4px 12px;border-radius:6px">${cityLabel}</span></div>` : '';
  const artistQ = encodeURIComponent(primary);
  const cityQ = encodeURIComponent((cityLabel || '').split(',')[0]);
  const isTM = (ev.url || '').includes('ticketmaster') || (ev.url || '').includes('livenation');
  const isSG = (ev.url || '').includes('seatgeek');
  const tmUrl = isTM ? ev.url : `https://www.ticketmaster.com/search?q=${artistQ}`;
  const sgUrl = isSG ? ev.url : `https://seatgeek.com/search?search=${artistQ}`;
  const shUrl = `https://www.stubhub.com/secure/search?q=${artistQ}+${cityQ}`;
  const cat = ev.category || 'music';
  const catInfo = CAT_INFO[cat] || CAT_INFO.music;
  const allArtists = ev.artists.map(a => a.toLowerCase()).join('|');
  return `
  <div class="event-card" data-fav-id="${favId}" data-category="${cat}" data-artist-keys="${allArtists}" data-city="${ev.city}" data-search="${(ev.artists.join(' ')+' '+ev.venue+' '+cityLabel).toLowerCase()}" style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;margin-bottom:16px;padding:20px 24px">
    <div class="event-flex" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div style="flex:1;min-width:200px">
        <div class="fav-artist-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button onclick="toggleFav('${favId}',this)" class="fav-btn" data-fav="${favId}" style="background:none;border:none;cursor:pointer;font-size:22px;padding:0;line-height:1;color:#d4d4d4">&#9734;</button>
          <span class="artist-line">${artistDisp}</span>
          <span style="display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2px 8px;border-radius:4px;background:${catInfo.bg};color:${catInfo.color}">${catInfo.label}</span>
        </div>
        ${supportingHtml ? `<div class="pad-left" style="font-size:14px;color:#525252;margin-top:4px;padding-left:32px">w/ ${supportingHtml}</div>` : ''}
        <div class="pad-left" style="font-size:14px;color:#737373;margin-top:6px;padding-left:32px">${formatDate(ev.date)} &middot; ${ev.venue}${ev.venueCity ? ', ' + ev.venueCity : ''}</div>
        ${cityTagHtml ? `<div class="pad-left" style="padding-left:32px">${cityTagHtml}</div>` : ''}
        ${price ? `<div class="pad-left" style="font-size:13px;color:#525252;font-weight:500;margin-top:6px;padding-left:32px">${price}</div>` : ''}
      </div>
      <div class="buy-btn" style="display:flex;flex-direction:row;gap:4px;align-self:center;flex-wrap:wrap">
        <a href="${tmUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:4px 10px;background:#1a1a1a;color:#fff;font-size:11px;font-weight:600;border-radius:4px;text-decoration:none;${isTM?'':';opacity:0.65'}">TM</a>
        <a href="${sgUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:4px 10px;background:#ff5b49;color:#fff;font-size:11px;font-weight:600;border-radius:4px;text-decoration:none;${isSG?'':';opacity:0.65'}">SG</a>
        <a href="${shUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:4px 10px;background:#ed1b2e;color:#fff;font-size:11px;font-weight:600;border-radius:4px;text-decoration:none;opacity:0.65">SH</a>
      </div>
    </div>
  </div>`;
}

const bandMap = new Map();
for (const ev of events) {
  for (const artist of ev.artists) {
    if (!bandMap.has(artist)) bandMap.set(artist, []);
    bandMap.get(artist).push(ev);
  }
}
const bandsAlpha = Array.from(bandMap.entries()).sort((a, b) => a[0].replace(/^the /i,'').localeCompare(b[0].replace(/^the /i,'')));

let lastRefreshMeta = {};
try { lastRefreshMeta = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'last-refresh.json'),'utf8')); } catch(e) {}

const musicCount = events.filter(e => e.category === 'music').length;
const comedyCount = events.filter(e => e.category === 'comedy').length;
const broadwayCount = events.filter(e => e.category === 'broadway').length;
const offBroadwayCount = events.filter(e => e.category === 'off-broadway').length;

let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>2026 Music and Theater Shows</title>
<meta property="og:title" content="2026 Music and Theater Shows">
<meta property="og:description" content="${events.length} shows. Music, Comedy, Broadway, Off-Broadway across 26 cities. Auto-refreshed weekly.">
<style>
  * { box-sizing: border-box; }
  body { -webkit-text-size-adjust: 100%; }
  .view-section { display: none; }
  .view-section.active { display: block; }
  .sticky-header { position: sticky; z-index: 50; background: #f8f7f4; padding: 12px 0 8px; margin: 0; }
  @media print { #nav-bar { position: relative !important; } .sticky-header { position: relative !important; } }

  /* Calendar day cells - clickable */
  .cal-day { cursor: pointer; transition: background 0.1s; }
  .cal-day.has-events:hover { background: #fef9c3 !important; }

  /* Day modal */
  .modal-backdrop {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 1000;
    display: none; align-items: flex-start; justify-content: center;
    overflow-y: auto; padding: 40px 16px;
  }
  .modal-backdrop.active { display: flex; }
  .modal-content {
    background: #f8f7f4; max-width: 800px; width: 100%;
    border-radius: 14px; padding: 24px 28px; position: relative;
    max-height: calc(100vh - 80px); overflow-y: auto;
  }
  .modal-close {
    position: absolute; top: 14px; right: 14px;
    width: 36px; height: 36px; border: none; border-radius: 999px;
    background: #1a1a1a; color: #fff; font-size: 20px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }

  /* Multi-band filter */
  .band-filter-panel {
    background: #fff; border: 1px solid #e5e5e5; border-radius: 10px;
    padding: 14px 18px; margin: 10px 0;
  }
  .band-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; background: #1a1a1a; color: #fff;
    font-size: 12px; font-weight: 600; border-radius: 999px;
    margin: 2px;
  }
  .band-chip button {
    background: none; border: none; color: #fff; font-size: 14px;
    cursor: pointer; padding: 0; line-height: 1;
  }
  .band-suggestions {
    max-height: 200px; overflow-y: auto;
    border: 1px solid #e5e5e5; border-radius: 6px;
    background: #fff; margin-top: 6px;
  }
  .band-suggestion {
    padding: 6px 12px; font-size: 13px; cursor: pointer;
    border-bottom: 1px solid #f4f4f5;
  }
  .band-suggestion:hover { background: #f4f4f5; }
  .band-suggestion:last-child { border-bottom: none; }

  @media (max-width: 640px) {
    .page-title { font-size: 22px !important; }
    .page-header { padding: 20px 16px !important; }
    #search-box { font-size: 16px !important; }
    #nav-bar { padding: 10px 8px !important; }
    #nav-bar button { padding: 7px 12px !important; font-size: 12px !important; }
    #nav-bar select { min-width: 160px !important; max-width: calc(100vw - 32px) !important; font-size: 14px !important; }
    .view-tabs { flex-wrap: wrap !important; gap: 4px !important; }
    .fav-bar { padding: 10px 14px !important; flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
    .main-container { padding: 12px !important; }
    .event-card { padding: 14px 16px !important; margin-bottom: 12px !important; }
    .event-card .buy-btn { width: auto !important; margin-top: 8px; flex-direction: row !important; justify-content: flex-start !important; gap: 5px !important; padding-left: 32px; }
    .city-section h2 { font-size: 19px !important; }
    .calendar-grid { grid-template-columns: repeat(7, minmax(50px, 1fr)) !important; font-size: 10px !important; }
    .modal-content { padding: 16px 18px; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f8f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.6">

<div class="page-header" style="background:#1a1a1a;padding:32px 24px;text-align:center">
  <h1 class="page-title" style="margin:0;color:#f8f7f4;font-size:28px;font-weight:700;letter-spacing:-0.5px">2026 Music and Theater Shows</h1>
  <p style="margin:8px 0 0;color:#a3a3a3;font-size:14px">${events.length} shows &middot; ${musicCount} music &middot; ${comedyCount} comedy &middot; ${broadwayCount} Broadway &middot; ${offBroadwayCount} Off-Broadway${lastRefreshMeta.timestamp ? ' &middot; refreshed ' + new Date(lastRefreshMeta.timestamp).toLocaleDateString('en-US', {month:'short',day:'numeric'}) : ''}</p>
</div>

<div class="search-wrap" style="background:#1a1a1a;padding:0 24px 16px;text-align:center">
  <div style="max-width:500px;margin:0 auto;position:relative">
    <input type="text" id="search-box" placeholder="Search artists, venues, cities..." oninput="handleSearch(this.value)" style="width:100%;padding:10px 16px 10px 40px;font-size:15px;border:2px solid #3f3f46;border-radius:8px;background:#27272a;color:#f8f7f4;outline:none">
    <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:18px;height:18px" fill="none" stroke="#737373" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
  </div>
</div>

<div style="background:#27272a;padding:12px 16px;text-align:center;position:sticky;top:0;z-index:100" id="nav-bar">
  <!-- Multi-select category pills -->
  <div style="display:flex;justify-content:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
    <button onclick="toggleCategory('music')" id="cat-music" data-active="1" style="padding:7px 16px;font-size:13px;font-weight:800;border:none;border-radius:999px;background:#dbeafe;color:#1e3a8a;cursor:pointer">&#127925; Music (${musicCount})</button>
    <button onclick="toggleCategory('comedy')" id="cat-comedy" data-active="1" style="padding:7px 16px;font-size:13px;font-weight:800;border:none;border-radius:999px;background:#fef3c7;color:#92400e;cursor:pointer">&#127917; Comedy (${comedyCount})</button>
    <button onclick="toggleCategory('broadway')" id="cat-broadway" data-active="1" style="padding:7px 16px;font-size:13px;font-weight:800;border:none;border-radius:999px;background:#fed7aa;color:#7c2d12;cursor:pointer">Broadway (${broadwayCount})</button>
    <button onclick="toggleCategory('off-broadway')" id="cat-off-broadway" data-active="1" style="padding:7px 16px;font-size:13px;font-weight:800;border:none;border-radius:999px;background:#e9d5ff;color:#581c87;cursor:pointer">Off-Broadway (${offBroadwayCount})</button>
  </div>
  <!-- View buttons + Region -->
  <div class="view-tabs" style="display:flex;justify-content:center;gap:4px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
    <button onclick="setView('city')" id="view-city" style="padding:6px 18px;font-size:13px;font-weight:700;border:2px solid #f8f7f4;border-radius:6px;background:#f8f7f4;color:#1a1a1a;cursor:pointer">By City</button>
    <button onclick="setView('band')" id="view-band" style="padding:6px 18px;font-size:13px;font-weight:700;border:2px solid #52525b;border-radius:6px;background:transparent;color:#e4e4e7;cursor:pointer">By Band</button>
    <button onclick="setView('month')" id="view-month" style="padding:6px 18px;font-size:13px;font-weight:700;border:2px solid #52525b;border-radius:6px;background:transparent;color:#e4e4e7;cursor:pointer">By Month</button>
    <button onclick="setView('calendar')" id="view-calendar" style="padding:6px 18px;font-size:13px;font-weight:700;border:2px solid #52525b;border-radius:6px;background:transparent;color:#e4e4e7;cursor:pointer">Calendar</button>
    <span style="width:1px;height:20px;background:#52525b;margin:0 6px"></span>
    <button onclick="setRegion('us')" id="region-us" style="padding:6px 18px;font-size:13px;font-weight:700;border:2px solid #f8f7f4;border-radius:6px;background:#f8f7f4;color:#1a1a1a;cursor:pointer">US</button>
    <button onclick="setRegion('eu')" id="region-eu" style="padding:6px 18px;font-size:13px;font-weight:700;border:2px solid #52525b;border-radius:6px;background:transparent;color:#e4e4e7;cursor:pointer">International</button>
  </div>
  <div id="city-nav" style="display:flex;flex-direction:column;align-items:center;gap:8px;max-width:900px;margin:0 auto">
    <div style="display:flex;justify-content:center;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="city-jump-us" onchange="if(this.value)scrollToCity(this.value)" style="padding:8px 14px;font-size:14px;font-weight:600;border:2px solid #52525b;border-radius:6px;background:#3f3f46;color:#e4e4e7;cursor:pointer;min-width:240px">
        <option value="">Select a US city...</option>`;

const usCities = CITY_ORDER.filter(c => !EU_CITY_KEYS.includes(c));
const stateGroups = {};
for (const c of usCities) {
  const cnt = events.filter(e => e.city === c).length;
  if (cnt === 0) continue;
  const st = US_STATES[c] || 'Other';
  if (!stateGroups[st]) stateGroups[st] = [];
  stateGroups[st].push({ city: c, count: cnt });
}
for (const st of Object.keys(stateGroups).sort()) {
  html += `<optgroup label="${st}">`;
  for (const { city, count } of stateGroups[st]) html += `<option value="${city}">${CITY_LABELS[city]} (${count})</option>`;
  html += `</optgroup>`;
}

html += `</select>
      <select id="city-jump-eu" onchange="if(this.value)scrollToCity(this.value)" style="display:none;padding:8px 14px;font-size:14px;font-weight:600;border:2px solid #52525b;border-radius:6px;background:#3f3f46;color:#e4e4e7;cursor:pointer;min-width:240px">
        <option value="">Select a city...</option>`;

const countryGroups = {};
for (const c of EU_CITY_KEYS) {
  const cnt = events.filter(e => e.city === c).length;
  if (cnt === 0) continue;
  const co = EU_COUNTRIES[c] || 'Other';
  if (!countryGroups[co]) countryGroups[co] = [];
  countryGroups[co].push({ city: c, count: cnt });
}
for (const co of Object.keys(countryGroups).sort()) {
  html += `<optgroup label="${co}">`;
  for (const { city, count } of countryGroups[co]) html += `<option value="${city}">${CITY_LABELS[city]} (${count})</option>`;
  html += `</optgroup>`;
}
html += `</select>
    </div>
  </div>
</div>

<!-- Multi-band filter (always visible) -->
<div style="max-width:900px;margin:14px auto 0;padding:0 16px">
  <div class="band-filter-panel">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:13px;font-weight:700;color:#1a1a1a">Filter by band:</span>
      <input type="text" id="band-filter-input" placeholder="Type a band name..." oninput="updateBandSuggestions(this.value)" onfocus="updateBandSuggestions(this.value)" style="flex:1;min-width:140px;padding:6px 10px;font-size:13px;border:1px solid #e5e5e5;border-radius:6px;outline:none">
      <button onclick="clearAllBands()" style="padding:6px 10px;font-size:11px;border:1px solid #e5e5e5;border-radius:6px;background:#f4f4f5;color:#737373;cursor:pointer">Clear</button>
    </div>
    <div id="band-chips" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px"></div>
    <div id="band-suggestions" class="band-suggestions" style="display:none"></div>
  </div>
</div>

<!-- Favorites bar -->
<div style="max-width:900px;margin:10px auto 0;padding:0 16px">
  <div class="fav-bar" style="background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:12px 18px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:18px">&#9733;</span>
      <span style="font-size:13px;font-weight:600">Click the star to favorite.</span>
      <span id="fav-count" style="font-size:12px;color:#737373">0 favorites</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="toggleFavFilter()" id="fav-filter-btn" style="padding:7px 14px;font-size:12px;font-weight:700;border:2px solid #e5e5e5;border-radius:6px;background:#fff;color:#1a1a1a;cursor:pointer">Favorites Only</button>
      <button onclick="clearAllFavs()" style="padding:7px 12px;font-size:11px;font-weight:500;border:1px solid #e5e5e5;border-radius:6px;background:#f4f4f5;color:#737373;cursor:pointer">Clear Favs</button>
    </div>
  </div>
</div>

<div class="main-container" style="max-width:900px;margin:0 auto;padding:16px">
<div id="view-city-content" class="view-section active">
`;

// CITY VIEW
for (const cityKey of CITY_ORDER) {
  const cityEvents = events.filter(e => e.city === cityKey);
  if (cityEvents.length === 0) continue;
  html += `<div id="city-${cityKey}" class="city-section" data-city-key="${cityKey}" style="padding-top:8px">
  <div class="sticky-header" style="top:var(--nav-h, 90px);border-bottom:2px solid #e5e5e5;margin-bottom:12px">
    <h2 style="font-size:22px;font-weight:700;margin:0">${CITY_LABELS[cityKey]} <span style="font-size:14px;font-weight:400;color:#737373;margin-left:8px">${cityEvents.length} shows</span></h2>
  </div>`;
  const months = {};
  for (const ev of cityEvents) {
    const m = monthLabel(ev.date);
    if (!months[m]) months[m] = [];
    months[m].push(ev);
  }
  for (const [month, monthEvs] of Object.entries(months)) {
    html += `<h3 style="font-size:15px;font-weight:700;color:#525252;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px;border-bottom:2px solid #e5e5e5;padding-bottom:8px">${month}</h3>`;
    for (const ev of monthEvs) html += eventCard(ev, false);
  }
  html += `</div>`;
}
html += `</div>`;

// BAND VIEW
html += `<div id="view-band-content" class="view-section">`;
for (const [name, evs] of bandsAlpha) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const cityCount = new Set(evs.map(e => e.city)).size;
  html += `<div id="band-${slug}" class="band-section" data-band-slug="${slug}" data-band-name="${name.toLowerCase()}" style="margin-bottom:32px">
  <div class="sticky-header" style="top:var(--nav-h, 90px);display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-bottom:1px solid #e5e5e5;padding-bottom:8px">
    <a href="${getArtistUrl(name)}" target="_blank" rel="noopener noreferrer" style="font-size:18px;font-weight:700;color:#1a1a1a;text-decoration:none;border-bottom:2px dashed #a3a3a3">${name}</a>
    <span style="font-size:13px;color:#737373">${evs.length} show${evs.length>1?'s':''} in ${cityCount} cit${cityCount>1?'ies':'y'}</span>
  </div>`;
  for (const ev of evs.sort((a,b) => a.date.localeCompare(b.date))) html += eventCard(ev, true);
  html += `</div>`;
}
html += `</div></div>`;

// MONTH VIEW (separate container)
html += `<div id="view-month-content" class="view-section" style="max-width:900px;margin:0 auto;padding:16px">`;
const MONTH_KEYS = {4:'apr',5:'may',6:'jun',7:'jul',8:'aug',9:'sep',10:'oct',11:'nov',12:'dec'};
const MONTH_NAMES = {4:'April 2026',5:'May 2026',6:'June 2026',7:'July 2026',8:'August 2026',9:'September 2026',10:'October 2026',11:'November 2026',12:'December 2026'};
const monthMap = {};
for (const ev of events) {
  if (!ev.date) continue;
  const m = parseInt(ev.date.substring(5,7));
  if (!monthMap[m]) monthMap[m] = {};
  if (!monthMap[m][ev.city]) monthMap[m][ev.city] = [];
  monthMap[m][ev.city].push(ev);
}
const visibleMonths = Object.keys(monthMap).map(Number).filter(m => m >= TODAY_MONTH).sort((a,b)=>a-b);
for (const m of visibleMonths) {
  html += `<div id="month-${MONTH_KEYS[m]}" class="month-section" style="margin-bottom:40px">
  <div class="sticky-header" style="top:var(--nav-h, 90px);border-bottom:2px solid #1a1a1a;margin-bottom:16px;padding-top:16px">
    <h2 style="font-size:24px;font-weight:700;margin:0">${MONTH_NAMES[m]}</h2>
  </div>`;
  for (const c of CITY_ORDER.filter(c => monthMap[m][c])) {
    const cc = CITY_COLORS[c] || '#525252';
    html += `<div style="margin-bottom:24px">
    <h3 style="font-size:17px;font-weight:700;margin:16px 0 8px;padding:6px 12px;background:${cc}20;border-left:4px solid ${cc};border-radius:4px">${CITY_LABELS[c]}</h3>`;
    for (const ev of monthMap[m][c].sort((a,b)=>a.date.localeCompare(b.date))) html += eventCard(ev, false);
    html += `</div>`;
  }
  html += `</div>`;
}
html += `</div>`;

// CALENDAR VIEW (auto-prune past months)
html += `<div id="view-calendar-content" class="view-section" style="max-width:1400px;margin:0 auto;padding:0 12px">`;
const eventsByDate = {};
for (const ev of events) {
  if (!ev.date) continue;
  if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
  eventsByDate[ev.date].push(ev);
}
const calMonthsAll = [
  {key:'apr',year:2026,month:3,label:'April 2026',num:4},
  {key:'may',year:2026,month:4,label:'May 2026',num:5},
  {key:'jun',year:2026,month:5,label:'June 2026',num:6},
  {key:'jul',year:2026,month:6,label:'July 2026',num:7},
  {key:'aug',year:2026,month:7,label:'August 2026',num:8},
  {key:'sep',year:2026,month:8,label:'September 2026',num:9},
  {key:'oct',year:2026,month:9,label:'October 2026',num:10},
  {key:'nov',year:2026,month:10,label:'November 2026',num:11},
  {key:'dec',year:2026,month:11,label:'December 2026',num:12},
];
const calMonths = calMonthsAll.filter(m => m.num >= TODAY_MONTH);
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
for (const cm of calMonths) {
  const firstDay = new Date(cm.year, cm.month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(cm.year, cm.month + 1, 0).getDate();
  html += `<div id="cal-${cm.key}" style="margin-bottom:40px">
  <h2 style="font-size:24px;font-weight:700;margin:32px 0 16px;text-align:center">${cm.label}</h2>
  <div class="calendar-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:#e5e5e5;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden">`;
  for (const d of DOW) html += `<div style="background:#27272a;color:#e4e4e7;padding:8px 4px;text-align:center;font-size:13px;font-weight:700">${d}</div>`;
  for (let i = 0; i < startDow; i++) html += `<div style="background:#f0eeeb;min-height:120px"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${cm.year}-${String(cm.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayEvs = eventsByDate[ds] || [];
    const isPast = ds < TODAY;
    const hasEvents = dayEvs.length > 0;
    const bg = isPast ? '#e7e5e0' : (hasEvents ? '#fff' : '#faf9f7');
    const cls = `cal-day${hasEvents ? ' has-events' : ''}`;
    const onclick = hasEvents ? ` onclick="openDayModal('${ds}')"` : '';
    html += `<div class="${cls}" data-date="${ds}"${onclick} style="background:${bg};min-height:120px;padding:6px 8px;${isPast?'opacity:0.4;':''}">
      <div style="font-size:14px;font-weight:700;color:${hasEvents?'#1a1a1a':'#a3a3a3'};margin-bottom:4px">${day}</div>`;
    for (const ev of dayEvs.slice(0, 6)) {
      const cc = CITY_COLORS[ev.city] || '#525252';
      const cat = ev.category || 'music';
      html += `<div class="cal-event" data-cat="${cat}" data-city="${ev.city}" data-artists="${ev.artists.map(a=>a.toLowerCase()).join('|')}" style="margin-bottom:3px;padding:2px 5px;border-left:3px solid ${cc};font-size:11px;line-height:1.2">
        <div style="font-weight:600;color:#1a1a1a">${ev.artists[0]}</div>
        <div style="font-size:9px;color:${cc};font-weight:700">${CITY_SHORT[ev.city]}</div>
      </div>`;
    }
    if (dayEvs.length > 6) html += `<div style="font-size:10px;color:#737373;margin-top:2px;font-weight:600">+${dayEvs.length-6} more</div>`;
    html += `</div>`;
  }
  const totalCells = startDow + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remaining; i++) html += `<div style="background:#f0eeeb;min-height:120px"></div>`;
  html += `</div></div>`;
}
html += `</div>`;

// Build the day events lookup as JSON for the modal
const dayLookup = {};
for (const [date, evs] of Object.entries(eventsByDate)) {
  dayLookup[date] = evs.map(e => ({
    artists: e.artists,
    primary: e.artists[0],
    city: e.city,
    cityLabel: CITY_LABELS[e.city] || e.cityLabel,
    cityColor: CITY_COLORS[e.city] || '#525252',
    venue: e.venue,
    time: e.time,
    url: e.url,
    category: e.category || 'music',
    minPrice: e.minPrice,
    artistKeys: e.artists.map(a => a.toLowerCase()).join('|'),
  }));
}

const allBandsForFilter = bandsAlpha.map(([name, evs]) => ({
  name, lower: name.toLowerCase(), count: evs.length,
}));

html += `
<!-- Day Modal -->
<div id="day-modal" class="modal-backdrop" onclick="if(event.target===this)closeDayModal()">
  <div class="modal-content">
    <button class="modal-close" onclick="closeDayModal()">&times;</button>
    <div id="day-modal-body"></div>
  </div>
</div>

<script>
var DAY_DATA = ${JSON.stringify(dayLookup)};
var ALL_BANDS = ${JSON.stringify(allBandsForFilter)};
var CITY_LABELS = ${JSON.stringify(CITY_LABELS)};
var CITY_COLORS = ${JSON.stringify(CITY_COLORS)};
var CAT_INFO = ${JSON.stringify(CAT_INFO)};

var currentView='city',currentRegion='us',currentCity=null;
var activeCategories=new Set(['music','comedy','broadway','off-broadway']);
var selectedBands=new Set(); // lowercase artist names
var favFilterOn=false;
var EU_KEYS=['amsterdam','athens','barcelona','berlin','dublin','lisbon','london','madrid','manchester','milan','paris','porto','rome','zagreb'];

function toggleCategory(cat){
  if(activeCategories.has(cat)) activeCategories.delete(cat);
  else activeCategories.add(cat);
  var btn=document.getElementById('cat-'+cat);
  var info=CAT_INFO[cat];
  if(activeCategories.has(cat)){
    btn.style.background=info.bg; btn.style.color=info.color; btn.style.opacity='1';
    btn.setAttribute('data-active','1');
  } else {
    btn.style.background='#3f3f46'; btn.style.color='#a3a3a3'; btn.style.opacity='0.5';
    btn.setAttribute('data-active','0');
  }
  applyAllFilters();
}

function setRegion(r){
  currentRegion=r;
  var u=document.getElementById('region-us'),e=document.getElementById('region-eu');
  document.getElementById('city-jump-us').style.display=r==='us'?'':'none';
  document.getElementById('city-jump-eu').style.display=r==='eu'?'':'none';
  if(r==='us'){u.style.background='#f8f7f4';u.style.color='#1a1a1a';u.style.borderColor='#f8f7f4';e.style.background='transparent';e.style.color='#e4e4e7';e.style.borderColor='#52525b';}
  else{e.style.background='#f8f7f4';e.style.color='#1a1a1a';e.style.borderColor='#f8f7f4';u.style.background='transparent';u.style.color='#e4e4e7';u.style.borderColor='#52525b';}
  document.querySelectorAll('.city-section').forEach(function(el){
    var k=el.getAttribute('data-city-key');
    var isEU=EU_KEYS.indexOf(k)!==-1;
    el.style.display=((r==='us'&&!isEU)||(r==='eu'&&isEU))?'':'none';
  });
  window.scrollTo({top:0});
}

function setView(v){
  currentView=v;
  document.getElementById('view-city-content').className='view-section'+(v==='city'?' active':'');
  document.getElementById('view-band-content').className='view-section'+(v==='band'?' active':'');
  document.getElementById('view-month-content').className='view-section'+(v==='month'?' active':'');
  document.getElementById('view-calendar-content').className='view-section'+(v==='calendar'?' active':'');
  ['view-city','view-band','view-month','view-calendar'].forEach(function(id){
    var b=document.getElementById(id);
    if(id==='view-'+v){b.style.background='#f8f7f4';b.style.color='#1a1a1a';b.style.borderColor='#f8f7f4';}
    else{b.style.background='transparent';b.style.color='#e4e4e7';b.style.borderColor='#52525b';}
  });
  window.scrollTo({top:0});
}

function scrollToCity(city){
  currentCity=city;
  if(currentView!=='city')setView('city');
  setTimeout(function(){
    var t=document.getElementById('city-'+city);
    if(t){var nh=document.getElementById('nav-bar').offsetHeight;window.scrollTo({top:t.getBoundingClientRect().top+window.pageYOffset-nh-12,behavior:'smooth'});}
  },50);
}

function applyAllFilters(){
  document.querySelectorAll('.event-card').forEach(function(el){
    var cat=el.getAttribute('data-category');
    var artists=el.getAttribute('data-artist-keys').split('|');
    if(!activeCategories.has(cat)){el.style.display='none';return;}
    if(selectedBands.size>0){
      var match=false;
      for(var a of artists){if(selectedBands.has(a)){match=true;break;}}
      if(!match){el.style.display='none';return;}
    }
    if(favFilterOn){var id=el.getAttribute('data-fav-id');if(!favs[id]){el.style.display='none';return;}}
    el.style.display='';
  });
  // Calendar event filter
  document.querySelectorAll('.cal-event').forEach(function(el){
    var cat=el.getAttribute('data-cat');
    var artists=el.getAttribute('data-artists').split('|');
    if(!activeCategories.has(cat)){el.style.display='none';return;}
    if(selectedBands.size>0){
      var match=false;
      for(var a of artists){if(selectedBands.has(a)){match=true;break;}}
      if(!match){el.style.display='none';return;}
    }
    el.style.display='';
  });
  setTimeout(restoreScrollPosition,0);
}

function restoreScrollPosition(){
  if(currentView==='city'&&currentCity){
    var t=document.getElementById('city-'+currentCity);
    if(t){var nh=document.getElementById('nav-bar').offsetHeight;window.scrollTo({top:t.getBoundingClientRect().top+window.pageYOffset-nh-12});}
  }
}

function updateNavHeight(){var nh=document.getElementById('nav-bar').offsetHeight;document.documentElement.style.setProperty('--nav-h',nh+'px');}
updateNavHeight();window.addEventListener('resize',updateNavHeight);

// Multi-band filter
function updateBandSuggestions(query){
  var q=(query||'').toLowerCase().trim();
  var box=document.getElementById('band-suggestions');
  if(!q){box.style.display='none';return;}
  var matches=ALL_BANDS.filter(function(b){return b.lower.indexOf(q)!==-1 && !selectedBands.has(b.lower);}).slice(0,30);
  if(matches.length===0){box.style.display='none';return;}
  box.innerHTML=matches.map(function(b){return '<div class="band-suggestion" onclick="addBand(\\''+b.lower.replace(/'/g,"\\\\'")+'\\',\\''+b.name.replace(/'/g,"\\\\'")+'\\')">'+b.name+' <span style="color:#a3a3a3;font-size:11px">('+b.count+')</span></div>';}).join('');
  box.style.display='block';
}
function addBand(lower,name){
  selectedBands.add(lower);
  document.getElementById('band-filter-input').value='';
  document.getElementById('band-suggestions').style.display='none';
  renderBandChips();
  applyAllFilters();
}
function removeBand(lower){
  selectedBands.delete(lower);
  renderBandChips();
  applyAllFilters();
}
function clearAllBands(){
  selectedBands.clear();
  renderBandChips();
  applyAllFilters();
}
function renderBandChips(){
  var box=document.getElementById('band-chips');
  if(selectedBands.size===0){box.innerHTML='';return;}
  var chips=[];
  selectedBands.forEach(function(b){
    var nm=ALL_BANDS.find(function(x){return x.lower===b;});
    var label=nm?nm.name:b;
    chips.push('<span class="band-chip">'+label+' <button onclick="removeBand(\\''+b.replace(/'/g,"\\\\'")+'\\')">&times;</button></span>');
  });
  box.innerHTML=chips.join('');
}

// Day modal
function openDayModal(dateStr){
  var evs=DAY_DATA[dateStr]||[];
  // Apply current filters
  var filtered=evs.filter(function(e){
    if(!activeCategories.has(e.category))return false;
    if(selectedBands.size>0){
      var artists=e.artistKeys.split('|');
      var match=false;
      for(var a of artists){if(selectedBands.has(a)){match=true;break;}}
      if(!match)return false;
    }
    return true;
  });
  // Group by city alphabetically
  var byCity={};
  filtered.forEach(function(e){if(!byCity[e.cityLabel])byCity[e.cityLabel]=[];byCity[e.cityLabel].push(e);});
  var cities=Object.keys(byCity).sort();

  var dt=new Date(dateStr+'T12:00:00');
  var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var dateLabel=days[dt.getDay()]+', '+months[dt.getMonth()]+' '+dt.getDate()+', 2026';

  var html='<h2 style="margin:0 0 4px;font-size:22px;font-weight:800">'+dateLabel+'</h2>';
  html+='<div style="font-size:13px;color:#737373;margin-bottom:16px">'+filtered.length+' show'+(filtered.length!==1?'s':'')+' across '+cities.length+' cit'+(cities.length!==1?'ies':'y')+'</div>';

  if(filtered.length===0){
    html+='<div style="padding:24px;text-align:center;color:#737373">No shows match your current filters.</div>';
  } else {
    cities.forEach(function(city){
      var color=byCity[city][0].cityColor;
      html+='<h3 style="font-size:14px;font-weight:800;margin:16px 0 8px;padding:6px 12px;background:'+color+'20;border-left:4px solid '+color+';border-radius:4px">'+city+' <span style="font-size:12px;font-weight:500;color:#737373;margin-left:6px">('+byCity[city].length+')</span></h3>';
      byCity[city].forEach(function(e){
        var catInfo=CAT_INFO[e.category]||CAT_INFO.music;
        var time=e.time?formatTime(e.time):'';
        var primary=e.primary;
        var supp=e.artists.length>1?' <span style="color:#525252">w/ '+e.artists.slice(1).join(', ')+'</span>':'';
        var price=e.minPrice?'<span style="font-size:12px;color:#525252;margin-left:8px">From $'+Math.round(e.minPrice)+'</span>':'';
        html+='<div style="background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">'+
          '<div style="flex:1;min-width:180px"><div style="font-size:15px;font-weight:700">'+primary+supp+' <span style="display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;padding:2px 6px;border-radius:3px;background:'+catInfo.bg+';color:'+catInfo.color+';margin-left:4px">'+catInfo.label+'</span></div>'+
          '<div style="font-size:12px;color:#737373;margin-top:2px">'+(time?time+' · ':'')+e.venue+price+'</div></div>'+
          '<a href="'+e.url+'" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;background:#1a1a1a;color:#fff;font-size:12px;font-weight:600;border-radius:5px;text-decoration:none">Tickets</a>'+
        '</div>';
      });
    });
  }
  document.getElementById('day-modal-body').innerHTML=html;
  document.getElementById('day-modal').classList.add('active');
}
function closeDayModal(){document.getElementById('day-modal').classList.remove('active');}
function formatTime(t){
  if(!t)return '';
  var p=t.split(':');var h=parseInt(p[0]);var m=p[1]||'00';
  return (h>12?h-12:(h===0?12:h))+':'+m+' '+(h>=12?'PM':'AM');
}

// Favorites
var favs={};try{favs=JSON.parse(localStorage.getItem('concert-favs')||'{}');}catch(e){}
function saveFavs(){localStorage.setItem('concert-favs',JSON.stringify(favs));updateFavCount();}
function updateFavCount(){var c=Object.keys(favs).length;var el=document.getElementById('fav-count');if(el)el.textContent=c+' favorite'+(c!==1?'s':'');}
function toggleFav(id){if(favs[id])delete favs[id];else favs[id]=true;saveFavs();renderFavStars();applyAllFilters();}
function renderFavStars(){document.querySelectorAll('.fav-btn').forEach(function(b){var id=b.getAttribute('data-fav');b.innerHTML=favs[id]?'&#9733;':'&#9734;';b.style.color=favs[id]?'#f59e0b':'#d4d4d4';});}
function toggleFavFilter(){favFilterOn=!favFilterOn;var b=document.getElementById('fav-filter-btn');if(favFilterOn){b.textContent='Show All';b.style.background='#1a1a1a';b.style.color='#fff';b.style.borderColor='#1a1a1a';}else{b.textContent='Favorites Only';b.style.background='#fff';b.style.color='#1a1a1a';b.style.borderColor='#e5e5e5';}applyAllFilters();}
function clearAllFavs(){favs={};saveFavs();renderFavStars();applyAllFilters();}
function handleSearch(q){q=q.toLowerCase().trim();document.querySelectorAll('.event-card').forEach(function(el){var d=el.getAttribute('data-search')||'';el.style.display=(!q||d.includes(q))?'':'none';});}

// Click outside band suggestions to close
document.addEventListener('click',function(e){
  if(!e.target.closest('#band-filter-input')&&!e.target.closest('#band-suggestions')){
    document.getElementById('band-suggestions').style.display='none';
  }
});

// Escape key to close modal
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDayModal();});

renderFavStars();updateFavCount();setRegion('us');
</script>
</body></html>`;

fs.writeFileSync(path.join(REPO_ROOT, 'index.html'), html);
console.log(`Built index.html: ${events.length} events, ${bandMap.size} artists | ${musicCount} music, ${comedyCount} comedy, ${broadwayCount} broadway, ${offBroadwayCount} off-broadway`);
