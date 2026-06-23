// routes/orders.js
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STATUS_FLOW = ['placed', 'processing', 'shipped', 'delivered'];

// POST /api/orders/checkout  - turns the current cart into an order
router.post('/checkout', (req, res) => {
  const cart = db.findOne('carts', (c) => c.userId === req.user.id);
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const { shippingAddress } = req.body;

  // Validate stock & build line items
  const lineItems = [];
  for (const item of cart.items) {
    const product = db.getById('products', item.productId);
    if (!product) {
      return res.status(400).json({ error: `Product ${item.productId} no longer exists` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({
        error: `Not enough stock for "${product.name}" (only ${product.stock} left)`,
      });
    }
    lineItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      subtotal: Number((product.price * item.quantity).toFixed(2)),
    });
  }

  // Decrement stock
  for (const item of cart.items) {
    const product = db.getById('products', item.productId);
    db.update('products', product.id, { stock: product.stock - item.quantity });
  }

  const total = Number(lineItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2));

  const order = db.insert('orders', {
    userId: req.user.id,
    customerName: req.user.name,
    items: lineItems,
    total,
    status: 'placed',
    shippingAddress: shippingAddress || '',
    createdAt: new Date().toISOString(),
    history: [{ status: 'placed', at: new Date().toISOString() }],
  });

  // Clear the cart
  db.update('carts', cart.id, { items: [] });

  res.status(201).json(order);
});

// GET /api/orders  - current user's own orders (order tracking)
router.get('/', (req, res) => {
  const orders = db.find('orders', (o) => o.userId === req.user.id);
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// GET /api/orders/all  - admin: every order in the system
router.get('/all', requireRole('admin'), (req, res) => {
  const orders = db.getAll('orders');
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// GET /api/orders/:id  - a single order (owner or admin)
router.get('/:id', (req, res) => {
  const order = db.getById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(order);
});

// PUT /api/orders/:id/status  (admin) - advance order status, e.g. processing -> shipped
router.put('/:id/status', requireRole('admin'), (req, res) => {
  const { status } = req.body;
  if (!STATUS_FLOW.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUS_FLOW.join(', ')}` });
  }
  const order = db.getById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const history = [...order.history, { status, at: new Date().toISOString() }];
  const updated = db.update('orders', req.params.id, { status, history });
  res.json(updated);
});

module.exports = router;
