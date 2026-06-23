// app.js — Cartify frontend (vanilla JS, no build step required)

const API = '/api';

const state = {
  token: localStorage.getItem('cartify_token') || null,
  user: JSON.parse(localStorage.getItem('cartify_user') || 'null'),
  view: 'shop',
  adminTab: 'products',
  authMode: 'login',
  products: [],
  categoryFilter: 'All',
  searchTerm: '',
  cart: { items: [], total: 0 },
  orders: [],
  allOrders: [],
  qtyDraft: {}, // productId -> chosen quantity before "Add to cart"
  error: '',
  success: '',
  loading: false,
};

function setState(patch) {
  Object.assign(state, patch);
  render();
}

function flash(msg, type = 'success') {
  setState(type === 'error' ? { error: msg, success: '' } : { success: msg, error: '' });
  setTimeout(() => setState({ error: '', success: '' }), 3500);
}

// ---- API helper -----------------------------------------------------

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ---- Auth -------------------------------------------------------------

async function login(email, password) {
  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    finishAuth(data);
  } catch (e) {
    flash(e.message, 'error');
  }
}

async function register(name, email, password, role) {
  try {
    const data = await api('/auth/register', { method: 'POST', body: { name, email, password, role } });
    finishAuth(data);
  } catch (e) {
    flash(e.message, 'error');
  }
}

function finishAuth(data) {
  localStorage.setItem('cartify_token', data.token);
  localStorage.setItem('cartify_user', JSON.stringify(data.user));
  setState({ token: data.token, user: data.user, view: 'shop' });
  loadCart();
  flash(`Welcome, ${data.user.name}!`);
}

function logout() {
  localStorage.removeItem('cartify_token');
  localStorage.removeItem('cartify_user');
  setState({ token: null, user: null, view: 'shop', cart: { items: [], total: 0 }, orders: [] });
}

// ---- Data loaders -------------------------------------------------------

async function loadProducts() {
  const products = await api('/products');
  setState({ products });
}

async function loadCart() {
  if (!state.token) return;
  try {
    const cart = await api('/cart');
    setState({ cart });
  } catch (e) { /* ignore */ }
}

async function loadOrders() {
  if (!state.token) return;
  const orders = await api('/orders');
  setState({ orders });
}

async function loadAllOrders() {
  const allOrders = await api('/orders/all');
  setState({ allOrders });
}

// ---- Cart actions ---------------------------------------------------------

async function addToCart(productId) {
  if (!state.token) return setState({ view: 'auth' });
  const qty = state.qtyDraft[productId] || 1;
  try {
    const cart = await api('/cart', { method: 'POST', body: { productId, quantity: qty } });
    setState({ cart });
    flash('Added to cart');
  } catch (e) {
    flash(e.message, 'error');
  }
}

function setQtyDraft(productId, qty) {
  state.qtyDraft[productId] = Math.max(1, qty);
  render();
}

async function setCartQty(productId, qty) {
  try {
    const cart = await api(`/cart/${productId}`, { method: 'PUT', body: { quantity: qty } });
    setState({ cart });
  } catch (e) {
    flash(e.message, 'error');
  }
}

async function removeFromCart(productId) {
  try {
    const cart = await api(`/cart/${productId}`, { method: 'DELETE' });
    setState({ cart });
  } catch (e) {
    flash(e.message, 'error');
  }
}

async function checkout() {
  const address = document.getElementById('shipping-address')?.value || '';
  if (!address.trim()) return flash('Please add a shipping address', 'error');
  try {
    await api('/orders/checkout', { method: 'POST', body: { shippingAddress: address } });
    await loadCart();
    flash('Order placed! Track it under "My Orders".');
    setState({ view: 'orders' });
    loadOrders();
  } catch (e) {
    flash(e.message, 'error');
  }
}

// ---- Admin: products ----------------------------------------------------

async function adminCreateProduct(e) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.name.value,
    description: f.description.value,
    price: Number(f.price.value),
    stock: Number(f.stock.value),
    category: f.category.value,
    image: f.image.value || '📦',
  };
  try {
    await api('/products', { method: 'POST', body });
    f.reset();
    flash('Product added');
    loadProducts();
  } catch (e2) {
    flash(e2.message, 'error');
  }
}

