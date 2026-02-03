#!/bin/sh

# Устанавливаем PORT по умолчанию если не задан
export PORT=${PORT:-80}

# Подставляем переменные окружения в config.js
envsubst '${API_BASE_URL}' < /tmp/config.template.js > /usr/share/nginx/html/config.js
echo "✅ Generated config.js with API_BASE_URL=${API_BASE_URL}"

# Подставляем PORT в nginx.conf
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
echo "✅ Configured nginx to listen on port ${PORT}"

# Запускаем nginx
exec "$@"
