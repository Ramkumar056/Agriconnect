from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import get_db
from bson import ObjectId
import datetime

education_bp = Blueprint('education', __name__)

def serialize(e):
    e['id'] = str(e.pop('_id'))
    return e

@education_bp.route('/', methods=['GET'])
def get_articles():
    db = get_db()
    query = {}
    cat = request.args.get('category')
    if cat: query['category'] = cat
    articles = [serialize(a) for a in db.education.find(query).sort('created_at', -1)]
    return jsonify(articles), 200

@education_bp.route('/<id>', methods=['GET'])
def get_article(id):
    db = get_db()
    a = db.education.find_one({'_id': ObjectId(id)})
    if not a: return jsonify({'error': 'Not found'}), 404
    db.education.update_one({'_id': ObjectId(id)}, {'$inc': {'views': 1}})
    return jsonify(serialize(a)), 200

@education_bp.route('/', methods=['POST'])
@jwt_required()
def create_article():
    user_id = get_jwt_identity()
    db = get_db()
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if user['role'] not in ('farmer', 'buyer', 'admin'): return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json()
    article = {
        'title': data['title'], 'category': data.get('category', 'General'),
        'content': data['content'], 'type': data.get('type', 'article'),
        'author': user['name'], 'views': 0, 'likes': 0,
        'tags': data.get('tags', []), 'youtube_url': data.get('youtube_url', ''),
        'created_at': datetime.datetime.utcnow()
    }
    result = db.education.insert_one(article)
    article['id'] = str(result.inserted_id)
    return jsonify(article), 201

@education_bp.route('/<id>/like', methods=['POST'])
def like_article(id):
    db = get_db()
    db.education.update_one({'_id': ObjectId(id)}, {'$inc': {'likes': 1}})
    return jsonify({'message': 'Liked'}), 200
