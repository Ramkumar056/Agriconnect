from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import get_db
from bson import ObjectId
import datetime, uuid

payment_bp = Blueprint('payment', __name__)

@payment_bp.route('/pay', methods=['POST'])
@jwt_required()
def pay():
    data = request.get_json()
    db = get_db()
    order = db.orders.find_one({'_id': ObjectId(data.get('order_id'))})
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if order.get('payment_status') == 'paid':
        return jsonify({'error': 'Order already paid'}), 400

    db.orders.update_one(
        {'_id': order['_id']},
        {'$set': {
            'payment_status': 'paid',
            'payment_id': 'DUMMY_' + uuid.uuid4().hex[:10].upper(),
            'paid_at': datetime.datetime.utcnow()
        }}
    )
    return jsonify({'message': 'Payment successful'}), 200
