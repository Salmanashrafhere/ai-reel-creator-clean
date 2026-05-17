import os
import google.generativeai as genai
import json
import warnings
from typing import List, Dict

# Suppress the deprecation warning for google-generativeai
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")

class GeminiAnalyzer:
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def analyze_transcript(self, transcript_segments: List[Dict]) -> List[Dict]:
        """
        Analyze transcript segments to find viral moments.
        Returns a list of moments with start, end, title, and reason.
        """
        # Format transcript for the prompt
        formatted_transcript = ""
        for seg in transcript_segments:
            formatted_transcript += f"[{seg['start']:.2f} - {seg['end']:.2f}] {seg['text']}\n"

        prompt = f"""
        Analyze the following video transcript and identify the top 5-10 most engaging, viral, or insightful moments. 
        For each moment, assign one of these styles:
        - 'educational': Informative, clear, uses a steady pace.
        - 'hype': High energy, fast-paced, exciting.
        - 'emotional': Touching, personal, or deeply impactful.
        - 'funny': Comedic, witty, or unexpected.
        - 'minimal': Clean, simple, focus on the speaker.

        For each moment variation, provide:
        1. Start timestamp
        2. End timestamp (Optimal length for virality is 7-25 seconds).
        3. A catchy, viral title for the reel.
        4. A brief reason why this moment is viral-worthy.
        5. The assigned style from the list above.
        6. A powerful "viral hook line" (text overlay for the first 2-3 seconds). 
           - MUST be 8-12 words max.
           - MUST use high-attention phrases (e.g., "WAIT FOR THIS", "You are NOT ready for this", "STOP SCROLLING").
        7. A complete Instagram caption. 
           - MUST include context-aware emojis:
             - Positive/Exciting → 🔥 🚀 😍 💯
             - Shock/Surprise → 😱 😳 🤯
             - Funny/Humorous → 😂 🤣
           - LIMIT to exactly 1-2 emojis per caption.
        8. A set of 5-10 relevant trending hashtags.
        9. A "viral_score" (0-100) based on:
           - Emotional intensity (high impact keywords like INSANE, CRAZY, WOW).
           - Hook strength (curiosity gap).
           - Retention potential (fast pace, clear message).
           - Length optimization (7-25s is best).
        10. A "score_reason" explaining the 0-100 score.
        
        Format your response as a JSON array of objects with the keys: 
        "start", "end", "title", "reason", "style", "hook", "caption", "hashtags", "viral_score", "score_reason".
        Ensure the timestamps are precise and correspond to the input.
        
        Transcript:
        {formatted_transcript}
        """

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json"
                )
            )
            
            # Clean response text if it contains markdown code blocks
            response_text = response.text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:-3].strip()
            elif response_text.startswith("```"):
                response_text = response_text[3:-3].strip()
                
            moments = json.loads(response_text)
            print(f"Gemini successfully identified {len(moments)} moments.")
            return moments
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            # Fallback to a simple segment if API fails
            return []
