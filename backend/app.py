from flask import Flask, send_from_directory, g
from pymongo import MongoClient
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_socketio import SocketIO
from config import Config
import os

jwt = JWTManager()
bcrypt = Bcrypt()
socketio = SocketIO()

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')

def get_db():
    from flask import current_app
    return current_app.db

def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
    app.config.from_object(Config)

    mongo_client = MongoClient(app.config['MONGO_URI'])
    app.db = mongo_client.get_database('agriconnect')
    jwt.init_app(app)
    bcrypt.init_app(app)
    CORS(app, origins="*")
    socketio.init_app(app, cors_allowed_origins="*")

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    from routes.auth_routes import auth_bp
    from routes.product_routes import product_bp
    from routes.order_routes import order_bp
    from routes.education_routes import education_bp
    from routes.admin_routes import admin_bp
    from routes.ai_routes import ai_bp
    from routes.notification_routes import notification_bp
    from routes.chat_routes import chat_bp
    from routes.weather_routes import weather_bp
    from routes.payment_routes import payment_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(product_bp, url_prefix='/api/products')
    app.register_blueprint(order_bp, url_prefix='/api/orders')
    app.register_blueprint(education_bp, url_prefix='/api/education')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(notification_bp, url_prefix='/api/notifications')
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(weather_bp, url_prefix='/api/weather')
    app.register_blueprint(payment_bp, url_prefix='/api/payment')

    @app.route('/')
    def index():
        return send_from_directory(FRONTEND_DIR, 'index.html')

    @app.route('/<path:path>')
    def serve_frontend(path):
        full_path = os.path.join(FRONTEND_DIR, path)
        if os.path.exists(full_path):
            return send_from_directory(FRONTEND_DIR, path)
        return send_from_directory(FRONTEND_DIR, 'index.html')

    @app.route('/uploads/<filename>')
    def uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    with app.app_context():
        seed_data(app.db)
        app.db.products.update_many({'status': 'pending'}, {'$set': {'status': 'approved'}})
    return app

