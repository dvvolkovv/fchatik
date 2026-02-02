// AI Chat Platform - Main Application
// =====================================

// API Configuration
const API_CONFIG = {
    // Замените на ваш Railway URL после деплоя backend
    baseURL: 'http://localhost:8000/api/v1',
    // Production: 'https://your-backend.railway.app/api/v1'
};

// Auth state
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// API Helper Function
async function apiRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };
    
    // Add auth token if available
    if (authToken && !options.skipAuth) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    try {
        const response = await fetch(url, config);
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
            logout();
            showNotification('Сессия истекла. Войдите снова.', 'error');
            throw new Error('Unauthorized');
        }
        
        // Handle 402 Payment Required
        if (response.status === 402) {
            showNotification('Недостаточно средств. Пополните баланс.', 'warning');
            throw new Error('Insufficient balance');
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Authentication Functions
async function register(email, password) {
    const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
    });
    
    authToken = data.access_token;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    currentUser = data.user;
    
    AppState.user.balance = data.user.balance;
    updateBalance();
    
    return data;
}

async function login(email, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
    });
    
    authToken = data.access_token;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    currentUser = data.user;
    
    AppState.user.balance = data.user.balance;
    updateBalance();
    
    return data;
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    
    AppState.chats = [];
    AppState.currentChatId = null;
    AppState.user.balance = 0;
    
    showNotification('Вы вышли из системы', 'info');
    updateAuthUI();
    updateBalance();
    renderChatList();
    
    // Show welcome screen
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('chatContainer').style.display = 'none';
}

