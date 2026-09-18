// ==================== CONFIGURATION & HYBRID SWITCH ====================
const ENABLE_HYBRID_MODES = {
  joa_it: true,
  patwari: true,
  hp_police: true
};

const API_BASE_URL = "https://hp-exam-pro-dixk.onrender.com";

let rawQuestionsData = [];
let examQuestions = [];
let currentIndex = 0;
let currentFontScale = 1.15;
let currentExamType = "joa_it";
let currentLanguage = "hi";
let activeExamMode = "cbt";
let timerInterval = null;
let timeLeft = 5400;
let currentUserId = localStorage.getItem("current_user_id") || "test-user-123";

// Theme Controller
function initExamTheme() {
  const savedTheme = localStorage.getItem("hp_exam_theme") || "dark";
  document.body.setAttribute("data-theme", savedTheme);
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.innerHTML = savedTheme === "light" ? "🌙 Dark" : "☀️ Light";
}

function toggleExamTheme() {
  const current = document.body.getAttribute("data-theme") || "dark";
  const newTheme = current === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", newTheme);
  localStorage.setItem("hp_exam_theme", newTheme);
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.innerHTML = newTheme === "light" ? "🌙 Dark" : "☀️ Light";
}

// Anti-Repeat
function getAttemptedHistoryKey() {
  return `hp_attempted_qids_${currentExamType}_${currentUserId}`;
}

