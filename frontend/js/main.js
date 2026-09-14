const BASE = 'http://127.0.0.1:5000/api';
let allProducts = [], currentProductId = null, editProductId = null;
let currentLang = localStorage.getItem('lang') || 'en';
function t(key) { return (translations[currentLang] || translations.en)[key] || key; }
function translateMsg(key, data) {
  var msg = t(key);
  Object.keys(data).forEach(function(k) { msg = msg.replace('{' + k + '}', data[k]); });
  return msg;
}

const CAT_EMOJI = { Vegetables:'🥦', Fruits:'🍎', Grains:'🌾', Dairy:'🥛', Spices:'🌶️' };
function catEmoji(cat) { return CAT_EMOJI[cat] || '🌿'; };

// ── HELPERS ───────────────────────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null, auth = true) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (auth) opts.headers['Authorization'] = `Bearer ${getToken()}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  // Auto-logout on expired/invalid token
  if (res.status === 401 || res.status === 422) {
    console.warn('Session expired, logging out.');
    logout();
    throw new Error('Unauthorized');
  }
  return res;
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + (type === 'ok' ? 'msg-ok' : type === 'err' ? 'msg-err' : '');
  el.style.display = text ? 'block' : 'none';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'dummyPayModal') stopQrScan();
}

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const user = getUser();
  if (!user) return logout();

  document.getElementById('navUser').textContent = `${user.name} (${user.role})`;

  const banner = document.getElementById('roleBanner');
  const roleLabels = { 
    farmer: '🌾 Farmer Dashboard', 
    buyer: '🛒 Buyer Dashboard', 
    admin: '⚙️ Admin Dashboard' 
  };
  banner.textContent = roleLabels[user.role] || '';
  banner.className = `role-banner ${user.role}`;
  banner.style.display = user.role ? '' : 'none';

  if (user.role === 'farmer' || user.role === 'admin')
    document.getElementById('tab-myproducts').style.display = '';
  if (user.role === 'admin')
    document.getElementById('tab-admin').style.display = '';

  // Fetch real unread notification count
  apiFetch('/notifications/unread-count').then(r => r.json()).then(d => {
    updateNotifBadge(d.count || 0);
  }).catch(() => {});

  showTab('marketplace');
  loadMarketPrices();
  updateNotifBadge(JSON.parse(localStorage.getItem('agri_notifs') || '[]').length);

  // One-time migration: clear old plain-string notifications so new translatable format takes over
  if (!localStorage.getItem('notifs_migrated') || localStorage.getItem('notifs_migrated') < '3') {
    localStorage.removeItem('agri_notifs');
    localStorage.setItem('notifs_migrated', '3');
  }

  // Restore saved language (always apply to translate UI on load)
  const savedLang = localStorage.getItem('lang') || 'en';
  document.getElementById('langSwitcher').value = savedLang;
  if (savedLang !== 'en') setLang(savedLang);
});

// ── TABS ──────────────────────────────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById(name);
  const btn = document.getElementById('tab-' + name);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');

  if (name === 'marketplace') loadProducts();
  if (name === 'orders') loadOrders();
  if (name === 'education') loadEducation();
  if (name === 'ai') loadAI();
  if (name === 'weather') loadWeather();
  if (name === 'notifications') loadNotifications();
  if (name === 'myproducts') loadMyProducts();
  if (name === 'profile') loadProfile();
  if (name === 'admin') loadAdmin();
  if (name === 'blog') loadBlog();
}

// ── FALLBACK DATA ────────────────────────────────────────────────────────────
const FALLBACK_PRODUCTS = [
  {id:'f1',name:'Fresh Tomatoes',category:'Vegetables',price:42,unit:'kg',quantity:120,description:'Sun-ripened organic tomatoes, hand-picked daily.',farmer_name:'Raju Patil',location:'Pune',rating:4.5,badge:'Organic',reviews:[],image:''},
  {id:'f2',name:'Basmati Rice',category:'Grains',price:78,unit:'kg',quantity:500,description:'Long-grain aged basmati with rich aroma. Ideal for biryani.',farmer_name:'Suresh Yadav',location:'Nashik',rating:4.8,badge:'Premium',reviews:[],image:''},
  {id:'f3',name:'Alphonso Mangoes',category:'Fruits',price:220,unit:'dozen',quantity:60,description:'GI-tagged Alphonso mangoes from Ratnagiri. Naturally ripened.',farmer_name:'Anand Sawant',location:'Ratnagiri',rating:4.9,badge:'Fresh',reviews:[],image:''},
  {id:'f4',name:'Organic Wheat',category:'Grains',price:34,unit:'kg',quantity:800,description:'Chemical-free wheat. High protein content.',farmer_name:'Raju Patil',location:'Pune',rating:4.3,badge:'Organic',reviews:[],image:''},
  {id:'f5',name:'Red Onions',category:'Vegetables',price:28,unit:'kg',quantity:300,description:'Fresh Nashik red onions. Low moisture, long shelf life.',farmer_name:'Kavita Deshmukh',location:'Nashik',rating:4.1,badge:'Fresh',reviews:[],image:''},
  {id:'f6',name:'Turmeric Powder',category:'Spices',price:160,unit:'kg',quantity:80,description:'High-curcumin Erode turmeric, stone-ground.',farmer_name:'Mahesh Reddy',location:'Hubli',rating:4.7,badge:'Premium',reviews:[],image:''},
  {id:'f7',name:'Fresh Milk',category:'Dairy',price:55,unit:'litre',quantity:200,description:'Pure A2 cow milk from desi Gir breed.',farmer_name:'Gopal Nair',location:'Mysore',rating:4.6,badge:'Fresh',reviews:[],image:''},
  {id:'f8',name:'Green Chillies',category:'Vegetables',price:65,unit:'kg',quantity:90,description:'Spicy Guntur green chillies. Perfect for pickles.',farmer_name:'Venkat Rao',location:'Hyderabad',rating:3.9,badge:'Fresh',reviews:[],image:''},
  {id:'f9',name:'Sugarcane Jaggery',category:'Grains',price:95,unit:'kg',quantity:150,description:'Unrefined organic jaggery from Kolhapur.',farmer_name:'Santosh Kulkarni',location:'Belagavi',rating:4.4,badge:'Organic',reviews:[],image:''},
  {id:'f10',name:'Baby Potatoes',category:'Vegetables',price:38,unit:'kg',quantity:200,description:'Small creamy baby potatoes. Great for roasting.',farmer_name:'Pradeep Sharma',location:'Mysore',rating:3.8,badge:'',reviews:[],image:''},
];

// ── MARKETPLACE ───────────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    const res = await apiFetch('/products/');
    const data = await res.json();
    console.log('Products loaded from API:', data.length);
    allProducts = Array.isArray(data) && data.length ? data : FALLBACK_PRODUCTS;
  } catch(e) {
    console.log('Products API failed, using fallback');
    allProducts = FALLBACK_PRODUCTS;
  }
  // Merge locally-added products, but skip any whose name already exists in backend
  const localProds = JSON.parse(localStorage.getItem('local_products') || '[]');
  if (localProds.length) {
    const backendNames = new Set(allProducts.map(function(p){ return p.name.toLowerCase(); }));
    const uniqueLocal = localProds.filter(function(p){ return !backendNames.has(p.name.toLowerCase()); });
    allProducts = [...allProducts, ...uniqueLocal];
  }
  renderProducts(allProducts);
  renderMarketChart();
  loadAnalyticsWidgets();
}

