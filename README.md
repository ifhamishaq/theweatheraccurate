# The Weather Accurate

A fast, installable weather app: live conditions, 24-hour and 7-day forecasts, air quality, UV, wind, sun and moon, powered by [Open-Meteo](https://open-meteo.com) (no API key). Plain HTML, CSS and JavaScript, with no build step.

## Features

- **Live weather for any city** with automatic location, search, saved cities and quick presets.
- **City-local time everywhere**: day/night icons, the hourly strip and the sun arc follow the city's clock, not yours.
- **Editorial design**: Instrument Serif and Inter, light and dark themes, four accents, and animation that respects *reduced motion*.
- **Share**: draws a clean 1080×1350 weather card and opens the native share sheet (or downloads the image).
- **Installable (PWA)**: install button, home-screen icons incl. Android maskable, a "my location" shortcut, and full offline support with the last known forecast.
- **Notifications**: optional morning summary, rain-soon alerts and severe-weather warnings (see below).
- **Fast**: self-hosted fonts and Chart.js (no third-party requests besides the weather APIs), charts load after first paint, one air-quality request, animations pause in background tabs.

## Run it

Serve the folder with any static server (service workers need `http://localhost` or HTTPS):

```bash
npx serve .      # or: python3 -m http.server 8080
```

## Notifications: how they work

Settings live behind the bell icon. Preferences and the current city are stored in IndexedDB so the service worker can read them.

- While the app is open, it checks every 10 minutes.
- On Chrome for Android with the app installed, it also registers a **Periodic Background Sync** (`weather-check`) so alerts can arrive when the app is closed. The browser decides the exact timing, so delivery can vary by a few hours.
- iOS supports notifications only for apps added to the Home Screen, and has no background sync.

Guaranteed on-time delivery requires a small push server (Web Push with VAPID keys). The decision logic in `notify-core.js` is shared and can be reused there.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | The app |
| `notify-core.js` | Notification rules and storage (used by page and service worker) |
| `sw.js` | Offline caching, notifications, background sync |
| `manifest.json` | Install metadata, icons, shortcuts, screenshots |
| `assets/` | Fonts (OFL), Chart.js (MIT), icons, screenshots |

Developed by Ifham.
