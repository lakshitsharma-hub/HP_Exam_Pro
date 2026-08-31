// =========================================================
// 1. GLOBAL INITIALIZATION & CONFIGURATION
// =========================================================
const API_BASE_URL = "https://hp-exam-pro-dixk.onrender.com";
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co";
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif";

const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentAuthMode = 'login';
let currentUserId = localStorage.getItem("current_user_id") || null;
let currentProfile = null;
let performanceChartInstance = null;

// =========================================================
// 2. LIFECYCLE & APP BOOTSTRAP
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  const savedTheme = localStorage.getItem("hp_theme");
  if (savedTheme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    const icon = document.getElementById("themeIcon");
    if (icon) icon.innerText = "🌙";
  }

  await checkUserSession();
  loadDailyQuestion();
  loadRealNews();
  syncStreakOnPageLoad();
});

// =========================================================
// 3. AUTHENTICATION & SESSION MANAGEMENT (LAZY AUTH)
// =========================================================
function openAuthModal() {
  const overlay = document.getElementById("auth-overlay");
  if (overlay) overlay.style.display = "flex";
}

function closeAuthModal() {
  const overlay = document.getElementById("auth-overlay");
  if (overlay) overlay.style.display = "none";
  const err = document.getElementById("auth-error");
  if (err) err.style.display = "none";
}

function switchAuthTab(mode) {
  currentAuthMode = mode;
  const btn = document.getElementById("main-auth-btn");
  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const forgotLink = document.getElementById("forgot-pass-container");
  const err = document.getElementById("auth-error");

  if (err) err.style.display = "none";

  if (mode === "login") {
    btn.innerText = "Login to Workspace";
    if (forgotLink) forgotLink.style.display = "block";
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
  } else {
    btn.innerText = "Create Free Account";
    if (forgotLink) forgotLink.style.display = "none";
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
  }
}

async function handleAuthAction() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-pass").value.trim();
  const err = document.getElementById("auth-error");
  const btn = document.getElementById("main-auth-btn");

  if (!email || !password) {
    err.innerText = "कृपया ईमेल और पासवर्ड दोनों दर्ज करें!";
    err.style.display = "block";
    return;
  }

  btn.innerText = "Processing...";
  btn.disabled = true;

  try {
    if (currentAuthMode === "login") {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuthModal();
      await checkUserSession();
    } else {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      alert("✅ Registration Successful! Please login with your credentials.");
      switchAuthTab("login");
    }
  } catch (error) {
    err.innerText = error.message || "Authentication failed.";
    err.style.display = "block";
  } finally {
    btn.innerText = currentAuthMode === "login" ? "Login to Workspace" : "Create Free Account";
    btn.disabled = false;
  }
}

async function loginWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) alert("Google Login Error: " + error.message);
}

function triggerForgotPassword() {
  const email = document.getElementById("auth-email").value.trim();
  if (!email) {
    alert("पासवर्ड रीसेट करने के लिए पहले ईमेल बॉक्स में अपना ईमेल लिखें!");
    return;
  }
  supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  }).then(({ error }) => {
    if (error) alert("Error: " + error.message);
    else alert("📨 Password reset link has been sent to your email!");
  });
}

async function checkUserSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (session && session.user) {
    currentUserId = session.user.id;
    localStorage.setItem("current_user_id", currentUserId);

    let { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    const today = new Date().toDateString();

    if (!profile) {
      const fallbackName = session.user.email ? session.user.email.split('@')[0] : "Student";
      const { data: newProfile } = await supabaseClient.from('profiles').insert([
        { id: session.user.id, display_name: fallbackName, daily_count: 0, last_active: today, is_admin: false, is_pro: false }
      ]).select().single();
      profile = newProfile;
    }

    currentProfile = profile;
    window.CURRENT_USER_PROFILE = profile;
    localStorage.setItem("current_user_name", profile.display_name);
    updateUserNavUI(profile.display_name);
    loadUserAchievements();
  } else {
    currentUserId = null;
    currentProfile = null;
    window.CURRENT_USER_PROFILE = null;
    localStorage.removeItem("current_user_id");
    localStorage.removeItem("current_user_name");
    updateUserNavUI(null);
  }
}

