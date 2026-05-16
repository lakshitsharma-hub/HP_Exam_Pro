// --- 1. SUPABASE CONNECTION ---
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"; 
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// --- 1. GLOBAL VARIABLES ---
let quizQuestions = [];      
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
// A. बैकएंड से असली सवाल लेकर टेस्ट शुरू करना
async function startMockTest(examType) {
    selectedExamType = examType;
    const userId = currentUserId || window.CURRENT_USER_PROFILE?.id || "test-user-123";
    
    const titleEl = document.getElementById('quiz-exam-title');
    if (titleEl) {
        titleEl.innerText = examType === 'patwari' ? 'Patwari Exam Mode' : 'JOA IT Exam Mode';
    }
    
    try {
        // 🔥 1. URL को Render लाइव सर्वर से बदल दिया गया है
        const response = await fetch(`https://hp-exam-pro.onrender.com/api/questions/${examType}?user_id=${userId}`);
        
        // Freemium Lock Checking (Status 403)
        if (response.status === 403) {
            const errorData = await response.json();
            alert(`👑 Pro Feature: ${errorData.detail}`);
            
            const proPage = document.getElementById('pro-access-page');
            if (proPage) {
                document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
                proPage.classList.add('active');
            }
            return;
        }

        const data = await response.json();
        // 🔥 2. डेटा स्ट्रक्चर फिक्स कर दिया गया है
        if (data && data.length > 0) {
            currentQuestions = data; 
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
        alert("Server se connect nahi ho pa rha hai! Kripya internet check karein.");
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
    if (!currentQuestions || currentQuestions.length === 0) return;

    const currentQ = currentQuestions[currentQuestionIndex];
    
    document.getElementById('current-q-num').innerText = currentQuestionIndex + 1;
    // डेटाबेस से आने वाले सवाल का टेक्स्ट
    document.getElementById('quiz-question-text').innerText = currentQ.question_text || currentQ.question;

    const progressPercent = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    document.getElementById('quiz-progress-fill').style.width = `${progressPercent}%`;

    const optionsWrapper = document.getElementById('quiz-options-wrapper');
    optionsWrapper.innerHTML = ""; 

    // 4 ऑप्शंस को लूप से रेंडर करना
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

    // 🔥 नया सवाल आते ही पुराना आपत्ति बॉक्स छुप जाएगा
    const queryBox = document.getElementById('query-input-box');
    if(queryBox) queryBox.style.display = 'none';
    const queryText = document.getElementById('query-issue-text');
    if(queryText) queryText.value = '';

    renderQuestionPalette();
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
    
    // 🛡️ 🔥 MOCK TEST EXIT GUARD SECURITY LOGIC (बिल्कुल सबसे ऊपर) 🔥
    const activeQuizView = document.getElementById('active-quiz-view');
    if (activeQuizView && activeQuizView.style.display === 'block') {
        const confirmExit = confirm("⚠️ आपका मॉक टेस्ट अभी चल रहा है!\n\nक्या आप इस टेस्ट को SUBMIT करके दूसरे पेज पर जाना चाहते हैं?\n\n'OK' दबाने पर आपका टेस्ट करंट प्रोग्रेस के साथ सबमिट हो जाएगा, 'Cancel' दबाने पर टेस्ट वैसे ही चलता रहेगा।");
        
        if (confirmExit) {
            submitMockTest(); // ध्यान दें: इस कोड में आपके सबमिट फंक्शन का नाम 'submitMockTest' है
        } else {
            return; // 🛑 नेविगेशन को यहीं रोक देगा! यूजर उसी टेस्ट पेज पर रुका रहेगा और टाइमर चलता रहेगा।
        }
    }

    // 1. स्क्रीन पर जितने भी पेजेस हैं, उन सबको छुपा दो (आपका पुराना कोड)
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // 2. जिस पेज की ID हमने भेजी है, सिर्फ उसे सामने लाओ
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        
        // 🔥 यहाँ जुड़ेगा आपका लाइव एनालिटिक्स लोड करने का जादुई चेक:
        if (pageId === 'analytics-page') {
            loadAnalyticsData();
        }
        
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

// ==================== 7. LIVE QUIZ ENGINE CONFIGURATION ====================

//let quizQuestions = [];       // बैकएंड से आने वाले सवाल यहाँ जमा होंगे
//let currentQuestionIndex = 0; // छात्र अभी किस सवाल पर है
//let userAnswers = {};         // छात्र ने किस सवाल का क्या जवाब दिया
//let quizTimerInterval = null; 
//let totalQuizTimeSeconds = 5400; // 90 मिनट्स (पटवारी के लिए)

// A. टेस्ट शुरू करने का फंक्शन
async function startMockTest(examType) {
    try {
        // 1. बैकएंड से सवाल खींचना
        // 🔍 लाइन नंबर 484 को ढूँढकर इस तरह बदलें:
        const response = await fetch(`https://hp-exam-pro.onrender.com/api/questions/${examType}`);
        quizQuestions = await response.json();

        if (!quizQuestions || quizQuestions.detail) {
            alert("इस परीक्षा के सवाल अभी अपलोड नहीं हुए हैं!");
            return;
        }

        // 2. क्विज़ स्टेट रीसेट करना
        currentQuestionIndex = 0;
        userAnswers = {};
        totalQuizTimeSeconds = 5400; // रीसेट टाइमर
        
        // 3. स्क्रीन्स को आपस में बदलना
        document.getElementById('exam-selection-view').style.display = 'none';
        document.getElementById('active-quiz-view').style.display = 'block';
        // ✅ टेस्ट शुरू होते ही साइडबार के पुराने कार्ड्स छुपाएं और क्वेश्चन पैलेट दिखाएं
        document.getElementById('standard-sidebar-content').style.display = 'none';
        document.getElementById('quiz-navigation-palette').style.display = 'block';
        // पैलेट के सर्कल्स जनरेट करने वाले फंक्शन को कॉल करें
        renderQuestionPalette();

        document.getElementById('quiz-exam-title').innerText = examType === 'patwari' ? "HP Patwari Mock Test" : "HP JOA (IT) Mock Test";

        // 4. पहला सवाल दिखाना और टाइमर चालू करना
        displayCurrentQuestion();
        startQuizTimer();

    } catch (error) {
        console.error("क्विज़ शुरू करने में एरर:", error);
        alert("बैकएंड सर्वर चालू नहीं है या कनेक्शन में गड़बड़ है!");
    }
}

// B. स्क्रीन पर सवाल और उसके 4 ऑप्शंस दिखाना
function displayCurrentQuestion() {
    if (quizQuestions.length === 0) return;

    const currentQ = quizQuestions[currentQuestionIndex];
    
    // सवाल का टेक्स्ट सेट करना
    document.getElementById('current-q-num').innerText = currentQuestionIndex + 1;
    document.getElementById('quiz-question-text').innerText = currentQ.question;

    // ऑप्शंस के बटन्स बनाना
    const optionsWrapper = document.getElementById('quiz-options-wrapper');
    optionsWrapper.innerHTML = ""; // पुराना साफ़ करें

    currentQ.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.innerText = option;
        button.style.cssText = "padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: white; text-align: left; cursor: pointer; transition: all 0.2s;";

        // अगर छात्र ने यह ऑप्शन पहले से चुन रखा है तो उसे ब्लू कलर दें
        if (userAnswers[currentQuestionIndex] === index) {
            button.style.background = "#2563eb";
            button.style.borderColor = "#60a5fa";
        }

        // क्लिक होने पर ऑप्शन सेलेक्ट करना
        button.onclick = () => {
            userAnswers[currentQuestionIndex] = index;
            displayCurrentQuestion(); // स्क्रीन री-रेंडर करें ताकि सेलेक्टेड कलर दिखे
        };

        optionsWrapper.appendChild(button);
    });

    // प्रोग्रेस बार को अपडेट करना
    const progressPercent = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;
    document.getElementById('quiz-progress-fill').style.width = `${progressPercent}%`;

    // अगर आखिरी सवाल है तो 'Next' बटन को 'Submit Test' में बदलें
    const nextBtn = document.getElementById('next-q-btn');
    if (currentQuestionIndex === quizQuestions.length - 1) {
        nextBtn.innerText = "Submit Test";
        nextBtn.style.background = "#10b981";
        nextBtn.onclick = submitFinalQuiz;
    } else {
        nextBtn.innerText = "Next";
        nextBtn.style.background = "#2563eb";
        nextBtn.onclick = () => navigateQuestion(1);
    }
}

// C. आगे-पीछे (Next/Previous) जाने का लॉजिक
function navigateQuestion(direction) {
    currentQuestionIndex += direction;
    
    // बाउंड्री चेक (पहला या आखिरी सवाल)
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;
    if (currentQuestionIndex >= quizQuestions.length) currentQuestionIndex = quizQuestions.length - 1;

    displayCurrentQuestion();
}

// D. लाइव उल्टी गिनती (Timer) चलाना
function startQuizTimer() {
    clearInterval(quizTimerInterval);
    quizTimerInterval = setInterval(() => {
        totalQuizTimeSeconds--;
        
        if (totalQuizTimeSeconds <= 0) {
            clearInterval(quizTimerInterval);
            alert("समय समाप्त! आपका टेस्ट ऑटो-सबमिट हो रहा है।");
            submitFinalQuiz();
            return;
        }

        const mins = Math.floor(totalQuizTimeSeconds / 60);
        const secs = totalQuizTimeSeconds % 60;
        document.getElementById('quiz-timer').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }, 1000);
}

// E. टेस्ट सबमिट करना और स्कोर कैलकुलेट करना
// E. टेस्ट सबमिट करना और स्कोर कैलकुलेट करना + LIVE DATABASE SAVING
async function submitFinalQuiz() {
    clearInterval(quizTimerInterval); // टाइमर रोकें

    let correctCount = 0;
    let wrongCount = 0;

    quizQuestions.forEach((q, index) => {
        if (userAnswers[index] === q.correct) {
            correctCount++;
        } else if (userAnswers[index] !== undefined) {
            wrongCount++;
        }
    });

    const finalScore = correctCount; 

    // रिजल्ट स्क्रीन पर डेटा सेट करना
    document.getElementById('final-score').innerText = finalScore;
    document.getElementById('stat-correct').innerText = correctCount;
    document.getElementById('stat-wrong').innerText = wrongCount;

    // पर्दे बदलना
    document.getElementById('active-quiz-view').style.display = 'none';
    document.getElementById('quiz-result-view').style.display = 'block';

    // 🔥 LIVE DATABASE SAVING LOGIC 🔥
    // Agar chhatr login hai toh uski asli Id (currentUserId) lenges, nahi toh test-user-123
    const userId = currentUserId || "test-user-123"; 
    const examType = document.getElementById('quiz-exam-title').innerText.includes("Patwari") ? "patwari" : "joa_it";

    try {
        console.log("Saving score to Cloud Database via Render...");
        const saveResponse = await fetch(`https://hp-exam-pro.onrender.com/api/submit-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                exam_type: examType,
                score: finalScore,
                correct_answers: correctCount,
                wrong_answers: wrongCount
            })
        });
        const saveResult = await saveResponse.json();
        console.log("Score successfully saved in Supabase!", saveResult);
    } catch (error) {
        console.error("Database mein score save karne mein dikkat aayi:", error);
    }
}


// F. वापस डैशबोर्ड पर जाने का फंक्शन
function resetToSelection() {
    document.getElementById('quiz-result-view').style.display = 'none';
    document.getElementById('exam-selection-view').style.display = 'block';
}

// ==================== 8. ANALYTICS ENGINE (FETCH FROM RENDER) ====================
let performanceChartInstance = null; 

async function loadAnalyticsData() {
    // अगर छात्र लॉगइन है तो उसकी असली ID लेंगे, नहीं तो टेस्टिंग के लिए डमी ID
    const userId = currentUserId || "test-user-123";
    console.log("Fetching analytics for:", userId);
    
    try {
        // 🔥 सीधे आपके Render लाइव सर्वर से डेटा खींचना
        const response = await fetch(`https://hp-exam-pro.onrender.com/api/analytics/${userId}`);
        const data = await response.json();

        // डिब्बों में डेटा सेट करना
        if(document.getElementById('analytics-total-tests')) document.getElementById('analytics-total-tests').innerText = data.total_tests;
        if(document.getElementById('analytics-avg-score')) document.getElementById('analytics-avg-score').innerText = data.avg_score;
        if(document.getElementById('analytics-highest-score')) document.getElementById('analytics-highest-score').innerText = data.highest_score;
        if(document.getElementById('analytics-accuracy')) document.getElementById('analytics-accuracy').innerText = data.accuracy + "%";

        // --- GRAPH GENERATOR ---
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
                scales: { y: { min: 0, max: 120 } } // पटवारी के 120 मार्क्स का स्केल
            }
        });

    } catch (error) {
        console.error("Analytics लोड करने में गड़बड़ हुई:", error);
    }
}
// ==================== 🎯 QUESTION PALETTE & MOBILE TOGGLE LOGIC ====================

