-- ==========================================
-- Migration 007: Orders Management
-- ==========================================

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    numero_pedido INTEGER,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    neighborhood TEXT,
    payment_method TEXT,
    total REAL,
    status TEXT DEFAULT 'novo',
    consumer_order_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    product_name TEXT,
    pdv_code TEXT,
    quantity INTEGER,
    price REAL,
    notes TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);