function renderProducts(products) {
  var grid = document.getElementById('productGrid');
  if (!grid) return;
  // Filter out non-approved and out-of-stock from marketplace display
  var visible = products.filter(function(p) {
    return p.status !== 'rejected' && p.status !== 'pending';
  });
  if (!visible.length) { grid.innerHTML = '<p class="empty-msg">' + t('no_data') + '</p>'; return; }
  products = visible;

    var PROD_EMOJI = {
    tomato:'\uD83C\uDF45',tomatoes:'\uD83C\uDF45',rice:'\uD83C\uDF5A',basmati:'\uD83C\uDF5A',
    wheat:'\uD83C\uDF3E',mango:'\uD83E\uDD6D',mangoes:'\uD83E\uDD6D',onion:'\uD83E\uDDC5',
    potato:'\uD83E\uDD54',corn:'\uD83C\uDF3D',maize:'\uD83C\uDF3D',cotton:'\uD83E\uDDF5',
    sugarcane:'\uD83C\uDF6C',jaggery:'\uD83C\uDF6C',milk:'\uD83E\uDD5B',turmeric:'\uD83D\uDFE1',
    chilli:'\uD83C\uDF36',grapes:'\uD83C\uDF47',apple:'\uD83C\uDF4E',banana:'\uD83C\uDF4C',
    orange:'\uD83C\uDF4A',spinach:'\uD83E\uDD6C',carrot:'\uD83E\uDD55',cucumber:'\uD83E\uDD52',
    brinjal:'\uD83C\uDF46',garlic:'\uD83E\uDDC4',ginger:'\uD83E\uDEB4',pepper:'\uD83C\uDF36'
  };
  var CAT_GRADIENT = {
    Vegetables:'linear-gradient(135deg,#d4f1d4,#a8e6cf)',
    Fruits:'linear-gradient(135deg,#ffecd2,#fcb69f)',
    Grains:'linear-gradient(135deg,#fef9c3,#fde68a)',
    Dairy:'linear-gradient(135deg,#dbeafe,#bfdbfe)',
    Spices:'linear-gradient(135deg,#fce7f3,#fbcfe8)'
  };
  function getProdEmoji(p){var k=p.name.toLowerCase().split(' ')[0];return PROD_EMOJI[k]||PROD_EMOJI[p.name.toLowerCase()]||'\uD83C\uDF31';}
  function getProdGradient(p){return CAT_GRADIENT[p.category]||'linear-gradient(135deg,#e8f5e9,#c8e6c9)';}

  grid.innerHTML = products.map(function(p) {
    var stars = '\u2b50'.repeat(Math.round(p.rating || 0));
    var ratingText = p.rating ? ' <span style="font-size:.75rem;color:#888">(' + p.rating + ')</span>' : '';
    var imgUrl = (p.image && p.image.startsWith('http')) ? p.image : '';
    var review = (p.reviews || []).slice(0, 1).map(function(r) {
      return '<div style="font-size:.78rem;color:#777;font-style:italic">\u201c' + r.comment + '\u201d \u2014 ' + r.user + '</div>';
    }).join('');
    var badge = p.badge ? '<span style="background:' + (p.badge==='Organic'?'#27ae60':p.badge==='Premium'?'#8e44ad':'#2980b9') + ';color:#fff;font-size:.68rem;padding:.1rem .45rem;border-radius:8px;margin-left:.3rem;font-weight:600">' + p.badge + '</span>' : '';

    var stock = p.quantity
      ? '<div style="font-size:.78rem;color:' + (p.quantity < 20 ? '#e74c3c' : '#27ae60') + ';margin-top:.15rem">\ud83d\udce6 ' + (p.quantity < 20 ? '\u26a0\ufe0f Low stock: ' : '') + p.quantity + ' ' + p.unit + ' ' + t('available') + '</div>'
      : '';
    var outOfStock = p.status === 'out_of_stock' || p.quantity <= 0;
    var buyBtn = outOfStock
      ? '<button disabled style="width:100%;margin-top:.25rem;background:#aaa;cursor:not-allowed">' + t('out_of_stock') + '</button>'
      : '<button onclick="openPayModal(\'' + p.id + '\',\'' + p.name + '\',' + p.price + ')" style="width:100%;margin-top:.25rem">' + t('buy_now') + '</button>';
    return '<div class="product-card" style="' + (outOfStock ? 'opacity:.65' : '') + '">' +
      '<div class="product-img-block" style="height:130px;display:flex;align-items:center;justify-content:center;font-size:3.8rem;background:' + getProdGradient(p) + ';transition:transform .3s ease">' + getProdEmoji(p) + '</div>' +
      '<div class="product-card-body">' +
        '<h3>' + p.name + badge + '</h3>' +
        '<p class="desc">' + (p.description || '') + '</p>' +
        '<div class="price">\u20b9' + p.price + ' / ' + p.unit + '</div>' +
        stock +
        '<div class="meta">\ud83d\udc68\ud83c\udf3e ' + p.farmer_name + ' \u00b7 \ud83d\udccd ' + (p.location || '') + '</div>' +
        '<div class="stars">' + (stars || 'No rating') + ratingText + '</div>' +
        review +
        '<div class="card-actions">' + buyBtn + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── ORDERS ────────────────────────────────────────────────────────────────────
async function loadOrders() {
  const offline = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  try {
    const res = await apiFetch('/orders/my');
    const data = await res.json();
    const backend = Array.isArray(data) ? data : [];
    // Remove offline orders whose product already appears in backend orders
    const backendProducts = new Set(backend.map(o => o.product_id || o.product_name));
    const pendingOffline = offline.filter(o => !backendProducts.has(o.product_id));
    renderOrders([...backend, ...pendingOffline]);
  } catch(e) {
    renderOrders(offline);
  }
}

const TRACKING = {
  pending:   () => '\ud83d\udd50 ' + t('track_pending'),
  confirmed: () => '\u2705 ' + t('track_confirmed'),
  shipped:   () => '\ud83d\ude9a ' + t('track_shipped'),
  out_for_delivery: () => '\ud83d\udce6 ' + t('track_out'),
  delivered: () => '\u2705 ' + t('track_delivered'),
  cancelled: () => '\u274c ' + t('track_cancelled')
};

function renderOrders(orders) {
  const list = document.getElementById('ordersList');
  const user = getUser();
  if (!orders.length) { list.innerHTML = '<p class="empty-msg">' + t('no_orders') + '</p>'; return; }

  // confirmed is the first real status after payment; pending = offline only
  const STATUS_FLOW  = ['confirmed', 'shipped', 'out_for_delivery', 'delivered'];
  const STATUS_LABEL = {
    confirmed:        '\u2705 ' + t('status_confirmed'),
    shipped:          '\ud83d\ude9a ' + t('status_shipped'),
    out_for_delivery: '\ud83d\udce6 ' + t('status_out'),
    delivered:        '\ud83c\udfe0 ' + t('status_delivered'),
    cancelled:        '\u274c ' + t('status_cancelled'),
    pending:          '\ud83d\udd50 ' + t('status_pending')
  };
  const STATUS_COLOR = {
    confirmed:'#d4edda', shipped:'#cce5ff', out_for_delivery:'#fff3cd',
    delivered:'#d4edda', cancelled:'#f8d7da', pending:'#fff3cd'
  };

  list.innerHTML = orders.map((o, idx) => {
    const offlineBadge = '';
    const stColor = STATUS_COLOR[o.status] || '#e2e3e5';
    const stLabel = STATUS_LABEL[o.status] || o.status || 'pending';

    let actionBtns = '';

    if (o.offline) {
      // Offline order: show Retry button to attempt backend sync
      actionBtns = `<div style="margin-top:.5rem">
        <button style="font-size:.78rem;padding:.3rem .7rem;background:#2980b9" onclick="retryOfflineOrder(${idx})">${t('retry_sync')}</button>
        <button class="btn-danger" style="font-size:.78rem;padding:.3rem .7rem" onclick="removeOfflineOrder(${idx})">${t('remove')}</button>
      </div>`;
    } else if (user && user.role === 'farmer' && o.id) {
      // Real order: farmer can advance through lifecycle
      const cur  = STATUS_FLOW.indexOf(o.status);
      const next = STATUS_FLOW[cur + 1];
      const nextLabel = next ? STATUS_LABEL[next] : null;
      actionBtns = `<div style="margin-top:.5rem;display:flex;gap:.4rem;flex-wrap:wrap">
        ${nextLabel ? `<button style="font-size:.78rem;padding:.3rem .7rem;background:#2d6a2d" onclick="advanceOrderStatus('${o.id}','${next}')">➡️ Mark as ${nextLabel}</button>` : ''}
        ${o.status !== 'cancelled' && o.status !== 'delivered' ? `<button class="btn-danger" style="font-size:.78rem;padding:.3rem .7rem" onclick="advanceOrderStatus('${o.id}','cancelled')">❌ Cancel</button>` : ''}
      </div>`;
    }

    return `<div class="order-item">
      <h4>${o.product_name || o.product_id}${offlineBadge}</h4>
      <p style="font-size:.85rem;color:#555">
        ${user && user.role === 'farmer' ? t('buyer') + ': ' + (o.buyer_name || t('buyer')) : t('farmer_label') + ': ' + (o.farmer_name || '—')}
        &nbsp;| ${t('qty')}: ${o.quantity} ${o.unit || ''} &nbsp;| ₹${o.total || (o.price * o.quantity) || '—'}
      </p>
      <p style="font-size:.82rem;color:#888">📍 ${o.delivery_address || 'No address'}</p>
      <div style="margin-top:.3rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span class="status" style="background:${stColor};color:#333">${stLabel}</span>
        <span style="font-size:.82rem;color:#555">${TRACKING[o.status] ? TRACKING[o.status]() : ''}</span>
      </div>
      ${actionBtns}
    </div>`;
  }).join('');
}

async function retryOfflineOrder(idx) {
  const offline = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  const o = offline[idx];
  if (!o) return;
  try {
    const res = await apiFetch('/orders/', 'POST', {
      product_id: o.product_id, quantity: o.quantity,
      delivery_address: o.delivery_address, payment_method: o.payment_method
    });
    if (res.ok) {
      offline.splice(idx, 1);
      localStorage.setItem('offline_orders', JSON.stringify(offline));
      showToast('✅ Order synced successfully!');
      loadOrders();
    } else { showToast('❌ Sync failed. Backend returned an error.'); }
  } catch(e) { showToast('❌ Backend unreachable. Try again later.'); }
}

function removeOfflineOrder(idx) {
  const offline = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  offline.splice(idx, 1);
  localStorage.setItem('offline_orders', JSON.stringify(offline));
  loadOrders();
}

async function advanceOrderStatus(orderId, newStatus) {
  try {
    const res = await apiFetch('/orders/' + orderId + '/status', 'PUT', { status: newStatus });
    if (res.ok) {
      showToast('✅ Order updated: ' + newStatus.replace(/_/g, ' '));
      loadOrders();
    } else { showToast('❌ Could not update status.'); }
  } catch(e) { showToast('❌ Server unreachable.'); }
}

// ── EDUCATION ─────────────────────────────────────────────────────────────────
const EXPERT_LIST = [
  { name: 'Dr. Sharma', field: 'Irrigation & Water Management', contact: 'sharma@agri.in' },
  { name: 'Dr. Patel',  field: 'Pest Control & Organic Farming', contact: 'patel@agri.in' },
  { name: 'Dr. Reddy',  field: 'Soil Health & Fertilizers',      contact: 'reddy@agri.in' },
  { name: 'Dr. Kumar',  field: 'Crop Rotation & Management',     contact: 'kumar@agri.in' },
];

let forumPosts = JSON.parse(localStorage.getItem('forumPosts') || '[]');

async function loadEducation() {
  let apiItems = [];
  try {
    const res = await apiFetch('/education/');
    apiItems = await res.json();
    if (!Array.isArray(apiItems)) apiItems = [];
  } catch(e) {
    document.getElementById('educationList').innerHTML = '<p class="empty-msg">Could not load articles.</p>';
  }
  // Merge localStorage posts (user-created) on top
  const localPosts = JSON.parse(localStorage.getItem('edu_posts') || '[]');
  renderEducation([...localPosts, ...apiItems]);
  renderExperts();
  renderForum();
}

function addEduPost() {
  const title   = document.getElementById('eduTitle').value.trim();
  const content = document.getElementById('eduContent').value.trim();
  if (!title || !content) { alert('Title and description are required.'); return; }
  const user = getUser();
  const post = {
    title,
    content,
    category: document.getElementById('eduCategory').value,
    youtube_url: document.getElementById('eduYoutube').value.trim(),
    type: document.getElementById('eduYoutube').value.trim() ? 'video' : 'article',
    author: user ? user.name : 'Anonymous',
    views: 0,
    likes: 0,
    _local: true
  };
  const posts = JSON.parse(localStorage.getItem('edu_posts') || '[]');
  posts.unshift(post);
  localStorage.setItem('edu_posts', JSON.stringify(posts));
  document.getElementById('eduTitle').value   = '';
  document.getElementById('eduContent').value = '';
  document.getElementById('eduYoutube').value = '';
  const msg = document.getElementById('eduPostMsg');
  msg.textContent = '✅ Post published!';
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
  loadEducation();
}

function renderEducation(items) {
  const list = document.getElementById('educationList');
  if (!items.length) { list.innerHTML = '<p class="empty-msg">No articles found.</p>'; return; }
  list.innerHTML = '<div class="edu-grid">' + items.map(i => {
    const vidId = i.youtube_url ? i.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] : null;
    const media = vidId
      ? `<div class="edu-video">
           <iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen loading="lazy" style="width:100%;height:180px;border-radius:8px"></iframe>
           <a href="${i.youtube_url}" target="_blank" rel="noopener" style="display:block;margin-top:.4rem;font-size:.82rem;color:#2d6a2d;text-decoration:none;font-weight:600">🔗 Watch on YouTube ↗</a>
         </div>`
      : `<div style="height:80px;background:linear-gradient(135deg,#e8f5e9,#c8e6c9);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:.75rem">📖</div>`;
    const typeTag = i.type === 'video' ? '🎬 Video' : '📄 Article';
    return `<div class="edu-card">
      ${media}
      <div class="edu-card-body">
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem">
          <span style="background:#e8f5e9;color:#2d6a2d;font-size:.72rem;padding:.15rem .5rem;border-radius:8px;font-weight:600">${i.category || 'General'}</span>
          <span style="background:#f0f0f0;color:#555;font-size:.72rem;padding:.15rem .5rem;border-radius:8px">${typeTag}</span>
        </div>
        <h4 style="margin:0 0 .4rem;font-size:.95rem;color:#1a1a1a">${i.title}</h4>
        <p style="font-size:.85rem;line-height:1.55;color:#555;margin-bottom:.6rem">${i.content || ''}</p>
        <small style="color:#999">✍️ ${i.author || 'Unknown'} &nbsp;·&nbsp; 👁 ${i.views || 0} &nbsp;·&nbsp; 👍 ${i.likes || 0}</small>
      </div>
    </div>`;
  }).join('') + '</div>';
}

function renderExperts() {
  const el = document.getElementById('expertsList');
  if (!el) return;
  el.innerHTML = EXPERT_LIST.map(e => `
    <div class="product-card" style="min-width:200px;max-width:240px">
      <div style="font-size:2rem">👨‍🔬</div>
      <h4>${e.name}</h4>
      <p style="font-size:.85rem;color:#555">${e.field}</p>
      <button onclick="askExpert('${e.name}')">Ask Expert</button>
    </div>`).join('');
}

function askExpert(expertName) {
  var q = (document.getElementById('expertQueryInput') || {}).value ||
          window._expertQuery || '';
  // Use inline input if available, else fall back gracefully
  var inputEl = document.getElementById('expertQueryInput_' + expertName.replace(/\s/g,'_'));
  if (inputEl) q = inputEl.value.trim();
  if (!q) {
    // Show inline prompt row instead of browser prompt
    var el = document.getElementById('expertsList');
    var existing = document.getElementById('expertAsk_' + expertName.replace(/\s/g,'_'));
    if (existing) { existing.remove(); return; }
    var row = document.createElement('div');
    row.id = 'expertAsk_' + expertName.replace(/\s/g,'_');
    row.style.cssText = 'margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap';
    row.innerHTML = '<input id="expertQueryInput_' + expertName.replace(/\s/g,'_') + '" placeholder="Your question for ' + expertName + '…" style="flex:1;min-width:180px;padding:.45rem .7rem;border:1.5px solid #2d6a2d;border-radius:8px;font-size:.88rem">'+
      '<button onclick="askExpert(\'' + expertName + '\')">Send</button>';
    el.appendChild(row);
    return;
  }
  var inputRow = document.getElementById('expertAsk_' + expertName.replace(/\s/g,'_'));
  if (inputRow) inputRow.remove();
  var queries = JSON.parse(localStorage.getItem('expertQueries') || '[]');
  queries.unshift({ expert: expertName, question: q, time: new Date().toLocaleString() });
  localStorage.setItem('expertQueries', JSON.stringify(queries.slice(0, 20)));
  pushNotification('Question sent to ' + expertName);
  var el = document.getElementById('expertsList');
  var confirm = document.createElement('p');
  confirm.style.cssText = 'color:#27ae60;margin-top:.5rem;font-size:.9rem';
  confirm.textContent = '\u2705 Question sent to ' + expertName + '. They will respond within 24 hours.';
  el.appendChild(confirm);
  setTimeout(function() { confirm.remove(); }, 4000);
}

function renderForum() {
  const el = document.getElementById('forumList');
  if (!el) return;
  if (!forumPosts.length) { el.innerHTML = '<p class="empty-msg">No posts yet. Be the first to ask!</p>'; return; }
  el.innerHTML = forumPosts.map((p, i) => `
    <div class="order-item">
      <strong>${p.user}</strong> <span style="font-size:.75rem;color:#888">${p.time}</span>
      <p style="margin-top:.3rem">${p.text}</p>
    </div>`).join('');
}

function postForumQuestion() {
  const input = document.getElementById('forumInput');
  const text = input.value.trim();
  if (!text) return;
  const user = getUser();
  forumPosts.unshift({ user: user ? user.name : 'Anonymous', text, time: new Date().toLocaleString() });
  localStorage.setItem('forumPosts', JSON.stringify(forumPosts));
  input.value = '';
  renderForum();
}

// ── AI TOOLS ──────────────────────────────────────────────────────────────────
async function loadAI() {
  document.getElementById('aiInput') || (document.getElementById('aiSection').innerHTML = '<input id="aiInput" placeholder="Enter crop name for advice"> <button onclick="getAICropAdvice()">Get Advice</button> <div id="aiResult"></div>');
}

async function getAICropAdvice() {
  const crop = document.getElementById('aiInput').value.trim();
  if (!crop) { document.getElementById('aiResult').innerHTML = 'Please enter a crop name.'; return; }
  document.getElementById('aiResult').innerHTML = 'Loading…';
  try {
    const res = await apiFetch('/ai/crop-advice', 'POST', { crop });
    const data = await res.json();
    document.getElementById('aiResult').innerHTML =
      `<strong>🌱 ${data.crop.toUpperCase()}</strong><br>
       📅 Season: ${data.season}<br>
       💧 Water: ${data.water}<br>
       🪨 Soil: ${data.soil}<br>
       💡 Tip: ${data.tip}`;
  } catch(e) {
    document.getElementById('aiResult').innerHTML = 'AI service unavailable.';
  }
}

// ── WEATHER ───────────────────────────────────────────────────────────────────
async function loadWeather() {
  const city = (document.getElementById('cityInput') || {}).value || 'Pune';
  const el = document.getElementById('weatherInfo');
  el.innerHTML = 'Loading…';
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const d = await res.json();
    const cur = d.current_condition[0];
    const forecast = d.weather.slice(0, 3).map(w =>
      `<div style="background:#f0f4f0;border-radius:6px;padding:.5rem .75rem;font-size:.82rem;text-align:center;min-width:90px">
        <div>${w.date}</div><div>${w.mintempC}°–${w.maxtempC}°C</div>
        <div>${w.hourly[4]?.weatherDesc[0]?.value || ''}</div>
      </div>`).join('');
    el.innerHTML = `
      <div style="font-size:2rem;font-weight:bold;color:#2d6a2d">${cur.temp_C}°C</div>
      <div style="color:#555">${cur.weatherDesc[0].value} · 📍 ${city}</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.5rem 0">
        <span style="background:#e8f5e9;padding:.2rem .5rem;border-radius:10px;font-size:.82rem">💧 Humidity ${cur.humidity}%</span>
        <span style="background:#e8f5e9;padding:.2rem .5rem;border-radius:10px;font-size:.82rem">💨 Wind ${cur.windspeedKmph} km/h</span>
        <span style="background:#e8f5e9;padding:.2rem .5rem;border-radius:10px;font-size:.82rem">🌡 Feels ${cur.FeelsLikeC}°C</span>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem">${forecast}</div>`;
  } catch(e) {
    el.innerHTML = '<span style="color:#c0392b">⚠️ Could not load weather. Check city name.</span>';
  }
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
function extractItem(msg) {
  const m = msg.match(/"(.*?)"/);
  return m ? m[1] : 'item';
}

function convertOldNotification(msg) {
  if (typeof msg !== 'string') return msg;
  if (msg.includes('order_placed') || msg.includes('\u2705 Order placed')) return { key: 'order_placed', data: { item: extractItem(msg), method: '', total: '' } };
  return msg; // non-order strings (crop, blog, leaf) stay as-is
}

function pushNotification(msg) {
  const stored = JSON.parse(localStorage.getItem('agri_notifs') || '[]');
  // msg can be a plain string OR {key, data} for translatable messages
  stored.unshift({ msg, time: new Date().toLocaleString() });
  localStorage.setItem('agri_notifs', JSON.stringify(stored.slice(0, 30)));
}

async function loadNotifications() {
  const el = document.getElementById('notifList');
  try {
    const res = await apiFetch('/notifications/');
    const data = await res.json();
    const notifs = Array.isArray(data) ? data : [];
    // Merge with any localStorage notifications (from pushNotification calls)
    const stored = JSON.parse(localStorage.getItem('agri_notifs') || '[]');
    const localNotifs = stored.map(n => {
      // Upgrade any old plain-string order notifications to {key,data} format
      const msg = convertOldNotification(n.msg);
      // Resolve translatable {key, data} objects at render time
      const text = (msg && typeof msg === 'object' && msg.key)
        ? translateMsg(msg.key, msg.data || {})
        : (msg || '');
      return { message: text, type: 'info', read: true, created_at: n.time };
    });
    // Avoid duplicates: if localStorage has order_placed entries, skip backend order_confirmed
    const hasLocalOrders = localNotifs.some(n => n.message && n.message.includes('₹'));
    const filteredNotifs = hasLocalOrders ? notifs.filter(n => n.type !== 'order_confirmed') : notifs;
    const all = [...filteredNotifs, ...localNotifs];
    if (!all.length) {
      el.innerHTML = '<p class="empty-msg">' + t('no_notifs') + '</p>';
      updateNotifBadge(0);
      return;
    }
    const TYPE_ICON = {
      product_pending:  '⏳',
      product_approved: '✅',
      product_rejected: '❌',
      new_order:        '🛒',
      order_confirmed:  '✅',
      info:             '🔔'
    };
    el.innerHTML = all.map(n => {
      const icon = TYPE_ICON[n.type] || '🔔';
      const unread = !n.read ? 'border-left:3px solid #2d6a2d;background:#f0f9f0;' : '';
      const time = n.created_at ? (() => { try { return new Date(n.created_at).toLocaleString('en-IN', {dateStyle:'medium',timeStyle:'short'}); } catch(e) { return n.created_at; } })() : '';
      return `<div class="notif" style="padding:.85rem 1rem;${unread}">
        <span style="font-size:1.1rem">${icon}</span>
        <span style="margin-left:.5rem">${n.message || 'Notification'}</span>
        ${time ? `<div style="font-size:.75rem;color:#aaa;margin-top:.2rem">${time}</div>` : ''}
      </div>`;
    }).join('');
    const unreadCount = notifs.filter(n => !n.read).length;
    updateNotifBadge(unreadCount);
    apiFetch('/notifications/mark-read', 'PUT').catch(() => {});
  } catch(e) {
    // Fallback: show localStorage notifications only
    const stored = JSON.parse(localStorage.getItem('agri_notifs') || '[]');
    if (stored.length) {
      el.innerHTML = stored.map(n => {
        const msg = convertOldNotification(n.msg);
        const text = (msg && typeof msg === 'object' && msg.key)
          ? translateMsg(msg.key, msg.data || {})
          : (msg || '');
        return `<div class="notif" style="padding:.85rem 1rem">🔔 <span style="margin-left:.5rem">${text}</span><div style="font-size:.75rem;color:#aaa">${n.time}</div></div>`;
      }).join('');
      updateNotifBadge(0);
    } else {
      el.innerHTML = '<p class="empty-msg">' + t('no_notifs') + '</p>';
      updateNotifBadge(0);
    }
  }
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notifBadge');
  if (badge) badge.textContent = count || 0;
}

// ── MY PRODUCTS (Farmer/Admin) ───────────────────────────────────────────────
async function loadMyProducts() {
  try {
    const res = await apiFetch('/products/my/listings');
    const data = await res.json();
    const backend = Array.isArray(data) ? data : [];
    // Backend is reachable — clear stale local products and show only backend data
    localStorage.removeItem('local_products');
    renderMyProducts(backend);
  } catch(e) {
    // Backend unreachable — fall back to local products only
    renderMyProducts(JSON.parse(localStorage.getItem('local_products') || '[]'));
  }
}

function renderMyProducts(products) {
  const grid = document.getElementById('myProductsGrid');
  if (!products.length) {
    grid.innerHTML = '<p class="empty-msg">No products listed yet. Add your first product above.</p>';
    return;
  }
  const STATUS_STYLE = {
    approved: 'background:#d4edda;color:#155724',
    pending:  'background:#fff3cd;color:#856404',
    rejected: 'background:#f8d7da;color:#721c24',
    out_of_stock: 'background:#e2e3e5;color:#383d41'
  };
  const STATUS_LABEL = {
    approved: '✅ ' + t('lbl_approved'),
    pending:  '⏳ ' + t('lbl_under_review'),
    rejected: '❌ ' + t('lbl_rejected'),
    out_of_stock: '📭 ' + t('lbl_out_of_stock')
  };
  grid.innerHTML = products.map(p => {
    const st = p.status || 'pending';
    const stStyle = STATUS_STYLE[st] || STATUS_STYLE.pending;
    const stLabel = STATUS_LABEL[st] || st;
    const soldOut = st === 'out_of_stock' || p.quantity <= 0;
    const qtyColor = p.quantity <= 10 ? '#e74c3c' : '#27ae60';
    return `<div class="product-card" style="${soldOut ? 'opacity:.7' : ''}">
      <div style="height:90px;display:flex;align-items:center;justify-content:center;font-size:3rem;background:linear-gradient(135deg,#e8f5e9,#c8e6c9)">${catEmoji(p.category)}</div>
      <div class="product-card-body">
        <h3>${p.name}</h3>
        <div class="price">₹${p.price} / ${p.unit}</div>
        <div style="font-size:.8rem;color:${qtyColor};margin:.2rem 0">📦 ${t('stock')}: ${p.quantity} ${p.unit}${soldOut ? ' — <strong>' + t('sold_out') + '</strong>' : ''}</div>
        <div style="display:inline-block;padding:.2rem .6rem;border-radius:10px;font-size:.75rem;font-weight:600;margin:.3rem 0;${stStyle}">${stLabel}</div>
        <div style="margin-top:.5rem;display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn-danger" style="font-size:.78rem;padding:.3rem .6rem" onclick="deleteProduct('${p.id}')">🗑 ${t('delete')}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openAddProductModal() {
  ['apName','apPrice','apQty','apImage'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('apCategory').value = 'Vegetables';
  document.getElementById('apUnit').value = 'kg';
  ['apNameErr','apPriceErr','apQtyErr','apGlobalErr'].forEach(id => { document.getElementById(id).style.display = 'none'; });
  document.getElementById('apSubmitBtn').disabled = false;
  document.getElementById('addProductModal').classList.add('open');
}

function closeAddProductModal() {
  document.getElementById('addProductModal').classList.remove('open');
}

function showToast(msg) {
  var t = document.getElementById('toastMsg');
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(60px)';
  }, 3000);
}

async function submitAddProduct() {
  var name     = document.getElementById('apName').value.trim();
  var price    = parseFloat(document.getElementById('apPrice').value);
  var qty      = parseInt(document.getElementById('apQty').value);
  var category = document.getElementById('apCategory').value;
  var unit     = document.getElementById('apUnit').value;
  var image    = document.getElementById('apImage').value.trim();

  var valid = true;
  function fieldErr(errId, show) {
    document.getElementById(errId).style.display = show ? 'block' : 'none';
    if (show) valid = false;
  }
  fieldErr('apNameErr',  !name);
  fieldErr('apPriceErr', !price || price <= 0);
  fieldErr('apQtyErr',   !qty   || qty   <= 0);
  if (!valid) return;

  var btn = document.getElementById('apSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Adding…';
  document.getElementById('apGlobalErr').style.display = 'none';

  var success = false;
  try {
    var res = await apiFetch('/products/', 'POST', { name, price, quantity: qty, category, unit, image });
    if (res.ok) {
      success = true;
      localStorage.removeItem('local_products');
      closeAddProductModal();
      showToast('✅ Product "' + name + '" added!');
      loadMyProducts();
      loadProducts();
    }
  } catch(e) { /* backend unreachable */ }

  if (!success) {
    btn.disabled = false;
    btn.textContent = '🌱 Add Product';
    _saveProductLocally({ name, price, quantity: qty, category, unit, image });
  }
}

function _saveProductLocally(p) {
  const user = getUser();
  const local = JSON.parse(localStorage.getItem('local_products') || '[]');
  local.push({
    id: 'local_' + Date.now(),
    name: p.name, price: p.price, quantity: p.quantity,
    category: p.category, unit: p.unit, image: p.image || '',
    farmer_name: user ? user.name : 'You',
    location: user ? (user.location || '') : '',
    description: '', rating: 0, reviews: [], badge: '', status: 'approved',
    _local: true
  });
  localStorage.setItem('local_products', JSON.stringify(local));
  closeAddProductModal();
  loadProducts();
  loadMyProducts();
  showToast('✅ Product "' + p.name + '" added successfully.');
  pushNotification('🌱 Product "' + p.name + '" added.');
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  // Local product — remove from localStorage only
  if (String(id).startsWith('local_')) {
    const local = JSON.parse(localStorage.getItem('local_products') || '[]');
    localStorage.setItem('local_products', JSON.stringify(local.filter(p => p.id !== id)));
    loadMyProducts();
    loadProducts();
    showToast('🗑 Product removed.');
    return;
  }
  // Backend product
  try {
    const res = await apiFetch(`/products/${id}`, 'DELETE');
    if (res.ok) { loadMyProducts(); loadProducts(); showToast('🗑 Product deleted.'); }
    else showMsg('msg', '❌ Could not delete product.', 'err');
  } catch(e) {
    showMsg('msg', '❌ Server error while deleting.', 'err');
  }
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
async function loadProfile() {
  try {
    const res = await apiFetch('/auth/me');
    const data = await res.json();
    renderProfile(data);
  } catch(e) {
    // Fall back to localStorage user
    renderProfile(getUser() || {});
  }
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
async function loadAdmin() {
  // Stats
  try {
    const r = await apiFetch('/admin/stats');
    const s = await r.json();
    document.getElementById('adminStats').innerHTML = [
      ['👥 Users', s.users, ''],
      ['🌾 Farmers', s.farmers, 'blue'],
      ['🛒 Buyers', s.buyers, 'orange'],
      ['📦 Products', s.products, ''],
      ['⏳ Pending', s.pending_products, 'purple'],
      ['📋 Orders', s.orders, 'blue']
    ].map(([lbl, val, cls]) =>
      `<div class="analytics-card ${cls}" style="padding:.9rem">
        <div class="ac-num">${val}</div>
        <div class="ac-lbl">${lbl}</div>
      </div>`
    ).join('');
  } catch(e) { document.getElementById('adminStats').innerHTML = ''; }

  // Pending approvals
  try {
    const r = await apiFetch('/admin/products/pending');
    const pending = await r.json();
    const el = document.getElementById('pendingProductsList');
    if (!pending.length) {
      el.innerHTML = '<p class="empty-msg">No products awaiting approval.</p>';
    } else {
      el.innerHTML = pending.map(p =>
        `<div class="item-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
          <div>
            <strong>${p.name}</strong>
            <span style="font-size:.8rem;color:#888;margin-left:.5rem">${p.category} · ₹${p.price}/${p.unit} · ${p.farmer_name}</span>
          </div>
          <div style="display:flex;gap:.5rem">
            <button style="background:#27ae60;font-size:.8rem;padding:.3rem .7rem" onclick="adminApprove('${p.id}')">✅ Approve</button>
            <button class="btn-danger" style="font-size:.8rem;padding:.3rem .7rem" onclick="adminReject('${p.id}')">❌ Reject</button>
          </div>
        </div>`
      ).join('');
    }
  } catch(e) { document.getElementById('pendingProductsList').innerHTML = '<p>Could not load.</p>'; }

  // Users
  try {
    const r = await apiFetch('/admin/users');
    const users = await r.json();
    const roleColor = { farmer:'#f39c12', buyer:'#3498db', admin:'#27ae60' };
    document.getElementById('adminList').innerHTML = users.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.75rem">${
          users.map(u =>
            `<div class="item-card">
              <strong>${u.name}</strong>
              <span style="background:${roleColor[u.role]||'#ddd'};color:#fff;font-size:.72rem;padding:.1rem .45rem;border-radius:8px;margin-left:.4rem">${u.role}</span>
              <div style="font-size:.8rem;color:#888;margin-top:.3rem">📧 ${u.email}</div>
              <div style="font-size:.8rem;color:#888">📍 ${u.location||'—'}</div>
            </div>`
          ).join('')
        }</div>`
      : '<p class="empty-msg">No users.</p>';
  } catch(e) { document.getElementById('adminList').innerHTML = '<p>Could not load users.</p>'; }

  // All orders
  try {
    const r = await apiFetch('/admin/orders');
    const orders = await r.json();
    document.getElementById('adminOrdersList').innerHTML = orders.length
      ? orders.slice(0,20).map(o =>
          `<div class="item-card" style="font-size:.85rem">
            <strong>${o.product_name}</strong> &nbsp;·&nbsp;
            👤 ${o.buyer_name} &nbsp;·&nbsp; 👨‍🌾 ${o.farmer_name}<br>
            <span style="color:#888">Qty: ${o.quantity} ${o.unit} &nbsp;·&nbsp; ₹${o.total} &nbsp;·&nbsp;</span>
            <span class="status">${o.status}</span>
          </div>`
        ).join('')
      : '<p class="empty-msg">No orders yet.</p>';
  } catch(e) { document.getElementById('adminOrdersList').innerHTML = '<p>Could not load orders.</p>'; }
}

async function adminApprove(id) {
  try {
    const r = await apiFetch(`/admin/products/${id}/approve`, 'PUT');
    if (r.ok) { showToast('✅ Product approved and live on marketplace!'); loadAdmin(); }
  } catch(e) { showToast('❌ Could not approve.'); }
}

async function adminReject(id) {
  try {
    const r = await apiFetch(`/admin/products/${id}/reject`, 'PUT');
    if (r.ok) { showToast('Product rejected.'); loadAdmin(); }
  } catch(e) { showToast('❌ Could not reject.'); }
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
// Note: getToken, getUser, logout are defined in auth.js — not duplicated here

async function loadMarketPrices() {
  // Placeholder — market prices shown in AI tab
}

// ── MULTI-LANGUAGE ────────────────────────────────────────────────────────────
const translations = {
  en: {
    marketplace:'🛒 Marketplace', orders:'📋 Orders', education:'📚 Education',
    ai:'🤖 AI Tools', weather:'🌤️ Weather', notifications:'🔔 Notifications',
    myproducts:'🌱 My Products', profile:'👤 Profile', admin:'⚙️ Admin',
    h_marketplace:'🛒 Marketplace', h_orders:'📋 Orders', h_education:'📚 Education',
    h_ai:'🤖 AI Tools', h_weather:'🌤️ Weather', h_notifications:'🔔 Notifications',
    h_myproducts:'🌱 My Products', h_profile:'👤 Profile', h_admin:'⚙️ Admin Panel',
    blog:'📝 Blog', publish:'📤 Publish',
    status_confirmed:'Confirmed', status_shipped:'Shipped', status_out:'Out for Delivery',
    status_delivered:'Delivered', status_cancelled:'Cancelled', status_pending:'Awaiting confirmation',
    track_pending:'Order received — being prepared', track_confirmed:'Payment confirmed — processing',
    track_shipped:'Dispatched from warehouse', track_out:'Out for delivery',
    track_delivered:'Delivered to your address', track_cancelled:'Order was cancelled',
    order_placed:'✅ Order placed for "{item}" via {method} · ₹{total}',
    buy_now:'🛒 Buy Now', available:'available', add_product:'+ Add Product',
    no_data:'No products available right now.', out_of_stock:'📭 Out of Stock',
    logout:'Logout', no_orders:'No orders yet. Place your first order from the Marketplace!',
    no_notifs:'No notifications yet.', qty:'Qty', low_stock:'Low stock',
    retry_sync:'🔄 Retry sync', remove:'🗑 Remove', buyer:'Buyer', farmer_label:'Farmer',
    market_trends:'📈 Market Trends — Mandi Prices (₹/quintal)',
    stat_products:'📦 Products Listed', stat_orders:'📋 My Orders',
    stat_notifs:'🔔 Notifications', stat_crops:'🌾 Crops Tracked',
    crop_wheat:'Wheat', crop_rice:'Rice', crop_tomato:'Tomato', crop_onion:'Onion',
    crop_potato:'Potato', crop_cotton:'Cotton', crop_maize:'Maize', crop_sugarcane:'Sugarcane',
    save_profile:'💾 Save Profile', get_advice:'Get Advice', get_rec:'Get Recommendations',
    analyse_leaf:'🔍 Analyse Leaf', publish_post:'📤 Publish Post',
    get_weather:'Get Weather', forum_post:'Post',
    blog:'📝 Blog', publish:'📤 Publish',
    delete:'Delete', lbl_approved:'Approved', lbl_under_review:'Under Review',
    lbl_rejected:'Rejected', lbl_out_of_stock:'Out of Stock', stock:'Stock', sold_out:'SOLD OUT'
  },
  hi: {
    marketplace:'🛒 बाजार', orders:'📋 ऑर्डर', education:'📚 शिक्षा',
    ai:'🤖 AI टूल्स', weather:'🌤️ मौसम', notifications:'🔔 सूचनाएं',
    myproducts:'🌱 मेरे उत्पाद', profile:'👤 प्रोफ़ाइल', admin:'⚙️ एडमिन',
    h_marketplace:'🛒 बाजार', h_orders:'📋 ऑर्डर', h_education:'📚 शिक्षा',
    h_ai:'🤖 AI टूल्स', h_weather:'🌤️ मौसम', h_notifications:'🔔 सूचनाएं',
    h_myproducts:'🌱 मेरे उत्पाद', h_profile:'👤 प्रोफ़ाइल', h_admin:'⚙️ एडमिन पैनल',
    blog:'📝 ब्लॉग', publish:'📤 प्रकाशित करें',
    status_confirmed:'पुष्टि हुई', status_shipped:'भेजा गया', status_out:'डिलीवरी पर',
    status_delivered:'डिलीवर', status_cancelled:'रद्द', status_pending:'पुष्टि की प्रतीक्षा',
    track_pending:'ऑर्डर मिला — तैयार हो रहा है', track_confirmed:'भुगतान पुष्ट — प्रक्रियाधीन',
    track_shipped:'गोदाम से भेजा गया', track_out:'डिलीवरी के लिए निकला',
    track_delivered:'आपके पते पर डिलीवर', track_cancelled:'ऑर्डर रद्द किया गया',
    order_placed:'✅ "{item}" के लिए ऑर्डर {method} से · ₹{total}',
    buy_now:'🛒 खरीदें', available:'उपलब्ध', add_product:'+ उत्पाद जोड़ें',
    no_data:'अभी कोई उत्पाद उपलब्ध नहीं है।', out_of_stock:'📭 स्टॉक खत्म',
    logout:'लॉगआउट', no_orders:'अभी कोई ऑर्डर नहीं।', no_notifs:'कोई सूचना नहीं।',
    qty:'मात्रा', low_stock:'कम स्टॉक', retry_sync:'🔄 पुनः सिंक', remove:'🗑 हटाएं',
    buyer:'खरीदार', farmer_label:'किसान',
    market_trends:'📈 बाजार रुझान — मंडी भाव (₹/क्विंटल)',
    stat_products:'📦 उत्पाद सूचीबद्ध', stat_orders:'📋 मेरे ऑर्डर',
    stat_notifs:'🔔 सूचनाएं', stat_crops:'🌾 फसलें ट्रैक की गईं',
    crop_wheat:'गेहूं', crop_rice:'चावल', crop_tomato:'टमाटर', crop_onion:'प्याज',
    crop_potato:'आलू', crop_cotton:'कपास', crop_maize:'मक्का', crop_sugarcane:'गन्ना',
    save_profile:'💾 प्रोफ़ाइल सहेजें', get_advice:'सलाह लें', get_rec:'सिफारिश पाएं',
    analyse_leaf:'🔍 पत्ती विश्लेषण', publish_post:'📤 पोस्ट प्रकाशित करें',
    get_weather:'मौसम देखें', forum_post:'पोस्ट करें',
    blog:'📝 ब्लॉग', publish:'📤 प्रकाशित करें',
    delete:'हटाएं', lbl_approved:'स्वीकृत', lbl_under_review:'समीक्षाधीन',
    lbl_rejected:'अस्वीकृत', lbl_out_of_stock:'स्टॉक खत्म', stock:'स्टॉक', sold_out:'बिक गया'
  },
  kn: {
    marketplace:'🛒 ಮಾರುಕಟ್ಟೆ', orders:'📋 ಆರ್ಡರ್', education:'📚 ಶಿಕ್ಷಣ',
    ai:'🤖 AI ಪರಿಕರಗಳು', weather:'🌤️ ಹವಾಮಾನ', notifications:'🔔 ಅಧಿಸೂಚನೆಗಳು',
    myproducts:'🌱 ನನ್ನ ಉತ್ಪನ್ನಗಳು', profile:'👤 ಪ್ರೊಫೈಲ್', admin:'⚙️ ನಿರ್ವಾಹಕ',
    h_marketplace:'🛒 ಮಾರುಕಟ್ಟೆ', h_orders:'📋 ಆರ್ಡರ್', h_education:'📚 ಶಿಕ್ಷಣ',
    h_ai:'🤖 AI ಪರಿಕರಗಳು', h_weather:'🌤️ ಹವಾಮಾನ', h_notifications:'🔔 ಅಧಿಸೂಚನೆಗಳು',
    h_myproducts:'🌱 ನನ್ನ ಉತ್ಪನ್ನಗಳು', h_profile:'👤 ಪ್ರೊಫೈಲ್', h_admin:'⚙️ ನಿರ್ವಾಹಕ ಪ್ಯಾನೆಲ್',
    blog:'📝 ಬ್ಲಾಗ್', publish:'📤 ಪ್ರಕಟಿಸಿ',
    status_confirmed:'ದೃಢಪಡಿಸಲಾಗಿದೆ', status_shipped:'ಕಳುಹಿಸಲಾಗಿದೆ', status_out:'ವಿತರಣೆಗೆ ಹೊರಟಿದೆ',
    status_delivered:'ವಿತರಿಸಲಾಗಿದೆ', status_cancelled:'ರದ್ದು', status_pending:'ದೃಢೀಕರಣಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ',
    track_pending:'ಆರ್ಡರ್ ಸ್ವೀಕರಿಸಲಾಗಿದೆ — ತಯಾರಿಸಲಾಗುತ್ತಿದೆ', track_confirmed:'ಪಾವತಿ ದೃಢ — ಪ್ರಕ್ರಿಯಾಧೀನ',
    track_shipped:'ಗೋದಾಮಿನಿಂದ ಕಳುಹಿಸಲಾಗಿದೆ', track_out:'ವಿತರಣೆಗೆ ಹೊರಟಿದೆ',
    track_delivered:'ನಿಮ್ಮ ವಿಳಾಸಕ್ಕೆ ವಿತರಿಸಲಾಗಿದೆ', track_cancelled:'ಆರ್ಡರ್ ರದ್ದು ಮಾಡಲಾಗಿದೆ',
    order_placed:'✅ "{item}" ಗಾಗಿ ಆರ್ಡರ್ {method} ಮೂಲಕ · ₹{total}',
    buy_now:'🛒 ಖರೀದಿಸಿ', available:'ಲಭ್ಯವಿದೆ', add_product:'+ ಉತ್ಪನ್ನ ಸೇರಿಸಿ',
    no_data:'ಈಗ ಯಾವುದೇ ಉತ್ಪನ್ನಗಳು ಲಭ್ಯವಿಲ್ಲ.', out_of_stock:'📭 ಸ್ಟಾಕ್ ಇಲ್ಲ',
    logout:'ಲಾಗ್ ಔಟ್', no_orders:'ಇನ್ನೂ ಆರ್ಡರ್ ಇಲ್ಲ.', no_notifs:'ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ.',
    qty:'ಪ್ರಮಾಣ', low_stock:'ಕಡಿಮೆ ಸ್ಟಾಕ್', retry_sync:'🔄 ಮರು ಸಿಂಕ್', remove:'🗑 ತೆಗೆದುಹಾಕಿ',
    buyer:'ಖರೀದಿದಾರ', farmer_label:'ರೈತ',
    market_trends:'📈 ಮಾರುಕಟ್ಟೆ ಪ್ರವೃತ್ತಿ — ಮಂಡಿ ಬೆಲೆ (₹/ಕ್ವಿಂಟಾಲ್)',
    stat_products:'📦 ಉತ್ಪನ್ನಗಳು ಪಟ್ಟಿ', stat_orders:'📋 ನನ್ನ ಆರ್ಡರ್',
    stat_notifs:'🔔 ಅಧಿಸೂಚನೆಗಳು', stat_crops:'🌾 ಬೆಳೆ ಟ್ರ್ಯಾಕ್',
    crop_wheat:'ಗೋಧಿ', crop_rice:'ಅಕ್ಕಿ', crop_tomato:'ಟೊಮೇಟೊ', crop_onion:'ಈರುಳ್ಳಿ',
    crop_potato:'ಆಲೂಗಡ್ಡೆ', crop_cotton:'ಹತ್ತಿ', crop_maize:'ಮೆಕ್ಕೆಜೋಳ', crop_sugarcane:'ಕಬ್ಬು',
    save_profile:'💾 ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ', get_advice:'ಸಲ್ಹೆ ಪಡೆಯಿರಿ', get_rec:'ಶಿಫಾರಸು ಪಡೆಯಿರಿ',
    analyse_leaf:'🔍 ಎಲೆ ವಿಶ್ಲೇಷಿಸಿ', publish_post:'📤 ಪೋಸ್ಟ್ ಪ್ರಕಟಿಸಿ',
    get_weather:'ಹವಾಮಾನ ನೋಡಿ', forum_post:'ಪೋಸ್ಟ್',
    blog:'📝 ಬ್ಲಾಗ್', publish:'📤 ಪ್ರಕಟಿಸಿ',
    delete:'ತೆಗೆದುಹಾಕಿ', lbl_approved:'ಅನುಮೋದಿಸಲಾಗಿದೆ', lbl_under_review:'ಪರಿಶೀಲನೆಯಲ್ಲಿ',
    lbl_rejected:'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ', lbl_out_of_stock:'ಸ್ಟಾಕ್ ಇಲ್ಲ', stock:'ಸ್ಟಾಕ್', sold_out:'ಮಾರಾಗಿದೆ'
  },
  mr: {
    marketplace:'🛒 बाजारपेठ', orders:'📋 ऑर्डर', education:'📚 शिक्षण',
    ai:'🤖 AI साधने', weather:'🌤️ हवामान', notifications:'🔔 सूचना',
    myproducts:'🌱 माझी उत्पादने', profile:'👤 प्रोफाइल', admin:'⚙️ प्रशासक',
    h_marketplace:'🛒 बाजारपेठ', h_orders:'📋 ऑर्डर', h_education:'📚 शिक्षण',
    h_ai:'🤖 AI साधने', h_weather:'🌤️ हवामान', h_notifications:'🔔 सूचना',
    h_myproducts:'🌱 माझी उत्पादने', h_profile:'👤 प्रोफाइल', h_admin:'⚙️ प्रशासक पॅनेल',
    blog:'📝 ब्लॉग', publish:'📤 प्रकाशित करा',
    status_confirmed:'पुष्टी केली', status_shipped:'पाठवले', status_out:'डिलिव्हरीवर',
    status_delivered:'डिलिव्हर', status_cancelled:'रद्द', status_pending:'पुष्टीसाठी प्रतीक्षा',
    track_pending:'ऑर्डर मिळाला — तयार होत आहे', track_confirmed:'पेमेंट पुष्ट — प्रक्रियेत',
    track_shipped:'गोदामातून पाठवले', track_out:'डिलिव्हरीसाठी निघाले',
    track_delivered:'तुमच्या पत्त्यावर डिलिव्हर', track_cancelled:'ऑर्डर रद्द केला',
    order_placed:'✅ "{item}" साठी ऑर्डर {method} द्वारे · ₹{total}',
    buy_now:'🛒 खरेदी करा', available:'उपलब्ध', add_product:'+ उत्पादन जोडा',
    no_data:'आत्ता कोणतेही उत्पादन उपलब्ध नाही.', out_of_stock:'📭 स्टॉक संपला',
    logout:'लॉगआउट', no_orders:'अजून कोणतेही ऑर्डर नाही.', no_notifs:'सूचना नाहीत.',
    qty:'प्रमाण', low_stock:'कमी स्टॉक', retry_sync:'🔄 पुन्हा सिंक', remove:'🗑 काढा',
    buyer:'खरेदीदार', farmer_label:'शेतकरी',
    market_trends:'📈 बाजार कल — मंडी भाव (₹/क्विंटल)',
    stat_products:'📦 उत्पादने सूचीबद्ध', stat_orders:'📋 माझे ऑर्डर',
    stat_notifs:'🔔 सूचना', stat_crops:'🌾 पिके ट्रॅक केली',
    crop_wheat:'गहू', crop_rice:'तांदूळ', crop_tomato:'टोमॅटो', crop_onion:'कांदा',
    crop_potato:'बटाटा', crop_cotton:'कापूस', crop_maize:'मका', crop_sugarcane:'ऊस',
    save_profile:'💾 प्रोफाइल सेव्हा', get_advice:'सल्ला घ्या', get_rec:'शिफारस मिळवा',
    analyse_leaf:'🔍 पान विश्लेषण', publish_post:'📤 पोस्ट प्रकाशित करा',
    get_weather:'हवामान पहा', forum_post:'पोस्ट करा',
    blog:'📝 ब्लॉग', publish:'📤 प्रकाशित करा',
    delete:'काढा', lbl_approved:'मंजूर', lbl_under_review:'आढावाधीन',
    lbl_rejected:'नाकारले', lbl_out_of_stock:'स्टॉक संपला', stock:'स्टॉक', sold_out:'विकले'
  },
  te: {
    marketplace:'🛒 మార్కెట్', orders:'📋 ఆర్డర్లు', education:'📚 విద్య',
    ai:'🤖 AI సాధనాలు', weather:'🌤️ వాతావరణం', notifications:'🔔 నోటిఫికేషన్లు',
    myproducts:'🌱 నా ఉత్పత్తులు', profile:'👤 ప్రొఫైల్', admin:'⚙️ నిర్వాహకుడు',
    h_marketplace:'🛒 మార్కెట్', h_orders:'📋 ఆర్డర్లు', h_education:'📚 విద్య',
    h_ai:'🤖 AI సాధనాలు', h_weather:'🌤️ వాతావరణం', h_notifications:'🔔 నోటిఫికేషన్లు',
    h_myproducts:'🌱 నా ఉత్పత్తులు', h_profile:'👤 ప్రొఫైల్', h_admin:'⚙️ నిర్వాహక ప్యానెల్',
    blog:'📝 బ్లాగ్', publish:'📤 ప్రచురించు',
    status_confirmed:'ధ్రువీకరించారు', status_shipped:'పంపించారు', status_out:'డెలివరీకి వెళ్ళింది',
    status_delivered:'అందించారు', status_cancelled:'రద్దు', status_pending:'ధ్రువీకరణ కోసం వేచ్చున్నారు',
    track_pending:'ఆర్డర్ అందింది — సిద్ధం చేస్తున్నారు', track_confirmed:'చెల్లింపు ధ్రువీకరించారు — ప్రక్రియలో ఉంది',
    track_shipped:'గోదాము నుండి పంపించారు', track_out:'డెలివరీకి వెళ్ళింది',
    track_delivered:'మీ చిరునామాకు అందించారు', track_cancelled:'ఆర్డర్ రద్దు చేసారు',
    order_placed:'✅ "{item}" కోసం ఆర్డర్ {method} ద్వారా · ₹{total}',
    buy_now:'🛒 కొనండి', available:'అందుబాటులో', add_product:'+ ఉత్పత్తి జోడించు',
    no_data:'ఇప్పుడు ఉత్పత్తులు అందుబాటులో లేవు.', out_of_stock:'📭 స్టాక్ లేదు',
    logout:'లాగ్ అవుట్', no_orders:'ఇంకా ఆర్డర్లు లేవు.', no_notifs:'నోటిఫికేషన్లు లేవు.',
    qty:'పరిమాణం', low_stock:'తక్కువ స్టాక్', retry_sync:'🔄 మళ్ళీ సింక్', remove:'🗑 తొలగించు',
    buyer:'కొనుగోలుదారు', farmer_label:'రైతు',
    market_trends:'📈 మార్కెట్ ట్రెండ్స్ — మండి ధరలు (₹/క్వింటాల్)',
    stat_products:'📦 ఉత్పత్తులు జాబితా', stat_orders:'📋 నా ఆర్డర్లు',
    stat_notifs:'🔔 నోటిఫికేషన్లు', stat_crops:'🌾 పంటలు ట్రాక్',
    crop_wheat:'గోధుమ', crop_rice:'వరి', crop_tomato:'టమాటా', crop_onion:'ఉల్లిపాయ',
    crop_potato:'బంగాళాదుంప', crop_cotton:'పత్తి', crop_maize:'మొక్కజొన్న', crop_sugarcane:'చెరకు',
    save_profile:'💾 ప్రొఫైల్ సేవ్', get_advice:'సలహా తీసుకో', get_rec:'సిఫారసు పొందు',
    analyse_leaf:'🔍 ఆకు విశ్లేషణ', publish_post:'📤 పోస్ట్ ప్రచురించు',
    get_weather:'వాతావరణం చూడు', forum_post:'పోస్ట్',
    blog:'📝 బ్లాగ్', publish:'📤 ప్రచురించు',
    delete:'తొలగించు', lbl_approved:'అంగీకరించారు', lbl_under_review:'సమీక్షలో',
    lbl_rejected:'తిరస్కరించారు', lbl_out_of_stock:'స్టాక్ లేదు', stock:'స్టాక్', sold_out:'అమ్మింది'
  }
};

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  const tr = translations[lang] || translations.en;
  // Update tab buttons
  ['marketplace','orders','education','ai','weather','notifications','myproducts','blog','profile','admin'].forEach(key => {
    const btn = document.getElementById('tab-' + key);
    if (btn) btn.textContent = tr[key];
  });
  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && tr[key]) el.textContent = tr[key];
  });
  // Re-render already-loaded dynamic content — no API calls
  if (allProducts.length) renderProducts(allProducts);
  renderMarketChart();
  // Always reload notifications so stored {key,data} messages re-render in new language
  loadNotifications();
}

