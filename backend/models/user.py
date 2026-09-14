from datetime import datetime

def create_user(name, email, password_hash, role="farmer", phone="", location=""):
    return {
        "name": name,
        "email": email,
        "password": password_hash,
        "role": role,
        "phone": phone,
        "location": location,
        "created_at": datetime.utcnow()
    }
