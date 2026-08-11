// --- 1. SUPABASE CONNECTION (Wahi keys jo script.js mein hain) ---
const SB_URL = "https://jitkmfqxojfppnpoxeff.supabase.co"; 
const SB_KEY = "sb_publishable_6H4ld2wexzzNexqTfOtvIw_xLkWKsif"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const log = document.getElementById('admin-log');

// --- 2. CSV UPLOAD LOGIC ---
async function triggerCSVUpload() {
    const fileInput = document.getElementById('csvUpload');
    const file = fileInput.files[0];

    if (!file) {
        alert("Bhai, pehle koi CSV file toh select karo!");
        return;
    }

    log.innerHTML += `<br>> Reading file: ${file.name}...`;

    // PapaParse ka use karke CSV read karein
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            log.innerHTML += `<br>> Found ${data.length} questions. Starting upload to database...`;

            // Batch upload: 50-50 sawal karke bhejenge taaki crash na ho
            for (let i = 0; i < data.length; i += 50) {
                const batch = data.slice(i, i + 50);
                
                // Table ka naam 'exam_questions' hona chahiye
                const { error } = await supabaseClient
                    .from('exam_questions')
                    .insert(batch);

                if (error) {
                    log.innerHTML += `<br><span style="color:red;">> Error at ${i}: ${error.message}</span>`;
                    console.error(error);
                    break;
                }
                log.innerHTML += `<br>> Progress: ${i + batch.length}/${data.length} uploaded...`;
            }
            log.innerHTML += `<br><span style="color:#00ff00;">> ✅ Done! All questions added successfully.</span>`;
        }
    });
}
// 1. Supabase से सारे यूज़र्स की लिस्ट लाना
async function loadUsers() {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center;">Loading...</td></tr>';

    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="4" style="color: red;">Error: ${error.message}</td></tr>`;
        return;
    }

    tableBody.innerHTML = '';
    users.forEach(user => {
        const isPro = user.is_pro;
        const limitText = user.custom_limit !== null ? `${user.custom_limit} Tests` : 'Default (1 Free / 15 Pro)';
        const statusTag = isPro 
            ? '<span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: 600;">👑 PRO</span>' 
            : '<span style="background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px; font-weight: 600;">FREE</span>';

        const row = `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; font-weight: 600; color: #0f172a;">${user.display_name || 'User'}</td>
                <td style="padding: 12px;">${statusTag}</td>
                <td style="padding: 12px;"><b style="color: #2563eb;">${limitText}</b></td>
                <td style="padding: 12px; display: flex; gap: 8px;">
                    <button onclick="togglePro('${user.id}', ${isPro})" style="background: ${isPro ? '#ef4444' : '#10b981'}; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        ${isPro ? 'Remove Pro' : 'Make Pro'}
                    </button>
                    <button onclick="setCustomUserLimit('${user.id}', '${user.custom_limit || ''}')" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        ✏️ Change Limit
                    </button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}