// Update auth UI based on login status
function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (authToken && currentUser) {
        // Logged in
        if (authBtn) authBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    } else {
        // Not logged in
        if (authBtn) authBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

// Chat API Functions
async function createChatAPI(title = "Новый чат") {
    return await apiRequest('/chats', {
        method: 'POST',
        body: JSON.stringify({ title }),
    });
}

async function getUserChats() {
    return await apiRequest('/chats');
}

async function getChatWithMessages(chatId) {
    return await apiRequest(`/chats/${chatId}`);
}

async function updateChatAPI(chatId, updates) {
    return await apiRequest(`/chats/${chatId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
}

async function deleteChatAPI(chatId) {
    await apiRequest(`/chats/${chatId}`, {
        method: 'DELETE',
    });
}

// LLM API Functions
async function sendMessageAPI(chatId, content, model) {
    return await apiRequest(`/llm/chat/${chatId}/message`, {
        method: 'POST',
        body: JSON.stringify({
            content: content,
            model: model,
            attachments: AppState.attachments || []
        })
    });
}

async function getAvailableModels() {
    const data = await apiRequest('/llm/models');
    return data.models;
}

// Load models from backend
async function loadModelsFromBackend() {
    try {
        const models = await getAvailableModels();
        AppState.models = models.map(model => ({
            id: model.id,
            name: model.name,
            icon: getModelIcon(model.provider),
            description: model.provider,
            price: `~${(model.price_output * 95).toFixed(2)}₽/1K токенов`,
            context: `${Math.floor(model.context_length / 1000)}K`,
            capabilities: model.capabilities
        }));
        renderModelSelector();
    } catch (error) {
        console.error('Failed to load models from backend:', error);
        // Fallback to default models
    }
}

function getModelIcon(provider) {
    if (provider.includes('OpenAI')) return '🔹';
    if (provider.includes('Anthropic')) return '🟣';
    if (provider.includes('Google')) return '🔶';
    if (provider.includes('Meta')) return '🦙';
    return '🤖';
}

// Application State
const AppState = {
    currentChatId: null,
    chats: [],
    currentModel: 'gpt-4-turbo',
    user: {
        balance: 125.50,
        profile: {
            values: [
                { name: 'Развитие', value: 90 },
                { name: 'Свобода', value: 85 },
                { name: 'Креативность', value: 75 },
                { name: 'Безопасность', value: 50 }
            ],
            interests: ['Python', 'AI/ML', 'Стартапы', 'WebDev'],
            skills: [
                { name: 'Python', level: 5 },
                { name: 'JavaScript', level: 4 },
                { name: 'React', level: 3 }
            ]
        }
    },
    voiceRecognition: null,
    isRecording: false,
    models: [
        {
            id: 'gpt-4-turbo',
            name: 'GPT-4 Turbo',
            icon: '🔹',
            description: 'Самая умная модель OpenAI',
            price: '~2₽/1K токенов',
            context: '128K',
            capabilities: ['text', 'vision', 'code']
        },
        {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            icon: '🔸',
            description: 'Быстрая и доступная модель',
            price: '~0.2₽/1K токенов',
            context: '16K',
            capabilities: ['text', 'code']
        },
        {
            id: 'claude-3-opus',
            name: 'Claude 3 Opus',
            icon: '🟣',
            description: 'Отлично для сложных задач',
            price: '~3₽/1K токенов',
            context: '200K',
            capabilities: ['text', 'vision', 'code']
        },
        {
            id: 'gemini-pro',
            name: 'Gemini Pro',
            icon: '🟢',
            description: 'Мультимодальная модель Google',
            price: '~1₽/1K токенов',
            context: '32K',
            capabilities: ['text', 'vision', 'code']
        },
        {
            id: 'claude-3-sonnet',
            name: 'Claude 3 Sonnet',
            icon: '🟣',
            description: 'Баланс скорости и качества',
            price: '~1.5₽/1K токенов',
            context: '200K',
            capabilities: ['text', 'vision', 'code']
        },
        {
            id: 'yandexgpt-pro',
            name: 'YandexGPT Pro',
            icon: '🔴',
            description: 'Продвинутая российская модель',
            price: '~1₽/1K токенов',
            context: '8K',
            capabilities: ['text', 'code']
        }
    ],
    attachments: []
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadSampleChats();
    setupMarkdown();
});

async function initializeApp() {
    // Configure marked.js for markdown rendering
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {}
                }
                return hljs.highlightAuto(code).value;
            }
        });
    }
    
    // Load models from backend
    await loadModelsFromBackend();
    
    // If user is logged in, load their data
    if (authToken && currentUser) {
        try {
            // Update user balance
            AppState.user.balance = currentUser.balance || 0;
            updateBalance();
            
            // Load user's chats
            await loadUserChats();
        } catch (error) {
            console.error('Failed to load user data:', error);
            // Token might be expired
            logout();
        }
    } else {
        updateBalance();
    }
    
    updateModelDisplay();
    initializeVoiceRecognition();
    initializeTheme();
}

// Theme Management
function initializeTheme() {
    // Check for saved theme preference or default to 'dark'
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update icon visibility
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    
    if (theme === 'light') {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
    } else {
        if (sunIcon) sunIcon.style.display = 'block';
        if (moonIcon) moonIcon.style.display = 'none';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Show notification
    const themeName = newTheme === 'dark' ? '🌙 Темная тема' : '☀️ Светлая тема';
    showNotification(`${themeName} активирована`, 'success', 2000);
}

// Voice Recognition Setup
function initializeVoiceRecognition() {
    // Check if browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Web Speech API не поддерживается этим браузером');
        const voiceBtn = document.getElementById('voiceInputBtn');
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.title = 'Голосовой ввод не поддерживается вашим браузером';
            voiceBtn.style.opacity = '0.3';
        }
        return;
    }
    
    AppState.voiceRecognition = new SpeechRecognition();
    AppState.voiceRecognition.continuous = false;
    AppState.voiceRecognition.interimResults = true;
    AppState.voiceRecognition.lang = 'ru-RU'; // Default to Russian
    
    // Event handlers
    AppState.voiceRecognition.onstart = () => {
        AppState.isRecording = true;
        const voiceBtn = document.getElementById('voiceInputBtn');
        voiceBtn.classList.add('recording');
        voiceBtn.title = 'Говорите... (нажмите, чтобы остановить)';
        console.log('🎤 Начата запись голоса');
    };
    
    AppState.voiceRecognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        const messageInput = document.getElementById('messageInput');
        
        if (finalTranscript) {
            // Insert final transcript
            const currentValue = messageInput.value;
            messageInput.value = currentValue + finalTranscript;
            handleInputChange({ target: messageInput });
            console.log('✅ Распознанный текст:', finalTranscript);
        } else if (interimTranscript) {
            // Show interim results (optional, for better UX)
            console.log('⏳ Промежуточный результат:', interimTranscript);
        }
    };
    
    AppState.voiceRecognition.onerror = (event) => {
        console.error('❌ Ошибка распознавания речи:', event.error);
        stopVoiceRecording();
        
        let errorMessage = 'Ошибка голосового ввода';
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'Речь не обнаружена. Попробуйте еще раз.';
                break;
            case 'audio-capture':
                errorMessage = 'Микрофон не найден или доступ запрещен.';
                break;
            case 'not-allowed':
                errorMessage = 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.';
                break;
            case 'network':
                errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
                break;
        }
        
        showNotification(errorMessage, 'error');
    };
    
    AppState.voiceRecognition.onend = () => {
        stopVoiceRecording();
        console.log('🛑 Запись голоса завершена');
    };
}

// Event Listeners
function setupEventListeners() {
    // Menu toggle
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    
    // New chat buttons
    document.getElementById('newChatBtn').addEventListener('click', createNewChat);
    document.getElementById('welcomeNewChatBtn').addEventListener('click', createNewChat);
    
    // Model selection
    document.getElementById('modelSelectBtn').addEventListener('click', openModelModal);
    document.getElementById('modelModalClose').addEventListener('click', closeModelModal);
    document.getElementById('modelModalOverlay').addEventListener('click', closeModelModal);
    
    // Profile
    document.getElementById('profileBtn').addEventListener('click', openProfileModal);
    document.getElementById('profileModalClose').addEventListener('click', closeProfileModal);
    document.getElementById('profileModalOverlay').addEventListener('click', closeProfileModal);
    document.getElementById('profileSaveBtn').addEventListener('click', saveProfile);
    document.getElementById('profileCancelBtn').addEventListener('click', closeProfileModal);
    
    // Message input
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleInputKeydown);
    
    // Send button
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    
    // File attachments
    document.getElementById('attachFileBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('attachImageBtn').addEventListener('click', () => document.getElementById('imageInput').click());
    document.getElementById('attachDocBtn').addEventListener('click', () => document.getElementById('docInput').click());
    
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('imageInput').addEventListener('change', handleFileSelect);
    document.getElementById('docInput').addEventListener('change', handleFileSelect);
    
    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => handleNavigation(item));
    });
    
    // Voice input
    document.getElementById('voiceInputBtn').addEventListener('click', toggleVoiceRecording);
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Auth buttons
    const authBtn = document.getElementById('authBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    if (authBtn) authBtn.addEventListener('click', showAuthModal);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    
    // Update auth UI based on login status
    updateAuthUI();
}

function setupMarkdown() {
    // Additional markdown configuration if needed
}

// Sidebar Functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('hidden');
    
    // On mobile, add a class to show sidebar
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('visible');
    }
}

// Chat Management
async function createNewChat() {
    if (!authToken) {
        showNotification('Войдите в систему для создания чата', 'error');
        return;
    }
    
    try {
        const newChat = await createChatAPI('Новый чат');
        
        const chat = {
            id: newChat.id,
            title: newChat.title,
            messages: [],
            createdAt: new Date(newChat.created_at),
            updatedAt: new Date(newChat.updated_at)
        };
        
        AppState.chats.unshift(chat);
        AppState.currentChatId = chat.id;
        
        renderChatList();
        showChat(chat.id);
    } catch (error) {
        console.error('Failed to create chat:', error);
        showNotification('Не удалось создать чат: ' + error.message, 'error');
    }
}

async function showChat(chatId) {
    AppState.currentChatId = chatId;
    let chat = AppState.chats.find(c => c.id === chatId);
    
    if (!chat) return;
    
    // Hide welcome screen, show chat
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    
    // Update chat title
    document.getElementById('chatTitle').textContent = chat.title;
    
    // Load messages from backend if not loaded yet
    if (authToken && chat.messages.length === 0) {
        try {
            addTypingIndicator();
            const chatData = await getChatWithMessages(chatId);
            chat.messages = chatData.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                model: msg.model_used,
                timestamp: new Date(msg.created_at),
                tokens: {
                    input: msg.tokens_input,
                    output: msg.tokens_output
                },
                cost: msg.cost
            }));
            removeTypingIndicator();
        } catch (error) {
            removeTypingIndicator();
            console.error('Failed to load messages:', error);
            showNotification('Не удалось загрузить сообщения', 'error');
        }
    }
    
    // Render messages
    renderMessages(chat.messages);
    
    // Update active state in chat list
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chatId === chatId);
    });
}

async function loadUserChats() {
    if (!authToken) {
        // Not logged in, show empty state
        AppState.chats = [];
        renderChatList();
        return;
    }
    
    try {
        const chats = await getUserChats();
        
        AppState.chats = chats.map(chat => ({
            id: chat.id,
            title: chat.title,
            messages: [], // Messages will be loaded when chat is opened
            createdAt: new Date(chat.created_at),
            updatedAt: new Date(chat.updated_at),
            is_favorite: chat.is_favorite
        }));
        
        renderChatList();
    } catch (error) {
        console.error('Failed to load chats:', error);
        showNotification('Не удалось загрузить чаты', 'error');
        AppState.chats = [];
        renderChatList();
    }
}

// For backward compatibility, keep this function but make it call loadUserChats
function loadSampleChats() {
    loadUserChats();
}

function renderChatList() {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    AppState.chats.forEach(chat => {
        const chatItem = document.createElement('button');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.id;
        
        if (chat.id === AppState.currentChatId) {
            chatItem.classList.add('active');
        }
        
        const lastMessage = chat.messages[chat.messages.length - 1];
        const preview = lastMessage ? 
            (lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')) : 
            'Новый чат';
        
        chatItem.innerHTML = `
            <div class="chat-item-title">${chat.title}</div>
            <div class="chat-item-preview">${preview}</div>
            <div class="chat-item-time">${formatTime(chat.updatedAt)}</div>
        `;
        
        chatItem.addEventListener('click', () => showChat(chat.id));
        chatList.appendChild(chatItem);
    });
}

// Message Rendering
function renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const messageEl = createMessageElement(message);
        container.appendChild(messageEl);
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.role === 'user' ? '👤' : '🤖';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    // Header
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `
        <span class="message-role">${message.role === 'user' ? 'Вы' : 'AI Ассистент'}</span>
        ${message.model ? `<span class="message-model">${getModelName(message.model)}</span>` : ''}
        <span class="message-time">${formatTime(message.timestamp)}</span>
    `;
    
    // Body
    const body = document.createElement('div');
    body.className = 'message-body';
    
    // Render markdown
    if (typeof marked !== 'undefined') {
        body.innerHTML = marked.parse(message.content);
        
        // Add copy buttons to code blocks
        body.querySelectorAll('pre').forEach((pre, index) => {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn';
            copyBtn.textContent = 'Копировать';
            copyBtn.onclick = () => copyCode(pre, copyBtn);
            pre.style.position = 'relative';
            pre.appendChild(copyBtn);
        });
    } else {
        body.textContent = message.content;
    }
    
    // Footer with stats
    const footer = document.createElement('div');
    footer.className = 'message-footer';
    
    if (message.tokens || message.cost) {
        const stats = document.createElement('div');
        stats.className = 'message-stats';
        if (message.tokens) {
            stats.innerHTML += `<span>💬 ${message.tokens.input + message.tokens.output} токенов</span>`;
        }
        if (message.cost) {
            stats.innerHTML += `<span>💰 ${message.cost.toFixed(2)}₽</span>`;
        }
        footer.appendChild(stats);
    }
    
    // Action buttons
    if (message.role === 'assistant') {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button class="message-action-btn" title="Копировать" onclick="copyMessage(this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
            </button>
            <button class="message-action-btn" title="Регенерировать" onclick="regenerateMessage(this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
            </button>
        `;
        footer.appendChild(actions);
    }
    
    content.appendChild(header);
    content.appendChild(body);
    if (footer.children.length > 0) {
        content.appendChild(footer);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    return messageDiv;
}

function addTypingIndicator() {
    const container = document.getElementById('messagesContainer');
    const typing = document.createElement('div');
    typing.id = 'typingIndicator';
    typing.className = 'message assistant';
    typing.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="message-body">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Message Sending
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content && AppState.attachments.length === 0) return;
    
    // Check if user is logged in
    if (!authToken) {
        showNotification('Войдите в систему для отправки сообщений', 'error');
        // Show login modal (you can add this later)
        return;
    }
    
    // Get or create current chat
    let chat = AppState.chats.find(c => c.id === AppState.currentChatId);
    
    if (!chat) {
        try {
            // Create chat via API
            const newChat = await createChatAPI(content.substring(0, 50));
            chat = {
                id: newChat.id,
                title: newChat.title,
                messages: [],
                createdAt: new Date(newChat.created_at),
                updatedAt: new Date(newChat.updated_at)
            };
            AppState.chats.unshift(chat);
            AppState.currentChatId = chat.id;
            renderChatList();
            showChat(chat.id);
        } catch (error) {
            showNotification('Не удалось создать чат: ' + error.message, 'error');
            return;
        }
    }
    
    // Add user message
    const userMessage = {
        role: 'user',
        content: content,
        timestamp: new Date(),
        attachments: [...AppState.attachments]
    };
    
    chat.messages.push(userMessage);
    
    // Clear input
    input.value = '';
    AppState.attachments = [];
    document.getElementById('attachmentPreview').style.display = 'none';
    updateSendButton();
    
    // Render new message
    const container = document.getElementById('messagesContainer');
    container.appendChild(createMessageElement(userMessage));
    container.scrollTop = container.scrollHeight;
    
    // Show typing indicator
    addTypingIndicator();
    
    // Send to backend API
    try {
        const response = await sendMessageAPI(chat.id, content, AppState.currentModel);
        
        removeTypingIndicator();
        
        const assistantMessage = {
            role: 'assistant',
            model: AppState.currentModel,
            content: response.content,
            timestamp: new Date(),
            tokens: response.tokens,
            cost: response.cost
        };
        
        chat.messages.push(assistantMessage);
        chat.updatedAt = new Date();
        
        container.appendChild(createMessageElement(assistantMessage));
        container.scrollTop = container.scrollHeight;
        
        // Update balance from server
        if (currentUser) {
            AppState.user.balance = currentUser.balance - response.cost;
            currentUser.balance = AppState.user.balance;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateBalance();
        }
        
        renderChatList();
        
    } catch (error) {
        removeTypingIndicator();
        console.error('Error sending message:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// Simulate AI Response (Mock API)
async function simulateAIResponse(userMessage, model) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));
    
    // Get user profile for personalization
    const profile = AppState.user.profile;
    const topValues = profile.values.sort((a, b) => b.value - a.value).slice(0, 2);
    const topInterests = profile.interests.slice(0, 3).join(', ');
    
    // Generate contextual response based on question
    let response = '';
    
    if (userMessage.toLowerCase().includes('привет') || userMessage.toLowerCase().includes('здравствуй')) {
        response = `Привет! Я вижу, что для вас важны ${topValues[0].name.toLowerCase()} и ${topValues[1].name.toLowerCase()}. Ваши интересы включают ${topInterests}. Чем могу помочь?`;
    } else if (userMessage.toLowerCase().includes('python') || userMessage.toLowerCase().includes('код')) {
        response = `Отличный вопрос! Учитывая ваш интерес к ${topInterests}, вот что я могу предложить:\n\n\`\`\`python\n# Пример кода\ndef hello_world():\n    print("Hello, World!")\n    return True\n\n# Использование\nif __name__ == "__main__":\n    hello_world()\n\`\`\`\n\nЭтот подход соответствует вашему стремлению к ${topValues[0].name.toLowerCase()}.`;
    } else if (userMessage.toLowerCase().includes('карьер') || userMessage.toLowerCase().includes('работ')) {
        response = `С учетом ваших ценностей (${topValues[0].name} - ${topValues[0].value}/100, ${topValues[1].name} - ${topValues[1].value}/100) и интересов в ${topInterests}, я бы рекомендовал:\n\n1. **Фокус на развитии** - ищите возможности для роста\n2. **Баланс** - учитывайте вашу потребность в ${topValues[1].name.toLowerCase()}\n3. **Специализация** - углубитесь в темы, которые вас вдохновляют\n\nХотите обсудить конкретные шаги?`;
    } else {
        response = `Понимаю ваш вопрос о "${userMessage}". Учитывая ваш профиль и интересы в ${topInterests}, вот мой ответ:\n\nЭто интересная тема, которая хорошо сочетается с вашим стремлением к ${topValues[0].name.toLowerCase()}. \n\nВам могут быть полезны следующие подходы:\n- Практический опыт и эксперименты\n- Изучение современных инструментов\n- Участие в сообществе\n\nЕсть конкретные вопросы по этой теме?`;
    }
    
    // Calculate tokens and cost
    const inputTokens = Math.ceil(userMessage.length / 4);
    const outputTokens = Math.ceil(response.length / 4);
    
    const modelPricing = {
        'gpt-4-turbo': { input: 0.002, output: 0.004 },
        'gpt-3.5-turbo': { input: 0.0002, output: 0.0004 },
        'claude-3-opus': { input: 0.003, output: 0.005 },
        'gemini-pro': { input: 0.001, output: 0.002 },
        'claude-3-sonnet': { input: 0.0015, output: 0.003 },
        'yandexgpt-pro': { input: 0.001, output: 0.002 }
    };
    
    const pricing = modelPricing[model] || modelPricing['gpt-4-turbo'];
    const cost = (inputTokens * pricing.input + outputTokens * pricing.output);
    
    return {
        content: response,
        tokens: { input: inputTokens, output: outputTokens },
        cost: cost
    };
}

// Input Handling
function handleInputChange(e) {
    const input = e.target;
    const length = input.value.length;
    
    // Update character count
    document.getElementById('charCount').textContent = `${length} / 10000`;
    
    // Estimate tokens (roughly 1 token per 4 characters)
    const tokens = Math.ceil(length / 4);
    document.getElementById('tokenEstimate').textContent = `~${tokens} токенов`;
    
    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    
    updateSendButton();
}

function handleInputKeydown(e) {
    // Send on Ctrl/Cmd + Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendMessage();
    }
    
    // New line on Enter alone
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Allow default behavior (new line)
        // Unless user wants Enter to send instead
    }
}

