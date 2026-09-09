// --- 1. SUPABASE INITIALIZATION ---
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co";
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const log = document.getElementById('admin-log');
let allLoadedUsers = [];
let currentModalAttempts = [];
let currentModalCandidateName = '';

// --- 2. DIFFICULTY & STATS COUNTER ---
async function refreshDashboardStats() {
    try {
        const tableName = 'questions';

        // Total questions
        const { count: totalCount } = await supabaseClient
            .from(tableName)
            .select('*', { count: 'exact', head: true });

        // Easy
        const { count: easyCount } = await supabaseClient
            .from(tableName)
            .select('*', { count: 'exact', head: true })
            .ilike('difficulty', '%easy%');

        // Medium
        const { count: medCount } = await supabaseClient
            .from(tableName)
            .select('*', { count: 'exact', head: true })
            .ilike('difficulty', '%medium%');

        // Hard / Tough
        const { count: hardCount } = await supabaseClient
            .from(tableName)
            .select('*', { count: 'exact', head: true })
            .or('difficulty.ilike.%hard%,difficulty.ilike.%tough%');

        document.getElementById('count-total').innerText = totalCount ?? 0;
        document.getElementById('count-easy').innerText = easyCount ?? 0;
        document.getElementById('count-medium').innerText = medCount ?? 0;
        document.getElementById('count-hard').innerText = hardCount ?? 0;

        if (log) log.innerHTML += `<br>> ✅ Question bank metrics synced.`;
    } catch (err) {
        console.error("Stats count error:", err);
    }
}

// --- 3. LOAD USERS & SEARCH SYSTEM ---
async function loadUsers() {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;">Loading candidate data...</td></tr>';

    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color: red; padding: 12px;">Error: ${error.message}</td></tr>`;
        return;
    }

    allLoadedUsers = users || [];
    
    // Total User Count Update
    const userBadge = document.getElementById('total-users-badge');
    if (userBadge) {
        userBadge.innerText = `Total: ${allLoadedUsers.length}`;
    }

    renderUserRows(allLoadedUsers);
}