// 📄 LIVE MOCK TEST & ANSWER KEY PDF GENERATION LOGIC
async function generateTestPDF(examType) {
    // 🟢 1. डायनामिक एग्जाम डेटा सेट करना
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
        timeAllowed = '120 Minutes (2 Hours)';
    }
    
    // 2. बैकएंड से लाइव सवाल फेच करो
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Generating PDF...</title></head><body style="font-family:sans-serif; padding:40px; text-align:center;"><h2>⏳ HP Exam Pro... प्रश्न पत्र तैयार किया जा रहा है...</h2></body></html>');

    try {
        const response = await fetch(`https://hp-exam-pro-dixk.onrender.com/api/questions/${examType}?user_id=test-user-123&t=${Date.now()}`);
        const questions = await response.json();

        if (!questions || questions.length === 0) {
            alert("सवाल लोड नहीं हो पाए!");
            printWindow.close();
            return;
        }

        // 3. HTML layout ready करना
        let questionsHTML = '';
        let answerKeyRows = '';
        let explanationsHTML = '';

        questions.forEach((q, index) => {
            const qNum = index + 1;
            let correctOpt = q.correct_option || q.answer || q.correct_answer || "N/A";
            
            // Format Correct Option
            if (['1', '2', '3', '4', 1, 2, 3, 4].includes(correctOpt)) {
                correctOpt = 'Option ' + correctOpt;
            }

            // Question Card
            questionsHTML += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <p style="font-weight: bold; margin: 0 0 6px 0; color: #1e293b;">Q${qNum}. ${q.question_text || q.question}</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 13px; color: #334155; padding-left: 10px;">
                        <div>(A) ${q.opt1 || ''}</div>
                        <div>(B) ${q.opt2 || ''}</div>
                        <div>(C) ${q.opt3 || ''}</div>
                        <div>(D) ${q.opt4 || ''}</div>
                    </div>
                </div>
            `;

            // Answer Key Grid Row
            answerKeyRows += `
                <div style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-size: 12px;">
                    <b>Q${qNum}:</b> ${correctOpt}
                </div>
            `;

            // Explanations (अगर हों)
            if (q.explanation && q.explanation.trim() !== "") {
                explanationsHTML += `
                    <div style="margin-bottom: 10px; padding: 8px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 12px;">
                        <b>Q${qNum} Sol:</b> ${q.explanation}
                    </div>
                `;
            }
        });

        // 4. पूरा डॉक्यूमेंट तैयार करना (CSS Watermark & WhatsApp Footer के साथ)
        const fullHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${examName} - Mock Test PDF</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
                    body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 20px; padding-bottom: 60px; color: #0f172a; line-height: 1.4; position: relative; z-index: 1; }
                    
                    /* 🟢 Watermark CSS */
                    .watermark {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 110px;
                        font-weight: bold;
                        color: rgba(148, 163, 184, 0.15); 
                        z-index: -1;
                        white-space: nowrap;
                        pointer-events: none;
                        user-select: none;
                    }

                    /* 🟢 Footer CSS (हर पेज के नीचे दिखेगा) */
                    .pdf-footer {
                        position: fixed;
                        bottom: 10px;
                        left: 0;
                        width: 100%;
                        text-align: center;
                        font-size: 12px;
                        color: #475569;
                        border-top: 1px dashed #cbd5e1;
                        padding-top: 8px;
                        background: white;
                        z-index: 10;
                        line-height: 1.6;
                    }

                    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 22px; color: #1e293b; }
                    .header p { margin: 4px 0; font-size: 13px; color: #475569; }
                    .meta-info { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
                    .page-break { page-break-before: always; }
                    .answer-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 15px; }
                    
                    @media print {
                        body { padding: 0; padding-bottom: 50px; }
                        button { display: none; }
                        .watermark { color: rgba(148, 163, 184, 0.2) !important; -webkit-print-color-adjust: exact; }
                        .pdf-footer { bottom: 0; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <!-- 🟢 Watermark HTML -->
                <div class="watermark">HP EXAM PRO</div>

                <!-- 🟢 WhatsApp Footer HTML (साफ़ चेतावनी के साथ) -->
                <div class="pdf-footer">
                    © 2026 HP EXAM PRO | Practice Mock Test <br>
                    💬 <b>For Support & Queries, WhatsApp Only (Strictly No Calls): +91 86289-11975</b>
                </div>

                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">🖨️ Save as PDF / Print</button>
                </div>

                <div class="header">
                    <h1>🏔️ HP EXAM PRO - OFFICIAL MOCK TEST</h1>
                    <p><b>Target Exam:</b> ${examName}</p>
                </div>

                <div class="meta-info">
                    <span>Time Allowed: ${timeAllowed}</span>
                    <span>Total Questions: ${questions.length}</span>
                    <span>Max Marks: ${totalMarks}</span>
                </div>

                <!-- 📝 QUESTION PAPER -->
                <div>
                    ${questionsHTML}
                </div>

                <!-- 🔑 ANSWER KEY SECTION (New Page) -->
                <div class="page-break"></div>
                <div class="header" style="margin-top: 20px;">
                    <h1>🔑 ANSWER KEY & SOLUTIONS</h1>
                    <p>${examName} - Answer Key Matrix</p>
                </div>

                <div class="answer-grid">
                    ${answerKeyRows}
                </div>

                <h3 style="margin-top: 30px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">💡 Detailed Explanations</h3>
                <div>
                    ${explanationsHTML || '<p style="font-size: 12px; color: #64748b;">No specific explanations provided for this set.</p>'}
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(() => { window.print(); }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(fullHTML);
        printWindow.document.close();

    } catch (e) {
        alert("PDF Generate करने में एरर आया: " + e.message);
        if (printWindow) printWindow.close();
    }
}
// 2. Pro Status चालू/बंद करना
async function togglePro(userId, currentStatus) {
    const { error } = await supabaseClient
        .from('profiles')
        .update({ is_pro: !currentStatus })
        .eq('id', userId);

    if (!error) loadUsers();
    else alert("Error updating Pro status: " + error.message);
}

// 3. Custom Limit बदलना
async function setCustomUserLimit(userId, currentLimit) {
    const newLimit = prompt("इस यूज़र के लिए नई टेस्ट लिमिट डालें (उदा. 5, 20, 50, या 999):", currentLimit);
    if (newLimit === null || newLimit === "") return;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ custom_limit: parseInt(newLimit) })
        .eq('id', userId);

    if (!error) {
        alert("✅ कस्टम लिमिट अपडेट हो गई!");
        loadUsers();
    } else {
        alert("❌ Error: " + error.message);
    }
}

document.addEventListener("DOMContentLoaded", loadUsers);
// --- 3. AI GENERATE (HINDI/COMPUTER/SCIENCE) ---
async function generateAIQuestions() {
    log.innerHTML += `<br>> Triggering AI Question Generator for missing subjects...`;
    
    // Yahan hum aapki Python backend API ko call karenge
    // Abhi ke liye hum sirf ek message dikhayenge
    log.innerHTML += `<br>> Connecting to Gemini API...`;
    setTimeout(() => {
        log.innerHTML += `<br><span style="color:yellow;">> AI logic integration pending (Connecting Python Backend).</span>`;
    }, 2000);
}

// Input file change hone par upload trigger karein (Optional)
document.getElementById('csvUpload').addEventListener('change', triggerCSVUpload);
