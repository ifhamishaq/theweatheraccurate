// Shared notification engine — loaded by the page AND the service worker.
// Pure decision logic (decide) is separate from I/O (runCheck) so it can be tested.
(function (root) {
  'use strict';

  var DB_NAME = 'wa-notify';
  var STORE = 'kv';

  // ---- tiny IndexedDB key/value store (the service worker can't read localStorage) ----
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function kvGet(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var r = db.transaction(STORE).objectStore(STORE).get(key);
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function kvSet(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  var DESCRIPTIONS = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm'
  };
  function describe(code) { return DESCRIPTIONS[code] || 'Mixed conditions'; }

  function forecastUrl(loc) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
      '&current=temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m' +
      '&hourly=precipitation_probability,precipitation,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max' +
      '&forecast_days=2&timezone=auto';
  }

  function temp(c, unit) {
    var v = unit === 'fahrenheit' ? c * 9 / 5 + 32 : c;
    return Math.round(v) + '°';
  }
  function hourLabel(iso) {
    var h = parseInt(iso.slice(11, 13), 10);
    return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? ' AM' : ' PM');
  }
  function minutesOfDay(hhmm) {
    var p = String(hhmm || '07:30').split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1] || '0', 10);
  }

  // data: Open-Meteo response (wall-clock strings in the city's timezone)
  // prefs: { morning, morningTime, rain, severe, unit }   memo: { morning, rain, severe }
  // Returns { notifications: [{tag,title,body}], memo }
  function decide(data, prefs, memo, loc) {
    var out = [];
    var next = {};
    for (var k in (memo || {})) next[k] = memo[k];
    if (!data || !data.current || !data.hourly || !data.daily) return { notifications: out, memo: next };

    var nowIso = data.current.time;                  // e.g. 2026-10-09T07:10
    var today = nowIso.slice(0, 10);
    var nowMin = parseInt(nowIso.slice(11, 13), 10) * 60 + parseInt(nowIso.slice(14, 16), 10);
    var nowMs = Date.parse(nowIso + 'Z');            // comparable only with other wall-clock values
    var city = (loc && loc.name) || 'Your location';
    var unit = prefs.unit;

    var hi = data.hourly.time.findIndex(function (t) { return t.slice(0, 13) === nowIso.slice(0, 13); });
    if (hi < 0) hi = 0;

    // Morning summary: once per local day, from the chosen time onward (sync can arrive late)
    if (prefs.morning) {
      var due = minutesOfDay(prefs.morningTime);
      if (nowMin >= due && nowMin < due + 6 * 60 && next.morning !== today) {
        var d = data.daily;
        var di = d.time.indexOf(today); if (di < 0) di = 0;
        var pop = d.precipitation_probability_max ? d.precipitation_probability_max[di] : 0;
        var line = describe(d.weather_code[di]) + ', ' + temp(d.temperature_2m_max[di], unit) + ' / ' + temp(d.temperature_2m_min[di], unit) + '.';
        if (pop >= 40) line += ' ' + pop + '% chance of rain.';
        if (d.uv_index_max && d.uv_index_max[di] >= 6) line += ' UV gets high today.';
        out.push({ tag: 'morning', title: 'Good morning · ' + city + ' ' + temp(data.current.temperature_2m, unit), body: line });
        next.morning = today;
      }
    }

    // Rain alert: rain likely within the next 2 hours (not when it's already raining)
    if (prefs.rain) {
      var raining = (data.current.precipitation || 0) > 0.1;
      var peak = 0, peakAt = -1;
      for (var i = hi + 1; i <= hi + 2 && i < data.hourly.time.length; i++) {
        var p = data.hourly.precipitation_probability[i] || 0;
        if (p > peak) { peak = p; peakAt = i; }
      }
      var recent = next.rain && (nowMs - next.rain) < 4 * 3600 * 1000;
      if (!raining && peak >= 60 && !recent) {
        out.push({ tag: 'rain', title: 'Rain soon in ' + city, body: peak + '% chance of rain around ' + hourLabel(data.hourly.time[peakAt]) + '. Take an umbrella.' });
        next.rain = nowMs;
      }
    }

    // Severe weather: thunderstorm or strong wind
    if (prefs.severe) {
      var code = data.current.weather_code, wind = data.current.wind_speed_10m || 0;
      var recentS = next.severe && (nowMs - next.severe) < 6 * 3600 * 1000;
      if ((code >= 95 || wind >= 60) && !recentS) {
        out.push({
          tag: 'severe',
          title: 'Severe weather in ' + city,
          body: code >= 95 ? describe(code) + ' reported. Stay indoors if you can.' : 'Strong winds of ' + Math.round(wind) + ' km/h. Secure loose objects.'
        });
        next.severe = nowMs;
      }
    }
    return { notifications: out, memo: next };
  }

  function show(reg, n) {
    return reg.showNotification(n.title, {
      body: n.body,
      tag: n.tag,
      renotify: false,
      icon: 'assets/icons/icon-192.png',
      badge: 'assets/icons/badge-96.png',
      data: { url: './' }
    });
  }

  // Reads settings, fetches the forecast, shows whatever is due. Safe to call from page or SW.
  function runCheck(reg) {
    return Promise.all([kvGet('prefs'), kvGet('location'), kvGet('memo')]).then(function (v) {
      var prefs = v[0], loc = v[1], memo = v[2] || {};
      if (!prefs || !prefs.enabled || !loc) return 0;
      return fetch(forecastUrl(loc)).then(function (r) { return r.json(); }).then(function (data) {
        var res = decide(data, prefs, memo, loc);
        return Promise.all(res.notifications.map(function (n) { return show(reg, n); }))
          .then(function () { return kvSet('memo', res.memo); })
          .then(function () { return res.notifications.length; });
      });
    }).catch(function () { return 0; });
  }

  root.WeatherNotify = { decide: decide, runCheck: runCheck, kvGet: kvGet, kvSet: kvSet, forecastUrl: forecastUrl, describe: describe, show: show };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WeatherNotify;
})(typeof self !== 'undefined' ? self : this);
