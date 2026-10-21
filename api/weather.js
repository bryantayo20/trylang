import { json, method } from './_lib/db.js';

const LOCATION = { name: 'Bayombong, Nueva Vizcaya', latitude: 16.48, longitude: 121.15 };
const weatherText = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Heavy freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
};

export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({ latitude: String(LOCATION.latitude), longitude: String(LOCATION.longitude), current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m', timezone: 'Asia/Manila' }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const data = await response.json();
    const current = data.current;
    if (!current) throw new Error('Weather provider returned no current conditions');
    return json(res, 200, {
      location: LOCATION.name,
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      condition: weatherText[current.weather_code] || 'Current conditions',
      observedAt: current.time,
      units: { temperature: data.current_units?.temperature_2m || '°C', windSpeed: data.current_units?.wind_speed_10m || 'km/h' },
    }, { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1200' });
  } catch (error) {
    console.error('Weather request failed:', error.message);
    return json(res, 502, { error: 'Weather information is temporarily unavailable.' });
  }
}

