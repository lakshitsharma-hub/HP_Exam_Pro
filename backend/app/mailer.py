import os
import requests

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "hpexamproai@gmail.com")
SUPPORT_URL = "https://hp-exam-pro.vercel.app/support.html"
TELEGRAM_URL = "https://t.me/HPEXAM_PRO"

import os
import requests

BREVO_API_KEY = os.getenv("BREVO_API_KEY", "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")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "hpexamproai@gmail.com")
SUPPORT_URL = "https://hp-exam-pro.vercel.app/support.html"
TELEGRAM_URL = "https://t.me/HPEXAM_PRO"

def send_email(to_email: str, subject: str, html_body: str):
    # Strip any extra spaces from the key
    clean_key = BREVO_API_KEY.strip() if BREVO_API_KEY else ""

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": clean_key,
        "accept": "application/json",
        "content-type": "application/json"
    }
    payload = {
        "sender": {
            "name": "HP Exam Pro",
            "email": SENDER_EMAIL.strip()
        },
        "to": [
            {
                "email": to_email.strip()
            }
        ],
        "subject": subject,
        "htmlContent": html_body
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        if response.status_code in [200, 201]:
            print(f"✅ Email delivered successfully to {to_email}")
            return True
        else:
            print(f"❌ Brevo API Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ HTTP Request Error: {e}")
        return False
# 1. Registration / Welcome Template
def get_welcome_html(name: str):
    return f"""
    <div style="font-family: Arial, sans-serif; background: #0f172a; color: #ffffff; padding: 25px; border-radius: 12px; max-width: 600px; margin: auto;">
        <h2 style="color: #38bdf8; margin-top: 0;">Welcome to HP Exam Pro, {name}! 🚀</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Your account has been successfully created. You can now access exam-standard mock tests, real-time 1v1 Battle Arena challenges, and daily practice sets tailored for Himachal Pradesh competitive examinations.
        </p>
        <div style="margin: 25px 0;">
            <a href="https://hp-exam-pro.vercel.app" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
                Start Practice Now 🎯
            </a>
        </div>
        <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(56, 189, 248, 0.2); padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #38bdf8;">📢 Join Our Telegram Aspirants Community</p>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #94a3b8;">
                Get daily GK updates, exam notifications, study notes, and discuss questions with fellow aspirants.
            </p>
            <a href="{TELEGRAM_URL}" target="_blank" style="display: inline-block; padding: 8px 16px; background: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold;">
                Join Telegram Channel 💬
            </a>
        </div>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">
            Have a question or facing an issue? <a href="{SUPPORT_URL}" style="color: #38bdf8; text-decoration: none;">Submit a Support Query</a>
        </p>
    </div>
    """

# 2. Pro Membership Activation Template
def get_pro_html(name: str):
    return f"""
    <div style="font-family: Arial, sans-serif; background: #0f172a; color: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #eab308; max-width: 600px; margin: auto;">
        <h2 style="color: #facc15; margin-top: 0;">👑 Pro Access Activated!</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Hello {name}, your Pro membership is now live! All premium mock test series, detailed solution breakdowns, and advanced performance metrics have been unlocked.
        </p>
        <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #e2e8f0; line-height: 1.8;">
            ✔ Unlimited Full-Length Mock Tests<br>
            ✔ Complete Question Explanations & Analytics<br>
            ✔ Priority Evaluation & Support
        </div>
        <div style="margin: 20px 0;">
            <a href="https://hp-exam-pro.vercel.app" style="display: inline-block; padding: 12px 24px; background: #eab308; color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
                Go to Workspace 🚀
            </a>
        </div>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">
            Need help or have billing queries? <a href="{SUPPORT_URL}" style="color: #facc15; text-decoration: none;">Contact Support Team</a>
        </p>
    </div>
    """

# 3. 15-Day Inactivity Reminder Template
def get_inactive_html(name: str):
    return f"""
    <div style="font-family: Arial, sans-serif; background: #0f172a; color: #ffffff; padding: 25px; border-radius: 12px; max-width: 600px; margin: auto;">
        <h2 style="color: #f87171; margin-top: 0;">We Miss You on HP Exam Pro! 🔥</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Hello {name}, it looks like you haven't attempted any mock tests or practice quizzes over the past 15 days. Consistency is key to clearing competitive exams.
        </p>
        <p style="color: #cbd5e1; font-size: 14px;">
            Fresh questions, updated HP GK modules, and recent current affairs sets are now live on the platform.
        </p>
        <div style="margin: 25px 0;">
            <a href="https://hp-exam-pro.vercel.app" style="display: inline-block; padding: 12px 24px; background: #22c55e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
                Resume Daily Practice ⚡
            </a>
        </div>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">
            Facing technical issues or have feedback? <a href="{SUPPORT_URL}" style="color: #38bdf8; text-decoration: none;">Raise a Query</a>
        </p>
    </div>
    """
