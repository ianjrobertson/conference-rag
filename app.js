// ============================================
// SUPABASE RAG APPLICATION
// ============================================

// Check if config is valid BEFORE trying to create Supabase client
function isConfigValid() {
    if (typeof SUPABASE_CONFIG === 'undefined') return false;

    const isPlaceholderUrl = !SUPABASE_CONFIG.url ||
        SUPABASE_CONFIG.url.includes('YOUR_SUPABASE') ||
        SUPABASE_CONFIG.url.includes('YOUR-PROJECT') ||
        SUPABASE_CONFIG.url === 'https://your-project-ref.supabase.co';

    const isPlaceholderKey = !SUPABASE_CONFIG.anonKey ||
        SUPABASE_CONFIG.anonKey.includes('YOUR_SUPABASE') ||
        SUPABASE_CONFIG.anonKey.includes('your-anon-key') ||
        SUPABASE_CONFIG.anonKey.length < 20;

    return !isPlaceholderUrl && !isPlaceholderKey;
}

// Initialize Supabase client only if config is valid
let supabaseClient = null;
const configIsValid = isConfigValid();

if (configIsValid) {
    try {
        supabaseClient = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
    } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
    }
}

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const emailInput = document.getElementById('email-input');
const loginBtn = document.getElementById('login-btn');
const loginMessage = document.getElementById('login-message');
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const questionInput = document.getElementById('question-input');
const askBtn = document.getElementById('ask-btn');
const chatMessages = document.getElementById('chat-messages');
const openaiKeyInput = document.getElementById('openai-key');
const numResultsInput = document.getElementById('num-results');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const loading = document.getElementById('loading');

// Setup Banner Elements
const setupBanner = document.getElementById('setup-banner');
const githubPagesUrl = document.getElementById('github-pages-url');
const copyUrlBtn = document.getElementById('copy-url-btn');
const closeSetupBannerBtn = document.getElementById('close-setup-banner');
const checkConfig = document.getElementById('check-config');
const checkConnection = document.getElementById('check-connection');
const checkRedirect = document.getElementById('check-redirect');
const checkOpenai = document.getElementById('check-openai');

// ============================================
// SETUP BANNER DETECTION
// ============================================

