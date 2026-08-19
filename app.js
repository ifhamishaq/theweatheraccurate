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
  activeMetric: 'temp',
  expandedDayIndex: -1,
  savedCities: JSON.parse(localStorage.getItem('saved_weather_cities') || '[]'),
  searchTimeout: null,
  searchResults: []
};

// Performance: detect mobile for reduced rendering
var isMobileDevice = window.innerWidth <= 768;
window.addEventListener('resize', function() { isMobileDevice = window.innerWidth <= 768; });

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

// --- Bespoke Frosted Glassmorphic 3D Weather Icon Generator ---
function getFrostedGlassMascotSVG(code, solarPhase) {
  var info = WEATHER_CODES[code] || { theme: 'sunny', isClear: true };
  var t = info.theme;
  var phase = solarPhase || 'day';
  var isClear = info.isClear;

  var dPath1 = "M126 112H44a24 24 0 0 1-3.6-47.7 32 32 0 0 1 61.4-8.8A22 22 0 0 1 126 112z";
  var dPath2 = "M124 114H46a22 22 0 0 1-2.5-43.8 30 30 0 0 1 58.2-10.2A20 20 0 0 1 124 114z";
  var dPath3 = "M128 110H42a25 25 0 0 1-4.2-49.6 34 34 0 0 1 63.8-7.5A24 24 0 0 1 128 110z";

  if (phase === 'night' && isClear) {
    return `
      <svg class="svg-glass-icon" viewBox="0 0 160 160">
        <defs>
          <radialGradient id="pureMoonGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="50%" stop-color="#e2e8f0"/>
            <stop offset="100%" stop-color="#94a3b8"/>
          </radialGradient>
          <filter id="moonGlowFilter">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g fill="#e0f2fe" opacity="0.8">
          <circle cx="36" cy="40" r="2"/>
          <circle cx="128" cy="48" r="2.5"/>
          <circle cx="138" cy="100" r="2"/>
          <circle cx="32" cy="110" r="1.5"/>
        </g>
        <g class="sun-core-pulse" filter="url(#moonGlowFilter)">
          <path d="M96 32A40 40 0 1 1 52 76a32 32 0 0 0 44-44z" fill="url(#pureMoonGrad)"/>
        </g>
      </svg>
    `;
  }

  if (isClear) {
    var stop1 = phase === 'evening' ? '#ff7700' : (phase === 'morning' ? '#ffaa00' : '#fff066');
    var stop2 = phase === 'evening' ? '#ff0055' : (phase === 'morning' ? '#ff5500' : '#d97706');

    return `
      <svg class="svg-glass-icon" viewBox="0 0 160 160">
        <defs>
          <radialGradient id="pureSunGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="${stop1}"/>
            <stop offset="100%" stop-color="${stop2}"/>
          </radialGradient>
          <linearGradient id="pureRayGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="100%" stop-color="#f59e0b"/>
          </linearGradient>
          <filter id="pureSunGlow">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g class="sun-ray" filter="url(#pureSunGlow)">
          <rect x="74" y="14" width="12" height="24" rx="6" fill="url(#pureRayGrad)"/>
          <rect x="74" y="122" width="12" height="24" rx="6" fill="url(#pureRayGrad)"/>
          <rect x="14" y="74" width="24" height="12" rx="6" fill="url(#pureRayGrad)"/>
          <rect x="122" y="74" width="24" height="12" rx="6" fill="url(#pureRayGrad)"/>
          <rect x="32" y="32" width="12" height="24" rx="6" fill="url(#pureRayGrad)" transform="rotate(-45 38 44)"/>
          <rect x="116" y="116" width="12" height="24" rx="6" fill="url(#pureRayGrad)" transform="rotate(-45 122 128)"/>
          <rect x="32" y="104" width="12" height="24" rx="6" fill="url(#pureRayGrad)" transform="rotate(45 38 116)"/>
          <rect x="116" y="20" width="12" height="24" rx="6" fill="url(#pureRayGrad)" transform="rotate(45 122 32)"/>
        </g>
        <circle class="sun-core-pulse" cx="80" cy="80" r="42" fill="url(#pureSunGrad)" filter="drop-shadow(0 10px 20px rgba(217,119,6,0.5))"/>
      </svg>
    `;
  }

  if (t === 'drizzle' || t === 'sunny') {
    return `
      <svg class="svg-glass-icon" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="rainDropGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#00d2ff"/>
            <stop offset="100%" stop-color="#0066ff"/>
          </linearGradient>
          <radialGradient id="behindSunGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#fff066"/>
            <stop offset="100%" stop-color="#ff9900"/>
          </radialGradient>
          <linearGradient id="glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(255, 255, 255, 0.95)"/>
            <stop offset="60%" stop-color="rgba(255, 255, 255, 0.75)"/>
            <stop offset="100%" stop-color="rgba(230, 240, 255, 0.45)"/>
          </linearGradient>
          <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
            <feOffset dx="0" dy="8" result="offsetblur"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <circle cx="98" cy="54" r="30" fill="url(#behindSunGrad)" filter="drop-shadow(0 0 16px rgba(255,153,0,0.8))"/>

        ${t === 'drizzle' ? `
          <g>
            <rect class="rain-drop-particle" x="52" y="96" width="6" height="24" rx="3" fill="url(#rainDropGrad)" style="animation-delay: 0s;"/>
            <rect class="rain-drop-particle" x="72" y="104" width="6" height="26" rx="3" fill="url(#rainDropGrad)" style="animation-delay: 0.3s;"/>
            <rect class="rain-drop-particle" x="92" y="96" width="6" height="24" rx="3" fill="url(#rainDropGrad)" style="animation-delay: 0.6s;"/>
          </g>
        ` : ''}

        <g filter="url(#softShadow)">
          <path d="${dPath1}" fill="url(#glassBodyGrad)" stroke="rgba(255, 255, 255, 0.9)" stroke-width="1.5">
            <animate attributeName="d" dur="8s" repeatCount="indefinite" values="${dPath1}; ${dPath2}; ${dPath3}; ${dPath1}" keyTimes="0; 0.33; 0.66; 1"/>
          </path>
        </g>
      </svg>
    `;
  }

  if (t === 'thunderstorm') {
    return `
      <svg class="svg-glass-icon" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00f2fe"/>
            <stop offset="100%" stop-color="#4facfe"/>
          </linearGradient>
          <linearGradient id="glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(255, 255, 255, 0.95)"/>
            <stop offset="60%" stop-color="rgba(255, 255, 255, 0.75)"/>
            <stop offset="100%" stop-color="rgba(230, 240, 255, 0.45)"/>
          </linearGradient>
          <filter id="lightningGlow">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <g filter="url(#lightningGlow)">
          <polygon points="78,72 60,110 78,110 68,138 98,96 80,96" fill="url(#boltGrad)"/>
        </g>

        <g filter="drop-shadow(0 10px 20px rgba(0,0,0,0.3))">
          <path d="${dPath1}" fill="url(#glassBodyGrad)" stroke="rgba(255, 255, 255, 0.9)" stroke-width="1.5">
            <animate attributeName="d" dur="8s" repeatCount="indefinite" values="${dPath1}; ${dPath2}; ${dPath3}; ${dPath1}" keyTimes="0; 0.33; 0.66; 1"/>
          </path>
        </g>
      </svg>
    `;
  }

  return `
    <svg class="svg-glass-icon" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="windGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00c6ff"/>
          <stop offset="100%" stop-color="#0072ff"/>
        </linearGradient>
        <linearGradient id="glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(255, 255, 255, 0.95)"/>
          <stop offset="60%" stop-color="rgba(255, 255, 255, 0.75)"/>
          <stop offset="100%" stop-color="rgba(230, 240, 255, 0.45)"/>
        </linearGradient>
      </defs>
      <g stroke="url(#windGrad)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M80 96v26M66 112l14 14 14-14"/>
        <line x1="60" y1="104" x2="100" y2="104"/>
      </g>
      <g filter="drop-shadow(0 10px 20px rgba(0,0,0,0.3))">
        <path d="${dPath1}" fill="url(#glassBodyGrad)" stroke="rgba(255, 255, 255, 0.9)" stroke-width="1.5">
          <animate attributeName="d" dur="8s" repeatCount="indefinite" values="${dPath1}; ${dPath2}; ${dPath3}; ${dPath1}" keyTimes="0; 0.33; 0.66; 1"/>
        </path>
      </g>
    </svg>
  `;
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
  document.body.className = bodyTheme;

  var cardTheme = 'card-theme-' + phase;
  if (!info.isClear) {
    cardTheme = 'card-theme-' + theme;
  }
  var card = $('mainCard');
  if (card) card.className = 'hero-stage-card ' + cardTheme;
}

