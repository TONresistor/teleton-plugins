# weather

Current weather and 7-day forecast via Open-Meteo API — free, no API key required.

## Tools

| Tool | Description |
|------|-------------|
| `weather_current` | Get current weather for any city (temp, feels like, humidity, wind, pressure) |
| `weather_forecast` | Get 7-day forecast with daily min/max temperatures and conditions |

## Install

```bash
mkdir -p ~/.teleton/plugins
cp -r weather ~/.teleton/plugins/
```

## Usage

> What's the weather in New York?

> Current weather in Tokyo

> Show me the forecast for London this week

> 7-day forecast for Berlin

## Schemas

### weather_current

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `city` | string | yes | City name in any language (e.g. "Moscow", "New York", "Tokyo") |

### weather_forecast

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `city` | string | yes | City name in any language |

## API reference

- Weather data: [Open-Meteo](https://open-meteo.com/) (free, open-source)
- Geocoding: [Open-Meteo Geocoding API](https://geocoding-api.open-meteo.com/) (multilingual city name support)