def seed_data(db):
    # bcrypt is already initialised at module level — use it directly
    users = db.users
    if users.count_documents({}) == 0:
        users.insert_many([
            {
                "name": "Admin User",
                "email": "admin@agriconnect.com",
                "password": bcrypt.generate_password_hash("admin123").decode('utf-8'),
                "role": "admin",
                "phone": "9999999999",
                "location": "Mumbai",
                "created_at": __import__('datetime').datetime.utcnow()
            },
            {
                "name": "Raju Patil",
                "email": "farmer@agriconnect.com",
                "password": bcrypt.generate_password_hash("farmer123").decode('utf-8'),
                "role": "farmer",
                "phone": "8888888888",
                "location": "Pune",
                "farm_size": "5 acres",
                "crops": ["Wheat", "Rice"],
                "created_at": __import__('datetime').datetime.utcnow()
            },
            {
                "name": "Priya Buyer",
                "email": "buyer@agriconnect.com",
                "password": bcrypt.generate_password_hash("buyer123").decode('utf-8'),
                "role": "buyer",
                "phone": "7777777777",
                "location": "Mumbai",
                "created_at": __import__('datetime').datetime.utcnow()
            }
        ])

    products = db.products
    if products.count_documents({}) == 0:
        import datetime
        farmer = db.users.find_one({"role": "farmer"})
        fid = str(farmer["_id"]) if farmer else "sample_farmer_id"
        products.insert_many([
            {"name": "Fresh Tomatoes", "category": "Vegetables", "price": 42, "unit": "kg",
             "quantity": 120, "description": "Sun-ripened organic tomatoes, hand-picked daily from open fields.",
             "farmer_id": fid, "farmer_name": "Raju Patil", "location": "Pune", "status": "approved",
             "badge": "Organic", "image": "", "rating": 4.5, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Basmati Rice", "category": "Grains", "price": 78, "unit": "kg",
             "quantity": 500, "description": "Long-grain aged basmati with rich aroma. Ideal for biryani.",
             "farmer_id": fid, "farmer_name": "Suresh Yadav", "location": "Nashik", "status": "approved",
             "badge": "Premium", "image": "", "rating": 4.8, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Alphonso Mangoes", "category": "Fruits", "price": 220, "unit": "dozen",
             "quantity": 60, "description": "GI-tagged Alphonso mangoes from Ratnagiri. Naturally ripened.",
             "farmer_id": fid, "farmer_name": "Anand Sawant", "location": "Ratnagiri", "status": "approved",
             "badge": "Fresh", "image": "", "rating": 4.9, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Organic Wheat", "category": "Grains", "price": 34, "unit": "kg",
             "quantity": 800, "description": "Chemical-free wheat grown using traditional methods. High protein content.",
             "farmer_id": fid, "farmer_name": "Raju Patil", "location": "Pune", "status": "approved",
             "badge": "Organic", "image": "", "rating": 4.3, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Red Onions", "category": "Vegetables", "price": 28, "unit": "kg",
             "quantity": 300, "description": "Fresh Nashik red onions. Low moisture, long shelf life.",
             "farmer_id": fid, "farmer_name": "Kavita Deshmukh", "location": "Nashik", "status": "approved",
             "badge": "Fresh", "image": "", "rating": 4.1, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Turmeric Powder", "category": "Spices", "price": 160, "unit": "kg",
             "quantity": 80, "description": "High-curcumin Erode turmeric, stone-ground. Deep yellow colour.",
             "farmer_id": fid, "farmer_name": "Mahesh Reddy", "location": "Hubli", "status": "approved",
             "badge": "Premium", "image": "", "rating": 4.7, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Fresh Milk", "category": "Dairy", "price": 55, "unit": "litre",
             "quantity": 200, "description": "Pure A2 cow milk from desi Gir breed. Delivered fresh every morning.",
             "farmer_id": fid, "farmer_name": "Gopal Nair", "location": "Mysore", "status": "approved",
             "badge": "Fresh", "image": "", "rating": 4.6, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Green Chillies", "category": "Vegetables", "price": 65, "unit": "kg",
             "quantity": 90, "description": "Spicy Guntur green chillies. Perfect for pickles and curries.",
             "farmer_id": fid, "farmer_name": "Venkat Rao", "location": "Hyderabad", "status": "approved",
             "badge": "Fresh", "image": "", "rating": 3.9, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Sugarcane Jaggery", "category": "Grains", "price": 95, "unit": "kg",
             "quantity": 150, "description": "Unrefined organic jaggery from Kolhapur. No chemicals added.",
             "farmer_id": fid, "farmer_name": "Santosh Kulkarni", "location": "Belagavi", "status": "approved",
             "badge": "Organic", "image": "", "rating": 4.4, "reviews": [], "created_at": datetime.datetime.utcnow()},
            {"name": "Baby Potatoes", "category": "Vegetables", "price": 38, "unit": "kg",
             "quantity": 200, "description": "Small creamy baby potatoes. Great for roasting and curries.",
             "farmer_id": fid, "farmer_name": "Pradeep Sharma", "location": "Mysore", "status": "approved",
             "badge": "", "image": "", "rating": 3.8, "reviews": [], "created_at": datetime.datetime.utcnow()},
        ])

    education = db.education
    if education.count_documents({}) == 0:
        import datetime
        education.insert_many([
            {"title": "Modern Drip Irrigation Techniques", "category": "Irrigation",
             "content": "Drip irrigation saves up to 60% water vs flood irrigation. Install emitters near root zones and use soil moisture sensors to automate schedules. Ideal for vegetables and orchards.",
             "youtube_url": "https://www.youtube.com/watch?v=8Cj8TnFdFiE",
             "type": "video", "author": "Dr. Suresh Sharma", "views": 1240, "likes": 312,
             "tags": ["water", "irrigation", "drip"], "created_at": datetime.datetime.utcnow()},
            {"title": "Organic Pest Control — Neem & Companions", "category": "Pest Control",
             "content": "Neem oil (5ml/L) controls aphids, whiteflies and mites. Companion planting marigolds near tomatoes repels nematodes. Introduce ladybugs for natural aphid control.",
             "youtube_url": "https://www.youtube.com/watch?v=Kv9dBMBMkIo",
             "type": "video", "author": "Kavita Patel", "views": 2310, "likes": 487,
             "tags": ["organic", "pest", "neem"], "created_at": datetime.datetime.utcnow()},
            {"title": "Soil Health & pH Management", "category": "Fertilizers",
             "content": "Test soil pH every season. Maintain 6.0–7.0 for most crops. Add compost to improve structure. Use dhaincha as green manure to fix nitrogen naturally without chemicals.",
             "youtube_url": "",
             "type": "article", "author": "Dr. Anil Reddy", "views": 890, "likes": 203,
             "tags": ["soil", "compost", "pH"], "created_at": datetime.datetime.utcnow()},
            {"title": "Crop Rotation for Higher Yield", "category": "Crop Management",
             "content": "Rotate legumes → cereals → vegetables in 3-season cycles. Legumes fix nitrogen, reducing fertilizer cost by 30%. Avoid same-family crops consecutively to break pest cycles.",
             "youtube_url": "",
             "type": "article", "author": "Mahesh Kumar", "views": 670, "likes": 145,
             "tags": ["rotation", "legumes", "cereals"], "created_at": datetime.datetime.utcnow()},
            {"title": "Vermicomposting at Home", "category": "Fertilizers",
             "content": "Set up a vermicompost bin using kitchen waste and earthworms. Produces nutrient-rich castings in 45–60 days. Apply 2 tonnes/acre to improve soil water retention by 40%.",
             "youtube_url": "https://www.youtube.com/watch?v=0Wd8QLXS0Gg",
             "type": "video", "author": "Sunita Rao", "views": 1580, "likes": 394,
             "tags": ["compost", "organic", "worms"], "created_at": datetime.datetime.utcnow()},
            {"title": "Greenhouse Farming Basics", "category": "Crop Management",
             "content": "Low-cost polyhouse structures extend growing season by 3 months. Control temperature, humidity and light for off-season vegetables. ROI typically achieved within 2 crop cycles.",
             "youtube_url": "https://www.youtube.com/watch?v=leHy-Y_8nRs",
             "type": "video", "author": "Dr. Pradeep Nair", "views": 3120, "likes": 621,
             "tags": ["greenhouse", "polyhouse", "offseason"], "created_at": datetime.datetime.utcnow()},
        ])

if __name__ == '__main__':
    app = create_app()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