function getAttemptedQuestionIds() {
  try {
    const raw = localStorage.getItem(getAttemptedHistoryKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function recordAttemptedQuestions(questions) {
  try {
    const currentList = getAttemptedQuestionIds();
    const newIds = questions.map(q => q.id).filter(Boolean);
    const merged = Array.from(new Set([...currentList, ...newIds]));
    if (merged.length > 500) merged.splice(0, merged.length - 500);
    localStorage.setItem(getAttemptedHistoryKey(), JSON.stringify(merged));
  } catch (e) {
    console.warn("History save error:", e);
  }
}

function getTestSessionKey() {
  return `hp_test_state_${currentExamType}_${currentUserId}`;
}

function saveTestState() {
  if (!examQuestions || examQuestions.length === 0) return;
  try {
    const state = {
      rawQuestionsData,
      examQuestions,
      currentIndex,
      timeLeft,
      currentLanguage,
      activeExamMode,
      timestamp: Date.now()
    };
    localStorage.setItem(getTestSessionKey(), JSON.stringify(state));
  } catch (e) {
    console.warn("Session auto-save failed:", e);
  }
}

function clearTestState() {
  localStorage.removeItem(getTestSessionKey());
}

// Hybrid Mode Pick
function pickExamMode(mode) {
  activeExamMode = mode;
  const cbtCard = document.getElementById("cardModeCbt");
  const tabCard = document.getElementById("cardModeTablet");
  if (cbtCard) cbtCard.classList.toggle("active", mode === "cbt");
  if (tabCard) tabCard.classList.toggle("active", mode === "tablet");

  const list = document.getElementById("instructionItemsList");
  if (list) {
    if (mode === "tablet") {
      list.innerHTML = `
        <li><strong>1.5-Second Hold Rule:</strong> Bubble ko fill karne ke liye use 1.5 seconds tak daba kar rakhein.</li>
        <li><strong>Change Response:</strong> Kisi doosre bubble ko 1.5s press hold karke answer badlein.</li>
        <li><strong>Mark for Review:</strong> Question number par tap karke use review ke liye tag karein.</li>
        <li><strong>Tablet / PC View:</strong> Badi screen par questions aur OMR sheet side-by-side chalenge.</li>
      `;
    } else {
      list.innerHTML = `
        <li><strong>Answering Method:</strong> Option par seedha click karein.</li>
        <li><strong>Navigation:</strong> <em>"Save & Next"</em> par click karke aage badhein.</li>
        <li><strong>Auto Submit:</strong> Time pura hote hi test apne aap submit ho jayega.</li>
      `;
    }
  }
}

function confirmModeAndLaunchTest() {
  const chk = document.getElementById("acceptInstructionsChk");
  if (chk && !chk.checked) {
    alert("Please accept the examination instructions before proceeding.");
    return;
  }

  const modal = document.getElementById("modeSelectModal");
  if (modal) modal.style.display = "none";
  document.body.setAttribute("data-view", activeExamMode);

  if (activeExamMode === "tablet") {
    const cbtView = document.getElementById("cbtViewContainer");
    const tabView = document.getElementById("tabletViewContainer");
    if (cbtView) cbtView.style.display = "none";
    if (tabView) tabView.style.display = "flex";
    renderTabletPaperFeed();
    renderTabletOmrBubbles();
    initTabletSplitter();
  } else {
    const cbtView = document.getElementById("cbtViewContainer");
    const tabView = document.getElementById("tabletViewContainer");
    if (cbtView) cbtView.style.display = "flex";
    if (tabView) tabView.style.display = "none";
    renderPalette();
    loadQuestion(currentIndex);
  }

  saveTestState();
  startTimer();
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  initExamTheme();

  const urlParams = new URLSearchParams(window.location.search);
  let examParam = urlParams.get('exam');
  
  if (examParam) {
    const p = examParam.toLowerCase();
    if (p.includes("patwari")) currentExamType = "patwari";
    else if (p.includes("police")) currentExamType = "hp_police";
    else currentExamType = "joa_it";
  }

  const titleMap = {
    'joa_it': 'HP JOA (IT) Full Mock Test',
    'patwari': 'HP Patwari Full Mock Test',
    'hp_police': 'HP Police Constable Mock Test'
  };
  
  const titleEl = document.getElementById("activeExamTitle");
  if (titleEl) titleEl.innerText = titleMap[currentExamType] || "HP Full Mock Test";

  const tabTitleBanner = document.getElementById("tabPaperBannerTitle");
  if (tabTitleBanner) tabTitleBanner.innerText = (titleMap[currentExamType] || "HP FULL MOCK TEST").toUpperCase();

  const isHybridEnabled = Boolean(ENABLE_HYBRID_MODES[currentExamType]);
  if (!isHybridEnabled) {
    const modal = document.getElementById("modeSelectModal");
    if (modal) modal.style.display = "none";
    activeExamMode = "cbt";
  }

  fetchQuestionsFromBackend();
});

// Fetch Questions
async function fetchQuestionsFromBackend() {
  try {
    const attemptedIds = getAttemptedQuestionIds();
    const excludeParam = attemptedIds.length > 0 ? `&exclude_ids=${attemptedIds.join(',')}` : '';
    const response = await fetch(`${API_BASE_URL}/api/questions/${currentExamType}?user_id=${currentUserId}&t=${Date.now()}${excludeParam}`);
    
    if (response.status === 403) {
      const errorData = await response.json();
      alert('👑 Quota Reached: ' + errorData.detail);
      window.location.href = "pro.html";
      return;
    }
    
    const data = await response.json();

    if (data && data.length > 0) {
      rawQuestionsData = data;

      examQuestions = rawQuestionsData.map((q) => ({
        id: q.id,
        text_hi: q.question_text || q.question || q.text_hi || q.text || "",
        opt1_hi: q.opt1 || q.opt1_hi || (q.options ? q.options[0] : "") || "",
        opt2_hi: q.opt2 || q.opt2_hi || (q.options ? q.options[1] : "") || "",
        opt3_hi: q.opt3 || q.opt3_hi || (q.options ? q.options[2] : "") || "",
        opt4_hi: q.opt4 || q.opt4_hi || (q.options ? q.options[3] : "") || "",
        ans: q.correct_option || q.answer || q.correct_answer || q.correct || q.ans,
        userSelected: null,
        state: "not-visited"
      }));

      recordAttemptedQuestions(examQuestions);
      timeLeft = currentExamType === 'hp_police' ? 7200 : 5400;

      // Agar direct CBT chalna ho
      const modal = document.getElementById("modeSelectModal");
      if (!modal || modal.style.display === "none") {
        renderPalette();
        loadQuestion(0);
        startTimer();
      }
    }
  } catch (error) {
    console.error("Error loading questions:", error);
  }
}

// CBT Render
function loadQuestion(index) {
  if (!examQuestions || examQuestions.length === 0) return;
  currentIndex = index;
  const q = examQuestions[index];

  if (q.state === "not-visited") q.state = "unanswered";

  const qCur = document.getElementById("qCurrentIndex");
  if (qCur) qCur.innerText = `Question ${index + 1} of ${examQuestions.length}`;

  const qTxtEl = document.getElementById("questionText");
  if (qTxtEl) qTxtEl.innerText = q.text_hi || "Question text unavailable";

  const container = document.getElementById("optionsContainer");
  if (container) {
    container.innerHTML = "";
    const prefixes = ["A", "B", "C", "D"];
    const opts = [q.opt1_hi, q.opt2_hi, q.opt3_hi, q.opt4_hi];

    opts.forEach((opt, optIndex) => {
      const optionKey = `opt${optIndex + 1}`;
      const isSelected = q.userSelected === optionKey;

      const btn = document.createElement("button");
      btn.className = `option-btn ${isSelected ? "selected-green" : ""}`;
      btn.onclick = () => selectOption(optionKey);

      btn.innerHTML = `
        <span class="opt-prefix">${prefixes[optIndex]}</span>
        <span class="opt-text">${opt || ""}</span>
      `;
      container.appendChild(btn);
    });
  }

  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    if (currentIndex === examQuestions.length - 1) {
      nextBtn.innerText = "Submit Test 🏁";
      nextBtn.onclick = openSubmitModal;
    } else {
      nextBtn.innerText = "Save & Next →";
      nextBtn.onclick = saveAndNext;
    }
  }

  const prevBtn = document.getElementById("prevBtn");
  if (prevBtn) prevBtn.disabled = (currentIndex === 0);

  updatePaletteStatus();
  saveTestState();
}

function selectOption(optionKey) {
  examQuestions[currentIndex].userSelected = optionKey;
  examQuestions[currentIndex].state = "answered";
  saveTestState();
  loadQuestion(currentIndex);
}

function clearSelection() {
  examQuestions[currentIndex].userSelected = null;
  examQuestions[currentIndex].state = "unanswered";
  saveTestState();
  loadQuestion(currentIndex);
}

function saveAndNext() {
  if (currentIndex < examQuestions.length - 1) loadQuestion(currentIndex + 1);
}

function prevQuestion() {
  if (currentIndex > 0) loadQuestion(currentIndex - 1);
}

function markForReviewAndNext() {
  examQuestions[currentIndex].state = "review";
  saveTestState();
  if (currentIndex < examQuestions.length - 1) loadQuestion(currentIndex + 1);
  else updatePaletteStatus();
}

function renderPalette() {
  const grid = document.getElementById("paletteGrid");
  if (!grid) return;
  grid.innerHTML = "";
  examQuestions.forEach((q, i) => {
    const bubble = document.createElement("div");
    bubble.id = `palette-bubble-${i}`;
    bubble.className = "palette-bubble";
    bubble.innerText = i + 1;
    bubble.onclick = () => loadQuestion(i);
    grid.appendChild(bubble);
  });
}

function updatePaletteStatus() {
  let answered = 0, unanswered = 0, review = 0, notVisited = 0;

  examQuestions.forEach((q, i) => {
    const bubble = document.getElementById(`palette-bubble-${i}`);
    if (!bubble) return;

    bubble.className = "palette-bubble";
    if (i === currentIndex) bubble.classList.add("current");

    if (q.state === "answered") {
      bubble.classList.add("state-answered");
      answered++;
    } else if (q.state === "unanswered") {
      bubble.classList.add("state-unanswered");
      unanswered++;
    } else if (q.state === "review") {
      bubble.classList.add("state-review");
      review++;
    } else {
      notVisited++;
    }
  });

  const countAns = document.getElementById("countAnswered");
  const countUnans = document.getElementById("countUnanswered");
  const countRev = document.getElementById("countReview");
  const countNotVis = document.getElementById("countNotVisited");

  if (countAns) countAns.innerText = answered;
  if (countUnans) countUnans.innerText = unanswered;
  if (countRev) countRev.innerText = review;
  if (countNotVis) countNotVis.innerText = notVisited;
}

// Tablet Mode
function renderTabletPaperFeed() {
  const feed = document.getElementById("tabQuestionsFeed");
  if (!feed) return;
  feed.innerHTML = "";

  examQuestions.forEach((q, idx) => {
    const qNum = idx + 1;
    const row = document.createElement("div");
    row.className = "tab-question-row";
    row.id = `tab_paper_q_${qNum}`;

    row.innerHTML = `
      <div class="tab-q-single">
        <div class="tab-q-text"><span class="q-badge">Q${qNum}</span> ${q.text_hi}</div>
        <div class="tab-opts-grid">
          <div class="opt-cell"><span class="opt-tag">(A)</span> ${q.opt1_hi}</div>
          <div class="opt-cell"><span class="opt-tag">(B)</span> ${q.opt2_hi}</div>
          <div class="opt-cell"><span class="opt-tag">(C)</span> ${q.opt3_hi}</div>
          <div class="opt-cell"><span class="opt-tag">(D)</span> ${q.opt4_hi}</div>
        </div>
      </div>
    `;
    feed.appendChild(row);
  });
}

function renderTabletOmrBubbles() {
  const container = document.querySelector(".tab-omr-scroll-grid");
  const colLeft = document.getElementById("tabOmrColLeft");
  const colRight = document.getElementById("tabOmrColRight");
  if (!container) return;

  const isLargeScreen = window.innerWidth >= 900;
  const total = examQuestions.length;
  const half = Math.ceil(total / 2);

  if (isLargeScreen && colLeft && colRight) {
    colLeft.innerHTML = "";
    colRight.innerHTML = "";

    examQuestions.forEach((q, idx) => {
      const row = createOmrRowNode(q, idx);
      if (idx < half) colLeft.appendChild(row);
      else colRight.appendChild(row);
    });
  } else {
    container.innerHTML = "";
    examQuestions.forEach((q, idx) => {
      container.appendChild(createOmrRowNode(q, idx));
    });
  }

  bindTabletBubblePressEvents();
}

function createOmrRowNode(q, idx) {
  const qNum = idx + 1;
  const row = document.createElement("div");
  row.className = "tab-omr-row";
  row.id = `tab_omr_row_${qNum}`;

  const isReviewed = q.state === "review";
  const selectedKey = q.userSelected;

  row.innerHTML = `
    <span class="tab-omr-num ${isReviewed ? 'review-marked' : ''}" onclick="toggleTabletReview(${idx})">${qNum}</span>
    <div class="tab-bubbles-wrap" data-qindex="${idx}">
      <div class="tab-bubble ${selectedKey === 'opt1' ? 'filled' : ''}" data-opt="opt1">A</div>
      <div class="tab-bubble ${selectedKey === 'opt2' ? 'filled' : ''}" data-opt="opt2">B</div>
      <div class="tab-bubble ${selectedKey === 'opt3' ? 'filled' : ''}" data-opt="opt3">C</div>
      <div class="tab-bubble ${selectedKey === 'opt4' ? 'filled' : ''}" data-opt="opt4">D</div>
    </div>
  `;
  return row;
}

function bindTabletBubblePressEvents() {
  let holdTimer = null;

  document.querySelectorAll(".tab-bubble").forEach(bubble => {
    const onStart = () => {
      if (bubble.classList.contains("filled")) return;
      bubble.classList.add("pressing");

      holdTimer = setTimeout(() => {
        const wrap = bubble.closest(".tab-bubbles-wrap");
        const qIndex = parseInt(wrap.getAttribute("data-qindex"));
        const optKey = bubble.getAttribute("data-opt");

        wrap.querySelectorAll(".tab-bubble").forEach(b => b.classList.remove("filled", "pressing"));
        bubble.classList.add("filled");

        examQuestions[qIndex].userSelected = optKey;
        examQuestions[qIndex].state = "answered";

        if (navigator.vibrate) navigator.vibrate([45, 30, 45]);
        saveTestState();
      }, 1500);
    };

    const onEnd = () => {
      if (holdTimer) clearTimeout(holdTimer);
      bubble.classList.remove("pressing");
    };

    bubble.addEventListener("pointerdown", onStart);
    bubble.addEventListener("pointerup", onEnd);
    bubble.addEventListener("pointerleave", onEnd);
    bubble.addEventListener("pointercancel", onEnd);
  });
}

function toggleTabletReview(qIndex) {
  const q = examQuestions[qIndex];
  const qNum = qIndex + 1;
  const row = document.getElementById(`tab_omr_row_${qNum}`);
  if (!row) return;

  const numSpan = row.querySelector(".tab-omr-num");
  if (q.state === "review") {
    q.state = q.userSelected ? "answered" : "unanswered";
    numSpan.classList.remove("review-marked");
  } else {
    q.state = "review";
    numSpan.classList.add("review-marked");
  }
  saveTestState();
}

function initTabletSplitter() {
  const resizer = document.getElementById("tabSplitResizer");
  const omrPane = document.getElementById("tabOmrPane");
  if (!resizer || !omrPane) return;

  let isDragging = false;

  resizer.addEventListener("pointerdown", (e) => {
    isDragging = true;
    resizer.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
  });

  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const windowH = window.innerHeight;
    const newOmrH = windowH - e.clientY;
    if (newOmrH >= 130 && newOmrH <= (windowH - 140)) {
      omrPane.style.height = `${newOmrH}px`;
    }
  });

  const stopDrag = (e) => {
    if (!isDragging) return;
    isDragging = false;
    if (e.pointerId && resizer.hasPointerCapture(e.pointerId)) {
      resizer.releasePointerCapture(e.pointerId);
    }
    document.body.style.userSelect = "";
  };

  window.addEventListener("pointerup", stopDrag);
  window.addEventListener("pointercancel", stopDrag);
}

