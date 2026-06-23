// routes/cart.js
const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate); // every cart route requires a logged-in user

function getOrCreateCart(userId) {
  let cart = db.findOne('carts', (c) => c.userId === userId);
  if (!cart) {
    cart = db.insert('carts', { userId, items: [] });
  }
  return cart;
}

function hydrate(cart) {
  const items = cart.items.map((item) => {
    const product = db.getById('products', item.productId);
    return {
      productId: item.productId,
      quantity: item.quantity,
      product,
      subtotal: product ? Number((product.price * item.quantity).toFixed(2)) : 0,
    };
  });
  const total = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));
  return { id: cart.id, items, total };
}

// GET /api/cart
router.get('/', (req, res) => {
  const cart = getOrCreateCart(req.user.id);
  res.json(hydrate(cart));
});

// POST /api/cart  { productId, quantity }
router.post('/', (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Number(quantity) || 1;
  const product = db.getById('products', productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const cart = getOrCreateCart(req.user.id);
  const existing = cart.items.find((i) => i.productId === Number(productId));
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({ productId: Number(productId), quantity: qty });
  }
  db.update('carts', cart.id, { items: cart.items });
  res.json(hydrate(cart));
});

// PUT /api/cart/:productId  { quantity }
router.put('/:productId', (req, res) => {
  const { quantity } = req.body;
  const cart = getOrCreateCart(req.user.id);
  const item = cart.items.find((i) => i.productId === Number(req.params.productId));
  if (!item) return res.status(404).json({ error: 'Item not in cart' });
  item.quantity = Number(quantity);
  let items = cart.items;
  if (item.quantity <= 0) {
    items = items.filter((i) => i.productId !== Number(req.params.productId));
  }
  db.update('carts', cart.id, { items });
  res.json(hydrate({ ...cart, items }));
});

// DELETE /api/cart/:productId
router.delete('/:productId', (req, res) => {
  const cart = getOrCreateCart(req.user.id);
  const items = cart.items.filter((i) => i.productId !== Number(req.params.productId));
  db.update('carts', cart.id, { items });
  res.json(hydrate({ ...cart, items }));
});

// DELETE /api/cart  - clear
router.delete('/', (req, res) => {
  const cart = getOrCreateCart(req.user.id);
  db.update('carts', cart.id, { items: [] });
  res.json(hydrate({ ...cart, items: [] }));
});

module.exports = router;
