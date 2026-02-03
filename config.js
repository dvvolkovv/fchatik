// Configuration for API endpoints
// Update this after deploying backend to Railway

const CONFIG = {
    // Railway backend URL (update after deployment)
    API_BASE_URL: 'https://your-backend-name.railway.app',
    
    // For local development, uncomment:
    // API_BASE_URL: 'http://localhost:8000',
    
    API_PREFIX: '/api/v1'
};

// Export for use in app.js
window.CONFIG = CONFIG;