function updateSendButton() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const hasContent = input.value.trim().length > 0 || AppState.attachments.length > 0;
    sendBtn.disabled = !hasContent;
}

// File Handling
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        const attachment = {
            file: file,
            name: file.name,
            type: file.type,
            size: file.size,
            preview: null
        };
        
        // Generate preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                attachment.preview = e.target.result;
                AppState.attachments.push(attachment);
                renderAttachments();
            };
            reader.readAsDataURL(file);
        } else {
            AppState.attachments.push(attachment);
            renderAttachments();
        }
    });
    
    // Clear file input
    e.target.value = '';
}

function renderAttachments() {
    const preview = document.getElementById('attachmentPreview');
    
    if (AppState.attachments.length === 0) {
        preview.style.display = 'none';
        return;
    }
    
    preview.style.display = 'flex';
    preview.innerHTML = '';
    
    AppState.attachments.forEach((attachment, index) => {
        const item = document.createElement('div');
        item.className = 'attachment-item';
        
        if (attachment.preview) {
            item.innerHTML = `
                <img src="${attachment.preview}" alt="${attachment.name}">
                <span class="attachment-name">${attachment.name}</span>
                <button class="remove-attachment-btn" onclick="removeAttachment(${index})">✕</button>
            `;
        } else {
            const icon = getFileIcon(attachment.type);
            item.innerHTML = `
                <span style="font-size: 2rem;">${icon}</span>
                <span class="attachment-name">${attachment.name}</span>
                <button class="remove-attachment-btn" onclick="removeAttachment(${index})">✕</button>
            `;
        }
        
        preview.appendChild(item);
    });
    
    updateSendButton();
}

