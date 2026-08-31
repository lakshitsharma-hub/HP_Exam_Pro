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

# 💳 Razorpay Test Keys
RAZORPAY_KEY_ID = "rzp_test_Sq35OFh2B20luk"
RAZORPAY_KEY_SECRET = "BqWJNRU2T7ONPQMCSBrp7g33"

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# --- SUPABASE DATABASE CONFIGURATION ----
SUPABASE_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"
SUPABASE_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif" 
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- CORS MIDDLEWARE SETUP ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hp-exam-pro.vercel.app", "http://localhost:3000", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PYDANTIC MODELS (Data Validation Models) ---
class ScoreSubmission(BaseModel):
    user_id: str
    display_name: str = "Unknown"
    exam_type: str
    score: int
    correct_answers: int
    wrong_answers: int
    questions_snapshot: list = []
    user_responses: dict = {}

class QueryRaiseInput(BaseModel):
    user_id: str
    question_id: str
    issue_text: str

class ChatRequest(BaseModel):
    message: str


# --- 1. CURRENT AFFAIRS / NEWS ENDPOINT (OFFICIAL EXAM-FOCUSED FEEDS) ---
# --- 1. CURRENT AFFAIRS / NEWS ENDPOINT (HP IPR + PIB SHIMLA DUAL FEED) ---
@app.get("/api/news")
async def get_hp_news():
    sources = [
        # 1. Himachal Pradesh Regional Govt Feeds
        "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2&Regid=13", # PIB Regional (Shimla/Chandigarh Zone Hindi)
        "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=13", # PIB Regional English
        "https://himachalpr.gov.in/RssFeed.aspx",                 # HP IPR (Information & Public Relations)
        
        # 2. National Core Feeds (Backbone)
        "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2&Regid=3",  # PIB National Hindi
        "https://ddnews.gov.in/en/feed/"                          # DD News
    ]
    
    all_news = []
    
    # Negative safety net
    block_words = [
        "बारिश", "सड़क बंद", "भूस्खलन", "हादसा", "ट्रैफिक", "मौसम अलर्ट", 
        "traffic", "landslide", "heavy rain", "weather alert", "accident", "मौत"
    ]

    for url in sources:
        try:
            feed = feedparser.parse(url)
            if feed.entries:
                for entry in feed.entries[:15]:
                    title = entry.title.strip()
                    title_lower = title.lower()
                    
                    # Clean HTML tags
                    if "<" in title and ">" in title:
                        import re
                        title = re.sub(r'<[^>]+>', '', title)
                        
                    # Skip accidents and weather disruptions
                    if any(bad in title_lower for bad in block_words):
                        continue
                        
                    if len(title) > 25:
                        # HP-specific keywords wale headlines ko top priority do
                        hp_keywords = ["हिमाचल", "शिमला", "कांगड़ा", "मंडी", "कुल्लू", "सुखविंदर", "himachal", "shimla"]
                        if any(k in title_lower for k in hp_keywords):
                            all_news.insert(0, title)
                        else:
                            all_news.append(title)
        except Exception as e:
            print(f"Regional Feed Fetch Error ({url}): {e}")
            
    if all_news:
        unique_news = list(dict.fromkeys(all_news))
        return {"news": unique_news[:10]}
        
    # High-quality state + national fallback
    return {
        "news": [
            "हिमाचल प्रदेश सरकार ने 'मुख्यमंत्री सुख-आश्रय योजना' के तहत नए सामाजिक दिशा-निर्देश जारी किए।",
            "कांगड़ा में नए स्टेट आईटी पार्क एवं पर्यटन हब के निर्माण को राज्य कैबिनेट की मंजूरी।",
            "केंद्रीय मंत्रिमंडल ने राष्ट्रीय स्तर पर नई छात्रवृत्ति एवं नवाचार योजना को मंजूरी दी।",
            "नीति आयोग (NITI Aayog) ने राज्य सतत विकास सूचकांक की नवीनतम रैंकिंग रिपोर्ट जारी की।"
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


# --- 3. DYNAMIC QUIZ ENGINE (WITH 30:40:30 CASCADE DIFFICULTY) ---

@app.get("/api/questions/{exam_type}")
async def get_exam_questions(exam_type: str, user_id: str = None):
    try:
        is_pro = False
        
        # 👑 Freemium & Pro Monthly Limit Logic
        if user_id and user_id != "test-user-123":
            profile_resp = supabase.table("profiles").select("is_pro", "custom_limit").eq("id", user_id).execute()
            profile_data = profile_resp.data
            user_row = profile_data[0] if profile_data else {}
            
            is_pro = user_row.get("is_pro", False)
            custom_limit = user_row.get("custom_limit")

            if is_pro:
                first_day_of_month = datetime.today().replace(day=1).strftime('%Y-%m-%d')
                tests_resp = supabase.table("test_results").select("id").eq("user_id", user_id).gte("created_at", first_day_of_month).execute()
                total_attempted = len(tests_resp.data) if tests_resp.data else 0
                
                max_allowed = custom_limit if custom_limit is not None else 15
                
                if total_attempted >= max_allowed:
                    raise HTTPException(status_code=403, detail=f"⚠️ आप इस महीने के अपने {max_allowed} Pro मॉक टेस्ट पूरे कर चुके हैं! अगले महीने नए टेस्ट अनलॉक हो जाएंगे। 👑")
            else:
                tests_resp = supabase.table("test_results").select("id").eq("user_id", user_id).execute()
                total_past_tests = len(tests_resp.data) if tests_resp.data else 0
                
                max_allowed = custom_limit if custom_limit is not None else 1
                
                if total_past_tests >= max_allowed:
                    raise HTTPException(status_code=403, detail=f"आप अपने {max_allowed} मुफ़्त मॉक टेस्ट दे चुके हैं! असीमित और प्रीमियम टेस्ट अनलॉक करने के लिए प्रो एक्सेस लें। 👑")

        final_questions = []
        selected_ids = set()

        # 🎯 30:40:30 Cascade Difficulty Filter Engine
        def fetch_filtered_qs(subject_name: str = None, q_type_value: str = "direct", count: int = 0):
            if count <= 0:
                return []

            query = supabase.table("questions").select("*")
            if subject_name:
                query = query.eq("subject", subject_name)
            if q_type_value:
                query = query.eq("q_type", q_type_value)
            
            res = query.execute()
            data = res.data if res.data else []

            # Filter out already selected IDs in this test session
            available = [q for q in data if q.get("id") not in selected_ids]

            # Segregate by difficulty levels
            tough_pool = [q for q in available if (q.get("difficulty") or "").lower() == "tough"]
            medium_pool = [q for q in available if (q.get("difficulty") or "").lower() == "medium"]
            easy_pool = [q for q in available if (q.get("difficulty") or "").lower() not in ["tough", "medium"]]

            # Calculate 30:40:30 target proportions
            target_tough = int(round(count * 0.30))
            target_medium = int(round(count * 0.40))
            target_easy = count - (target_tough + target_medium)

            selected_from_subject = []

            # 1. Pick Tough quota
            take_tough = min(len(tough_pool), target_tough)
            sampled_tough = random.sample(tough_pool, take_tough) if take_tough > 0 else []
            selected_from_subject.extend(sampled_tough)
            tough_deficit = target_tough - take_tough

            # 2. Pick Medium quota (Target + Tough Deficit fallback)
            effective_medium_target = target_medium + tough_deficit
            take_medium = min(len(medium_pool), effective_medium_target)
            sampled_medium = random.sample(medium_pool, take_medium) if take_medium > 0 else []
            selected_from_subject.extend(sampled_medium)
            medium_deficit = effective_medium_target - take_medium

            # 3. Pick Easy quota (Target + Medium Deficit fallback)
            effective_easy_target = target_easy + medium_deficit
            take_easy = min(len(easy_pool), effective_easy_target)
            sampled_easy = random.sample(easy_pool, take_easy) if take_easy > 0 else []
            selected_from_subject.extend(sampled_easy)

            # 4. Universal Final Fallback (agar kisi bhi difficulty mein total count kam pade)
            if len(selected_from_subject) < count:
                chosen_ids_here = {q["id"] for q in selected_from_subject}
                remaining_available = [q for q in available if q["id"] not in chosen_ids_here]
                needed = count - len(selected_from_subject)
                take_extra = min(len(remaining_available), needed)
                if take_extra > 0:
                    selected_from_subject.extend(random.sample(remaining_available, take_extra))

            # Mark selected IDs globally for this test session
            for q in selected_from_subject:
                selected_ids.add(q["id"])

            return selected_from_subject

        # 1. Patwari Exam Mode (120 Questions Blueprint)
        if exam_type == "patwari":
            final_questions.extend(fetch_filtered_qs("maths", "direct", 20))
            final_questions.extend(fetch_filtered_qs(None, "statement", 10))
            final_questions.extend(fetch_filtered_qs("hindi", "direct", 15))
            final_questions.extend(fetch_filtered_qs("english", "direct", 15))
            final_questions.extend(fetch_filtered_qs("science", "direct", 15))
            final_questions.extend(fetch_filtered_qs("geography", "direct", 5))
            final_questions.extend(fetch_filtered_qs("polity", "direct", 5))
            final_questions.extend(fetch_filtered_qs("history", "direct", 5))
            final_questions.extend(fetch_filtered_qs("reasoning", "direct", 7))
            final_questions.extend(fetch_filtered_qs("hp_gk", "direct", 5))
            final_questions.extend(fetch_filtered_qs("current_affairs", "direct", 8))
            final_questions.extend(fetch_filtered_qs("computer", "direct", 10))

        # 2. JOA IT Exam Mode (120 Questions Blueprint)
        elif exam_type == "joa_it":
            final_questions.extend(fetch_filtered_qs("computer", "direct", 80))
            final_questions.extend(fetch_filtered_qs("science", "direct", 10))
            final_questions.extend(fetch_filtered_qs("maths", "direct", 10))
            final_questions.extend(fetch_filtered_qs("hp_gk", "direct", 5))
            final_questions.extend(fetch_filtered_qs("reasoning", "direct", 5))
            final_questions.extend(fetch_filtered_qs(None, "statement", 5))
            final_questions.extend(fetch_filtered_qs("current_affairs", "direct", 5))

        # 3. HP Police Constable Exam Mode (90 Questions Blueprint)
        elif exam_type == "hp_police":
            final_questions.extend(fetch_filtered_qs("hindi", "direct", 20))
            final_questions.extend(fetch_filtered_qs("english", "direct", 20))
            final_questions.extend(fetch_filtered_qs("maths", "direct", 20))
            final_questions.extend(fetch_filtered_qs("reasoning", "direct", 10))
            final_questions.extend(fetch_filtered_qs("hp_gk", "direct", 7))
            final_questions.extend(fetch_filtered_qs("current_affairs", "direct", 7))
            final_questions.extend(fetch_filtered_qs("science", "direct", 6))

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

        config_resp = supabase.table("app_config").select("value").eq("key", "pro_price").execute()
        
        price_amount = 99
        if config_resp.data and len(config_resp.data) > 0:
            price_amount = int(config_resp.data[0].get("value", 99))

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
            "display_name": data.display_name,
            "exam_type": data.exam_type,
            "score": data.score,
            "correct_answers": data.correct_answers,
            "wrong_answers": data.wrong_answers,
            "questions_snapshot": data.questions_snapshot,
            "user_responses": data.user_responses
        }).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 5. QUERY RAISE SYSTEM ENDPOINT ---
@app.post("/api/query/raise")
async def raise_question_query(data: QueryRaiseInput):
    try:
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


@app.get("/api/daily-question")
async def get_daily_question():
    try:
        response = supabase.table("questions").select("*").execute()
        
        if response.data and len(response.data) > 0:
            random_question = random.choice(response.data)
            return {"status": "success", "question": random_question}
            
        return {"status": "error", "message": "No questions found in database."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
