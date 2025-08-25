from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import uvicorn
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from backend.chat import chat_history, get_query
from backend.schema import *
from backend.db import *
from utils import *
from datetime import timedelta, datetime
from typing import Optional
from pathlib import Path
import json
import numpy as np

app = FastAPI(
    title="Disease Prediction API",
    description="API for predicting diseases based on symptoms using machine learning",
    version="1.0.0"
)
security = HTTPBearer()
BASE_DIR = Path(__file__).resolve().parent

def migrate_db():
    """Run database migrations to ensure schema is up-to-date"""
    print("Running database migrations...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check for confidence column in ChatDetails and add if missing
        cursor.execute("PRAGMA table_info(ChatDetails)")
        columns = [column[1] for column in cursor.fetchall()]
        if "confidence" not in columns:
            print("Adding 'confidence' column to ChatDetails table...")
            try:
                cursor.execute("ALTER TABLE ChatDetails ADD COLUMN confidence TEXT")
                conn.commit()
                print("Added confidence column successfully!")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print("Confidence column already exists")
                else:
                    print(f"Error adding confidence column: {e}")

# Initialize and migrate database
init_db()
migrate_db()

@app.post("/auth/signup", response_model=AuthSuccessResponse)
async def signup(request: UserSignupRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT user_id FROM UserProfile WHERE email = ?", (request.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        now = datetime.now().isoformat()
        password_hash = hash_password(request.password)
        
        cursor.execute("""
        INSERT INTO UserProfile (name, email, password_hash, age, bmi, gender, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (request.name, request.email, password_hash, request.age, request.bmi, 
              request.gender, now, now))
        
        user_id = cursor.lastrowid
        
        access_token = create_access_token({"sub": str(user_id)})
        refresh_token = create_refresh_token()
        
        refresh_expire = datetime.now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        cursor.execute("""
        INSERT INTO RefreshTokens (user_id, token, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        """, (user_id, refresh_token, refresh_expire.isoformat(), now))
        
        conn.commit()
        
        cursor.execute("SELECT * FROM UserProfile WHERE user_id = ?", (user_id,))
        user_row = dict(cursor.fetchone())
        
        user_profile = UserProfile(
            user_id=user_row["user_id"],
            name=user_row["name"],
            email=user_row["email"],
            age=user_row["age"],
            bmi=user_row["bmi"],
            gender=user_row["gender"],
            created_at=datetime.fromisoformat(user_row["created_at"]),
            updated_at=datetime.fromisoformat(user_row["updated_at"])
        )
        
        return AuthSuccessResponse(
            message="User created successfully",
            user=user_profile,
            access_token=access_token,
            refresh_token=refresh_token
        )

@app.post("/auth/login", response_model=AuthSuccessResponse)
async def login(request: UserLoginRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM UserProfile WHERE email = ?", (request.email,))
        user_row = cursor.fetchone()
        
        if not user_row or not verify_password(request.password, user_row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        user_dict = dict(user_row)
        user_id = user_dict["user_id"]
        
        access_token = create_access_token({"sub": str(user_id)})
        refresh_token = create_refresh_token()
        
        now = datetime.now().isoformat()
        refresh_expire = datetime.now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        cursor.execute("""
        INSERT INTO RefreshTokens (user_id, token, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        """, (user_id, refresh_token, refresh_expire.isoformat(), now))
        
        conn.commit()
        
        user_profile = UserProfile(
            user_id=user_dict["user_id"],
            name=user_dict["name"],
            email=user_dict["email"],
            age=user_dict["age"],
            bmi=user_dict["bmi"],
            gender=user_dict["gender"],
            created_at=datetime.fromisoformat(user_dict["created_at"]),
            updated_at=datetime.fromisoformat(user_dict["updated_at"])
        )
        
        return AuthSuccessResponse(
            message="Login successful",
            user=user_profile,
            access_token=access_token,
            refresh_token=refresh_token
        )

@app.post("/auth/refresh", response_model=TokenRefreshResponse)
async def refresh_token(request: RefreshTokenRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT user_id, expires_at FROM RefreshTokens 
        WHERE token = ? AND expires_at > ?
        """, (request.refresh_token, datetime.now().isoformat()))
        
        token_row = cursor.fetchone()
        if not token_row:
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        
        user_id = token_row["user_id"]
        access_token = create_access_token({"sub": str(user_id)})
        
        return TokenRefreshResponse(access_token=access_token)

@app.post("/auth/logout")
async def logout(request: RefreshTokenRequest, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM RefreshTokens WHERE token = ?", (request.refresh_token,))
        conn.commit()

    return {"message": "Logged out successfully"}

@app.get("/profile", response_model=UserProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    user_profile = UserProfile(
        user_id=current_user["user_id"],
        name=current_user["name"],
        email=current_user["email"],
        age=current_user["age"],
        bmi=current_user["bmi"],
        gender=current_user["gender"],
        created_at=datetime.fromisoformat(current_user["created_at"]),
        updated_at=datetime.fromisoformat(current_user["updated_at"])
    )
    return UserProfileResponse(user=user_profile)

@app.put("/profile", response_model=UserProfileUpdateResponse)
async def update_profile(request: UserProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        user_id = current_user["user_id"]
        
        update_fields = []
        values = []
        
        if request.name is not None:
            update_fields.append("name = ?")
            values.append(request.name)
        
        if request.age is not None:
            update_fields.append("age = ?")
            values.append(request.age)
            
        if request.bmi is not None:
            update_fields.append("bmi = ?")
            values.append(request.bmi)
            
        if request.gender is not None:
            update_fields.append("gender = ?")
            values.append(request.gender)
            
        if request.new_password is not None:
            update_fields.append("password_hash = ?")
            values.append(hash_password(request.new_password))
        
        if update_fields:
            now = datetime.now().isoformat()
            update_fields.append("updated_at = ?")
            values.append(now)
            values.append(user_id)
            
            query = f"UPDATE UserProfile SET {', '.join(update_fields)} WHERE user_id = ?"
            cursor.execute(query, values)
            conn.commit()
        
        cursor.execute("SELECT * FROM UserProfile WHERE user_id = ?", (user_id,))
        updated_user = dict(cursor.fetchone())
        
        user_profile = UserProfile(
            user_id=updated_user["user_id"],
            name=updated_user["name"],
            email=updated_user["email"],
            age=updated_user["age"],
            bmi=updated_user["bmi"],
            gender=updated_user["gender"],
            created_at=datetime.fromisoformat(updated_user["created_at"]),
            updated_at=datetime.fromisoformat(updated_user["updated_at"])
        )
        
        return UserProfileUpdateResponse(
            message="Profile updated successfully",
            user=user_profile
        )

@app.get("/get_symptoms", response_model=SymptomsResponse)
async def get_symptoms(query: str = Query("", description="Search query to filter symptoms")):
    try:
        query_lower = query.lower()
        filtered_symptoms = [
            symptom for symptom in SYMPTOMS 
            if query_lower in symptom.lower()
        ]
        return SymptomsResponse(symptoms=filtered_symptoms[:10])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error filtering symptoms: {str(e)}")

@app.post("/predict", response_model=PredictionResponse, responses={
    400: {"model": ErrorResponse, "description": "Bad Request"},
    500: {"model": ErrorResponse, "description": "Internal Server Error"}
})
async def predict(symptoms_request: SymptomsRequest, current_user: dict = Depends(get_current_user)):
    try:
        selected_symptoms = symptoms_request.symptoms
        
        # Validate symptoms
        invalid_symptoms = [s for s in selected_symptoms if s not in SYMPTOMS]
        if invalid_symptoms:
            raise HTTPException(status_code=400, detail=f"Invalid symptoms: {invalid_symptoms}")
        
        symptom_vector = create_input_vector(selected_symptoms)
        symptom_array = symptom_vector.values
        
        prediction = PREDICTION_MODEL.predict(symptom_array)
        predicted_class = np.argmax(prediction[0])
        probability = float(prediction[0].max())  # Ensure it's a Python float

        actual_disease = disease_mapping.loc[
            disease_mapping['Encoded'] == predicted_class
        ]['Disease'].iloc[0]
        
        # Make sure probability is not zero or negative
        probability = max(0.001, probability)  # Minimum 0.1% confidence to avoid zero
        
        # Format confidence for consistent display (always use percentage format)
        confidence_str = f"{probability:.2%}"
        
        # Log for debugging
        print(f"Prediction confidence: raw={probability}, formatted={confidence_str}")
        
        # Store symptoms, disease and confidence in ChatDetails
        now = datetime.now().isoformat()
        user_id = current_user["user_id"]
        messages_dict = {}
        chat_id = create_chat(user_id, now, messages_dict, actual_disease, selected_symptoms, confidence_str)
        
        return PredictionResponse(
            disease=actual_disease,
            confidence=confidence_str,
            symptoms_count=len(selected_symptoms),
            chat_id=chat_id
        )
        
    except IndexError:
        raise HTTPException(
            status_code=500, 
            detail="Prediction failed: Disease mapping not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Prediction failed: {str(e)}"
        )

@app.post("/chat-message", response_model=LLMReponse)
async def conversation(user_query: UserPrompt, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    
    try:
        # Load existing chat history and symptoms from DB
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT messages, disease, symptoms FROM ChatDetails WHERE chat_id = ? AND user_id = ?", 
                        (user_query.chat_id, user_id))
            chat_row = cursor.fetchone()
            
            if not chat_row:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            disease = chat_row["disease"]
            selected_symptoms = json.loads(chat_row["symptoms"]) if chat_row["symptoms"] else []
            
            # Parse stored messages, handling potential JSON errors
            try:
                stored_history = json.loads(chat_row["messages"])
                if not isinstance(stored_history, dict):
                    stored_history = {}  # Reset if not a dictionary
            except (json.JSONDecodeError, TypeError):
                stored_history = {}  # Initialize empty if JSON is invalid
            
            # Create system prompt for the AI
            system_prompt = f"""
            You are Medibot, a highly knowledgeable and reliable medical expert assistant. 
            The user is concerned about the following disease: {disease}.
            The user has reported the following symptoms: {selected_symptoms}.

            Your role is to:
            - Explain the disease and its symptoms in simple, empathetic language.
            - Provide medically accurate, evidence-based, and easy-to-understand information.
            - Suggest possible causes, risk factors, and lifestyle recommendations.
            - Offer guidance on general treatment approaches and health tips.
            - Highlight red flags that require urgent medical consultation.
            - Always remind the user that this information is for educational purposes only and 
            does not substitute professional medical advice.

            Be clear, supportive, and professional in all responses.
            """
            
            # Build conversation history (system message will be injected by the prompt template)
            conversation = []
            
            # Sort message keys numerically (message1, message2, etc.)
            sorted_keys = sorted(stored_history.keys(), 
                                key=lambda k: int(k.replace('message', '')) if k.replace('message', '').isdigit() else 0)
            
            for msg_key in sorted_keys:
                msg = stored_history[msg_key]
                if msg.get('query'):
                    conversation.append(HumanMessage(content=msg['query']))
                if msg.get('response'):
                    conversation.append(AIMessage(content=msg['response']))

            # Add the new user query and get AI response (get_query manages message appends internally)
            response, response_at = get_query(CHAT_MODEL, user_query.query, system_prompt, conversation, disease)
        
        # Determine next message number
        next_msg_num = 1
        if stored_history:
            # Extract numbers from keys like "message1", "message2"
            msg_numbers = [int(k.replace('message', '')) for k in stored_history.keys() 
                          if k.replace('message', '').isdigit()]
            next_msg_num = max(msg_numbers) + 1 if msg_numbers else 1
        
        # Add new message to history
        new_message_key = f'message{next_msg_num}'
        stored_history[new_message_key] = {'query': user_query.query, 'response': response}
        
        # Save updated chat history to database
        serialized_history = json.dumps(stored_history)
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE ChatDetails 
                SET messages = ?
                WHERE chat_id = ? AND user_id = ?
            """, (serialized_history, user_query.chat_id, user_id))
            conn.commit()
        
        return LLMReponse(
            chat_id=user_query.chat_id,
            response=response,
            response_at=response_at
        )
    
    except Exception as e:
        # Log the error for debugging
        print(f"Error in conversation endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

@app.get("/chat-history", response_model=ChatHistory)
async def chat_hist(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, description="Page number", ge=1),
    per_page: int = Query(20, description="Items per page", ge=5, le=100),
    include_messages: bool = Query(False, description="Include full message history"),
    recompute_confidence: bool = Query(False, description="Force recompute confidence scores")
):
    user_id = current_user["user_id"]
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get total count for pagination
            cursor.execute("SELECT COUNT(*) FROM ChatDetails WHERE user_id = ?", (user_id,))
            total_count = cursor.fetchone()[0]
            
            # Calculate offset and limit
            offset = (page - 1) * per_page
            
            # Get chat history with pagination
            cursor.execute(
                "SELECT * FROM ChatDetails WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", 
                (user_id, per_page, offset)
            )
            chat_data = cursor.fetchall()
            if not chat_data:
                return ChatHistory(chats=[])

            chats = []
            for c in chat_data:
                # Always parse messages
                try:
                    messages_dict = json.loads(c["messages"])
                    if not isinstance(messages_dict, dict):
                        messages_dict = {}  # Reset if not a dictionary
                except (json.JSONDecodeError, TypeError):
                    messages_dict = {}  # Initialize empty if JSON is invalid
                
                # Always extract a preview for the chat list
                preview = None
                try:
                    if c["messages"]:
                        # Quick parse just for preview without loading full message structure
                        msg_data = json.loads(c["messages"]) if c["messages"] else {}
                        if isinstance(msg_data, dict) and msg_data:
                            # Find the first message key
                            keys = [k for k in msg_data.keys() if k.startswith('message')]
                            if keys:
                                try:
                                    # Simple numeric sort without regex for performance
                                    keys.sort(key=lambda k: int(k[7:]) if k[7:].isdigit() else 0)
                                    if keys:
                                        first_key = keys[0]
                                        first_msg = msg_data.get(first_key, {})
                                        if isinstance(first_msg, dict) and first_msg.get('query'):
                                            preview = first_msg['query'][:50] + ('...' if len(first_msg['query']) > 50 else '')
                                except (ValueError, IndexError):
                                    # Handle any sorting errors
                                    pass
                except Exception:
                    # If preview extraction fails, continue without it
                    pass
                
                # Extract disease information
                disease = c["disease"]
                # Use stored confidence or compute if needed
                confidence_value: Optional[str] = None
                try:
                    # First check if we have a stored confidence value
                    # Convert sqlite3.Row to dict to properly check for existence of the column
                    row_dict = dict(c)
                    
                    # Check if confidence column exists in the table
                    cursor.execute("PRAGMA table_info(ChatDetails)")
                    columns = [column[1] for column in cursor.fetchall()]
                    has_confidence_column = "confidence" in columns
                    
                    # Check if we have a valid stored confidence value
                    has_valid_confidence = (
                        has_confidence_column and
                        "confidence" in row_dict and 
                        row_dict["confidence"] is not None and 
                        row_dict["confidence"] not in ("", "0%", "0.00%")
                    )
                    
                    if has_valid_confidence:
                        # Use stored confidence
                        confidence_value = row_dict["confidence"]
                        # Don't print to avoid console spam
                        # print(f"Using stored confidence for chat {row_dict['chat_id']}: {confidence_value}")
                    # Only compute if we have symptoms and either recompute is requested or we don't have valid confidence
                    elif "symptoms" in row_dict and row_dict["symptoms"] not in (None, ""):
                        # Parse symptoms JSON, with fallback to empty list
                        try:
                            stored_symptoms = json.loads(c["symptoms"])
                            if not isinstance(stored_symptoms, list):
                                stored_symptoms = []
                        except (json.JSONDecodeError, TypeError):
                            stored_symptoms = []
                            
                        if stored_symptoms:
                            # Only compute if:
                            # 1. recompute_confidence flag is True, OR
                            # 2. we have no confidence value, OR
                            # 3. the confidence column doesn't exist in the table
                            should_compute = recompute_confidence or confidence_value is None or not has_confidence_column
                            
                            # Limit calculations if we're doing them for many chats
                            # If more than 5 chats need computation and this isn't a forced recompute,
                            # only compute for the 5 most recent chats
                            if should_compute and not recompute_confidence and not has_confidence_column:
                                # Count how many chats we've computed for in this request
                                compute_count = getattr(conn, '_compute_count', 0)
                                if compute_count > 5:
                                    # Skip computation for older chats
                                    should_compute = False
                                    confidence_value = "0.10%"  # Use placeholder
                                else:
                                    # Increment the counter
                                    setattr(conn, '_compute_count', compute_count + 1)
                            
                            if should_compute:
                                # Compute confidence
                                pred_vec = create_input_vector(stored_symptoms)
                                pred_arr = pred_vec.values
                                pred = PREDICTION_MODEL.predict(pred_arr, verbose=0)
                                prob = float(np.max(pred[0]))
                                # Make sure probability is not zero or negative
                                prob = max(0.001, prob)  # Minimum 0.1% confidence
                                confidence_value = f"{prob:.2%}"
                                print(f"Computed new confidence for chat {row_dict['chat_id']}: {confidence_value}")
                                
                                # Store the computed confidence to avoid recomputing it every time
                                try:
                                    # First ensure the confidence column exists
                                    try:
                                        cursor.execute("PRAGMA table_info(ChatDetails)")
                                        columns = [column[1] for column in cursor.fetchall()]
                                        
                                        # If confidence column doesn't exist, add it
                                        if "confidence" not in columns:
                                            print(f"Adding missing confidence column for chat {row_dict['chat_id']}...")
                                            cursor.execute("ALTER TABLE ChatDetails ADD COLUMN confidence TEXT")
                                            conn.commit()
                                            print("Added confidence column successfully!")
                                    except sqlite3.OperationalError as e:
                                        if "duplicate column name" in str(e):
                                            # Column already exists, this is fine
                                            pass
                                        else:
                                            print(f"Error checking/adding confidence column: {e}")
                                    
                                    # Now update with the confidence value
                                    cursor.execute("""
                                        UPDATE ChatDetails SET confidence = ? WHERE chat_id = ?
                                    """, (confidence_value, row_dict["chat_id"]))
                                    conn.commit()
                                except sqlite3.Error as db_error:
                                    # Log DB errors but continue, we already have the confidence value computed
                                    print(f"DB error when updating confidence: {db_error}")
                except Exception as e:
                    # Get the chat_id safely
                    chat_id = dict(c).get("chat_id", "unknown")
                    print(f"Error computing confidence for chat {chat_id}: {e}")
                    # If anything goes wrong, set a default confidence value rather than None
                    confidence_value = "0.10%"
                
                # Convert sqlite3.Row to dict for safe access
                c_dict = dict(c)
                chats.append(ChatDetails(
                    chat_id=c_dict["chat_id"],
                    user_id=user_id,
                    created_at=datetime.fromisoformat(c_dict["created_at"]),
                    messages=messages_dict,
                    disease=c_dict["disease"],
                    confidence=confidence_value  # Add confidence field
                ))
            
            # Calculate pagination info
            total_pages = (total_count + per_page - 1) // per_page  # Ceiling division
            pagination_info = PaginationInfo(
                page=page,
                per_page=per_page,
                total=total_count,
                pages=total_pages
            )
            
            return ChatHistory(chats=chats, pagination=pagination_info)
    except Exception as e:
        # Log the error for debugging
        print(f"Error retrieving chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chat history: {str(e)}")

@app.post("/update-confidence")
async def update_confidence(chat_id: int = Query(..., description="Chat ID to update"), 
                           current_user: dict = Depends(get_current_user)):
    """Update the confidence score for a specific chat"""
    user_id = current_user["user_id"]
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get the chat details
            cursor.execute(
                "SELECT * FROM ChatDetails WHERE user_id = ? AND chat_id = ?", 
                (user_id, chat_id)
            )
            chat_data = cursor.fetchone()
            
            if not chat_data:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            # Convert to dict
            chat_dict = dict(chat_data)
            
            # Check if symptoms exist
            if not chat_dict.get("symptoms"):
                raise HTTPException(status_code=400, detail="No symptoms found for this chat")
                
            # Parse symptoms
            try:
                stored_symptoms = json.loads(chat_dict["symptoms"])
                if not isinstance(stored_symptoms, list) or not stored_symptoms:
                    raise HTTPException(status_code=400, detail="Invalid symptoms data")
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Failed to parse symptoms data")
                
            # Compute confidence
            pred_vec = create_input_vector(stored_symptoms)
            pred_arr = pred_vec.values
            pred = PREDICTION_MODEL.predict(pred_arr, verbose=0)
            prob = float(np.max(pred[0]))
            prob = max(0.001, prob)  # Minimum 0.1% confidence
            confidence_value = f"{prob:.2%}"
            
            # First ensure the confidence column exists
            try:
                cursor.execute("PRAGMA table_info(ChatDetails)")
                columns = [column[1] for column in cursor.fetchall()]
                
                # If confidence column doesn't exist, add it
                if "confidence" not in columns:
                    print(f"Adding missing confidence column...")
                    cursor.execute("ALTER TABLE ChatDetails ADD COLUMN confidence TEXT")
                    conn.commit()
                    print("Added confidence column successfully!")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e):
                    raise HTTPException(status_code=500, detail=f"Error managing database schema: {str(e)}")
            
            # Now update the database
            cursor.execute(
                "UPDATE ChatDetails SET confidence = ? WHERE chat_id = ?",
                (confidence_value, chat_id)
            )
            conn.commit()
            
            return {"chat_id": chat_id, "confidence": confidence_value, "message": "Confidence updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update confidence: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model": MODEL_PATH, "symptoms_loaded": len(SYMPTOMS)}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)