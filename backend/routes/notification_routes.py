from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import get_db
from bson import ObjectId

notification_bp = Blueprint('notification', __name__)

def s(doc):
    doc['id'] = str(doc.pop('_id'))
    return doc

@notification_bp.route('/', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    db = get_db()

    # Real notifications from notifications collection
    db_notifs = list(db.notifications.find({'user_id': user_id}).sort('created_at', -1).limit(30))
    result = []
    for n in db_notifs:
        result.append({
            'id': str(n['_id']),
            'message': n['message'],
            'type': n.get('type', 'info'),
            'read': n.get('read', False),
            'created_at': str(n.get('created_at', ''))
        })

    return jsonify(result), 200

@notification_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def unread_count():
    user_id = get_jwt_identity()
    db = get_db()
    count = db.notifications.count_documents({'user_id': user_id, 'read': False})
    return jsonify({'count': count}), 200

@notification_bp.route('/mark-read', methods=['PUT'])
@jwt_required()
def mark_all_read():
    user_id = get_jwt_identity()
    db = get_db()
    db.notifications.update_many({'user_id': user_id, 'read': False}, {'$set': {'read': True}})
    return jsonify({'message': 'Marked all read'}), 200
