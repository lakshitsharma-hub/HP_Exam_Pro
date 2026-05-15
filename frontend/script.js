// --- 1. SUPABASE CONNECTION ---
// आपकी इमेज (15713dfd-1f5e-4752-840e-efaed9d9eccf) से ली गई चाबियाँ
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"; 
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// --- 2. AUTHENTICATION (Login/Signup) ---
async function handleSignup() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        document.getElementById('auth-error').innerText = "Signup Error: " + error.message;
    } else {
        alert("Registration Successfull ! Please Check Your Email।");
    }
}

async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        document.getElementById('auth-error').innerText = "Login Error: " + error.message;
    } else {
        checkUserSession(); 
    }
}

async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        document.getElementById('auth-overlay').style.display = 'none';
        setupUserProfile(session.user);
    }
}

async function setupUserProfile(user) {
    // 1. सुरक्षा जाँच
    if (!user) {
        console.error("यूजर लॉगिन नहीं है!");
        return;
    }

    // 2. डेटाबेस से प्रोफाइल मांगें (maybeSingle() इस्तेमाल करें ताकि एरर न आए)
    let { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
    const today = new Date().toDateString();

    // 3. अगर प्रोफाइल नहीं है, तो नया बनाएँ
    if (!profile) {
        const userName = user.email.split('@')[0];
        const { data: newProfile } = await supabaseClient.from('profiles').insert([
            { id: user.id, display_name: userName, daily_count: 0, last_active: today }
        ]).select().single();
        profile = newProfile;
    } 
    // 4. अगर नया दिन है, तो डेली काउंट रीसेट करें
    else if (profile.last_active !== today) {
        const { data: updatedProfile } = await supabaseClient.from('profiles')
            .update({ daily_count: 0, last_active: today })
            .eq('id', user.id)
            .select().single();
        profile = updatedProfile;
    }

    // 5. ✨ सारा UI अपडेट अब यहाँ फंक्शन के अंदर होगा ✨
    if (profile) {
        // 'नमस्ते' वाला टेक्स्ट अपडेट करें
        const welcomeText = document.getElementById('welcome-text');
        if (welcomeText) {
            welcomeText.innerText = `नमस्ते, ${profile.display_name}`;
        }

        // साइडबार या हेडर में नाम और पहला अक्षर (Initial) दिखाएँ
        const displayNameEl = document.getElementById('display-name');
        const userInitialEl = document.getElementById('user-initial');
        
        if (displayNameEl) displayNameEl.innerText = profile.display_name;
        if (userInitialEl) userInitialEl.innerText = profile.display_name[0].toUpperCase();

        // इसे ग्लोबल वेरिएबल में रखें ताकि बाद में काम आए
        window.CURRENT_USER_PROFILE = profile;

        // 6. एआई का स्वागत संदेश (अगर चैट खाली है)
        if (typeof messagesDiv !== 'undefined' && messagesDiv.innerHTML.trim() === "") {
            appendMessage(`नमस्ते ${profile.display_name}! आज हम हिमाचल की किस परीक्षा (Patwari, HPAS या Allied) की तैयारी करें?`, 'ai');
        }
    }
}

// --- 3. PAGE LOGIC & NEWS ---
window.onload = () => {
    checkUserSession();
    
    // Countdown
    const examDate = new Date("2026-06-07");
    const diff = Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24));
    document.getElementById('patwari-countdown').innerText = diff > 0 ? diff + " Days Left" : "Exam Today!";

    // Current Affairs Mock Data
    const news = [
        "हिमाचल की 'कांगड़ा चाय' को यूरोपीय संघ (EU) का PGI टैग मिला है।",
        "अटल टनल दुनिया की सबसे लंबी राजमार्ग सुरंग है (10,000 फीट)।",
        "सतलुज नदी शिपकी ला दर्रे से हिमाचल में प्रवेश करती है।"
    ];
    document.getElementById('current-affairs-text').innerText = news[Math.floor(Math.random() * news.length)];
};

// Sidebar Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const pageId = item.getAttribute('data-page');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
        document.getElementById(`${pageId}-page`)?.classList.add('active');
    });
});

// --- 4. CHAT SYSTEM ---
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || !window.CURRENT_USER_PROFILE) return;

    // ... (बाकी का लिमिट चेक करने वाला कोड) ...

    appendMessage(text, 'user');
    userInput.value = '';
    const loaderId = addLoader();

    try {
        // यहाँ हमने localhost की जगह आपकी IP (https://hp-exam-pro.onrender.com) डाल दी है
        const response = await fetch('https://hp-exam-pro.onrender.com/api/chat', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        
        const data = await response.json();
        removeLoader(loaderId);
        appendMessage(data.answer, 'ai');

        // सुपबेस अपडेट लॉजिक
        const newCount = window.CURRENT_USER_PROFILE.daily_count + 1;
        await supabaseClient.from('profiles').update({ daily_count: newCount }).eq('id', window.CURRENT_USER_PROFILE.id);
        window.CURRENT_USER_PROFILE.daily_count = newCount;

    } catch (e) {
        removeLoader(loaderId);
        console.error(e);
        appendMessage("सर्वर एरर! क्या आपने Backend को --host 0.0.0.0 के साथ चलाया है?", 'ai');
    }
}


function appendMessage(text, sender) {
    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${sender}`;
    const avatar = sender === 'user' ? `<div class="avatar" style="background:#2563eb; color:white; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">${window.CURRENT_USER_PROFILE.display_name[0].toUpperCase()}</div>` : '🤖';
    wrap.innerHTML = `${avatar}<div class="bubble">${text.replace(/\n/g, '<br>')}</div>`;
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addLoader() {
    const id = 'l-' + Date.now();
    const div = document.createElement('div');
    div.id = id; div.className = 'message-wrapper ai';
    div.innerHTML = `🤖<div class="bubble"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    messagesDiv.appendChild(div);
    return id;
}

function removeLoader(id) { document.getElementById(id)?.remove(); }

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
// Password Toggle Logic
document.getElementById('togglePassword').addEventListener('click', function () {
    const passwordInput = document.getElementById('auth-pass');
    
    // इनपुट टाइप बदलें
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // आइकॉन बदलें (Eye <-> Eye Slash)
    this.classList.toggle('fa-eye-slash');
});
