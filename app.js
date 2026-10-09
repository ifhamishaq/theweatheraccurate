// ==========================================================================
// The Weather Accurate - High-Precision Auto Geolocation & Responsive Engine
// ==========================================================================

var state = {
  unit: localStorage.getItem('weather_unit') || 'celsius',
  accentTheme: localStorage.getItem('weather_accent_theme') || 'cyan',
  location: { 
    lat: parseFloat(localStorage.getItem('user_last_lat')) || 42.6629, 
    lon: parseFloat(localStorage.getItem('user_last_lon')) || 21.1655, 
    name: localStorage.getItem('user_last_name') || 'Pristina', 
    country: localStorage.getItem('user_last_country') || 'XK' 
  },
  weather: null,
  aqi: null,
  chart: null,
  historyChart: null,
  activeMetric: 'temp',
  expandedDayIndex: -1,
  savedCities: JSON.parse(localStorage.getItem('saved_weather_cities') || '[]'),
  searchTimeout: null,
  searchResults: []
};

// Performance: detect mobile for reduced rendering
var isMobileDevice = window.innerWidth <= 768;
window.addEventListener('resize', function() { isMobileDevice = window.innerWidth <= 768; });

// === PERFORMANCE UTILITIES ===
var weatherCache = {};
var CACHE_TTL = 10 * 60 * 1000;

function debounce(fn, ms) {
  var timer;
  return function() {
    var args = arguments; var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}

// Toast notification system
function showToast(msg, type) {
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast-item toast-' + (type || 'info');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(function() { toast.classList.add('toast-visible'); }, 20);
  setTimeout(function() {
    toast.classList.remove('toast-visible');
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 350);
  }, 3200);
}

// Haptic feedback
function haptic(style) {
  try { if (navigator.vibrate) navigator.vibrate(style === 'heavy' ? 30 : 10); } catch(e) {}
}

// Last updated tracking
var lastFetchTime = null;
function updateLastUpdated() {
  lastFetchTime = Date.now();
  var badge = document.getElementById('lastUpdatedBadge');
  if (badge) badge.textContent = 'Updated just now';
}
setInterval(function() {
  if (!lastFetchTime) return;
  var badge = document.getElementById('lastUpdatedBadge');
  if (!badge) return;
  var mins = Math.floor((Date.now() - lastFetchTime) / 60000);
  badge.textContent = mins < 1 ? 'Updated just now' : 'Updated ' + mins + ' min ago';
}, 60000);

// Error state
function showErrorState(msg) {
  var el = document.getElementById('errorState');
  if (el) { el.querySelector('.error-msg').textContent = msg || 'Unable to load weather data'; el.classList.remove('hidden'); }
}
function hideErrorState() {
  var el = document.getElementById('errorState');
  if (el) el.classList.add('hidden');
}

// === INTERNATIONALIZATION ===
var currentLang = localStorage.getItem('weather_lang') || 'en';
var i18nStrings = {
  en: { clear: 'Clear Sky', humidity: 'Humidity', wind: 'Wind', feelsLike: 'Feels Like', updated: 'Updated just now', sunrise: 'Sunrise', sunset: 'Sunset', searchPlaceholder: 'Search city or location...', rainChance: 'Rain Chance Next 12h', moonPhase: 'MOON PHASE', pollen: 'POLLEN INDEX', airQuality: 'Air Quality Breakdown', history: '7-Day Temperature History', yourCities: 'Your Cities at a Glance' },
  ur: { clear: '\u0635\u0627\u0641 \u0622\u0633\u0645\u0627\u0646', humidity: '\u0646\u0645\u06cc', wind: '\u06c1\u0648\u0627', feelsLike: '\u0645\u062d\u0633\u0648\u0633', updated: '\u0627\u0628\u06be\u06cc \u0627\u067e\u0688\u06cc\u0679', sunrise: '\u0637\u0644\u0648\u0639', sunset: '\u063a\u0631\u0648\u0628', searchPlaceholder: '\u0634\u06c1\u0631 \u062a\u0644\u0627\u0634 \u06a9\u0631\u06cc\u06ba...', rainChance: '\u0628\u0627\u0631\u0634 \u06a9\u0627 \u0627\u0645\u06a9\u0627\u0646', moonPhase: '\u0686\u0627\u0646\u062f \u06a9\u06cc \u062d\u0627\u0644\u062a', pollen: '\u067e\u0631\u0627\u06af\u0646\u062f\u06c1', airQuality: '\u0641\u0636\u0627\u0626\u06cc \u0645\u0639\u06cc\u0627\u0631', history: '\u062a\u0627\u0631\u06cc\u062e\u06cc \u062f\u0631\u062c\u06c1 \u062d\u0631\u0627\u0631\u062a', yourCities: '\u0622\u067e \u06a9\u06d2 \u0634\u06c1\u0631' },
  ar: { clear: '\u0633\u0645\u0627\u0621 \u0635\u0627\u0641\u064a\u0629', humidity: '\u0631\u0637\u0648\u0628\u0629', wind: '\u0631\u064a\u0627\u062d', feelsLike: '\u064a\u0628\u062f\u0648', updated: '\u062a\u0645 \u0627\u0644\u062a\u062d\u062f\u064a\u062b', sunrise: '\u0634\u0631\u0648\u0642', sunset: '\u063a\u0631\u0648\u0628', searchPlaceholder: '\u0628\u062d\u062b \u0639\u0646 \u0645\u062f\u064a\u0646\u0629...', rainChance: '\u0641\u0631\u0635\u0629 \u0645\u0637\u0631', moonPhase: '\u0637\u0648\u0631 \u0627\u0644\u0642\u0645\u0631', pollen: '\u062d\u0628\u0648\u0628 \u0627\u0644\u0644\u0642\u0627\u062d', airQuality: '\u062c\u0648\u062f\u0629 \u0627\u0644\u0647\u0648\u0627\u0621', history: '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062d\u0631\u0627\u0631\u0629', yourCities: '\u0645\u062f\u0646\u0643' },
  tr: { clear: 'A\u00e7\u0131k', humidity: 'Nem', wind: 'R\u00fczgar', feelsLike: 'Hissedilen', updated: 'G\u00fcncellendi', sunrise: 'G\u00fcne\u015f do\u011fu\u015fu', sunset: 'G\u00fcne\u015f bat\u0131\u015f\u0131', searchPlaceholder: '\u015eehir ara...', rainChance: 'Ya\u011fmur \u015fans\u0131', moonPhase: 'AY EVRE', pollen: 'POLEN', airQuality: 'Hava Kalitesi', history: 'S\u0131cakl\u0131k Ge\u00e7mi\u015fi', yourCities: '\u015eehirleriniz' },
  de: { clear: 'Klarer Himmel', humidity: 'Feuchtigkeit', wind: 'Wind', feelsLike: 'Gef\u00fchlt', updated: 'Aktualisiert', sunrise: 'Sonnenaufgang', sunset: 'Sonnenuntergang', searchPlaceholder: 'Stadt suchen...', rainChance: 'Regenwahrscheinlichkeit', moonPhase: 'MONDPHASE', pollen: 'POLLEN', airQuality: 'Luftqualit\u00e4t', history: 'Temperaturverlauf', yourCities: 'Ihre St\u00e4dte' }
};
function t(key) { return (i18nStrings[currentLang] && i18nStrings[currentLang][key]) || (i18nStrings.en[key]) || key; }

