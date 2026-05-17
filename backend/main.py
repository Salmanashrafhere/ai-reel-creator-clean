from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import shutil
import os
import uuid
import json
import subprocess
from typing import List, Optional
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session
from database import init_db, get_db, User as DBUser, Reel as DBReel, SessionLocal
from settings import settings
from utils.video_processor import VideoProcessor

app = FastAPI(title=settings.APP_NAME)

# Initialize Database
init_db()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None
    
    user = db.query(DBUser).filter(DBUser.email == email).first()
    return user

def create_access_token(data: dict):
    to_encode = data.copy()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def check_dependencies():
    """Check if FFmpeg is installed and accessible."""
    try:
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("--- [DEPENDENCY CHECK] FFmpeg found ---")
    except FileNotFoundError:
        print("!!! [DEPENDENCY ERROR] FFmpeg NOT FOUND !!!")
        print("Please ensure FFmpeg is installed and added to your PATH.")
        # In production, we might want to raise an error to stop the container from starting
        # if FFmpeg is a hard requirement.
        # raise RuntimeError("FFmpeg is required but not found.")

# Initialize Video Processor with Gemini API Key
processor = VideoProcessor(model_name=settings.WHISPER_MODEL, gemini_api_key=settings.GEMINI_API_KEY)

# Run dependency check on startup
check_dependencies()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated reels as static files
print(f"Mounting static directories:\n- Outputs: {settings.OUTPUT_DIR}\n- Thumbnails: {settings.THUMBNAIL_DIR}")
app.mount("/outputs", StaticFiles(directory=settings.OUTPUT_DIR), name="outputs")
app.mount("/thumbnails", StaticFiles(directory=settings.THUMBNAIL_DIR), name="thumbnails")

# Simple in-memory job store
jobs = {}

class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: int
    message: Optional[str] = None
    result: Optional[dict] = None

@app.post("/api/v1/auth/google")
async def google_auth(data: dict, db: Session = Depends(get_db)):
    token = data.get("credential")
    if not token:
        raise HTTPException(status_code=400, detail="Missing credential")
    
    try:
        # Verify Google Token
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
        
        email = idinfo['email']
        name = idinfo.get('name')
        picture = idinfo.get('picture')
        google_id = idinfo['sub']
        
        # Check if user exists
        user = db.query(DBUser).filter(DBUser.email == email).first()
        if not user:
            user = DBUser(email=email, name=name, avatar=picture, google_id=google_id)
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Create JWT
        access_token = create_access_token(data={"sub": user.email})
        return {"access_token": access_token, "token_type": "bearer", "user": {
            "email": user.email,
            "name": user.name,
            "avatar": user.avatar
        }}
        
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

