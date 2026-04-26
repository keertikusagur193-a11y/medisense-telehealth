#!/usr/bin/env python3
"""
MediSense Deployment Helper for Render
This script helps set up environment variables for Render deployment.
"""

import os
import secrets
from pathlib import Path

def generate_secret_key():
    """Generate a secure random secret key"""
    return secrets.token_urlsafe(32)

def setup_env_for_render():
    """Set up environment variables for Render deployment"""
    print("🚀 MediSense Render Deployment Setup")
    print("=" * 50)

    # Check if .env file exists
    env_file = Path('.env')
    if env_file.exists():
        print("⚠️  .env file already exists. Be careful with sensitive data!")
        return

    # Generate secret key
    secret_key = generate_secret_key()

    # Create .env file
    env_content = f"""# MediSense Environment Configuration for Render
MONGODB_URI=YOUR_MONGODB_ATLAS_CONNECTION_STRING_HERE
MONGODB_DATABASE=medisense
SECRET_KEY={secret_key}

# Optional: Configure CORS for production
# ALLOWED_ORIGINS=https://your-frontend-domain.onrender.com
"""

    with open('.env', 'w') as f:
        f.write(env_content)

    print("✅ Created .env file with secure secret key")
    print(f"🔑 Generated SECRET_KEY: {secret_key[:16]}...")
    print("\n📋 Next steps:")
    print("1. Set up MongoDB Atlas and get your connection string")
    print("2. Replace YOUR_MONGODB_ATLAS_CONNECTION_STRING_HERE in .env")
    print("3. Push to GitHub: git add . && git commit -m 'Add Render deployment config' && git push")
    print("4. Connect repository to Render and deploy!")

if __name__ == "__main__":
    setup_env_for_render()