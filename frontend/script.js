// --- 1. SUPABASE CONNECTION ---
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"; 
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// --- 2. GLOBAL VARIABLES ---
let currentQuestions = [];  // 🔥 इसे ठीक कर दिया गया है    
let currentQuestionIndex = 0;   
let userAnswers = {};           
let quizTimerInterval = null;   
let totalQuizTimeSeconds = 5400; 
let selectedExamType = "";      
let currentUserId = ""; 

// --- 3. AUTHENTICATION (Login/Signup) ---
// ==================== NEW AUTH SYSTEM (Google, Tabs & Loader) ====================

let currentAuthMode = 'login'; 

// 1. Google Login
async function loginWithGoogle() {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) alert("Google Login Error: " + error.message);
}

// 2. Tab Switcher
function switchAuthTab(mode) {
    currentAuthMode = mode;
    const btn = document.getElementById('main-auth-btn');
    const forgotLink = document.getElementById('forgot-pass-container');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const errorMsg = document.getElementById('auth-error');

    errorMsg.style.display = 'none';
    document.getElementById('auth-pass').value = '';

    if (mode === 'login') {
        btn.innerText = "Login";
        forgotLink.style.display = "block"; 
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
    } else {
        btn.innerText = "Sign Up";
        forgotLink.style.display = "none"; 
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
    }
}

// 3. Button Click Loader
async function handleAuthAction() {
    const btn = document.getElementById('main-auth-btn');
    const errorMsg = document.getElementById('auth-error');
    const originalText = btn.innerText;

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
    btn.disabled = true;
    btn.style.opacity = "0.7";
    errorMsg.style.display = 'none';

    try {
        if (currentAuthMode === 'login') {
            await handleLogin(); 
        } else {
            await handleSignup(); 
        }
    } catch (err) {
        console.error(err);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}

// 4. Trigger Forgot Password
function triggerForgotPassword() {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) {
        const err = document.getElementById('auth-error');
        err.innerText = "पासवर्ड रीसेट करने के लिए पहले अपना ईमेल भरें!";
        err.style.display = 'block';
        return;
    }
    handleForgotPassword(email); 
}
// =================================================================================
async function handleSignup() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-pass').value.trim();

    if (!email || !password) {
        document.getElementById('auth-error').innerText = "कृपया ईमेल और पासवर्ड दोनों भरें!";
        return; 
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        document.getElementById('auth-error').innerText = "Signup Error: " + error.message;
    } else {
        alert("Registration Successful! Aapka account ban gya hai.");
    }
}

async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        // Checking if the password entered is incorrect
        if (error.message === "Invalid login credentials") {
            const askReset = confirm("❌ Incorrect password! Would you like to receive a secure password reset link on your registered email?");
            
            if (askReset) {
                // If user clicks OK, this will send the reset link
                handleForgotPassword(email); 
            }
        } else {
            document.getElementById('auth-error').innerText = "Login Error: " + error.message;
        }
    } else {
        checkUserSession();
    }
}

async function handleLogout() {
    const confirmLogout = confirm("क्या आप सच में Logout करना चाहते हैं?");
    if (!confirmLogout) return;

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert("Logout Error: " + error.message);
    } else {
        // लॉगआउट होते ही पेज को रिफ्रेश कर दो, ताकि वापस लॉगिन स्क्रीन आ जाए
        window.location.reload();
    }
}



async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.style.display = 'none';
        setupUserProfile(session.user);
    }
}

async function setupUserProfile(user) {
    if (!user) return;
    currentUserId = user.id; // 🔥 यूजर आईडी सेट कर दी

    let { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
    const today = new Date().toDateString();

    if (!profile) {
        const userName = user.email.split('@')[0];
        const { data: newProfile } = await supabaseClient.from('profiles').insert([
            { id: user.id, display_name: userName, daily_count: 0, last_active: today, is_admin: false, is_pro: false }
        ]).select().single();
        profile = newProfile;
    } else if (profile.last_active !== today) {
        const { data: updatedProfile } = await supabaseClient.from('profiles')
            .update({ daily_count: 0, last_active: today })
            .eq('id', user.id)
            .select().single();
        profile = updatedProfile;
    }

    if (profile) {
        window.CURRENT_USER_PROFILE = profile;

        // Admin Check
        if (profile.is_admin === true) {
            const desktopAdminItem = document.querySelector('.nav-item[data-page="admin"]');
            const mobileAdminLink = document.querySelector('#mobile-sidebar a[href="admin.html"]');
            [desktopAdminItem, mobileAdminLink].forEach(element => {
                if (element) {
                    element.style.display = 'flex'; 
                    element.onclick = (e) => {
                        e.preventDefault();
                        window.location.href = 'admin.html';
                    };
                }
            });
        }

        // Pro Check
        checkProStatus(profile);

        // UI Updates
        const welcomeText = document.getElementById('welcome-text');
        if (welcomeText) welcomeText.innerText = `नमस्ते, ${profile.display_name}`;

        const displayNameEl = document.getElementById('display-name');
        const userInitialEl = document.getElementById('user-initial');
        if (displayNameEl) displayNameEl.innerText = profile.display_name;
        if (userInitialEl) userInitialEl.innerText = profile.display_name[0].toUpperCase();

        if (messagesDiv && messagesDiv.innerHTML.trim() === "") {
            appendMessage(`नमस्ते ${profile.display_name}! आज हम हिमाचल की किस परीक्षा (Patwari, HPAS या Allied) की तैयारी करें?`, 'ai');
        }
    }
}

function checkProStatus(profile) {
    if (profile.is_pro === true) {
        const desktopProLink = document.querySelector('.pro-link');
        if (desktopProLink) desktopProLink.style.display = 'none';

        const mobileLinks = document.querySelectorAll('#mobile-sidebar a');
        mobileLinks.forEach(link => {
            if (link.innerText.includes('Get Pro Access')) link.style.display = 'none';
        });

        const nameElement = document.getElementById('display-name');
        if (nameElement && !nameElement.innerHTML.includes('fa-crown')) {
            nameElement.innerHTML += ' <i class="fa-solid fa-crown" style="color: #f59e0b; margin-left: 6px; font-size: 12px;" title="Pro User"></i>';
        }
    }
}

// --- 4. NEWS & CHAT LOGIC ---
window.onload = () => {
    checkUserSession();
    const examDate = new Date("2026-06-07");
    const diff = Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24));
    const countdownEl = document.getElementById('patwari-countdown');
    //if(countdownEl) countdownEl.innerText = diff > 0 ? diff + " Days Left" : "Exam Today!";
    if(countdownEl) countdownEl.innerText = "Coming Soon";
    loadRealNews();
};