function updateUserNavUI(username) {
  const nameEl = document.getElementById("currentUserId");
  const avatarEl = document.getElementById("userAvatarChar");
  const authBtn = document.getElementById("authNavBtn");

  if (username) {
    if (nameEl) nameEl.innerText = username;
    if (avatarEl) avatarEl.innerText = username.charAt(0).toUpperCase();
    if (authBtn) {
      authBtn.innerText = "Logout";
      authBtn.className = "nav-logout-btn";
    }
  } else {
    if (nameEl) nameEl.innerText = "Guest";
    if (avatarEl) avatarEl.innerText = "👤";
    if (authBtn) {
      authBtn.innerText = "Login";
      authBtn.className = "nav-logout-btn";
      authBtn.style.background = "rgba(56, 189, 248, 0.15)";
      authBtn.style.borderColor = "rgba(56, 189, 248, 0.3)";
      authBtn.style.color = "#38bdf8";
    }
  }
}

function handleAuthNavClick() {
  if (currentUserId) {
    if (confirm("क्या आप सच में Logout करना चाहते हैं?")) {
      supabaseClient.auth.signOut().then(() => {
        localStorage.clear();
        window.location.reload();
      });
    }
  } else {
    openAuthModal();
  }
}

// =========================================================
// 4. PROTECTED NAVIGATION CONTROLLER
// =========================================================
function handleProtectedExam(examType) {
  if (!currentUserId) {
    openAuthModal();
    return;
  }
  window.location.href = `test-arena.html?exam=${encodeURIComponent(examType)}`;
}

function handleProtectedNav(targetUrl) {
  if (!currentUserId) {
    openAuthModal();
    return;
  }
  window.location.href = targetUrl;
}

function openSection(sectionName) {
  if (!currentUserId) {
    openAuthModal();
    return;
  }

  document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));
  document.getElementById("home-content-view").style.display = "none";
  document.getElementById("analytics-view").style.display = "none";
  document.getElementById("leaderboard-view").style.display = "none";

  if (sectionName === "Analytics") {
    const target = document.getElementById("analytics-view");
    target.style.display = "flex";
    loadAnalyticsData();
    loadAttemptedHistory();
    target.scrollIntoView({ behavior: "smooth" });
  } else if (sectionName === "Leaderboard") {
    const target = document.getElementById("leaderboard-view");
    target.style.display = "flex";
    const filterVal = document.getElementById("leaderboardExamFilter")?.value || "hp_police";
    renderLeaderboardData(filterVal);
    loadUserAchievements();
    target.scrollIntoView({ behavior: "smooth" });
  }
}

function showMainHome() {
  document.getElementById("analytics-view").style.display = "none";
  document.getElementById("leaderboard-view").style.display = "none";
  document.getElementById("home-content-view").style.display = "block";
  document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));
}

function scrollToMockTests(e) {
  if (e) e.preventDefault();
  showMainHome();
  const target = document.getElementById("exams-anchor");
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  }
}

// =========================================================
// 5. WEEKLY RESET LEADERBOARD ENGINE
// =========================================================
const ghostLeaderboards = {
  'hp_police': [
    { name: "rahul.sharma99", baseScore: 71.00 },
    { name: "priya.s12", baseScore: 68.25 },
    { name: "vikas.k87", baseScore: 65.50 },
    { name: "amitkumar_87", baseScore: 64.00 },
    { name: "neha_verma23", baseScore: 61.25 },
    { name: "suresh.hp", baseScore: 59.75 },
    { name: "pankaj.99", baseScore: 56.50 },
    { name: "kiran.bala", baseScore: 54.00 }
  ],
  'patwari': [
    { name: "priya.s12", baseScore: 88.00 },
    { name: "sharma.aman", baseScore: 86.00 },
    { name: "rahul.sharma99", baseScore: 83.00 },
    { name: "pooja.rajput", baseScore: 80.00 },
    { name: "vikas.k87", baseScore: 78.00 },
    { name: "kullu_boy", baseScore: 75.00 }
  ],
  'joa_it': [
    { name: "vikas.k87", baseScore: 88.00 },
    { name: "tech.amit", baseScore: 85.00 },
    { name: "rahul.sharma99", baseScore: 82.00 },
    { name: "priya.s12", baseScore: 79.00 },
    { name: "ritika.sharma", baseScore: 76.00 },
    { name: "kapil.dev", baseScore: 73.00 }
  ]
};