function renderUserRows(users) {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return;

    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #94a3b8;">No candidate found.</td></tr>';
        return;
    }

    tableBody.innerHTML = '';
    users.forEach(user => {
        const isPro = user.is_pro;
        const limitText = user.custom_limit !== null && user.custom_limit !== undefined 
            ? `${user.custom_limit} Tests` 
            : 'Default';

        const statusTag = isPro 
            ? '<span style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">👑 PRO</span>' 
            : '<span style="background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">FREE</span>';

        let formattedActive = 'Never';
        if (user.last_active) {
            const dateObj = new Date(user.last_active);
            formattedActive = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        }

        const row = `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 14px;">
                    <a href="javascript:void(0)" onclick="openUserAttemptsModal('${user.id}', '${user.display_name || 'Candidate'}')" style="font-weight: 700; color: #2563eb; text-decoration: none;">
                        ${user.display_name || 'User'}
                    </a>
                </td>
                <td style="padding: 12px 14px; font-size: 13px; color: #64748b;">${formattedActive}</td>
                <td style="padding: 12px 14px;">${statusTag}</td>
                <td style="padding: 12px 14px; font-weight: 600; color: #0284c7;">${limitText}</td>
                <td style="padding: 12px 14px; text-align: right;">
                    <button onclick="togglePro('${user.id}', ${isPro})" style="background: ${isPro ? '#ef4444' : '#10b981'}; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; margin-right: 6px;">
                        ${isPro ? 'Remove Pro' : 'Make Pro'}
                    </button>
                    <button onclick="setCustomUserLimit('${user.id}', '${user.custom_limit || ''}')" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        ✏️ Limit
                    </button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

function filterUsersList() {
    const query = (document.getElementById('user-search-input').value || '').toLowerCase().trim();
    const filtered = allLoadedUsers.filter(u => 
        (u.display_name && u.display_name.toLowerCase().includes(query)) ||
        (u.id && u.id.toLowerCase().includes(query))
    );
    renderUserRows(filtered);
}

// --- 4. ATTEMPT HISTORY & INSPECT RESPONSES MODALS ---
async function openUserAttemptsModal(userId, displayName) {
    currentModalCandidateName = displayName;
    document.getElementById('modalUserName').innerText = `Attempts: ${displayName}`;
    document.getElementById('modalUserEmail').innerText = `ID: ${userId}`;
    const content = document.getElementById('modalAttemptsContent');
    content.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Loading test records...</p>';
    document.getElementById('userModal').style.display = 'flex';

    let { data: attempts } = await supabaseClient
        .from('test_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (!attempts || attempts.length === 0) {
        const fallback = await supabaseClient
            .from('test_attempts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        attempts = fallback.data;
    }

    if (!attempts || attempts.length === 0) {
        content.innerHTML = '<div style="padding: 30px; text-align: center; color: #94a3b8;">Is candidate ne abhi tak koi test attempt nahi kiya hai.</div>';
        return;
    }

    currentModalAttempts = attempts;

    let listHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #64748b;">
                    <th style="padding: 8px;">Exam</th>
                    <th style="padding: 8px;">Score</th>
                    <th style="padding: 8px;">Date</th>
                    <th style="padding: 8px; text-align: right;">Options</th>
                </tr>
            </thead>
            <tbody>
    `;

    attempts.forEach((att, idx) => {
        const attemptDate = new Date(att.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        listHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 8px; font-weight: 700; text-transform: uppercase;">${att.exam_type || 'Mock Test'}</td>
                <td style="padding: 10px 8px; font-weight: 700; color: #2563eb;">${att.score ?? att.marks_obtained ?? '0'}</td>
                <td style="padding: 10px 8px; color: #64748b;">${attemptDate}</td>
                <td style="padding: 10px 8px; text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                    <button onclick="viewAttemptedResponsesByIndex(${idx})" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;">
                        👁️ View Responses
                    </button>
                    <button onclick="generateUserAttemptPDFByIndex(${idx})" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;">
                        📄 PDF
                    </button>
                </td>
            </tr>
        `;
    });

    listHtml += '</tbody></table>';
    content.innerHTML = listHtml;
}

// 👁️ Candidate ke question-wise marked options render karna
function viewAttemptedResponsesByIndex(index) {
    const att = currentModalAttempts[index];
    if (!att) return;

    const container = document.getElementById('reviewModalContent');
    document.getElementById('reviewModalTitle').innerText = `${(att.exam_type || 'Test').toUpperCase()} Response Sheet`;

    const snapshot = att.questions_snapshot || [];
    const responses = att.user_responses || {};

    if (snapshot.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: #94a3b8;">Detailed questions snapshot is empty for this test.</p>';
    } else {
        let qCards = '';
        snapshot.forEach((q, i) => {
            const qNum = i + 1;
            const qId = q.id || qNum;
            const userMarkedKey = responses[qId] || responses[String(qId)] || null;

            // Normalize Correct Option (e.g. '3' -> 'opt3', ya 'opt3')
            let rawCorrect = q.correct_option || q.answer || q.correct_answer || '';
            let correctKey = rawCorrect;
            if (['1', '2', '3', '4', 1, 2, 3, 4].includes(rawCorrect)) {
                correctKey = 'opt' + rawCorrect;
            }

            const isAttempted = Boolean(userMarkedKey);
            const isCorrect = isAttempted && String(userMarkedKey).toLowerCase() === String(correctKey).toLowerCase();

            // Label Helper
            const getOptText = (optKey) => {
                if (!optKey) return 'Not Attempted';
                const text = q[optKey] || optKey;
                const letter = optKey.replace('opt', '').toUpperCase();
                return `(${letter}) ${text}`;
            };

            qCards += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                        <span style="font-weight: 700; color: #0f172a; font-size: 14px;">Q${qNum}. ${q.question_text || q.question}</span>
                        <span style="font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px; white-space: nowrap; ${
                            isCorrect ? 'background: #dcfce7; color: #166534;' : 
                            (isAttempted ? 'background: #fee2e2; color: #991b1b;' : 'background: #f1f5f9; color: #64748b;')
                        }">
                            ${isCorrect ? '✅ Correct' : (isAttempted ? '❌ Incorrect' : '⚪ Skipped')}
                        </span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; color: #475569; margin-bottom: 10px; padding-left: 6px;">
                        <div style="${correctKey === 'opt1' ? 'font-weight: bold; color: #16a34a;' : ''}">(A) ${q.opt1 || ''}</div>
                        <div style="${correctKey === 'opt2' ? 'font-weight: bold; color: #16a34a;' : ''}">(B) ${q.opt2 || ''}</div>
                        <div style="${correctKey === 'opt3' ? 'font-weight: bold; color: #16a34a;' : ''}">(C) ${q.opt3 || ''}</div>
                        <div style="${correctKey === 'opt4' ? 'font-weight: bold; color: #16a34a;' : ''}">(D) ${q.opt4 || ''}</div>
                    </div>
                    <div style="background: #f8fafc; padding: 8px 12px; border-radius: 6px; font-size: 12px; border-left: 3px solid ${isCorrect ? '#10b981' : (isAttempted ? '#ef4444' : '#94a3b8')};">
                        <b>Candidate Selected:</b> <span style="font-weight: 600;">${getOptText(userMarkedKey)}</span> 
                        &nbsp;|&nbsp; <b>Correct Option:</b> <span style="color: #16a34a; font-weight: 700;">${getOptText(correctKey)}</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = qCards;
    }

    const revModal = document.getElementById('reviewModal');
    revModal.style.zIndex = '2000';
    revModal.style.display = 'flex';
}

// 📄 Candidate Scorecard & Full Attempt Sheet PDF
function generateUserAttemptPDFByIndex(index) {
    const att = currentModalAttempts[index];
    if (!att) return;

    const snapshot = att.questions_snapshot || [];
    const responses = att.user_responses || {};
    const win = window.open('', '_blank');

    let responseList = '';
    snapshot.forEach((q, i) => {
        const qNum = i + 1;
        const qId = q.id || qNum;
        const userMarkedKey = responses[qId] || responses[String(qId)] || null;

        let rawCorrect = q.correct_option || q.answer || q.correct_answer || '';
        let correctKey = rawCorrect;
        if (['1', '2', '3', '4', 1, 2, 3, 4].includes(rawCorrect)) {
            correctKey = 'opt' + rawCorrect;
        }

        const isAttempted = Boolean(userMarkedKey);
        const isCorrect = isAttempted && String(userMarkedKey).toLowerCase() === String(correctKey).toLowerCase();

        const getOptionTitle = (k) => {
            if (!k) return 'Skipped';
            const letter = k.replace('opt', '').toUpperCase();
            return `(${letter}) ${q[k] || k}`;
        };

        responseList += `
            <div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; page-break-inside: avoid;">
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #0f172a;">
                    Q${qNum}. ${q.question_text || q.question}
                </p>
                <div style="font-size: 12px; color: #334155;">
                    Candidate Marked: <b>${getOptionTitle(userMarkedKey)}</b> 
                    &nbsp;|&nbsp; Correct Key: <b style="color: #166534;">${getOptionTitle(correctKey)}</b> 
                    &nbsp;→ <b>${isCorrect ? '✅ (+1)' : (isAttempted ? '❌ (-0.25)' : '⚪ (0)')}</b>
                </div>
            </div>
        `;
    });

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${currentModalCandidateName} - Scorecard</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 25px; color: #0f172a; line-height: 1.4; }
                .summary-box { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; margin-bottom: 20px; }
                .summary-item { font-size: 12px; }
                .summary-item b { font-size: 14px; color: #0f172a; display: block; margin-top: 2px; }
                @media print {
                    body { padding: 10px; }
                }
            </style>
        </head>
        <body>
            <h2 style="margin: 0 0 4px 0;">🏔️ HP Exam Pro - Individual Candidate Audit</h2>
            <p style="margin: 0 0 15px 0; color: #64748b; font-size: 13px;">Target Exam: ${(att.exam_type || '').toUpperCase()} | Date: ${new Date(att.created_at).toLocaleString()}</p>
            
            <div class="summary-box">
                <div class="summary-item">Candidate: <b>${currentModalCandidateName}</b></div>
                <div class="summary-item">Final Score: <b style="color: #2563eb;">${att.score ?? 'N/A'}</b></div>
                <div class="summary-item">Correct Answers: <b style="color: #16a34a;">${att.correct_answers ?? 0}</b></div>
                <div class="summary-item">Wrong Answers: <b style="color: #dc2626;">${att.wrong_answers ?? 0}</b></div>
            </div>

            <h3 style="border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 12px;">Detailed Question Responses</h3>
            <div>${responseList || '<p>No questions snapshot stored.</p>'}</div>

            <script>
                window.onload = function() { setTimeout(() => { window.print(); }, 400); };
            </script>
        </body>
        </html>
    `;
    win.document.write(html);
    win.document.close();
}

// --- 5. CLEAN ANTI-CUT MOCK TEST PDF GENERATOR ---
async function generateTestPDF(examType) {
    let examName = 'JOA IT Examination';
    let totalMarks = '120';
    let timeAllowed = '90 Minutes';

    if (examType === 'patwari') {
        examName = 'HPRCA Patwari Examination';
        totalMarks = '120';
        timeAllowed = '90 Minutes';
    } else if (examType === 'hp_police') {
        examName = 'HP Police Constable Examination';
        totalMarks = '90';
        timeAllowed = '120 Minutes';
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Generating PDF...</title></head><body style="font-family:sans-serif; padding:40px; text-align:center;"><h2>⏳ HP Exam Pro... Generating Mock PDF...</h2></body></html>');

    try {
        const response = await fetch(`https://hp-exam-pro-dixk.onrender.com/api/questions/${examType}?user_id=test-user-123&t=${Date.now()}`);
        const questions = await response.json();

        if (!questions || questions.length === 0) {
            alert("Questions load nahi ho paaye!");
            printWindow.close();
            return;
        }

        let questionsHTML = '';
        let answerKeyRows = '';
        let explanationsHTML = '';

        questions.forEach((q, index) => {
            const qNum = index + 1;
            let correctOpt = q.correct_option || q.answer || q.correct_answer || "N/A";
            if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correctOpt)) {
                correctOpt = 'Option ' + correctOpt;
            }

            questionsHTML += `
                <div class="question-unit" style="margin-bottom: 22px; page-break-inside: avoid !important; break-inside: avoid !important; display: block;">
                    <p style="font-weight: 700; margin: 0 0 8px 0; color: #0f172a; font-size: 14px; page-break-after: avoid; break-after: avoid;">
                        Q${qNum}. ${q.question_text || q.question}
                    </p>
                    <table style="width: 100%; border: none; font-size: 13px; color: #334155; margin-left: 8px;">
                        <tr>
                            <td style="width: 50%; padding: 4px 0;">(A) ${q.opt1 || ''}</td>
                            <td style="width: 50%; padding: 4px 0;">(B) ${q.opt2 || ''}</td>
                        </tr>
                        <tr>
                            <td style="width: 50%; padding: 4px 0;">(C) ${q.opt3 || ''}</td>
                            <td style="width: 50%; padding: 4px 0;">(D) ${q.opt4 || ''}</td>
                        </tr>
                    </table>
                </div>
            `;

            answerKeyRows += `
                <div style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-size: 12px; page-break-inside: avoid; break-inside: avoid;">
                    <b>Q${qNum}:</b> ${correctOpt}
                </div>
            `;

            if (q.explanation && q.explanation.trim() !== "") {
                explanationsHTML += `
                    <div style="margin-bottom: 10px; padding: 8px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 12px; page-break-inside: avoid; break-inside: avoid;">
                        <b>Q${qNum} Sol:</b> ${q.explanation}
                    </div>
                `;
            }
        });

        const fullHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${examName} - Mock Test</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; padding-bottom: 50px; color: #0f172a; line-height: 1.4; position: relative; }
                    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 110px; font-weight: bold; color: rgba(148, 163, 184, 0.12); z-index: -1; pointer-events: none; }
                    .pdf-footer { position: fixed; bottom: 10px; left: 0; width: 100%; text-align: center; font-size: 11px; color: #64748b; background: white; }
                    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
                    .meta-info { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
                    .page-break { page-break-before: always; break-before: always; }
                    .answer-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 15px; }
                    
                    @media print {
                        body { padding: 0; padding-bottom: 40px; }
                        button { display: none; }
                        .question-unit { page-break-inside: avoid !important; break-inside: avoid !important; display: block !important; }
                        .watermark { color: rgba(148, 163, 184, 0.15) !important; -webkit-print-color-adjust: exact; }
                        .pdf-footer { bottom: 0; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="watermark">HP EXAM PRO</div>
                <div class="pdf-footer">© 2026 HP EXAM PRO | Practice Mock Paper</div>
                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">🖨️ Print / Save PDF</button>
                </div>
                <div class="header">
                    <h1 style="margin: 0; font-size: 22px;">🏔️ HP EXAM PRO - OFFICIAL MOCK TEST</h1>
                    <p style="margin: 4px 0; font-size: 13px;">Target: ${examName}</p>
                </div>
                <div class="meta-info">
                    <span>Time Allowed: ${timeAllowed}</span>
                    <span>Total Questions: ${questions.length}</span>
                    <span>Max Marks: ${totalMarks}</span>
                </div>
                <div>${questionsHTML}</div>
                <div class="page-break"></div>
                <div class="header" style="margin-top: 20px;">
                    <h1 style="margin: 0; font-size: 20px;">🔑 ANSWER KEY</h1>
                </div>
                <div class="answer-grid">${answerKeyRows}</div>
                <h3 style="margin-top: 30px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">💡 Explanations</h3>
                <div>${explanationsHTML || '<p style="font-size: 12px; color: #64748b;">No explanations provided.</p>'}</div>
                <script>
                    window.onload = function() { setTimeout(() => { window.print(); }, 500); };
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(fullHTML);
        printWindow.document.close();
    } catch (e) {
        alert("PDF Generate Error: " + e.message);
        if (printWindow) printWindow.close();
    }
}

// --- 6. PRO & LIMIT TOGGLES ---
async function togglePro(userId, currentStatus) {
    const { error } = await supabaseClient
        .from('profiles')
        .update({ is_pro: !currentStatus })
        .eq('id', userId);

    if (!error) loadUsers();
    else alert("Error updating Pro: " + error.message);
}

async function setCustomUserLimit(userId, currentLimit) {
    const newLimit = prompt("Test limit dalein:", currentLimit);
    if (newLimit === null || newLimit === "") return;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ custom_limit: parseInt(newLimit) })
        .eq('id', userId);

    if (!error) loadUsers();
    else alert("Error updating limit: " + error.message);
}

// --- 7. CSV UPLOAD LOGIC ---
async function triggerCSVUpload() {
    const fileInput = document.getElementById('csvUpload');
    const file = fileInput.files[0];
    if (!file) return;

    if (log) log.innerHTML += `<br>> Reading: ${file.name}...`;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            if (log) log.innerHTML += `<br>> Uploading ${data.length} questions in batches...`;

            for (let i = 0; i < data.length; i += 50) {
                const batch = data.slice(i, i + 50);
                const { error } = await supabaseClient
                    .from('questions')
                    .insert(batch);

                if (error) {
                    if (log) log.innerHTML += `<br><span style="color:red;">> Error: ${error.message}</span>`;
                    break;
                }
            }
            if (log) log.innerHTML += `<br><span style="color:#22c55e;">> ✅ Done! Questions uploaded.</span>`;
            refreshDashboardStats();
        }
    });
}

