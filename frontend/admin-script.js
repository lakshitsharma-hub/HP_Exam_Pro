// --- 1. SUPABASE INITIALIZATION ---
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co";[cite: 1]
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif";[cite: 1]
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);[cite: 1]

const log = document.getElementById('admin-log');
let allLoadedUsers = [];

// --- 2. DIFFICULTY & STATS COUNTER ---
async function refreshDashboardStats() {
    try {
        // Exam questions table se difficulty metrics fetch karna
        const tableName = 'exam_questions';
        
        // Total
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

        // Hard
        const { count: hardCount } = await supabaseClient
            .from(tableName)
            .select('*', { count: 'exact', head: true })
            .ilike('difficulty', '%hard%');

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
    tableBody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;">Loading candidate data...</td></tr>';[cite: 1]

    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });[cite: 1]

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color: red; padding: 12px;">Error: ${error.message}</td></tr>`;[cite: 1]
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
        const isPro = user.is_pro;[cite: 1]
        const limitText = user.custom_limit !== null && user.custom_limit !== undefined 
            ? `${user.custom_limit} Tests` 
            : 'Default';[cite: 1]

        const statusTag = isPro 
            ? '<span style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">👑 PRO</span>' 
            : '<span style="background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">FREE</span>';[cite: 1]

        let formattedActive = 'Never';
        if (user.last_active) {
            const dateObj = new Date(user.last_active);
            formattedActive = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        }

        const row = `
            <tr style="border-bottom: 1px solid #f1f5f9; hover: background: #f8fafc;">
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
    document.getElementById('modalUserName').innerText = `Attempts: ${displayName}`;
    document.getElementById('modalUserEmail').innerText = `ID: ${userId}`;
    const content = document.getElementById('modalAttemptsContent');
    content.innerHTML = '<p style="text-align: center; color: #64748b;">Loading test records...</p>';
    document.getElementById('userModal').style.display = 'flex';

    // Fetch from test_results / test_attempts
    const { data: attempts, error } = await supabaseClient
        .from('test_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error || !attempts || attempts.length === 0) {
        content.innerHTML = '<div style="padding: 30px; text-align: center; color: #94a3b8;">Is candidate ne abhi tak koi full test attempt nahi kiya hai.</div>';
        return;
    }

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

    attempts.forEach(att => {
        const attemptDate = new Date(att.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const serialized = encodeURIComponent(JSON.stringify(att));
        listHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 8px; font-weight: 700; text-transform: uppercase;">${att.exam_type || 'Mock Test'}</td>
                <td style="padding: 10px 8px; font-weight: 700; color: #2563eb;">${att.score ?? att.marks_obtained ?? '0'}</td>
                <td style="padding: 10px 8px; color: #64748b;">${attemptDate}</td>
                <td style="padding: 10px 8px; text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                    <button onclick="viewAttemptedResponses('${serialized}')" style="background: #3b82f6; color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;">
                        👁️ View Responses
                    </button>
                    <button onclick="generateUserAttemptPDF('${serialized}', '${displayName}')" style="background: #10b981; color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;">
                        📄 PDF
                    </button>
                </td>
            </tr>
        `;
    });

    listHtml += '</tbody></table>';
    content.innerHTML = listHtml;
}