async function adminDeleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await api(`/products/${id}`, { method: 'DELETE' });
    flash('Product deleted');
    loadProducts();
  } catch (e) {
    flash(e.message, 'error');
  }
}

async function adminUpdateStock(id, stock) {
  try {
    await api(`/products/${id}`, { method: 'PUT', body: { stock: Number(stock) } });
    loadProducts();
  } catch (e) {
    flash(e.message, 'error');
  }
}

async function adminAdvanceStatus(orderId, status) {
  try {
    await api(`/orders/${orderId}/status`, { method: 'PUT', body: { status } });
    flash('Order status updated');
    loadAllOrders();
  } catch (e) {
    flash(e.message, 'error');
  }
}

// ---- Navigation -----------------------------------------------------------

function goto(view) {
  setState({ view });
  if (view === 'orders') loadOrders();
  if (view === 'admin') loadAllOrders();
  if (view === 'cart') loadCart();
}

// ===========================================================================
// RENDERING
// ===========================================================================

function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderHeader()}
    ${renderFlash()}
    <main>${renderView()}</main>
    <footer class="note">Cartify · working model · backend: Express + JSON-file store · auth: JWT</footer>
  `;
}

function renderFlash() {
  if (state.error) return `<div class="error-msg">${escapeHtml(state.error)}</div>`;
  if (state.success) return `<div class="success-msg">${escapeHtml(state.success)}</div>`;
  return '';
}

function renderHeader() {
  const cartCount = state.cart.items.reduce((s, i) => s + i.quantity, 0);
  const isAdmin = state.user?.role === 'admin';
  return `
    <header class="topbar">
      <div class="brand" onclick="goto('shop')" style="cursor:pointer">Cartify<span class="dot">.</span></div>
      <nav class="tabs">
        <button class="tab ${state.view === 'shop' ? 'active' : ''}" onclick="goto('shop')">Shop</button>
        ${state.user ? `
          <button class="tab ${state.view === 'cart' ? 'active' : ''}" onclick="goto('cart')">
            Cart ${cartCount ? `<span class="badge">${cartCount}</span>` : ''}
          </button>
          <button class="tab ${state.view === 'orders' ? 'active' : ''}" onclick="goto('orders')">My Orders</button>
          ${isAdmin ? `<button class="tab ${state.view === 'admin' ? 'active' : ''}" onclick="goto('admin')">Admin</button>` : ''}
        ` : ''}
      </nav>
      <div class="user-chip">
        ${state.user ? `
          <span><strong>${escapeHtml(state.user.name)}</strong> <span class="role-pill">${state.user.role}</span></span>
          <button class="btn ghost small" onclick="logout()">Log out</button>
        ` : `
          <button class="btn small" onclick="goto('auth')">Log in / Register</button>
        `}
      </div>
    </header>
  `;
}

function renderView() {
  switch (state.view) {
    case 'auth': return renderAuth();
    case 'cart': return renderCart();
    case 'orders': return renderOrders();
    case 'admin': return renderAdmin();
    default: return renderShop();
  }
}

// ---- Auth view ------------------------------------------------------------

function renderAuth() {
  if (state.user) return renderShop();
  const isLogin = state.authMode === 'login';
  return `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-toggle">
          <button class="${isLogin ? 'active' : ''}" onclick="setState({authMode:'login'})">Log in</button>
          <button class="${!isLogin ? 'active' : ''}" onclick="setState({authMode:'register'})">Register</button>
        </div>
        <form onsubmit="return handleAuthSubmit(event)">
          ${!isLogin ? `
            <div class="field">
              <label>Full name</label>
              <input type="text" name="name" required placeholder="Jane Shopper" />
            </div>
          ` : ''}
          <div class="field">
            <label>Email</label>
            <input type="email" name="email" required placeholder="you@example.com" />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" required minlength="6" placeholder="••••••••" />
          </div>
          ${!isLogin ? `
            <div class="field">
              <label>Account type</label>
              <select name="role">
                <option value="user">Shopper</option>
                <option value="admin">Admin (store manager)</option>
              </select>
            </div>
          ` : ''}
          <button class="btn" style="width:100%" type="submit">${isLogin ? 'Log in' : 'Create account'}</button>
        </form>
        <div class="demo-hint">
          <strong>Demo accounts</strong><br/>
          Admin — admin@demo.com / password123<br/>
          Shopper — jane@demo.com / password123
        </div>
      </div>
    </div>
  `;
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const f = e.target;
  if (state.authMode === 'login') {
    login(f.email.value, f.password.value);
  } else {
    register(f.name.value, f.email.value, f.password.value, f.role.value);
  }
  return false;
}

// ---- Shop view --------------------------------------------------------

function renderShop() {
  const categories = ['All', ...new Set(state.products.map((p) => p.category))];
  let products = state.products;
  if (state.categoryFilter !== 'All') {
    products = products.filter((p) => p.category === state.categoryFilter);
  }
  if (state.searchTerm) {
    const t = state.searchTerm.toLowerCase();
    products = products.filter((p) => p.name.toLowerCase().includes(t));
  }
  return `
    <h2 class="section-title">Product catalog</h2>
    <div class="field" style="max-width:320px;margin-bottom:14px;">
      <input type="text" placeholder="Search products…" value="${escapeHtml(state.searchTerm)}"
        oninput="setState({searchTerm:this.value})" />
    </div>
    <div class="chips">
      ${categories.map((c) => `
        <button class="chip ${state.categoryFilter === c ? 'active' : ''}" onclick="setState({categoryFilter:'${c}'})">${c}</button>
      `).join('')}
    </div>
    ${products.length === 0 ? `
      <div class="empty-state"><div class="icon">🔍</div>No products match.</div>
    ` : `
      <div class="product-grid">
        ${products.map(renderProductCard).join('')}
      </div>
    `}
  `;
}

function renderProductCard(p) {
  const qty = state.qtyDraft[p.id] || 1;
  const outOfStock = p.stock <= 0;
  return `
    <div class="card">
      <div class="emoji">${p.image}</div>
      <div class="category">${escapeHtml(p.category)}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <p class="desc">${escapeHtml(p.description)}</p>
      <span class="price-tag">$${p.price.toFixed(2)}</span>
      <div class="stock-note ${p.stock <= 5 && p.stock > 0 ? 'low' : ''}">
        ${outOfStock ? 'Out of stock' : `${p.stock} in stock`}
      </div>
      <div class="qty-row">
        <div class="stepper">
          <button onclick="setQtyDraft(${p.id}, ${qty - 1})">−</button>
          <span>${qty}</span>
          <button onclick="setQtyDraft(${p.id}, ${qty + 1})">+</button>
        </div>
        <button class="btn small" style="flex:1" ${outOfStock ? 'disabled' : ''} onclick="addToCart(${p.id})">
          Add to cart
        </button>
      </div>
    </div>
  `;
}

// ---- Cart view ----------------------------------------------------------

function renderCart() {
  if (!state.user) return renderAuth();
  const { items, total } = state.cart;
  if (items.length === 0) {
    return `<div class="empty-state"><div class="icon">🛒</div>Your cart is empty.<br/><button class="btn" style="margin-top:14px" onclick="goto('shop')">Browse products</button></div>`;
  }
  return `
    <h2 class="section-title">Your cart</h2>
    <div class="receipt">
      ${items.map((i) => `
        <div class="receipt-line">
          <div class="info">
            <span class="emoji">${i.product?.image || '📦'}</span>
            <div>
              <div class="name">${escapeHtml(i.product?.name || 'Unknown product')}</div>
              <div class="unit">$${i.product?.price.toFixed(2)} each</div>
            </div>
          </div>
          <div class="stepper">
            <button onclick="setCartQty(${i.productId}, ${i.quantity - 1})">−</button>
            <span>${i.quantity}</span>
            <button onclick="setCartQty(${i.productId}, ${i.quantity + 1})">+</button>
          </div>
          <div class="subtotal">$${i.subtotal.toFixed(2)}</div>
          <button class="btn ghost small" onclick="removeFromCart(${i.productId})">✕</button>
        </div>
      `).join('')}
      <div class="receipt-total"><span>Total</span><span class="mono">$${total.toFixed(2)}</span></div>
    </div>

    <div class="field" style="margin-top:20px;max-width:480px;">
      <label>Shipping address</label>
      <textarea id="shipping-address" rows="3" placeholder="221B Baker Street, London"></textarea>
    </div>
    <button class="btn" onclick="checkout()">Place order</button>
  `;
}

// ---- Orders view (order tracking) ----------------------------------------

const STATUS_FLOW = ['placed', 'processing', 'shipped', 'delivered'];

function renderOrders() {
  if (!state.user) return renderAuth();
  if (state.orders.length === 0) {
    return `<div class="empty-state"><div class="icon">📦</div>No orders yet.<br/><button class="btn" style="margin-top:14px" onclick="goto('shop')">Start shopping</button></div>`;
  }
  return `
    <h2 class="section-title">My orders</h2>
    ${state.orders.map((o) => renderOrderCard(o)).join('')}
  `;
}

function renderOrderCard(o) {
  const stepIndex = STATUS_FLOW.indexOf(o.status);
  return `
    <div class="order-card">
      <div class="order-head">
        <span class="order-id">ORDER #${String(o.id).padStart(4, '0')}</span>
        <span class="order-date">${new Date(o.createdAt).toLocaleString()}</span>
      </div>
      <div class="status-track">
        ${STATUS_FLOW.map((s, idx) => `<div class="status-step ${idx <= stepIndex ? 'done' : ''}">${s}</div>`).join('')}
      </div>
      <div class="order-items">
        ${o.items.map((i) => `<div>${i.quantity} × ${escapeHtml(i.name)} — $${i.subtotal.toFixed(2)}</div>`).join('')}
      </div>
      <div class="receipt-total" style="font-size:15px;margin-top:10px;padding-top:10px;">
        <span>Total</span><span class="mono">$${o.total.toFixed(2)}</span>
      </div>
    </div>
  `;
}

// ---- Admin view -----------------------------------------------------------

function renderAdmin() {
  if (!state.user || state.user.role !== 'admin') return renderShop();
  return `
    <h2 class="section-title">Admin dashboard</h2>
    <div class="subtabs">
      <button class="${state.adminTab === 'products' ? 'active' : ''}" onclick="setState({adminTab:'products'})">Products</button>
      <button class="${state.adminTab === 'orders' ? 'active' : ''}" onclick="setState({adminTab:'orders'}); loadAllOrders()">Orders</button>
    </div>
    ${state.adminTab === 'products' ? renderAdminProducts() : renderAdminOrders()}
  `;
}

function renderAdminProducts() {
  return `
    <div class="admin-grid">
      <div class="admin-form">
        <h3 style="margin-top:0">Add a product</h3>
        <form onsubmit="adminCreateProduct(event)">
          <div class="field"><label>Name</label><input type="text" name="name" required /></div>
          <div class="field"><label>Description</label><textarea name="description" rows="2"></textarea></div>
          <div class="field"><label>Price ($)</label><input type="number" step="0.01" name="price" required /></div>
          <div class="field"><label>Stock</label><input type="number" name="stock" required /></div>
          <div class="field"><label>Category</label><input type="text" name="category" placeholder="Electronics" /></div>
          <div class="field"><label>Emoji icon</label><input type="text" name="image" placeholder="📦" /></div>
          <button class="btn" style="width:100%" type="submit">Add product</button>
        </form>
      </div>
      <div>
        <table>
          <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            ${state.products.map((p) => `
              <tr>
                <td>${p.image} ${escapeHtml(p.name)}</td>
                <td class="mono">$${p.price.toFixed(2)}</td>
                <td>
                  <input type="number" value="${p.stock}" style="width:70px;padding:4px 6px"
                    onchange="adminUpdateStock(${p.id}, this.value)" />
                </td>
                <td class="actions">
                  <button class="btn danger small" onclick="adminDeleteProduct(${p.id})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminOrders() {
  if (state.allOrders.length === 0) {
    return `<div class="empty-state"><div class="icon">📭</div>No orders placed yet.</div>`;
  }
  return `
    <table>
      <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
      <tbody>
        ${state.allOrders.map((o) => `
          <tr>
            <td class="mono">#${String(o.id).padStart(4, '0')}</td>
            <td>${escapeHtml(o.customerName)}</td>
            <td class="mono">$${o.total.toFixed(2)}</td>
            <td>
              <select class="status-select" onchange="adminAdvanceStatus(${o.id}, this.value)">
                ${STATUS_FLOW.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </td>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ---- Utilities -----------------------------------------------------------

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---- Boot -----------------------------------------------------------------

(async function init() {
  await loadProducts();
  if (state.token) await loadCart();
  render();
})();