function fetchWeatherData(lat, lon) {
  var weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,weather_code,visibility,uv_index,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&past_days=1&timezone=auto';
  var aqiUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon + '&current=us_aqi';

  return Promise.all([
    fetch(weatherUrl).then(function(r) { return r.json(); }),
    fetch(aqiUrl).then(function(r) { return r.json(); }).catch(function() { return null; })
  ]).then(function(results) {
    return { weather: results[0], aqi: results[1] };
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
  var emoji = "🏃";

  if (code >= 95) {
    headline = "Severe Thunderstorm Alert";
    body = "Stay indoors if possible. Heavy lightning and strong gusts reported.";
    emoji = "⚡";
  } else if (code >= 61 || pop > 60) {
    headline = "Rain Expected Today";
    body = "Carry a waterproof jacket or umbrella before heading out.";
    emoji = "☔";
  } else if (temp <= 5) {
    headline = "Freezing Weather Ahead";
    body = "Bundle up with heavy coat, thermal gloves, and a beanie.";
    emoji = "🧥";
  } else if (uv >= 7) {
    headline = "Extreme UV Ray Warning";
    body = "High UV radiation index. Wear sunglasses and apply SPF 50 sunscreen.";
    emoji = "🧴";
  } else if (wind >= 25) {
    headline = "Breezy Wind Conditions";
    body = "Wind gusts up to " + Math.round(wind) + " km/h. Secure loose outdoor objects.";
    emoji = "💨";
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
    btn.textContent = '⭐ ' + item.name;
    btn.onclick = function() {
      loadLocationWeather(item.lat, item.lon, item.name, item.country);
    };
    container.appendChild(btn);
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

  $('currentTemp').textContent = formatTemp(current.temperature_2m);
  var symbol = document.querySelector('.temp-unit-symbol');
  if (symbol) symbol.textContent = state.unit === 'fahrenheit' ? '°F' : '°C';

  var codeInfo = WEATHER_CODES[current.weather_code] || { description: 'Clear Sky' };
  $('conditionText').textContent = codeInfo.description;
  $('currentLocation').textContent = location.name + (location.country ? ', ' + location.country : '');

  $('currentTime').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  var todayMax = daily.temperature_2m_max[0];
  var todayMin = daily.temperature_2m_min[0];

  $('badgeHumidity').textContent = current.relative_humidity_2m + '% Humidity';
  var windUnit = state.unit === 'fahrenheit' ? 'mph' : 'km/h';
  var windVal = state.unit === 'fahrenheit' ? Math.round(current.wind_speed_10m * 0.621371) : Math.round(current.wind_speed_10m);
  $('badgeWind').textContent = windVal + ' ' + windUnit + ' Wind';
  $('badgeHighLow').textContent = 'H: ' + formatTemp(todayMax) + '° / L: ' + formatTemp(todayMin) + '°';

  var uv = daily.uv_index_max ? daily.uv_index_max[0] : 0;
  $('uvValue').textContent = Math.round(uv);
  var uvCat = 'Low';
  if (uv >= 3) uvCat = 'Moderate';
  if (uv >= 6) uvCat = 'High';
  if (uv >= 8) uvCat = 'Very High';
  $('uvCategory').textContent = uvCat;
  $('uvProgress').style.width = Math.min(100, (uv / 12) * 100) + '%';

  var aqiVal = aqi && aqi.current ? aqi.current.us_aqi : 38;
  $('aqiValue').textContent = Math.round(aqiVal);
  $('aqiCategory').textContent = aqiVal <= 50 ? 'Good Air' : 'Moderate';
  $('aqiProgress').style.width = Math.min(100, (aqiVal / 200) * 100) + '%';

  $('windSpeed').textContent = windVal + ' ' + windUnit;
  var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var dirLabel = dirs[Math.round(current.wind_direction_10m / 45) % 8];
  $('windDirText').textContent = 'Direction ' + dirLabel + ' (' + current.wind_direction_10m + '°)';
  var needle = $('compassNeedle');
  if (needle) needle.style.transform = 'rotate(' + current.wind_direction_10m + 'deg)';

  if (daily.sunrise && daily.sunset) {
    $('sunriseTime').textContent = new Date(daily.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    $('sunsetTime').textContent = new Date(daily.sunset[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    renderSolarArc(now, daily.sunrise[0], daily.sunset[0]);
  }

  $('feelsLike').textContent = formatTemp(current.apparent_temperature) + '°';
  var dew = hourly.dew_point_2m ? hourly.dew_point_2m[now.getHours()] : (current.temperature_2m - ((100 - current.relative_humidity_2m) / 5));
  $('dewPoint').textContent = 'Dew point is ' + formatTemp(dew) + '°';

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
}

// Lightweight mini weather icon for performance on mobile hourly strips
function getMiniWeatherIcon(code) {
  var info = WEATHER_CODES[code] || { theme: 'sunny', isClear: true };
  if (info.isClear) return '<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="8" fill="#fbbf24"/></svg>';
  if (info.theme === 'snow') return '<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="12" r="7" fill="rgba(255,255,255,0.8)"/><circle cx="12" cy="20" r="2" fill="#bae6fd"/><circle cx="20" cy="22" r="2" fill="#bae6fd"/></svg>';
  if (info.theme === 'thunderstorm') return '<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M10 14h12a6 6 0 00-12 0z" fill="rgba(255,255,255,0.6)"/><polygon points="16,16 13,24 17,20 19,26" fill="#fbbf24"/></svg>';
  if (info.theme === 'drizzle') return '<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M10 14h12a6 6 0 00-12 0z" fill="rgba(255,255,255,0.7)"/><line x1="13" y1="20" x2="13" y2="25" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/><line x1="19" y1="19" x2="19" y2="24" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/></svg>';
  return '<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M8 16h16a7 7 0 00-16 0z" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/></svg>';
}

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
    card.innerHTML = 
      '<span class="h-time">' + label + '</span>' +
      '<div class="h-icon">' + (isMobileDevice ? getMiniWeatherIcon(hourly.weather_code[realIdx]) : getFrostedGlassMascotSVG(hourly.weather_code[realIdx], itemPhase)) + '</div>' +
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
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.08)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

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
          chartCtx.setLineDash([4, 4]);
          chartCtx.moveTo(x, topY);
          chartCtx.lineTo(x, bottomY);
          chartCtx.lineWidth = 1.5;
          chartCtx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
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
            borderColor: '#38bdf8',
            borderWidth: 3,
            tension: 0.45,
            fill: true,
            backgroundColor: gradient,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#0284c7',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#38bdf8',
            pointHoverBorderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#38bdf8',
            titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 'bold' },
            bodyColor: '#f8fafc',
            bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
            borderColor: 'rgba(56, 189, 248, 0.4)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 12,
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
            ticks: { color: 'rgba(255,255,255,0.6)', font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.06)', borderDash: [3, 3] },
            ticks: {
              color: 'rgba(255,255,255,0.6)',
              font: { family: 'Plus Jakarta Sans', size: 11 },
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

  return fetchWeatherData(lat, lon).then(function(res) {
    state.weather = res.weather;
    state.aqi = res.aqi;
    renderDashboard();
  }).catch(function(err) {
    console.error('Error fetching weather data:', err);
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

function initApp() {
  setupSearch();
  setupPresets();
  setupUnits();
  setupAccentPicker();
  setupMetricTabs();

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = function() {
      window.speechSynthesis.getVoices();
    };
  }

  var geoBtn = $('geoLocateBtn');
  if (geoBtn) {
    geoBtn.onclick = function(e) {
      e.preventDefault();
      autoDetectLocation();
    };
  }

  var voiceBtn = $('speakBriefingBtn');
  if (voiceBtn) {
    voiceBtn.onclick = function() {
      speakWeatherBriefing();
    };
  }

  var bookmarkBtn = $('bookmarkCityBtn');
  if (bookmarkBtn) {
    bookmarkBtn.onclick = function() {
      toggleBookmarkCity();
    };
  }

  var dismissAlertBtn = $('dismissAlertBtn');
  if (dismissAlertBtn) {
    dismissAlertBtn.onclick = function() {
      var bar = $('alertBanner');
      if (bar) bar.classList.add('hidden');
    };
  }

  // Load last location instantly, then trigger auto-detection
  loadLocationWeather(state.location.lat, state.location.lon, state.location.name, state.location.country);
  autoDetectLocation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