function removeAttachment(index) {
    AppState.attachments.splice(index, 1);
    renderAttachments();
}

function getFileIcon(type) {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📽️';
    return '📎';
}

// Model Selection
function openModelModal() {
    const modal = document.getElementById('modelModal');
    modal.style.display = 'flex';
    renderModelsGrid();
}

function closeModelModal() {
    document.getElementById('modelModal').style.display = 'none';
}

function renderModelsGrid() {
    const grid = document.getElementById('modelsGrid');
    grid.innerHTML = '';
    
    AppState.models.forEach(model => {
        const card = document.createElement('div');
        card.className = 'model-card';
        if (model.id === AppState.currentModel) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <div class="model-card-header">
                <span class="model-card-icon">${model.icon}</span>
                <span class="model-card-name">${model.name}</span>
            </div>
            <div class="model-card-description">${model.description}</div>
            <div class="model-card-specs">
                <span class="model-spec">${model.price}</span>
                <span class="model-spec">🧠 ${model.context}</span>
            </div>
        `;
        
        card.addEventListener('click', () => selectModel(model.id));
        grid.appendChild(card);
    });
}

function selectModel(modelId) {
    AppState.currentModel = modelId;
    updateModelDisplay();
    closeModelModal();
}

function updateModelDisplay() {
    const model = AppState.models.find(m => m.id === AppState.currentModel);
    if (model) {
        document.getElementById('currentModel').textContent = model.name;
    }
}

function getModelName(modelId) {
    const model = AppState.models.find(m => m.id === modelId);
    return model ? model.name : modelId;
}

// Profile Management
function openProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.style.display = 'flex';
    renderProfileData();
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

function renderProfileData() {
    // Render value sliders
    const slidersContainer = document.getElementById('valueSliders');
    slidersContainer.innerHTML = '';
    
    AppState.user.profile.values.forEach((value, index) => {
        const slider = document.createElement('div');
        slider.className = 'value-slider';
        slider.innerHTML = `
            <div class="value-slider-label">
                <span class="value-slider-name">${value.name}</span>
                <span class="value-slider-value">${value.value}</span>
            </div>
            <input type="range" min="0" max="100" value="${value.value}" 
                   data-index="${index}" 
                   oninput="updateValueSlider(${index}, this.value)">
        `;
        slidersContainer.appendChild(slider);
    });
    
    // Render interests
    const interestsContainer = document.getElementById('interestsTags');
    interestsContainer.innerHTML = '';
    
    AppState.user.profile.interests.forEach((interest, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            ${interest}
            <button class="tag-remove" onclick="removeInterest(${index})">×</button>
        `;
        interestsContainer.appendChild(tag);
    });
    
    // Setup add interest input
    const addInterestInput = document.getElementById('addInterestInput');
    addInterestInput.value = '';
    addInterestInput.onkeydown = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            AppState.user.profile.interests.push(e.target.value.trim());
            renderProfileData();
        }
    };
    
    // Render skills
    const skillsContainer = document.getElementById('skillsList');
    skillsContainer.innerHTML = '';
    
    AppState.user.profile.skills.forEach((skill, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        const stars = '⭐'.repeat(skill.level);
        tag.innerHTML = `
            ${skill.name} ${stars}
            <button class="tag-remove" onclick="removeSkill(${index})">×</button>
        `;
        skillsContainer.appendChild(tag);
    });
    
    // Setup add skill input
    const addSkillInput = document.getElementById('addSkillInput');
    addSkillInput.value = '';
    addSkillInput.onkeydown = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            AppState.user.profile.skills.push({
                name: e.target.value.trim(),
                level: 3
            });
            renderProfileData();
        }
    };
}