function stopQrScan() {
  // Placeholder
}


// ── PAYMENT MODAL (multi-step) ───────────────────────────────────────────────
let _payId = null, _payName = null, _payPrice = 0, _payMethod = 'upi';

function openPayModal(id, name, price) {
  var user = getUser();
  if (user && user.role === 'farmer') {
    showMsg('msg', '❌ Farmers cannot place orders.', 'err');
    document.getElementById('msg').style.display = 'block';
    return;
  }
  _payId = id; _payName = name; _payPrice = price || 0;
  document.getElementById('payProductName').textContent = '🛒 ' + name;
  document.getElementById('codAmount').textContent = '₹' + _payPrice;
  document.getElementById('payAddr').value = '';
  document.getElementById('payQty').value = '1';
  _payMethod = 'upi';
  payGoStep1();
  document.getElementById('payModal').classList.add('open');
}

function closePayModal() {
  document.getElementById('payModal').classList.remove('open');
  _payId = null; _payName = null;
}

function _setStep(n) {
  [1,2,3].forEach(function(i) {
    document.getElementById('payStep'+i).classList.toggle('active', i===n);
    document.getElementById('pdot'+i).classList.toggle('done', i<=n);
  });
}

function payGoStep1() { _setStep(1); }

function payGoStep2() {
  var addr = document.getElementById('payAddr').value.trim();
  var err  = document.getElementById('payAddrErr');
  if (!addr) { err.style.display='block'; document.getElementById('payAddr').classList.add('err'); return; }
  err.style.display='none'; document.getElementById('payAddr').classList.remove('err');
  selectPayMethod('upi');
  _setStep(2);
}

