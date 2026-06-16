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
        const numero_pedido = orderData.numero_pedido || Math.floor(1000 + Math.random() * 9000);
        
        await this.db.transaction(async () => {
            // Insere o pedido
            await this.db.run(`
                INSERT INTO orders (id, numero_pedido, customer_name, customer_phone, customer_address, neighborhood, payment_method, total, delivery_fee, status, consumer_order_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
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
                orderData.consumer_order_id || ''
            ]);

            // Insere itens se houver
            if (orderData.items && Array.isArray(orderData.items)) {
                for (const item of orderData.items) {
                    const itemId = crypto.randomUUID();
                    await this.db.run(`
                        INSERT INTO order_items (id, order_id, product_name, pdv_code, quantity, price, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        itemId,
                        id,
                        item.product_name || item.name || '',
                        item.pdv_code || '',
                        item.quantity || 1,
                        item.price || 0,
                        item.notes || ''
                    ]);
                }
            }
        });

        return { id, numero_pedido };
    }

    /**
     * Gets all orders, including their items.
     */
    async getAll() {
        const ordersRows = await this.db.all('SELECT * FROM orders ORDER BY created_at DESC');
        const itemsRows = await this.db.all('SELECT * FROM order_items');
        
        return ordersRows.map(order => {
            return {
                ...order,
                items: itemsRows.filter(i => i.order_id === order.id)
            };
        });
    }

    /**
     * Updates the status of an order.
     */
    async updateStatus(id, status) {
        const result = await this.db.run(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, id]
        );
        return { changes: result.changes };
    }
}

module.exports = OrderRepo;