var WEATHER_CODES = {
  0: { description: 'Clear Sky', theme: 'sunny', isClear: true },
  1: { description: 'Mainly Clear', theme: 'sunny', isClear: true },
  2: { description: 'Partly Cloudy', theme: 'drizzle', isClear: false },
  3: { description: 'Overcast', theme: 'drizzle', isClear: false },
  45: { description: 'Fog', theme: 'drizzle', isClear: false },
  48: { description: 'Rime Fog', theme: 'drizzle', isClear: false },
  51: { description: 'Light Drizzle', theme: 'drizzle', isClear: false },
  53: { description: 'Moderate Drizzle', theme: 'drizzle', isClear: false },
  55: { description: 'Dense Drizzle', theme: 'drizzle', isClear: false },
  61: { description: 'Slight Rain', theme: 'drizzle', isClear: false },
  63: { description: 'Moderate Rain', theme: 'drizzle', isClear: false },
  65: { description: 'Heavy Rain', theme: 'drizzle', isClear: false },
  71: { description: 'Slight Snow', theme: 'snow', isClear: false },
  73: { description: 'Moderate Snow', theme: 'snow', isClear: false },
  75: { description: 'Heavy Snow', theme: 'snow', isClear: false },
  80: { description: 'Rain Showers', theme: 'drizzle', isClear: false },
  81: { description: 'Moderate Showers', theme: 'drizzle', isClear: false },
  82: { description: 'Violent Showers', theme: 'drizzle', isClear: false },
  95: { description: 'Thunderstorm', theme: 'thunderstorm', isClear: false },
  96: { description: 'Thunderstorm & Hail', theme: 'thunderstorm', isClear: false },
  99: { description: 'Heavy Thunderstorm', theme: 'thunderstorm', isClear: false }
};

// Calculate Solar Phase
function getSolarPhase(now, sunriseStr, sunsetStr, isDay) {
  if (isDay === 0) return 'night';
  if (!sunriseStr || !sunsetStr) return isDay ? 'day' : 'night';

  var sunrise = new Date(sunriseStr);
  var sunset = new Date(sunsetStr);
  var current = now || new Date();

  var morningEnd = new Date(sunrise.getTime() + 90 * 60 * 1000);
  var eveningStart = new Date(sunset.getTime() - 90 * 60 * 1000);

  if (current >= new Date(sunrise.getTime() - 30 * 60 * 1000) && current <= morningEnd) {
    return 'morning';
  }
  if (current >= eveningStart && current <= new Date(sunset.getTime() + 30 * 60 * 1000)) {
    return 'evening';
  }
  if (current > new Date(sunset.getTime() + 30 * 60 * 1000) || current < new Date(sunrise.getTime() - 30 * 60 * 1000)) {
    return 'night';
  }

  return 'day';
}

// --- Weather line icons (single stroke weight, tinted only where it means something) ---
function getWeatherIcon(code, solarPhase) {
  var info = WEATHER_CODES[code] || { theme: 'sunny', isClear: true };
  var night = solarPhase === 'night';
  var rays = '<g class="wi-rays wi-warm">' +
    [0, 45, 90, 135, 180, 225, 270, 315].map(function(a) {
      return '<line x1="32" y1="7" x2="32" y2="12" transform="rotate(' + a + ' 32 32)"/>';
    }).join('') + '</g>';
  var sun = rays + '<circle class="wi-warm" cx="32" cy="32" r="12"/>';
  var moon = '<path class="wi-moon" d="M40 14a18 18 0 1 0 12 30A15 15 0 0 1 40 14z"/>' +
    '<path class="wi-star wi-soft" d="M50 12v6M47 15h6"/>';
  var cloudPath = 'M20 46h26a9 9 0 0 0 .8-17.96A13 13 0 0 0 21.6 31.5 7.6 7.6 0 0 0 20 46z';
  var cloud = '<path class="wi-cloud" d="' + cloudPath + '"/>';
  var smallCloud = '<path class="wi-cloud" transform="translate(4 8)" d="' + cloudPath + '"/>';
  var drops = '<path class="wi-drop" d="M24 52v6"/><path class="wi-drop" d="M33 52v6"/><path class="wi-drop" d="M42 52v6"/>';
  var flakes = '<path class="wi-flake" d="M25 55h.01M33 58h.01M41 55h.01" stroke-width="3"/>';
  var inner;

  if (info.isClear) {
    inner = night ? moon : sun;
  } else if (code === 2) {
    inner = night
      ? '<path class="wi-moon" transform="translate(-6 -10) scale(.8)" d="M40 14a18 18 0 1 0 12 30A15 15 0 0 1 40 14z"/>' + smallCloud
      : '<g transform="translate(10 -8) scale(.7)">' + sun + '</g>' + smallCloud;
  } else if (code === 45 || code === 48) {
    inner = '<path d="M12 24h40M8 33h44M16 42h40M12 51h30" class="wi-soft"/>' + '<path d="M18 20h28" />';
  } else if (info.theme === 'snow') {
    inner = '<g transform="translate(0 -6)">' + cloud + '</g>' + flakes;
  } else if (info.theme === 'thunderstorm') {
    inner = '<g transform="translate(0 -6)">' + cloud + '</g>' +
      '<path class="wi-bolt wi-bolt-anim" d="M34 41l-7 11h7l-3 9 10-13h-7l3-7z"/>';
  } else if (code === 3) {
    inner = cloud;
  } else {
    inner = '<g transform="translate(0 -6)">' + cloud + '</g>' + drops;
  }
  return '<svg class="wi" viewBox="0 0 64 64" role="img" aria-hidden="true">' + inner + '</svg>';
}
function getFrostedGlassMascotSVG(code, solarPhase) { return getWeatherIcon(code, solarPhase); }


// Status colour ramp for progress bars (quiet green -> amber -> clay)
function setBar(id, frac) {
  var el = $(id);
  if (!el) return;
  frac = Math.max(0, Math.min(1, frac));
  el.style.background = frac < 0.34 ? 'var(--ok)' : (frac < 0.67 ? 'var(--mid)' : 'var(--bad)');
  requestAnimationFrame(function() { el.style.width = (frac * 100) + '%'; });
}

