from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app import get_db
from flask import current_app
from models.user import create_user
from bson import ObjectId
from flask import current_app
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import random
import string
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    name     = data.get('name', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role     = data.get('role', 'farmer')
    phone    = data.get('phone', '')
    location = data.get('location', '')

    if not all([name, email, password]):
        return jsonify({"error": "name, email and password are required"}), 400

    db = get_db()
    if db.users.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    from app import bcrypt as _bcrypt
    hashed = _bcrypt.generate_password_hash(password).decode('utf-8')
    user   = create_user(name, email, hashed, role, phone, location)
    result = db.users.insert_one(user)

    token = create_access_token(identity=str(result.inserted_id))
    return jsonify({
        "message": "User created successfully",
        "token": token,
        "user": {"id": str(result.inserted_id), "name": name, "email": email, "role": role}
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.get_json()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not all([email, password]):
        return jsonify({"error": "email and password are required"}), 400

    db = get_db()
    user = db.users.find_one({"email": email})
    from app import bcrypt as _bcrypt
    if not user or not _bcrypt.check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user['_id']))
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": str(user['_id']),
            "name": user['name'],
            "email": user['email'],
            "role": user['role']
        }
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    if not user:
        return jsonify({"error": "User not found"}), 404
    user['id'] = str(user.pop('_id'))
    return jsonify(user), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    db = get_db()
    data = request.get_json()
    allowed = ['phone', 'location', 'farm_size', 'crops']
    update = {k: data[k] for k in allowed if k in data}
    db.users.update_one({'_id': ObjectId(user_id)}, {'$set': update})
    return jsonify({'message': 'Profile updated'}), 200

@auth_bp.route('/forgot', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'error': 'Email required'}), 400
    
    db = get_db()
    user = db.users.find_one({'email': email})
    if not user:
        return jsonify({'error': 'Email not found'}), 404
    
    # Generate 6-digit code
    code = ''.join(random.choices(string.digits, k=6))
    
    # Save to reset_codes (expiry 10min)
    expiry = datetime.utcnow() + timedelta(minutes=10)
    db.reset_codes.delete_many({'user_id': str(user['_id'])})  # Cleanup old
    db.reset_codes.insert_one({
        'user_id': str(user['_id']),
        'email': email,
        'code': code,
        'expiry': expiry
    })
    
    # Send email
    try:
        msg = MIMEMultipart()
        msg['From'] = current_app.config['DEFAULT_MAIL_SENDER']
        msg['To'] = email
        msg['Subject'] = 'AgriConnect Password Reset'
        msg.attach(MIMEText(f'Your reset code is: {code}\nExpires in 10 min.\nIgnore if not requested.', 'plain'))
        
        server = smtplib.SMTP(current_app.config['MAIL_SERVER'], current_app.config['MAIL_PORT'])
        server.starttls()
        server.login(current_app.config['MAIL_USERNAME'], current_app.config['MAIL_PASSWORD'])
        text = msg.as_string()
        server.sendmail(msg['From'], email, text)
        server.quit()
        print(f'Reset code {code} sent to {email}')  # Log
    except Exception as e:
        print(f'Email failed: {e}. Code: {code}')
        return jsonify({'error': 'Send email failed, but code logged'}), 500
    
    return jsonify({'message': 'Reset code sent to email'}), 200

@auth_bp.route('/reset', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    code = data.get('code', '')
    password = data.get('password', '')
    
    if not all([email, code, password]):
        return jsonify({'error': 'Email, code and password required'}), 400
    
    db = get_db()
    user = db.users.find_one({'email': email})
    if not user:
        return jsonify({'error': 'Email not found'}), 404
    
    reset = db.reset_codes.find_one({
        'user_id': str(user['_id']),
        'code': code,
        'expiry': {'$gt': datetime.utcnow()}
    })
    
    if not reset:
        return jsonify({'error': 'Invalid or expired code'}), 400
    
    # Update password
    from app import bcrypt as _bcrypt
    hashed = _bcrypt.generate_password_hash(password).decode('utf-8')
    db.users.update_one({'_id': user['_id']}, {'$set': {'password': hashed}})
    db.reset_codes.delete_one({'_id': reset['_id']})
    
    return jsonify({'message': 'Password reset successful'}), 200

