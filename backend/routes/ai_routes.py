from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

ai_bp = Blueprint('ai', __name__)

CROP_ADVICE = {
    'wheat':   {'season': 'Rabi (Oct-Mar)', 'water': 'Moderate', 'soil': 'Loamy', 'tip': 'Apply nitrogen fertilizer at tillering stage.'},
    'rice':    {'season': 'Kharif (Jun-Nov)', 'water': 'High', 'soil': 'Clay', 'tip': 'Maintain 2-5cm standing water during vegetative stage.'},
    'tomato':  {'season': 'Year-round', 'water': 'Moderate', 'soil': 'Sandy loam', 'tip': 'Stake plants and prune suckers for better yield.'},
    'mango':   {'season': 'Summer (Mar-Jun)', 'water': 'Low-Moderate', 'soil': 'Well-drained', 'tip': 'Avoid waterlogging; apply potash before flowering.'},
    'cotton':  {'season': 'Kharif (May-Nov)', 'water': 'Moderate', 'soil': 'Black cotton soil', 'tip': 'Monitor for bollworm; use pheromone traps.'},
    'sugarcane':{'season': 'Year-round', 'water': 'High', 'soil': 'Loamy', 'tip': 'Ratoon crop saves cost; apply zinc sulfate.'},
    'maize':   {'season': 'Kharif/Rabi', 'water': 'Moderate', 'soil': 'Well-drained loam', 'tip': 'Thin to one plant per hill at 3-leaf stage.'},
    'onion':   {'season': 'Rabi (Oct-Apr)', 'water': 'Moderate', 'soil': 
    'Sandy loam', 'tip': 'Stop irrigation 2 weeks before harvest for better storage.'},
}

DISEASE_ADVICE = {
    'yellow leaves':   {'disease': 'Nitrogen deficiency or yellowing virus', 'remedy': 'Apply urea 20kg/acre or check for aphid vectors.'},
    'brown spots':     {'disease': 'Fungal leaf spot (Alternaria/Cercospora)', 'remedy': 'Spray Mancozeb 2.5g/L water. Remove infected leaves.'},
    'wilting':         {'disease': 'Root rot or Fusarium wilt', 'remedy': 'Improve drainage. Drench with Carbendazim 1g/L.'},
    'white powder':    {'disease': 'Powdery mildew', 'remedy': 'Spray Sulfur 3g/L or Hexaconazole 1ml/L.'},
    'holes in leaves': {'disease': 'Caterpillar or beetle damage', 'remedy': 'Spray Chlorpyrifos 2ml/L or use neem oil 5ml/L.'},
    'stunted growth':  {'disease': 'Micronutrient deficiency or nematodes', 'remedy': 'Apply micronutrient mix; use Carbofuran for nematodes.'},
    'black spots':     {'disease': 'Anthracnose or bacterial blight', 'remedy': 'Spray Copper oxychloride 3g/L. Avoid overhead irrigation.'},
}

@ai_bp.route('/crop-advice', methods=['POST'])
@jwt_required()
def crop_advice():
    data = request.get_json()
    crop = data.get('crop', '').lower().strip()
    info = CROP_ADVICE.get(crop)
    if info:
        return jsonify({'crop': crop, **info}), 200
    # Generic fallback
    return jsonify({
        'crop': crop,
        'season': 'Varies by region',
        'water': 'Moderate',
        'soil': 'Well-drained loam',
        'tip': f'Test soil before planting {crop}. Contact your local KVK for region-specific advice.'
    }), 200

@ai_bp.route('/disease-detect', methods=['POST'])
@jwt_required()
def disease_detect():
    data = request.get_json()
    symptoms = data.get('symptoms', '').lower().strip()
    for key, val in DISEASE_ADVICE.items():
        if key in symptoms:
            return jsonify({'symptoms': symptoms, **val}), 200
    return jsonify({
        'symptoms': symptoms,
        'disease': 'Unknown – needs field inspection',
        'remedy': 'Consult your nearest Krishi Vigyan Kendra (KVK) or agricultural extension officer.'
    }), 200

@ai_bp.route('/market-price', methods=['GET'])
@jwt_required()
def market_price():
    # Simulated mandi prices
    prices = {
        'Wheat': {'min': 2100, 'max': 2400, 'unit': 'quintal'},
        'Rice': {'min': 2000, 'max': 2300, 'unit': 'quintal'},
        'Tomato': {'min': 800, 'max': 2000, 'unit': 'quintal'},
        'Onion': {'min': 600, 'max': 1500, 'unit': 'quintal'},
        'Potato': {'min': 700, 'max': 1200, 'unit': 'quintal'},
        'Cotton': {'min': 5500, 'max': 6500, 'unit': 'quintal'},
        'Sugarcane': {'min': 290, 'max': 315, 'unit': 'quintal'},
        'Maize': {'min': 1700, 'max': 2000, 'unit': 'quintal'},
    }
    return jsonify(prices), 200