async function loadRealNews() {
    const newsTextEl = document.getElementById('current-affairs-text');
    if (!newsTextEl) return;
    try {
        const response = await fetch('https://hp-exam-pro-dixk.onrender.com/api/news?t=' + Date.now());
        if (!response.ok) throw new Error("API Error");
        const data = await response.json();
        
        if (data.news && data.news.length > 0) {
            let i = 0;
            newsTextEl.innerText = data.news[0];
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
        newsTextEl.innerText = "ताज़ा खबरों के लिए रिफ्रेश करें।";
    }
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || !window.CURRENT_USER_PROFILE) return;

    appendMessage(text, 'user');
    userInput.value = '';
    const loaderId = addLoader();

    try {
        const response = await fetch('https://hp-exam-pro-dixk.onrender.com/api/chat', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        
        const data = await response.json();
        removeLoader(loaderId);
        appendMessage(data.answer, 'ai');

        const newCount = window.CURRENT_USER_PROFILE.daily_count + 1;
        await supabaseClient.from('profiles').update({ daily_count: newCount }).eq('id', window.CURRENT_USER_PROFILE.id);
        window.CURRENT_USER_PROFILE.daily_count = newCount;

    } catch (e) {
        removeLoader(loaderId);
        appendMessage("सर्वर एरer! कृपया बाद में प्रयास करें।", 'ai');
    }
}

function appendMessage(text, sender) {
    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${sender}`;
    
    // 🎯 FIX: AI अवतार को डार्क सर्कुलर बैकग्राउंड दिया गया है ताकि व्हाइट बेस गायब न हो
    const avatar = sender === 'user' 
        ? `<div class="avatar" style="background:#2563eb; color:white; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">${window.CURRENT_USER_PROFILE.display_name[0].toUpperCase()}</div>` 
        : `<div class="bot-avatar-container" style="background: #1e293b; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><div class="bot-avatar-logo" style="display: flex; flex-direction: column; align-items: center; transform: scale(0.85);"><div class="mountain-peak"></div><div class="book-base"></div></div></div>`;
    
    const content = sender === 'ai' ? marked.parse(text) : text.replace(/\n/g, '<br>');
    wrap.innerHTML = `${avatar}<div class="bubble">${content}</div>`;
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addLoader() {
    const id = 'l-' + Date.now();
    const div = document.createElement('div');
    div.id = id; 
    div.className = 'message-wrapper ai';
    
    // 🎯 FIX: यहाँ भी लोडर वाले लोगो को सेम डार्क थीम कंटेनर में रैप किया गया है
    const botLogo = `<div class="bot-avatar-container" style="background: #1e293b; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><div class="bot-avatar-logo" style="display: flex; flex-direction: column; align-items: center; transform: scale(0.85);"><div class="mountain-peak"></div><div class="book-base"></div></div></div>`;
    
    div.innerHTML = `${botLogo}<div class="bubble"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; 
    return id;
}


function removeLoader(id) { document.getElementById(id)?.remove(); }

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());

document.getElementById('togglePassword').addEventListener('click', function () {
    const passwordInput = document.getElementById('auth-pass');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.classList.toggle('fa-eye-slash');
});


// ==================== 5. LIVE QUIZ ENGINE & TIMED TEST ====================

// A. बैकएंड से असली सवाल लेकर टेस्ट शुरू करना (प्रीमियम लोडिंग एनीमेशन के साथ)
async function startMockTest(examType) {
    selectedExamType = examType;
    const userId = currentUserId || window.CURRENT_USER_PROFILE?.id || "test-user-123";
    
    // ⏳ 1. डबल क्लिक को रोकने के लिए एग्जाम कार्ड के बटन्स को तुरंत डिसेबल करें
    const examButtons = document.querySelectorAll('.exam-card button');
    examButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = "0.5";
    });
    
    // ⏳ 2. स्क्रीन पर एक खूबसूरत प्रीमियम ब्लर लोडिंग स्क्रीन इंजेक्ट करें
    const loaderOverlay = document.createElement('div');
    loaderOverlay.id = 'quiz-cloud-loader';
    loaderOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.85); display: flex; flex-direction: column;
        align-items: center; justify-content: center; z-index: 9999; color: white;
        font-family: 'Plus Jakarta Sans', sans-serif; backdrop-filter: blur(5px);
        transition: all 0.3s ease;
    `;
    loaderOverlay.innerHTML = `
        <div style="border: 4px solid #1e293b; border-top: 4px solid #38bdf8; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
        <h3 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.5px;">HP Cloud Server से सवाल निकाले जा रहे हैं...</h3>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 8px; margin-bottom: 0;">कृपया प्रतीक्षा करें, 120 सवालों का सटीक वेटेज सेट किया जा रहा है ⏳</p>
        <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
    `;
    document.body.appendChild(loaderOverlay);
    
    const titleEl = document.getElementById('quiz-exam-title');
    if (titleEl) {
            if (examType === 'patwari') titleEl.innerText = 'Patwari Exam Mode';
            else if (examType === 'hp_police') titleEl.innerText = 'HP Police Exam Mode';
            else titleEl.innerText = 'JOA IT Exam Mode';
        }
    
    try {
            let data = null;

            // 🟢 NAYA LOGIC: चेक करें कि क्या यूज़र Re-attempt कर रहा है?
            if (window.reAttemptQuestions) {
                data = window.reAttemptQuestions;
                window.reAttemptQuestions = null; // इस्तेमाल के बाद इसे खाली कर दें
                
                // लोडिंग स्क्रीन हटाएं और बटन्स चालू करें (बिना Fetch किए)
                if (document.getElementById('quiz-cloud-loader')) document.getElementById('quiz-cloud-loader').remove();
                examButtons.forEach(btn => { btn.disabled = false; btn.style.opacity = "1"; });
            } 
            else {
                // 🟢 PURANA LOGIC: अगर नया टेस्ट है, तो बैकएंड से फेच करें
                const response = await fetch(`https://hp-exam-pro-dixk.onrender.com/api/questions/${examType}?user_id=${userId}&t=${Date.now()}`);

                // डेटा आते ही लोडिंग ओवरले को स्क्रीन से तुरंत हटा दें
                if (document.getElementById('quiz-cloud-loader')) document.getElementById('quiz-cloud-loader').remove();

                // बटन्स को वापस नॉर्मल स्टेट में लाएं
                examButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = "1";
                });

                // Pro Feature (403 Error) चेकिंग
                if (response.status === 403) {
                    const errorData = await response.json();
                    alert('👑 Pro Feature: ' + errorData.detail);

                    const proPage = document.getElementById('pro-access-page');
                    if (proPage) {
                        document.querySelectorAll('.page-content').forEach(p => {
                            p.classList.remove('active');
                            p.style.display = 'none';
                        });
                        proPage.classList.add('active');
                        proPage.style.display = 'block';
                    }
                    return;
                }

                data = await response.json();
            }

            // 👇 (इसके ठीक नीचे तुम्हारी Line 407 वाली `if (data && data.length > 0) {` वैसी की वैसी ही रहेगी)
        if (data && data.length > 0) {
            currentQuestions = data; 
            currentQuestionIndex = 0;
            userAnswers = {};
            if (examType === 'hp_police') {
    totalQuizTimeSeconds = 7200; // Police के लिए 120 मिनट
} else {
    totalQuizTimeSeconds = 5400; // Patwari और JOA IT के लिए 90 मिनट
} 

            document.getElementById('exam-selection-view').style.display = 'none';
            document.getElementById('active-quiz-view').style.display = 'block';

            if(document.getElementById('standard-sidebar-content')) document.getElementById('standard-sidebar-content').style.display = 'none';
            if(document.getElementById('quiz-navigation-palette')) document.getElementById('quiz-navigation-palette').style.display = 'block';

            startQuizTimer();
            displayQuestion();
        } else {
            alert("Sawal load nahi ho paye. Kripya check karein!");
        }
    } catch (error) {
        // 🧼 एरर आने की सूरत में भी लोडिंग स्क्रीन को साफ़ करें और बटन्स रीसेट करें
        if (document.getElementById('quiz-cloud-loader')) document.getElementById('quiz-cloud-loader').remove();
        examButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = "1";
        });
        console.error("Test start karne mein error:", error);
        alert("Server se connect nahi ho pa rha hai! Kripya internet check karein.");
    }
}

function startQuizTimer() {
    if (quizTimerInterval) clearInterval(quizTimerInterval);

    quizTimerInterval = setInterval(() => {
        totalQuizTimeSeconds--;

        let minutes = Math.floor(totalQuizTimeSeconds / 60);
        let seconds = totalQuizTimeSeconds % 60;

        let displayMins = minutes < 10 ? "0" + minutes : minutes;
        let displaySecs = seconds < 10 ? "0" + seconds : seconds;

        document.getElementById('quiz-timer').innerText = `${displayMins}:${displaySecs}`;

        if (totalQuizTimeSeconds <= 0) {
            clearInterval(quizTimerInterval);
            alert("⏰ Samay Samapt! Aapka test auto-submit kiya ja rha hai.");
            submitMockTest(); 
        }
    }, 1000);
}

async function displayQuestion() {
    if (!currentQuestions || currentQuestions.length === 0) return;

    const currentQ = currentQuestions[currentQuestionIndex];

    // 🚀 SMART TRANSLATION LOGIC: चेक करें कि इंग्लिश सेलेक्टेड है और पहले से ट्रांसलेटेड तो नहीं है?
    if (currentLanguage === 'en' && !currentQ.translated_en) {
        document.getElementById('quiz-question-text').innerText = `⏳ Translating to English...`;
        
        // एक बार ट्रांसलेट करके सवाल के डेटा में ही सेव कर लेंगे, ताकि क्लिक करने पर डिले न हो
        currentQ.translated_en = {
            question: await autoTranslate(currentQ.question_text || currentQ.question),
            opt1: currentQ.opt1 ? await autoTranslate(currentQ.opt1) : "",
            opt2: currentQ.opt2 ? await autoTranslate(currentQ.opt2) : "",
            opt3: currentQ.opt3 ? await autoTranslate(currentQ.opt3) : "",
            opt4: currentQ.opt4 ? await autoTranslate(currentQ.opt4) : ""
        };
    }

    // 🎯 तय करें कि स्क्रीन पर कौन सी भाषा दिखानी है
    const displayText = currentLanguage === 'en' && currentQ.translated_en 
        ? currentQ.translated_en 
        : {
            question: currentQ.question_text || currentQ.question,
            opt1: currentQ.opt1,
            opt2: currentQ.opt2,
            opt3: currentQ.opt3,
            opt4: currentQ.opt4
        };

    document.getElementById('current-q-num').innerText = currentQuestionIndex + 1;
    document.getElementById('quiz-question-text').innerText = displayText.question;

    const progressPercent = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    document.getElementById('quiz-progress-fill').style.width = `${progressPercent}%`;

    const optionsWrapper = document.getElementById('quiz-options-wrapper');
    optionsWrapper.innerHTML = ""; 

    for (let i = 1; i <= 4; i++) {
        const optionText = displayText[`opt${i}`];
        if (!optionText) continue;

        const optionKey = `opt${i}`;
        const isSelected = userAnswers[currentQ.id] === optionKey;

        const optionButton = document.createElement('button');
        
        // 🎨 बटन्स की फॉर्मेटिंग (तुम्हारा ओरिजिनल डार्क मोड लुक)
        optionButton.style.cssText = `
            padding: 14px; 
            border: 1px solid ${isSelected ? '#60a5fa' : '#334155'}; 
            border-radius: 8px; 
            background: ${isSelected ? '#2563eb' : '#0f172a'}; 
            color: white; 
            text-align: left; 
            cursor: pointer; 
            transition: all 0.2s;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
        `;
        
        optionButton.innerHTML = `<span style="background: #1e293b; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #38bdf8;">${i}</span> <span class="opt-text">${optionText}</span>`;
        
        optionButton.onclick = () => {
            userAnswers[currentQ.id] = optionKey;
            displayQuestion(); 
        };
        
        optionsWrapper.appendChild(optionButton);
    }

    document.getElementById('prev-q-btn').disabled = currentQuestionIndex === 0;
    
    const nextBtn = document.getElementById('next-q-btn');
    if (currentQuestionIndex === currentQuestions.length - 1) {
        nextBtn.innerHTML = `Submit Test <i class="fa-solid fa-check-double"></i>`;
        nextBtn.style.background = "#10b981";
        nextBtn.onclick = submitMockTest; 
    } else {
        nextBtn.innerHTML = `Next <i class="fa-solid fa-arrow-right"></i>`;
        nextBtn.style.background = "#2563eb";
        nextBtn.onclick = () => navigateQuestion(1);
    }

    const queryBox = document.getElementById('query-input-box');
    if(queryBox) queryBox.style.display = 'none';
    const queryText = document.getElementById('query-issue-text');
    if(queryText) queryText.value = '';

    renderQuestionPalette();
}

