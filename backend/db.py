import sqlite3
from datetime import datetime
from contextlib import contextmanager
import json

@contextmanager
def get_db():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS UserProfile (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            age INTEGER NOT NULL,
            bmi REAL NOT NULL,
            gender TEXT CHECK(gender IN ('male', 'female', 'other')) NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS ChatDetails (
            user_id INTEGER NOT NULL,
            chat_id INTEGER PRIMARY KEY AUTOINCREMENT,
            messages TEXT NOT NULL,
            disease TEXT,
            symptoms TEXT,  -- New column for symptoms
            confidence TEXT, -- Store confidence to avoid recomputation
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES UserProfile (user_id)
        )
        """)
        
        # Check if confidence column exists and add it if not
        cursor.execute("PRAGMA table_info(ChatDetails)")
        columns = [column[1] for column in cursor.fetchall()]
        if "confidence" not in columns:
            print("Adding 'confidence' column to ChatDetails table...")
            try:
                cursor.execute("ALTER TABLE ChatDetails ADD COLUMN confidence TEXT")
                conn.commit()
                print("Added confidence column successfully!")
            except sqlite3.OperationalError as e:
                print(f"Error adding confidence column: {e}")
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS RefreshTokens (
            token_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES UserProfile (user_id)
        )
        """)
        
        conn.commit()

def create_or_update_user(name, email, age, bmi, gender):
    now = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO UserProfile (name, email, age, bmi, gender, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
            name=excluded.name,
            age=excluded.age,
            bmi=excluded.bmi,
            gender=excluded.gender,
            updated_at=excluded.updated_at
        """, (name, email, age, bmi, gender, now, now))
        conn.commit()

def create_chat(user_id, time_str, messages_dict=None, disease: str = None, symptoms: list = None, confidence: str = None):
    with get_db() as conn:
        cursor = conn.cursor()
        # Initialize messages_dict with empty structure if not provided
        if not messages_dict or not isinstance(messages_dict, dict):
            messages_dict = {}
        
        serialized_messages = json.dumps(messages_dict)
        serialized_symptoms = json.dumps(symptoms) if symptoms else None
        
        # Always ensure the confidence column exists
        try:
            # Check if confidence column exists
            cursor.execute("PRAGMA table_info(ChatDetails)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if "confidence" not in columns:
                # Add the confidence column if it doesn't exist
                try:
                    print("Adding missing confidence column to ChatDetails...")
                    cursor.execute("ALTER TABLE ChatDetails ADD COLUMN confidence TEXT")
                    conn.commit()
                    print("Added confidence column successfully!")
                except sqlite3.OperationalError as e:
                    print(f"Error adding confidence column: {e}")
        except Exception as e:
            print(f"Error checking columns: {e}")
        
        # Print debug info
        print(f"Creating chat: user_id={user_id}, disease={disease}, confidence={confidence}")
        
        try:
            # Always use the full schema with all columns
            cursor.execute("""
            INSERT INTO ChatDetails (user_id, messages, disease, symptoms, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, serialized_messages, disease, serialized_symptoms, confidence, time_str))
            
            conn.commit()
            new_id = cursor.lastrowid
            print(f"Created chat with ID: {new_id}")
            return new_id
        except sqlite3.OperationalError as e:
            # If "no such column" error, try without the confidence column
            if "no such column" in str(e):
                print(f"Falling back to schema without confidence: {e}")
                cursor.execute("""
                INSERT INTO ChatDetails (user_id, messages, disease, symptoms, created_at)
                VALUES (?, ?, ?, ?, ?)
                """, (user_id, serialized_messages, disease, serialized_symptoms, time_str))
                conn.commit()
                new_id = cursor.lastrowid
                print(f"Created chat with ID: {new_id} (without confidence)")
                return new_id
            else:
                print(f"Error creating chat: {e}")
                raise
        except Exception as e:
            print(f"Error creating chat: {e}")
            # Re-raise the exception to be handled by the caller
            raise

def update_chat(user_id, chat_id, messages_dict):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Ensure we have a proper dictionary for messages
        if not isinstance(messages_dict, dict):
            print(f"Warning: messages_dict is not a dictionary, got {type(messages_dict)}")
            # Try to convert if it's a Row object
            try:
                messages_dict = dict(messages_dict)
            except (TypeError, ValueError):
                # If conversion fails, create empty dict
                messages_dict = {}
        
        serialized_messages = json.dumps(messages_dict)
        
        try:
            cursor.execute("""
            UPDATE ChatDetails 
            SET messages = ?
            WHERE user_id = ? AND chat_id = ?
            """, (serialized_messages, user_id, chat_id))
            
            conn.commit()
            print(f"Updated chat {chat_id} for user {user_id}")
        except Exception as e:
            print(f"Error updating chat: {e}")
            # Re-raise the exception to be handled by the caller
            raise