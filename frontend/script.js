// --- 1. SUPABASE CONNECTION ---
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"; 
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// --- 1. GLOBAL VARIABLES ---
let currentQuestions = [];      
let currentQuestionIndex = 0;   
let userAnswers = {};           
let quizTimerInterval = null;   
let totalQuizTimeSeconds = 5400; 
let selectedExamType = "";      
let currentUserId = ""; // लॉगिन के बाद यहाँ Supabase से ID आएगी

// --- 2. AUTHENTICATION (Login/Signup) ---

async function handleSignup() {
    // 1. पहले इनपुट से ईमेल और पासवर्ड की वैल्यू उठाएं
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-pass').value.trim();

    // 2. अब फंक्शन के अंदर यह सुरक्षा कवच (Check) काम करेगा
    if (!email || !password) {
        document.getElementById('auth-error').innerText = "कृपया ईमेल और पासवर्ड दोनों भरें!";
        return; // अब यह फंक्शन के अंदर है, इसलिए बिल्कुल सही है!
    }

    // 3. अगर दोनों बॉक्स भरे हैं, तो सुपाबेस में अकाउंट बनेगा
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
        document.getElementById('auth-error').innerText = "Login Error: " + error.message;
    } else {
        checkUserSession();
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

        // 👑 Admin Check
        // setupUserProfile के अंदर एडमिन वाला हिस्सा ऐसे बदलें:

if (profile.is_admin === true) {
    // 1. डेस्कटॉप वाला DIV पकड़ें (data-page से)
    const desktopAdminItem = document.querySelector('.nav-item[data-page="admin"]');
    
    // 2. मोबाइल वाला लिंक पकड़ें (href से)
    const mobileAdminLink = document.querySelector('#mobile-sidebar a[href="admin.html"]');

    // दोनों को एक एरे (Array) में डालकर लूप चलाएं
    [desktopAdminItem, mobileAdminLink].forEach(element => {
        if (element) {
            element.style.display = 'flex'; // साइडबार आइटम आमतौर पर flex होते हैं
            
            // क्लिक करने पर admin.html पर भेजें
            element.onclick = (e) => {
                e.preventDefault();
                console.log("Navigating to Admin Panel...");
                window.location.href = 'admin.html';
            };
        }
    });

    console.log("Admin Panel Unlocked! 👑");
}


        // 💎 Pro Status Check
        checkProStatus(profile);

        // UI Updates
        const welcomeText = document.getElementById('welcome-text');
        if (welcomeText) welcomeText.innerText = `नमस्ते, ${profile.display_name}`;

        const displayNameEl = document.getElementById('display-name');
        const userInitialEl = document.getElementById('user-initial');
        if (displayNameEl) displayNameEl.innerText = profile.display_name;
        if (userInitialEl) userInitialEl.innerText = profile.display_name[0].toUpperCase();

        // AI Welcome Message
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

// --- 3. PAGE LOGIC & NEWS ---
window.onload = () => {
    checkUserSession();
    const examDate = new Date("2026-06-07");
    const diff = Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24));
    const countdownEl = document.getElementById('patwari-countdown');
    if(countdownEl) countdownEl.innerText = diff > 0 ? diff + " Days Left" : "Exam Today!";
    loadRealNews();
};

async function loadRealNews() {
    const newsTextEl = document.getElementById('current-affairs-text');
    if (!newsTextEl) return;

    try {
        const response = await fetch('https://hp-exam-pro.onrender.com/api/news?t=' + Date.now());
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
        console.error("News Error:", e);
        newsTextEl.innerText = "ताज़ा खबरों के लिए रिफ्रेश करें।";
    }
}

