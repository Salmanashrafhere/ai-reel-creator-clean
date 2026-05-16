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
    
    # Directory Settings
    UPLOAD_DIR: str = "uploads"
    OUTPUT_DIR: str = "outputs"
    AUDIO_DIR: str = "audio"
    TRANSCRIPT_DIR: str = "transcripts"
    CLIPS_DIR: str = "clips"
    CAPTIONS_DIR: str = "captions"
    
    # Video Processing Settings
    WHISPER_MODEL: str = "base"
    MAX_VIDEO_SIZE_MB: int = int(os.getenv("MAX_VIDEO_SIZE_MB", "500"))
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure directories exist
for directory in [
    settings.UPLOAD_DIR, 
    settings.OUTPUT_DIR, 
    settings.AUDIO_DIR, 
    settings.TRANSCRIPT_DIR, 
    settings.CLIPS_DIR, 
    settings.CAPTIONS_DIR
]:
    os.makedirs(directory, exist_ok=True)
