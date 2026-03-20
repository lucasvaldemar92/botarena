# Imagem base mais completa para garantir compatibilidade GLIBC
FROM node:20-bookworm

# Instala dependências de sistema para compilar o SQLite3 e rodar o Puppeteer (WhatsApp)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libgbm1 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./
RUN npm install && npm rebuild sqlite3 --build-from-source

# Copia o restante do código (HTML, CSS, JS e a pasta database)
COPY . .

# Expõe a porta do seu servidor Express
EXPOSE 3000

# Variável de ambiente para o Puppeteer encontrar o Chromium no Docker
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["node", "server.js"]
