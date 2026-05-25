import os
import random
import asyncio
from supabase import create_client

# ==================== CONFIGURATION (GitHub Secrets से डेटा उठाना) ====================
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHANNEL_USERNAME = os.environ.get("TELEGRAM_CHANNEL")
# ===================================================================================

async def send_daily_quiz():
    # चेक करना कि कोई की मिसिंग तो नहीं है
    if not all([SUPABASE_URL, SUPABASE_KEY, TELEGRAM_BOT_TOKEN, CHANNEL_USERNAME]):
        print("❌ एरर: कुछ क्रेडेंशियल्स (Secrets) मिसिंग हैं भाई! कृपया गिटहब सेटिंग्स चेक करें।")
        return

    # 1. Supabase क्लाइंट कनेक्ट करना
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        print("🔍 डेटाबेस से सभी एक्टिव IDs की लिस्ट निकाल रहे हैं...")
        id_response = supabase.table("questions").select("id").execute()
        
        if not id_response.data:
            print("❌ एरर: डेटाबेस में कोई सवाल नहीं मिला!")
            return
            
        available_ids = [row['id'] for row in id_response.data]
        print(f"📊 कुल {len(available_ids)} सवाल एक्टिव मिले।")
        
        # === 🔄 सुपर-बुलेटप्रूफ लूप: जो हर सिचुएशन को संभालेगा ===
        q = None
        options = []
        correct_idx = 0
        
        while len(available_ids) > 0:
            random_id = random.choice(available_ids)
            print(f"🎯 लॉटरी में चुनी गई ID: {random_id}")

            # डेटाबेस से सवाल उठाना
            response = supabase.table("questions").select("*").eq("id", random_id).execute()
            
            if response.data and len(response.data) > 0:
                potential_q = response.data[0]
                
                # 1. चारों ऑप्शन्स की मौजूदगी चेक करो
                opt1 = potential_q.get('opt1')
                opt2 = potential_q.get('opt2')
                opt3 = potential_q.get('opt3')
                opt4 = potential_q.get('opt4')
                
                if not (opt1 and opt2 and opt3 and opt4):
                    print(f"⚠️ ID {random_id} के कुछ ऑप्शन्स खाली (missing) हैं भाई, इसे छोड़ रहे हैं...")
                    available_ids.remove(random_id)
                    continue
                
                # 2. टेलीग्राम के नियम के अनुसार ऑप्शन्स की लेंथ चेक करो (Max 100 characters)
                # अगर कोई ऑप्शन 100 से बड़ा है, तो उसे 97 पर ट्रिम करके '...' लगा देंगे ताकि पोल फेल न हो!
                opt1 = str(opt1)[:97] + "..." if len(str(opt1)) > 100 else str(opt1)
                opt2 = str(opt2)[:97] + "..." if len(str(opt2)) > 100 else str(opt2)
                opt3 = str(opt3)[:97] + "..." if len(str(opt3)) > 100 else str(opt3)
                opt4 = str(opt4)[:97] + "..." if len(str(opt4)) > 100 else str(opt4)
                
                # 3. करेक्ट ऑप्शन वैलिडेट करना
                try:
                    correct_idx = int(potential_q['correct_option']) - 1
                    if correct_idx < 0 or correct_idx > 3:
                        raise ValueError
                except (ValueError, TypeError, KeyError):
                    print(f"⚠️ ID {random_id} का correct_option इनवैलिड है, इसे छोड़ रहे हैं...")
                    available_ids.remove(random_id)
                    continue
                
                # अगर सब कुछ परफेक्ट है, तो डेटा सेट करो और लूप से बाहर निकलो
                q = potential_q
                options = [opt1, opt2, opt3, opt4]
                break
            else:
                print(f"⚠️ ID {random_id} डेटाबेस में मिसिंग/डिलीटेड है भाई, दूसरी ID ट्राई कर रहे हैं...")
                available_ids.remove(random_id)

        if not q:
            print("❌ एरर: पूरे डेटाबेस में एक भी ऐसा सवाल नहीं मिला जो टेलीग्राम के रूल्स को पास कर सके!")
            return
        # =============================================================

        # 4. सवाल का टेक्स्ट और एक्सप्लेनेशन सेट करना
        question_text = f"📝 Question of the Day:\n\n{q['question_text']}"
        
        # टेलीग्राम पोल का सवाल 300 कैरेक्टर से बड़ा नहीं हो सकता, इसे भी सेफ कर देते हैं
        if len(question_text) > 300:
            question_text = question_text[:297] + "..."

        explanation = q.get('explanation', 'HP Exam Pro पर अपनी तैयारी जारी रखें!')
        if not explanation:
            explanation = 'HP Exam Pro पर अपनी तैयारी जारी रखें!'
        # टेलीग्राम पोल का एक्सप्लेनेशन 200 कैरेक्टर से बड़ा नहीं हो सकता (BadRequest से बचने के लिए)
        if len(explanation) > 200:
            explanation = explanation[:197] + "..."

        # 5. Telegram Bot इनिशियलाइज़ करना
        from telegram import Bot
        bot = Bot(token=TELEGRAM_BOT_TOKEN)

        # 6. क्विज़ पोल पोस्ट करना
        print("🚀 टेलीग्राम पर क्विज़ भेज रहे हैं...")
        await bot.send_poll(
            chat_id=CHANNEL_USERNAME,
            question=question_text,
            options=options,
            is_anonymous=False,
            type="quiz",
            correct_option_id=correct_idx,
            explanation=explanation
        )
        
        # 7. नीचे वेबसाइट लिंक का नोट भेजना
        note_message = (
            "📢 <b>Note:</b> Roz aise hi premium himachal exams (Patwari, JOA IT) ke mock test dene ke liye "
            "aur apni state rank check karne ke liye abhi humari official website par visit karen:\n\n"
            "🌐 <b><a href='https://hp-exam-pro.vercel.app'>👉 Yahan Click Karen: HP Exam Pro</a></b>"
        )

        print("🔗 वेबसाइट लिंक का नोट भेज रहे हैं...")
        await bot.send_message(
            chat_id=CHANNEL_USERNAME,
            text=note_message,
            parse_mode="HTML",
            disable_web_page_preview=False
        )
        
        print("🎉 आज का क्विज़ सफलतापूर्वक टेलीग्राम पर लाइव हो गया है!")

    except Exception as e:
        print(f"❌ एरर आया भाई: {e}")

if __name__ == "__main__":
    asyncio.run(send_daily_quiz())
    
