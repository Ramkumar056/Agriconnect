from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import get_db
from bson import ObjectId

admin_bp = Blueprint('admin', __name__)

def require_admin(db, user_id):
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if not user or user['role'] != 'admin':
        return None
    return user

def s(doc):
    doc['id'] = str(doc.pop('_id'))
    return doc

@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def stats():
    user_id = get_jwt_identity()
    db = get_db()
    if not require_admin(db, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    return jsonify({
        'users': db.users.count_documents({}),
        'products': db.products.count_documents({}),
        'orders': db.orders.count_documents({}),
        'pending_products': db.products.count_documents({'status': 'pending'}),
        'farmers': db.users.count_documents({'role': 'farmer'}),
        'buyers': db.users.count_documents({'role': 'buyer'}),
    }), 200

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    user_id = get_jwt_identity()
    db = get_db()
    if not require_admin(db, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    users = [s(u) for u in db.users.find({}, {'password': 0})]
    return jsonify(users), 200

@admin_bp.route('/users/<id>', methods=['DELETE'])
@jwt_required()
def delete_user(id):
    user_id = get_jwt_identity()
    db = get_db()
    if not require_admin(db, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    db.users.delete_one({'_id': ObjectId(id)})
    return jsonify({'message': 'Deleted'}), 200

@admin_bp.route('/products/pending', methods=['GET'])
@jwt_required()
def pending_products():
    user_id = get_jwt_identity()
    db = get_db()
    if not require_admin(db, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    products = [s(p) for p in db.products.find({'status': 'pending'})]
    return jsonify(products), 200

@admin_bp.route('/products/<id>/approve', methods=['PUT'])
@jwt_required()
def approve_product(id):
    user_id = get_jwt_identity()
    db = get_db()
    if not require_admin(db, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    product = db.products.find_one({'_id': ObjectId(id)})
    if not product:
        return jsonify({'error': 'Not found'}), 404
    db.products.update_one({'_id': ObjectId(id)}, {'$set': {'status': 'approved'}})
    # Notify farmer
    db.notifications.insert_one({
        'user_id': product['farmer_id'],
        'message': f"\u2705 Your product \u201c{product['name']}\u201d has been approved and is now live on the marketplace!",
        'type': 'product_approved',
        'read': False,
        'created_at': __import__('datetime').datetime.utcnow()
    })
    return jsonify({'message': 'Approved'}), 200

@admin_bp.route('/products/<id>/reject', methods=['PUT'])
@jwt_required()
def reject_product(id):
    user_id = get_jwt_identity()
    db = get_db()
    if not require_admin(db, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    product = db.products.find_one({'_id': ObjectId(id)})
    if not product:
        return jsonify({'error': 'Not found'}), 404
    db.products.update_one({'_id': ObjectId(id)}, {'$set': {'status': 'rejected'}})
    # Notify farmer
    db.notifications.insert_one({
        'user_id': product['farmer_id'],
        'message': f"\u274c Your product \u201c{product['name']}\u201d was not approved. Please review and resubmit.",
        'type': 'product_rejected',
        'read': False,
        'created_at': __import__('datetime').datetime.utcnow()
    })
    return jsonify({'message': 'Rejected'}), 200

@admin_bp.route('/fix-passwords', methods=['GET'])
def fix_passwords():
    from app import bcrypt as _bcrypt
    import datetime
    db = get_db()
    # Re-hash seed user passwords
    creds = [
        ('admin@agriconnect.com',  'admin123'),
        ('farmer@agriconnect.com', 'farmer123'),
        ('buyer@agriconnect.com',  'buyer123'),
    ]
    for email, pwd in creds:
        h = _bcrypt.generate_password_hash(pwd).decode('utf-8')
        db.users.update_one({'email': email}, {'$set': {'password': h}})

    # Re-seed products
    farmer = db.users.find_one({'role': 'farmer'})
    fid = str(farmer['_id']) if farmer else 'fid'
    db.products.drop()
    db.products.insert_many([
      {'name':'Fresh Tomatoes','category':'Vegetables','price':42,'unit':'kg','quantity':120,'description':'Sun-ripened organic tomatoes, hand-picked daily from open fields.','farmer_name':'Raju Patil','location':'Pune','status':'approved','badge':'Organic','image':'','rating':4.5,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Basmati Rice','category':'Grains','price':78,'unit':'kg','quantity':500,'description':'Long-grain aged basmati with rich aroma. Ideal for biryani.','farmer_name':'Suresh Yadav','location':'Nashik','status':'approved','badge':'Premium','image':'','rating':4.8,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Alphonso Mangoes','category':'Fruits','price':220,'unit':'dozen','quantity':60,'description':'GI-tagged Alphonso mangoes from Ratnagiri. Naturally ripened.','farmer_name':'Anand Sawant','location':'Ratnagiri','status':'approved','badge':'Fresh','image':'','rating':4.9,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Organic Wheat','category':'Grains','price':34,'unit':'kg','quantity':800,'description':'Chemical-free wheat grown using traditional methods. High protein content.','farmer_name':'Raju Patil','location':'Pune','status':'approved','badge':'Organic','image':'','rating':4.3,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Red Onions','category':'Vegetables','price':28,'unit':'kg','quantity':300,'description':'Fresh Nashik red onions. Low moisture, long shelf life.','farmer_name':'Kavita Deshmukh','location':'Nashik','status':'approved','badge':'Fresh','image':'','rating':4.1,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Turmeric Powder','category':'Spices','price':160,'unit':'kg','quantity':80,'description':'High-curcumin Erode turmeric, stone-ground. Deep yellow colour.','farmer_name':'Mahesh Reddy','location':'Hubli','status':'approved','badge':'Premium','image':'','rating':4.7,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Fresh Milk','category':'Dairy','price':55,'unit':'litre','quantity':200,'description':'Pure A2 cow milk from desi Gir breed. Delivered fresh every morning.','farmer_name':'Gopal Nair','location':'Mysore','status':'approved','badge':'Fresh','image':'','rating':4.6,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Green Chillies','category':'Vegetables','price':65,'unit':'kg','quantity':90,'description':'Spicy Guntur green chillies. Perfect for pickles and curries.','farmer_name':'Venkat Rao','location':'Hyderabad','status':'approved','badge':'Fresh','image':'','rating':3.9,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Sugarcane Jaggery','category':'Grains','price':95,'unit':'kg','quantity':150,'description':'Unrefined organic jaggery from Kolhapur. No chemicals added.','farmer_name':'Santosh Kulkarni','location':'Belagavi','status':'approved','badge':'Organic','image':'','rating':4.4,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
      {'name':'Baby Potatoes','category':'Vegetables','price':38,'unit':'kg','quantity':200,'description':'Small creamy baby potatoes. Great for roasting and curries.','farmer_name':'Pradeep Sharma','location':'Mysore','status':'approved','badge':'','image':'','rating':3.8,'reviews':[],'farmer_id':fid,'created_at':datetime.datetime.utcnow()},
    ])

    # Re-seed education
    db.education.drop()
    db.education.insert_many([
      {'title':'Modern Drip Irrigation Techniques','category':'Irrigation','content':'Drip irrigation saves up to 60% water vs flood irrigation. Install emitters near root zones and use soil moisture sensors to automate schedules. Ideal for vegetables and orchards.','youtube_url':'https://www.youtube.com/watch?v=8Cj8TnFdFiE','type':'video','author':'Dr. Suresh Sharma','views':1240,'likes':312,'tags':['water','irrigation'],'created_at':datetime.datetime.utcnow()},
      {'title':'Organic Pest Control — Neem & Companions','category':'Pest Control','content':'Neem oil (5ml/L) controls aphids, whiteflies and mites. Companion planting marigolds near tomatoes repels nematodes. Introduce ladybugs for natural aphid control.','youtube_url':'https://www.youtube.com/watch?v=Kv9dBMBMkIo','type':'video','author':'Kavita Patel','views':2310,'likes':487,'tags':['organic','pest'],'created_at':datetime.datetime.utcnow()},
      {'title':'Soil Health & pH Management','category':'Fertilizers','content':'Test soil pH every season. Maintain 6.0-7.0 for most crops. Add compost to improve structure. Use dhaincha as green manure to fix nitrogen naturally without chemicals.','youtube_url':'','type':'article','author':'Dr. Anil Reddy','views':890,'likes':203,'tags':['soil','compost'],'created_at':datetime.datetime.utcnow()},
      {'title':'Crop Rotation for Higher Yield','category':'Crop Management','content':'Rotate legumes to cereals to vegetables in 3-season cycles. Legumes fix nitrogen, reducing fertilizer cost by 30%. Avoid same-family crops consecutively to break pest cycles.','youtube_url':'','type':'article','author':'Mahesh Kumar','views':670,'likes':145,'tags':['rotation','legumes'],'created_at':datetime.datetime.utcnow()},
      {'title':'Vermicomposting at Home','category':'Fertilizers','content':'Set up a vermicompost bin using kitchen waste and earthworms. Produces nutrient-rich castings in 45-60 days. Apply 2 tonnes/acre to improve soil water retention by 40%.','youtube_url':'https://www.youtube.com/watch?v=0Wd8QLXS0Gg','type':'video','author':'Sunita Rao','views':1580,'likes':394,'tags':['compost','organic'],'created_at':datetime.datetime.utcnow()},
      {'title':'Greenhouse Farming Basics','category':'Crop Management','content':'Low-cost polyhouse structures extend growing season by 3 months. Control temperature, humidity and light for off-season vegetables. ROI typically achieved within 2 crop cycles.','youtube_url':'https://www.youtube.com/watch?v=leHy-Y_8nRs','type':'video','author':'Dr. Pradeep Nair','views':3120,'likes':621,'tags':['greenhouse','polyhouse'],'created_at':datetime.datetime.utcnow()},
    ])

    return jsonify({'status': 'done', 'products': db.products.count_documents({}), 'education': db.education.count_documents({})}), 200

@admin_bp.route('/orders', methods=['GET'])
@jwt_required()
def all_orders():
    user_id = get_jwt_identity()
    db = get_db()
    if not require_admin(db, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    orders = [s(o) for o in db.orders.find().sort('created_at', -1)]
    return jsonify(orders), 200
