import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import List

# Load .env file
load_dotenv()

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = os.getenv("APP_NAME", "AI Reel Creator")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    
    # Directory Settings
    # Use absolute paths or paths relative to the project root
    # We move these to the project root (one level up from backend) 
    # to avoid Uvicorn reload loops when files are generated.
    BACKEND_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    BASE_DIR: str = os.path.dirname(BACKEND_DIR)
    
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    OUTPUT_DIR: str = os.path.join(BASE_DIR, "outputs")
    AUDIO_DIR: str = os.path.join(BASE_DIR, "audio")
    TRANSCRIPT_DIR: str = os.path.join(BASE_DIR, "transcripts")
    CLIPS_DIR: str = os.path.join(BASE_DIR, "clips")
    CAPTIONS_DIR: str = os.path.join(BASE_DIR, "captions")
    THUMBNAIL_DIR: str = os.path.join(BASE_DIR, "thumbnails")
    
    # Video Processing Settings
    WHISPER_MODEL: str = "base"
    MAX_VIDEO_SIZE_MB: int = int(os.getenv("MAX_VIDEO_SIZE_MB", "500"))
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = ["*"]

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()

# Ensure directories exist
for directory in [
    settings.UPLOAD_DIR, 
    settings.OUTPUT_DIR, 
    settings.AUDIO_DIR, 
    settings.TRANSCRIPT_DIR, 
    settings.CLIPS_DIR, 
    settings.CAPTIONS_DIR,
    settings.THUMBNAIL_DIR
]:
    os.makedirs(directory, exist_ok=True)
