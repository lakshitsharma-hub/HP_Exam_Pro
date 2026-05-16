from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .engine import AIEngine
from .database import db
import os
import random
import feedparser
from supabase import create_client, Client
from datetime import datetime
import razorpay

app = FastAPI(title="HP Exam Pro API")

# 💳 Razorpay Test Keys (तुम्हारी स्क्रीनशॉट वाली Key ID)
RAZORPAY_KEY_ID = "rzp_test_Sq35OFh2B20luk"
RAZORPAY_KEY_SECRET = "BqWJNRU2T7ONPQMCSBrp7g33" # (यहाँ अपनी असली Test Secret Key डालना जो तुमने सेव की थी)

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# --- SUPABASE DATABASE CONFIGURATION ----
SUPABASE_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"
SUPABASE_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif" 
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- CORS MIDDLEWARE SETUP (Mila kar ek kar diya hai) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hp-exam-pro.vercel.app", "http://localhost:3000", "http://127.0.0.1:5500", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PYDANTIC MODELS (Data Validation Models) ---
class ScoreSubmission(BaseModel):
    user_id: str
    exam_type: str
    score: int
    correct_answers: int
    wrong_answers: int

class QueryRaiseInput(BaseModel):
    user_id: str
    question_id: str
    issue_text: str

class ChatRequest(BaseModel):
    message: str


