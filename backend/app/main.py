from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware # 1. इसे इम्पोर्ट करें
from pydantic import BaseModel
from .engine import AIEngine
from .database import db
import os
import random
from fastapi.middleware.cors import CORSMiddleware
import feedparser
from supabase import create_client, Client # 👈 सुपाबेस के लिए नया इम्पोर्ट
from datetime import datetime # 👈 तारीख के लिए नया इम्पोर्ट

app = FastAPI(title="HP Exam Pro API")

# --- SUPABASE DATABASE CONFIGURATION ---
SUPABASE_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"
# 💡 अपनी असली Anon/Public Key यहाँ पेस्ट करना जो तुम्हारी script.js में ऊपर लगी है
SUPABASE_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif" 
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# स्कोर डेटा वैलिडेशन के लिए मॉडल
class ScoreSubmission(BaseModel):
    user_id: str
    exam_type: str
    score: int
    correct_answers: int
    wrong_answers: int


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
    
# --- NAYA ENDPOINT: MOCK TEST GENERATE + FREEMIUM GATEKEEPER ---
@app.get("/api/mock-test/generate")
async def generate_mock_test(user_id: str, exam_type: str):
    try:
        # 1. Pahle check karein ki kya user premium member hai
        user_res = db.supabase.table("profiles").select("is_premium").eq("id", user_id).execute()
        
        # Agar profile table mein user milta hai toh uska status check karein
        is_premium = False
        if user_res.data:
            is_premium = user_res.data[0].get("is_premium", False)
        
        # 2. Agar user premium nahi hai, toh check karein usne pahle kitne test diye hain
        if not is_premium:
            attempts_res = db.supabase.table("test_attempts").select("id").eq("user_id", user_id).execute()
            total_attempts = len(attempts_res.data) if attempts_res.data else 0
            
            # Agar wo pahle hi 1 free test de chuka hai, toh block karein (Status 403 Forbidden)
            if total_attempts >= 1:
                raise HTTPException(
                    status_code=403, 
                    detail="Aapka 1 Free Mock Test poora ho chuka hai. Baaki ke tests unlock karne ke liye Pro Access lein! 👑"
                )
        
        # 3. Agar user premium hai ya uska pehla free test hai, toh sawal nikalna shuru karein
        if exam_type == "patwari":
            questions = db.get_patwari_test()
        elif exam_type == "joa_it":
            questions = db.get_joa_it_test()
        else:
            raise HTTPException(status_code=400, detail="Invalid exam type!")
            
        return {"status": "success", "questions": questions}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 1. टेस्ट सबमिशन के लिए डेटा का ढांचा (Schema) ---
class TestSubmitRequest(BaseModel):
    user_id: str
    exam_type: str
    score: int
    total_qs: int
    correct_answers: int
    wrong_answers: int

# --- 2. टेस्ट स्कोर को डेटाबेस में सेव करने का एंडपॉइंट ---
@app.post("/api/mock-test/submit")
async def submit_mock_test(request: TestSubmitRequest):
    try:
        # फ्रंटएंड से आया डेटा तैयार करना
        attempt_data = {
            "user_id": request.user_id,
            "exam_type": request.exam_type,
            "score": request.score,
            "total_qs": request.total_qs,
            "correct_answers": request.correct_answers,
            "wrong_answers": request.wrong_answers
        }
        
        # Supabase की 'test_attempts' टेबल (डायरी) में एंट्री दर्ज करना
        res = db.supabase.table("test_attempts").insert(attempt_data).execute()
        
        return {
            "status": "success", 
            "message": "Badhai ho! Aapka score database mein save ho gya hai.",
            "data": res.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- QUIZ ENDPOINT: परीक्षा के सवाल भेजना ---
@app.get("/api/questions/{exam_type}")
async def get_exam_questions(exam_type: str):
    # हिमाचल पटवारी के सैंपल सवाल
    if exam_type == "patwari":
        return [
            {
                "id": 1,
                "question": "हिमाचल प्रदेश के किस जिले में 'पंगवाला' जनजाति मुख्य रूप से पाई जाती है?",
                "options": ["लाहौल-स्पीति", "चम्बा", "किन्नौर", "कुल्लू"],
                "correct": 1  # यानी "चम्बा" (index 1)
            },
            {
                "id": 2,
                "question": "एक आयत (Rectangle) की लंबाई 15 सेमी और चौड़ाई 10 सेमी है, उसका क्षेत्रफल (Area) क्या होगा?",
                "options": ["150 वर्ग सेमी", "50 वर्ग सेमी", "25 वर्ग सेमी", "100 वर्ग सेमी"],
                "correct": 0
            },
            {
                "id": 3,
                "question": "'शुद्ध वर्तनी' का चयन कीजिए:",
                "options": ["कविइत्री", "कवयित्री", "कविइत्रि", "कवयित्रीं"],
                "correct": 1
            }
        ]
    
    # JOA IT के सैंपल सवाल
    elif exam_type == "joa_it":
        return [
            {
                "id": 1,
                "question": "Which of the following is known as the volatile memory of a computer?",
                "options": ["ROM", "RAM", "Hard Disk", "SSD"],
                "correct": 1
            },
            {
                "id": 2,
                "question": "What is the shortcut key to open a new blank document in MS Word?",
                "options": ["Ctrl + O", "Ctrl + N", "Ctrl + S", "Ctrl + M"],
                "correct": 1
            }
        ]
    
    else:
        return {"detail": "Exam type not found"}

# --- A. स्कोर सेव करने का एंडपॉइंट ---
@app.post("/api/submit-score")
async def submit_score(data: ScoreSubmission):
    try:
        response = supabase.table("test_results").insert({
            "user_id": data.user_id,
            "exam_type": data.exam_type,
            "score": data.score,
            "correct_answers": data.correct_answers,
            "wrong_answers": data.wrong_answers
        }).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- B. लाइव एनालिटिक्स डेटा भेजने का एंडपॉइंट ---
@app.get("/api/analytics/{user_id}")
async def get_analytics(user_id: str):
    try:
        response = supabase.table("test_results").select("*").eq("user_id", user_id).order("created_at", desc=False).execute()
        records = response.data

        if not records:
            return {"total_tests": 0, "avg_score": 0, "highest_score": 0, "accuracy": 0, "graph_data": []}

        total_tests = len(records)
        highest_score = max(r["score"] for r in records)
        avg_score = round(sum(r["score"] for r in records) / total_tests, 1)

        total_correct = sum(r["correct_answers"] for r in records)
        total_wrong = sum(r["wrong_answers"] for r in records)
        total_attempted = total_correct + total_wrong
        accuracy = round((total_correct / total_attempted) * 100, 1) if total_attempted > 0 else 0

        # लास्ट 7 टेस्ट्स का डेटा ग्राफ के लिए सेट करना
        graph_data = []
        for r in records[-7:]:
            dt = datetime.fromisoformat(r["created_at"].split(".")[0].replace("Z", ""))
            date_str = dt.strftime("%d %b")
            graph_data.append({"date": date_str, "score": r["score"]})

        return {
            "total_tests": total_tests,
            "avg_score": avg_score,
            "highest_score": highest_score,
            "accuracy": accuracy,
            "graph_data": graph_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
