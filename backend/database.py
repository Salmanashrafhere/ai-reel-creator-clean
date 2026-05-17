from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime
import os

# Move database to project root to avoid Uvicorn reload loops
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
DATABASE_URL = f"sqlite:///{os.path.join(PROJECT_ROOT, 'reels.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    google_id = Column(String, unique=True, index=True)
    avatar = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    reels = relationship("Reel", back_populates="owner")

class Reel(Base):
    __tablename__ = "reels"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    video_url = Column(String)
    thumbnail_url = Column(String)
    title = Column(String)
    reason = Column(Text)
    hook = Column(String)
    style = Column(String)
    caption = Column(Text)
    hashtags = Column(Text) # Stored as JSON string
    viral_score = Column(Integer, default=0)
    score_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="reels")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
