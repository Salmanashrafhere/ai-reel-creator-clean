import os
import json
import subprocess
from utils.ai_analyzer import GeminiAnalyzer

class VideoProcessor:
    def __init__(self, model_name="base", gemini_api_key=None):
        self.device = None
        # Load whisper model once
        self._model = None
        self.model_name = model_name
        self.gemini_api_key = gemini_api_key
        self.analyzer = GeminiAnalyzer(gemini_api_key) if gemini_api_key else None

    @property
    def model(self):
        """Lazy load the Whisper local model."""
        if self._model is None:
            import torch
            import whisper
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"Loading local Whisper model '{self.model_name}' on {self.device}...")
            # This downloads the model to ~/.cache/whisper and loads it locally
            self._model = whisper.load_model(self.model_name, device=self.device)
        return self._model

    def extract_audio(self, video_path, audio_path):
        """Step 2: Extract Audio from Video using FFmpeg."""
        print(f"Extracting audio from {video_path} using FFmpeg...")
        try:
            # -y: overwrite output files
            # -i: input file
            # -vn: disable video recording
            # -acodec libmp3lame: set mp3 codec
            # -q:a 2: set audio quality (2 is high quality)
            command = [
                'ffmpeg', '-y', 
                '-i', video_path, 
                '-vn', 
                '-acodec', 'libmp3lame', 
                '-q:a', '2', 
                audio_path
            ]
            
            # Execute FFmpeg command
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            print(f"Successfully extracted audio to {audio_path}")
            return audio_path
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode()
            print(f"FFmpeg error: {error_msg}")
            raise Exception(f"Failed to extract audio using FFmpeg: {error_msg}")
        except FileNotFoundError:
            raise Exception("FFmpeg not found. Please ensure it is installed and in your PATH.")

    def normalize_video(self, input_path, output_path):
        """
        Normalize uploaded video to H.264/AAC MP4.
        Ensures compatibility with mobile formats like HEVC/MOV.
        """
        print(f"Normalizing video {input_path} to {output_path}...")
        try:
            command = [
                'ffmpeg', '-y',
                '-i', input_path,
                '-c:v', 'libx264',    # H.264 video codec
                '-preset', 'ultrafast', # Fast encoding
                '-crf', '23',          # Good quality balance
                '-c:a', 'aac',         # AAC audio codec
                '-b:a', '128k',        # Standard audio bitrate
                '-movflags', '+faststart', # Web optimization
                output_path
            ]
            
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            print(f"Successfully normalized video to {output_path}")
            return output_path
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode()
            print(f"Normalization failed: {error_msg}")
            raise Exception(f"Video format conversion failed: {error_msg}")
        except FileNotFoundError:
            raise Exception("FFmpeg not found. Cannot normalize video.")

    def transcribe(self, media_path):
        """Step 3: Whisper Transcript."""
        print(f"Transcribing {media_path}...")
        result = self.model.transcribe(media_path, verbose=False)
        return result  # Contains 'text' and 'segments'

    def detect_best_moments(self, transcript_data):
        """
        Step 4: AI Detect Best Moments.
        Uses Gemini API if available, otherwise falls back to keyword heuristic.
        """
        segments = transcript_data.get('segments', [])
        if not segments:
            return []

        if self.analyzer:
            print("Using Gemini API for viral moment detection...")
            moments = self.analyzer.analyze_transcript(segments)
            if moments:
                return moments
            print("Gemini analysis failed or returned no moments, falling back to heuristic...")

        print("Analyzing transcript for best moments using keyword heuristic...")
        # Keywords that often indicate a highlight or important point
        viral_keywords = ["important", "amazing", "secret", "never", "always", "finally", "wow", "listen", "stop"]
        
        best_moments = []
        current_moment = None
        
        for i, seg in enumerate(segments):
            text = seg['text'].lower()
            # If keyword found and no current moment, start one
            if any(kw in text for kw in viral_keywords) and not current_moment:
                current_moment = {
                    "start": max(0, seg['start'] - 2), # Buffer before
                    "title": f"Viral Moment: {seg['text'].strip()[:30]}...",
                    "reason": f"Found key insight: '{seg['text'].strip()}'",
                    "hook": "STOP SCROLLING! Watch this!",
                    "caption": f"You won't believe this! 😱 {seg['text'].strip()} #viral #insights",
                    "hashtags": ["viral", "shorts", "reels", "trending", "mustwatch"],
                    "viral_score": 85,
                    "score_reason": "Contains high-impact viral keywords and strong emotional hook."
                }
            
            # If we have a moment and it's reached ~30-45 seconds, close it
            if current_moment and (seg['end'] - current_moment['start'] >= 30):
                current_moment["end"] = seg['end'] + 1 # Buffer after
                best_moments.append(current_moment)
                current_moment = None
                
            if len(best_moments) >= 6: # Increased limit for more variations
                break
        
        # Fallback if no keywords found: just take several segments
        if not best_moments:
            # First 30s
            best_moments.append({
                "start": segments[0]['start'],
                "end": min(segments[-1]['end'], segments[0]['start'] + 30),
                "title": "Quick Insight",
                "reason": "Introduction and initial overview.",
                "style": "minimal",
                "hook": "STOP SCROLLING! Watch this!",
                "caption": "Check out these quick insights! 🚀🔥 #learning #overview",
                "hashtags": ["insight", "education", "tips"],
                "viral_score": 75,
                "score_reason": "Solid introduction with clear educational value."
            })
            # A middle segment if long enough
            if segments[-1]['end'] > 60:
                best_moments.append({
                    "start": 30,
                    "end": min(segments[-1]['end'], 60),
                    "title": "Deep Dive",
                    "reason": "Key explanation in the middle.",
                    "style": "educational",
                    "hook": "THE SECRET YOU NEED TO KNOW",
                    "caption": "Deep diving into the details! 😍🚀 #deepdive #knowledge",
                    "hashtags": ["knowledge", "expert", "learning"],
                    "viral_score": 80,
                    "score_reason": "Mid-video insight with high retention potential."
                })
            # A variation of the first segment with 'hype' style
            best_moments.append({
                "start": segments[0]['start'],
                "end": min(segments[-1]['end'], segments[0]['start'] + 30),
                "title": "Intro (Hype Version)",
                "reason": "High-energy version of the intro.",
                "style": "hype",
                "hook": "YOU WON'T BELIEVE THIS!",
                "caption": "STOP EVERYTHING! You need to see this! 😱🔥 #hype #fire",
                "hashtags": ["hype", "viral", "trending"],
                "viral_score": 90,
                "score_reason": "High energy hook combined with viral keyword detection."
            })
            
        return best_moments

    def get_video_info(self, video_path):
        """Get video dimensions using ffprobe."""
        try:
            command = [
                'ffprobe', '-v', 'error', 
                '-select_streams', 'v:0', 
                '-show_entries', 'stream=width,height', 
                '-of', 'json', video_path
            ]
            result = subprocess.run(command, capture_output=True, text=True, check=True)
            data = json.loads(result.stdout)
            width = data['streams'][0]['width']
            height = data['streams'][0]['height']
            return width, height
        except Exception as e:
            print(f"Error getting video info: {e}")
            return 1920, 1080 # Default fallback

    def generate_srt(self, segments, start_offset, duration, srt_path, hook=None):
        """
        Helper to generate a clean SRT file for a specific clip timeframe.
        Implements improved timing sync:
        - Prevents overlapping segments
        - Enforces minimum duration (1.2s)
        - Enforces maximum duration (4s)
        - Adds small buffers for smooth transitions
        - Aligns with the viral hook
        """
        end_time = start_offset + duration
        MIN_DURATION = 1.2
        MAX_DURATION = 4.0
        GAP = 0.05 # Small gap between segments for readability
        
        # Filter and deduplicate segments
        relevant_segments = []
        seen_texts = set()
        
        for s in segments:
            if s['start'] < end_time and s['end'] > start_offset:
                text = s['text'].strip()
                if text and text not in seen_texts:
                    relevant_segments.append(s)
                    seen_texts.add(text)
        
        def format_timestamp(seconds):
            if seconds < 0: seconds = 0
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int((seconds - int(seconds)) * 1000)
            return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

        def highlight_text(text):
            # TikTok/Reels style: Highlight emotional and viral keywords in yellow
            viral_keywords = [
                "INSANE", "CRAZY", "SHOCK", "WOW", "NEVER", "UNBELIEVABLE",
                "secret", "always", "stop", "listen", "hack", "mistake", "failure", 
                "success", "money", "growth", "viral", "trending", "results", 
                "important", "amazing", "incredible", "power", "motivation", 
                "change", "life", "results", "proven", "hidden", "love", "heart", 
                "scary", "truth", "exposed", "warning", "don't"
            ]
            
            import re
            for word in viral_keywords:
                # Case-insensitive replacement with yellow color tag
                pattern = re.compile(rf'\b({re.escape(word)})\b', re.IGNORECASE)
                text = pattern.sub(r'<font color="#FFFF00">\1</font>', text)
            return text

        with open(srt_path, "w", encoding="utf-8") as f:
            subtitle_index = 1
            last_end_time = 0.0
            
            # 1. Insert Viral Hook if provided (First 2.5 seconds)
            if hook:
                f.write(f"{subtitle_index}\n")
                f.write(f"00:00:00,000 --> 00:00:02,500\n")
                # Hooks are already punchy, let's keep them clean or also highlight
                f.write(f"{highlight_text(hook.upper())}\n\n")
                subtitle_index += 1
                last_end_time = 2.5 + GAP

            # 2. Add transcript segments with improved timing
            for seg in relevant_segments:
                # Calculate raw local timing
                raw_start = seg['start'] - start_offset
                raw_end = seg['end'] - start_offset
                
                # Apply timing constraints
                # Start must be at least last_end_time + GAP
                s = max(last_end_time, raw_start)
                
                # End must be at least s + MIN_DURATION
                e = max(s + MIN_DURATION, raw_end)
                
                # Limit duration to MAX_DURATION
                if e - s > MAX_DURATION:
                    e = s + MAX_DURATION
                
                # Cap at the total duration of the clip
                if e > duration:
                    e = duration
                    # If capping made the segment too short, try to push the start back 
                    # but not beyond the previous segment
                    if e - s < MIN_DURATION:
                        s = max(last_end_time, e - MIN_DURATION)
                
                # Final check to ensure validity
                if s >= e or (e - s) < 0.1: # Skip if practically zero duration
                    continue

                f.write(f"{subtitle_index}\n")
                f.write(f"{format_timestamp(s)} --> {format_timestamp(e)}\n")
                
                # Apply highlighting to segment text
                styled_text = highlight_text(seg['text'].strip())
                f.write(f"{styled_text}\n\n")
                
                subtitle_index += 1
                last_end_time = e + GAP
                
        return srt_path

    def process_reel(self, video_path, start_time, end_time, transcript_segments, output_path, style_type="minimal", hook=None):
        """
        Unified Step 5 & 6: FFmpeg Cut, Format 9:16, and Burn Captions in ONE PASS.
        This is faster, higher quality, and eliminates the double-captioning bug.
        """
        print(f"Processing unified vertical HD reel from {start_time} to {end_time} (style: {style_type})...")
        srt_path = output_path.replace(".mp4", ".srt")
        try:
            duration = end_time - start_time
            width, height = self.get_video_info(video_path)
            aspect_ratio = width / height
            
            # 1. Generate SRT file
            self.generate_srt(transcript_segments, start_time, duration, srt_path, hook=hook)
            
            # 2. Define Caption Style
            styles = {
                "educational": (
                    "Alignment=2,Fontsize=24,PrimaryColour=&H00FFFFFF,SecondaryColour=&H00000000,"
                    "Outline=2,OutlineColour=&H000000,BorderStyle=1,Bold=1,MarginV=100,Fontname=Arial"
                ),
                "hype": (
                    "Alignment=2,Fontsize=32,PrimaryColour=&H0000FFFF,SecondaryColour=&H00000000,"
                    "Outline=4,OutlineColour=&H00000000,BorderStyle=1,Bold=1,Italic=1,MarginV=140,Fontname=Impact"
                ),
                "funny": (
                    "Alignment=2,Fontsize=28,PrimaryColour=&H0000FF00,SecondaryColour=&H00000000,"
                    "Outline=2,OutlineColour=&H000000,BorderStyle=1,Bold=1,MarginV=110,Fontname=Comic Sans MS"
                ),
                "emotional": (
                    "Alignment=2,Fontsize=22,PrimaryColour=&H00FF00FF,SecondaryColour=&H00000000,"
                    "Outline=1,OutlineColour=&H00FFFFFF,BorderStyle=1,Italic=1,MarginV=80,Fontname=Georgia"
                ),
                "minimal": (
                    "Alignment=2,Fontsize=20,PrimaryColour=&H00FFFFFF,SecondaryColour=&H00000000,"
                    "Outline=1,OutlineColour=&H000000,BorderStyle=1,MarginV=60,Fontname=Helvetica"
                )
            }
            selected_style = styles.get(style_type, styles["minimal"])
            
            fade_duration = 0.5
            fade_out_start = max(0, duration - fade_duration)
            escaped_srt_path = srt_path.replace('\\', '/').replace(':', '\\:')
            
            # 3. Unified Filter Chain
            if aspect_ratio > 0.6: # Wider than 9:16
                video_filters = (
                    f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[bg];"
                    f"[0:v]scale=1080:-1[fg];"
                    f"[bg][fg]overlay=(W-w)/2:(H-h)/2,"
                    f"subtitles='{escaped_srt_path}':force_style='{selected_style}',"
                    f"fade=t=in:st=0:d={fade_duration},fade=t=out:st={fade_out_start}:d={fade_duration}"
                )
            else: # Already vertical
                video_filters = (
                    f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
                    f"subtitles='{escaped_srt_path}':force_style='{selected_style}',"
                    f"fade=t=in:st=0:d={fade_duration},fade=t=out:st={fade_out_start}:d={fade_duration}"
                )
                
            audio_filters = f"afade=t=in:st=0:d={fade_duration},afade=t=out:st={fade_out_start}:d={fade_duration}"
            
            command = [
                'ffmpeg', '-y',
                '-ss', str(start_time),
                '-to', str(end_time),
                '-i', video_path,
                '-filter_complex', f"[0:v]{video_filters}[v];[0:a]{audio_filters}[a]",
                '-map', '[v]',
                '-map', '[a]',
                '-c:v', 'libx264',
                '-preset', 'slow',
                '-crf', '18',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-sn', # EXPLICITLY DISABLE SUBTITLE STREAMS to fix double captioning bug
                output_path
            ]
            
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            print(f"Successfully exported high-quality unified reel to {output_path}")
            
            # Clean up SRT
            if os.path.exists(srt_path):
                os.remove(srt_path)
                
            return output_path
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode()
            print(f"FFmpeg unified processing error: {error_msg}")
            raise Exception(f"Failed to process reel using FFmpeg: {error_msg}")
        finally:
            if os.path.exists(srt_path):
                os.remove(srt_path)

    def generate_thumbnail(self, video_path, output_path, text="VIRAL MOMENT", style_type="hype"):
        """
        Step 7: Generate a high-impact thumbnail from the video.
        Extracts a frame and adds a bold modern text overlay.
        """
        print(f"Generating thumbnail for {video_path}...")
        try:
            # Pick a frame from the middle of the clip for better visuals
            # We'll just take the 1st second frame for simplicity or use -ss
            
            # Define text style based on the reel style
            styles = {
                "hype": "fontcolor=yellow:fontsize=80:fontfile=Arial:borderw=5:bordercolor=black",
                "educational": "fontcolor=white:fontsize=70:fontfile=Arial:borderw=3:bordercolor=blue",
                "funny": "fontcolor=lime:fontsize=75:fontfile=Arial:borderw=4:bordercolor=black",
                "emotional": "fontcolor=white:fontsize=65:fontfile=Arial:borderw=2:bordercolor=purple",
                "minimal": "fontcolor=white:fontsize=60:fontfile=Arial:borderw=1:bordercolor=black"
            }
            
            draw_style = styles.get(style_type, styles["hype"])
            
            # FFmpeg command to extract one frame and add text
            # Using drawtext filter
            # We use a simple position (middle-top or middle-bottom)
            command = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-ss', '00:00:01', # Capture frame at 1 second
                '-vframes', '1',
                '-vf', f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,drawtext=text='{text}':x=(w-text_w)/2:y=(h-text_h)/4:{draw_style}",
                output_path
            ]
            
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            print(f"Successfully generated thumbnail: {output_path}")
            return output_path
        except Exception as e:
            print(f"Error generating thumbnail: {e}")
            # Fallback: just extract a frame without text if drawtext fails
            try:
                fallback_command = [
                    'ffmpeg', '-y',
                    '-i', video_path,
                    '-ss', '00:00:01',
                    '-vframes', '1',
                    '-vf', "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
                    output_path
                ]
                subprocess.run(fallback_command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                return output_path
            except:
                return None