# --- 1. CURRENT AFFAIRS / NEWS ENDPOINT ---
@app.get("/api/news")
async def get_hp_news():
    sources = [
        "https://www.amarujala.com/rss/himachal-pradesh.xml",  
        "https://www.tribuneindia.com/rss/feed.aspx?cat_id=40" 
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

    if all_news:
        random.shuffle(all_news)
        return {"news": all_news[:8]}
    
    return {
        "news": [
            "हिमाचल प्रदेश सरकार ने 'मुख्यमंत्री सुख-आश्रय योजना' के तहत नए दिशा-निर्देश जारी किए।",
            "कांगड़ा के शाहपुर में नए आईटी पार्क के निर्माण की प्रक्रिया तेज़ हुई।",
            "रोहतांग दर्रे में सैलानियों के लिए ऑनलाइन परमिट कोटा बढ़ाया गया।",
            "हिमाचल पुलिस ने साइबर क्राइम से निपटने के लिए नया पोर्टल लॉन्च किया।"
        ]
    }


# --- 2. CORE SYSTEM ENDPOINTS ---
@app.get("/")
def read_root():
    return {"status": "Engine is roaring!", "project": "HP Exam Pro"}

@app.get("/api/test-db")
async def test_database():
    result = db.create_admin_entry()
    return {"message": result}

engine = AIEngine()

@app.post("/api/chat")
async def chat(request: ChatRequest):
    answer, source = engine.get_response(request.message)
    return {"answer": answer, "source": source}

@app.get("/api/admin/dashboard")
async def admin_dashboard(x_admin_password: str = Header(None)):
    if x_admin_password != os.getenv("ADMIN_PASSWORD"):
        raise HTTPException(status_code=401, detail="Invalid Admin Password!")
    return {"admin_status": "Authenticated", "server_health": "Optimal"}


# --- 3. DYNAMIC QUIZ ENGINE & MONETIZATION ENGINE ---

@app.get("/api/questions/{exam_type}")
async def get_exam_questions(exam_type: str, user_id: str = None):
    try:
        is_pro = False
        
        # 👑 Freemium & Pro Monthly Limit Logic
        if user_id and user_id != "test-user-123":
            profile_resp = supabase.table("profiles").select("is_pro").eq("id", user_id).execute()
            profile_data = profile_resp.data
            is_pro = profile_data[0].get("is_pro", False) if profile_data else False
            
            if is_pro:
                first_day_of_month = datetime.today().replace(day=1).strftime('%Y-%m-%d')
                tests_resp = supabase.table("test_results").select("id").eq("user_id", user_id).gte("created_at", first_day_of_month).execute()
                total_attempted = len(tests_resp.data) if tests_resp.data else 0
                
                if total_attempted >= 15:
                    raise HTTPException(status_code=403, detail="⚠️ आप इस महीने के अपने 15 Pro मॉक टेस्ट पूरे कर चुके हैं! अगले महीने नए 15 टेस्ट ऑटोमैटिक अनलॉक हो जाएंगे। 👑")
            else:
                tests_resp = supabase.table("test_results").select("id").eq("user_id", user_id).execute()
                total_past_tests = len(tests_resp.data) if tests_resp.data else 0
                
                if total_past_tests >= 1:
                    raise HTTPException(status_code=403, detail="आप अपना 1 फ्री मॉक टेस्ट दे चुके हैं! असीमित टेस्ट और महीने के 15 प्रीमियम टेस्ट अनलॉक करने के लिए प्रो एक्सेस लें। 👑")

        final_questions = []
        # 🚨 FIX 1: रिपीटेड सवालों को रोकने के लिए एक Set बनाया जो चुने हुए IDs को ट्रैक करेगा
        selected_ids = set()

        def fetch_filtered_qs(subject_name: str = None, q_type_value: str = "direct", count: int = 0):
            query = supabase.table("questions").select("*")
            if subject_name: query = query.eq("subject", subject_name)
            if q_type_value: query = query.eq("q_type", q_type_value)
            res = query.execute()
            data = res.data if res.data else []
            
            # सिर्फ वही सवाल लो जो इस टेस्ट में अब तक सिलेक्ट नहीं हुए हैं
            available_data = [q for q in data if q['id'] not in selected_ids]
            
            # रैंडम सैंपल निकालो (सुरक्षा के साथ कि अगर सवाल कम हों तो क्रैश न हो)
            take_count = min(len(available_data), count)
            sampled = random.sample(available_data, take_count)
            
            # चुने गए सवालों की ID को लॉक कर दो ताकि दोबारा न आएं
            for q in sampled:
                selected_ids.add(q['id'])
                
            return sampled

        # 🎯 FIX 2: सवाल अब सब्जेक्ट-वाइज ग्रुप में ही रहेंगे (जैसे पटवारी का असली ब्लूप्रिंट)
        if exam_type == "patwari":
            final_questions.extend(fetch_filtered_qs("maths", "direct", 20))         # पहले मैथ्स के 20 सवाल साथ आएंगे
            final_questions.extend(fetch_filtered_qs(None, "statement", 10))         # फिर स्टेटमेंट वाले 10 सवाल
            final_questions.extend(fetch_filtered_qs("hindi", "direct", 15))         # फिर हिंदी के 15 सवाल साथ
            final_questions.extend(fetch_filtered_qs("english", "direct", 15))       # इंग्लिश के 15
            final_questions.extend(fetch_filtered_qs("science", "direct", 15))       # साइंस के 15
            final_questions.extend(fetch_filtered_qs("geography", "direct", 5))
            final_questions.extend(fetch_filtered_qs("polity", "direct", 5))
            final_questions.extend(fetch_filtered_qs("history", "direct", 5))
            final_questions.extend(fetch_filtered_qs("reasoning", "direct", 7))
            final_questions.extend(fetch_filtered_qs("hp_gk", "direct", 5))
            final_questions.extend(fetch_filtered_qs("current_affairs", "direct", 8))
            final_questions.extend(fetch_filtered_qs("computer", "direct", 10))
            # 🚨 पुराना random.shuffle(final_questions) यहाँ से हटा दिया गया है!

        elif exam_type == "joa_it":
            final_questions.extend(fetch_filtered_qs("computer", "direct", 80))      # कंप्यूटर के 80 सवाल एक साथ
            final_questions.extend(fetch_filtered_qs("science", "direct", 10))
            final_questions.extend(fetch_filtered_qs("maths", "direct", 10))
            final_questions.extend(fetch_filtered_qs("hp_gk", "direct", 5))
            final_questions.extend(fetch_filtered_qs("reasoning", "direct", 5))
            final_questions.extend(fetch_filtered_qs(None, "statement", 5)) 
            final_questions.extend(fetch_filtered_qs("current_affairs", "direct", 5))
            # 🚨 पुराना random.shuffle(final_questions) यहाँ से भी हटा दिया गया है!
            
        else:
            raise HTTPException(status_code=400, detail="Invalid exam type!")

        if not final_questions:
            raise HTTPException(status_code=444, detail="इस परीक्षा के सवाल डेटाबेस में उपलब्ध नहीं हैं।")

        return final_questions
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 💰 RAZORPAY ORDER CREATION ENDPOINT
@app.post("/api/payment/create-order")
async def create_payment_order(payload: dict):
    try:
        user_id = payload.get("user_id")
        if not user_id: raise HTTPException(status_code=400, detail="User ID required!")

        # 🛠️ FIX: .single() हटा दिया गया है!
        config_resp = supabase.table("app_config").select("value").eq("key", "pro_price").execute()
        
        # अगर डेटाबेस में प्राइस मिलता है तो वो लो, वर्ना डिफ़ॉल्ट 149 सेट कर दो
        price_amount = 149
        if config_resp.data and len(config_resp.data) > 0:
            price_amount = int(config_resp.data[0].get("value", 149))

        options = {
            "amount": price_amount * 100, 
            "currency": "INR",
            "receipt": f"receipt_{user_id[:8]}",
            "payment_capture": 1
        }
        order = razorpay_client.order.create(data=options)
        return {"status": "success", "order_id": order["id"], "amount": options["amount"], "currency": "INR"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# 🔐 RAZORPAY PAYMENT VERIFICATION ENDPOINT
@app.post("/api/payment/verify")
async def verify_payment_signature(payload: dict):
    try:
        user_id = payload.get("user_id")
        params_dict = {
            'razorpay_order_id': payload.get("razorpay_order_id"),
            'razorpay_payment_id': payload.get("razorpay_payment_id"),
            'razorpay_signature': payload.get("razorpay_signature")
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        supabase.table("profiles").update({"is_pro": True}).eq("id", user_id).execute()
        
        return {"status": "success", "message": "👑 बधाई हो! आपका प्रो एक्सेस सफलतापूर्वक एक्टिव कर दिया गया है।"}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="🔐 सुरक्षा अलर्ट: पेमेंट सिग्नेचर वेरिफिकेशन फेल हो गया!")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# --- 4. SCORE SUBMISSION ENDPOINT ---
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


# --- 5. QUERY RAISE SYSTEM ENDPOINT ---
@app.post("/api/query/raise")
async def raise_question_query(data: QueryRaiseInput):
    try:
        # छात्र की आपत्ति सीधे 'query_raises' टेबल में जाएगी
        response = supabase.table("query_raises").insert([
            {
                "user_id": data.user_id,
                "question_id": data.question_id,
                "issue_text": data.issue_text
            }
        ]).execute()
        
        return {"status": "success", "message": "आपकी आपत्ति सफलतापूर्वक दर्ज कर ली गई है। टीम इसकी समीक्षा करेगी!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 6. LIVE ANALYTICS ENDPOINT ---
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

        graph_data = []
        for r in records[-7:]:
            if r.get("created_at"):
                try:
                    dt = datetime.fromisoformat(r["created_at"].split(".")[0].replace("Z", ""))
                    date_str = dt.strftime("%d %b")
                except Exception:
                    date_str = datetime.now().strftime("%d %b")
            else:
                date_str = datetime.now().strftime("%d %b")
                
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
