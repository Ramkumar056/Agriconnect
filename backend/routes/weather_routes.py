from flask import Blueprint, jsonify
import urllib.request
import urllib.parse
import json

weather_bp = Blueprint('weather', __name__)

WMO_CODES = {
    0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
    45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
    61:'Slight rain',63:'Rain',65:'Heavy rain',71:'Slight snow',73:'Snow',75:'Heavy snow',
    80:'Rain showers',81:'Rain showers',82:'Violent rain showers',
    95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'
}

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'AgriConnect/1.0'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())

@weather_bp.route('/<city>', methods=['GET'])
def get_weather(city):
    try:
        geo = fetch_json(f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(city)}&count=1&language=en&format=json")
        if not geo.get('results'):
            return jsonify({'error': f'City "{city}" not found'}), 404
        r = geo['results'][0]
        lat, lon, name = r['latitude'], r['longitude'], r.get('name', city)

        params = 'current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,uv_index,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3'
        w = fetch_json(f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&{params}")

        cur = w['current']
        daily = w['daily']
        forecast = [{
            'date': daily['time'][i],
            'minC': str(daily['temperature_2m_min'][i]),
            'maxC': str(daily['temperature_2m_max'][i]),
            'desc': WMO_CODES.get(daily['weather_code'][i], 'Unknown')
        } for i in range(len(daily['time']))]

        return jsonify({
            'city': name,
            'temp': str(cur['temperature_2m']),
            'feels': str(cur['apparent_temperature']),
            'humidity': str(cur['relative_humidity_2m']),
            'wind': str(cur['wind_speed_10m']),
            'uv': str(cur.get('uv_index', 'N/A')),
            'desc': WMO_CODES.get(cur['weather_code'], 'Unknown'),
            'forecast': forecast
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
