import os
import random
import asyncio
from supabase import create_client

# ==================== CONFIGURATION (GitHub Secrets se data uthana) ====================
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHANNEL_USERNAME = os.environ.get("TELEGRAM_CHANNEL")
GROUP_USERNAME = os.environ.get("TELEGRAM_GROUP")
# ===================================================================================

async def send_daily_quiz():
    if not all([SUPABASE_URL, SUPABASE_KEY, TELEGRAM_BOT_TOKEN, CHANNEL_USERNAME, GROUP_USERNAME]):
        print("❌ Error: Kuch credentials missing hain! Kripya GitHub Settings check karein.")
        return

    # 1. Supabase client connect karna
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        # 🟢 ANTI-REPEAT STEP 1: Sirf wahi sawal lo jo abhi tak Telegram par post NAHI hue hain
        print("🔍 Un-posted sawalon ki list nikaal rahe hain...")
        id_response = supabase.table("questions").select("id").eq("posted_to_telegram", False).execute()
        
        available_ids = [row['id'] for row in id_response.data] if id_response.data else []
        
        # 🟢 ANTI-REPEAT STEP 2: Agar saare questions ek baar post ho chuke hain, toh cycle auto-reset karein
        if not available_ids:
            print("🔄 Saare questions ek baar post ho chuke hain! Cycle reset kar rahe hain...")
            supabase.table("questions").update({"posted_to_telegram": False}).neq("id", 0).execute()
            
            # Wapas fetch karein fresh cycle ke liye
            id_response = supabase.table("questions").select("id").eq("posted_to_telegram", False).execute()
            available_ids = [row['id'] for row in id_response.data] if id_response.data else []

        if not available_ids:
            print("❌ Error: Database mein koi sawal nahi mila!")
            return

        print(f"📊 Kul {len(available_ids)} un-posted sawal available hain.")
        
        q = None
        options = []
        correct_idx = 0
        
        while len(available_ids) > 0:
            random_id = random.choice(available_ids)
            print(f"🎯 Lottery mein chuni gayi ID: {random_id}")

            response = supabase.table("questions").select("*").eq("id", random_id).execute()
            
            if response.data and len(response.data) > 0:
                potential_q = response.data[0]
                
                opt1 = potential_q.get('opt1')
                opt2 = potential_q.get('opt2')
                opt3 = potential_q.get('opt3')
                opt4 = potential_q.get('opt4')
                
                if not (opt1 and opt2 and opt3 and opt4):
                    print(f"⚠️️ ID {random_id} ke kuch options missing hain, isse chhod kar next dekh rahe hain...")
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
                    print(f"⚠️ ID {random_id} ka correct_option invalid hai, isse chhod rahe hain...")
                    available_ids.remove(random_id)
                    continue
                
                q = potential_q
                options = [opt1, opt2, opt3, opt4]
                break
            else:
                available_ids.remove(random_id)

        if not q:
            print("❌ Error: Telegram rules pass karne wala koi sawal nahi mila!")
            return

        question_text = f"📝 Question of the Day:\n\n{q['question_text']}"
        if len(question_text) > 300:
            question_text = question_text[:297] + "..."

        explanation = q.get('explanation', 'HP Exam Pro par apni taiyari jaari rakhein!')
        if not explanation:
            explanation = 'HP Exam Pro par apni taiyari jaari rakhein!'
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

        # 🟢 ENGINE 1: MAIN GROUP
        print("🚀 Main Group par Non-Anonymous quiz bhej rahe hain...")
        try:
            await bot.send_poll(
                chat_id=GROUP_USERNAME,
                question=question_text,
                options=options,
                is_anonymous=False,
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
            print(f"⚠️ Group mein error: {e}")

        # 🟢 ENGINE 2: CHANNEL
        print("🚀 Channel par Anonymous quiz bhej rahe hain...")
        try:
            await bot.send_poll(
                chat_id=CHANNEL_USERNAME,
                question=question_text,
                options=options,
                is_anonymous=True,
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
            print(f"⚠️ Channel mein error: {e}")
        
        # 🟢 ANTI-REPEAT STEP 3: Successful post hone par database mein True mark karein
        supabase.table("questions").update({"posted_to_telegram": True}).eq("id", q['id']).execute()
        print(f"✅ Question ID #{q['id']} ko Telegram Posted mark kar diya gaya hai. Ab yeh repeat nahi hoga!")

    except Exception as e:
        print(f"❌ Bada error aaya: {e}")

if __name__ == "__main__":
    asyncio.run(send_daily_quiz())