// Count a number up/down to its new value (skipped for reduced motion)
function animateNumber(el, to) {
  if (!el) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var from = parseInt(el.textContent, 10);
  if (reduce || isNaN(from) || isNaN(to) || from === to) { el.textContent = to; return; }
  var start = null, dur = 700;
  function step(ts) {
    if (start === null) start = ts;
    var p = Math.min(1, (ts - start) / dur);
    var e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Reveal panels as they scroll into view
function setupReveal() {
  document.documentElement.classList.add('js');
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { items.forEach(function(el) { el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  items.forEach(function(el, i) { el.style.setProperty('--d', ((i % 3) * 70) + 'ms'); io.observe(el); });
}

// Chart palette follows the active theme
function cssVar(name, fallback) {
  var v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

function $(id) { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }

function convertTemp(c) {
  return state.unit === 'fahrenheit' ? (c * 9 / 5) + 32 : c;
}

function formatTemp(c) {
  if (c === undefined || c === null || isNaN(c)) return '--';
  return Math.round(convertTemp(Number(c)));
}

function applyWeatherTheme(code, solarPhase) {
  var info = WEATHER_CODES[code] || { theme: 'sunny', isClear: true };
  var theme = info.theme;
  var phase = solarPhase || 'day';

  var bodyTheme = 'weather-theme-' + phase + ' accent-' + state.accentTheme;
  if (!info.isClear) {
    bodyTheme = 'weather-theme-' + theme + ' accent-' + state.accentTheme;
  }
  var keep = document.body.classList.contains('light-theme') ? ' light-theme' : '';
  var particles = document.body.className.match(/weather-particles-\w+/);
  document.body.className = bodyTheme + keep + (particles ? ' ' + particles[0] : '');

  var cardTheme = 'card-theme-' + phase;
  if (!info.isClear) {
    cardTheme = 'card-theme-' + theme;
  }
  var card = $('mainCard');
  if (card) card.className = 'hero-stage-card ' + cardTheme;
}

function fetchWeatherData(lat, lon) {
  var cacheKey = lat.toFixed(2) + ',' + lon.toFixed(2);
  var cached = weatherCache[cacheKey];
  if (cached && (Date.now() - cached.time < CACHE_TTL)) {
    return Promise.resolve(cached.data);
  }

  var weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,weather_code,visibility,uv_index,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&past_days=1&forecast_days=8&timezone=auto';
  var aqiUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon + '&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone';

  return Promise.all([
    fetch(weatherUrl).then(function(r) { return r.json(); }),
    fetch(aqiUrl).then(function(r) { return r.json(); }).catch(function() { return null; })
  ]).then(function(results) {
    var data = { weather: results[0], aqi: results[1] };
    weatherCache[cacheKey] = { data: data, time: Date.now() };
    return data;
  });
}

function searchCities(query) {
  if (!query || query.trim().length < 2) return Promise.resolve([]);
  var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query.trim()) + '&count=5&language=en&format=json';
  return fetch(url).then(function(r) { return r.json(); }).then(function(d) {
    return d.results || [];
  }).catch(function() { return []; });
}

// 🌅 Solar Sky Arc Visualizer Engine
function renderSolarArc(now, sunriseStr, sunsetStr) {
  var node = $('solarSunNode');
  if (!node || !sunriseStr || !sunsetStr) return;

  var sunrise = new Date(sunriseStr).getTime();
  var sunset = new Date(sunsetStr).getTime();
  var current = (now || new Date()).getTime();

  var pct = (current - sunrise) / (sunset - sunrise);
  pct = Math.max(0, Math.min(1, pct));

  var angle = Math.PI * (1 - pct);
  var x = 70 + 60 * Math.cos(angle);
  var y = 55 - 40 * Math.sin(angle);

  var done = $('solarArcDone');
  if (done) done.setAttribute('stroke-dasharray', (pct * 100).toFixed(1) + ' 100');
  node.setAttribute('cx', x.toFixed(1));
  node.setAttribute('cy', y.toFixed(1));

  if (pct <= 0 || pct >= 1) {
    node.setAttribute('fill', '#94a3b8');
  } else {
    node.setAttribute('fill', '#fbbf24');
  }
}

// 🌡️ Yesterday Comparison Readout
function renderYesterdayComparison(currentTemp, hourly) {
  var textEl = $('comparisonText');
  if (!textEl || !hourly || !hourly.temperature_2m) return;

  var nowHour = new Date().getHours();
  var yesterdayTemp = hourly.temperature_2m[nowHour];

  if (yesterdayTemp !== undefined && yesterdayTemp !== null) {
    var diff = Math.round(convertTemp(currentTemp)) - Math.round(convertTemp(yesterdayTemp));
    var unitSym = state.unit === 'fahrenheit' ? '°F' : '°C';

    if (diff === 0) {
      textEl.textContent = 'Same temperature as yesterday at this time';
    } else if (diff > 0) {
      textEl.textContent = diff + unitSym + ' warmer than yesterday';
    } else {
      textEl.textContent = Math.abs(diff) + unitSym + ' cooler than yesterday';
    }
  } else {
    textEl.textContent = 'Similar to seasonal average';
  }
}

// 👕 Smart Clothing & Activity Assistant Logic
function renderSmartAdvice(current, daily) {
  var temp = current.temperature_2m;
  var code = current.weather_code;
  var wind = current.wind_speed_10m;
  var uv = daily.uv_index_max ? daily.uv_index_max[0] : 0;
  var pop = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : 0;

  var headline = "Great conditions for outdoor activities";
  var body = "Comfortable temperatures expected. Wear light breathable layers.";
  var emoji = "Outdoors";

  if (code >= 95) {
    headline = "Severe Thunderstorm Alert";
    body = "Stay indoors if possible. Heavy lightning and strong gusts reported.";
    emoji = "Storm";
  } else if (code >= 61 || pop > 60) {
    headline = "Rain Expected Today";
    body = "Carry a waterproof jacket or umbrella before heading out.";
    emoji = "Rain";
  } else if (temp <= 5) {
    headline = "Freezing Weather Ahead";
    body = "Bundle up with heavy coat, thermal gloves, and a beanie.";
    emoji = "Cold";
  } else if (uv >= 7) {
    headline = "Extreme UV Ray Warning";
    body = "High UV radiation index. Wear sunglasses and apply SPF 50 sunscreen.";
    emoji = "UV";
  } else if (wind >= 25) {
    headline = "Breezy Wind Conditions";
    body = "Wind gusts up to " + Math.round(wind) + " km/h. Secure loose outdoor objects.";
    emoji = "Wind";
  }

  $('adviceHeadline').textContent = headline;
  $('adviceBody').textContent = body;
  $('adviceIcon').textContent = emoji;
}

// ⚠️ Severe Weather Alerts Banner Engine
function checkWeatherAlerts(current, daily) {
  var alertBar = $('alertBanner');
  var alertText = $('alertText');
  if (!alertBar || !alertText) return;

  var code = current.weather_code;
  var uv = daily.uv_index_max ? daily.uv_index_max[0] : 0;
  var wind = current.wind_speed_10m;

  var alertMsg = "";
  if (code >= 95) alertMsg = "WARNING: Active Thunderstorm & Lightning in your region.";
  else if (code >= 65) alertMsg = "ADVISORY: Heavy Downpour & Flood risk warning.";
  else if (uv >= 8) alertMsg = "CAUTION: Extreme UV Index (" + Math.round(uv) + "). Limit direct sun exposure.";
  else if (wind >= 35) alertMsg = "GALE ADVISORY: High Wind Gusts exceeding " + Math.round(wind) + " km/h.";

  if (alertMsg) {
    alertText.textContent = alertMsg;
    alertBar.classList.remove('hidden');
  } else {
    alertBar.classList.add('hidden');
  }
}

// 🔊 Premium High-Quality Voice Selection & Speech Engine
function speakWeatherBriefing() {
  if (!('speechSynthesis' in window) || !state.weather) return;

  var btn = $('speakBriefingBtn');
  var btnText = $('voiceBtnText');

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (btn) btn.classList.remove('speaking');
    if (btnText) btnText.textContent = 'Voice';
    return;
  }

  var current = state.weather.current;
  var location = state.location;
  var codeInfo = WEATHER_CODES[current.weather_code] || { description: 'Clear Sky' };
  var tempVal = formatTemp(current.temperature_2m);
  var unitName = state.unit === 'fahrenheit' ? 'Fahrenheit' : 'Celsius';

  var text = "Weather update for " + location.name + ". Currently " + tempVal + " degrees " + unitName + " with " + codeInfo.description + ". Humidity is at " + current.relative_humidity_2m + " percent.";

  var utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  var voices = window.speechSynthesis.getVoices();
  var selectedVoice = voices.find(function(v) {
    return (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Daniel') || v.name.includes('Siri')) && v.lang.startsWith('en');
  }) || voices.find(function(v) {
    return v.lang.startsWith('en');
  });

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.onstart = function() {
    if (btn) btn.classList.add('speaking');
    if (btnText) btnText.textContent = 'Speaking...';
  };

  utterance.onend = utterance.onerror = function() {
    if (btn) btn.classList.remove('speaking');
    if (btnText) btnText.textContent = 'Voice';
  };

  window.speechSynthesis.speak(utterance);
}

// ⭐ Favorite Cities Controller
function renderSavedCities() {
  var container = $('savedCitiesContainer');
  if (!container) return;
  container.innerHTML = '';

  state.savedCities.forEach(function(item) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-pill';
    btn.textContent = item.name;
    btn.onclick = function() {
      loadLocationWeather(item.lat, item.lon, item.name, item.country);
    };
    container.appendChild(btn);
  });

  // Hide preset chips that duplicate a saved city
  $$('.preset-pill[data-city]').forEach(function(p) {
    p.classList.toggle('hidden', state.savedCities.some(function(c) { return c.name === p.getAttribute('data-city'); }));
  });

  var bookmarkBtn = $('bookmarkCityBtn');
  if (bookmarkBtn) {
    var isSaved = state.savedCities.some(function(c) { return c.name === state.location.name; });
    bookmarkBtn.classList.toggle('bookmarked', isSaved);
  }
}

function toggleBookmarkCity() {
  var loc = state.location;
  var idx = state.savedCities.findIndex(function(c) { return c.name === loc.name; });

  if (idx >= 0) {
    state.savedCities.splice(idx, 1);
  } else {
    state.savedCities.push({ name: loc.name, lat: loc.lat, lon: loc.lon, country: loc.country });
  }

  localStorage.setItem('saved_weather_cities', JSON.stringify(state.savedCities));
  renderSavedCities();
}

function renderDashboard() {
  var weather = state.weather;
  var aqi = state.aqi;
  var location = state.location;
  if (!weather || !weather.current) return;

  var current = weather.current;
  var hourly = weather.hourly;
  var daily = weather.daily;

  var now = new Date();
  var sunriseStr = daily.sunrise ? daily.sunrise[0] : null;
  var sunsetStr = daily.sunset ? daily.sunset[0] : null;
  var solarPhase = getSolarPhase(now, sunriseStr, sunsetStr, current.is_day);

  applyWeatherTheme(current.weather_code, solarPhase);

  var artworkBox = $('hero3DArtwork');
  if (artworkBox) artworkBox.innerHTML = getFrostedGlassMascotSVG(current.weather_code, solarPhase);

  animateNumber($('currentTemp'), formatTemp(current.temperature_2m));
  var symbol = document.querySelector('.temp-unit-symbol');
  if (symbol) symbol.textContent = state.unit === 'fahrenheit' ? '°F' : '°C';

  var codeInfo = WEATHER_CODES[current.weather_code] || { description: 'Clear Sky' };
  $('conditionText').textContent = codeInfo.description;
  $('currentLocation').textContent = location.name + (location.country ? ', ' + location.country : '');

  $('currentTime').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  var todayMax = daily.temperature_2m_max[0];
  var todayMin = daily.temperature_2m_min[0];

  $('badgeHumidity').textContent = current.relative_humidity_2m + '%';
  var windUnit = state.unit === 'fahrenheit' ? 'mph' : 'km/h';
  var windVal = state.unit === 'fahrenheit' ? Math.round(current.wind_speed_10m * 0.621371) : Math.round(current.wind_speed_10m);
  $('badgeWind').textContent = windVal + ' ' + windUnit;
  $('badgeHighLow').textContent = formatTemp(todayMax) + '° / ' + formatTemp(todayMin) + '°';

  var uv = daily.uv_index_max ? daily.uv_index_max[0] : 0;
  $('uvValue').textContent = Math.round(uv);
  var uvCat = 'Low';
  if (uv >= 3) uvCat = 'Moderate';
  if (uv >= 6) uvCat = 'High';
  if (uv >= 8) uvCat = 'Very High';
  $('uvCategory').textContent = uvCat;
  setBar('uvProgress', uv / 12);

  var aqiVal = aqi && aqi.current && isFinite(aqi.current.us_aqi) ? aqi.current.us_aqi : 38;
  $('aqiValue').textContent = Math.round(aqiVal);
  $('aqiCategory').textContent = aqiVal <= 50 ? 'Good Air' : 'Moderate';
  setBar('aqiProgress', aqiVal / 200);

  $('windSpeed').textContent = windVal + ' ' + windUnit;
  var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var dirLabel = dirs[Math.round(current.wind_direction_10m / 45) % 8];
  $('windDirText').textContent = 'From the ' + dirLabel + ' · ' + current.wind_direction_10m + '°';
  var needle = $('compassNeedle');
  if (needle) needle.style.transform = 'rotate(' + current.wind_direction_10m + 'deg)';

  if (daily.sunrise && daily.sunset) {
    $('sunriseTime').textContent = new Date(daily.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    $('sunsetTime').textContent = new Date(daily.sunset[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    renderSolarArc(now, daily.sunrise[0], daily.sunset[0]);
  }

  $('feelsLike').textContent = formatTemp(current.apparent_temperature) + '°';
  var dew = hourly.dew_point_2m ? hourly.dew_point_2m[now.getHours()] : (current.temperature_2m - ((100 - current.relative_humidity_2m) / 5));
  $('dewPoint').textContent = 'Dew point ' + formatTemp(dew) + '°';

  $('pressure').textContent = Math.round(current.surface_pressure) + ' hPa';
  var visKm = hourly.visibility ? Math.round(hourly.visibility[now.getHours()] / 1000) : 10;
  $('visibility').textContent = visKm + ' km';

  renderYesterdayComparison(current.temperature_2m, hourly);
  renderSmartAdvice(current, daily);
  checkWeatherAlerts(current, daily);
  renderHourlyStrip(hourly, sunriseStr, sunsetStr);
  renderDailyForecast(daily);
  renderChart(hourly);
  renderSavedCities();

  // New features
  renderRainTimeline(hourly);
  renderMoonPhase();
  renderSunsetCountdown(sunriseStr, sunsetStr);
  renderWeatherHistory(daily);
  initDynamicWallpaper(current.weather_code);
}

// Lightweight mini weather icon for performance on mobile hourly strips
function getMiniWeatherIcon(code) { return getWeatherIcon(code, 'day'); }

function renderHourlyStrip(hourly, sunriseStr, sunsetStr) {
  var container = $('hourlyForecast');
  if (!container) return;
  container.innerHTML = '';

  var nowHour = new Date().getHours();
  var next24 = hourly.time.slice(nowHour, nowHour + 24);

  next24.forEach(function(timeStr, idx) {
    var realIdx = nowHour + idx;
    var dateObj = new Date(timeStr);
    var label = idx === 0 ? 'Now' : dateObj.toLocaleTimeString('en-US', { hour: 'numeric' });

    var itemIsDay = dateObj.getHours() >= 6 && dateObj.getHours() <= 19 ? 1 : 0;
    var itemPhase = getSolarPhase(dateObj, sunriseStr, sunsetStr, itemIsDay);

    var card = document.createElement('div');
    card.className = 'hourly-card';
    card.style.setProperty('--i', idx);
    card.innerHTML = 
      '<span class="h-time">' + label + '</span>' +
      '<div class="h-icon">' + getWeatherIcon(hourly.weather_code[realIdx], itemPhase) + '</div>' +
      '<span class="h-temp">' + formatTemp(hourly.temperature_2m[realIdx]) + '°</span>';
    container.appendChild(card);
  });
}

// 📅 Expandable 7-Day Forecast with Hourly Drawer
function renderDailyForecast(daily) {
  var container = $('dailyForecast');
  if (!container) return;
  container.innerHTML = '';

  var maxList = daily.temperature_2m_max;
  var minList = daily.temperature_2m_min;
  var globalMax = Math.max.apply(Math, maxList);
  var globalMin = Math.min.apply(Math, minList);
  var totalRange = globalMax - globalMin || 1;

  daily.time.forEach(function(timeStr, idx) {
    var dateObj = new Date(timeStr + 'T00:00:00');
    var dayName = idx === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    var max = maxList[idx];
    var min = minList[idx];

    var leftPct = ((min - globalMin) / totalRange) * 100;
    var widthPct = Math.max(15, ((max - min) / totalRange) * 100);
    // Clamp so bar never overflows container
    if (leftPct + widthPct > 100) widthPct = 100 - leftPct;

    var wrap = document.createElement('div');
    wrap.className = 'daily-item-container';

    var isExpanded = state.expandedDayIndex === idx;

    var row = document.createElement('div');
    row.className = 'daily-item-row';
    row.innerHTML = 
      '<span class="d-day-name">' + dayName + '</span>' +
      '<div class="d-icon-box">' + getFrostedGlassMascotSVG(daily.weather_code[idx], 'day') + '</div>' +
      '<div class="d-bar-container">' +
        '<div class="d-bar-fill-gradient" style="left: ' + leftPct + '%; width: ' + widthPct + '%;"></div>' +
      '</div>' +
      '<span class="d-high-low">' + formatTemp(max) + '° / ' + formatTemp(min) + '°</span>';

    row.onclick = function() {
      state.expandedDayIndex = isExpanded ? -1 : idx;
      renderDailyForecast(daily);
    };

    wrap.appendChild(row);

    if (isExpanded && state.weather && state.weather.hourly) {
      var drawer = document.createElement('div');
      drawer.className = 'expanded-hourly-drawer';
      var strip = document.createElement('div');
      strip.className = 'hourly-scroll-strip';

      var dayStartHour = idx * 24;
      var dayHours = state.weather.hourly.time.slice(dayStartHour, dayStartHour + 24);

      dayHours.forEach(function(hTime, hIdx) {
        var realIdx = dayStartHour + hIdx;
        if (realIdx >= state.weather.hourly.time.length) return;
        var hDate = new Date(hTime);

        var card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = 
          '<span class="h-time">' + hDate.toLocaleTimeString('en-US', { hour: 'numeric' }) + '</span>' +
          '<div class="h-icon">' + getFrostedGlassMascotSVG(state.weather.hourly.weather_code[realIdx], 'day') + '</div>' +
          '<span class="h-temp">' + formatTemp(state.weather.hourly.temperature_2m[realIdx]) + '°</span>';
        strip.appendChild(card);
      });

      drawer.appendChild(strip);
      wrap.appendChild(drawer);
    }

    container.appendChild(wrap);
  });
}

// 📊 Multi-Metric Interactive Chart Engine
function renderChart(hourly) {
  var canvas = $('tempChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var nowHour = new Date().getHours();

  var rawTimeList = hourly.time.slice(nowHour, nowHour + 24);
  var labels = rawTimeList.map(function(t) { return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric' }); });

  var metric = state.activeMetric;
  var datasetValues = [];
  var metricLabel = 'Temperature';
  var metricUnit = state.unit === 'fahrenheit' ? '°F' : '°C';

  if (metric === 'temp') {
    datasetValues = hourly.temperature_2m.slice(nowHour, nowHour + 24).map(function(c) { return Math.round(convertTemp(c)); });
    metricLabel = 'Temperature';
  } else if (metric === 'pop') {
    datasetValues = hourly.precipitation_probability ? hourly.precipitation_probability.slice(nowHour, nowHour + 24) : [];
    metricLabel = 'Rain Chance';
    metricUnit = '%';
  } else if (metric === 'wind') {
    datasetValues = hourly.wind_speed_10m ? hourly.wind_speed_10m.slice(nowHour, nowHour + 24).map(function(w) { return state.unit === 'fahrenheit' ? Math.round(w * 0.621371) : Math.round(w); }) : [];
    metricLabel = 'Wind Speed';
    metricUnit = state.unit === 'fahrenheit' ? ' mph' : ' km/h';
  } else if (metric === 'humidity') {
    datasetValues = hourly.relative_humidity_2m ? hourly.relative_humidity_2m.slice(nowHour, nowHour + 24) : [];
    metricLabel = 'Humidity';
    metricUnit = '%';
  }

  var pops = hourly.precipitation_probability ? hourly.precipitation_probability.slice(nowHour, nowHour + 24) : [];
  var codes = hourly.weather_code.slice(nowHour, nowHour + 24);

  if (typeof Chart !== 'undefined') {
    if (state.chart) state.chart.destroy();

    var gradient = ctx.createLinearGradient(0, 0, 0, 180);
    var accent = cssVar('--accent', '#8fc4e8');
    var inkMuted = cssVar('--ink-3', 'rgba(255,255,255,0.45)');
    var gridLine = cssVar('--line', 'rgba(255,255,255,0.08)');
    gradient.addColorStop(0, accent + '40');
    gradient.addColorStop(1, accent + '00');

    var hairlinePlugin = {
      id: 'hairlineGuide',
      afterDraw: function(chart) {
        if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
          var activePoint = chart.tooltip._active[0];
          var x = activePoint.element.x;
          var topY = chart.scales.y.top;
          var bottomY = chart.scales.y.bottom;

          var chartCtx = chart.ctx;
          chartCtx.save();
          chartCtx.beginPath();
          chartCtx.setLineDash([3, 4]);
          chartCtx.moveTo(x, topY);
          chartCtx.lineTo(x, bottomY);
          chartCtx.lineWidth = 1;
          chartCtx.strokeStyle = cssVar('--ink-3', 'rgba(255,255,255,0.4)');
          chartCtx.stroke();
          chartCtx.restore();
        }
      }
    };

    state.chart = new Chart(ctx, {
      type: 'line',
      plugins: [hairlinePlugin],
      data: {
        labels: labels,
        datasets: [
          {
            label: metricLabel,
            data: datasetValues,
            borderColor: accent,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            backgroundColor: gradient,
            pointBackgroundColor: accent,
            pointBorderWidth: 0,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: accent,
            pointHoverBorderColor: cssVar('--bg', '#090d12'),
            pointHoverBorderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        interaction: {
          mode: 'index',
          intersect: false
        },
        hover: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: cssVar('--pop', '#11161d'),
            titleColor: cssVar('--ink', '#eef1f4'),
            titleFont: { family: 'Inter', size: 12, weight: '600' },
            bodyColor: cssVar('--ink-2', '#cbd5e1'),
            bodyFont: { family: 'Inter', size: 12 },
            borderColor: cssVar('--line-strong', 'rgba(255,255,255,0.18)'),
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            displayColors: false,
            callbacks: {
              title: function(items) {
                return items[0].label;
              },
              label: function(context) {
                var idx = context.dataIndex;
                var val = context.parsed.y;
                var code = codes[idx];
                var desc = WEATHER_CODES[code] ? WEATHER_CODES[code].description : 'Clear Sky';

                return [
                  metricLabel + ': ' + val + metricUnit,
                  'Condition: ' + desc,
                  'Rain Chance: ' + (pops[idx] || 0) + '%'
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: inkMuted, maxTicksLimit: 8, font: { family: 'Inter', size: 11 } }
          },
          y: {
            border: { display: false },
            grid: { color: gridLine },
            ticks: {
              color: inkMuted,
              font: { family: 'Inter', size: 11 },
              callback: function(v) { return v + metricUnit; }
            }
          }
        }
      }
    });
  } else {
    drawNativeInteractiveChart(ctx, canvas, datasetValues, labels, pops, codes, metricLabel, metricUnit);
  }
}

function drawNativeInteractiveChart(ctx, canvas, temps, labels, pops, codes, mLabel, mUnit) {
  var parent = canvas.parentElement;
  var w = canvas.width = parent.clientWidth || 440;
  var h = canvas.height = 170;

  var min = Math.min.apply(Math, temps) - 2;
  var max = Math.max.apply(Math, temps) + 2;
  var range = max - min || 1;
  var stepX = (w - 50) / (temps.length - 1);

  var hoverIndex = -1;

  function render() {
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var yGrid = 20 + i * (h - 50) / 3;
      ctx.moveTo(30, yGrid);
      ctx.lineTo(w - 20, yGrid);
    }
    ctx.stroke();

    var points = temps.map(function(t, idx) {
      return {
        x: 30 + idx * stepX,
        y: h - 25 - ((t - min) / range) * (h - 50)
      };
    });

    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, h - 25);
    ctx.lineTo(points[0].x, h - 25);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (hoverIndex >= 0 && hoverIndex < points.length) {
      var p = points[hoverIndex];

      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(p.x, 15);
      ctx.lineTo(p.x, h - 25);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      ctx.stroke();

      var timeText = labels[hoverIndex];
      var tempText = (mLabel || 'Val') + ': ' + temps[hoverIndex] + (mUnit || '');

      var ttW = 110;
      var ttH = 45;
      var ttX = Math.min(w - ttW - 10, Math.max(10, p.x - ttW / 2));
      var ttY = Math.max(10, p.y - ttH - 12);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(ttX, ttY, ttW, ttH, 8) : ctx.rect(ttX, ttY, ttW, ttH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(timeText, ttX + 8, ttY + 16);

      ctx.fillStyle = '#ffffff';
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(tempText, ttX + 8, ttY + 32);
    }
  }

  render();

  canvas.onmousemove = function(e) {
    var rect = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;

    var step = (w - 50) / (temps.length - 1);
    var closestIdx = Math.round((mouseX - 30) / step);
    closestIdx = Math.max(0, Math.min(temps.length - 1, closestIdx));

    if (closestIdx !== hoverIndex) {
      hoverIndex = closestIdx;
      requestAnimationFrame(render);
    }
  };

  canvas.onmouseleave = function() {
    hoverIndex = -1;
    render();
  };
}

function loadLocationWeather(lat, lon, name, country) {
  state.location = { lat: lat, lon: lon, name: name || 'Pristina', country: country || '' };
  
  localStorage.setItem('user_last_lat', lat);
  localStorage.setItem('user_last_lon', lon);
  localStorage.setItem('user_last_name', name || 'Pristina');
  localStorage.setItem('user_last_country', country || '');

  var input = $('citySearch');
  if (input) input.value = name || 'Pristina';

  // Show loading state
  document.body.classList.add('loading');
  hideErrorState();
  var pullIndicator = $('pullRefreshIndicator');
  if (pullIndicator) pullIndicator.classList.remove('hidden');

  return fetchWeatherData(lat, lon).then(function(res) {
    state.weather = res.weather;
    state.aqi = res.aqi;
    renderDashboard();
    updateLastUpdated();
    haptic('light');

    // Hide loading
    document.body.classList.remove('loading');
    if (pullIndicator) pullIndicator.classList.add('hidden');

    // Fetch supplementary data
    fetchPollenData(lat, lon);
    fetchAQIBreakdown(lat, lon);
    renderMultiCityDashboard();
  }).catch(function(err) {
    console.error('Error fetching weather data:', err);
    document.body.classList.remove('loading');
    if (pullIndicator) pullIndicator.classList.add('hidden');
    showErrorState('Failed to load weather for ' + (name || 'this location') + '. Check your connection.');
    showToast('Connection error', 'error');
  });
}

function setupSearch() {
  var input = $('citySearch');
  var dropdown = $('searchResults');
  var clearBtn = $('clearSearchBtn');
  var form = $('searchForm');

  if (!input) return;

  input.addEventListener('input', function(e) {
    var query = e.target.value;
    clearTimeout(state.searchTimeout);

    if (query.trim().length < 2) {
      if (dropdown) dropdown.classList.add('hidden');
      return;
    }

    state.searchTimeout = setTimeout(function() {
      searchCities(query).then(function(results) {
        state.searchResults = results;
        if (!dropdown) return;
        if (results.length === 0) {
          dropdown.innerHTML = '<div class="dropdown-item"><span class="item-country">No cities found</span></div>';
        } else {
          dropdown.innerHTML = results.map(function(item, idx) {
            return '<div class="dropdown-item" data-index="' + idx + '">' +
                     '<span class="item-city">' + item.name + '</span>' +
                     '<span class="item-country">' + (item.admin1 ? item.admin1 + ', ' : '') + (item.country || '') + '</span>' +
                   '</div>';
          }).join('');
        }
        dropdown.classList.remove('hidden');
      });
    }, 250);
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var query = input.value.trim();
      if (!query) return;

      searchCities(query).then(function(results) {
        if (results && results.length > 0) {
          var sel = results[0];
          if (dropdown) dropdown.classList.add('hidden');
          loadLocationWeather(sel.latitude, sel.longitude, sel.name, sel.country);
        }
      });
    }
  });

  if (dropdown) {
    dropdown.addEventListener('click', function(e) {
      var item = e.target.closest('.dropdown-item');
      if (!item) return;

      var idx = parseInt(item.getAttribute('data-index'), 10);
      var sel = state.searchResults[idx];
      if (sel) {
        dropdown.classList.add('hidden');
        loadLocationWeather(sel.latitude, sel.longitude, sel.name, sel.country);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      input.value = '';
      input.focus();
      if (dropdown) dropdown.classList.add('hidden');
    });
  }

  if (form) {
    form.addEventListener('submit', function(e) { e.preventDefault(); });
  }

  document.addEventListener('click', function(e) {
    if (input && dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

function setupPresets() {
  $$('.preset-pill').forEach(function(pill) {
    pill.addEventListener('click', function() {
      $$('.preset-pill').forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');

      var city = pill.getAttribute('data-city');
      var lat = parseFloat(pill.getAttribute('data-lat'));
      var lon = parseFloat(pill.getAttribute('data-lon'));

      loadLocationWeather(lat, lon, city);
    });
  });
}

function setupUnits() {
  var btnC = $('unitC');
  var btnF = $('unitF');

  function setUnit(newUnit) {
    state.unit = newUnit;
    localStorage.setItem('weather_unit', newUnit);

    if (btnC) btnC.classList.toggle('active', newUnit === 'celsius');
    if (btnF) btnF.classList.toggle('active', newUnit === 'fahrenheit');

    if (state.weather) {
      renderDashboard();
    }
  }

  if (btnC) {
    btnC.onclick = function(e) {
      e.preventDefault();
      setUnit('celsius');
    };
  }

  if (btnF) {
    btnF.onclick = function(e) {
      e.preventDefault();
      setUnit('fahrenheit');
    };
  }
}

// 🎨 Accent Mood Color Selector Controller
function setupAccentPicker() {
  $$('.accent-dot').forEach(function(dot) {
    dot.addEventListener('click', function() {
      $$('.accent-dot').forEach(function(d) { d.classList.remove('active'); });
      dot.classList.add('active');

      var accent = dot.getAttribute('data-accent');
      state.accentTheme = accent;
      localStorage.setItem('weather_accent_theme', accent);

      if (state.weather) {
        renderDashboard();
      }
    });
  });

  var activeDot = document.querySelector('.accent-dot[data-accent="' + state.accentTheme + '"]');
  if (activeDot) {
    $$('.accent-dot').forEach(function(d) { d.classList.remove('active'); });
    activeDot.classList.add('active');
  }
}

function setupMetricTabs() {
  $$('.chart-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      $$('.chart-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');

      state.activeMetric = tab.getAttribute('data-metric');
      if (state.weather && state.weather.hourly) {
        renderChart(state.weather.hourly);
      }
    });
  });
}

// 🌐 Bulletproof Automatic Geolocation Engine (HTML5 + BigDataCloud Reverse Geocoding)
function autoDetectLocation() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var lat = pos.coords.latitude;
        var lon = pos.coords.longitude;
        
        // 1. Instantly load weather for GPS coordinates
        loadLocationWeather(lat, lon, 'Current Location').then(function() {
          // 2. Asynchronously resolve city & country name via CORS-friendly BigDataCloud API
          fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=en')
            .then(function(r) { return r.json(); })
            .then(function(d) {
              if (d && (d.city || d.locality || d.principalSubdivision)) {
                var cityName = d.city || d.locality || d.principalSubdivision;
                var country = d.countryCode || '';
                state.location.name = cityName;
                state.location.country = country;
                $('currentLocation').textContent = cityName + (country ? ', ' + country : '');
                $('citySearch').value = cityName;
                localStorage.setItem('user_last_name', cityName);
                localStorage.setItem('user_last_country', country);
              }
            })
            .catch(function() {
              // Gracefully keep 'Current Location'
            });
        });
      },
      function(err) {
        console.warn('Browser geolocation denied or timed out:', err);
        // Fallback: Automatic IP-based Geolocation lookup
        fetch('https://api.bigdatacloud.net/data/reverse-geocode-client')
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d && d.latitude && d.longitude) {
              var cityName = d.city || d.locality || 'Your Location';
              loadLocationWeather(d.latitude, d.longitude, cityName, d.countryCode);
            } else {
              loadLocationWeather(state.location.lat, state.location.lon, state.location.name, state.location.country);
            }
          })
          .catch(function() {
            loadLocationWeather(state.location.lat, state.location.lon, state.location.name, state.location.country);
          });
      },
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  } else {
    loadLocationWeather(state.location.lat, state.location.lon, state.location.name, state.location.country);
  }
}

// === NEW FEATURES ===

// F1: Precipitation Timeline
function renderRainTimeline(hourly) {
  var container = $('rainTimeline');
  if (!container || !hourly || !hourly.precipitation_probability) return;
  container.innerHTML = '';
  var nowHour = new Date().getHours();
  var next12 = hourly.precipitation_probability.slice(nowHour, nowHour + 12);
  next12.forEach(function(pct, i) {
    var bar = document.createElement('div');
    bar.className = 'rain-bar-segment';
    bar.style.height = Math.max(10, pct) + '%';
    bar.setAttribute('data-pct', pct + '%');
    bar.title = new Date(hourly.time[nowHour + i]).toLocaleTimeString('en-US', { hour: 'numeric' }) + ': ' + pct + '%';
    bar.style.background = pct > 60 ? 'var(--accent)' : (pct > 30 ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : '');
    container.appendChild(bar);
  });
}

// F2: AQI Breakdown
function fetchAQIBreakdown(lat, lon) {
  var url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon + '&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone';
  fetch(url).then(function(r) { return r.json(); }).then(function(d) {
    if (d && d.current) renderAQIBreakdown(d.current);
  }).catch(function() {});
}
function renderAQIBreakdown(data) {
  var grid = $('aqiBreakdownGrid');
  var badge = $('aqiOverallBadge');
  if (!grid) return;
  var aqi = data.us_aqi || 0;
  if (badge) badge.textContent = aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy (Sensitive)' : 'Unhealthy';
  var metrics = [
    { label: 'PM2.5', val: data.pm2_5, max: 75, color: '#38bdf8' },
    { label: 'PM10', val: data.pm10, max: 150, color: '#818cf8' },
    { label: 'NO\u2082', val: data.nitrogen_dioxide, max: 200, color: '#f59e0b' },
    { label: 'O\u2083', val: data.ozone, max: 180, color: '#34d399' }
  ];
  grid.innerHTML = metrics.map(function(m) {
    var pct = Math.min(100, ((m.val || 0) / m.max) * 100);
    return '<div class="aqi-metric-item">' +
      '<div class="aqi-metric-val" style="color:' + m.color + '">' + Math.round(m.val || 0) + '</div>' +
      '<div class="aqi-metric-label">' + m.label + '</div>' +
      '<div class="aqi-metric-bar"><div class="aqi-metric-bar-fill" style="width:' + pct + '%;background:' + m.color + '"></div></div>' +
      '</div>';
  }).join('');
}

// F3: Moon Phase Calculator
function getMoonPhase(date) {
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  if (month < 3) { year--; month += 12; }
  var A = Math.floor(year / 100);
  var B = Math.floor(A / 4);
  var C = 2 - A + B;
  var E = Math.floor(365.25 * (year + 4716));
  var F = Math.floor(30.6001 * (month + 1));
  var JD = C + day + E + F - 1524.5;
  var daysSinceNew = JD - 2451549.5;
  var newMoons = daysSinceNew / 29.53059;
  var phase = newMoons - Math.floor(newMoons);
  return phase;
}
function renderMoonPhase() {
  var phase = getMoonPhase(new Date());
  var illumination = Math.round(Math.abs(phase - 0.5) * 200);
  if (phase > 0.5) illumination = 100 - Math.round((phase - 0.5) * 200);
  else illumination = Math.round(phase * 200);
  
  var name = 'New Moon';
  if (phase < 0.03 || phase > 0.97) name = 'New Moon';
  else if (phase < 0.22) name = 'Waxing Crescent';
  else if (phase < 0.28) name = 'First Quarter';
  else if (phase < 0.47) name = 'Waxing Gibbous';
  else if (phase < 0.53) name = 'Full Moon';
  else if (phase < 0.72) name = 'Waning Gibbous';
  else if (phase < 0.78) name = 'Last Quarter';
  else name = 'Waning Crescent';
  
  var nameEl = $('moonPhaseName');
  var illumEl = $('moonIllumination');
  var svgEl = $('moonPhaseSVG');
  if (nameEl) nameEl.textContent = name;
  if (illumEl) illumEl.textContent = illumination + '% illuminated';
  if (svgEl) {
    var shadowX = phase < 0.5 ? (1 - phase * 4) * 20 : ((phase - 0.5) * 4 - 1) * 20;
    svgEl.innerHTML = '<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">' +
      '<defs><mask id="moonMask"><rect width="44" height="44" fill="#fff"/><circle cx="' + (22 + shadowX) + '" cy="22" r="18" fill="#000"/></mask></defs>' +
      '<circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-opacity=".25"/>' +
      '<circle cx="22" cy="22" r="18" fill="currentColor" mask="url(#moonMask)"/>' +
      '</svg>';
  }
}

// F4: Share Weather Card as Image
function shareWeatherCard() {
  var card = $('mainCard');
  if (!card) return;
  showToast('Generating image...', 'info');
  if (typeof html2canvas === 'undefined') {
    showToast('Share feature loading...', 'info');
    return;
  }
  html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true }).then(function(canvas) {
    canvas.toBlob(function(blob) {
      if (navigator.share && navigator.canShare) {
        var file = new File([blob], 'weather.png', { type: 'image/png' });
        navigator.share({ title: 'Weather - ' + state.location.name, files: [file] }).catch(function() {
          downloadBlob(blob);
        });
      } else {
        downloadBlob(blob);
      }
      showToast('Weather card exported!', 'success');
    });
  }).catch(function() {
    showToast('Failed to generate image', 'error');
  });
}
function downloadBlob(blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'weather-' + state.location.name.toLowerCase().replace(/\s+/g, '-') + '.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// F5: Dynamic Weather Particles
function initDynamicWallpaper(code) {
  document.body.classList.remove('weather-particles-rain', 'weather-particles-snow');
  var info = WEATHER_CODES[code] || { theme: 'sunny' };
  if (info.theme === 'drizzle') document.body.classList.add('weather-particles-rain');
  if (info.theme === 'snow') document.body.classList.add('weather-particles-snow');
}

// F6: Multi-City Dashboard
function renderMultiCityDashboard() {
  var panel = $('multiCityPanel');
  var grid = $('multiCityGrid');
  if (!panel || !grid || state.savedCities.length === 0) {
    if (panel) panel.style.display = 'none';
    return;
  }
  panel.style.display = '';
  grid.innerHTML = '';
  
  state.savedCities.forEach(function(city) {
    var card = document.createElement('div');
    card.className = 'mini-city-card';
    card.innerHTML = '<div class="mini-city-name">' + city.name + '</div>' +
      '<div class="mini-city-temp">--°</div>' +
      '<div class="mini-city-desc">Loading...</div>';
    card.onclick = function() { loadLocationWeather(city.lat, city.lon, city.name, city.country); haptic('light'); };
    grid.appendChild(card);
    
    // Fetch temp for this city
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon + '&current=temperature_2m,weather_code&timezone=auto';
    fetch(url).then(function(r) { return r.json(); }).then(function(d) {
      if (d && d.current) {
        card.querySelector('.mini-city-temp').textContent = formatTemp(d.current.temperature_2m) + '°';
        var desc = WEATHER_CODES[d.current.weather_code] || { description: 'Clear' };
        card.querySelector('.mini-city-desc').textContent = desc.description;
      }
    }).catch(function() {});
  });
}

// F7: Pollen Index
function fetchPollenData(lat, lon) {
  var url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon + '&current=birch_pollen,grass_pollen,ragweed_pollen';
  fetch(url).then(function(r) { return r.json(); }).then(function(d) {
    if (d && d.current) {
      var total = (d.current.grass_pollen || 0) + (d.current.birch_pollen || 0) + (d.current.ragweed_pollen || 0);
      var cat = 'Low';
      if (total > 50) cat = 'Moderate';
      if (total > 150) cat = 'High';
      if (total > 300) cat = 'Very High';
      var valEl = $('pollenValue');
      var catEl = $('pollenCategory');
      var progEl = $('pollenProgress');
      if (valEl) valEl.textContent = Math.round(total);
      if (catEl) catEl.textContent = cat;
      if (progEl) setBar('pollenProgress', total / 400);
    }
  }).catch(function() {});
}

// F8: Weather History Graph
function renderWeatherHistory(daily) {
  var canvas = $('historyChart');
  if (!canvas || !daily || !daily.temperature_2m_max) return;
  if (typeof Chart === 'undefined') return;

  var labels = daily.time.map(function(t) {
    return new Date(t + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
  });
  var maxTemps = daily.temperature_2m_max.map(function(t) { return Math.round(convertTemp(t)); });
  var minTemps = daily.temperature_2m_min.map(function(t) { return Math.round(convertTemp(t)); });
  var warm = cssVar('--warm', '#e9c986');
  var accent = cssVar('--accent', '#8fc4e8');
  var inkMuted = cssVar('--ink-3', 'rgba(255,255,255,0.45)');

  if (state.historyChart) state.historyChart.destroy();
  var ctx = canvas.getContext('2d');
  function ds(label, data, color) {
    return { label: label, data: data, borderColor: color, borderWidth: 2, tension: 0.4, fill: false,
      pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, pointHoverBorderColor: cssVar('--bg', '#090d12'), pointHoverBorderWidth: 3 };
  }
  state.historyChart = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: [ds('High', maxTemps, warm), ds('Low', minTemps, accent)] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', align: 'end', labels: { color: inkMuted, usePointStyle: true, pointStyle: 'line', boxWidth: 18, font: { family: 'Inter', size: 11 } } },
        tooltip: { backgroundColor: cssVar('--pop', '#11161d'), titleColor: cssVar('--ink', '#eef1f4'), bodyColor: cssVar('--ink-2', '#cbd5e1'),
          borderColor: cssVar('--line-strong', 'rgba(255,255,255,0.18)'), borderWidth: 1, padding: 10, cornerRadius: 10, boxPadding: 4 }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: inkMuted, font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: cssVar('--line', 'rgba(255,255,255,0.08)') }, border: { display: false }, ticks: { color: inkMuted, font: { family: 'Inter', size: 11 } } }
      }
    }
  });
}