function updateValueSlider(index, value) {
    AppState.user.profile.values[index].value = parseInt(value);
    document.querySelectorAll('.value-slider-value')[index].textContent = value;
}

function removeInterest(index) {
    AppState.user.profile.interests.splice(index, 1);
    renderProfileData();
}

function removeSkill(index) {
    AppState.user.profile.skills.splice(index, 1);
    renderProfileData();
}

function saveProfile() {
    // In real app, would save to backend
    closeProfileModal();
    alert('Профиль сохранен!');
}

// Utility Functions
function updateBalance() {
    document.getElementById('balanceAmount').textContent = 
        `${AppState.user.balance.toFixed(2)}₽`;
}

function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function copyCode(pre, button) {
    const code = pre.querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        button.textContent = 'Скопировано!';
        setTimeout(() => {
            button.textContent = 'Копировать';
        }, 2000);
    });
}

function copyMessage(button) {
    const messageBody = button.closest('.message-content').querySelector('.message-body');
    const text = messageBody.textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert('Сообщение скопировано');
    });
}

function regenerateMessage(button) {
    alert('Функция регенерации будет реализована');
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    
    if (!query) {
        renderChatList();
        return;
    }
    
    const filtered = AppState.chats.filter(chat => {
        return chat.title.toLowerCase().includes(query) ||
               chat.messages.some(msg => msg.content.toLowerCase().includes(query));
    });
    
    // Re-render with filtered chats
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    filtered.forEach(chat => {
        const chatItem = document.createElement('button');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.id;
        
        if (chat.id === AppState.currentChatId) {
            chatItem.classList.add('active');
        }
        
        const lastMessage = chat.messages[chat.messages.length - 1];
        const preview = lastMessage ? 
            (lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')) : 
            'Новый чат';
        
        chatItem.innerHTML = `
            <div class="chat-item-title">${chat.title}</div>
            <div class="chat-item-preview">${preview}</div>
            <div class="chat-item-time">${formatTime(chat.updatedAt)}</div>
        `;
        
        chatItem.addEventListener('click', () => showChat(chat.id));
        chatList.appendChild(chatItem);
    });
}

function handleNavigation(item) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    const filter = item.dataset.filter;
    // Implement filtering logic here
    console.log('Filter by:', filter);
}

