-- 1. Client Configurations
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa TEXT NOT NULL DEFAULT 'BotArena',
    pix TEXT,
    nome_favorecido TEXT,
    cardapio_url TEXT,
    boas_vindas TEXT DEFAULT 'Olá! Como podemos ajudar?',
    bot_active BOOLEAN DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Local Knowledge Base (Low-cost search)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    response TEXT NOT NULL,
    category TEXT DEFAULT 'faq'
);

-- 3. Dynamic Daily Menu (OCR Extracted)
CREATE TABLE IF NOT EXISTS daily_menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER DEFAULT 1,
    mimetype TEXT,
    base64_data TEXT,
    file_path TEXT,
    extracted_text TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Clients Database
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER DEFAULT 1,
    name TEXT,
    birth_date TEXT,
    phone TEXT,
    contact_jid TEXT,
    address TEXT,
    zip_code TEXT,
    number TEXT,
    notes TEXT,
    source TEXT DEFAULT 'manual',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4.1 Delivery Fees Database
CREATE TABLE IF NOT EXISTS delivery_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER DEFAULT 1,
    neighborhood TEXT,
    zip_code TEXT UNIQUE,
    fee REAL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Initial Seed for Arena Juvenal
INSERT INTO settings (empresa, pix, boas_vindas) 
VALUES ('Arena Juvenal', '000.000.000-00', 'Bem-vindo à Arena Juvenal! 🏟️');

INSERT INTO knowledge_base (keyword, response) VALUES 
('horário', 'Funcionamos todos os dias das 08:00 às 22:00!'),
('localização', 'Estamos localizados em Itapoá, SC.'),
('pix', 'Aceitamos Pix! A chave é o nosso CNPJ.');

INSERT INTO delivery_fees (id, neighborhood, zip_code, fee) VALUES
(1, 'Centro', '87055-520', 5.00),
(2, 'Jardim América', '15084-120', 7.50),
(3, 'Vila Nova', '12345-000', 10.00);

