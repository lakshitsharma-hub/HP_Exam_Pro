// --- 1. SUPABASE CONNECTION ---
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"; 
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// --- 2. AUTHENTICATION (Login/Signup ) ---
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

// 1. लॉगिन हैंडलर
async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        document.getElementById('auth-error').innerText = "Login Error: " + error.message;
    } else {
        // लॉगिन सफल होने पर सेशन चेक करें
        checkUserSession();
    }
}

async function setupUserProfile(user) {
    // 1. डेटाबेस से प्रोफाइल मंगवाएं
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error("Profile Load Error:", error);
        return;
    }

    if (profile) {
        // --- 2. एडमिन चेक यहाँ डालें ---
        if (profile.is_admin === true) {
            const adminBtn = document.getElementById('admin-link');
            if (adminBtn) {
                adminBtn.style.display = 'block'; // एडमिन है तो बटन दिखा दो
                console.log("Admin access granted! 👑");
            }
        }
        
        // आपका पुराना क्राउन (Crown) और नाम दिखाने वाला कोड इसके नीचे चलता रहेगा
        // updateUI(profile); 
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

        // 👉 यहाँ Pro Status चेक किया जा रहा है
        checkProStatus(profile);

        // 6. एआई का स्वागत संदेश (अगर चैट खाली है)
        if (typeof messagesDiv !== 'undefined' && messagesDiv.innerHTML.trim() === "") {
            appendMessage(`नमस्ते ${profile.display_name}! आज हम हिमाचल की किस परीक्षा (Patwari, HPAS या Allied) की तैयारी करें?`, 'ai');
        }
    }
}

// 👉 नया फंक्शन: यह चेक करेगा और UI को Pro वाला लुक देगा
function checkProStatus(profile) {
    if (profile.is_pro === true) {
        // 1. डेस्कटॉप साइडबार से Pro लिंक छुपाएँ
        const desktopProLink = document.querySelector('.pro-link');
        if (desktopProLink) desktopProLink.style.display = 'none';

        // 2. मोबाइल साइडबार से Pro लिंक छुपाएँ
        const mobileLinks = document.querySelectorAll('#mobile-sidebar a');
        mobileLinks.forEach(link => {
            if (link.innerText.includes('Get Pro Access')) {
                link.style.display = 'none';
            }
        });

        // 3. नाम के आगे गोल्डन क्राउन लगाएँ
        const nameElement = document.getElementById('display-name');
        if (nameElement && !nameElement.innerHTML.includes('fa-crown')) {
            nameElement.innerHTML += ' <i class="fa-solid fa-crown" style="color: #f59e0b; margin-left: 6px; font-size: 12px;" title="Pro User"></i>';
        }
    }
}

// --- 3. PAGE LOGIC & NEWS ---
window.onload = () => {
    checkUserSession();
    
    // Countdown Logic (वही रहेगा)
    const examDate = new Date("2026-06-07");
    const diff = Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24));
    document.getElementById('patwari-countdown').innerText = diff > 0 ? diff + " Days Left" : "Exam Today!";

    // असली न्यूज़ लोड करने का फंक्शन
    loadRealNews();
};
async function loadRealNews() {
    const newsTextEl = document.getElementById('current-affairs-text');
    if (!newsTextEl) return;

    try {
        // यहाँ हमने 'https' और सही लिंक का इस्तेमाल किया है
        const response = await fetch('https://hp-exam-pro.onrender.com/api/news?t=' + Date.now(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error("API Response Error");

        const data = await response.json();
        
        // चेक करें कि क्या न्यूज़ का एरे (Array) मौजूद है
        if (data.news && data.news.length > 0) {
            let i = 0;
            // पहली न्यूज़ दिखाएँ
            newsTextEl.innerText = data.news[0];
            
            // हर 8 सेकंड में अगली न्यूज़ दिखाएँ (स्मूथ ट्रांज़िशन के साथ)
            setInterval(() => {
                i = (i + 1) % data.news.length;
                newsTextEl.style.opacity = 0;
                setTimeout(() => {
                    newsTextEl.innerText = data.news[i];
                    newsTextEl.style.opacity = 1;
                }, 500);
            }, 8000);
        }
    } catch (e) {
        console.error("News Load Error:", e);
        // अगर फिर भी न चले, तो कम से कम ये दिखे (ताकि खाली न रहे)
        newsTextEl.innerText = "नगर निकायों के लिए प्रचार थमा, ताज़ा खबरों के लिए रिफ्रेश करें।";
    }
}


//--CHAT
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || !window.CURRENT_USER_PROFILE) return;

    appendMessage(text, 'user');
    userInput.value = '';
    const loaderId = addLoader();

    try {
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
    const avatar = sender === 'user' 
        ? `<div class="avatar" style="background:#2563eb; color:white; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">${window.CURRENT_USER_PROFILE.display_name[0].toUpperCase()}</div>` 
        : `<div class="bot-avatar-logo"><div class="mountain-peak"></div><div class="book-base"></div></div>`;
    
    // अगर भेजने वाला 'ai' है, तो 'marked' का इस्तेमाल करें
    const content = sender === 'ai' ? marked.parse(text) : text.replace(/\n/g, '<br>');
    wrap.innerHTML = `${avatar}<div class="bubble">${content}</div>`;
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function toggleMenu() {
    const menu = document.getElementById('mobile-sidebar');
    if (menu.style.display === 'flex') {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'flex';
    }
}

function addLoader() {
    const id = 'l-' + Date.now();
    const div = document.createElement('div');
    div.id = id; div.className = 'message-wrapper ai';
    
    // 👉 यहाँ पुराना 🤖 हटाकर नया लोगो डाला गया है
    const botLogo = `<div class="bot-avatar-logo"><div class="mountain-peak"></div><div class="book-base"></div></div>`;
    
    div.innerHTML = `${botLogo}<div class="bubble"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    messagesDiv.appendChild(div);
    
    // जब लोडर आए, तो भी स्क्रॉल नीचे जाए
    messagesDiv.scrollTop = messagesDiv.scrollHeight; 
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