function navigateQuestion(direction) {
    currentQuestionIndex += direction;
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;
    if (currentQuestionIndex >= currentQuestions.length) currentQuestionIndex = currentQuestions.length - 1;
    
    displayQuestion();
}

async function submitMockTest() {
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    
    let correctCount = 0;
    let wrongCount = 0;
    
    currentQuestions.forEach(q => {
        const chosen = userAnswers[q.id];
        let correctKey = q.correct_option || q.answer || q.correct_answer || q.correct;
        
        // स्कोर कैलकुलेट करने के लिए भी वही स्मार्ट डिकोडिंग
        if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correctKey)) {
            correctKey = 'opt' + correctKey;
        }
        
        if (chosen === correctKey) {
            correctCount++;
        } else if (chosen) {
            wrongCount++;
        }
    });

    // 🟢 NEW LOGIC: सिर्फ HP Police के लिए नेगेटिव मार्किंग (-0.25)
    let finalScore = correctCount; 
    
    if (selectedExamType === 'hp_police') {
        finalScore = correctCount - (wrongCount * 0.25);
        finalScore = parseFloat(finalScore.toFixed(2));
    }
    
    // स्क्रीन पर अपडेट करना
    document.getElementById('final-score').innerText = finalScore;
    document.getElementById('stat-correct').innerText = correctCount;
    document.getElementById('stat-wrong').innerText = wrongCount;
    
    // =========================================================================
    // 🏆 ACHIEVEMENT CHECK TRIGGER (NAYA CODE)
    // =========================================================================
    // =========================================================================
    // 🏆 ACHIEVEMENT CHECK TRIGGER (NAYA CODE)
    // =========================================================================
    // 🔥 Process & Update Daily Streak
    processUserStreak();

    // 🏆 ACHIEVEMENT CHECK TRIGGER
    const totalQuestions = currentQuestions.length;
    const attemptedQuestions = correctCount + wrongCount;
    
    checkAchievements({
        totalQuestions: totalQuestions,
        attempted: attemptedQuestions,
        correctAnswers: correctCount,
        examCategory: selectedExamType || '',
        timeTakenSeconds: 0, 
        totalAllowedSeconds: 0,
        dailyTestsCountToday: 1, 
        streakDays: 1, 
        previousTestScore: null
    });
    // =========================================================================
    // =========================================================================
    
    document.getElementById('active-quiz-view').style.display = 'none';
    document.getElementById('quiz-result-view').style.display = 'block';
    
    // 🎯 टेस्ट सबमिट होते ही पैलेट हटाकर नॉर्मल साइडबार वापस लाएं
    if(document.getElementById('standard-sidebar-content')) document.getElementById('standard-sidebar-content').style.display = 'block';
    if(document.getElementById('quiz-navigation-palette')) document.getElementById('quiz-navigation-palette').style.display = 'none';
    
    // 🧹 टेस्ट सबमिट होते ही रिव्यू डिब्बे को रीसेट कर दो, ताकि पुराना कचरा न दिखे
    const reviewBox = document.getElementById('review-container');
    if (reviewBox) {
        reviewBox.style.display = 'none';
        reviewBox.innerHTML = '';
    }
    
    const userId = currentUserId || window.CURRENT_USER_PROFILE?.id || "test-user-123";

    // यूज़र का नाम स्क्रीन या प्रोफाइल से निकालें
    const userNameEl = document.getElementById('display-name');
    const userName = window.CURRENT_USER_PROFILE?.display_name || (userNameEl ? userNameEl.innerText : "Student");

    try {
        await fetch('https://hp-exam-pro-dixk.onrender.com/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                display_name: userName, 
                exam_type: selectedExamType,
                score: finalScore, 
                correct_answers: correctCount,
                wrong_answers: wrongCount,
                questions_snapshot: currentQuestions,
                user_responses: userAnswers
            })
        });
    } catch (error) {
        console.error("Data save karne mein error aaya:", error);
    }
}
function resetToSelection() {
    document.getElementById('quiz-result-view').style.display = 'none';
    document.getElementById('exam-selection-view').style.display = 'block';
    
    // 🎯 पुराना साइडबार वापस दिखाएं और पैलेट छुपाएं
    if(document.getElementById('standard-sidebar-content')) document.getElementById('standard-sidebar-content').style.display = 'block';
    if(document.getElementById('quiz-navigation-palette')) document.getElementById('quiz-navigation-palette').style.display = 'none';
        // 🧹 जाते-जाते पिछले टेस्ट का रिव्यू डिब्बा बंद और साफ़ करें
    const reviewBox = document.getElementById('review-container');
    if (reviewBox) {
        reviewBox.style.display = 'none';
        reviewBox.innerHTML = '';
    }

}


function renderQuestionPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid || !currentQuestions) return;
    grid.innerHTML = ''; 

    currentQuestions.forEach((q, index) => {
        const circle = document.createElement('div');
        circle.innerText = index + 1;

        circle.style.width = '35px';
        circle.style.height = '35px';
        circle.style.borderRadius = '50%';
        circle.style.display = 'flex';
        circle.style.alignItems = 'center';
        circle.style.justifyContent = 'center';
        circle.style.cursor = 'pointer';
        circle.style.fontSize = '13px';
        circle.style.fontWeight = 'bold';
        circle.style.transition = 'all 0.2s ease';

        if (index === currentQuestionIndex) {
            circle.style.background = '#3b82f6'; 
            circle.style.color = 'white';
            circle.style.boxShadow = '0 0 8px #3b82f6';
            circle.style.border = '2px solid #93c5fd';
        } else if (userAnswers[q.id] !== undefined) {
            circle.style.background = '#10b981'; 
            circle.style.color = 'white';
        } else {
            circle.style.background = '#475569'; 
            circle.style.color = '#cbd5e1';
        }

        circle.onclick = () => {
            currentQuestionIndex = index;
            displayQuestion();
        };

        grid.appendChild(circle);
    });
}

function toggleMobilePalette() {
    const palette = document.getElementById('quiz-navigation-palette');
    if (palette.style.display === 'none' || palette.style.display === '') {
        palette.style.display = 'block';
        palette.style.position = 'fixed';
        palette.style.bottom = '0';
        palette.style.left = '0';
        palette.style.width = '100%';
        palette.style.zIndex = '1000';
        palette.style.background = '#1e293b';
        palette.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.5)';
        palette.style.borderTop = '2px solid #334155';
        palette.style.padding = '20px';
    } else {
        palette.style.display = 'none';
    }
}


// ==================== 6. NAVIGATION SWITCH CONTROLLER ====================
function switchTab(pageId) {
    const activeQuizView = document.getElementById('active-quiz-view');
    if (activeQuizView && activeQuizView.style.display === 'block') {
        const confirmExit = confirm("⚠️ आपका मॉक टेस्ट अभी चल रहा है!\n\nक्या आप इस टेस्ट को SUBMIT करके दूसरे पेज पर जाना चाहते हैं?\n\n'OK' दबाने पर आपका टेस्ट करंट प्रोग्रेस के साथ सबमिट हो जाएगा, 'Cancel' दबाने पर टेस्ट वैसे ही चलता रहेगा।");
        
        if (confirmExit) {
            submitMockTest(); 
        } else {
            return; 
        }
    }

    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // 🎯 FIX: Agar dashboard khul rha hai toh 'flex' layout do, baaki sabko 'block'
        if (pageId.includes('dashboard')) {
            targetPage.style.display = 'flex';
        } else {
            targetPage.style.display = 'block';
        }

        if (pageId === 'analytics-page') {
            loadAnalyticsData();
            // 🟢 टेस्ट हिस्ट्री लोड करने का ट्रिगर 
            if (typeof loadAttemptedHistory === 'function') {
                loadAttemptedHistory();
            }
        }
        
        // 🟢 NAYA CODE: जब बच्चा लीडरबोर्ड पेज खोलेगा, तो लिस्ट तुरंत लोड हो जाएगी
        if (pageId === 'leaderboard-page') {
            const dropdown = document.getElementById('leaderboard-exam-select');
            const selectedExam = dropdown ? dropdown.value : 'hp_police';
            renderLeaderboard(selectedExam); 
        }
        
        if (pageId === 'mock-tests-page') {
            if (document.getElementById('exam-selection-view')) document.getElementById('exam-selection-view').style.display = 'block';
            if (document.getElementById('active-quiz-view')) document.getElementById('active-quiz-view').style.display = 'none';
            if (document.getElementById('quiz-result-view')) document.getElementById('quiz-result-view').style.display = 'none';
        }
    }
}
window.toggleMenu = function() {
    const mobileSidebar = document.getElementById('mobile-sidebar');
    if (mobileSidebar) {
        mobileSidebar.classList.toggle('open');
    }
}


// ==================== 7. ANALYTICS ENGINE ====================
let performanceChartInstance = null; 

async function loadAnalyticsData() {
    const userId = currentUserId || "test-user-123";
    try {
        const response = await fetch(`https://hp-exam-pro-dixk.onrender.com/api/analytics/${userId}`);
        const data = await response.json();

        if(document.getElementById('analytics-total-tests')) document.getElementById('analytics-total-tests').innerText = data.total_tests;
        if(document.getElementById('analytics-avg-score')) document.getElementById('analytics-avg-score').innerText = data.avg_score;
        if(document.getElementById('analytics-highest-score')) document.getElementById('analytics-highest-score').innerText = data.highest_score;
        if(document.getElementById('analytics-accuracy')) document.getElementById('analytics-accuracy').innerText = data.accuracy + "%";

        const chartCanvas = document.getElementById('performanceChart');
        if (!chartCanvas) return; 

        const ctx = chartCanvas.getContext('2d');
        if (performanceChartInstance) { performanceChartInstance.destroy(); }

        const labels = data.graph_data.map(item => item.date);
        const scores = data.graph_data.map(item => item.score);

        performanceChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['No Data Yet'],
                datasets: [{
                    label: 'Mock Test Score',
                    data: scores.length ? scores : [0],
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                scales: { y: { min: 0, max: 120 } }
            }
        });

    } catch (error) {
        console.error("Analytics लोड करने में गड़बड़ हुई:", error);
    }
}

