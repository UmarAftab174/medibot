from tensorflow.keras.models import load_model
from langchain_google_genai import ChatGoogleGenerativeAI
import jwt
import secrets
import pandas as pd
from typing import List
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi import Depends, HTTPException
from datetime import datetime, timedelta
from backend.db import *
from pathlib import Path
import bcrypt
import os
from dotenv import load_dotenv

security = HTTPBearer()
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-fallback-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

CHAT_MODEL = ChatGoogleGenerativeAI(model='gemini-2.0-flash')

try:
    BASE_DIR = Path(__file__).resolve().parent
    SYMPTOMS_PATH = BASE_DIR / "dataset" / "symptoms.csv"
    MODEL_PATH = BASE_DIR / "models" / "cnn_model.h5"
    DISEASE_PATH = BASE_DIR / "dataset" / "disease_mapping.csv"

    SYMPTOMS = pd.read_csv(SYMPTOMS_PATH, names=['symptom'])
    SYMPTOMS = SYMPTOMS['symptom'].tolist()
    PREDICTION_MODEL = load_model(MODEL_PATH)
    disease_mapping = pd.read_csv(DISEASE_PATH)
    print(f"Loaded {len(SYMPTOMS)} symptoms and model successfully")
except FileNotFoundError as e:
    print(f"Error loading files: {e}")
    print("Make sure symptoms.csv, cnn_model.h5, and disease_mapping.csv are in the same directory")

def create_input_vector(selected_symptoms: List[str]) -> pd.DataFrame:
    """Create input vector for the ML model from selected symptoms."""
    df = pd.DataFrame(columns=SYMPTOMS)
    df.loc[0] = 0
    for symp in selected_symptoms:
        if symp in df.columns:
            df[symp] = 1
    return df

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token() -> str:
    return secrets.token_urlsafe(32)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    user_id = verify_token(token)
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM UserProfile WHERE user_id = ?", (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        
        return dict(user_row)