function generateAIQuestions() {
    if (log) log.innerHTML += `<br>> Triggering AI question generation pipeline...`;
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    refreshDashboardStats();
    loadUsers();
    refreshQueryNotificationBadge(); // 👈 Nayi line: Badge load karega
    setInterval(refreshQueryNotificationBadge, 15000); // 👈 Nayi line: Har 15 sec me auto-sync
    const csvElem = document.getElementById('csvUpload');
    if (csvElem) csvElem.addEventListener('change', triggerCSVUpload);
});

// --- MODAL CLOSE HANDLER ---
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Bahar (Backdrop) click karne par ya 'Escape' key dabane par bhi close ho jaye
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const userMod = document.getElementById('userModal');
        const revMod = document.getElementById('reviewModal');
        if (revMod && revMod.style.display === 'flex') {
            revMod.style.display = 'none';
        } else if (userMod && userMod.style.display === 'flex') {
            userMod.style.display = 'none';
        }
    }
});

// =========================================================================
// 8. RAISED QUERIES & NOTIFICATION ENGINE (STRICT SINGLE INCREMENT GUARD)
// =========================================================================

let isQueryProcessing = false;

// 🔴 1. Pending Queries Count & Badge Fetch
async function refreshQueryNotificationBadge() {
    try {
        const { count, error } = await supabaseClient
            .from('query_raises')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (error) throw error;

        const badge = document.getElementById('query-notification-badge');
        const modalBadge = document.getElementById('modal-pending-badge');
        const pendingCount = count || 0;

        if (badge) {
            if (pendingCount > 0) {
                badge.innerText = pendingCount > 99 ? '99+' : pendingCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        if (modalBadge) {
            modalBadge.innerText = `${pendingCount} Pending`;
        }
    } catch (err) {
        console.warn("Query badge fetch error:", err);
    }
}

// 📂 2. Open Queries Modal
async function openQueriesModal() {
    const modal = document.getElementById('queriesModal');
    const content = document.getElementById('queriesModalContent');
    if (!modal || !content) return;

    content.innerHTML = '<p style="text-align: center; color: #64748b; padding: 25px;">Loading raised queries...</p>';
    modal.style.display = 'flex';

    try {
        const { data: queries, error } = await supabaseClient
            .from('query_raises')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        if (!queries || queries.length === 0) {
            content.innerHTML = '<div style="padding: 35px; text-align: center; color: #94a3b8;">Koi objection/query nahi mili.</div>';
            return;
        }

        // Fetch user profiles for display names
        const userIds = [...new Set(queries.map(q => q.user_id).filter(Boolean))];
        let profileMap = {};
        if (userIds.length > 0) {
            const { data: profiles } = await supabaseClient
                .from('profiles')
                .select('id, display_name')
                .in('id', userIds);
            
            if (profiles) {
                profiles.forEach(p => {
                    profileMap[p.id] = p.display_name || 'Anonymous';
                });
            }
        }

        let tableHtml = `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569; background: #f8fafc;">
                        <th style="padding: 10px 8px;">Candidate</th>
                        <th style="padding: 10px 8px;">Question ID</th>
                        <th style="padding: 10px 8px;">Objection</th>
                        <th style="padding: 10px 8px;">Time</th>
                        <th style="padding: 10px 8px;">Status</th>
                        <th style="padding: 10px 8px; text-align: right;">Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        queries.forEach(q => {
            const dateObj = q.created_at ? new Date(q.created_at) : null;
            const formattedTime = dateObj ? dateObj.toLocaleDateString('en-IN', { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            }) : 'N/A';

            const candidateName = profileMap[q.user_id] || (q.user_id ? q.user_id.slice(0, 8) + '...' : 'Student');
            const isPending = (q.status === 'pending');
            const isApproved = (q.status === 'approved');

            const statusPill = isPending
                ? '<span style="background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">PENDING</span>'
                : (isApproved 
                    ? '<span style="background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">APPROVED</span>'
                    : '<span style="background: #f1f5f9; color: #64748b; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">REJECTED</span>');

            tableHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9; ${isPending ? 'background: rgba(254, 242, 242, 0.35);' : ''}">
                    <td style="padding: 10px 8px;">
                        <b style="color: #0f172a;">${candidateName}</b>
                    </td>
                    <td style="padding: 10px 8px;">
                        <a href="javascript:void(0)" onclick="inspectQuestionDetails('${q.question_id}')" style="font-weight: 800; color: #2563eb; text-decoration: underline; cursor: pointer;">
                            #${q.question_id} 🔍
                        </a>
                    </td>
                    <td style="padding: 10px 8px; max-width: 260px; word-break: break-word; color: #334155; font-weight: 500;">
                        ${q.issue_text || 'No description'}
                    </td>
                    <td style="padding: 10px 8px; font-size: 12px; color: #64748b; white-space: nowrap;">
                        ${formattedTime}
                    </td>
                    <td style="padding: 10px 8px;">${statusPill}</td>
                    <td style="padding: 10px 8px; text-align: right; white-space: nowrap;">
                        ${isPending ? `
                            <button onclick="approveQueryAction(${q.id}, '${q.user_id}', this)" style="background: #10b981; color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px; margin-right: 4px;">
                                ✅ Approve (+1)
                            </button>
                            <button onclick="rejectQueryAction(${q.id}, this)" style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;">
                                ❌ Reject
                            </button>
                        ` : `
                            <span style="color: #94a3b8; font-size: 12px;">Done</span>
                        `}
                    </td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        content.innerHTML = tableHtml;
    } catch (e) {
        content.innerHTML = `<p style="color: red; padding: 15px;">Error loading queries: ${e.message}</p>`;
    }
}

// 🟢 3. Approve Action: Sirf Status 'approved' karega (Score backend auto-update karega)
async function approveQueryAction(queryId, userId, btnElement) {
    if (isQueryProcessing) return;

    if (!confirm("Is query ko Approve karna hai? (Score automatically sync hoga)")) {
        return;
    }

    isQueryProcessing = true;
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerText = "⏳...";
    }

    try {
        const numericId = parseInt(queryId);

        // Sirf status ko 'approved' karein (backend score khud handle karega)
        const { error: queryErr } = await supabaseClient
            .from('query_raises')
            .update({ status: 'approved' })
            .eq('id', numericId);

        if (queryErr) throw queryErr;

        openQueriesModal();
        refreshQueryNotificationBadge();
    } catch (err) {
        alert("Action Error: " + err.message);
        console.error("Approve failed:", err);
    } finally {
        setTimeout(() => {
            isQueryProcessing = false;
        }, 800);
    }
}
// 🔴 4. Reject Action
async function rejectQueryAction(queryId, btnElement) {
    if (isQueryProcessing) return;
    isQueryProcessing = true;

    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerText = "⏳...";
    }

    try {
        const numericId = parseInt(queryId);

        const { error } = await supabaseClient
            .from('query_raises')
            .update({ status: 'rejected' })
            .eq('id', numericId);

        if (error) throw error;

        openQueriesModal();
        refreshQueryNotificationBadge();
    } catch (err) {
        alert("Action Error: " + err.message);
        console.error("Reject failed:", err);
    } finally {
        setTimeout(() => {
            isQueryProcessing = false;
        }, 800);
    }
}

// 🔍 5. Inspect Question on ID Click
async function inspectQuestionDetails(questionId) {
    const modal = document.getElementById('questionDetailModal');
    const content = document.getElementById('qdModalContent');
    const title = document.getElementById('qdModalTitle');

    if (!modal || !content) return;

    title.innerText = `Question Inspector (#${questionId})`;
    content.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Fetching question from database...</p>';
    modal.style.display = 'flex';

    try {
        const { data: q, error } = await supabaseClient
            .from('questions')
            .select('*')
            .eq('id', questionId)
            .maybeSingle();

        if (error || !q) {
            content.innerHTML = `<p style="color: #ef4444; padding: 20px; text-align: center;">Question details nahi mili (ID: ${questionId})</p>`;
            return;
        }

        let rawCorrect = q.correct_option || q.answer || q.correct_answer || q.ans || '';
        let correctKey = rawCorrect;
        if (['1', '2', '3', '4', 1, 2, 3, 4].includes(rawCorrect)) {
            correctKey = 'opt' + rawCorrect;
        }

        const isOpt1 = correctKey === 'opt1';
        const isOpt2 = correctKey === 'opt2';
        const isOpt3 = correctKey === 'opt3';
        const isOpt4 = correctKey === 'opt4';

        content.innerHTML = `
            <div style="font-size: 14px; line-height: 1.5;">
                <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                    <b style="color: #0f172a; font-size: 15px;">${q.question_text || q.question || 'No Text'}</b>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                    <div style="padding: 10px 12px; border-radius: 8px; border: 1px solid ${isOpt1 ? '#22c55e' : '#e2e8f0'}; background: ${isOpt1 ? '#dcfce7' : '#ffffff'}; color: ${isOpt1 ? '#15803d' : '#334155'}; font-weight: ${isOpt1 ? '700' : '500'};">
                        (A) ${q.opt1 || 'N/A'} ${isOpt1 ? '✅ [Correct in DB]' : ''}
                    </div>
                    <div style="padding: 10px 12px; border-radius: 8px; border: 1px solid ${isOpt2 ? '#22c55e' : '#e2e8f0'}; background: ${isOpt2 ? '#dcfce7' : '#ffffff'}; color: ${isOpt2 ? '#15803d' : '#334155'}; font-weight: ${isOpt2 ? '700' : '500'};">
                        (B) ${q.opt2 || 'N/A'} ${isOpt2 ? '✅ [Correct in DB]' : ''}
                    </div>
                    <div style="padding: 10px 12px; border-radius: 8px; border: 1px solid ${isOpt3 ? '#22c55e' : '#e2e8f0'}; background: ${isOpt3 ? '#dcfce7' : '#ffffff'}; color: ${isOpt3 ? '#15803d' : '#334155'}; font-weight: ${isOpt3 ? '700' : '500'};">
                        (C) ${q.opt3 || 'N/A'} ${isOpt3 ? '✅ [Correct in DB]' : ''}
                    </div>
                    <div style="padding: 10px 12px; border-radius: 8px; border: 1px solid ${isOpt4 ? '#22c55e' : '#e2e8f0'}; background: ${isOpt4 ? '#dcfce7' : '#ffffff'}; color: ${isOpt4 ? '#15803d' : '#334155'}; font-weight: ${isOpt4 ? '700' : '500'};">
                        (D) ${q.opt4 || 'N/A'} ${isOpt4 ? '✅ [Correct in DB]' : ''}
                    </div>
                </div>

                ${q.explanation ? `
                    <div style="background: #eff6ff; border: 1px dashed #93c5fd; padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #1e40af;">
                        <b>💡 Explanation:</b> ${q.explanation}
                    </div>
                ` : '<div style="color: #94a3b8; font-size: 12px;">No explanation stored for this question.</div>'}
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<p style="color: red; padding: 15px;">Error: ${e.message}</p>`;
    }
}

// Auto-run badge check on load
document.addEventListener("DOMContentLoaded", () => {
    refreshQueryNotificationBadge();
    setInterval(refreshQueryNotificationBadge, 15000);
});
