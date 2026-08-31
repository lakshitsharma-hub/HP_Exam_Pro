const API_BASE_URL = "https://hp-exam-pro-dixk.onrender.com";

let rawQuestionsData = [];
let examQuestions = [];
let currentIndex = 0;
let currentFontScale = 1.15;
let currentExamType = "joa_it";
let currentLanguage = "hi";
let timerInterval = null;
let timeLeft = 5400;
let currentUserId = localStorage.getItem("current_user_id") || "test-user-123";

document.addEventListener("DOMContentLoaded", () => {
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
  
  const marksTag = document.getElementById("qMarksTag");
  if (marksTag && currentExamType === 'hp_police') {
    marksTag.innerText = "+1.00 / -0.25 Negative Marking";
  }

  fetchQuestionsFromBackend();
});

async function fetchQuestionsFromBackend() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/questions/${currentExamType}?user_id=${currentUserId}&t=${Date.now()}`);
    
    if (response.status === 403) {
      const errorData = await response.json();
      alert('👑 Pro Feature: ' + errorData.detail);
      window.location.href = "index.html";
      return;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      rawQuestionsData = data;
      examQuestions = data.map((q) => ({
        id: q.id,
        text_hi: q.question_text || q.question || "",
        opt1_hi: q.opt1 || "",
        opt2_hi: q.opt2 || "",
        opt3_hi: q.opt3 || "",
        opt4_hi: q.opt4 || "",
        translated_en: null,
        ans: q.correct_option || q.answer || q.correct_answer || q.correct,
        userSelected: null,
        state: "not-visited"
      }));

      renderPalette();
      await loadQuestion(0);
      
      timeLeft = currentExamType === 'hp_police' ? 7200 : 5400;
      startTimer();
    } else {
      alert("इस परीक्षा के सवाल डेटाबेस में उपलब्ध नहीं हैं।");
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Error loading questions:", error);
    alert("Server error: Failed to fetch exam questions.");
  }
}

// Auto-Translation Utility via Public Free API
async function autoTranslate(text) {
  if (!text || currentLanguage === 'hi') return text;
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=hi|en`);
    const data = await res.json();
    return data.responseData ? data.responseData.translatedText : text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

async function changeLanguage(lang) {
  currentLanguage = lang;
  await loadQuestion(currentIndex);
}

async function loadQuestion(index) {
  currentIndex = index;
  const q = examQuestions[index];

  if (q.state === "not-visited") {
    q.state = "unanswered";
  }

  document.getElementById("qCurrentIndex").innerText = `Question ${index + 1} of ${examQuestions.length}`;

  // Check if English translation is needed and not already cached
  if (currentLanguage === 'en' && !q.translated_en) {
    document.getElementById("questionText").innerText = "⏳ Translating to English...";
    q.translated_en = {
      text: await autoTranslate(q.text_hi),
      opt1: q.opt1_hi ? await autoTranslate(q.opt1_hi) : "",
      opt2: q.opt2_hi ? await autoTranslate(q.opt2_hi) : "",
      opt3: q.opt3_hi ? await autoTranslate(q.opt3_hi) : "",
      opt4: q.opt4_hi ? await autoTranslate(q.opt4_hi) : ""
    };
  }

  const displayText = currentLanguage === 'en' && q.translated_en
    ? q.translated_en.text
    : q.text_hi;

  const displayOptions = currentLanguage === 'en' && q.translated_en
    ? [q.translated_en.opt1, q.translated_en.opt2, q.translated_en.opt3, q.translated_en.opt4].filter(Boolean)
    : [q.opt1_hi, q.opt2_hi, q.opt3_hi, q.opt4_hi].filter(Boolean);

  document.getElementById("questionText").innerText = displayText;

  const container = document.getElementById("optionsContainer");
  container.innerHTML = "";
  const prefixes = ["A", "B", "C", "D"];

  displayOptions.forEach((opt, optIndex) => {
    const optionKey = `opt${optIndex + 1}`;
    const isSelected = q.userSelected === optionKey;

    const btn = document.createElement("button");
    btn.className = `option-btn ${isSelected ? "selected-green" : ""}`;
    btn.onclick = () => selectOption(optionKey);
    btn.innerHTML = `
      <span class="opt-prefix">${prefixes[optIndex]}</span>
      <span class="opt-text">${opt}</span>
    `;
    container.appendChild(btn);
  });

  const nextBtn = document.getElementById("nextBtn");
  if (currentIndex === examQuestions.length - 1) {
    nextBtn.innerText = "Submit Test 🏁";
    nextBtn.onclick = openSubmitModal;
  } else {
    nextBtn.innerText = "Save & Next →";
    nextBtn.onclick = saveAndNext;
  }

  document.getElementById("prevBtn").disabled = (currentIndex === 0);
  updatePaletteStatus();
}

function selectOption(optionKey) {
  examQuestions[currentIndex].userSelected = optionKey;
  examQuestions[currentIndex].state = "answered";
  loadQuestion(currentIndex);
}

function clearSelection() {
  examQuestions[currentIndex].userSelected = null;
  examQuestions[currentIndex].state = "unanswered";
  loadQuestion(currentIndex);
}

function saveAndNext() {
  if (currentIndex < examQuestions.length - 1) {
    loadQuestion(currentIndex + 1);
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    loadQuestion(currentIndex - 1);
  }
}