// --- CHAT LOGIC ---
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
    const avatar = sender === 'user' 
        ? `<div class="avatar" style="background:#2563eb; color:white; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">${window.CURRENT_USER_PROFILE.display_name[0].toUpperCase()}</div>` 
        : `<div class="bot-avatar-logo"><div class="mountain-peak"></div><div class="book-base"></div></div>`;
    
    const content = sender === 'ai' ? marked.parse(text) : text.replace(/\n/g, '<br>');
    wrap.innerHTML = `${avatar}<div class="bubble">${content}</div>`;
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addLoader() {
    const id = 'l-' + Date.now();
    const div = document.createElement('div');
    div.id = id; div.className = 'message-wrapper ai';
    const botLogo = `<div class="bot-avatar-logo"><div class="mountain-peak"></div><div class="book-base"></div></div>`;
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


// ==================== 3. LIVE QUIZ ENGINE & TIMED TEST ====================

// A. बैकएंड से 120 सवाल लेकर टेस्ट शुरू करना
async function startMockTest(examType) {
    selectedExamType = examType;
    
    if (!currentUserId) {
        currentUserId = "test-user-123"; // डमी आईडी टेस्टिंग के लिए
    }
    
    const titleEl = document.getElementById('quiz-exam-title');
    if (titleEl) {
        titleEl.innerText = examType === 'patwari' ? 'Patwari Exam Mode' : 'JOA IT Exam Mode';
    }
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/mock-test/generate?user_id=${currentUserId}&exam_type=${examType}`);
        
        // Freemium Lock Checking (Status 403)
        if (response.status === 403) {
            const errorData = await response.json();
            alert(`👑 Pro Feature: ${errorData.detail}`);
            
            // सीधे प्रो-एक्सेस वाले पेज पर रीडायरेक्ट करना
            const proPage = document.getElementById('pro-access-page');
            if (proPage) {
                document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
                proPage.classList.add('active');
            }
            return;
        }

        const data = await response.json();
        if (data.status === "success" && data.questions.length > 0) {
            currentQuestions = data.questions;
            currentQuestionIndex = 0;
            userAnswers = {};
            totalQuizTimeSeconds = 5400; // 90 मिनट रिसेट

            document.getElementById('exam-selection-view').style.display = 'none';
            document.getElementById('active-quiz-view').style.display = 'block';

            startQuizTimer();
            displayQuestion();
        } else {
            alert("Sawal load nahi ho paye. Kripya check karein!");
        }

    } catch (error) {
        console.error("Test start karne mein error:", error);
        alert("Server se connect nahi ho pa rha hai! Pehle uvicorn server start karein.");
    }
}

// B. Live 90-Minute Countdown Timer
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

// C. ब्लैकबोर्ड पर करंट सवाल और ऑप्शंस रेंडर करना
function displayQuestion() {
    if (currentQuestions.length === 0) return;

    const currentQ = currentQuestions[currentQuestionIndex];
    
    document.getElementById('current-q-num').innerText = currentQuestionIndex + 1;
    document.getElementById('quiz-question-text').innerText = currentQ.question_text;

    const progressPercent = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    document.getElementById('quiz-progress-fill').style.width = `${progressPercent}%`;

    const optionsWrapper = document.getElementById('quiz-options-wrapper');
    optionsWrapper.innerHTML = ""; 

    for (let i = 1; i <= 4; i++) {
        const optionText = currentQ[`opt${i}`];
        if (!optionText) continue;

        const optionKey = `opt${i}`;
        const isSelected = userAnswers[currentQ.id] === optionKey;

        const optionButton = document.createElement('button');
        optionButton.className = `option-btn ${isSelected ? 'selected' : ''}`;
        optionButton.innerHTML = `<span class="opt-prefix">${i}</span> <span class="opt-text">${optionText}</span>`;
        
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
        nextBtn.onclick = submitMockTest; 
    } else {
        nextBtn.innerHTML = `Next <i class="fa-solid fa-arrow-right"></i>`;
        nextBtn.onclick = () => navigateQuestion(1);
    }
}

// D. Next / Previous बटन नेविगेशन
function navigateQuestion(direction) {
    currentQuestionIndex += direction;
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;
    if (currentQuestionIndex >= currentQuestions.length) currentQuestionIndex = currentQuestions.length - 1;
    
    displayQuestion();
}

// E. टेस्ट सबमिट करना और स्कोर कैलकुलेट करना
async function submitMockTest() {
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    
    let correctCount = 0;
    let wrongCount = 0;
    
    currentQuestions.forEach(q => {
        const chosen = userAnswers[q.id];
        const correct = q.correct_option || q.answer; // CSV कॉलम के आधार पर
        
        if (chosen === correct) {
            correctCount++;
        } else if (chosen) {
            wrongCount++;
        }
    });
    
    // रिजल्ट स्कोरकार्ड UI को अपडेट करना
    document.getElementById('final-score').innerText = correctCount;
    document.getElementById('stat-correct').innerText = correctCount;
    document.getElementById('stat-wrong').innerText = wrongCount;
    
    // क्विज़ रूम छुपाएं और रिजल्ट दिखाएं
    document.getElementById('active-quiz-view').style.display = 'none';
    document.getElementById('quiz-result-view').style.display = 'block';
    
    // बैकएंड में स्कोर और एटेम्पट डेटा सेव करना
    try {
        await fetch('http://127.0.0.1:8000/api/mock-test/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUserId,
                exam_type: selectedExamType,
                score: correctCount,
                total_qs: currentQuestions.length,
                correct_answers: correctCount,
                wrong_answers: wrongCount
            })
        });
    } catch (error) {
        console.error("Data save karne mein error aaya:", error);
    }
}

// F. रिजल्ट पेज से वापस मुख्य परीक्षा चयन पेज पर जाना
function resetToSelection() {
    document.getElementById('quiz-result-view').style.display = 'none';
    document.getElementById('exam-selection-view').style.display = 'block';
}
// ==================== 5. NAVIGATION SWITCH CONTROLLER ====================
function switchTab(pageId) {
    // 1. स्क्रीन पर जितने भी पेजेस हैं, उन सबको छुपा दो
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // 2. जिस पेज की ID हमने भेजी है, सिर्फ उसे सामने लाओ
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        
        // 3. अगर मॉक टेस्ट वाला पेज खुला है, तो उसके अंदर एग्जाम सिलेक्शन (कार्ड्स) दिखें
        if (pageId === 'mock-tests-page') {
            if (document.getElementById('exam-selection-view')) document.getElementById('exam-selection-view').style.display = 'block';
            if (document.getElementById('active-quiz-view')) document.getElementById('active-quiz-view').style.display = 'none';
            if (document.getElementById('quiz-result-view')) document.getElementById('quiz-result-view').style.display = 'none';
        }
    }
}
// ==================== 6. MOBILE HAMBURGER MENU TOGGLE (BULLETPROOF) ====================
window.toggleMenu = function() {
    console.log("🍔 Hamburger Menu clicked successfully!"); // Isse pata chalega click kaam kar rha hai
    
    const mobileSidebar = document.getElementById('mobile-sidebar');
    if (mobileSidebar) {
        mobileSidebar.classList.toggle('open');
        console.log("Sidebar status toggle ho gya hai.");
    } else {
        console.error("Error: 'mobile-sidebar' ID wala dabba HTML mein nahi mila!");
    }
}
