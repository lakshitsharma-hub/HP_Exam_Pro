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

function viewAttemptedResponsesByIndex(index) {
    const att = currentModalAttempts[index];
    if (!att) return;

    const container = document.getElementById('reviewModalContent');
    document.getElementById('reviewModalTitle').innerText = `${(att.exam_type || 'Test').toUpperCase()} Response Sheet`;

    let answers = att.responses || att.user_answers || att.answers || {};
    if (typeof answers === 'string') {
        try { answers = JSON.parse(answers); } catch(e) {}
    }

    const keys = Object.keys(answers);
    if (keys.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: #94a3b8;">Detailed question map is empty for this session.</p>';
    } else {
        let qCards = '';
        let i = 1;
        keys.forEach(qid => {
            const val = answers[qid];
            const userAns = typeof val === 'object' && val !== null ? val.selected : val;
            const correctAns = typeof val === 'object' && val !== null ? val.correct : 'N/A';
            const isMatched = userAns && correctAns && (String(userAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase());

            qCards += `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
                        <span>Question #${i++}</span>
                        <span style="color: ${isMatched ? '#16a34a' : (userAns ? '#dc2626' : '#64748b')};">
                            ${isMatched ? '✅ Correct' : (userAns ? '❌ Incorrect' : '⚪ Skipped')}
                        </span>
                    </div>
                    <div style="margin-top: 8px; font-size: 13px;">
                        <b>Candidate Marked:</b> <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">${userAns || 'Not Answered'}</span>
                        &nbsp;|&nbsp; <b>Correct:</b> <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px;">${correctAns}</span>
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

function generateUserAttemptPDFByIndex(index) {
    const att = currentModalAttempts[index];
    if (!att) return;

    let answers = att.responses || att.user_answers || att.answers || {};
    if (typeof answers === 'string') {
        try { answers = JSON.parse(answers); } catch(e) {}
    }

    const win = window.open('', '_blank');
    let responseList = '';
    let i = 1;

    Object.keys(answers).forEach(qid => {
        const val = answers[qid];
        const u = typeof val === 'object' && val !== null ? val.selected : val;
        const c = typeof val === 'object' && val !== null ? val.correct : 'N/A';
        responseList += `
            <div style="border-bottom: 1px solid #cbd5e1; padding: 6px 0; font-size: 12px; page-break-inside: avoid; break-inside: avoid;">
                <b>Q${i++}:</b> Selected: <u>${u || 'Skipped'}</u> | Correct Key: <b>${c}</b>
            </div>
        `;
    });

    const html = `
        <html>
        <head>
            <title>${currentModalCandidateName} - Scorecard</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; color: #0f172a; }
                .card { border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 20px; background: #f8fafc; }
            </style>
        </head>
        <body>
            <h2>🏔️ HP Exam Pro - Candidate Scorecard</h2>
            <div class="card">
                <p><b>Candidate:</b> ${currentModalCandidateName}</p>
                <p><b>Target Exam:</b> ${(att.exam_type || '').toUpperCase()}</p>
                <p><b>Score Secured:</b> ${att.score ?? 'N/A'}</p>
                <p><b>Generated At:</b> ${new Date().toLocaleString()}</p>
            </div>
            <h3>Detailed Responses Audit</h3>
            ${responseList || '<p>No question map available.</p>'}
            <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
    `;
    win.document.write(html);
    win.document.close();
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
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
    const csvElem = document.getElementById('csvUpload');
    if (csvElem) csvElem.addEventListener('change', triggerCSVUpload);
});
