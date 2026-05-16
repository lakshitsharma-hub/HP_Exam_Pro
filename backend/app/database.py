import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class DatabaseManager:
    def __init__(self):
        url: str = os.getenv("SUPABASE_URL")
        key: str = os.getenv("SUPABASE_KEY")
        
        if not url or not key:
            print("Error: SUPABASE_URL or SUPABASE_KEY missing in .env")
            
        self.supabase: Client = create_client(url, key)

    def create_admin_entry(self):
        """खुद को एडमिन के तौर पर रजिस्टर करने के लिए टेस्ट फंक्शन"""
        admin_data = {
            "username": "Admin_Lakshit",
            "email": "lakshitsharma8080@gmail.com",
            "role": "admin",
            "is_premium": True
        }
        try:
            res = self.supabase.table("profiles").insert(admin_data).execute()
            return "Badhai ho! Admin entry successful."
        except Exception as e:
            return f"Database Error: {str(e)}"

    # --- NAYA CODE: PATWARI TEST GENERATOR ---
    def get_patwari_test(self):
        """पटवारी परीक्षा के लिए 120 रैंडम सवालों का सेट तैयार करना"""
        import random
        
        # Aapka bataya hua exact weightage
        weightage = [
            {"sub": "maths", "type": "direct", "limit": 20},
            {"sub": "all", "type": "statement", "limit": 10}, # Mix statement questions
            {"sub": "hindi", "type": "direct", "limit": 15},
            {"sub": "english", "type": "direct", "limit": 15},
            {"sub": "science", "type": "direct", "limit": 15},
            {"sub": "geography", "type": "direct", "limit": 5},
            {"sub": "polity", "type": "direct", "limit": 5},
            {"sub": "history", "type": "direct", "limit": 5},
            {"sub": "reasoning", "type": "direct", "limit": 7},
            {"sub": "hp_gk", "type": "direct", "limit": 5},
            {"sub": "current_affairs", "type": "direct", "limit": 8},
            {"sub": "computer", "type": "direct", "limit": 10}
        ]
        
        test_questions = []
        
        for item in weightage:
            try:
                # Jo RPC function humne banaya tha use call karna
                res = self.supabase.rpc("get_random_questions", {
                    "p_subject": item["sub"],
                    "p_q_type": item["type"],
                    "p_limit": item["limit"]
                }).execute()
                
                if res.data:
                    test_questions.extend(res.data)
            except Exception as e:
                print(f"Error fetching {item['sub']}: {e}")
                
        # Pure 120 sawalon ko aapas mein achhi tarah shuffle karna
        random.shuffle(test_questions)
        return test_questions

    # --- NAYA CODE: JOA IT TEST GENERATOR ---
    def get_joa_it_test(self):
        """JOA IT परीक्षा के लिए 120 रैंडम सवालों का सेट तैयार करना"""
        import random
        
        weightage = [
            {"sub": "computer", "type": "direct", "limit": 80},
            {"sub": "science", "type": "direct", "limit": 10},
            {"sub": "maths", "type": "direct", "limit": 10},
            {"sub": "hp_gk", "type": "direct", "limit": 5},
            {"sub": "reasoning", "type": "direct", "limit": 5},
            {"sub": "hindi", "type": "direct", "limit": 5},
            {"sub": "english", "type": "direct", "limit": 5}
        ]
        
        test_questions = []
        
        for item in weightage:
            try:
                res = self.supabase.rpc("get_random_questions", {
                    "p_subject": item["sub"],
                    "p_q_type": item["type"],
                    "p_limit": item["limit"]
                }).execute()
                
                if res.data:
                    test_questions.extend(res.data)
            except Exception as e:
                print(f"Error fetching {item['sub']}: {e}")
                
        random.shuffle(test_questions)
        return test_questions

# Exporting the database manager instance
db = DatabaseManager()