// F9: Sunrise/Sunset Countdown
var sunsetCountdownInterval = null;
function renderSunsetCountdown(sunriseStr, sunsetStr) {
  clearInterval(sunsetCountdownInterval);
  var el = $('sunsetCountdown');
  if (!el || !sunriseStr || !sunsetStr) return;
  
  function update() {
    var now = new Date();
    var sunrise = new Date(sunriseStr);
    var sunset = new Date(sunsetStr);
    var target, label;
    
    if (now < sunrise) {
      target = sunrise; label = 'Sunrise in ';
    } else if (now < sunset) {
      target = sunset; label = 'Sunset in ';
    } else {
      el.textContent = 'After dark';
      return;
    }
    
    var diff = target - now;
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    el.textContent = label + (h > 0 ? h + 'h ' : '') + m + 'm ' + s + 's';
  }
  
  update();
  sunsetCountdownInterval = setInterval(update, 1000);
}

// U1: Pull-to-Refresh
function setupPullToRefresh() {
  var startY = 0;
  var pulling = false;
  document.addEventListener('touchstart', function(e) {
    if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!pulling) return;
    var diff = e.touches[0].clientY - startY;
    if (diff > 80 && window.scrollY === 0) {
      pulling = false;
      haptic('heavy');
      showToast('Refreshing...', 'info');
      loadLocationWeather(state.location.lat, state.location.lon, state.location.name, state.location.country);
    }
  }, { passive: true });
  document.addEventListener('touchend', function() { pulling = false; }, { passive: true });
}

