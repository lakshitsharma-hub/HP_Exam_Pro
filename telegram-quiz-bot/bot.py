import os
import random
import asyncio
from supabase import create_client

# ==================== CONFIGURATION (GitHub Secrets से डेटा उठाना) ====================
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHANNEL_USERNAME = os.environ.get("TELEGRAM_CHANNEL")
GROUP_USERNAME = os.environ.get("TELEGRAM_GROUP")  # 🟢 NAYA: Main Group ID ke liye
# ===================================================================================

async def send_daily_quiz():
    # चेक करना कि कोई की मिसिंग तो नहीं है (ग्रुप को भी चेक करेंगे)
    if not all([SUPABASE_URL, SUPABASE_KEY, TELEGRAM_BOT_TOKEN, CHANNEL_USERNAME, GROUP_USERNAME]):
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
        
        q = None
        options = []
        correct_idx = 0
        
        while len(available_ids) > 0:
            random_id = random.choice(available_ids)
            print(f"🎯 लॉटरी में चुनी गई ID: {random_id}")

            response = supabase.table("questions").select("*").eq("id", random_id).execute()
            
            if response.data and len(response.data) > 0:
                potential_q = response.data[0]
                
                opt1 = potential_q.get('opt1')
                opt2 = potential_q.get('opt2')
                opt3 = potential_q.get('opt3')
                opt4 = potential_q.get('opt4')
                
                if not (opt1 and opt2 and opt3 and opt4):
                    print(f"⚠️ ID {random_id} के कुछ ऑप्शन्स खाली (missing) हैं भाई, इसे छोड़ रहे हैं...")
                    available_ids.remove(random_id)
                    continue
                
                opt1 = str(opt1)[:97] + "..." if len(str(opt1)) > 100 else str(opt1)
                opt2 = str(opt2)[:97] + "..." if len(str(opt2)) > 100 else str(opt2)
                opt3 = str(opt3)[:97] + "..." if len(str(opt3)) > 100 else str(opt3)
                opt4 = str(opt4)[:97] + "..." if len(str(opt4)) > 100 else str(opt4)
                
                try:
                    correct_idx = int(potential_q['correct_option']) - 1
                    if correct_idx < 0 or correct_idx > 3:
                        raise ValueError
                except (ValueError, TypeError, KeyError):
                    print(f"⚠️ ID {random_id} का correct_option इनवैलिड है, इसे छोड़ रहे हैं...")
                    available_ids.remove(random_id)
                    continue
                
                q = potential_q
                options = [opt1, opt2, opt3, opt4]
                break
            else:
                print(f"⚠️ ID {random_id} डेटाबेस में मिसिंग/डिलीटेड है भाई, दूसरी ID ट्राई कर रहे हैं...")
                available_ids.remove(random_id)

        if not q:
            print("❌ एरर: पूरे डेटाबेस में एक भी ऐसा सवाल नहीं मिला जो टेलीग्राम के रूल्स को पास कर सके!")
            return

        question_text = f"📝 Question of the Day:\n\n{q['question_text']}"
        if len(question_text) > 300:
            question_text = question_text[:297] + "..."

        explanation = q.get('explanation', 'HP Exam Pro पर अपनी तैयारी जारी रखें!')
        if not explanation:
            explanation = 'HP Exam Pro पर अपनी तैयारी जारी रखें!'
        if len(explanation) > 200:
            explanation = explanation[:197] + "..."

        from telegram import Bot
        bot = Bot(token=TELEGRAM_BOT_TOKEN)

        note_message = (
            "🚀 <b>Ready to crack your next Himachal Govt Exam?</b>\n\n"
            "Don't just guess, test yourself! Attempt full-length mock tests, track your daily streak, "
            "and compete on the live State Leaderboard.\n\n"
            "🌐 <b><a href='https://hp-exam-pro.vercel.app'>👉 Join HP Exam Pro Now</a></b>"
        )

        # 🟢 ENGINE 1: MAIN GROUP (Non-Anonymous Tracking)
        print("🚀 मेन ग्रुप पर Non-Anonymous क्विज़ भेज रहे हैं...")
        try:
            await bot.send_poll(
                chat_id=GROUP_USERNAME,
                question=question_text,
                options=options,
                is_anonymous=False,  # यहाँ फॉल्स ताकि आप वोटर्स देख सकें
                type="quiz",
                correct_option_id=correct_idx,
                explanation=explanation
            )
            await bot.send_message(
                chat_id=GROUP_USERNAME,
                text=note_message,
                parse_mode="HTML",
                disable_web_page_preview=False
            )
        except Exception as e:
            print(f"⚠️ ग्रुप में एरर: {e}")

        # 🟢 ENGINE 2: CHANNEL (Anonymous + Comment Forwarding)
        print("🚀 चैनल पर Anonymous क्विज़ भेज रहे हैं...")
        try:
            await bot.send_poll(
                chat_id=CHANNEL_USERNAME,
                question=question_text,
                options=options,
                is_anonymous=True,  # यहाँ ट्रू ताकि चैनल ब्लॉक ना करे
                type="quiz",
                correct_option_id=correct_idx,
                explanation=explanation
            )
            await bot.send_message(
                chat_id=CHANNEL_USERNAME,
                text=note_message,
                parse_mode="HTML",
                disable_web_page_preview=False
            )
        except Exception as e:
            print(f"⚠️ चैनल में एरर: {e}")
        
        print("🎉 आज का क्विज़ सफलतापूर्वक दोनों जगह (ग्रुप और चैनल) लाइव हो गया है!")

    except Exception as e:
        print(f"❌ बड़ा एरर आया भाई: {e}")

if __name__ == "__main__":
    asyncio.run(send_daily_quiz())
