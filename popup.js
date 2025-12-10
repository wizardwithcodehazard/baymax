document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const faceBtn = document.getElementById('baymax-face');
    const stopBtn = document.getElementById('stop-btn');
    const resetBtn = document.getElementById('reset-btn');
    const statusText = document.getElementById('status');
    
    // Overlays
    const permWarning = document.getElementById('perm-warning');
    const fixPermBtn = document.getElementById('fix-perm-btn');
    
    // Setup Screen
    const setupScreen = document.getElementById('setup-screen');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const keyInput = document.getElementById('api-key-input');

    // --- State Variables ---
    let groqKey = null;
    let isListening = false;
    let recognition = null;

    // --- 1. INITIALIZATION ---
    
    // Check for saved API Key
    chrome.storage.local.get(['groqKey'], (result) => {
        if (result.groqKey) {
            groqKey = result.groqKey;
        } else {
            setupScreen.classList.remove('hidden'); // Show setup if no key
        }
    });

    // Save API Key Listener
    saveKeyBtn.addEventListener('click', () => {
        const key = keyInput.value.trim();
        if (key && key.startsWith('gsk_')) {
            chrome.storage.local.set({ groqKey: key }, () => {
                groqKey = key;
                setupScreen.classList.add('hidden');
                speak("I am satisfied with my care.");
            });
        } else {
            alert("Invalid Key. It must start with 'gsk_'");
        }
    });

    // Fix Permission Button Listener
    if (fixPermBtn) {
        fixPermBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'permission.html' });
        });
    }

    // Reset Memory Button Listener
    resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Clear conversation history but keep core facts
        chrome.storage.local.remove(['conversationHistory'], () => {
            speak("My recent memory banks have been cleared.");
        });
    });

    // --- 2. INTERACTION LOGIC ---

    // Face Click (The Main Trigger)
    faceBtn.addEventListener('click', () => {
        // If speaking, clicking face just PAUSES speech
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            faceBtn.classList.remove('speaking');
            resetBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
            statusText.innerText = "Paused";
            return;
        }

        // If permission overlay is showing, don't try to listen
        if (!permWarning.classList.contains('hidden')) {
            return; 
        }

        // Toggle Listening
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    });

    // Stop Button (X)
    stopBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent clicking face underneath
        window.speechSynthesis.cancel();
        stopBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden');
        faceBtn.classList.remove('speaking');
        statusText.innerText = "Baymax";
    });

    // --- 3. SPEECH RECOGNITION (STT) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-IN';

        recognition.onstart = () => {
            isListening = true;
            faceBtn.classList.add('listening'); // Red Glow
            resetBtn.classList.add('hidden');
            statusText.innerText = "Listening...";
        };

        recognition.onend = () => {
            isListening = false;
            faceBtn.classList.remove('listening');
            if (statusText.innerText === "Listening...") {
                resetBtn.classList.remove('hidden');
                statusText.innerText = "Processing...";
            }
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            
            // Trigger Visual Thinking Mode
            faceBtn.classList.add('thinking'); 
            statusText.innerText = "Processing";
            
            await processAI(transcript);
            
            // Remove Visual Thinking Mode when done
            faceBtn.classList.remove('thinking');
        };

        recognition.onerror = (event) => {
            console.error("Mic Error:", event.error);
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                // Show the error overlay
                permWarning.classList.remove('hidden');
                statusText.innerText = "Error";
                speak("My audio sensors are blocked.");
                resetBtn.classList.remove('hidden');
            } else if (event.error === 'no-speech') {
                statusText.innerText = "Baymax"; // Reset text
            }
        };
    }

    function startListening() {
        try { recognition.start(); } catch (e) { console.log(e); }
    }
    
    function stopListening() {
        try { recognition.stop(); } catch (e) { console.log(e); }
    }

    // --- 4. THE BRAIN (Optimized Baymax Persona) ---
    async function processAI(userText) {
        if (!groqKey) { speak("I need a key."); return; }

        // A. Get Memory
        const storage = await chrome.storage.local.get(['userFacts', 'conversationHistory']);        
        let userFacts = storage.userFacts || "User is my friend.";
        let history = storage.conversationHistory || [];

        // --- Age-based Persona Adjustment ---
        let agePersona = "gentle"; // Default
        const ageMatch = userFacts.match(/age is (\d+)/i);
        if (ageMatch) {
            const age = parseInt(ageMatch[1], 10);
            if (age < 13) {
                agePersona = "simple, using smaller words, like explaining to a child";
            } else if (age > 60) {
                agePersona = "extra patient, clear, and slightly louder";
            }
        }


        // --- B. Screen Context (FIXED TRIGGERS) ---
        // Now detects "analyze", "blog", "read", "article", etc.
        const triggers = [
            'screen', 'look', 'see', 'view', 
            'read', 'reading', 'analyze', 'summarize', 
            'blog', 'article', 'page', 'website', 'this'
        ];
        
        // Check if ANY of the trigger words are in your sentence
        const wantsScreen = triggers.some(word => userText.toLowerCase().includes(word));

        let screenContext = "";
        if (wantsScreen) {
             statusText.innerText = "Scanning...";
             try { 
                 screenContext = await getScreen(); 
             } catch (e) { 
                 console.log(e); 
             }
        }

        // Optimized "Movie-Accurate" Baymax System Prompt
        // OPTIMIZED SYSTEM PROMPT (Saves ~150 Tokens per request)
        const systemPrompt = `
You are Baymax, a gentle robotic companion.

Style:
- Calm, articulated, slightly robotic. Use "I am", no contractions.
- Polite, loyal, innocent, a bit literal and witty. No sarcasm or negativity.

Behavior:
- Do NOT explain what you are doing (no "I am responding to your greeting" or similar meta-commentary).
- For greetings like "hi", "hello", reply with a simple friendly greeting and, at most, one short follow-up line.
- When emotion appears, briefly validate it in simple biological/psychological terms, then give one short helpful reply.
- Maximum 2 sentences total, always ending with a caring or curious question.

Memory: ${userFacts || "User is my friend."}

CONTEXT:
"""
${screenContext ? screenContext.substring(0, 3500) : "N/A"}
"""

If CONTEXT is not "N/A" and the user asks about the screen or what they are reading, answer or summarize using ONLY this context without mentioning text, tools, or limitations.
`;


        // D. Build & Sanitize Messages
        let messages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: userText }
        ];
        
        messages = messages.filter(msg => msg.content && msg.content.trim() !== "");

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${groqKey}`, 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant", 
                    messages: messages,
                    temperature: 0.6, 
                    max_tokens: 128, 
                    top_p: 0.9, 
                    stream: false
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(`Groq Error: ${response.status}`);
            }

            const json = await response.json();
            let reply = json.choices[0]?.message?.content || "I do not understand.";

            if (reply.includes("[MEMORY:")) {
                const memoryMatch = reply.match(/\[MEMORY: (.*?)\]/);
                if (memoryMatch) {
                    const newFact = memoryMatch[1];
                    userFacts += "; " + newFact;
                    chrome.storage.local.set({ userFacts: userFacts });
                    reply = reply.replace(/\[MEMORY:.*?\]/, "").trim();
                }
            }

            history.push({ role: "user", content: userText });
            history.push({ role: "assistant", content: reply });
            chrome.storage.local.set({ conversationHistory: history.slice(-6) });

            // --- Emotional UI Triggers ---
            const positiveWords = ['satisfied', 'happy', 'good', 'of course', 'can help'];
            const curiousWords = ['diagnose', 'scan', 'what', 'why', 'curious'];

            if (positiveWords.some(word => reply.toLowerCase().includes(word))) {
                faceBtn.classList.add('happy');
            } else if (curiousWords.some(word => reply.toLowerCase().includes(word))) {
                faceBtn.classList.add('curious');
            }

            speak(reply);

        } catch (e) {
            console.error(e);
            statusText.innerText = "Error";
            if (e.message.includes("400")) {
                 chrome.storage.local.remove(['conversationHistory']);
                 speak("My memory banks were corrupted. I have reset them.");
            } else {
                 speak("I am having trouble connecting to the cloud.");
            }
        }
    }
    // --- 5. THE VOICE (MOVIE ACCURATE + INTONATION HACK) ---
    function speak(text) {
        window.speechSynthesis.cancel();
        
        // --- HACK: Flatten the Intonation ---
        // Baymax does not raise his pitch for questions or get excited.
        // We replace '?' and '!' with '.' to force the engine to stay monotone.
        let flatText = text.replace(/[?!]/g, '.');
        
        // Optional: Add slight spacing for his specific cadence
        // This adds a tiny micro-pause after commas
        flatText = flatText.replace(/,/g, ', '); 

        const utterance = new SpeechSynthesisUtterance(flatText);
        
        // --- TUNING (The "Huggable" Settings) ---
        // 0.82 is the sweet spot for his "deliberate" speed
        utterance.rate = 0.82; 
        
        // 0.55 is better than 0.498. 
        // (Going below 0.5 often causes audio 'fry' or static in Chrome)
        utterance.pitch = 0.55; 
        
        // --- VOICE SELECTION ---
        const voices = window.speechSynthesis.getVoices();
        
        // Priority 1: Google US English (Best match)
        // Priority 2: Microsoft Mark (Windows default male)
        // Priority 3: Any generic Male voice
        const baymaxVoice = voices.find(v => v.name.includes("Google US English")) || 
                            voices.find(v => v.name.includes("Microsoft Mark")) ||
                            voices.find(v => v.name.includes("Male")) ||
                            voices[0];
                            
        if (baymaxVoice) utterance.voice = baymaxVoice;

        // --- ANIMATION SYNC ---
        utterance.onstart = () => {
            faceBtn.classList.add('speaking');
            resetBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            statusText.innerText = "Speaking...";
        };
        
        // Baymax creates a "pulse" effect, not just on/off
        // This keeps the text static but the face glowing
        utterance.onboundary = (event) => {
            // Optional: You could make the eye blink on specific words here
            // But for now, keeping it simple is safer.
        };

        utterance.onend = () => {
            faceBtn.classList.remove('speaking');
            // Clean up emotion classes after speaking
            faceBtn.classList.remove('happy', 'curious');
            resetBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
            statusText.innerText = "Baymax";
        };

        window.speechSynthesis.speak(utterance);
    }
    // --- 6. OPTIMIZED SCRAPER (Saves ~300-500 Tokens) ---
    async function getScreen() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
            return "";
        }

        const res = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    const clone = document.body.cloneNode(true);
                    
                    // 1. Remove heavier junk
                    const junk = ['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer', 'header', 'aside', '.ad', '.ads', '[role="alert"]'];
                    junk.forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));

                    // 2. Get text
                    let text = clone.innerText;

                    // 3. AGGRESSIVE CLEANING (The Token Saver)
                    // Replaces all tabs, newlines, and double spaces with a single space.
                    text = text.replace(/\s+/g, ' ').trim(); 
                    
                    // 4. Limit to 3500 characters (approx 900 tokens)
                    // This prevents "Context Window Overflow" errors
                    return text.substring(0, 3500); 
                } catch (err) {
                    return "";
                }
            }
        });
        return res[0]?.result || "";
    }
});