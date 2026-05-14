import os
import google.generativeai as genai
from groq import Groq
import cohere
from dotenv import load_dotenv

load_dotenv()

class AIEngine:
    def __init__(self):
        # API Clients setup
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.co_client = cohere.Client(os.getenv("COHERE_API_KEY"))
        
        # Expert System Prompt
        self.system_prompt = (
            "You are 'HP GK Expert AI', a specialized assistant for HP exams. "
            "Primary source: 'The Wonderland Himachal Pradesh' by Jag Mohan Balokhra. "
            "Provide deep, conceptual, and accurate facts in Hinglish."
            "Be concise. Answer the user's specific question directly first. Provide extra details only if they are absolutely necessary for conceptual understanding. Use bullet points for facts"
        )

    def get_response(self, user_input: str):
        """Triple Shield Fallback: Gemini -> Groq -> Cohere"""
        # 1. Gemini 2.5 Flash
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            res = model.generate_content(f"{self.system_prompt}\n\nQuestion: {user_input}")
            return res.text, "Gemini 2.5 Flash"
        except Exception:
            # 2. Groq (Llama 3.3)
            try:
                res = self.groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": user_input}
                    ],
                    model="llama-3.3-70b-versatile"
                )
                return res.choices[0].message.content, "Groq (Llama 3.3)"
            except Exception:
                # 3. Cohere (Default)
                try:
                    res = self.co_client.chat(message=user_input, preamble=self.system_prompt)
                    return res.text, "Cohere (Default)"
                except Exception as e:
                    return f"System Error: {str(e)}", "Failed"
