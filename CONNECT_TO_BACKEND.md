# 🔗 Подключение Frontend к Backend

## 📋 Что нужно

- ✅ **Backend задеплоен на Railway** (инструкция в `backend/DEPLOY_NOW.md`)
- ✅ **Backend URL** (например: `https://chatik-production.up.railway.app`)

---

## 🚀 Быстрое подключение (5 минут)

### Шаг 1: Получите URL вашего Backend

После деплоя на Railway:
1. Откройте ваш проект на Railway
2. Выберите Backend сервис
3. Вкладка **Settings** → **Domains**
4. Скопируйте URL (например: `https://chatik-production.up.railway.app`)

### Шаг 2: Обновите конфигурацию Frontend

Откройте `js/app.js` и найдите начало файла. Добавьте/измените:

```javascript
// API Configuration
const API_CONFIG = {
    // Замените на ваш Railway URL
    baseURL: 'https://chatik-production.up.railway.app/api/v1',
    // Для локальной разработки:
    // baseURL: 'http://localhost:8000/api/v1',
};

// Auth state
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
```

### Шаг 3: Добавьте API helper функции

Добавьте в `js/app.js` после `API_CONFIG`:

```javascript
// API Helper
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
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'API Error');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Authentication
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
    
    return data;
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    
    // Перезагрузка страницы или показ модального окна входа
    location.reload();
}
```

### Шаг 4: Обновите список моделей

Замените массив `AppState.models` на загрузку с backend:

```javascript
// В функции initializeApp()
async function initializeApp() {
    // ... существующий код ...
    
    // Загрузить модели с backend
    try {
        const response = await apiRequest('/llm/models');
        AppState.models = response.models.map(model => ({
            id: model.id,
            name: model.name,
            provider: model.provider,
            contextLength: model.context_length
        }));
        
        // Обновить UI с моделями
        renderModelSelector();
    } catch (error) {
        console.error('Failed to load models:', error);
        // Использовать дефолтные модели
    }
}
```

### Шаг 5: Интегрируйте отправку сообщений

Замените функцию `simulateAIResponse` на реальный API вызов:

```javascript
async function sendMessageToAPI(chatId, content, model) {
    try {
        const response = await apiRequest(`/llm/chat/${chatId}/message`, {
            method: 'POST',
            body: JSON.stringify({
                content: content,
                model: model,
                attachments: AppState.attachments || []
            })
        });
        
        return {
            role: 'assistant',
            content: response.content,
            model: model,
            timestamp: new Date(),
            tokens: response.tokens,
            cost: response.cost
        };
    } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
    }
}
```

Обновите функцию отправки сообщения:

```javascript
async function handleSendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content) return;
    
    // Проверка авторизации
    if (!authToken) {
        showNotification('Войдите в систему для отправки сообщений', 'error');
        return;
    }
    
    // Добавить сообщение пользователя
    const userMessage = {
        role: 'user',
        content: content,
        timestamp: new Date()
    };
    
    AppState.currentChat.messages.push(userMessage);
    renderMessages();
    
    input.value = '';
    showTypingIndicator();
    
    try {
        // Отправить на backend
        const assistantMessage = await sendMessageToAPI(
            AppState.currentChatId,
            content,
            AppState.currentModel
        );
        
        // Добавить ответ ассистента
        AppState.currentChat.messages.push(assistantMessage);
        renderMessages();
        
    } catch (error) {
        showNotification('Ошибка отправки сообщения: ' + error.message, 'error');
    } finally {
        hideTypingIndicator();
    }
}
```

---

## 🎨 Для деплоя Frontend

### Vercel (рекомендуется)

1. Установите Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Деплой:
   ```bash
   cd ai-chat-platform
   vercel
   ```

3. Обновите CORS в Backend:
   ```env
   CORS_ORIGINS=https://your-app.vercel.app,http://localhost:8888
   ```

### Netlify

1. Подключите GitHub репозиторий на Netlify
2. Build settings оставьте пустыми (статический сайт)
3. Publish directory: `./`
4. Обновите CORS в Backend

### GitHub Pages

1. Settings → Pages → Source: main branch
2. Обновите API_CONFIG на URL GitHub Pages
3. Обновите CORS в Backend

---

## ✅ Проверка работы

1. **Откройте Frontend** (локально или на хостинге)
2. **Откройте DevTools** (F12) → Console
3. **Зарегистрируйтесь** через UI
4. **Отправьте сообщение**
5. **Проверьте ответ от LLM**

### Тестовый запрос в консоли:

```javascript
// Проверка подключения
fetch('https://your-backend.railway.app/health')
    .then(r => r.json())
    .then(console.log);

// Получение моделей
fetch('https://your-backend.railway.app/api/v1/llm/models')
    .then(r => r.json())
    .then(console.log);
```

---

## 🔧 Troubleshooting

### CORS ошибка
- Убедитесь, что Frontend URL добавлен в `CORS_ORIGINS` на Railway
- Перезапустите Backend сервис после изменения переменных

### 401 Unauthorized
- Проверьте, что токен сохраняется: `localStorage.getItem('authToken')`
- Войдите заново

### Модели не загружаются
- Проверьте, что `OPENROUTER_API_KEY` установлен на Railway
- Проверьте логи Backend: Railway → Deployments → View Logs

### Сообщения не отправляются
- Откройте DevTools → Network → проверьте запросы
- Убедитесь, что Backend отвечает: `/health`, `/docs`

---

## 📚 Полезные ссылки

- **Backend репозиторий:** https://github.com/dvvolkovv/chatik
- **Backend документация:** `backend/FRONTEND_INTEGRATION.md`
- **OpenRouter:** https://openrouter.ai/
- **Railway:** https://railway.app/

---

**Frontend готов к работе с Backend через OpenRouter API! 🚀**
