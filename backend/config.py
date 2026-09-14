import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'agriconnect-secret-key-2024')
    MONGO_URI = os.getenv("MONGO_URI")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    WEATHER_API_KEY = "demo_key"  # Replace with OpenWeatherMap API key
    # ── EMAIL SMTP (Gmail) ─────────────────────────────────────────────────
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', 'yourapp@gmail.com')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', 'your-app-password')
    DEFAULT_MAIL_SENDER = MAIL_USERNAME
# ── EMAIL: Set MAIL_USERNAME=your@gmail.com MAIL_PASSWORD=app-password ──
# ── PUT YOUR RAZORPAY KEYS HERE ──────────────────────────────────────────
    # Get keys from: https://razorpay.com → Dashboard → Settings → API Keys
    RAZORPAY_KEY_ID     = os.environ.get('RAZORPAY_KEY_ID',     'YOUR_KEY_ID_HERE')
    RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', 'YOUR_KEY_SECRET_HERE')
