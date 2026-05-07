/**
 * Shared config for all search and build scripts.
 * API keys come from environment variables (GitHub Secrets in CI).
 */

const TM_KEY = process.env.TM_KEY;
const SG_KEY = process.env.SG_KEY;

if (!TM_KEY) console.error('Warning: TM_KEY env var not set');
if (!SG_KEY) console.error('Warning: SG_KEY env var not set');

const US_CITIES = {
  ac:           { kind: 'city', city: 'Atlantic City', state: 'NJ', label: 'Atlantic City, NJ', lat: 39.3643, lon: -74.4229, sgRange: '15mi' },
  charleston:   { kind: 'dma',  dmaId: '225', label: 'Charleston, SC',           lat: 32.7765, lon: -79.9311, sgRange: '30mi' },
  chicago:      { kind: 'dma',  dmaId: '249', label: 'Chicago, IL',              lat: 41.8781, lon: -87.6298, sgRange: '30mi' },
  denver:       { kind: 'dma',  dmaId: '264', label: 'Denver, CO',               lat: 39.7392, lon: -104.9903, sgRange: '30mi' },
  dc:           { kind: 'dma',  dmaId: '224', label: 'Washington, DC',           lat: 38.9072, lon: -77.0369, sgRange: '30mi' },
  la:           { kind: 'dma',  dmaId: '324', label: 'Los Angeles, CA',          lat: 34.0522, lon: -118.2437, sgRange: '30mi' },
  nyc:          { kind: 'dma',  dmaId: '296', label: 'New York City, NY',        lat: 40.7128, lon: -74.0060, sgRange: '20mi' },
  philadelphia: { kind: 'city', city: 'Philadelphia', state: 'PA', label: 'Philadelphia, PA', lat: 39.9526, lon: -75.1652, sgRange: '20mi' },
  phoenix:      { kind: 'dma',  dmaId: '345', label: 'Phoenix / Scottsdale, AZ', lat: 33.4484, lon: -112.0740, sgRange: '30mi' },
  syracuse:     { kind: 'dma',  dmaId: '407', label: 'Syracuse, NY',             lat: 43.0481, lon: -76.1474, sgRange: '30mi' },
  tampa:        { kind: 'dma',  dmaId: '422', label: 'Tampa / St. Pete, FL',     lat: 27.9506, lon: -82.4572, sgRange: '30mi' },
  vegas:        { kind: 'city', city: 'Las Vegas', state: 'NV', label: 'Las Vegas, NV', lat: 36.1699, lon: -115.1398, sgRange: '15mi' },
};

const EU_CITIES = {
  amsterdam: { countryCode: 'NL', city: 'Amsterdam',   label: 'Amsterdam, Netherlands', sk: '31366-netherlands-amsterdam' },
  athens:    { countryCode: 'GR', city: 'Athens',      label: 'Athens, Greece',          sk: '28976-greece-athens' },
  barcelona: { countryCode: 'ES', city: 'Barcelona',   label: 'Barcelona, Spain',        sk: '28714-spain-barcelona' },
  berlin:    { countryCode: 'DE', city: 'Berlin',      label: 'Berlin, Germany',         sk: '28443-germany-berlin' },
  dublin:    { countryCode: 'IE', city: 'Dublin',      label: 'Dublin, Ireland',         sk: '29314-ireland-dublin' },
  lisbon:    { countryCode: 'PT', city: 'Lisboa',      label: 'Lisbon, Portugal',        sk: '31802-portugal-lisbon' },
  london:    { countryCode: 'GB', city: 'London',      label: 'London, UK',              sk: '24426-uk-london' },
  madrid:    { countryCode: 'ES', city: 'Madrid',      label: 'Madrid, Spain',           sk: '28755-spain-madrid' },
  manchester:{ countryCode: 'GB', city: 'Manchester',  label: 'Manchester, UK',          sk: '24475-uk-manchester' },
  milan:     { countryCode: 'IT', city: 'Milano',      label: 'Milan, Italy',            sk: '30338-italy-milan' },
  paris:     { countryCode: 'FR', city: 'Paris',       label: 'Paris, France',           sk: '28909-france-paris' },
  porto:     { countryCode: 'PT', city: 'Porto',       label: 'Porto, Portugal',         sk: '31805-portugal-porto' },
  rome:      { countryCode: 'IT', city: 'Roma',        label: 'Rome, Italy',             sk: '30366-italy-rome' },
  zagreb:    { countryCode: 'HR', city: 'Zagreb',      label: 'Zagreb, Croatia',         sk: '29037-croatia-zagreb' },
};

// Venue city -> our city key mapping (strict, only these cities count)
const VENUE_MAP = {
  'new york':'nyc','brooklyn':'nyc','queens':'nyc','manhattan':'nyc',
  'forest hills':'nyc','long island city':'nyc','astoria':'nyc','flushing':'nyc',
  'williamsburg':'nyc','bushwick':'nyc',
  'atlantic city':'ac','ocean city':'ac',
  'chicago':'chicago','tinley park':'chicago','rosemont':'chicago','highland park':'chicago','bridgeview':'chicago','hoffman estates':'chicago','schaumburg':'chicago',
  'phoenix':'phoenix','scottsdale':'phoenix','tempe':'phoenix','glendale':'phoenix','mesa':'phoenix','chandler':'phoenix',
  'tampa':'tampa','st. petersburg':'tampa','clearwater':'tampa','st pete':'tampa','ybor city':'tampa',
  'charleston':'charleston','north charleston':'charleston',
  'washington':'dc','vienna':'dc','bristow':'dc','columbia':'dc',
  'syracuse':'syracuse','canandaigua':'syracuse',
  'denver':'denver','morrison':'denver','englewood':'denver','commerce city':'denver','broomfield':'denver',
  'los angeles':'la','hollywood':'la','inglewood':'la','pasadena':'la','anaheim':'la','costa mesa':'la',
  'philadelphia':'philadelphia','camden':'philadelphia','cherry hill':'philadelphia','king of prussia':'philadelphia','chester':'philadelphia',
  'las vegas':'vegas','henderson':'vegas','paradise':'vegas',
};

const EU_CITY_KEYS = Object.keys(EU_CITIES);
const ALL_CITY_KEYS = [...Object.keys(US_CITIES), ...EU_CITY_KEYS];

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { TM_KEY, SG_KEY, US_CITIES, EU_CITIES, VENUE_MAP, EU_CITY_KEYS, ALL_CITY_KEYS, sleep };
