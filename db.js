// db.js
// ---------------------------------------------------------------
// Lightweight embedded database (file-backed JSON store).
//
// WHY: This "working model" runs anywhere with zero setup (no DB
// server, no native compilation, no Docker). It behaves like a real
// database — persistent storage, auto-incrementing IDs, CRUD helpers
// — so the application code (routes/controllers) is written exactly
// as it would be against MySQL/PostgreSQL/MongoDB.
//
// SWAPPING TO A REAL DATABASE (e.g. for submission requirements):
//   - MongoDB:      replace this file with a Mongoose connection;
//                    the route files already treat each entity as a
//                    collection of plain objects, so models map 1:1.
//   - MySQL/Postgres: replace this file with a `pg`/`mysql2` pool
//                    and turn each helper below into a SQL query.
// The rest of the app (routes, auth, cart logic) does not need to
// change — that's the point of isolating data access here.
// ---------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData(), null, 2));
  }
}

function read() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function write(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function nextId(collection) {
  if (collection.length === 0) return 1;
  return Math.max(...collection.map((r) => r.id)) + 1;
}

// ---- Generic CRUD helpers ----------------------------------------

function getAll(table) {
  return read()[table];
}

function getById(table, id) {
  return read()[table].find((r) => r.id === Number(id));
}

function find(table, predicate) {
  return read()[table].filter(predicate);
}

function findOne(table, predicate) {
  return read()[table].find(predicate);
}

function insert(table, record) {
  const data = read();
  const row = { id: nextId(data[table]), ...record };
  data[table].push(row);
  write(data);
  return row;
}

function update(table, id, patch) {
  const data = read();
  const idx = data[table].findIndex((r) => r.id === Number(id));
  if (idx === -1) return null;
  data[table][idx] = { ...data[table][idx], ...patch };
  write(data);
  return data[table][idx];
}

function remove(table, id) {
  const data = read();
  const before = data[table].length;
  data[table] = data[table].filter((r) => r.id !== Number(id));
  write(data);
  return data[table].length < before;
}

function replaceAll(table, rows) {
  const data = read();
  data[table] = rows;
  write(data);
}

// ---- Seed data -----------------------------------------------------

function seedData() {
  return {
    users: [
      // password for both seeded accounts is: "password123" (hashed at first run by seedUsers below)
    ],
    products: [
      {
        id: 1,
        name: 'Wireless Headphones',
        description: 'Over-ear Bluetooth headphones with noise cancellation.',
        price: 59.99,
        stock: 25,
        image: '🎧',
        category: 'Electronics',
      },
      {
        id: 2,
        name: 'Mechanical Keyboard',
        description: 'RGB backlit mechanical keyboard, blue switches.',
        price: 89.99,
        stock: 15,
        image: '⌨️',
        category: 'Electronics',
      },
      {
        id: 3,
        name: 'Running Shoes',
        description: 'Lightweight breathable running shoes.',
        price: 45.0,
        stock: 40,
        image: '👟',
        category: 'Footwear',
      },
      {
        id: 4,
        name: 'Stainless Steel Water Bottle',
        description: 'Insulated bottle, keeps drinks cold for 24h.',
        price: 19.99,
        stock: 60,
        image: '🧴',
        category: 'Home',
      },
      {
        id: 5,
        name: 'Backpack',
        description: 'Durable 30L laptop backpack with USB port.',
        price: 39.5,
        stock: 30,
        image: '🎒',
        category: 'Accessories',
      },
      {
        id: 6,
        name: 'Smart Watch',
        description: 'Fitness tracking smart watch with heart-rate monitor.',
        price: 129.0,
        stock: 10,
        image: '⌚',
        category: 'Electronics',
      },
    ],
    orders: [],
    carts: [],
  };
}

module.exports = {
  read,
  write,
  getAll,
  getById,
  find,
  findOne,
  insert,
  update,
  remove,
  replaceAll,
};
