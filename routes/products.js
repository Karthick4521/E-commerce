// routes/products.js
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/products  - public catalog (optionally filter by ?category= or ?q=)
router.get('/', (req, res) => {
  let products = db.getAll('products');
  const { category, q } = req.query;
  if (category) {
    products = products.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
  }
  if (q) {
    const term = q.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
    );
  }
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.getById('products', req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// ---- Admin-only management below ----

// POST /api/products  (admin)
router.post('/', authenticate, requireRole('admin'), (req, res) => {
  const { name, description, price, stock, image, category } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  const product = db.insert('products', {
    name,
    description: description || '',
    price: Number(price),
    stock: Number(stock) || 0,
    image: image || '📦',
    category: category || 'General',
  });
  res.status(201).json(product);
});

// PUT /api/products/:id  (admin)
router.put('/:id', authenticate, requireRole('admin'), (req, res) => {
  const existing = db.getById('products', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const updated = db.update('products', req.params.id, req.body);
  res.json(updated);
});

// DELETE /api/products/:id  (admin)
router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  const existing = db.getById('products', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  db.remove('products', req.params.id);
  res.json({ success: true });
});

module.exports = router;
