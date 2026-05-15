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