// ==================== 8. QUERY RAISE SYSTEM FRONTEND LOGIC ====================
function toggleQueryBox() {
    const box = document.getElementById('query-input-box');
    if(box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function submitQuestionQuery() {
    const issueText = document.getElementById('query-issue-text').value.trim();
    if (!issueText) {
        alert("कृपया आपत्ति दर्ज करने से पहले कुछ विवरण लिखें!");
        return;
    }

    const currentQ = currentQuestions[currentQuestionIndex];
    const userId = currentUserId || window.CURRENT_USER_PROFILE?.id || "test-user-123";

    try {
        const response = await fetch('https://hp-exam-pro-dixk.onrender.com/api/query/raise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                question_id: String(currentQ.id || currentQuestionIndex + 1),
                issue_text: issueText
            })
        });

        const data = await response.json();
        if (data.status === "success") {
            alert(`✅ ${data.message}`);
            document.getElementById('query-input-box').style.display = 'none';
            document.getElementById('query-issue-text').value = '';
        } else {
            alert("आपत्ति दर्ज करने में कुछ तकनीकी खराबी आई।");
        }
    } catch (error) {
        console.error("Query Raise Error:", error);
        alert("सर्वर से कनेक्ट नहीं हो पाया!");
    }
}

// ==================== 💳 PREMIUM TELEGRAM ACTIVATION SYSTEM ====================

function initiateProPayment() {
    const userProfile = window.CURRENT_USER_PROFILE;
    const userId = currentUserId || userProfile?.id;

    if (!userId) {
        alert("⚠️ कृपया पेमेंट करने से पहले वेबसाइट पर लॉगिन करें!");
        return;
    }

    // यूजर की ईमेल आईडी निकालें
    const userEmail = userProfile?.email || "Not Provided";
    
    // एक बढ़िया सा प्रोफेशनल मैसेज जो बच्चे के चैट बॉक्स में खुद-ब-खुद टाइप हो जाएगा
    const message = encodeURIComponent(`Hello Sir, मुझे 'HP Exam Pro' का प्रीमियम एक्सेस (Pro Membership) चाहिए।\n\nMy Registered Email: ${userEmail}\nUser ID: ${userId}`);
    
    // तुम्हारा असली टेलीग्राम यूजरनेम
    const myTelegramUsername = "Lakshit_sharma07"; 
    
    const telegramLink = `https://t.me/${myTelegramUsername}?text=${message}`;
    
    // बच्चे को सीधे तुम्हारी पर्सनल टेलीग्राम चैट पर भेजना
    window.open(telegramLink, "_blank");
}


// ==================== 9. POST-TEST REVIEW & EXPLANATION ====================
function showReview() {
    const reviewContainer = document.getElementById('review-container');
    if (!reviewContainer) return;

    // अगर पहले से खुला है तो बंद कर दो (Toggle effect)
    if (reviewContainer.style.display === 'block') {
        reviewContainer.style.display = 'none';
        return;
    }

    reviewContainer.style.display = 'block';
    reviewContainer.innerHTML = `<h3 style="color: #38bdf8; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 10px;">Detailed Analysis & Solutions</h3>`;

    currentQuestions.forEach((q, index) => {
        const chosenKey = userAnswers[q.id]; // जैसे 'opt1', 'opt2'
                let correctKey = q.correct_option || q.answer || q.correct_answer || q.correct;
        
        // अगर डेटाबेस में सही जवाब '1', '2' के फॉर्मेट में सेव है, तो उसे 'opt1', 'opt2' बना दो
        if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correctKey)) {
            correctKey = 'opt' + correctKey;
        }

        // जो टेक्स्ट बच्चे ने चुना और जो असली जवाब था (उन्हें निकालना)
        const chosenText = chosenKey ? q[chosenKey] : "Did not attempt";
        const correctText = q[correctKey] || correctKey || "Data Not Provided";


        // सही/गलत के हिसाब से रंग तय करना
        const isCorrect = chosenKey === correctKey;
        const statusColor = isCorrect ? '#10b981' : (chosenKey ? '#ef4444' : '#f59e0b');
        const statusIcon = isCorrect ? '✅' : (chosenKey ? '❌' : '⚠️ Unattempted');

        // हर सवाल के लिए एक डिब्बा (Card) बनाना
        const qCard = document.createElement('div');
        qCard.style.cssText = `
            background: #1e293b; border-left: 4px solid ${statusColor}; 
            padding: 15px; margin-bottom: 15px; border-radius: 6px;
        `;

        let htmlContent = `
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #f8fafc;">Q${index + 1}: ${q.question_text || q.question}</p>
            <div style="font-size: 14px; margin-bottom: 5px;">
                <span style="color: #94a3b8;">Your Answer:</span> 
                <span style="color: ${statusColor}; font-weight: bold;">${chosenText} ${statusIcon}</span>
            </div>
        `;

        // अगर गलत जवाब दिया है या छोड़ा है, तो असली जवाब हरा दिखाओ
        if (!isCorrect) {
            htmlContent += `
                <div style="font-size: 14px; margin-bottom: 10px;">
                    <span style="color: #94a3b8;">Correct Answer:</span> 
                    <span style="color: #10b981; font-weight: bold;">${correctText}</span>
                </div>
            `;
        }

        // 💡 असली जादू: अगर डेटाबेस में Explanation है, तो उसे दिखाओ
        if (q.explanation && q.explanation.trim() !== "") {
            htmlContent += `
                <div style="margin-top: 12px; padding: 12px; background: rgba(56, 189, 248, 0.1); border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.2);">
                    <div style="color: #38bdf8; font-size: 13px; font-weight: bold; margin-bottom: 5px;">💡 Solution / Explanation:</div>
                    <div style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${q.explanation}</div>
                </div>
            `;
        }

        qCard.innerHTML = htmlContent;
        reviewContainer.appendChild(qCard);
    });
}
// Mock Test History Logicा
// 📜 यूज़र के अटेम्प्टेड टेस्ट्स की हिस्ट्री लोड करना
async function loadAttemptedHistory() {
    const historyContainer = document.getElementById('attempt-history-container');
    if (!historyContainer) return;

    const userId = currentUserId || window.CURRENT_USER_PROFILE?.id;
    if (!userId) {
        historyContainer.innerHTML = '<p style="color:#94a3b8; font-size:13px;">हिस्ट्री देखने के लिए कृपया लॉगिन करें।</p>';
        return;
    }

    historyContainer.innerHTML = '<p style="color:#94a3b8; font-size:13px;">⏳ अटेम्प्टेड टेस्ट्स लोड हो रहे हैं...</p>';

    const { data: attempts, error } = await supabaseClient
        .from('test_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error || !attempts || attempts.length === 0) {
        historyContainer.innerHTML = '<p style="color:#94a3b8; font-size:13px;">आपने अभी तक कोई टेस्ट नहीं दिया है।</p>';
        return;
    }

    historyContainer.innerHTML = '';
    attempts.forEach(item => {
        let examName = 'JOA IT Mock Test';
if (item.exam_type === 'patwari') {
    examName = 'Patwari Mock Test';
} else if (item.exam_type === 'hp_police') {
    examName = 'HP Police Mock Test';
}
        const attemptDate = new Date(item.created_at).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        
        const card = document.createElement('div');
        card.style.cssText = 'background: #1e293b; padding: 12px 16px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #334155;';
        
        // 🟢 FIX 1: यहाँ Review बटन में 'this' पास किया है ताकि हम उसी बटन पर Loading दिखा सकें
        card.innerHTML = `
            <div>
                <h4 style="margin: 0; color: #f8fafc; font-size: 14px;">📝 ${examName}</h4>
                <small style="color: #94a3b8; font-size: 11px;">दिनांक: <b>${attemptDate}</b> | स्कोर: <b style="color: #10b981;">${item.score} Marks</b></small>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="reviewPastTest('${item.id}', this)" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; min-width: 80px;">👁️ Review</button>
                <button onclick="confirmReattempt('${item.id}', '${item.exam_type}', this)" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; min-width: 90px;">🔄 Re-attempt</button>
            </div>
        `;
        historyContainer.appendChild(card);
    });
}
// 🛑 End Test बटन दबाने पर Warning / Confirmation पूछना
function promptEndTest() {
    const sure = confirm("⚠️ Are you sure?\nक्या आप सच में टेस्ट को अभी Submit करना चाहते हैं?");
    
    if (sure) {
        // अगर यूज़र 'OK' दबाता है, तो असली सबमिट फंक्शन चला दो
        submitMockTest();
    }
}