// Candidate ke question-wise ticked answers dekhne ke liye
function viewAttemptedResponses(serializedAttempt) {
    const att = JSON.parse(decodeURIComponent(serializedAttempt));
    const container = document.getElementById('reviewModalContent');
    document.getElementById('reviewModalTitle').innerText = `${(att.exam_type || 'Test').toUpperCase()} Response Sheet`;

    // responses JSON structure
    const answers = att.responses || att.user_answers || {};
    
    if (Object.keys(answers).length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: #94a3b8;">Detailed response map is empty for this session.</p>';
    } else {
        let qCards = '';
        let index = 1;
        for (const [qid, val] of Object.entries(answers)) {
            const userAns = typeof val === 'object' ? val.selected : val;
            const correctAns = typeof val === 'object' ? val.correct : 'N/A';
            const isMatched = userAns && correctAns && (String(userAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase());

            qCards += `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
                        <span>Question #${index++} (ID: ${qid})</span>
                        <span style="color: ${isMatched ? '#16a34a' : '#dc2626'};">
                            ${isMatched ? '✅ Correct (+1)' : (userAns ? '❌ Incorrect (-0.25)' : '⚪ Unattempted')}
                        </span>
                    </div>
                    <div style="margin-top: 8px; font-size: 13px;">
                        <b>Candidate Marked:</b> <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">${userAns || 'None'}</span>
                        &nbsp;|&nbsp; <b>Correct:</b> <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px;">${correctAns}</span>
                    </div>
                </div>
            `;
        }
        container.innerHTML = qCards;
    }

    document.getElementById('reviewModal').style.display = 'flex';
}

// User Attempt ka Printable PDF
function generateUserAttemptPDF(serializedAttempt, displayName) {
    const att = JSON.parse(decodeURIComponent(serializedAttempt));
    const win = window.open('', '_blank');
    const answers = att.responses || att.user_answers || {};

    let responseList = '';
    let i = 1;
    for (const [qid, val] of Object.entries(answers)) {
        const u = typeof val === 'object' ? val.selected : val;
        const c = typeof val === 'object' ? val.correct : 'N/A';
        responseList += `
            <div style="border-bottom: 1px solid #cbd5e1; padding: 6px 0; font-size: 12px; page-break-inside: avoid; break-inside: avoid;">
                <b>Q${i++}:</b> Selected: <u>${u || 'Skipped'}</u> | Correct Key: <b>${c}</b>
            </div>
        `;
    }

    const html = `
        <html>
        <head>
            <title>${displayName} - Attempt Sheet</title>
            <style>
                body { font-family: sans-serif; padding: 30px; }
                .card { border: 1px solid #334155; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h2>🏔️ HP Exam Pro - Candidate Scorecard</h2>
            <div class="card">
                <p><b>Candidate:</b> ${displayName}</p>
                <p><b>Target Exam:</b> ${(att.exam_type || '').toUpperCase()}</p>
                <p><b>Score Secured:</b> ${att.score ?? 'N/A'}</p>
                <p><b>Generated At:</b> ${new Date().toLocaleString()}</p>
            </div>
            <h3>Detailed Question Audit</h3>
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

// --- 5. CLEAN ANTI-CUT MOCK PDF GENERATOR ---
async function generateTestPDF(examType) {
    let examName = 'JOA IT Examination';[cite: 1]
    let totalMarks = '120';[cite: 1]
    let timeAllowed = '90 Minutes';[cite: 1]

    if (examType === 'patwari') {
        examName = 'HPRCA Patwari Examination';[cite: 1]
        totalMarks = '120';[cite: 1]
        timeAllowed = '90 Minutes';[cite: 1]
    } else if (examType === 'hp_police') {
        examName = 'HP Police Constable Examination';[cite: 1]
        totalMarks = '90';[cite: 1]
        timeAllowed = '120 Minutes (2 Hours)';[cite: 1]
    }
    
    const printWindow = window.open('', '_blank');[cite: 1]
    printWindow.document.write('<html><head><title>Generating PDF...</title></head><body style="font-family:sans-serif; padding:40px; text-align:center;"><h2>⏳ HP Exam Pro... Generating Non-Cutting PDF...</h2></body></html>');[cite: 1]

    try {
        const response = await fetch(`https://hp-exam-pro-dixk.onrender.com/api/questions/${examType}?user_id=test-user-123&t=${Date.now()}`);[cite: 1]
        const questions = await response.json();[cite: 1]

        if (!questions || questions.length === 0) {
            alert("Questions load nahi ho paaye!");
            printWindow.close();[cite: 1]
            return;
        }

        let questionsHTML = '';[cite: 1]
        let answerKeyRows = '';[cite: 1]
        let explanationsHTML = '';[cite: 1]

        questions.forEach((q, index) => {
            const qNum = index + 1;[cite: 1]
            let correctOpt = q.correct_option || q.answer || q.correct_answer || "N/A";[cite: 1]
            if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correctOpt)) {
                correctOpt = 'Option ' + correctOpt;[cite: 1]
            }

            // Clean, non-cutting question card container
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
            `;[cite: 1]

            if (q.explanation && q.explanation.trim() !== "") {
                explanationsHTML += `
                    <div style="margin-bottom: 10px; padding: 8px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 12px; page-break-inside: avoid; break-inside: avoid;">
                        <b>Q${qNum} Sol:</b> ${q.explanation}
                    </div>
                `;[cite: 1]
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

        printWindow.document.open();[cite: 1]
        printWindow.document.write(fullHTML);[cite: 1]
        printWindow.document.close();[cite: 1]
    } catch (e) {
        alert("PDF Generate Error: " + e.message);[cite: 1]
        if (printWindow) printWindow.close();[cite: 1]
    }
}

// --- 6. PRO & LIMIT TOGGLES ---
async function togglePro(userId, currentStatus) {
    const { error } = await supabaseClient
        .from('profiles')
        .update({ is_pro: !currentStatus })
        .eq('id', userId);[cite: 1]

    if (!error) loadUsers();[cite: 1]
    else alert("Error updating Pro: " + error.message);[cite: 1]
}

async function setCustomUserLimit(userId, currentLimit) {
    const newLimit = prompt("Test limit dalein:", currentLimit);[cite: 1]
    if (newLimit === null || newLimit === "") return;[cite: 1]

    const { error } = await supabaseClient
        .from('profiles')
        .update({ custom_limit: parseInt(newLimit) })
        .eq('id', userId);[cite: 1]

    if (!error) loadUsers();[cite: 1]
    else alert("Error updating limit: " + error.message);[cite: 1]
}

// --- 7. CSV UPLOAD LOGIC ---
async function triggerCSVUpload() {
    const fileInput = document.getElementById('csvUpload');[cite: 1]
    const file = fileInput.files[0];[cite: 1]
    if (!file) return;

    if (log) log.innerHTML += `<br>> Reading: ${file.name}...`;

    Papa.parse(file, {
        header: true,[cite: 1]
        skipEmptyLines: true,[cite: 1]
        complete: async function(results) {
            const data = results.data;[cite: 1]
            if (log) log.innerHTML += `<br>> Uploading ${data.length} questions in batches...`;

            for (let i = 0; i < data.length; i += 50) {
                const batch = data.slice(i, i + 50);[cite: 1]
                const { error } = await supabaseClient
                    .from('exam_questions')
                    .insert(batch);[cite: 1]

                if (error) {
                    if (log) log.innerHTML += `<br><span style="color:red;">> Error: ${error.message}</span>`;
                    break;[cite: 1]
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

// Listeners
document.addEventListener("DOMContentLoaded", () => {
    refreshDashboardStats();
    loadUsers();
    const csvElem = document.getElementById('csvUpload');
    if (csvElem) csvElem.addEventListener('change', triggerCSVUpload);
});
