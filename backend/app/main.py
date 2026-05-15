from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware # 1. इसे इम्पोर्ट करें
from pydantic import BaseModel
from .engine import AIEngine
from .database import db
import os
import random
from fastapi.middleware.cors import CORSMiddleware
import feedparser

app = FastAPI(title="HP Exam Pro API")

@app.get("/api/news")
async def get_hp_news():
    # दो अलग-अलग न्यूज़ सोर्स (ताकि एक फेल हो तो दूसरा चले)
    sources = [
        "https://www.amarujala.com/rss/himachal-pradesh.xml",  # अमर उजाला (Hindi)
        "https://www.tribuneindia.com/rss/feed.aspx?cat_id=40" # ट्रिब्यून (English)
    ]
    
    all_news = []
    
    for url in sources:
        try:
            feed = feedparser.parse(url)
            if feed.entries:
                titles = [entry.title for entry in feed.entries[:5]]
                all_news.extend(titles)
        except Exception as e:
            print(f"Error fetching from {url}: {e}")

    # अगर दोनों से न्यूज़ मिल गई, तो उन्हें मिक्स (Shuffle) कर दें
    if all_news:
        random.shuffle(all_news)
        return {"news": all_news[:8]} # टॉप 8 खबरें भेजें
    
    # अगर कहीं से न्यूज़ नहीं मिली, तो ये 'Static' करंट अफेयर्स भेजें (ताकि खाली न दिखे)
    return {
        "news": [
            "हिमाचल प्रदेश सरकार ने 'मुख्यमंत्री सुख-आश्रय योजना' के तहत नए दिशा-निर्देश जारी किए।",
            "कांगड़ा के शाहपुर में नए आईटी पार्क के निर्माण की प्रक्रिया तेज़ हुई।",
            "रोहतांग दर्रे में सैलानियों के लिए ऑनलाइन परमिट कोटा बढ़ाया गया।",
            "हिमाचल पुलिस ने साइबर क्राइम से निपटने के लिए नया पोर्टल लॉन्च किया।"
        ]
    }


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