function selectPayMethod(m) {
  _payMethod = m;
  ['upi','card','cod'].forEach(function(k) {
    document.getElementById('pm'+k.charAt(0).toUpperCase()+k.slice(1)).classList.toggle('active', k===m);
    document.getElementById(k+'Fields').style.display = k===m ? 'block' : 'none';
  });
}

function fmtCard(el) {
  var v = el.value.replace(/\D/g,'').slice(0,16);
  el.value = v.replace(/(.{4})/g,'$1 ').trim();
}
function fmtExp(el) {
  var v = el.value.replace(/\D/g,'').slice(0,4);
  if (v.length>2) v = v.slice(0,2)+'/'+v.slice(2);
  el.value = v;
}

function _validateStep2() {
  var ok = true;
  function showErr(id, msg, show) {
    var el = document.getElementById(id);
    el.style.display = show ? 'block' : 'none';
    if (show) ok = false;
  }
  if (_payMethod === 'upi') {
    var upi = document.getElementById('upiId').value.trim();
    showErr('upiErr', '', !/^[\w.\-]+@[\w]+$/.test(upi));
    document.getElementById('upiId').classList.toggle('err', !/^[\w.\-]+@[\w]+$/.test(upi));
  } else if (_payMethod === 'card') {
    var num = document.getElementById('cardNum').value.replace(/\s/g,'');
    var exp = document.getElementById('cardExp').value;
    var cvv = document.getElementById('cardCvv').value;
    showErr('cardNumErr','',num.length!==16);
    showErr('cardExpErr','',!/^\d{2}\/\d{2}$/.test(exp));
    showErr('cardCvvErr','',cvv.length!==3);
    document.getElementById('cardNum').classList.toggle('err',num.length!==16);
    document.getElementById('cardExp').classList.toggle('err',!/^\d{2}\/\d{2}$/.test(exp));
    document.getElementById('cardCvv').classList.toggle('err',cvv.length!==3);
  }
  return ok;
}

