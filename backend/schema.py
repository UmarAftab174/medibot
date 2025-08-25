from typing import List, Optional, Literal
from pydantic import BaseModel, Field, EmailStr, validator
from datetime import datetime

class SymptomsRequest(BaseModel):
    symptoms: List[str] = Field(..., description="List of selected symptoms", min_items=1)
    
    @validator('symptoms')
    def symptoms_must_not_be_empty(cls, v):
        if not v:
            raise ValueError('At least one symptom must be provided')
        return v

class PredictionResponse(BaseModel):
    disease: str = Field(..., description="Predicted disease name")
    confidence: str = Field(..., description="Confidence score as percentage")
    symptoms_count: int = Field(..., description="Number of symptoms provided")
    chat_id: int = Field(..., description="Chat ID for associated conversation")

class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")

class SymptomsResponse(BaseModel):
    symptoms: List[str] = Field(..., description="List of filtered symptoms")

class UserSignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="User's full name")
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=6, description="User's password")
    age: int = Field(..., ge=1, le=120, description="User's age")
    bmi: float = Field(..., ge=10.0, le=50.0, description="User's BMI")
    gender: Literal["male", "female", "other"] = Field(..., description="User's gender")

class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Refresh token")

class UserProfile(BaseModel):
    user_id: int = Field(..., description='User ID')
    name: str = Field(..., description="User's name")
    email: EmailStr = Field(..., description="User's email")
    age: int = Field(..., description="User's age")
    bmi: float = Field(..., description="User's BMI")
    gender: Literal["male", "female", "other"] = Field(..., description="User's gender")
    created_at: Optional[datetime] = Field(None, description="Account creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

class AuthSuccessResponse(BaseModel):
    message: str = Field(..., description="Success message")
    user: UserProfile = Field(..., description="User profile information")
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")

class TokenRefreshResponse(BaseModel):
    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")

class UserProfileResponse(BaseModel):
    user: UserProfile = Field(..., description="User profile information")

class UserProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100, description="Updated name")
    age: Optional[int] = Field(None, ge=1, le=120, description="Updated age")
    bmi: Optional[float] = Field(None, ge=10.0, le=50.0, description="Updated BMI")
    gender: Optional[Literal["male", "female", "other"]] = Field(None, description="Updated gender")
    new_password: Optional[str] = Field(None, min_length=6, description="New password")

class UserProfileUpdateResponse(BaseModel):
    message: str = Field(..., description="Success message")
    user: UserProfile = Field(..., description="Updated user profile")

class UserPrompt(BaseModel):
    chat_id: int = Field(..., description="Chat ID")
    query: str = Field(..., description="User query")
    sent_at: datetime = Field(..., description="Query timestamp")
    disease: Optional[str] = Field(None, description="Associated disease for new chats")

class LLMReponse(BaseModel):
    chat_id: int = Field(..., description="Chat ID")
    response: str = Field(..., description="LLM response")
    response_at: datetime = Field(..., description="Response timestamp")

class ChatDetails(BaseModel):
    user_id: int = Field(..., description="User ID")
    chat_id: int = Field(..., description="Chat ID")
    messages: dict = Field(..., description="Chat messages")
    disease: Optional[str] = Field(None, description="Associated disease")
    created_at: datetime = Field(..., description="Chat creation timestamp")
    confidence: Optional[str] = Field(None, description="Confidence percentage")

class PaginationInfo(BaseModel):
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    total: int = Field(..., description="Total number of items")
    pages: int = Field(..., description="Total number of pages")

class ChatHistory(BaseModel):
    chats: List[ChatDetails] = Field(default=[], description="User chats")
    pagination: Optional[PaginationInfo] = Field(None, description="Pagination information")

class Explainability(BaseModel):
    explanation: str = Field(..., description="Easy English paragraph")

class Curability(BaseModel):
    answer: str = Field(..., description="Yes or No")
    details: str = Field(..., description="Short paragraph if Yes")

class Treatment(BaseModel):
    prescription: List[str] = Field(..., description="Bullet point prescription")
    health_tips: List[str] = Field(..., description="5 bullet point health tips")

class VisitDocResponse(BaseModel):
    doctor_visit: str = Field(..., description="Small easy English paragraph")