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
        titleEl.innerText = examType === 'patwari' ? 'Patwari Exam Mode' : 'JOA IT Exam Mode';
    }
    
    try {
        const response = await fetch(`https://hp-exam-pro.onrender.com/api/questions/${examType}?user_id=${userId}&t=${Date.now()}`);

        
        // 🧼 डेटा आते ही लोडिंग ओवरले को स्क्रीन से तुरंत हटा दें
        if (document.getElementById('quiz-cloud-loader')) document.getElementById('quiz-cloud-loader').remove();
        
        // बटन्स को वापस नॉर्मल स्टेट में लाएं
        examButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = "1";
        });
        
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
        if (data && data.length > 0) {
            currentQuestions = data; 
            currentQuestionIndex = 0;
            userAnswers = {};
            totalQuizTimeSeconds = 5400; 

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

function displayQuestion() {
    if (!currentQuestions || currentQuestions.length === 0) return;

    const currentQ = currentQuestions[currentQuestionIndex];
    
    document.getElementById('current-q-num').innerText = currentQuestionIndex + 1;
    document.getElementById('quiz-question-text').innerText = currentQ.question_text || currentQ.question;

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
        
        // 🎨 बटन्स की फॉर्मेटिंग को सीधा जावास्क्रिप्ट से कड़क डार्क मोड लुक दे दिया है
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
        
        // नंबर काउंट के लिए सुंदर ब्लू स्क्वायर बैज
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

    
    document.getElementById('final-score').innerText = correctCount;
    document.getElementById('stat-correct').innerText = correctCount;
    document.getElementById('stat-wrong').innerText = wrongCount;
    
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

    try {
        await fetch('https://hp-exam-pro.onrender.com/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                exam_type: selectedExamType,
                score: correctCount,
                correct_answers: correctCount,
                wrong_answers: wrongCount
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
        targetPage.style.display = 'block';
        
        if (pageId === 'analytics-page') {
            loadAnalyticsData();
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
        const response = await fetch(`https://hp-exam-pro.onrender.com/api/analytics/${userId}`);
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
        const response = await fetch('https://hp-exam-pro.onrender.com/api/query/raise', {
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

// ==================== 💳 PREMIUM RAZORPAY CHECKOUT SYSTEM ====================

async function initiateProPayment() {
    const userProfile = window.CURRENT_USER_PROFILE;
    const userId = currentUserId || userProfile?.id;

    if (!userId) {
        alert("⚠️ कृपया पेमेंट करने से पहले लॉगिन करें!");
        return;
    }

    try {
        // 1. बैकएंड से रेज़रपे का ऑर्डर आईडी (Order ID) जनरेट करवाना
        const orderResponse = await fetch('https://hp-exam-pro.onrender.com/api/payment/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });

        if (!orderResponse.ok) throw new Error("ऑर्डर जनरेट करने में विफलता!");
        const orderData = await orderResponse.json();

        if (orderData.status !== "success") {
            alert("सर्वर से ऑर्डर आईडी नहीं मिल पाई।");
            return;
        }

        // 2. रेज़रपे चेकआउट पॉपअप (Modal) की कॉन्फ़िगरेशन सेट करना
        const options = {
            "key": "rzp_test_Sq35OFh2B20luk", // 🔥 तुम्हारी स्क्रीनशॉट वाली Key ID यहाँ फिट कर दी है
            "amount": orderData.amount,
            "currency": orderData.currency,
            "name": "HP EXAM PRO",
            "description": "Premium Pro Access (15 Tests/Month)",
            "image": "https://hp-exam-pro.vercel.app/favicon.ico", // आपके ऐप का लोगो (ऑप्शनल)
            "order_id": orderData.order_id,
            
            // पेमेंट सक्सेस होने पर यह हैंडलर खुद-ब-खुद ट्रिगर होगा
            "handler": async function (response) {
                // स्क्रीन पर छोटा सा लोडिंग संकेत दिखाएं
                alert("🔒 पेमेंट सफल! सर्वर पर आपका प्रो स्टेटस वेरीफाई किया जा रहा है...");

                // 3. बैकएंड पर सिग्नेचर वेरिफिकेशन के लिए डेटा भेजना
                const verifyResponse = await fetch('https://hp-exam-pro.onrender.com/api/payment/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    })
                });

                const verifyData = await verifyResponse.json();
                if (verifyData.status === "success") {
                    alert("👑 बधाई हो भाई! " + verifyData.message);
                    // तुरंत पेज को रीलोड कर देंगे ताकि यूजर को क्राउन आइकन लाइव दिख जाए
                    window.location.reload();
                } else {
                    alert("❌ वेरिफिकेशन फेल: " + verifyData.detail);
                }
            },
            "prefill": {
                "email": userProfile?.email || ""
            },
            "theme": {
                "color": "#2563eb" // आपके ऐप की सुंदर ब्लू थीम का मैचिंग कलर
            }
        };

        // 3. रेज़रपे का गेटवे स्क्रीन पर खोलना
        const rzp1 = new Razorpay(options);
        rzp1.open();

    } catch (error) {
        console.error("Payment Gateway Error:", error);
        alert("पेमेंट सिस्टम से कनेक्ट करने में दिक्कत आई! कृपया बैकएंड लॉग्स चेक करें।");
    }
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
        const response = await fetch('https://hp-exam-pro.onrender.com/api/daily-question');
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
