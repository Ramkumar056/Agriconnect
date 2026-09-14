from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import get_db
from bson import ObjectId
import datetime

order_bp = Blueprint('order', __name__)

def serialize(o):
    o['id'] = str(o.pop('_id'))
    return o

@order_bp.route('/', methods=['POST'])
@jwt_required()
def place_order():
    user_id = get_jwt_identity()
    db = get_db()
    data = request.get_json()
    product = db.products.find_one({'_id': ObjectId(data['product_id'])})
    if not product: return jsonify({'error': 'Product not found'}), 404
    if product.get('status') == 'out_of_stock':
        return jsonify({'error': 'Product is out of stock'}), 400
    qty = int(data.get('quantity', 1))
    if qty <= 0: return jsonify({'error': 'Quantity must be at least 1'}), 400
    if product['quantity'] < qty: return jsonify({'error': 'Insufficient stock'}), 400
    buyer = db.users.find_one({'_id': ObjectId(user_id)})
    order = {
        'buyer_id': user_id, 'buyer_name': buyer['name'],
        'product_id': data['product_id'],
        'product_name': product['name'], 'farmer_id': product['farmer_id'],
        'farmer_name': product['farmer_name'], 'quantity': qty,
        'price': product['price'], 'total': product['price'] * qty,
        'unit': product['unit'], 'status': 'confirmed',
        'payment_method': data.get('payment_method', 'upi'),
        'payment_status': 'paid',
        'delivery_address': data.get('delivery_address', ''),
        'created_at': datetime.datetime.utcnow()
    }
    result = db.orders.insert_one(order)
    # Reduce stock; mark out_of_stock if depleted
    new_qty = product['quantity'] - qty
    stock_update = {'quantity': new_qty}
    if new_qty <= 0:
        stock_update['status'] = 'out_of_stock'
    db.products.update_one({'_id': ObjectId(data['product_id'])}, {'$set': stock_update})
    # Notify farmer of sale
    db.notifications.insert_one({
        'user_id': product['farmer_id'],
        'message': f"\U0001f6d2 {buyer['name']} ordered {qty} {product['unit']} of \u201c{product['name']}\u201d \u2014 \u20b9{product['price'] * qty:.0f} earned.",
        'type': 'new_order',
        'read': False,
        'created_at': datetime.datetime.utcnow()
    })
    # Notify buyer of confirmation
    db.notifications.insert_one({
        'user_id': user_id,
        'message': f"\u2705 Order confirmed for \u201c{product['name']}\u201d ({qty} {product['unit']}) \u2014 \u20b9{product['price'] * qty:.0f}. Delivery in 2\u20133 days.",
        'type': 'order_confirmed',
        'read': False,
        'created_at': datetime.datetime.utcnow()
    })
    order['id'] = str(result.inserted_id)
    return jsonify(order), 201

@order_bp.route('/my', methods=['GET'])
@jwt_required()
def my_orders():
    user_id = get_jwt_identity()
    db = get_db()
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if user['role'] == 'farmer':
        orders = [serialize(o) for o in db.orders.find({'farmer_id': user_id})]
    else:
        orders = [serialize(o) for o in db.orders.find({'buyer_id': user_id})]
    return jsonify(orders), 200

@order_bp.route('/<id>/status', methods=['PUT'])
@jwt_required()
def update_status(id):
    user_id = get_jwt_identity()
    db = get_db()
    data = request.get_json()
    new_status = data.get('status', '')
    order = db.orders.find_one({'_id': ObjectId(id)})
    if not order: return jsonify({'error': 'Not found'}), 404
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if order['farmer_id'] != user_id and user['role'] != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    db.orders.update_one({'_id': ObjectId(id)}, {'$set': {'status': new_status}})

    now = datetime.datetime.utcnow()
    pname = order['product_name']
    buyer_id  = order['buyer_id']
    farmer_id = order['farmer_id']

    # Push role-specific notifications for each lifecycle stage
    notifs = {
        'shipped': [
            (farmer_id, f"\U0001f69a You marked \u201c{pname}\u201d as shipped.",          'order_shipped'),
            (buyer_id,  f"\U0001f69a Your order \u201c{pname}\u201d has been dispatched and is on its way!", 'order_shipped'),
        ],
        'out_for_delivery': [
            (farmer_id, f"\U0001f4e6 \u201c{pname}\u201d is out for delivery.",             'order_delivery'),
            (buyer_id,  f"\U0001f4e6 Your order \u201c{pname}\u201d is out for delivery. Expect it today!", 'order_delivery'),
        ],
        'delivered': [
            (farmer_id, f"\U0001f4b0 \u201c{pname}\u201d delivered successfully. Payment of \u20b9{order['total']:.0f} earned.", 'order_delivered'),
            (buyer_id,  f"\u2705 Your order \u201c{pname}\u201d has been delivered. Enjoy!",  'order_delivered'),
        ],
        'cancelled': [
            (farmer_id, f"\u274c Order for \u201c{pname}\u201d was cancelled.",              'order_cancelled'),
            (buyer_id,  f"\u274c Your order \u201c{pname}\u201d has been cancelled.",         'order_cancelled'),
        ],
    }

    for uid, msg, ntype in notifs.get(new_status, []):
        db.notifications.insert_one({
            'user_id': uid, 'message': msg,
            'type': ntype, 'read': False, 'created_at': now
        })

    return jsonify({'message': 'Status updated'}), 200
