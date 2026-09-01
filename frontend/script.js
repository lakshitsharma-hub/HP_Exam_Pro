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

  // URL Hash Handler
  if (window.location.hash === "#analytics") {
    openSection("Analytics");
  } else if (window.location.hash === "#leaderboard") {
    openSection("Leaderboard");
  }
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
    err.innerText = "Please enter both email and password!";
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

      // ✉️ Backend ko Welcome Email trigger bhejo
      fetch("https://hp-exam-pro-dixk.onrender.com/api/user/welcome-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          name: email.split("@")[0]
        })
      }).catch(err => console.log("Welcome email error:", err));

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
    alert("Please enter your registered email address first!");
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
    if (confirm("Are you sure you want to log out?")) {
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

  // 👑 Pro Check: Agar user Pro member nahi hai toh pro.html par redirect karein
  if (currentProfile && !currentProfile.is_pro) {
    alert("🔒 Full-length Mock Tests are available for Pro Members. Upgrade to Pro for ₹99 to unlock all 15 tests!");
    window.location.href = "pro.html";
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

  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach(link => link.classList.remove("active"));

  const homeView = document.getElementById("home-content-view");
  const analyticsView = document.getElementById("analytics-view");
  const leaderboardView = document.getElementById("leaderboard-view");

  if (homeView) homeView.style.display = "block";
  if (analyticsView) analyticsView.style.display = "none";
  if (leaderboardView) leaderboardView.style.display = "none";

  if (sectionName === "Analytics" && analyticsView) {
    analyticsView.style.display = "flex";
    loadAnalyticsData();
    loadAttemptedHistory();
    analyticsView.scrollIntoView({ behavior: "smooth" });
  } else if (sectionName === "Leaderboard" && leaderboardView) {
    leaderboardView.style.display = "flex";
    const filterVal = document.getElementById("leaderboardExamFilter")?.value || "hp_police";
    renderLeaderboardData(filterVal);
    loadUserAchievements();
    leaderboardView.scrollIntoView({ behavior: "smooth" });
  }
}

function showMainHome() {
  const analyticsView = document.getElementById("analytics-view");
  const leaderboardView = document.getElementById("leaderboard-view");
  const homeView = document.getElementById("home-content-view");

  if (analyticsView) analyticsView.style.display = "none";
  if (leaderboardView) leaderboardView.style.display = "none";
  if (homeView) homeView.style.display = "block";

  document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  if (tbody) {
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
}

// =========================================================
// 6. LIVE ANALYTICS & HISTORY ENGINE
// =========================================================
async function loadAnalyticsData() {
  if (!currentUserId) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/analytics/${currentUserId}`);
    const data = await response.json();

    const statTotal = document.getElementById('statTotalTests');
    const statAvg = document.getElementById('statAvgScore');
    const statHigh = document.getElementById('statHighScore');
    const statAcc = document.getElementById('statAccuracy');

    if (statTotal) statTotal.innerText = data.total_tests || 0;
    if (statAvg) statAvg.innerText = data.avg_score || 0;
    if (statHigh) statHigh.innerText = data.highest_score || 0;
    if (statAcc) statAcc.innerText = (data.accuracy || 0) + "%";

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
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">You have not attempted any tests yet.</p>';
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
        <button class="btn-review" onclick="reviewPastTest('${item.id}')">👁️ Review</button>
        <button class="btn-re-attempt" onclick="confirmReattempt('${item.id}', '${item.exam_type}', this)">🔄 Retake</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// Re-attempt Trigger Function
async function confirmReattempt(testId, examType, btnElement) {
  if (confirm("Are you sure you want to retake this test? (The exact same question set will be loaded)")) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "⏳ Loading...";
    btnElement.disabled = true;

    try {
      const { data, error } = await supabaseClient
        .from('test_results')
        .select('questions_snapshot')
        .eq('id', testId)
        .single();

      if (error || !data || !data.questions_snapshot) {
        alert("Previous test data not found!");
        btnElement.innerText = originalText;
        btnElement.disabled = false;
        return;
      }

      sessionStorage.setItem('hp_reattempt_snapshot', JSON.stringify(data.questions_snapshot));
      window.location.href = `test-arena.html?exam=${encodeURIComponent(examType)}&reattempt=true`;
    } catch (err) {
      console.error("Reattempt error:", err);
      btnElement.innerText = originalText;
      btnElement.disabled = false;
    }
  }
}

// Review Past Test Function
async function reviewPastTest(testId) {
  try {
    const { data, error } = await supabaseClient
      .from('test_results')
      .select('*')
      .eq('id', testId)
      .single();

    if (error || !data || !data.questions_snapshot) {
      alert("Detailed review data is not available for this test!");
      return;
    }

    const questions = data.questions_snapshot;
    const userResponses = data.user_responses || {};

    let reviewHtml = `<div style="max-height: 400px; overflow-y: auto; text-align: left; padding: 10px; font-size: 14px;">`;
    questions.forEach((q, idx) => {
      const chosen = userResponses[String(q.id)] || "Unattempted";
      let correct = q.correct_option || q.answer || q.correct_answer || q.correct;
      if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correct)) correct = 'opt' + correct;
      const isCorrect = chosen === correct;

      reviewHtml += `
        <div style="background: rgba(15,23,42,0.8); border: 1px solid ${isCorrect ? '#22c55e' : '#ef4444'}; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
          <p><strong>Q${idx + 1}:</strong> ${q.question_text || q.question || q.text || ''}</p>
          <p style="color: ${isCorrect ? '#4ade80' : '#f87171'}; margin: 4px 0;"><strong>Your Answer:</strong> ${chosen} ${isCorrect ? '✅' : '❌'}</p>
          ${!isCorrect ? `<p style="color: #4ade80; margin: 4px 0;"><strong>Correct:</strong> ${correct} (${q[correct] || ''})</p>` : ''}
          ${q.explanation ? `<p style="color: #94a3b8; font-size: 12px; margin-top: 6px;">💡 ${q.explanation}</p>` : ''}
        </div>
      `;
    });
    reviewHtml += `</div>`;

    const reviewModal = document.createElement('div');
    reviewModal.style.cssText = `
      position: fixed; inset: 0; background: rgba(11, 17, 32, 0.85); backdrop-filter: blur(8px);
      z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;
    `;
    reviewModal.innerHTML = `
      <div style="background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; max-width: 600px; width: 100%; padding: 24px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0;">Detailed Test Review</h3>
          <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        ${reviewHtml}
      </div>
    `;
    document.body.appendChild(reviewModal);
  } catch (e) {
    console.error("Review past test error:", e);
  }
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
      const textEl = document.getElementById("daily-question-text");
      if (textEl) textEl.innerText = q.question_text || q.question;

      const options = [
        { key: '1', text: q.opt1 },
        { key: '2', text: q.opt2 },
        { key: '3', text: q.opt3 },
        { key: '4', text: q.opt4 }
      ].filter(o => o.text);

      const container = document.getElementById("daily-options-container");
      if (!container) return;
      container.innerHTML = "";

      const correctKey = String(q.correct_option || "").trim();

      options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "daily-opt-btn";
        btn.innerText = `${opt.key}. ${opt.text}`;
        btn.onclick = () => {
          document.querySelectorAll(".daily-opt-btn").forEach(b => b.disabled = true);
          const feedback = document.getElementById("daily-explanation-box");
          if (feedback) feedback.style.display = "block";

          if (opt.key === correctKey) {
            btn.classList.add("correct");
            if (window.confetti) confetti({ particleCount: 120, spread: 70 });
            if (feedback) feedback.innerHTML = `<span style="color: #4ade80;">✓ Correct Answer!</span> ${q.explanation || ''}`;
          } else {
            btn.classList.add("wrong");
            if (feedback) feedback.innerHTML = `<span style="color: #f87171;">✕ Incorrect answer. The correct choice is Option ${correctKey}.</span>`;
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
    el.innerText = "Refresh for the latest current affairs updates.";
  }
}

function toggleChat() {
  const win = document.getElementById("chatWindow");
  const openIco = document.querySelector(".chat-icon-open");
  const closeIco = document.querySelector(".chat-icon-close");

  if (!win) return;
  win.classList.toggle("active");
  const isActive = win.classList.contains("active");

  if (openIco) openIco.style.display = isActive ? "none" : "block";
  if (closeIco) closeIco.style.display = isActive ? "block" : "none";
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
    botMsg.innerText = data.answer || "Unable to get an answer at the moment.";
    msgContainer.appendChild(botMsg);
  } catch (err) {
    const errMsg = document.createElement("div");
    errMsg.className = "chat-msg bot";
    errMsg.innerText = "Server Error! AI Assistant could not connect.";
    msgContainer.appendChild(errMsg);
  } finally {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
}

// =========================================================
// 8. 19-BADGES ACHIEVEMENTS ENGINE
// =========================================================
const ALL_BADGES = [
  { id: 'ice_breaker', icon: '🧊', title: 'Ice Breaker', desc: 'Submitted your first mock test.' },
  { id: '1_week_warrior', icon: '⚔️', title: '1-Week Warrior', desc: 'Attempted tests 7 days in a row.' },
  { id: '30_day_legend', icon: '👑', title: '30-Day Legend', desc: 'Maintained a 30-day streak.' },
  { id: 'weekend_hustler', icon: '📅', title: 'Weekend Hustler', desc: 'Attempted tests on both Saturday and Sunday.' },
  { id: 'grandmaster', icon: '📜', title: 'Grandmaster', desc: 'Completed a full-syllabus mock test.' },
  { id: 'accuracy_sniper', icon: '🎯', title: 'Accuracy Sniper', desc: 'Achieved 90%+ accuracy in a mock test.' }
];

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
// 9. DAILY STREAK ENGINE
// =========================================================
async function syncStreakOnPageLoad() {
  if (!currentUserId) return;

  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('current_streak')
      .eq('id', currentUserId)
      .single();

    if (profile && profile.current_streak !== undefined) {
      const streakCountEl = document.getElementById('streakCount');
      if (streakCountEl) streakCountEl.innerText = `${profile.current_streak} Days`;
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


// =========================================================
// STREAK SYNC & DYNAMIC TIER EVOLUTION
// =========================================================

function renderStreakUI(count) {
  const c = parseInt(count) || 0;

  const streakCountEl = document.getElementById('streakCount');
  const streakEmojiEl = document.getElementById('streakEmoji');
  const drawerCountEl = document.getElementById('drawerStreakCount');
  const drawerEmojiEl = document.getElementById('drawerStreakEmoji');
  const drawerLabelEl = document.querySelector('.d-streak-label');

  // Milestone Progression
  let emoji = '🔥';
  let tierTitle = 'Daily Streak';

  if (c >= 30) {
    emoji = '👑';
    tierTitle = 'Legend Streak';
  } else if (c >= 14) {
    emoji = '⚡';
    tierTitle = 'Elite Streak';
  } else if (c >= 7) {
    emoji = '💥';
    tierTitle = 'Warrior Streak';
  }

  // 1. Update Desktop Navbar
  if (streakCountEl) streakCountEl.innerText = `${c} Days`;
  if (streakEmojiEl) streakEmojiEl.innerText = emoji;

  // 2. Update Mobile Drawer
  if (drawerCountEl) drawerCountEl.innerText = `${c} Days`;
  if (drawerEmojiEl) drawerEmojiEl.innerText = emoji;
  if (drawerLabelEl) drawerLabelEl.innerText = tierTitle;
}

// Page load hone par Supabase se streak fetch karke UI render karna
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
