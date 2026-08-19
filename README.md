

## Overview

The Weather Accurate is a modern, single-page weather application built with HTML, CSS, and JavaScript. It leverages the Open Meteo API to provide real-time weather data, forecasts, and location-based services without requiring an API key. The app features a sleek glassmorphic design, smooth animations for various weather conditions, and an intuitive user interface that adapts to desktop and mobile devices.

This project demonstrates best practices in web development, including responsive design, API integration, geolocation handling, and performance-optimized animations. It's completely free to use and modify, making it ideal for learning or personal weather tracking.

## Features

- **Automatic Location Detection**: Uses HTML5 Geolocation API for instant weather based on your current position, with graceful fallback if permission is denied.
- **City Search**: Enter a city name and press Enter to fetch weather data directly; includes debounced input for efficient API calls.
- **Comprehensive Weather Display**:
  - Current conditions: Temperature, "feels like" temperature, humidity, wind speed/direction.
  - Hourly forecast for the next 24 hours (in 3-hour intervals).
  - 7-day daily forecast with high/low temperatures.
- **Temperature Unit Toggle**: Switch between Celsius and Fahrenheit, with preferences saved in local storage.
- **Weather-Specific Animations**:
  - Lens glare effects for sunny conditions.
  - Realistic snowflake falling for snowy weather.
  - Heavy rain overlay (CSS-based, no flashing lightning) for thunderstorms (triggered by WMO codes 95/96/99).
  - Smooth transitions and particle effects that update dynamically on location change.
- **Glassmorphic UI**: Premium design with backdrop filters, multi-layered cards, and subtle gradients for a classy, professional look.
- **Error Handling**: Robust management of API errors, geolocation issues, and network problems with user-friendly messages.
- **Responsive Design**: Fully adaptable to all screen sizes using CSS Grid and Flexbox.
- **Accessibility**: Semantic HTML, ARIA labels, and keyboard navigation support.

## Technologies Used

- **Frontend**: HTML5, CSS3 (including animations from sources like Foolish Developer for rain effects), Vanilla JavaScript.
- **API**: Open Meteo (Forecast and Geocoding endpoints).
- **Fonts**: Professional stack including SF Pro Display, Helvetica Neue, and system fallbacks for a clean, app-like typography.
- **Animations**: CSS keyframe animations and JavaScript for dynamic weather effects (e.g., particles for snow/rain, lens glare for sun).
- **Other**: Local Storage for user preferences, Canvas for advanced particle systems.

## Usage

1. **Launch the App**: Open `index.html` in a browser.
2. **Grant Location Access**: On first load, allow geolocation for automatic weather data.
3. **Search Locations**: Type a city name in the search bar and press Enter to view weather for that location.
4. **Toggle Units**: Click the unit button to switch between °C and °F.
5. **View Forecasts**: Scroll through hourly and daily sections; animations will adapt to the current weather.

The app is optimized for Chrome, Firefox, Safari, and Edge. Test on different devices for the full responsive experience.

## Screenshots


- **Main Interface**: Glassmorphic cards with current weather.
- **Sunny Animation**: Lens glare effects.
- **Thunderstorm**: Heavy rain overlay.
- **Snow**: Falling snowflakes.


## Acknowledgments

- Open Meteo API for free weather data.
- Inspiration from modern weather apps like Apple's iOS Weather.
- CSS animation resources, including Foolish Developer's rain effects tutorial.