function markForReviewAndNext() {
  examQuestions[currentIndex].state = "review";
  if (currentIndex < examQuestions.length - 1) {
    loadQuestion(currentIndex + 1);
  } else {
    updatePaletteStatus();
  }
}

function renderPalette() {
  const grid = document.getElementById("paletteGrid");
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

  document.getElementById("countAnswered").innerText = answered;
  document.getElementById("countUnanswered").innerText = unanswered;
  document.getElementById("countReview").innerText = review;
  document.getElementById("countNotVisited").innerText = notVisited;
}

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
    const timerEl = document.getElementById("timeRemaining");
    if (timerEl) {
      timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

function adjustFontSize(delta) {
  currentFontScale = Math.max(0.9, Math.min(1.4, currentFontScale + delta * 0.1));
  document.documentElement.style.setProperty("--q-font-size", `${currentFontScale}rem`);
}

function openSubmitModal() {
  const answered = examQuestions.filter(q => q.state === "answered").length;
  const review = examQuestions.filter(q => q.state === "review").length;
  const unanswered = examQuestions.length - answered - review;

  document.getElementById("modTotal").innerText = examQuestions.length;
  document.getElementById("modAnswered").innerText = answered;
  document.getElementById("modUnanswered").innerText = unanswered;
  document.getElementById("modReview").innerText = review;

  document.getElementById("submitModal").style.display = "flex";
}

function closeSubmitModal() {
  document.getElementById("submitModal").style.display = "none";
}

async function finalSubmitAndExit() {
  clearInterval(timerInterval);
  closeSubmitModal();

  let correctCount = 0;
  let wrongCount = 0;
  const userResponsesMap = {};

  examQuestions.forEach(q => {
    const chosen = q.userSelected;
    let correctKey = q.ans;

    if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correctKey)) {
      correctKey = 'opt' + correctKey;
    }

    if (chosen) {
      userResponsesMap[String(q.id)] = chosen;
    }

    if (chosen === correctKey) {
      correctCount++;
    } else if (chosen) {
      wrongCount++;
    }
  });

  let finalScore = correctCount;
  if (currentExamType === 'hp_police') {
    finalScore = correctCount - (wrongCount * 0.25);
  }
  finalScore = Math.max(0, parseFloat(finalScore.toFixed(2)));

  const totalAttempted = correctCount + wrongCount;
  const accuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;

  document.getElementById("resFinalScore").innerText = finalScore;
  document.getElementById("resCorrectCount").innerText = correctCount;
  document.getElementById("resWrongCount").innerText = wrongCount;
  document.getElementById("resAccuracy").innerText = accuracy + "%";

  document.getElementById("scorecardModal").style.display = "flex";

  if (window.confetti && finalScore > 0) {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
  }

  const userName = localStorage.getItem("current_user_name") || "Student";
  const questionsSnapshotPayload = rawQuestionsData.length > 0 ? rawQuestionsData : examQuestions;

  try {
    await fetch(`${API_BASE_URL}/api/submit-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUserId,
        display_name: userName,
        exam_type: currentExamType,
        score: finalScore,
        correct_answers: correctCount,
        wrong_answers: wrongCount,
        questions_snapshot: questionsSnapshotPayload,
        user_responses: userResponsesMap
      })
    });
  } catch (err) {
    console.error("Score submission error:", err);
  }
}

function toggleSolutionsReview() {
  const container = document.getElementById("solutionsReviewContainer");
  if (!container) return;

  if (container.style.display === "block") {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  container.innerHTML = "";

  examQuestions.forEach((q, idx) => {
    let correctKey = q.ans;
    if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correctKey)) correctKey = 'opt' + correctKey;

    const chosen = q.userSelected;
    const isCorrect = chosen === correctKey;

    const raw = rawQuestionsData[idx] || {};
    const explanation = raw.explanation || "";

    const div = document.createElement("div");
    div.style.cssText = `
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid ${isCorrect ? 'rgba(34, 197, 94, 0.4)' : (chosen ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.08)')};
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
      font-size: 0.8rem;
    `;

    div.innerHTML = `
      <p style="margin: 0 0 6px 0; font-weight: 700; color: #f8fafc;">Q${idx + 1}: ${q.text_hi}</p>
      <p style="margin: 2px 0; color: ${isCorrect ? '#4ade80' : '#f87171'};">
        <strong>Your Choice:</strong> ${chosen ? chosen.toUpperCase() : 'Unattempted'} ${isCorrect ? '✅' : '❌'}
      </p>
      ${!isCorrect ? `<p style="margin: 2px 0; color: #4ade80;"><strong>Correct:</strong> ${String(correctKey).toUpperCase()}</p>` : ''}
      ${explanation ? `<p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 0.75rem;">💡 ${explanation}</p>` : ''}
    `;
    container.appendChild(div);
  });
}

function openQueryModal() {
  document.getElementById("queryModal").style.display = "flex";
}

function closeQueryModal() {
  document.getElementById("queryModal").style.display = "none";
}

async function submitQuestionQuery() {
  const currentQ = examQuestions[currentIndex];
  const issueType = document.getElementById("queryIssueType").value;
  const comment = document.getElementById("queryComment").value.trim();

  try {
    await fetch(`${API_BASE_URL}/api/query/raise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: currentUserId,
        question_id: String(currentQ.id),
        issue_text: `${issueType}: ${comment}`
      })
    });
    alert("✓ आपकी आपत्ति दर्ज कर ली गई है।");
    closeQueryModal();
  } catch (e) {
    alert("Objection submission failed.");
  }
}