// 👁️ पुराने टेस्ट का रिव्यु खोलना (लोैडिंग इफ़ेक्ट के साथ)
async function reviewPastTest(testId, btnElement) {
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = '⏳ Loading...';
    btnElement.disabled = true;
    btnElement.style.opacity = '0.7';

    // डेटाबेस से पुराना रिज़ल्ट लाएं
    const { data, error } = await supabaseClient
        .from('test_results')
        .select('*')
        .eq('id', testId)
        .single();

    btnElement.innerHTML = originalText;
    btnElement.disabled = false;
    btnElement.style.opacity = '1';

    if (error || !data || !data.questions_snapshot) {
        alert("इस टेस्ट का डिटेल्ड रिव्यू डेटा उपलब्ध नहीं है!");
        return;
    }

    currentQuestions = data.questions_snapshot;
    userAnswers = data.user_responses || {};

    if (typeof switchTab === 'function') {
        switchTab('mock-tests-page');
    }

    const selectionView = document.getElementById('exam-selection-view');
    const quizView = document.getElementById('active-quiz-view');
    const resultView = document.getElementById('quiz-result-view');

    if (selectionView) selectionView.style.display = 'none';
    if (quizView) quizView.style.display = 'none';
    if (resultView) resultView.style.display = 'block';

    // 🟢 MAIN FIX: नीले डिब्बे (Score) और सही/गलत स्टैट्स में पुराने नंबर डालें
    const finalScoreEl = document.getElementById('final-score');
    const statCorrectEl = document.getElementById('stat-correct');
    const statWrongEl = document.getElementById('stat-wrong');
    
    if (finalScoreEl) finalScoreEl.innerText = data.score !== undefined ? data.score : 0;
    if (statCorrectEl) statCorrectEl.innerText = data.correct_answers !== undefined ? data.correct_answers : 0;
    if (statWrongEl) statWrongEl.innerText = data.wrong_answers !== undefined ? data.wrong_answers : 0;

    showReview();
}
// 🔄 Re-attempt की पुष्टि
// 🔄 Re-attempt की पुष्टि और वही पुराने सवाल लोड करना (नया लॉजिक)
async function confirmReattempt(testId, examType, btnElement) {
    let examName = 'JOA IT';
if (examType === 'patwari') {
    examName = 'Patwari';
} else if (examType === 'hp_police') {
    examName = 'HP Police Constable';
}
    const sure = confirm(`Are you sure want to Re-Attempt ${examName} ? (सवाल वही रहेंगे)`);
    
    if (sure) {
        // लोडिंग इफ़ेक्ट
        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = '⏳...';
        btnElement.disabled = true;

        // डेटाबेस से उसी टेस्ट के सवाल निकालें
        const { data, error } = await supabaseClient
            .from('test_results')
            .select('questions_snapshot')
            .eq('id', testId)
            .single();

        btnElement.innerHTML = originalText;
        btnElement.disabled = false;

        if (error || !data || !data.questions_snapshot) {
            alert("इस टेस्ट का डेटा नहीं मिला!");
            return;
        }

        // सवालों को एक टेम्परेरी ग्लोबल वेरिएबल में सेव कर लें
        window.reAttemptQuestions = data.questions_snapshot;

        if (typeof switchTab === 'function') switchTab('mock-tests-page');
        startMockTest(examType);
    }
}


// 1. Function to send password reset link via Email
async function handleForgotPassword(email) {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://hp-exam-pro.vercel.app/', // 👈 Bas yahan se '#reset-password' hata diya hai
    });

    if (error) {
        alert("⚠️ Error: " + error.message);
    } else {
        alert("📨 A secure password reset link has been sent to your email inbox! Please check it.");
    }
}

// 2. Function to update the password in Supabase
async function handleUpdatePassword(newPassword) {
    const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword
    });

    if (error) {
        alert("⚠️ Password update failed: " + error.message);
    } else {
        alert("🎉 Success! Your password has been updated. You can now login with your new password.");
    }
}

// 3. Supabase listener to automatically detect when user clicks the email link
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
        // This prompts the user to enter their new password immediately upon return
        const newPass = prompt("🔑 Enter your new HP Exam Pro password:");
        if (newPass) {
            handleUpdatePassword(newPass);
        }
    }
});

// 🟢 1. TCS Style Language State & Change Handler
let currentLanguage = 'hi';

async function changeLanguage(lang) {
    currentLanguage = lang;
    await displayQuestion(); // भाषा बदलते ही नया सवाल लोड होगा
}