async function payGoStep3() {
  if (!_validateStep2()) return;
  _setStep(3);
  document.getElementById('payProcessing').style.display = 'block';
  document.getElementById('paySuccess').style.display    = 'none';
  document.getElementById('payError').style.display      = 'none';

  var addr = document.getElementById('payAddr').value.trim();
  var qty  = parseInt(document.getElementById('payQty').value) || 1;
  var labels = { upi:'📱 UPI', card:'💳 Card', cod:'💵 Cash on Delivery' };
  var delay  = _payMethod === 'cod' ? 800 : 2000;

  await new Promise(function(r){ setTimeout(r, delay); });

  // If no real product id (fallback data), simulate success
  if (_payId && _payId.startsWith('f') && _payId.length <= 3) {
    document.getElementById('payProcessing').style.display = 'none';
    var total = (_payPrice * qty).toFixed(2);
    var txnId = 'TXN' + Date.now().toString().slice(-8).toUpperCase();
    document.getElementById('paySuccessSub').textContent = 'Paid via ' + labels[_payMethod] + ' · Order confirmed';
    document.getElementById('payReceipt').innerHTML =
      '<div class="pay-receipt-row"><span>Product</span><span>' + _payName + '</span></div>' +
      '<div class="pay-receipt-row"><span>Qty</span><span>' + qty + '</span></div>' +
      '<div class="pay-receipt-row"><span>Method</span><span>' + labels[_payMethod] + '</span></div>' +
      '<div class="pay-receipt-row"><span>Txn ID</span><span>' + txnId + '</span></div>' +
      '<div class="pay-receipt-row"><span>Total Paid</span><span>\u20b9' + total + '</span></div>';
    document.getElementById('paySuccess').style.display = 'block';
    pushNotification({ key: 'order_placed', data: { item: _payName, method: labels[_payMethod], total: total } });
    return;
  }

  var total = (_payPrice * qty).toFixed(2);
  var txnId = 'TXN' + Date.now().toString().slice(-8).toUpperCase();

  function showPaySuccess(note) {
    document.getElementById('payProcessing').style.display = 'none';
    document.getElementById('paySuccessSub').textContent = 'Paid via ' + labels[_payMethod] + ' · ' + note;
    document.getElementById('payReceipt').innerHTML =
      '<div class="pay-receipt-row"><span>Product</span><span>' + _payName + '</span></div>' +
      '<div class="pay-receipt-row"><span>Qty</span><span>' + qty + '</span></div>' +
      '<div class="pay-receipt-row"><span>Method</span><span>' + labels[_payMethod] + '</span></div>' +
      '<div class="pay-receipt-row"><span>Txn ID</span><span>' + txnId + '</span></div>' +
      '<div class="pay-receipt-row"><span>Total Paid</span><span>\u20b9' + total + '</span></div>';
    document.getElementById('paySuccess').style.display = 'block';
    pushNotification({ key: 'order_placed', data: { item: _payName, method: labels[_payMethod], total: total } });
  }

  function saveOfflineOrder() {
    var offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
    offlineOrders.push({
      product_id: _payId, product_name: _payName, price: _payPrice,
      quantity: qty, unit: '', total: (_payPrice * qty),
      delivery_address: addr, payment_method: _payMethod,
      status: 'pending', offline: true, created_at: new Date().toISOString()
    });
    localStorage.setItem('offline_orders', JSON.stringify(offlineOrders));
  }

  try {
    var res = await apiFetch('/orders/', 'POST', {
      product_id: _payId, quantity: qty,
      delivery_address: addr, payment_method: _payMethod
    });
    var data = await res.json();
    document.getElementById('payProcessing').style.display = 'none';
    if (res.ok) {
      showPaySuccess('Order confirmed');
      loadProducts();
    } else {
      console.warn('Order API error:', data.error);
      saveOfflineOrder();
      showPaySuccess('Order confirmed');
    }
  } catch(e) {
    console.warn('Backend unreachable, saving order offline.');
    document.getElementById('payProcessing').style.display = 'none';
    saveOfflineOrder();
    showPaySuccess('Order confirmed');
  }
}