async function runSetupChecks() {
    const setupStatus = {
        configValid: false,
        connectionOk: false,
        openaiKeySet: false,
        allGood: false
    };

    // Calculate and display GitHub Pages URL
    const currentUrl = window.location.origin;
    if (githubPagesUrl) {
        githubPagesUrl.textContent = currentUrl;
    }

    // Set setup guide link to GitHub repo (for better preview)
    const setupGuideLink = document.getElementById('setup-guide-link');
    if (setupGuideLink && currentUrl.includes('github.io')) {
        // Extract username and repo from GitHub Pages URL
        // Format: https://username.github.io/repo-name/
        const pathParts = window.location.pathname.split('/').filter(p => p);
        const repoName = pathParts[0] || 'conference-rag';
        const username = currentUrl.split('.github.io')[0].split('//')[1];
        setupGuideLink.href = `https://github.com/${username}/${repoName}/blob/main/SETUP.md`;
    } else {
        // Fallback to local file for local development
        setupGuideLink.href = 'SETUP.md';
    }

    // Set Supabase URL configuration link (extract project ID from URL)
    const supabaseConfigLink = document.getElementById('supabase-config-link');
    if (supabaseConfigLink && typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) {
        try {
            const supabaseUrl = new URL(SUPABASE_CONFIG.url);
            const projectId = supabaseUrl.hostname.split('.')[0]; // Extract subdomain
            supabaseConfigLink.href = `https://supabase.com/dashboard/project/${projectId}/auth/url-configuration`;
        } catch (err) {
            // If URL parsing fails, hide the link
            supabaseConfigLink.style.display = 'none';
        }
    } else {
        // Hide link if no valid config
        if (supabaseConfigLink) supabaseConfigLink.style.display = 'none';
    }

    // Check 1: Config has real values (not placeholders)
    if (!configIsValid) {
        updateCheckItem(checkConfig, 'error', '❌', 'Configure Supabase credentials in config.js');
        updateCheckItem(checkConnection, 'warning', '⏳', 'Waiting for config...');
    } else {
        updateCheckItem(checkConfig, 'success', '✅', 'Supabase credentials configured');
        setupStatus.configValid = true;

        // Check 2: Supabase connection works
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.auth.getSession();
                if (error) {
                    updateCheckItem(checkConnection, 'error', '❌', `Connection failed: ${error.message}`);
                } else {
                    updateCheckItem(checkConnection, 'success', '✅', 'Supabase connection OK');
                    setupStatus.connectionOk = true;
                }
            } catch (err) {
                updateCheckItem(checkConnection, 'error', '❌', 'Connection failed - check config');
            }
        } else {
            updateCheckItem(checkConnection, 'error', '❌', 'Failed to create Supabase client');
        }
    }

    // Check 3: Redirect URL (manual - just show warning/reminder)
    updateCheckItem(checkRedirect, 'warning', '⚠️', `Add ${currentUrl} to Supabase redirect URLs`);

    // Check 4: OpenAI API key set
    const openaiKey = localStorage.getItem('openai_key');
    if (openaiKey && openaiKey.startsWith('sk-')) {
        updateCheckItem(checkOpenai, 'success', '✅', 'OpenAI API key configured');
        setupStatus.openaiKeySet = true;
    } else {
        updateCheckItem(checkOpenai, 'warning', '⏳', 'Add OpenAI API key in settings');
    }

    // Determine if we should show the banner
    setupStatus.allGood = setupStatus.configValid && setupStatus.connectionOk && setupStatus.openaiKeySet;

    // Show banner if something needs attention, unless user dismissed it
    const bannerDismissed = sessionStorage.getItem('setup_banner_dismissed');
    if (setupBanner) {
        if (!setupStatus.allGood && !bannerDismissed) {
            setupBanner.classList.remove('hidden');
        } else {
            setupBanner.classList.add('hidden');
        }
    }

    return setupStatus;
}

function updateCheckItem(element, status, icon, text) {
    if (!element) return;
    element.className = `setup-item ${status}`;
    const iconSpan = element.querySelector('.check-icon');
    const textSpan = element.querySelector('span:last-child');
    if (iconSpan) iconSpan.textContent = icon;
    if (textSpan) textSpan.textContent = text;
}

// Copy URL to clipboard
if (copyUrlBtn) {
    copyUrlBtn.addEventListener('click', async () => {
        const url = githubPagesUrl ? githubPagesUrl.textContent : window.location.origin;
        try {
            await navigator.clipboard.writeText(url);
            copyUrlBtn.textContent = '✅';
            copyUrlBtn.classList.add('copied');
            setTimeout(() => {
                copyUrlBtn.textContent = '📋';
                copyUrlBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    });
}

// Dismiss setup banner (for this session)
if (closeSetupBannerBtn) {
    closeSetupBannerBtn.addEventListener('click', () => {
        if (setupBanner) {
            setupBanner.classList.add('hidden');
        }
        sessionStorage.setItem('setup_banner_dismissed', 'true');
    });
}

// ============================================
// AUTHENTICATION
// ============================================

// Check for existing session on page load
async function checkSession() {
    // If Supabase isn't configured, just show the login screen (with banner)
    if (!supabaseClient) {
        showLogin();
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        showApp(session.user);
    } else {
        showLogin();
    }
}

// Handle magic link login
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        if (!supabaseClient) {
            showMessage('Please configure Supabase first (see Setup Guide)', 'error');
            return;
        }

        const email = emailInput.value.trim();

        if (!email) {
            showMessage('Please enter your email', 'error');
            return;
        }

        showLoading(true);

        const { error } = await supabaseClient.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        showLoading(false);

        if (error) {
            showMessage(`Error: ${error.message}`, 'error');
        } else {
            showMessage('Check your email for the magic link!', 'success');
        }
    });
}

// Handle logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        showLogin();
    });
}

