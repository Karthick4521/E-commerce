// server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Fallback to the SPA for any non-API route
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function seedDemoUsers() {
  const users = db.getAll('users');
  if (users.length > 0) return;
  const password = await bcrypt.hash('password123', 10);
  db.insert('users', { name: 'Store Admin', email: 'admin@demo.com', password, role: 'admin' });
  db.insert('users', { name: 'Jane Shopper', email: 'jane@demo.com', password, role: 'user' });
  console.log('Seeded demo accounts:');
  console.log('  Admin -> admin@demo.com / password123');
  console.log('  User  -> jane@demo.com / password123');
}

seedDemoUsers().then(() => {
  app.listen(PORT, () => {
    console.log(`E-Commerce app running at http://localhost:${PORT}`);
  });
});