// 🟢 2. Auto-Translation Helper (MyMemory API - No CORS Issues)
async function autoTranslate(text) {
    if (!text || currentLanguage === 'hi') return text;
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=hi|en`);
        const data = await res.json();
        return data.responseData ? data.responseData.translatedText : text;
    } catch (error) {
        console.error("Translation Error:", error);
        return text;
    }
}

// 3. Render Leaderboard UI
function renderLeaderboard(examType = 'hp_police', userScoreForThisExam = 0) {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;

    const realUserName = window.CURRENT_USER_PROFILE?.display_name || "Student (You)";
    
    // घोस्ट यूज़र्स के आज के (फ्लुक्टुएटेड) नंबर निकालो
    let allUsers = ghostLeaderboards[examType].map(user => ({
        name: user.name,
        score: getDailyScore(user.baseScore, user.name),
        isReal: false
    }));
    
    // ========================================================================
    // 🛑 ADMIN HIDE FEATURE: अपनी ID को लीडरबोर्ड से छुपाने का कंट्रोल
    // अगर तुम खुद को छुपाना चाहते हो, तो इसे true रहने दो।
    // अगर तुम लीडरबोर्ड पर अपना नाम देखना चाहते हो, तो इसे false कर दो।
    const hideAdmin = true; 
    
    // यहाँ तुम्हारी दोनों IDs चेक होंगी
    const isAdminAccount = realUserName.includes('lakshitsharma976') || realUserName.includes('lakshitsharma8080');
    // ========================================================================

    // असली यूज़र की एंट्री
    if (userScoreForThisExam > 0) {
        if (hideAdmin && isAdminAccount) {
            // तुम एडमिन हो और Hide सेटिंग ON है, इसलिए तुम्हारा नाम लिस्ट में नहीं जाएगा (Ghost Mode) 👻
        } else {
            // कोई आम बच्चा है या तुमने Hide सेटिंग OFF कर दी है, तो लिस्ट में डाल दो
            allUsers.push({ name: realUserName, score: userScoreForThisExam, isReal: true });
        }
    }

    // सॉर्टिंग (ज़्यादा नंबर वाला ऊपर)
    allUsers.sort((a, b) => b.score - a.score);

    container.innerHTML = '';
    let realUserRank = -1;
    let realUserHTML = '';

    allUsers.forEach((user, index) => {
        const rank = index + 1;
        if (user.isReal) realUserRank = rank;

        // UI Design Logic
        let bgStyle = "background: #1e293b; border: 1px solid #334155;";
        let nameColor = "#f8fafc";
        let rankDisplay = `<span style="color: #94a3b8; font-weight: bold; width: 30px;">#${rank}</span>`;
        let isMeBadge = "";

        if (rank === 1) {
            bgStyle = "background: linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, #1e293b 100%); border: 1px solid #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.2);";
            rankDisplay = `<span style="font-size: 18px; width: 30px;">👑</span>`;
            nameColor = "#f59e0b";
        } else if (rank === 2) {
            bgStyle = "background: linear-gradient(90deg, rgba(203, 213, 225, 0.1) 0%, #1e293b 100%); border: 1px solid #cbd5e1;";
            rankDisplay = `<span style="font-size: 18px; width: 30px;">🥈</span>`;
        } else if (rank === 3) {
            bgStyle = "background: linear-gradient(90deg, rgba(217, 119, 6, 0.1) 0%, #1e293b 100%); border: 1px solid #d97706;";
            rankDisplay = `<span style="font-size: 18px; width: 30px;">🥉</span>`;
        }

        // असली यूज़र का प्रीमियम हाईलाइट
        if (user.isReal) {
            bgStyle = "background: rgba(37, 99, 235, 0.15); border: 1px solid #3b82f6;";
            nameColor = "#38bdf8";
            isMeBadge = `<span style="background: #2563eb; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">YOU</span>`;
        }

        const htmlRow = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 8px; ${bgStyle}">
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${rankDisplay}
                    <span style="font-weight: 600; color: ${nameColor}; display: flex; align-items: center;">${user.name} ${isMeBadge}</span>
                </div>
                <div style="font-weight: bold; color: #10b981;">${user.score}</div>
            </div>
        `;

        // टॉप 10 को प्रिंट करो
        if (rank <= 10) {
            container.innerHTML += htmlRow;
        } 
        // अगर असली यूज़र टॉप 10 से बाहर है, तो उसे सेव कर लो (पिन करने के लिए)
        else if (user.isReal) {
            realUserHTML = htmlRow;
        }
    });

    // Pinned Bottom Logic: अगर बच्चा टॉप 10 में नहीं है, तो उसे सबसे नीचे चिपका दो
    if (realUserRank > 10) {
        container.innerHTML += `<div style="text-align: center; color: #475569; font-size: 20px; line-height: 10px; margin: 5px 0;">⋮</div>`;
        container.innerHTML += realUserHTML;
    }
}

// ==================== ❓ DAILY QUESTION OF THE DAY LOGIC ====================

// 1. Dynamic Confetti Script Loader (Hawaiyan udane ke liye library automatically load hogi)
if (!window.confetti) {
    const confettiScript = document.createElement('script');
    confettiScript.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
    document.head.appendChild(confettiScript);
}

// 2. Function to load Random Question from Backend (Updated with Exact Supabase Headers)
async function loadDailyQuestion() {
    try {
        const response = await fetch('https://hp-exam-pro-dixk.onrender.com/api/daily-question');
        const data = await response.json();

        if (data.status === "success" && data.question) {
            const q = data.question;
            
            // 🎯 1. Setting exact question text header
            document.getElementById('daily-question-text').innerText = q.question_text || "Today's Challenge Question";

            // 🎯 2. Mapping exact headers: opt1, opt2, opt3, opt4
            const options = [
                { key: '1', text: q.opt1 },
                { key: '2', text: q.opt2 },
                { key: '3', text: q.opt3 },
                { key: '4', text: q.opt4 }
            ].filter(opt => opt.text); // Filters out any empty values

            const container = document.getElementById('daily-options-container');
            container.innerHTML = ''; // Clearing loading text

            // 🎯 3. Fetching exact correct_option value (like '1', '2', '3', or '4')
            const correctKey = String(q.correct_option || "").trim();

            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'daily-opt-btn';
                btn.innerText = `${opt.key}. ${opt.text}`; // Will show as 1. Alan Turing, 2. Charles Babbage etc.
                
                // Beautiful minimal button styling
                btn.style.width = '100%';
                btn.style.padding = '10px 12px';
                btn.style.textAlign = 'left';
                btn.style.border = '1px solid #e2e8f0';
                btn.style.borderRadius = '8px';
                btn.style.background = '#f8fafc';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '13px';
                btn.style.transition = 'all 0.2s';
                btn.style.color = '#334155';

                // Click event passing the numeric keys and explanation header
                btn.onclick = () => checkDailyAnswer(btn, opt.key, correctKey, q.explanation || "No explanation provided.");
                container.appendChild(btn);
            });
        } else {
            document.getElementById('daily-question-text').innerText = "Stay tuned for tomorrow's question!";
        }
    } catch (error) {
        console.error("Daily question load nahi ho paya:", error);
    }
}


// 3. Core Logic to Check Answer, Trigger Confetti and Show Explanation
function checkDailyAnswer(clickedBtn, selectedKey, correctKey, explanationText) {
    // Disable all option buttons so user cannot click multiple times
    const allButtons = document.querySelectorAll('.daily-opt-btn');
    allButtons.forEach(btn => btn.disabled = true);

    const expBox = document.getElementById('daily-explanation-box');
    expBox.style.display = 'block';

    if (selectedKey === correctKey) {
        // 🎉 1. USER IS CORRECT! Green feedback
        clickedBtn.style.background = '#d1fae5';
        clickedBtn.style.borderColor = '#10b981';
        clickedBtn.style.color = '#065f46';
        clickedBtn.style.fontWeight = 'bold';

        // 🚀 2. TRIGER HAWAIYAN (Canvas Confetti Boom Effect)
        if (window.confetti) {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 }
            });
        }

        expBox.innerHTML = `<strong style="color: #10b981;">🎉 Correct Answer!</strong><br><span style="margin-top: 4px; display:block;">${explanationText}</span>`;
    } else {
        // ❌ 1. USER IS WRONG! Red feedback
        clickedBtn.style.background = '#fee2e2';
        clickedBtn.style.borderColor = '#ef4444';
        clickedBtn.style.color = '#991b1b';

        // 2. Highlight the correct answer in Green so they learn instantly
        allButtons.forEach(btn => {
            if (btn.innerText.startsWith(correctKey + '.')) {
                btn.style.background = '#d1fae5';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#065f46';
                btn.style.fontWeight = 'bold';
            }
        });

        expBox.innerHTML = `<strong style="color: #ef4444;">❌ Incorrect Answer!</strong><br><span style="margin-top: 4px; display:block;"><strong>Explanation:</strong> ${explanationText}</span>`;
    }
}

// 4. Automatically trigger this function whenever Dashboard/Sidebar content loads
document.addEventListener('DOMContentLoaded', () => {
    loadDailyQuestion();
});
// =============================================================================
// ==================== 🏆 SMART LEADERBOARD SYSTEM (WITH DATABASE) ====================

// 1. Ghost Users Data (Fixed Range: Police < 72, Patwari/JOA < 89)
const ghostLeaderboards = {
    'hp_police': [
        { name: "rahul.sharma99", baseScore: 71.00 }, 
        { name: "priya.s12", baseScore: 68.25 },      
        { name: "vikas.k87", baseScore: 65.50 },      
        { name: "amitkumar_87", baseScore: 64.00 },
        { name: "neha_verma23", baseScore: 61.25 },
        { name: "suresh.hp", baseScore: 59.75 },
        { name: "pankaj.99", baseScore: 56.50 },
        { name: "kiran.bala", baseScore: 54.00 },
        { name: "rohit.thakur", baseScore: 51.25 },
        { name: "anjali.04", baseScore: 48.50 }
    ],
    'patwari': [
        { name: "priya.s12", baseScore: 88.00 },      
        { name: "sharma.aman", baseScore: 86.00 },
        { name: "rahul.sharma99", baseScore: 83.00 }, 
        { name: "pooja.rajput", baseScore: 80.00 },
        { name: "vikas.k87", baseScore: 78.00 },      
        { name: "kullu_boy", baseScore: 75.00 },
        { name: "sunita.devi", baseScore: 72.00 },
        { name: "manish.77", baseScore: 68.00 },
        { name: "diksha.hp", baseScore: 65.00 },
        { name: "vishal.kumar", baseScore: 62.00 }
    ],
    'joa_it': [
        { name: "vikas.k87", baseScore: 88.00 },      
        { name: "tech.amit", baseScore: 85.00 },
        { name: "rahul.sharma99", baseScore: 82.00 }, 
        { name: "priya.s12", baseScore: 79.00 },      
        { name: "ritika.sharma", baseScore: 76.00 },
        { name: "kapil.dev", baseScore: 73.00 },
        { name: "sumit.it", baseScore: 70.00 },
        { name: "ashish.99", baseScore: 67.00 },
        { name: "monika.thakur", baseScore: 64.00 },
        { name: "nitin.kumar", baseScore: 61.00 }
    ]
};

// 🟢 NAYA LOGIC: सिर्फ Police में दशमलव, बाकी में पूरे नंबर
function getDailyScore(baseScore, name, examType) {
    const today = new Date();
    const day = today.getDate();
    const seed = name.length + day; 
    let fluctuation = (seed % 5) - 2; 
    
    let fraction = 0;
    // अगर एग्जाम पुलिस का है, तभी दशमलव जोड़ें
    if (examType === 'hp_police') {
        const fractionMap = [0, 0.25, 0.50, 0.75];
        fraction = fractionMap[seed % 4];
    }
    
    return Math.max(0, baseScore + fluctuation + fraction);
}

// 🟢 NAYA LOGIC: Async function jo backend se real data layega
async function renderLeaderboard(examType = 'hp_police') {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    
    // Loading State
    container.innerHTML = '<div style="text-align:center; padding: 20px; color:#94a3b8;">⏳ Loading Live Ranks...</div>';

    const currentLoggedInName = window.CURRENT_USER_PROFILE?.display_name || "";
    
    // 1. Ghost Users लोड करें
    let allUsers = ghostLeaderboards[examType].map(user => ({
        name: user.name,
        score: getDailyScore(user.baseScore, user.name),
        isReal: false,
        isMe: false
    }));

    // 2. 🟢 DATABASE FETCH: Supabase से असली यूज़र्स का डेटा लाएं
    try {
        const { data: testResults } = await supabaseClient.from('test_results').select('user_id, score').eq('exam_type', examType);
        const { data: profiles } = await supabaseClient.from('profiles').select('id, display_name');

        if (testResults && profiles) {
            // प्रोफाइल ID को नाम से जोड़ने के लिए एक मैप बनाएं
            const profileMap = {};
            profiles.forEach(p => profileMap[p.id] = p.display_name);

            // हर यूज़र का सबसे हाईएस्ट स्कोर निकालें
            const realUserMaxScores = {};
            testResults.forEach(test => {
                const userName = profileMap[test.user_id] || "Unknown Student";
                if (!realUserMaxScores[userName] || test.score > realUserMaxScores[userName]) {
                    realUserMaxScores[userName] = test.score;
                }
            });

            const hideAdmin = true; 

            // डेटाबेस वाले यूज़र्स को लिस्ट में जोड़ें
            for (const [uName, maxScore] of Object.entries(realUserMaxScores)) {
                const isAdminAccount = uName.includes('lakshitsharma976') || uName.includes('lakshitsharma8080');
                
                // अगर एडमिन है और छुपाना है, तो लिस्ट में मत डालो
                if (hideAdmin && isAdminAccount) continue;

                allUsers.push({ 
                    name: uName, 
                    score: maxScore, 
                    isReal: true,
                    isMe: (uName === currentLoggedInName) // जो बच्चा अभी साइट चला रहा है, उसे हाइलाइट करने के लिए
                });
            }
        }
    } catch (error) {
        console.error("Leaderboard DB Error:", error);
    }

    // 3. सॉर्टिंग (ज़्यादा नंबर वाला ऊपर)
    allUsers.sort((a, b) => b.score - a.score);
    
    container.innerHTML = '';
    let realUserRank = -1;
    let realUserHTML = '';

    // 4. UI Generate करना
    allUsers.forEach((user, index) => {
        const rank = index + 1;
        if (user.isMe) realUserRank = rank;

        let bgStyle = "background: #1e293b; border: 1px solid #334155;";
        let nameColor = "#f8fafc";
        let rankDisplay = `<span style="color: #94a3b8; font-weight: bold; width: 30px;">#${rank}</span>`;
        let isMeBadge = "";

        if (rank === 1) {
            bgStyle = "background: linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, #1e293b 100%); border: 1px solid #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.2);";
            rankDisplay = `<span style="font-size: 18px; width: 30px;">👑</span>`;
            nameColor = "#f59e0b";
        } else if (rank === 2) {
            bgStyle = "background: linear-gradient(90deg, rgba(203, 213, 225, 0.1) 0%, #1e293b 100%); border: 1px solid #cbd5e1;";
            rankDisplay = `<span style="font-size: 18px; width: 30px;">🥈</span>`;
        } else if (rank === 3) {
            bgStyle = "background: linear-gradient(90deg, rgba(217, 119, 6, 0.1) 0%, #1e293b 100%); border: 1px solid #d97706;";
            rankDisplay = `<span style="font-size: 18px; width: 30px;">🥉</span>`;
        }

        // जो बच्चा अभी ऑनलाइन है, उसके कार्ड को नीला रंग (YOU badge) दो
        if (user.isMe) {
            bgStyle = "background: rgba(37, 99, 235, 0.15); border: 1px solid #3b82f6;";
            nameColor = "#38bdf8";
            isMeBadge = `<span style="background: #2563eb; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">YOU</span>`;
        } 
        // बाकी असली बच्चों (जो डेटाबेस से आए हैं) के नाम के आगे एक छोटा सा 'Verified' टिक दिखा सकते हैं (Optional)

        const htmlRow = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 8px; ${bgStyle}; flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${rankDisplay}
                    <span style="font-weight: 600; color: ${nameColor}; display: flex; align-items: center;">${user.name} ${isMeBadge}</span>
                </div>
                <div style="font-weight: bold; color: #10b981;">${user.score}</div>
            </div>
        `;

        if (rank <= 10) {
            container.innerHTML += htmlRow;
        } else if (user.isMe) {
            realUserHTML = htmlRow;
        }
    });

    if (realUserRank > 10) {
        container.innerHTML += `<div style="text-align: center; color: #475569; font-size: 20px; line-height: 10px; margin: 5px 0;">⋮</div>`;
        container.innerHTML += realUserHTML;
    }
}

// ==================== 🎉 ACHIEVEMENT POPUP CONTROLLER ====================

// पॉप-अप दिखाने वाला फंक्शन
function showAchievementUnlock(icon, title, description) {
    // HTML में बैज की डिटेल्स सेट करो
    document.getElementById('ach-icon').innerText = icon;
    document.getElementById('ach-title').innerText = title;
    document.getElementById('ach-desc').innerText = description;

    // पॉप-अप को स्क्रीन पर लाओ (Flex layout के साथ)
    const popup = document.getElementById('achievement-popup');
    popup.style.display = 'flex';
    
    // छोटा सा बाउंस एनीमेशन इफ़ेक्ट
    const popupBox = popup.querySelector('div');
    popupBox.style.transform = 'scale(0.8)';
    setTimeout(() => {
        popupBox.style.transform = 'scale(1)';
    }, 50);
}

// पॉप-अप बंद करने वाला फंक्शन
function closeAchievementPopup() {
    document.getElementById('achievement-popup').style.display = 'none';
}

// ==================== 🏆 ALL 15 ACHIEVEMENTS LIST ====================
const ALL_BADGES = [
    // 🟢 Consistency
    { id: 'ice_breaker', icon: '🧊', title: 'Ice Breaker', desc: 'पहला मॉक टेस्ट सबमिट किया।' },
    { id: '1_week_warrior', icon: '⚔️', title: '1-Week Warrior', desc: 'लगातार 7 दिन टेस्ट दिया।' },
    { id: '30_day_legend', icon: '👑', title: '30-Day Legend', desc: 'लगातार 30 दिन की स्ट्रीक।' },
    { id: 'weekend_hustler', icon: '📅', title: 'Weekend Hustler', desc: 'शनिवार और रविवार दोनों दिन टेस्ट दिया।' },
    
    // 🟢 Performance
    { id: 'grandmaster', icon: '📜', title: 'Grandmaster', desc: 'फुल-सिलेबस टेस्ट कम्पलीट किया।' },
    { id: 'accuracy_sniper', icon: '🎯', title: 'Accuracy Sniper', desc: 'टेस्ट में 90%+ एक्यूरेसी हासिल की।' },
    { id: 'khaki_pride', icon: '👮‍♂️', title: 'Khaki Pride', desc: 'HP Police में टॉप 10% स्कोर।' },
    { id: 'patwari_elite', icon: '✍️', title: 'Patwari Elite', desc: 'पटवारी टेस्ट में 100+ स्कोर।' },
    { id: 'speed_demon', icon: '⚡', title: 'Speed Demon', desc: 'पेपर समय से 20 मिनट पहले पूरा किया।' },
    
    // 🟢 Subject-Specific
    { id: 'hp_gk_scholar', icon: '🏔️', title: 'HP GK Scholar', desc: 'हिमाचल GK में 100% स्कोर।' },
    { id: 'vyakaran_guru', icon: '📚', title: 'Vyakaran Guru', desc: 'हिंदी/इंग्लिश ग्रामर में फुल मार्क्स।' },
    { id: 'logic_master', icon: '🧠', title: 'Logic Master', desc: 'रीज़निंग में कोई गलती नहीं।' },
    
    // 🟢 Quirky / Fun / Gen-Z Vibe
    { id: 'night_owl', icon: '🦉', title: 'Night Owl', desc: 'रात 12 बजे के बाद टेस्ट सबमिट किया।' },
    { id: 'early_bird', icon: '🌅', title: 'Early Bird', desc: 'सुबह 6 बजे से पहले टेस्ट दिया।' },
    { id: 'comeback_king', icon: '🥊', title: 'Comeback King', desc: 'पिछले टेस्ट से स्कोर में भारी उछाल।' },
    
    // 👇 यहाँ से नए Gen-Z बैज शुरू 👇
    { id: 'let_him_cook', icon: '🔥', title: 'Let Him Cook', desc: 'स्कोर लगातार इम्प्रूव हो रहा है। The Cooking Master , let him cook!' },
    { id: 'touch_grass', icon: '🌱', title: 'Touch Grass', desc: 'एक दिन में 4 टेस्ट दे दिए। अब थोड़ा फोन छोड़कर बाहर घूम आओ ब्रो!' },
    { id: 'massive_w', icon: '🏆', title: 'Massive W', desc: 'No Cap 🧢! तुम्हारा स्कोर एकदम FIRE है। Absolute W!' },
    { id: 'exam_op', icon: '🎮', title: 'Exam OP', desc: 'OverPowered Ekdum Overpowered (OP) थी!' }
];

// ==================== 🛠️ RENDER TROPHY CABINET ====================
// यह फंक्शन डेटाबेस से जीते हुए बैज की लिस्ट लेगा और ग्रिड में भर देगा
function renderTrophyCabinet(unlockedBadgeIds = []) {
    const grid = document.getElementById('badges-grid');
    if (!grid) return;
    
    grid.innerHTML = ''; // पुराना कचरा साफ़ करो
    
    ALL_BADGES.forEach(badge => {
        const isUnlocked = unlockedBadgeIds.includes(badge.id);
        
        if (isUnlocked) {
            // 🔓 UNLOCKED STYLE (रंगीन और चमकता हुआ)
            grid.innerHTML += `
                <div class="golden-shine-effect" style="background: linear-gradient(145deg, #1e293b, #0f172a); padding: 15px 10px; border-radius: 10px; border: 1px solid #f59e0b; transition: transform 0.2s;" title="${badge.desc}">
                    <div style="font-size: 32px; margin-bottom: 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${badge.icon}</div>
                    <div style="color: #f8fafc; font-size: 12px; font-weight: bold;">${badge.title}</div>
                    <div style="color: #10b981; font-size: 10px; margin-top: 4px;">Unlocked</div>
                </div>
            `;
        } else {
            // 🔒 LOCKED STYLE (ब्लैक एंड वाइट और धुंधला)
            grid.innerHTML += `
                <div style="background: #1e293b; padding: 15px 10px; border-radius: 10px; border: 1px solid #334155; filter: grayscale(100%); opacity: 0.4;" title="${badge.desc}">
                    <div style="font-size: 32px; margin-bottom: 8px;">${badge.icon}</div>
                    <div style="color: #94a3b8; font-size: 12px; font-weight: bold;">${badge.title}</div>
                    <div style="color: #64748b; font-size: 10px; margin-top: 4px;"><i class="fa-solid fa-lock"></i> Locked</div>
                </div>
            `;
        }
    });
}
// पेज लोड होते ही मशीन को चालू करो (अभी जीते हुए बैज की लिस्ट खाली [] है)
// ==================== 📡 FETCH ACHIEVEMENTS FROM SUPABASE ====================
async function loadUserAchievements() {
    // यूज़र की ID निकालें (ताकि पता चले कि किसका डेटा लाना है)
    const userId = window.CURRENT_USER_PROFILE?.id || (typeof currentUserId !== 'undefined' ? currentUserId : null);
    
    // अगर यूज़र लॉग-इन नहीं है, तो सब लॉक कर दो
    if (!userId) {
        renderTrophyCabinet([]);
        return;
    }

    try {
        // Supabase के profiles टेबल से unlocked_badges कॉलम लाएं
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('unlocked_badges')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // अगर यूज़र के पास जीते हुए बैज हैं, तो उन्हें मशीन में डालो
        if (data && data.unlocked_badges) {
            renderTrophyCabinet(data.unlocked_badges);
        } else {
            // अगर एक भी बैज नहीं जीता है, तो खाली लिस्ट भेज दो
            renderTrophyCabinet([]);
        }
    } catch (err) {
        console.error("बैज लोड करने में दिक्कत हुई:", err);
        renderTrophyCabinet([]); // एरर आने पर सब लॉक दिखा दो
    }
}

// पेज लोड होते ही डेटाबेस से असली बैज चेक करो
setTimeout(() => {
    loadUserAchievements();
}, 1000); // 1 सेकंड का डिले ताकि Supabase पहले लोड हो जाए

// ==================== 💾 SAVE BADGE TO SUPABASE ====================
async function awardBadgeToUser(badgeId, icon, title, description) {
    const userId = currentUserId || window.CURRENT_USER_PROFILE?.id;
    if (!userId || userId === "test-user-123") return;

    try {
        // 1. Fetch user profile from Supabase
        const { data: profile, error: fetchErr } = await supabaseClient
            .from('profiles')
            .select('unlocked_badges')
            .eq('id', userId)
            .single();

        if (fetchErr) {
            console.error("Error fetching badges:", fetchErr);
            return;
        }

        let existingBadges = profile?.unlocked_badges || [];
        
        // Don't award if already unlocked
        if (existingBadges.includes(badgeId)) {
            return;
        }

        // 2. Add new badge to list
        existingBadges.push(badgeId);

        // 3. Update database
        const { error: updateErr } = await supabaseClient
            .from('profiles')
            .update({ unlocked_badges: existingBadges })
            .eq('id', userId);

        if (updateErr) {
            console.error("Database update failed:", updateErr);
            return;
        }

        // 4. Trigger Celebration Pop-up & Update Grid live
        showAchievementUnlock(icon, title, description);
        renderTrophyCabinet(existingBadges);

    } catch (err) {
        console.error("Award badge error:", err);
    }
}

// ==================== 🎯 FULL 19-BADGES CHECKER LOGIC ====================
async function checkAchievements({
    totalQuestions = 0,
    attempted = 0,
    correctAnswers = 0,
    examCategory = '',
    timeTakenSeconds = 0,
    totalAllowedSeconds = 0,
    sectionStats = {},
    dailyTestsCountToday = 1,
    streakDays = 1,
    previousTestScore = null
}) {
    const accuracy = attempted > 0 ? (correctAnswers / attempted) * 100 : 0;
    const scorePercent = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    // 🟢 1. Consistency & Streaks
    // 🧊 Ice Breaker
    awardBadgeToUser('ice_breaker', '🧊', 'Ice Breaker', 'First mock test submitted! Welcome to the grind.');

    // ⚔️ 1-Week Warrior
    if (streakDays >= 7) {
        awardBadgeToUser('week_warrior', '⚔️', '1-Week Warrior', '7-day test streak completed! Absolute consistency.');
    }

    // 👑 30-Day Legend
    if (streakDays >= 30) {
        awardBadgeToUser('month_legend', '👑', '30-Day Legend', '30 Days of non-stop prep! Legendary discipline.');
    }

    // 📅 Weekend Hustler
    if (currentDay === 0 || currentDay === 6) {
        awardBadgeToUser('weekend_hustler', '📅', 'Weekend Hustler', 'No chill on weekends! Pure dedication.');
    }

    // 🟢 2. High Performance & Speed
    // 📜 Grandmaster
    if (totalQuestions >= 100) {
        awardBadgeToUser('grandmaster', '📜', 'Grandmaster', 'Completed a full 100-question marathon test!');
    }

    // 🎯 Accuracy Sniper
    if (attempted >= 10 && accuracy >= 90) {
        awardBadgeToUser('accuracy_sniper', '🎯', 'Accuracy Sniper', `${accuracy.toFixed(1)}% accuracy! Precision on point.`);
    }

    // 👮‍♂️ Khaki Pride
    if (examCategory.toLowerCase().includes('police') && scorePercent >= 80) {
        awardBadgeToUser('khaki_pride', '👮‍♂️', 'Khaki Pride', 'Crushed the HP Police test with 80%+ score!');
    }

    // ✍️ Patwari Elite
    if (examCategory.toLowerCase().includes('patwari') && scorePercent >= 85) {
        awardBadgeToUser('patwari_elite', '✍️', 'Patwari Elite', '85%+ in Patwari mock! Elite tier performance.');
    }

    // ⚡ Speed Demon
    const timeSavedSeconds = totalAllowedSeconds - timeTakenSeconds;
    if (totalAllowedSeconds > 0 && timeSavedSeconds >= 1200 && scorePercent >= 70) {
        awardBadgeToUser('speed_demon', '⚡', 'Speed Demon', 'Finished 20 mins early with 70%+ score. Fast & Furious!');
    }

    // 🟢 3. Subject Mastery
    // 🏔️ HP GK Scholar
    if (sectionStats.hp_gk && sectionStats.hp_gk.total >= 10 && sectionStats.hp_gk.correct === sectionStats.hp_gk.total) {
        awardBadgeToUser('hp_gk_scholar', '🏔️', 'HP GK Scholar', '100% correct in HP GK! Himachal GK boss.');
    }

    // 📚 Vyakaran Guru
    if (sectionStats.vyakaran && sectionStats.vyakaran.total >= 10 && sectionStats.vyakaran.correct === sectionStats.vyakaran.total) {
        awardBadgeToUser('vyakaran_guru', '📚', 'Vyakaran Guru', 'Full marks in grammar section! Pure mastery.');
    }

    // 🧠 Logic Master
    if (sectionStats.reasoning && sectionStats.reasoning.total >= 10 && sectionStats.reasoning.correct === sectionStats.reasoning.total) {
        awardBadgeToUser('logic_master', '🧠', 'Logic Master', 'Flawless reasoning score! 100% brain power.');
    }

    // 🟢 4. Gen-Z & Quirky Badges
    // 🦉 Night Owl
    if (currentHour >= 0 && currentHour < 4) {
        awardBadgeToUser('night_owl', '🦉', 'Night Owl', 'Testing at 2 AM? Late night hustle hits different.');
    }

    // 🌅 Early Bird
    if (currentHour >= 4 && currentHour < 6) {
        awardBadgeToUser('early_bird', '🌅', 'Early Bird', 'Morning grind before sunrise! True sigma mode.');
    }

    // 🥊 Comeback King
    if (previousTestScore !== null && (scorePercent - previousTestScore >= 20)) {
        awardBadgeToUser('comeback_king', '🥊', 'Comeback King', 'Jumped +20% score from last test. Huge comeback!');
    }

    // 🔥 Let Him Cook
    if (scorePercent >= 75) {
        awardBadgeToUser('let_him_cook', '🔥', 'Let Him Cook', 'Score is heating up. Don\'t disturb, let him cook!');
    }

    // 🌱 Touch Grass
    if (dailyTestsCountToday >= 4) {
        awardBadgeToUser('touch_grass', '🌱', 'Touch Grass', '4 tests today? Bhai ab thoda bahar ghoom ke fresh air le lo!');
    }

    // 🏆 Massive W
    if (scorePercent >= 80) {
        awardBadgeToUser('massive_w', '🏆', 'Massive W', '80%+ score unlocked! No Cap 🧢, absolute W.');
    }

    // 🎮 Exam OP
    if (totalQuestions >= 10 && correctAnswers === totalQuestions) {
        awardBadgeToUser('exam_op', '🎮', 'Exam OP', '100% Perfect Score! Overpowered vibes only.');
    }
}

// =========================================================================
// 🔥 DAILY STREAK ENGINE (FIXED COLUMN NAMES)
// =========================================================================
async function processUserStreak() {
    console.log("🔥 [Streak] processUserStreak trigger hua!");

    const userId = currentUserId || window.CURRENT_USER_PROFILE?.id;
    console.log("🔥 [Streak] Current User ID mila:", userId);

    if (!userId || userId === "test-user-123") {
        console.warn("⚠️ [Streak] User ID nahi mili ya test-user hai, aborting update.");
        return 1;
    }

    try {
        // 1. Supabase से current_streak और last_test_date लाओ
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('current_streak, last_test_date')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("❌ [Streak] Fetch profile error from Supabase:", error);
            return 1;
        }

        console.log("🔥 [Streak] Purana profile data mila:", profile);

        const today = new Date();
        const todayDateStr = today.toISOString().split('T')[0];
        
        let streak = profile?.current_streak || 0;
        const lastDateStr = profile?.last_test_date ? new Date(profile.last_test_date).toISOString().split('T')[0] : null;

        if (!lastDateStr) {
            streak = 1;
        } else if (lastDateStr === todayDateStr) {
            console.log("🔥 [Streak] Aaj hi test diya hai pehle bhi, streak same rahegi.");
            return streak;
        } else {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayDateStr = yesterday.toISOString().split('T')[0];

            if (lastDateStr === yesterdayDateStr) {
                streak += 1;
            } else {
                streak = 1;
            }
        }

        console.log(`🔥 [Streak] Updating database with current_streak: ${streak}...`);

        // 2. Supabase में सही कॉलम (current_streak) अपडेट करो
        const { error: updateErr } = await supabaseClient
            .from('profiles')
            .update({
                current_streak: streak,
                last_test_date: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateErr) {
            console.error("❌ [Streak] Supabase update fail hua:", updateErr);
            return;
        }

        console.log("✅ [Streak] Database mein kamyabi se update ho gaya!");
        // स्क्रीन पर लाइव स्ट्रीक नंबर अपडेट करो
        renderStreakUI(streak);

        // 3. Badges check
        if (streak >= 7) {
            awardBadgeToUser('week_warrior', '⚔️', '1-Week Warrior', '7-day test streak completed! Absolute consistency.');
        }
        if (streak >= 30) {
            awardBadgeToUser('month_legend', '👑', '30-Day Legend', '30 Days of non-stop prep! Legendary discipline.');
        }

        return streak;

    } catch (err) {
        console.error("❌ [Streak] Unexpected crash error:", err);
        return 1;
    }
}

// ==================== 🖥️ RENDER STREAK ON UI ====================
function renderStreakUI(streakCount) {
    const streakDisplay = document.getElementById('user-streak-display');
    const streakCountEl = document.getElementById('streak-days-count');
    
    if (streakCountEl) {
        streakCountEl.innerText = streakCount || 0;
    }
    
    // अगर स्ट्रीक 3 से ज्यादा हो तो एक्स्ट्रा फ्लेम ग्लो
    if (streakDisplay && streakCount >= 3) {
        streakDisplay.style.boxShadow = "0 0 12px rgba(255, 107, 0, 0.4)";
        streakDisplay.style.borderColor = "#ff6b00";
    }
}

// जब प्रोफाइल लोड हो तो स्क्रीन पर स्ट्रीक दिखाओ
if (window.CURRENT_USER_PROFILE?.current_streak) {
    renderStreakUI(window.CURRENT_USER_PROFILE.current_streak);
}

// ==================== 🔥 SHOW STREAK TOAST ====================
function showStreakToast(days) {
    const toast = document.getElementById('streak-toast');
    const daysEl = document.getElementById('toast-streak-days');
    
    if (!toast) return;
    
    if (daysEl) daysEl.innerText = days;
    
    toast.style.display = 'flex';
    
    // 3.5 सेकंड बाद अपने-आप गायब हो जाएगा
    setTimeout(() => {
        toast.style.animation = 'slideInToast 0.4s ease-in reverse';
        setTimeout(() => {
            toast.style.display = 'none';
            toast.style.animation = 'slideInToast 0.4s ease-out';
        }, 380);
    }, 3500);
}
