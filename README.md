# Cartify — E-Commerce Web Application (Working Model)

A working full-stack online store: product catalog, cart, checkout, login with
role-based access (Admin/User), backend REST APIs, and persistent data storage.

Built to satisfy the internship brief: **product catalog + cart + checkout**,
**user login with Admin/User roles**, **backend APIs for product & order
management**, and **database integration**.

## 1. Requirements

- Node.js v18+ (you have this already if you can run `node -v`)

No other software, accounts, or services needed — it runs entirely on your
machine.

## 2. Run it

```bash
cd ecommerce-app
npm install
node server.js
```

Then open **http://localhost:3000** in your browser.

The first time it starts, it seeds two demo accounts and 6 sample products:

| Role  | Email            | Password    |
|-------|------------------|-------------|
| Admin | admin@demo.com   | password123 |
| User  | jane@demo.com    | password123 |

(You can also register your own account from the Login/Register screen.)

## 3. What's inside

```
ecommerce-app/
├── server.js          # Express app entry point
├── db.js              # Database layer (see "About the database" below)
├── middleware/auth.js  # JWT auth + role-check middleware
├── routes/
│   ├── auth.js         # POST /api/auth/register, /api/auth/login
│   ├── products.js     # Product catalog + admin CRUD
│   ├── cart.js         # Per-user cart (add/update/remove)
│   └── orders.js       # Checkout, order tracking, admin order management
├── data/db.json        # Auto-created on first run — your persisted data
└── public/             # Frontend (vanilla HTML/CSS/JS, no build step)
    ├── index.html
    ├── styles.css
    └── app.js
```

## 4. Feature → requirement mapping

| Brief requirement | Where it lives |
|---|---|
| Product catalog, add to cart, checkout | `routes/products.js`, `routes/cart.js`, `routes/orders.js` + Shop/Cart views in `app.js` |
| User login + role-based access (Admin/User) | `routes/auth.js`, `middleware/auth.js` (JWT + `requireRole`) |
| Backend APIs for product & order management | Full REST API — see endpoint list below |
| Database integration | `db.js` — persistent, queryable storage (see note below) |

### API endpoints

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/products                 (public)
GET    /api/products/:id              (public)
POST   /api/products                  (admin)
PUT    /api/products/:id              (admin)
DELETE /api/products/:id              (admin)

GET    /api/cart                      (logged in)
POST   /api/cart                      (logged in)
PUT    /api/cart/:productId           (logged in)
DELETE /api/cart/:productId           (logged in)

POST   /api/orders/checkout           (logged in)
GET    /api/orders                    (logged in — own orders)
GET    /api/orders/all                (admin — every order)
GET    /api/orders/:id                (owner or admin)
PUT    /api/orders/:id/status         (admin — advance: placed → processing → shipped → delivered)
```

## 5. About the database

This model uses a small embedded, file-backed JSON store (`data/db.json`) so
it runs immediately with **zero setup** — no database server to install, no
connection strings, no Docker. It behaves like a real database (persistent,
auto-incrementing IDs, full CRUD) and all the application code (`routes/`)
is written against a clean data-access layer (`db.js`), so swapping it for
MySQL, PostgreSQL, or MongoDB later is a contained change:

- **MongoDB**: replace `db.js` with a Mongoose connection — each "table" here
  (`users`, `products`, `orders`, `carts`) maps directly to a collection.
- **MySQL / PostgreSQL**: replace `db.js` with a `mysql2`/`pg` pool and turn
  the helper functions into SQL queries against equivalent tables.

If your evaluator specifically requires you to *show* MySQL/PostgreSQL/MongoDB
running, say so and I'll wire up the real driver — it's a quick swap since the
rest of the app doesn't need to change.

## 6. Notes on the demo

- Passwords are hashed with bcrypt; sessions use JWTs (7-day expiry).
- Stock is decremented at checkout and validated against the cart.
- The Admin dashboard lets you add/delete products, adjust stock, and move
  orders through their status (placed → processing → shipped → delivered).
- To reset all data, stop the server and delete `data/db.json` — it will
  reseed automatically next time you run `node server.js`.