// A. पैलेट के सर्कल्स लाइव बनाने और उनपर क्लिक कराने का फंक्शन
function renderQuestionPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid || !quizQuestions) return;
    grid.innerHTML = ''; // Purana content saaf karein

    quizQuestions.forEach((_, index) => {
        const circle = document.createElement('div');
        circle.innerText = index + 1;

        // Gol buttons ki sunder dark styling
        circle.style.width = '38px';
        circle.style.height = '38px';
        circle.style.borderRadius = '50%';
        circle.style.display = 'flex';
        circle.style.alignItems = 'center';
        circle.style.justifyContent = 'center';
        circle.style.cursor = 'pointer';
        circle.style.fontSize = '14px';
        circle.style.fontWeight = 'bold';
        circle.style.transition = 'all 0.2s ease';

        // 🎨 Live Color Coding Conditions
        if (index === currentQuestionIndex) {
            circle.style.background = '#3b82f6'; // Jo sawal khula hai uske liye Blue
            circle.style.color = 'white';
            circle.style.boxShadow = '0 0 8px #3b82f6';
            circle.style.border = '2px solid #93c5fd';
        } else if (userAnswers[index] !== undefined) {
            circle.style.background = '#10b981'; // Jo sawal hal ho gya uske liye Green
            circle.style.color = 'white';
        } else {
            circle.style.background = '#475569'; // Bache hue sawalon ke liye Gray
            circle.style.color = '#cbd5e1';
        }

        // 🚀 Click karte hi seedhe us sawal par jump karein!
        // ✅ इसकी जगह सिर्फ इतना छोटा और साफ कोड पेस्ट कर दो:
circle.onclick = () => {
    currentQuestionIndex = index;
    displayCurrentQuestion(); 
    renderQuestionPalette();  
};
        grid.appendChild(circle);
    });
}

// B. मोबाइल पर पैलेट को छुपाने/दिखाने (Toggle) ka function
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
