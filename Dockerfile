# Nginx для статического фронтенда
FROM nginx:alpine

# Устанавливаем gettext для envsubst
RUN apk add --no-cache gettext

# Копируем статические файлы
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY assets/ /usr/share/nginx/html/assets/

# Копируем шаблон конфига (не сам config.js!)
COPY config.template.js /tmp/config.template.js

# Копируем nginx конфиг шаблон
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Копируем entrypoint скрипт
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose динамический порт
EXPOSE ${PORT:-80}

# Используем entrypoint для подстановки переменных
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