// U4: Swipe Between Saved Cities
function setupSwipeGestures() {
  var heroCol = document.querySelector('.grid-col-hero');
  if (!heroCol) return;
  var swipeStartX = 0;
  heroCol.addEventListener('touchstart', function(e) {
    swipeStartX = e.touches[0].clientX;
  }, { passive: true });
  heroCol.addEventListener('touchend', function(e) {
    var diff = e.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(diff) < 60) return;
    var allCities = state.savedCities.slice();
    if (allCities.length < 2) return;
    var currentIdx = allCities.findIndex(function(c) { return c.name === state.location.name; });
    if (currentIdx < 0) return;
    var nextIdx;
    if (diff < 0) { nextIdx = (currentIdx + 1) % allCities.length; }
    else { nextIdx = (currentIdx - 1 + allCities.length) % allCities.length; }
    var next = allCities[nextIdx];
    haptic('light');
    showToast(next.name, 'info');
    loadLocationWeather(next.lat, next.lon, next.name, next.country);
  }, { passive: true });
}

// U6: Theme Toggle
function setupThemeToggle() {
  var btn = $('themeToggleBtn');
  var icon = $('themeIcon');
  var savedTheme = localStorage.getItem('weather_theme_mode');
  if (savedTheme === 'light') document.body.classList.add('light-theme');
  
  if (btn) {
    btn.onclick = function() {
      document.body.classList.toggle('light-theme');
      var isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('weather_theme_mode', isLight ? 'light' : 'dark');
      if (icon) icon.innerHTML = isLight
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
      haptic('light');
      showToast(isLight ? 'Light mode' : 'Dark mode', 'info');
      if (state.weather) { renderChart(state.weather.hourly); renderWeatherHistory(state.weather.daily); }
    };
  }
}

