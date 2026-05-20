import random
import asyncio
from supabase import create_client

# ==================== CONFIGURATION (यहाँ अपनी डिटेल्स डालें) ====================
SUPABASE_URL = "YOUR_SUPABASE_URL"          # अपना सुपाबेस URL यहाँ डालें
SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"     # अपना सुपाबेस ANON API Key (anon public) यहाँ डालें
TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN"       # @BotFather से मिला लंबा टोकन यहाँ डालें
CHANNEL_USERNAME = "@your_channel_username" # अपने टेलीग्राम चैनल का @ यूजरनेम यहाँ डालें
# ==============================================================================

async def send_daily_quiz():
    # 1. Supabase क्लाइंट कनेक्ट करना
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        print("🔍 डेटाबेस से सभी एक्टिव IDs की लिस्ट निकाल रहे हैं...")
        # सिर्फ id कॉलम मांग रहे हैं ताकि बीच की मिसिंग या डिलीटेड आईडी का झंझट खत्म हो जाए
        id_response = supabase.table("questions").select("id").execute()
        
        if not id_response.data:
            print("❌ डेटाबेस में कोई सवाल नहीं मिला!")
            return
            
        # सभी उपलब्ध IDs की एक शुद्ध लिस्ट बनाना (जैसे: [1, 2, 4, 7, ... 3998])
        available_ids = [row['id'] for row in id_response.data]
        print(f"📊 कुल {len(available_ids)} सवाल एक्टिव मिले।")
        
        # 2. इस असली लिस्ट में से रैंडमली एक ID चुनना (लॉटरी सिस्टम)
        random_id = random.choice(available_ids)
        print(f"🎯 लॉटरी में चुनी गई ID: {random_id}")

        # 3. अब उस सटीक ID का पूरा सवाल डेटाबेस से उठाना
        response = supabase.table("questions").select("*").eq("id", random_id).execute()
        
        if not response.data:
            print("⚠️ यह सवाल नहीं मिल सका, दोबारा प्रयास करें।")
            return

        q = response.data[0]
        
        # सवाल का टेक्स्ट तैयार करना
        question_text = f"📝 Question of the Day:\n\n{q['question_text']}"
        
        # चारों ऑप्शंस की लिस्ट
        options = [q['opt1'], q['opt2'], q['opt3'], q['opt4']]
        
        # सुपाबेस में अगर correct_option 1,2,3,4 है तो टेलीग्राम के लिए उसे 0,1,2,3 इंडेक्स बनाना होगा
        correct_idx = int(q['correct_option']) - 1 
        
        # व्याख्या (Explanation) तैयार करना
        explanation = q.get('explanation', 'HP Exam Pro पर अपनी तैयारी जारी रखें!')
        # टेलीग्राम में एक्सप्लेनेशन की लिमिट 200 अक्षरों की होती है, इसलिए सेफ साइड रहने के लिए ट्रिम कर रहे हैं
        if len(explanation) > 200:
            explanation = explanation[:197] + "..."

        # 4. Telegram Bot इनिशियलाइज़ करना (v20+ standard)
        from telegram import Bot
        bot = Bot(token=TELEGRAM_BOT_TOKEN)

        # 5. पहले असली Quiz (Poll) पोस्ट करना
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

        # 6. तुरंत बाद नीचे लिंक वाला सुंदर नोट मैसेज भेजना (2nd Option)
        note_message = (
            "📢 *Note:* रोज़ ऐसे ही प्रीमियम हिमाचल एग्जाम्स (Patwari, JOA IT) के मॉक टेस्ट देने के लिए "
            "और अपनी स्टेट रैंक चेक करने के लिए अभी हमारी ऑफिशियल वेबसाइट पर विजिट करें:\n\n"
            "🌐 *[👉 यहाँ क्लिक करें: HP Exam Pro](https://hp-exam-pro.vercel.app)*"
        )

        print("🔗 क्विज़ के नीचे वेबसाइट लिंक का नोट भेज रहे हैं...")
        await bot.send_message(
            chat_id=CHANNEL_USERNAME,
            text=note_message,
            parse_mode="Markdown",
            disable_web_page_preview=False  # इससे वेबसाइट का सुंदर सा कार्ड (Link Preview) दिखेगा
        )
        
        print("🎉 आज का क्विज़ और लिंक सफलतापूर्वक टेलीग्राम पर लाइव हो गया है!")

    except Exception as e:
        print(f"❌ एरर आया भाई: {e}")

# स्क्रिप्ट को रन करना
if __name__ == "__main__":
    asyncio.run(send_daily_quiz())