// Voice Recording Functions
function toggleVoiceRecording() {
    if (!AppState.voiceRecognition) {
        showNotification('Голосовой ввод не поддерживается вашим браузером', 'error');
        return;
    }
    
    if (AppState.isRecording) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

function startVoiceRecording() {
    try {
        AppState.voiceRecognition.start();
        showNotification('🎤 Говорите...', 'info', 2000);
    } catch (error) {
        console.error('Ошибка запуска записи:', error);
        showNotification('Не удалось запустить голосовой ввод', 'error');
    }
}

function stopVoiceRecording() {
    if (AppState.voiceRecognition && AppState.isRecording) {
        AppState.voiceRecognition.stop();
    }
    
    AppState.isRecording = false;
    const voiceBtn = document.getElementById('voiceInputBtn');
    voiceBtn.classList.remove('recording');
    voiceBtn.title = 'Голосовой ввод (нажмите и говорите)';
}

// Notification System
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

// Auth Modal Functions
function showAuthModal() {
    document.getElementById('authModal').style.display = 'flex';
    switchToLogin();
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function switchToLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authModalTitle').textContent = 'Вход в AI Chat Platform';
}

function switchToRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Регистрация';
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        await login(email, password);
        closeAuthModal();
        showNotification('Вход выполнен успешно! Добро пожаловать!', 'success');
        
        // Update UI
        updateAuthUI();
        updateBalance();
        
        // Load user data
        await loadUserChats();
        
        // Clear login form
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        
    } catch (error) {
        showNotification('Ошибка входа: ' + error.message, 'error');
    }
}

async function handleRegister() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    
    if (!email || !password || !passwordConfirm) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (password.length < 8) {
        showNotification('Пароль должен быть минимум 8 символов', 'error');
        return;
    }
    
    if (password !== passwordConfirm) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    try {
        await register(email, password);
        closeAuthModal();
        showNotification('Регистрация успешна! Добро пожаловать в AI Chat Platform!', 'success');
        
        // Update UI
        updateAuthUI();
        updateBalance();
        
        // Load initial data
        await loadUserChats();
        
        // Clear register form
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerPasswordConfirm').value = '';
        
    } catch (error) {
        showNotification('Ошибка регистрации: ' + error.message, 'error');
    }
}

// Make functions available globally
window.updateValueSlider = updateValueSlider;
window.removeInterest = removeInterest;
window.removeSkill = removeSkill;
window.removeAttachment = removeAttachment;
window.copyMessage = copyMessage;
window.regenerateMessage = regenerateMessage;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchToLogin = switchToLogin;
window.switchToRegister = switchToRegister;
