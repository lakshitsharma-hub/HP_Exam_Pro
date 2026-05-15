from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware # 1. इसे इम्पोर्ट करें
from pydantic import BaseModel
from .engine import AIEngine
from .database import db
import os
from fastapi.middleware.cors import CORSMiddleware
import feedparser

app = FastAPI(title="HP Exam Pro API")

@app.get("/api/news")
async def get_hp_news():
    # The Tribune - Himachal Pradesh Section का RSS Feed
    rss_url = "https://www.tribuneindia.com/rss/feed.aspx?cat_id=40"
    
    try:
        # फीड को पार्स (Parse) करें
        feed = feedparser.parse(rss_url)
        
        # सिर्फ टॉप 5 खबरों के टाइटल निकालें
        # entries[].title में खबर की हेडलाइन होती है
        hp_news = [entry.title for entry in feed.entries[:5]]
        
        if not hp_news:
            return {"news": ["फिलहाल न्यूज़ अपडेट उपलब्ध नहीं है।"]}
            
        return {"news": hp_news}
        
    except Exception as e:
        print(f"Error fetching news: {e}")
        return {"news": ["न्यूज़ सर्वर से कनेक्ट करने में समस्या आ रही है।"]}

# ... बाकी का चैट वाला कोड इसके नीचे रहेगा


app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hp-exam-pro.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 2. CORS सेटअप करें (यह ब्राउज़र को आपके बैकएंड से बात करने की इजाजत देगा)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # अभी के लिए सबको इजाजत दें
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = AIEngine()

# ... बाकी का कोड वैसा ही रहेगा ...


# 3. डेटा का ढांचा (Schema)
class ChatRequest(BaseModel):
    message: str

# 4. सारे 'Routes' (रास्ते/Endpoints) यहाँ से शुरू होते हैं

@app.get("/")
def read_root():
    return {"status": "Engine is roaring!", "project": "HP Exam Pro"}

# --- TEST ENDPOINT: इसे यहाँ लिखा है ताकि आप चेक कर सकें ---
@app.get("/api/test-db")
async def test_database():
    # यह database.py के फंक्शन को कॉल करेगा
    result = db.create_admin_entry()
    return {"message": result}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    answer, source = engine.get_response(request.message)
    return {"answer": answer, "source": source}

@app.get("/api/admin/dashboard")
async def admin_dashboard(x_admin_password: str = Header(None)):
    # .env से पासवर्ड चेक करना
    if x_admin_password != os.getenv("ADMIN_PASSWORD"):
        raise HTTPException(status_code=401, detail="Invalid Admin Password!")
    return {"admin_status": "Authenticated", "server_health": "Optimal"}
