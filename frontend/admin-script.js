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
