const crypto = require('crypto');

class OrderRepo {
    constructor(db) {
        this.db = db;
    }

    /**
     * Creates a new order along with its items.
     * Generates an auto-incrementing-like numero_pedido per day or just a random 4-digit if simple.
     */
    async create(orderData) {
        const id = crypto.randomUUID();
        // Generate a random 4-digit number for the UI if numero_pedido is not provided
        const numero_pedido = orderData.numero_pedido || Math.floor(1000 + Math.random() * 9000);
        
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                const stmtOrder = this.db.prepare(`
                    INSERT INTO orders (id, numero_pedido, customer_name, customer_phone, customer_address, neighborhood, payment_method, total, delivery_fee, status, consumer_order_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                stmtOrder.run(
                    id,
                    numero_pedido,
                    orderData.customer_name || '',
                    orderData.customer_phone || '',
                    orderData.customer_address || '',
                    orderData.neighborhood || '',
                    orderData.payment_method || '',
                    orderData.total || 0,
                    orderData.delivery_fee || 0,
                    orderData.status || 'novo',
                    orderData.consumer_order_id || '',
                    function (err) {
                        if (err) {
                            this.db.run('ROLLBACK');
                            return reject(err);
                        }
                    }.bind(this)
                );
                stmtOrder.finalize();

                if (orderData.items && Array.isArray(orderData.items)) {
                    const stmtItem = this.db.prepare(`
                        INSERT INTO order_items (id, order_id, product_name, pdv_code, quantity, price, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);

                    for (const item of orderData.items) {
                        const itemId = crypto.randomUUID();
                        stmtItem.run(
                            itemId,
                            id,
                            item.name || '',
                            item.pdv_code || '',
                            item.quantity || 1,
                            item.price || 0,
                            item.notes || ''
                        );
                    }
                    stmtItem.finalize();
                }

                this.db.run('COMMIT', (err) => {
                    if (err) return reject(err);
                    resolve({ id, numero_pedido });
                });
            });
        });
    }

    /**
     * Gets all orders, including their items.
     */
    async getAll() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, ordersRows) => {
                if (err) return reject(err);
                
                this.db.all('SELECT * FROM order_items', (err, itemsRows) => {
                    if (err) return reject(err);
                    
                    const orders = ordersRows.map(order => {
                        return {
                            ...order,
                            items: itemsRows.filter(i => i.order_id === order.id)
                        };
                    });
                    
                    resolve(orders);
                });
            });
        });
    }

    /**
     * Updates the status of an order.
     */
    async updateStatus(id, status) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE orders SET status = ? WHERE id = ?',
                [status, id],
                function (err) {
                    if (err) return reject(err);
                    resolve({ changes: this.changes });
                }
            );
        });
    }
}

module.exports = OrderRepo;