function getDailyScore(baseScore, name) {
  const today = new Date();
  const seed = name.length + today.getDate();
  const fluctuation = (seed % 5) - 2;
  return Math.max(0, baseScore + fluctuation);
}

async function renderLeaderboardData(examType = 'hp_police') {
  const currentLoggedInName = currentProfile?.display_name || "";
  
  let allUsers = (ghostLeaderboards[examType] || []).map(user => ({
    name: user.name,
    score: getDailyScore(user.baseScore, user.name),
    isMe: false
  }));

  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(today.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);

  try {
    const { data: testResults } = await supabaseClient
      .from('test_results')
      .select('user_id, score')
      .eq('exam_type', examType)
      .gte('created_at', startOfWeek.toISOString());

    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('id, display_name');

    if (testResults && profiles) {
      const profileMap = {};
      profiles.forEach(p => profileMap[p.id] = p.display_name);

      const realUserMaxScores = {};
      testResults.forEach(test => {
        const userName = profileMap[test.user_id] || "Student";
        if (!realUserMaxScores[userName] || test.score > realUserMaxScores[userName]) {
          realUserMaxScores[userName] = test.score;
        }
      });

      for (const [uName, maxScore] of Object.entries(realUserMaxScores)) {
        if (uName.includes('lakshitsharma8080')) continue;
        allUsers.push({
          name: uName,
          score: maxScore,
          isMe: (uName === currentLoggedInName)
        });
      }
    }
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
  }

  allUsers.sort((a, b) => b.score - a.score);

  if (allUsers[0]) {
    document.getElementById("podiumRank1Name").innerText = allUsers[0].name;
    document.getElementById("podiumRank1Score").innerText = allUsers[0].score.toFixed(2) + " Pts";
    document.getElementById("podiumRank1Avatar").innerText = allUsers[0].name.slice(0, 2).toUpperCase();
  }
  if (allUsers[1]) {
    document.getElementById("podiumRank2Name").innerText = allUsers[1].name;
    document.getElementById("podiumRank2Score").innerText = allUsers[1].score.toFixed(2) + " Pts";
    document.getElementById("podiumRank2Avatar").innerText = allUsers[1].name.slice(0, 2).toUpperCase();
  }
  if (allUsers[2]) {
    document.getElementById("podiumRank3Name").innerText = allUsers[2].name;
    document.getElementById("podiumRank3Score").innerText = allUsers[2].score.toFixed(2) + " Pts";
    document.getElementById("podiumRank3Avatar").innerText = allUsers[2].name.slice(0, 2).toUpperCase();
  }

  const tbody = document.getElementById("leaderboardRows");
  tbody.innerHTML = "";

  allUsers.slice(3, 10).forEach((user, index) => {
    const rank = index + 4;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="rank-badge">#${rank}</span></td>
      <td>
        <div class="aspirant-cell">
          <span class="avatar-mini">${user.name.charAt(0).toUpperCase()}</span>
          <span class="name">${user.name} ${user.isMe ? '<strong style="color: #38bdf8;">(YOU)</strong>' : ''}</span>
        </div>
      </td>
      <td><span class="acc-pill">Weekly</span></td>
      <td style="text-align: right;"><span class="score-pill">${user.score.toFixed(2)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================================================
// 6. LIVE ANALYTICS & HISTORY ENGINE
// =========================================================
async function loadAnalyticsData() {
  if (!currentUserId) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/analytics/${currentUserId}`);
    const data = await response.json();

    document.getElementById('statTotalTests').innerText = data.total_tests || 0;
    document.getElementById('statAvgScore').innerText = data.avg_score || 0;
    document.getElementById('statHighScore').innerText = data.highest_score || 0;
    document.getElementById('statAccuracy').innerText = (data.accuracy || 0) + "%";

    const canvas = document.getElementById('performanceTrendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (performanceChartInstance) performanceChartInstance.destroy();

    const labels = data.graph_data?.map(i => i.date) || ['No Data'];
    const scores = data.graph_data?.map(i => i.score) || [0];

    performanceChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Score Progression',
          data: scores,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          borderWidth: 2.5,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (err) {
    console.error("Analytics fetch error:", err);
  }
}

async function loadAttemptedHistory() {
  const container = document.getElementById('attemptHistoryList');
  if (!container || !currentUserId) return;

  container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">⏳ Loading past attempts...</p>';

  const { data: attempts, error } = await supabaseClient
    .from('test_results')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false });

  if (error || !attempts || attempts.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">आपने अभी तक कोई टेस्ट नहीं दिया है।</p>';
    return;
  }

  container.innerHTML = '';
  attempts.forEach(item => {
    const attemptDate = new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-meta">
        <h4>${item.exam_type?.toUpperCase()} Mock Test</h4>
        <p>Attempted: <span>${attemptDate}</span> • Score: <strong class="text-green">${item.score} Marks</strong></p>
      </div>
      <div class="history-actions">
        <button class="btn-re-attempt" onclick="handleProtectedExam('${item.exam_type}')">🔄 Retake</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// =========================================================
// 7. DAILY BOOSTER, NEWS & CHAT ENGINE
// =========================================================
async function loadDailyQuestion() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/daily-question`);
    const data = await res.json();

    if (data.status === "success" && data.question) {
      const q = data.question;
      document.getElementById("daily-question-text").innerText = q.question_text || q.question;

      const options = [
        { key: '1', text: q.opt1 },
        { key: '2', text: q.opt2 },
        { key: '3', text: q.opt3 },
        { key: '4', text: q.opt4 }
      ].filter(o => o.text);

      const container = document.getElementById("daily-options-container");
      container.innerHTML = "";

      const correctKey = String(q.correct_option || "").trim();

      options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "daily-opt-btn";
        btn.innerText = `${opt.key}. ${opt.text}`;
        btn.onclick = () => {
          document.querySelectorAll(".daily-opt-btn").forEach(b => b.disabled = true);
          const feedback = document.getElementById("daily-explanation-box");
          feedback.style.display = "block";

          if (opt.key === correctKey) {
            btn.classList.add("correct");
            if (window.confetti) confetti({ particleCount: 120, spread: 70 });
            feedback.innerHTML = `<span style="color: #4ade80;">✓ बिल्कुल सही उत्तर!</span> ${q.explanation || ''}`;
          } else {
            btn.classList.add("wrong");
            feedback.innerHTML = `<span style="color: #f87171;">✕ गलत उत्तर। सही उत्तर विकल्प ${correctKey} है।</span>`;
          }
        };
        container.appendChild(btn);
      });
    }
  } catch (err) {
    console.error("Daily question error:", err);
  }
}