@app.get("/api/v1/user/reels")
async def get_user_reels(user: DBUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    reels = db.query(DBReel).filter(DBReel.user_id == user.id).order_by(DBReel.created_at.desc()).all()
    return [{
        "id": r.id,
        "url": r.video_url,
        "thumbnail": r.thumbnail_url,
        "title": r.title,
        "reason": r.reason,
        "hook": r.hook,
        "style": r.style,
        "caption": r.caption,
        "hashtags": json.loads(r.hashtags) if r.hashtags else [],
        "viral_score": r.viral_score,
        "score_reason": r.score_reason
    } for r in reels]

def process_video_task(job_id: str, file_path: str, user_id: Optional[int] = None):
    db = SessionLocal()
    try:
        print(f"\n[JOB {job_id}] Video uploaded: {file_path}")
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["progress"] = 5
        jobs[job_id]["message"] = "Normalizing video format..."
        
        # Step 1: Normalize Video (New)
        # Ensure it's H.264 MP4 for best compatibility
        normalized_path = os.path.join(settings.UPLOAD_DIR, f"norm_{job_id}.mp4")
        processor.normalize_video(file_path, normalized_path)
        # Replace original path with normalized path for subsequent steps
        working_file_path = normalized_path
        jobs[job_id]["progress"] = 15
        
        # Step 2: Extract Audio
        print(f"[JOB {job_id}] Extracting audio...")
        jobs[job_id]["message"] = "Extracting audio from video..."
        audio_path = os.path.join(settings.AUDIO_DIR, f"{job_id}.mp3")
        processor.extract_audio(working_file_path, audio_path)
        jobs[job_id]["progress"] = 30
        
        # Step 3: Whisper Transcript
        print(f"[JOB {job_id}] Running Whisper transcription...")
        jobs[job_id]["message"] = "Transcribing audio with Whisper AI..."
        transcript = processor.transcribe(audio_path)
        
        # Save transcript as JSON
        transcript_filename = f"transcript_{job_id}.json"
        transcript_path = os.path.join(settings.TRANSCRIPT_DIR, transcript_filename)
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(transcript, f, ensure_ascii=False, indent=4)
        
        jobs[job_id]["progress"] = 50
        
        # Step 4: AI Detect Best Moments
        print(f"[JOB {job_id}] Analyzing transcript with AI...")
        jobs[job_id]["message"] = "Analyzing transcript for viral moments with Gemini AI..."
        best_moments = processor.detect_best_moments(transcript)
        
        # Sort moments by viral score (highest first)
        best_moments = sorted(best_moments, key=lambda x: x.get('viral_score', 0), reverse=True)
        
        jobs[job_id]["progress"] = 70
        
        # Step 5 & 6: Cut Clips & Add Captions
        print(f"[JOB {job_id}] Rendering {len(best_moments)} reels...")
        jobs[job_id]["message"] = f"Rendering {len(best_moments)} viral reels..."
        clips = []
        num_moments = len(best_moments)
        if num_moments == 0:
            raise Exception("No viral moments detected.")

        for i, moment in enumerate(best_moments):
            # Update progress based on clip index
            # Progress goes from 70 to 95 during clip processing
            current_clip_progress = 70 + int((i / num_moments) * 25)
            jobs[job_id]["progress"] = current_clip_progress
            jobs[job_id]["message"] = f"Rendering reel {i+1} of {num_moments}: {moment['title']}"
            
            print(f"[JOB {job_id}] Processing clip {i+1}/{num_moments}: {moment['title']}")
            
            output_filename = f"reel_{job_id}_{i}.mp4"
            final_output_path = os.path.join(settings.OUTPUT_DIR, output_filename)
            
            # Step 5: Cut and Process Reel
            jobs[job_id]["message"] = f"Cutting and applying styles to reel {i+1}..."
            
            # Unified Processing (Step 5 & 6)
            print(f"[JOB {job_id}] Processing unified reel {i+1} (style: {moment.get('style', 'minimal')})...")
            final_path = processor.process_reel(
                working_file_path,
                moment['start'],
                moment['end'],
                transcript['segments'],
                final_output_path,
                style_type=moment.get('style', 'minimal'),
                hook=moment.get('hook')
            )
            
            # Step 7: Generate Thumbnail
            jobs[job_id]["message"] = f"Generating thumbnail for reel {i+1}..."
            
            actual_output_filename = output_filename
            
            # Step 7: Generate Thumbnail (New)
            print(f"[JOB {job_id}] Generating thumbnail for clip {i+1}...")
            thumb_filename = f"thumb_{job_id}_{i}.jpg"
            thumb_path = os.path.join(settings.THUMBNAIL_DIR, thumb_filename)
            processor.generate_thumbnail(
                final_output_path, 
                thumb_path, 
                text=moment.get('hook', 'VIRAL MOMENT').upper(),
                style_type=moment.get('style', 'hype')
            )
            
            clip_data = {
                "url": f"/outputs/{actual_output_filename}",
                "thumbnail": f"/thumbnails/{thumb_filename}",
                "title": moment['title'],
                "reason": moment['reason'],
                "style": moment.get('style', 'minimal'),
                "hook": moment.get('hook', ''),
                "caption": moment.get('caption', ''),
                "hashtags": moment.get('hashtags', []),
                "viral_score": moment.get('viral_score', 0),
                "score_reason": moment.get('score_reason', '')
            }
            clips.append(clip_data)

            # Save to database if user is logged in
            if user_id:
                db_reel = DBReel(
                    id=f"{job_id}_{i}",
                    user_id=user_id,
                    video_url=clip_data["url"],
                    thumbnail_url=clip_data["thumbnail"],
                    title=clip_data["title"],
                    reason=clip_data["reason"],
                    hook=clip_data["hook"],
                    style=clip_data["style"],
                    caption=clip_data["caption"],
                    hashtags=json.dumps(clip_data["hashtags"]),
                    viral_score=clip_data["viral_score"],
                    score_reason=clip_data["score_reason"]
                )
                db.add(db_reel)
                db.commit()
        
        jobs[job_id]["progress"] = 100
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["message"] = "Export complete! Your reels are ready."
        jobs[job_id]["result"] = {"clips": clips}
        
    except Exception as e:
        print(f"Error processing job {job_id}: {str(e)}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["result"] = {"error": str(e)}
    finally:
        db.close()

@app.post("/api/v1/process")
async def process_video(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    user: Optional[DBUser] = Depends(get_current_user)
):
    # 1. Check file format
    allowed_extensions = ('.mp4', '.mov', '.avi', '.mkv', '.hevc')
    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # 2. Check file size (100MB limit)
    MAX_SIZE = 100 * 1024 * 1024 # 100MB
    # We need to read a bit to check size or use content-length header
    # But since it's SpooledTemporaryFile, we can check its size
    file.file.seek(0, 2) # Go to end
    file_size = file.file.tell()
    file.file.seek(0) # Back to start
    
    if file_size > MAX_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large ({file_size / (1024*1024):.1f}MB). Maximum allowed is 100MB."
        )

    job_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{job_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    jobs[job_id] = {"status": "queued", "progress": 0, "message": "Video uploaded, waiting in queue..."}
    user_id = user.id if user else None
    background_tasks.add_task(process_video_task, job_id, file_path, user_id)
    
    return {"job_id": job_id, "status": "queued"}

@app.get("/api/v1/job/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return {**jobs[job_id], "job_id": job_id}

@app.delete("/api/v1/reel/{filename}")
async def delete_reel(filename: str):
    file_path = os.path.join(settings.OUTPUT_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": "Reel deleted successfully"}
    raise HTTPException(status_code=404, detail="Reel not found")

@app.delete("/api/v1/user/reels")
async def delete_all_reels(user: DBUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Delete from database
    reels = db.query(DBReel).filter(DBReel.user_id == user.id).all()
    for reel in reels:
        # Extract filename from URL (e.g., /outputs/reel_xxx.mp4)
        filename = reel.video_url.split("/")[-1]
        file_path = os.path.join(settings.OUTPUT_DIR, filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        
        # Also delete thumbnail
        if reel.thumbnail_url:
            thumb_filename = reel.thumbnail_url.split("/")[-1]
            thumb_path = os.path.join(settings.THUMBNAIL_DIR, thumb_filename)
            if os.path.exists(thumb_path):
                try:
                    os.remove(thumb_path)
                except:
                    pass

    db.query(DBReel).filter(DBReel.user_id == user.id).delete()
    db.commit()
    
    return {"message": "All reels cleared"}

@app.get("/")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    # We use a string for the app to allow reload to work correctly
    # And we specify the host and port
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
