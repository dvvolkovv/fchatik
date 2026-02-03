#!/bin/sh

# Подставляем переменные окружения в config.js
envsubst '${API_BASE_URL}' < /tmp/config.template.js > /usr/share/nginx/html/config.js

echo "✅ Generated config.js with API_BASE_URL=${API_BASE_URL}"

# Запускаем nginx
exec "$@"