// Timer
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      finalSubmitAndExit();
      return;
    }
    timeLeft--;

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    document.querySelectorAll(".shared-timer-display").forEach(el => {
      el.innerText = formatted;
    });
  }, 1000);
}

function openSubmitModal() {
  let answered = 0, review = 0;
  examQuestions.forEach(q => {
    if (q.userSelected) answered++;
    if (q.state === "review") review++;
  });
  const unanswered = examQuestions.length - answered;

  const mTot = document.getElementById("modTotal");
  const mAns = document.getElementById("modAnswered");
  const mUn = document.getElementById("modUnanswered");
  const mRev = document.getElementById("modReview");

  if (mTot) mTot.innerText = examQuestions.length;
  if (mAns) mAns.innerText = answered;
  if (mUn) mUn.innerText = unanswered;
  if (mRev) mRev.innerText = review;

  const modal = document.getElementById("submitModal");
  if (modal) modal.style.display = "flex";
}

function closeSubmitModal() {
  const modal = document.getElementById("submitModal");
  if (modal) modal.style.display = "none";
}

async function finalSubmitAndExit() {
  clearInterval(timerInterval);
  closeSubmitModal();
  clearTestState();

  let correctCount = 0;
  let wrongCount = 0;

  examQuestions.forEach(q => {
    const chosen = q.userSelected;
    let correctKey = q.ans;
    if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correctKey)) correctKey = 'opt' + correctKey;
    if (chosen === correctKey) correctCount++;
    else if (chosen) wrongCount++;
  });

  const finalScore = Math.max(0, correctCount - (currentExamType === 'hp_police' ? wrongCount * 0.25 : 0));
  alert(`Exam Finished!\nYour Score: ${finalScore}\nCorrect: ${correctCount}\nWrong: ${wrongCount}`);
  window.location.href = "index.html";
}
