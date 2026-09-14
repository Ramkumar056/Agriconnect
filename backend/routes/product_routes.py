from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import get_db
from bson import ObjectId
import datetime, os
from werkzeug.utils import secure_filename
from flask import current_app

product_bp = Blueprint('product', __name__)

def serialize(p):
    p['id'] = str(p.pop('_id'))
    return p

@product_bp.route('/', methods=['GET'])
def get_products():
    db = get_db()
    query = {}
    cat = request.args.get('category')
    search = request.args.get('search')
    if cat: query['category'] = cat
    if search: query['name'] = {'$regex': search, '$options': 'i'}
    query['status'] = 'approved'
    products = [serialize(p) for p in db.products.find(query)]
    return jsonify(products), 200

@product_bp.route('/<id>', methods=['GET'])
def get_product(id):
    db = get_db()
    p = db.products.find_one({'_id': ObjectId(id)})
    if not p: return jsonify({'error': 'Not found'}), 404
    return jsonify(serialize(p)), 200

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@product_bp.route('/upload-image', methods=['POST'])
@jwt_required()
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['image']
    if not file or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Use JPG, PNG or WEBP'}), 400
    filename = secure_filename(file.filename)
    import uuid
    filename = f"{uuid.uuid4().hex}_{filename}"
    upload_folder = current_app.config['UPLOAD_FOLDER']
    file.save(os.path.join(upload_folder, filename))
    return jsonify({'url': f'/uploads/{filename}'}), 200

@product_bp.route('/', methods=['POST'])
@jwt_required()
def create_product():
    user_id = get_jwt_identity()
    db = get_db()
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if not user or user['role'] not in ('farmer', 'admin'):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json()
    # All products auto-approved on creation
    status = 'approved'
    product = {
        'name': data.get('name'), 'category': data.get('category'),
        'price': float(data.get('price', 0)), 'unit': data.get('unit', 'kg'),
        'quantity': int(data.get('quantity', 0)), 'description': data.get('description', ''),
        'farmer_id': user_id, 'farmer_name': user['name'],
        'location': data.get('location') or user.get('location', ''),
        'status': status, 'badge': data.get('badge', ''),
        'image': data.get('image', ''), 'rating': 0, 'reviews': [],
        'created_at': datetime.datetime.utcnow()
    }
    result = db.products.insert_one(product)
    pid = str(result.inserted_id)
    # Push notification to farmer
    db.notifications.insert_one({
        'user_id': user_id,
        'message': f"\u2705 Your product \u201c{product['name']}\u201d is now live on the marketplace!",
        'type': 'product_approved',
        'read': False,
        'created_at': datetime.datetime.utcnow()
    })
    product['id'] = pid
    return jsonify(product), 201

@product_bp.route('/<id>', methods=['PUT'])
@jwt_required()
def update_product(id):
    user_id = get_jwt_identity()
    db = get_db()
    p = db.products.find_one({'_id': ObjectId(id)})
    if not p: return jsonify({'error': 'Not found'}), 404
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if p['farmer_id'] != user_id and user['role'] != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json()
    allowed = ['name','category','price','unit','quantity','description','image','status','location']
    update = {k: data[k] for k in allowed if k in data}
    db.products.update_one({'_id': ObjectId(id)}, {'$set': update})
    return jsonify({'message': 'Updated'}), 200

@product_bp.route('/<id>', methods=['DELETE'])
@jwt_required()
def delete_product(id):
    user_id = get_jwt_identity()
    db = get_db()
    p = db.products.find_one({'_id': ObjectId(id)})
    if not p: return jsonify({'error': 'Not found'}), 404
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if p['farmer_id'] != user_id and user['role'] != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    db.products.delete_one({'_id': ObjectId(id)})
    return jsonify({'message': 'Deleted'}), 200

@product_bp.route('/my/listings', methods=['GET'])
@jwt_required()
def my_products():
    user_id = get_jwt_identity()
    db = get_db()
    products = [serialize(p) for p in db.products.find({'farmer_id': user_id})]
    return jsonify(products), 200

@product_bp.route('/<id>/review', methods=['POST'])
@jwt_required()
def add_review(id):
    user_id = get_jwt_identity()
    db = get_db()
    data = request.get_json()
    user = db.users.find_one({'_id': ObjectId(user_id)})
    review = {'user': user['name'], 'rating': data.get('rating', 5), 'comment': data.get('comment', ''), 'date': str(datetime.datetime.utcnow().date())}
    db.products.update_one({'_id': ObjectId(id)}, {'$push': {'reviews': review}})
    return jsonify({'message': 'Review added'}), 201