// legacy alias — keeps any old callers working
function confirmPayment() { payGoStep3(); }
function buyProduct(id, name) { openPayModal(id, name); }

// ── PROFILE ENHANCED ──────────────────────────────────────────────────────────
function uploadProfilePhoto(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const saved = JSON.parse(localStorage.getItem('agri_profile') || '{}');
    saved.photo = e.target.result;
    localStorage.setItem('agri_profile', JSON.stringify(saved));
    const el = document.getElementById('profilePhotoEl');
    if (el) el.innerHTML = '<img src="' + e.target.result + '" alt="photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
  };
  reader.readAsDataURL(file);
}

function saveProfileLocal() {
  const saved = JSON.parse(localStorage.getItem('agri_profile') || '{}');
  saved.phone   = (document.getElementById('upPhone')   || {}).value || '';
  saved.address = (document.getElementById('upAddress') || {}).value || '';
  localStorage.setItem('agri_profile', JSON.stringify(saved));
  const msg = document.getElementById('profileSaveMsg');
  if (msg) {
    msg.textContent = '✅ Profile saved!';
    msg.style.cssText = 'display:block;background:#d4edda;color:#155724;padding:.5rem .8rem;border-radius:8px;font-weight:500';
    setTimeout(() => { msg.style.display = 'none'; }, 2500);
  }
}