// Listen for auth state changes
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            showApp(session.user);
        } else if (event === 'SIGNED_OUT') {
            showLogin();
        }
    });
}

// ============================================
// UI STATE MANAGEMENT
// ============================================

function showLogin() {
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appScreen) appScreen.classList.add('hidden');
}

function showApp(user) {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    if (userEmailSpan) userEmailSpan.textContent = user.email;
    loadSettings();
}

function showMessage(text, type) {
    if (loginMessage) {
        loginMessage.textContent = text;
        loginMessage.className = `message ${type}`;
        loginMessage.classList.remove('hidden');
    }
}

function showLoading(show) {
    if (loading) {
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

function loadSettings() {
    const openaiKey = localStorage.getItem('openai_key') || '';
    const numResults = localStorage.getItem('num_results') || '5';

    if (openaiKeyInput) openaiKeyInput.value = openaiKey;
    if (numResultsInput) numResultsInput.value = numResults;
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        if (openaiKeyInput) localStorage.setItem('openai_key', openaiKeyInput.value);
        if (numResultsInput) localStorage.setItem('num_results', numResultsInput.value);

        // Show temporary success message
        const originalText = saveSettingsBtn.textContent;
        saveSettingsBtn.textContent = '✓ Saved!';
        setTimeout(() => {
            saveSettingsBtn.textContent = originalText;
        }, 2000);

        // Re-run setup checks to update banner
        runSetupChecks();
    });
}

// ============================================
// RAG QUERY FUNCTIONALITY
// ============================================

async function askQuestion() {
    if (!supabaseClient) {
        addMessage('Please configure Supabase first (see Setup Guide)', 'error');
        return;
    }

    const question = questionInput ? questionInput.value.trim() : '';
    const openaiKey = localStorage.getItem('openai_key');
    const numResults = parseInt(localStorage.getItem('num_results') || '5');

    if (!question) {
        return;
    }

    if (!openaiKey) {
        addMessage('Please set your OpenAI API key in the settings panel', 'error');
        return;
    }

    // Add user question to chat
    addMessage(question, 'user');
    if (questionInput) questionInput.value = '';

    showLoading(true);

    try {
        // Step 1: Get embedding for the question
        const embedding = await getEmbedding(question, openaiKey);

        // Step 2: Search for similar documents
        const results = await searchDocuments(embedding, numResults);

        // Step 3: Generate answer using GPT
        const answer = await generateAnswer(question, results, openaiKey);

        // Add AI response to chat
        addMessage(answer, 'assistant');

    } catch (error) {
        console.error('Error:', error);
        addMessage(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Get embedding from OpenAI
async function getEmbedding(text, apiKey) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text
        })
    });

    if (!response.ok) {
        throw new Error('Failed to get embedding from OpenAI');
    }

    const data = await response.json();
    return data.data[0].embedding;
}

// Search documents using Supabase vector similarity
async function searchDocuments(embedding, limit) {
    if (!supabaseClient) {
        throw new Error('Supabase not configured');
    }

    // TODO: Students will implement this function
    // This should call a Supabase RPC function that performs vector similarity search

    // Example implementation (students will need to create the RPC function):
    const { data, error } = await supabaseClient.rpc('search_documents', {
        query_embedding: embedding,
        match_count: limit
    });

    if (error) {
        throw new Error(`Database search failed: ${error.message}`);
    }

    return data;
}

// Generate answer using GPT
async function generateAnswer(question, context, apiKey) {
    const contextText = context.map(doc => doc.content).join('\n\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that answers questions about conference talks. Use the provided context to answer questions accurately.'
                },
                {
                    role: 'user',
                    content: `Context:\n${contextText}\n\nQuestion: ${question}`
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error('Failed to generate answer from OpenAI');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Add message to chat
function addMessage(text, type) {
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Event listeners
if (askBtn) {
    askBtn.addEventListener('click', askQuestion);
}

if (questionInput) {
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            askQuestion();
        }
    });
}

// ============================================
// INITIALIZE APP
// ============================================

// Run setup checks on page load (this runs immediately, before Supabase)
runSetupChecks();

// Check authentication session
checkSession();

