import os
import random
import asyncio
from supabase import create_client

# ==================== CONFIGURATION (GitHub Secrets से डेटा उठाना) ====================
# यह कोड अपने आप गिटहब के लॉकर से तुम्हारी चाबियाँ (Keys) निकाल लेगा
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
            print("❌ डेटाबेस में कोई सवाल नहीं मिला!")
            return
            
        available_ids = [row['id'] for row in id_response.data]
        print(f"📊 कुल {len(available_ids)} सवाल एक्टिव मिले।")
        
        # 2. रैंडम ID चुनना
        random_id = random.choice(available_ids)
        print(f"🎯 लॉटरी में चुनी गई ID: {random_id}")

        # 3. सवाल उठाना
        response = supabase.table("questions").select("*").eq("id", random_id).execute()
        
        if not response.data:
            print("⚠️ यह सवाल नहीं मिल सका।")
            return

        q = response.data[0]
        question_text = f"📝 Question of the Day:\n\n{q['question_text']}"
        options = [q['opt1'], q['opt2'], q['opt3'], q['opt4']]
        correct_idx = int(q['correct_option']) - 1 
        
        explanation = q.get('explanation', 'HP Exam Pro पर अपनी तैयारी जारी रखें!')
        if len(explanation) > 200:
            explanation = explanation[:197] + "..."

        # 4. Telegram Bot इनिशियलाइज़ करना
        from telegram import Bot
        bot = Bot(token=TELEGRAM_BOT_TOKEN)

        # 5. क्विज़ पोस्ट करना
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
        # # 6. नीचे वेबसाइट लिंक का नोट भेजना
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