function renderProfile(user) {
  const roleColor = { farmer: '#f39c12', buyer: '#3498db', admin: '#27ae60' };
  const saved   = JSON.parse(localStorage.getItem('agri_profile') || '{}');
  const photo   = saved.photo   || '';
  const phone   = saved.phone   || user.phone    || '';
  const address = saved.address || user.location || '';
  document.getElementById('profileForm').innerHTML =
    '<div class="profile-photo-wrap">' +
      '<div class="profile-photo" id="profilePhotoEl">' +
        (photo ? '<img src="' + photo + '" alt="photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : (user.name||'?').charAt(0).toUpperCase()) +
      '</div>' +
      '<div>' +
        '<h3 style="margin:0 0 .3rem">' + (user.name||'Unknown') + '</h3>' +
        '<span style="background:' + (roleColor[user.role]||'#ddd') + ';color:#fff;padding:.2rem .6rem;border-radius:10px;font-size:.8rem">' + (user.role||'user') + '</span>' +
        '<div style="margin-top:.6rem">' +
          '<label style="font-size:.82rem;cursor:pointer;color:#2d6a2d;font-weight:600">📷 Change Photo' +
            '<input type="file" accept="image/*" style="display:none" onchange="uploadProfilePhoto(this)">' +
          '</label>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="field"><label>📧 Email</label><input value="' + (user.email||'') + '" disabled style="background:#f5f5f5;color:#888"></div>' +
    '<div class="field"><label>📱 Phone</label><input id="upPhone" value="' + phone + '" placeholder="Phone number"></div>' +
    '<div class="field"><label>📍 Address</label><input id="upAddress" value="' + address + '" placeholder="Your address"></div>' +
    (user.role === 'farmer' ?
      '<div class="field"><label>🌾 Farm Size</label><input id="upFarmSize" value="' + (user.farm_size||'') + '" placeholder="e.g. 5 acres"></div>' +
      '<div class="field"><label>🌱 Crops Grown</label><input id="upCrops" value="' + (user.crops||[]).join(', ') + '" placeholder="e.g. Wheat, Rice"></div>'
      : '') +
    '<div id="profileSaveMsg" style="display:none;margin-bottom:.5rem"></div>' +
    '<button onclick="saveProfileLocal()">' + t('save_profile') + '</button>';
}

// ── AI LEAF DETECTOR ──────────────────────────────────────────────────────────
const LEAF_RESULTS = [
  { healthy: false, disease: 'Fungal Leaf Spot',        tip: 'Spray Mancozeb 2.5g/L. Remove infected leaves immediately.' },
  { healthy: false, disease: 'Powdery Mildew',          tip: 'Apply Sulfur 3g/L or neem oil. Improve air circulation.' },
  { healthy: false, disease: 'Bacterial Blight',        tip: 'Use Copper oxychloride 3g/L. Avoid overhead irrigation.' },
  { healthy: false, disease: 'Possible Pest Infection', tip: 'Use organic pesticide (neem oil 5ml/L). Check undersides of leaves.' },
  { healthy: true,  disease: null, tip: 'Leaf looks healthy! Maintain regular watering and fertilisation.' },
  { healthy: true,  disease: null, tip: 'No disease detected. Continue current farming practices.' },
];

function detectLeafDisease() {
  const input = document.getElementById('leafImageInput');
  const el    = document.getElementById('leafResult');
  if (!input || !input.files.length) {
    el.innerHTML = '<p style="color:#e74c3c">Please select a leaf image first.</p>';
    return;
  }
  el.innerHTML = '<p style="color:#888">Analysing…</p>';
  setTimeout(() => {
    const r = LEAF_RESULTS[Math.floor(Math.random() * LEAF_RESULTS.length)];
    if (r.healthy) {
      el.innerHTML = '<div class="leaf-result leaf-healthy">✅ Healthy Leaf Detected<br><span style="font-weight:400;font-size:.9rem">' + r.tip + '</span></div>';
    } else {
      el.innerHTML = '<div class="leaf-result leaf-disease">⚠️ Disease Detected: ' + r.disease + '<br><span style="font-weight:400;font-size:.9rem">💡 ' + r.tip + '</span></div>';
      pushNotification('⚠️ Leaf scan: ' + r.disease + ' detected');
    }
  }, 1400);
}

// ── CROPS ─────────────────────────────────────────────────────────────────────
function loadCrops() {
  const crops = JSON.parse(localStorage.getItem('agri_crops') || '[]');
  const el = document.getElementById('cropsList');
  if (!el) return;
  if (!crops.length) { el.innerHTML = '<p class="empty-msg">No crops added yet.</p>'; return; }
  el.innerHTML = crops.map((c, i) =>
    '<div class="item-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div>' +
          '<h4>🌾 ' + c.name + '</h4>' +
          '<p>' + c.type + ' · ' + c.season + (c.area ? ' · ' + c.area + ' available' : '') + ' · Added: ' + c.added + '</p>' +
          '<span class="tag">' + c.season + '</span> ' +
          '<span class="tag" style="background:#e3f2fd;color:#1565c0">' + c.type + '</span>' +
        '</div>' +
        '<button class="btn-danger" style="padding:.3rem .6rem;font-size:.8rem" onclick="deleteCrop(' + i + ')">Delete</button>' +
      '</div>' +
    '</div>'
  ).join('');
}

function addCrop() {
  const name = document.getElementById('cropName').value.trim();
  if (!name) { alert('Please enter a crop name.'); return; }
  const crops = JSON.parse(localStorage.getItem('agri_crops') || '[]');
  const crop = {
    name,
    type:   document.getElementById('cropType').value,
    season: document.getElementById('cropSeason').value,
    area:   document.getElementById('cropArea').value || '',
    added:  new Date().toLocaleDateString()
  };
  crops.unshift(crop);
  localStorage.setItem('agri_crops', JSON.stringify(crops));
  document.getElementById('cropName').value = '';
  document.getElementById('cropArea').value = '';
  loadCrops();
  pushNotification('🌾 Crop "' + name + '" added');
}

function deleteCrop(i) {
  const crops = JSON.parse(localStorage.getItem('agri_crops') || '[]');
  crops.splice(i, 1);
  localStorage.setItem('agri_crops', JSON.stringify(crops));
  loadCrops();
}

// ── BLOG ──────────────────────────────────────────────────────────────────────
function loadBlog() {
  const posts = JSON.parse(localStorage.getItem('agri_blogs') || '[]');
  const el = document.getElementById('blogList');
  if (!el) return;
  if (!posts.length) { el.innerHTML = '<p class="empty-msg">No blog posts yet. Be the first to share!</p>'; return; }
  el.innerHTML = posts.map((b, i) =>
    '<div class="item-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div style="flex:1">' +
          '<h4>📝 ' + b.title + '</h4>' +
          '<p style="margin:.4rem 0;line-height:1.6">' + b.content + '</p>' +
          '<small style="color:#aaa">✍️ ' + b.author + ' · ' + b.date + '</small>' +
        '</div>' +
        '<button class="btn-danger" style="padding:.3rem .6rem;font-size:.8rem;margin-left:.75rem" onclick="deleteBlog(' + i + ')">Delete</button>' +
      '</div>' +
    '</div>'
  ).join('');
}

function addBlog() {
  const title   = document.getElementById('blogTitle').value.trim();
  const content = document.getElementById('blogContent').value.trim();
  if (!title || !content) { alert('Please fill in both title and content.'); return; }
  const user  = getUser();
  const posts = JSON.parse(localStorage.getItem('agri_blogs') || '[]');
  posts.unshift({ title, content, author: user ? user.name : 'Anonymous', date: new Date().toLocaleDateString() });
  localStorage.setItem('agri_blogs', JSON.stringify(posts));
  document.getElementById('blogTitle').value   = '';
  document.getElementById('blogContent').value = '';
  loadBlog();
  pushNotification('📝 Blog "' + title + '" published');
}

function deleteBlog(i) {
  const posts = JSON.parse(localStorage.getItem('agri_blogs') || '[]');
  posts.splice(i, 1);
  localStorage.setItem('agri_blogs', JSON.stringify(posts));
  loadBlog();
}

// ── MARKET TRENDS CHART ───────────────────────────────────────────────────────
const MARKET_DATA = [
  { crop: 'Wheat',     emoji: '\uD83C\uDF3E', price: 2200, prev: 2100 },
  { crop: 'Rice',      emoji: '\uD83C\uDF5A', price: 3000, prev: 2900 },
  { crop: 'Tomato',    emoji: '\uD83C\uDF45', price: 1800, prev: 2000 },
  { crop: 'Onion',     emoji: '\uD83E\uDDC5', price: 1500, prev: 1400 },
  { crop: 'Potato',    emoji: '\uD83E\uDD54', price: 1200, prev: 1300 },
  { crop: 'Cotton',    emoji: '\uD83E\uDDF5', price: 6000, prev: 5800 },
  { crop: 'Maize',     emoji: '\uD83C\uDF3D', price: 1700, prev: 1600 },
  { crop: 'Sugarcane', emoji: '\uD83C\uDF6C', price: 3500, prev: 3400 },
];

function renderMarketChart() {
  var el = document.getElementById('marketChart');
  if (!el) return;
  // Map static crop keys to translation keys
  var CROP_KEY = { Wheat:'crop_wheat', Rice:'crop_rice', Tomato:'crop_tomato', Onion:'crop_onion',
    Potato:'crop_potato', Cotton:'crop_cotton', Maize:'crop_maize', Sugarcane:'crop_sugarcane' };
  var max = Math.max.apply(null, MARKET_DATA.map(function(d){ return d.price; }));
  el.innerHTML = MARKET_DATA.map(function(d) {
    var pct = Math.max(8, Math.round((d.price / max) * 100));
    var up = d.price >= d.prev;
    var trend = up ? '\u25b2' : '\u25bc';
    var tcolor = up ? '#27ae60' : '#e74c3c';
    var barColor = up ? 'linear-gradient(180deg,#4a9e4a,#2d6a2d)' : 'linear-gradient(180deg,#e74c3c,#c0392b)';
    var cropName = t(CROP_KEY[d.crop] || d.crop);
    return '<div class="bar-col">' +
      '<div class="bar-val" style="color:' + tcolor + ';font-weight:700">' + trend + '</div>' +
      '<div class="bar" style="height:' + pct + '%;background:' + barColor + '">' +
        '<div class="bar-tooltip">\u20b9' + d.price.toLocaleString('en-IN') + '/qtl</div>' +
      '</div>' +
      '<div class="bar-label">' + d.emoji + ' ' + cropName + '</div>' +
    '</div>';
  }).join('');
}

// ── ANALYTICS WIDGETS ───────────────────────────────────────────────────────────────────
async function loadAnalyticsWidgets() {
  var el = document.getElementById('statProducts');
  if (el) el.textContent = allProducts.length || 0;

  try {
    var res2 = await apiFetch('/orders/my');
    var ords = await res2.json();
    var el2 = document.getElementById('statOrders');
    if (el2) el2.textContent = Array.isArray(ords) ? ords.length : 0;
  } catch(e) {
    var el2b = document.getElementById('statOrders');
    if (el2b) el2b.textContent = 0;
  }

  try {
    var rn = await apiFetch('/notifications/unread-count');
    var nd = await rn.json();
    var el3 = document.getElementById('statNotifs');
    if (el3) el3.textContent = nd.count || 0;
    updateNotifBadge(nd.count || 0);
  } catch(e) {
    var el3b = document.getElementById('statNotifs');
    if (el3b) el3b.textContent = JSON.parse(localStorage.getItem('agri_notifs') || '[]').length;
  }

  var crops = JSON.parse(localStorage.getItem('agri_crops') || '[]');
  var el4 = document.getElementById('statCrops');
  if (el4) el4.textContent = crops.length;
}

// ── SMART AI RECOMMENDATIONS ──────────────────────────────────────────────────
const SMART_DB = {
  // Crops
  wheat:      { fertilizer:'Urea 50kg/acre at sowing; DAP 25kg/acre at tillering', irrigation:'Irrigate at crown root, tillering, jointing & grain fill stages', pest:'Watch for rust & aphids; spray Propiconazole 0.1% for rust' },
  rice:       { fertilizer:'NPK 80:40:40 kg/ha; split urea in 3 doses', irrigation:'Maintain 2–5cm standing water; drain 10 days before harvest', pest:'Use Carbofuran 3G for stem borer; Monocrotophos for BPH' },
  tomato:     { fertilizer:'FYM 25t/ha + NPK 120:60:60; foliar spray of boron', irrigation:'Drip irrigation 4–6L/plant/day; avoid waterlogging', pest:'Neem oil 5ml/L for whitefly; Spinosad for fruit borer' },
  maize:      { fertilizer:'NPK 120:60:40 kg/ha; top-dress urea at knee height', irrigation:'Critical at tasseling & grain fill; avoid water stress', pest:'Spray Chlorpyrifos 2ml/L for fall armyworm' },
  onion:      { fertilizer:'NPK 100:50:50 + sulphur 20kg/ha', irrigation:'Stop irrigation 2 weeks before harvest', pest:'Mancozeb 2.5g/L for purple blotch; Dimethoate for thrips' },
  potato:     { fertilizer:'NPK 150:100:100 + FYM 25t/ha', irrigation:'Furrow irrigation every 7–10 days; avoid excess moisture', pest:'Ridomil for late blight; Imidacloprid for aphids' },
  cotton:     { fertilizer:'NPK 120:60:60; micronutrient mix at squaring', irrigation:'Drip preferred; critical at flowering & boll development', pest:'Pheromone traps for bollworm; Bt spray for early infestation' },
  sugarcane:  { fertilizer:'NPK 250:60:120 kg/ha; split in 3 doses', irrigation:'Furrow irrigation every 10–15 days; avoid waterlogging', pest:'Carbofuran 3G for early shoot borer; Trichoderma for red rot' },
  mango:      { fertilizer:'NPK 1:0.5:1 kg/tree/year; micronutrients post-harvest', irrigation:'Withhold water 2 months before flowering', pest:'Copper oxychloride for anthracnose; Imidacloprid for hoppers' },
  // Conditions
  'dry soil':       { fertilizer:'Add organic matter/compost to improve water retention', irrigation:'Switch to drip irrigation; mulch to reduce evaporation', pest:'Dry conditions favour spider mites — spray water + neem oil' },
  'yellowing':      { fertilizer:'Apply urea 20kg/acre for nitrogen deficiency; check soil pH', irrigation:'Ensure consistent moisture; avoid waterlogging', pest:'Check for aphids or virus vectors; spray Imidacloprid 0.5ml/L' },
  'brown spots':    { fertilizer:'Foliar spray of potassium nitrate 1%', irrigation:'Avoid overhead irrigation; water at base only', pest:'Spray Mancozeb 2.5g/L or Copper oxychloride 3g/L' },
  'wilting':        { fertilizer:'Reduce nitrogen; add potassium to strengthen cell walls', irrigation:'Check drainage; avoid waterlogging causing root rot', pest:'Drench with Carbendazim 1g/L for Fusarium wilt' },
  'pest':           { fertilizer:'Balanced NPK reduces pest susceptibility', irrigation:'Avoid excess moisture that attracts pests', pest:'Neem oil 5ml/L as broad-spectrum; introduce beneficial insects' },
};

function getSmartRec() {
  var input = document.getElementById('smartInput').value.trim().toLowerCase();
  var el    = document.getElementById('smartResult');
  if (!input) { el.innerHTML = '<p style="color:#e74c3c;margin-top:.5rem">Please enter a crop or condition.</p>'; return; }

  // Find best match
  var match = null;
  var keys  = Object.keys(SMART_DB);
  for (var i = 0; i < keys.length; i++) {
    if (input.includes(keys[i]) || keys[i].includes(input)) { match = SMART_DB[keys[i]]; break; }
  }

  if (!match) {
    el.innerHTML = '<div class="ai-rec-card"><h5>🌱 General Recommendation for: ' + input + '</h5>' +
      '<div class="ai-rec-row"><span class="ai-rec-icon">🧪</span><span><strong>Fertilizer:</strong> Apply balanced NPK (10:10:10) as base dose. Test soil pH before application.</span></div>' +
      '<div class="ai-rec-row"><span class="ai-rec-icon">💧</span><span><strong>Irrigation:</strong> Maintain consistent soil moisture. Drip irrigation recommended for water efficiency.</span></div>' +
      '<div class="ai-rec-row"><span class="ai-rec-icon">🐛</span><span><strong>Pest Control:</strong> Neem oil spray (5ml/L) as preventive measure. Monitor weekly for early detection.</span></div>' +
      '</div>';
    return;
  }

  el.innerHTML = '<div class="ai-rec-card">' +
    '<h5>🧠 Smart Recommendations for: ' + input.charAt(0).toUpperCase() + input.slice(1) + '</h5>' +
    '<div class="ai-rec-row"><span class="ai-rec-icon">🧪</span><span><strong>Fertilizer:</strong> ' + match.fertilizer + '</span></div>' +
    '<div class="ai-rec-row"><span class="ai-rec-icon">💧</span><span><strong>Irrigation:</strong> ' + match.irrigation + '</span></div>' +
    '<div class="ai-rec-row"><span class="ai-rec-icon">🐛</span><span><strong>Pest Control:</strong> ' + match.pest + '</span></div>' +
    '</div>';
}