// F10: Language Selector
function setupLanguageSelector() {
  var select = $('langSelect');
  if (!select) return;
  select.value = currentLang;
  select.onchange = function() {
    currentLang = select.value;
    localStorage.setItem('weather_lang', currentLang);
    showToast('Language: ' + select.options[select.selectedIndex].text, 'info');
    if (state.weather) renderDashboard();
  };
}

function initApp() {
  setupReveal();
  setupSearch();
  setupPresets();
  setupUnits();
  setupAccentPicker();
  setupMetricTabs();
  setupThemeToggle();
  setupLanguageSelector();
  setupPullToRefresh();
  setupSwipeGestures();

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = function() {
      window.speechSynthesis.getVoices();
    };
  }

  var geoBtn = $('geoLocateBtn');
  if (geoBtn) {
    geoBtn.onclick = function(e) {
      e.preventDefault();
      haptic('light');
      showToast('Detecting location...', 'info');
      autoDetectLocation();
    };
  }

  var voiceBtn = $('speakBriefingBtn');
  if (voiceBtn) {
    voiceBtn.onclick = function() {
      haptic('light');
      speakWeatherBriefing();
    };
  }

  var bookmarkBtn = $('bookmarkCityBtn');
  if (bookmarkBtn) {
    bookmarkBtn.onclick = function() {
      haptic('light');
      toggleBookmarkCity();
      showToast(state.savedCities.some(function(c) { return c.name === state.location.name; }) ? 'City saved!' : 'City removed', 'success');
    };
  }

  var shareBtn = $('shareWeatherBtn');
  if (shareBtn) {
    shareBtn.onclick = function() {
      haptic('light');
      shareWeatherCard();
    };
  }

  var dismissAlertBtn = $('dismissAlertBtn');
  if (dismissAlertBtn) {
    dismissAlertBtn.onclick = function() {
      var bar = $('alertBanner');
      if (bar) bar.classList.add('hidden');
    };
  }

  var retryBtn = $('retryBtn');
  if (retryBtn) {
    retryBtn.onclick = function() {
      hideErrorState();
      loadLocationWeather(state.location.lat, state.location.lon, state.location.name, state.location.country);
    };
  }

  // Single smart startup: load from last location, then try auto-detect
  loadLocationWeather(state.location.lat, state.location.lon, state.location.name, state.location.country).then(function() {
    // Only auto-detect if we're still on the default (Pristina) or if no saved location
    if (!localStorage.getItem('user_last_lat')) {
      autoDetectLocation();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
