import os
from supabase import create_client, Client
from dotenv import load_dotenv

# .env से चाबियाँ लोड करना
load_dotenv()

class DatabaseManager:
    def __init__(self):
        url: str = os.getenv("SUPABASE_URL")
        key: str = os.getenv("SUPABASE_KEY")
        
        # अगर .env में चाबियाँ नहीं मिलीं तो एरर देगा
        if not url or not key:
            print("Error: SUPABASE_URL or SUPABASE_KEY missing in .env")
            
        # Supabase क्लाइंट सेट करना
        self.supabase: Client = create_client(url, key)

    def create_admin_entry(self):
        """खुद को एडमिन के तौर पर रजिस्टर करने के लिए एक टेस्ट फंक्शन"""
        admin_data = {
            "username": "Admin_Lakshit",
            "email": "lakshitsharma8080@gmail.com",
            "role": "admin",
            "is_premium": True
        }
        try:
            # profiles टेबल में डेटा डालना
            # .execute() डेटा को क्लाउड पर भेजता है
            res = self.supabase.table("profiles").insert(admin_data).execute()
            return "Badhai ho! Admin entry successful."
        except Exception as e:
            return f"Database Error: {str(e)}"

# इसे बाहर भेजने (export) के लिए ताकि main.py इसे इस्तेमाल कर सके
db = DatabaseManager()