async function loadRealNews() {
  const el = document.getElementById("current-affairs-text");
  if (!el) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/news?t=${Date.now()}`);
    const data = await res.json();
    if (data.news && data.news.length > 0) {
      let idx = 0;
      el.innerText = data.news[0];
      setInterval(() => {
        idx = (idx + 1) % data.news.length;
        el.style.opacity = 0;
        setTimeout(() => {
          el.innerText = data.news[idx];
          el.style.opacity = 1;
        }, 400);
      }, 7000);
    }
  } catch (e) {
    el.innerText = "ताज़ा करंट अफेयर्स के लिए रिफ्रेश करें।";
  }
}

function toggleChat() {
  const win = document.getElementById("chatWindow");
  const openIco = document.querySelector(".chat-icon-open");
  const closeIco = document.querySelector(".chat-icon-close");

  win.classList.toggle("active");
  const isActive = win.classList.contains("active");

  openIco.style.display = isActive ? "none" : "block";
  closeIco.style.display = isActive ? "block" : "none";
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const msgContainer = document.getElementById("chatMessages");
  const text = input.value.trim();

  if (!text) return;

  const userMsg = document.createElement("div");
  userMsg.className = "chat-msg user";
  userMsg.innerText = text;
  msgContainer.appendChild(userMsg);

  input.value = "";
  msgContainer.scrollTop = msgContainer.scrollHeight;

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();

    const botMsg = document.createElement("div");
    botMsg.className = "chat-msg bot";
    botMsg.innerText = data.answer || "उत्तर प्राप्त करने में असमर्थ।";
    msgContainer.appendChild(botMsg);
  } catch (err) {
    const errMsg = document.createElement("div");
    errMsg.className = "chat-msg bot";
    errMsg.innerText = "सर्वर एरर! AI सहायक अभी कनेक्ट नहीं हो पाया।";
    msgContainer.appendChild(errMsg);
  } finally {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
}

// =========================================================
// 8. 19-BADGES ACHIEVEMENTS ENGINE
// =========================================================
const ALL_BADGES = [
  { id: 'ice_breaker', icon: '🧊', title: 'Ice Breaker', desc: 'पहला मॉक टेस्ट सबमिट किया।' },
  { id: '1_week_warrior', icon: '⚔️', title: '1-Week Warrior', desc: 'लगातार 7 दिन टेस्ट दिया।' },
  { id: '30_day_legend', icon: '👑', title: '30-Day Legend', desc: 'लगातार 30 दिन की स्ट्रीक।' },
  { id: 'weekend_hustler', icon: '📅', title: 'Weekend Hustler', desc: 'शनिवार और रविवार दोनों दिन टेस्ट दिया।' },
  { id: 'grandmaster', icon: '📜', title: 'Grandmaster', desc: 'फुल-सिलेबस टेस्ट कम्पलीट किया।' },
  { id: 'accuracy_sniper', icon: '🎯', title: 'Accuracy Sniper', desc: 'टेस्ट में 90%+ एक्यूरेसी हासिल की।' },
  { id: 'khaki_pride', icon: '👮‍♂️', title: 'Khaki Pride', desc: 'HP Police में टॉप 10% स्कोर।' },
  { id: 'patwari_elite', icon: '✍️', title: 'Patwari Elite', desc: 'पटवारी टेस्ट में 100+ स्कोर।' },
  { id: 'speed_demon', icon: '⚡', title: 'Speed Demon', desc: 'पेपर समय से 20 मिनट पहले पूरा किया।' },
  { id: 'hp_gk_scholar', icon: '🏔️', title: 'HP GK Scholar', desc: 'हिमाचल GK में 100% स्कोर।' },
  { id: 'vyakaran_guru', icon: '📚', title: 'Vyakaran Guru', desc: 'हिंदी/इंग्लिश ग्रामर में फुल मार्क्स।' },
  { id: 'logic_master', icon: '🧠', title: 'Logic Master', desc: 'रीज़निंग में कोई गलती नहीं।' },
  { id: 'night_owl', icon: '🦉', title: 'Night Owl', desc: 'रात 12 बजे के बाद टेस्ट सबमिट किया।' },
  { id: 'early_bird', icon: '🌅', title: 'Early Bird', desc: 'सुबह 6 बजे से पहले टेस्ट दिया।' },
  { id: 'comeback_king', icon: '🥊', title: 'Comeback King', desc: 'पिछले टेस्ट से स्कोर में भारी उछाल।' },
  { id: 'let_him_cook', icon: '🔥', title: 'Let Him Cook', desc: 'स्कोर लगातार इम्प्रूव हो रहा है।' },
  { id: 'touch_grass', icon: '🌱', title: 'Touch Grass', desc: 'एक दिन में 4 टेस्ट दे दिए।' },
  { id: 'massive_w', icon: '🏆', title: 'Massive W', desc: 'तुम्हारा स्कोर एकदम FIRE है।' },
  { id: 'exam_op', icon: '🎮', title: 'Exam OP', desc: 'OverPowered परफॉरमेंस!' }
];

function showAchievementUnlock(icon, title, description) {
  const achIcon = document.getElementById('ach-icon');
  const achTitle = document.getElementById('ach-title');
  const achDesc = document.getElementById('ach-desc');
  const popup = document.getElementById('achievement-popup');

  if (achIcon) achIcon.innerText = icon;
  if (achTitle) achTitle.innerText = title;
  if (achDesc) achDesc.innerText = description;
  if (popup) popup.style.display = 'flex';
}

function closeAchievementPopup() {
  const popup = document.getElementById('achievement-popup');
  if (popup) popup.style.display = 'none';
}

async function awardBadgeToUser(badgeId, icon, title, description) {
  if (!currentUserId) return;

  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('unlocked_badges')
      .eq('id', currentUserId)
      .single();

    let existingBadges = profile?.unlocked_badges || [];
    if (existingBadges.includes(badgeId)) return;

    existingBadges.push(badgeId);

    await supabaseClient
      .from('profiles')
      .update({ unlocked_badges: existingBadges })
      .eq('id', currentUserId);

    showAchievementUnlock(icon, title, description);
    loadUserAchievements();
  } catch (err) {
    console.error("Award badge error:", err);
  }
}

async function loadUserAchievements() {
  const grid = document.getElementById('badges-grid');
  if (!grid || !currentUserId) return;

  try {
    const { data } = await supabaseClient
      .from('profiles')
      .select('unlocked_badges')
      .eq('id', currentUserId)
      .single();

    const unlocked = data?.unlocked_badges || [];
    grid.innerHTML = '';

    ALL_BADGES.forEach(b => {
      const isUnlocked = unlocked.includes(b.id);
      grid.innerHTML += `
        <div class="badge-item ${isUnlocked ? 'unlocked' : 'locked'}" title="${b.desc}">
          <span class="b-icon">${b.icon}</span>
          <span class="b-name">${b.title}</span>
          <span class="b-status">${isUnlocked ? 'Unlocked' : '🔒 Locked'}</span>
        </div>
      `;
    });
  } catch (err) {
    console.error("Badges load error:", err);
  }
}

// =========================================================
// 9. DAILY STREAK ENGINE & TOAST
// =========================================================
async function processUserStreak() {
  if (!currentUserId) return 1;

  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('current_streak, last_test_date')
      .eq('id', currentUserId)
      .single();

    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0];
    let streak = profile?.current_streak || 0;
    const lastDateStr = profile?.last_test_date ? new Date(profile.last_test_date).toISOString().split('T')[0] : null;

    if (!lastDateStr) {
      streak = 1;
    } else if (lastDateStr === todayDateStr) {
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

    await supabaseClient
      .from('profiles')
      .update({
        current_streak: streak,
        last_test_date: new Date().toISOString()
      })
      .eq('id', currentUserId);

    renderStreakUI(streak);
    if (streak >= 7) awardBadgeToUser('1_week_warrior', '⚔️', '1-Week Warrior', '7-day test streak completed!');
    if (streak >= 30) awardBadgeToUser('30_day_legend', '👑', '30-Day Legend', '30 Days of non-stop prep!');

    return streak;
  } catch (err) {
    console.error("Process streak error:", err);
    return 1;
  }
}

function renderStreakUI(count) {
  const streakCountEl = document.getElementById('streakCount');
  const streakEmojiEl = document.getElementById('streakEmoji');

  let emoji = '🔥';
  if (count >= 30) emoji = '👑';
  else if (count >= 14) emoji = '⚡';
  else if (count >= 7) emoji = '💥';

  if (streakCountEl) streakCountEl.innerText = `${count} Days`;
  if (streakEmojiEl) streakEmojiEl.innerText = emoji;
}

async function syncStreakOnPageLoad() {
  if (!currentUserId) return;

  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('current_streak')
      .eq('id', currentUserId)
      .single();

    if (profile && profile.current_streak !== undefined) {
      renderStreakUI(profile.current_streak);
    }
  } catch (e) {
    console.error("Streak sync error:", e);
  }
}

// =========================================================
// 10. THEME & MOBILE DRAWER CONTROLS
// =========================================================
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const icon = document.getElementById("themeIcon");

  if (currentTheme === "light") {
    document.documentElement.removeAttribute("data-theme");
    if (icon) icon.innerText = "☀️";
    localStorage.setItem("hp_theme", "dark");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    if (icon) icon.innerText = "🌙";
    localStorage.setItem("hp_theme", "light");
  }
}

function toggleMobileMenu() {
  const drawer = document.getElementById("mobileNavDrawer");
  const backdrop = document.getElementById("mobileDrawerBackdrop");
  if (drawer && backdrop) {
    drawer.classList.toggle("open");
    backdrop.classList.toggle("open");
  }
}

function handleMobileNav(sectionName) {
  toggleMobileMenu();
  if (sectionName === "Mock Tests") {
    scrollToMockTests();
  } else {
    openSection(sectionName);
  }
}
