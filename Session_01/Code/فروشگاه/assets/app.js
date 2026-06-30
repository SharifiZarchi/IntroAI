/* ============================================================
   دیجی‌مارکت — منطق برنامه (روتر، نماها، سبد خرید، حساب کاربری)
   ============================================================ */
const { CATEGORIES, SLIDES, BRANDS, PRODUCTS } = window.STORE_DATA;

/* ---------- ابزارهای کمکی ---------- */
const fa = n => Number(n).toLocaleString('fa-IR');
const money = n => fa(n) + ' تومان';
const byId = id => PRODUCTS.find(p => p.id === Number(id));
const catLabel = key => (CATEGORIES.find(c => c.key === key) || {}).label || key;
const $ = sel => document.querySelector(sel);
const SHIP_COST = 89000, FREE_SHIP_MIN = 5000000;

/* ---------- مدیریت حالت با localStorage ---------- */
const Store = {
  get cart()  { return JSON.parse(localStorage.getItem('dm_cart')  || '{}'); },
  set cart(v) { localStorage.setItem('dm_cart', JSON.stringify(v)); },
  get fav()   { return JSON.parse(localStorage.getItem('dm_fav')   || '[]'); },
  set fav(v)  { localStorage.setItem('dm_fav', JSON.stringify(v)); },
  get user()  { return JSON.parse(localStorage.getItem('dm_user')  || 'null'); },
  set user(v) { localStorage.setItem('dm_user', JSON.stringify(v)); },
  get orders(){ return JSON.parse(localStorage.getItem('dm_orders')|| '[]'); },
  set orders(v){ localStorage.setItem('dm_orders', JSON.stringify(v)); },
};

/* ---------- محاسبات سبد خرید ---------- */
function cartEntries() {
  const c = Store.cart;
  return Object.keys(c).map(id => ({ p: byId(id), q: c[id] })).filter(e => e.p);
}
function cartCount()   { return cartEntries().reduce((s, e) => s + e.q, 0); }
function subtotal()    { return cartEntries().reduce((s, e) => s + e.p.price * e.q, 0); }
function discountSum() { return cartEntries().reduce((s, e) => s + (e.p.old ? (e.p.old - e.p.price) * e.q : 0), 0); }
function shipping()    { const st = subtotal(); return st === 0 || st >= FREE_SHIP_MIN ? 0 : SHIP_COST; }
function grandTotal()  { return subtotal() + shipping(); }

function addToCart(id, qty = 1, silent = false) {
  const c = Store.cart;
  c[id] = (c[id] || 0) + qty;
  Store.cart = c;
  refreshChrome();
  if (!silent) toast(`«${byId(id).name.slice(0, 30)}…» به سبد اضافه شد ✅`);
}
function setQty(id, q) {
  const c = Store.cart;
  if (q <= 0) delete c[id]; else c[id] = q;
  Store.cart = c;
  refreshChrome();
  rerenderCartViews();
}
function removeItem(id) {
  const c = Store.cart; delete c[id]; Store.cart = c;
  refreshChrome(); rerenderCartViews();
}
function rerenderCartViews() {
  renderDrawer();
  if (location.hash.startsWith('#/cart')) render();
}

/* ---------- علاقه‌مندی‌ها ---------- */
function toggleFav(id, ev) {
  if (ev) ev.stopPropagation();
  id = Number(id);
  let f = Store.fav;
  if (f.includes(id)) { f = f.filter(x => x !== id); toast('از علاقه‌مندی‌ها حذف شد'); }
  else { f.push(id); toast('به علاقه‌مندی‌ها اضافه شد ❤️'); }
  Store.fav = f;
  refreshChrome();
  // به‌روزرسانی قلب‌های روی صفحه بدون رندر مجدد کامل
  document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(b => b.classList.toggle('on', Store.fav.includes(id)));
  if (location.hash.startsWith('#/favorites')) render();
}
const isFav = id => Store.fav.includes(Number(id));

/* ============================================================
   اجزای ثابت رابط (هدر، ناوبری، شمارنده‌ها)
   ============================================================ */
function refreshChrome() {
  $('#cartCount').textContent = fa(cartCount());
  $('#favCount').textContent = fa(Store.fav.length);
  const u = Store.user;
  $('#loginBtn').innerHTML = u
    ? `<span>👤 ${u.name || u.phone}</span>`
    : `<span>ورود | ثبت‌نام</span>`;
}

function renderCatNav() {
  const active = currentRoute().name === 'category' ? currentRoute().param : '';
  $('#catnav').innerHTML =
    CATEGORIES.map(c => `<button class="${c.key === active ? 'active' : ''}" onclick="go('#/category/${c.key}')">${c.icon} ${c.label}</button>`).join('') +
    `<button class="amazing-link" onclick="go('#/amazing')">🔥 پیشنهاد شگفت‌انگیز</button>`;
}

/* ============================================================
   کارت کالا (قابل استفاده مجدد)
   ============================================================ */
function productCard(p) {
  const off = p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
  return `<div class="card" onclick="go('#/product/${p.id}')">
    <div class="thumb">
      <span class="type-tag ${p.type === 'good' ? 'tag-good' : 'tag-service'}">${p.type === 'good' ? 'کالا' : 'خدمت'}</span>
      ${off ? `<span class="off-badge">٪${fa(off)}</span>` : ''}
      <button class="fav-btn ${isFav(p.id) ? 'on' : ''}" data-id="${p.id}" onclick="toggleFav(${p.id},event)" title="علاقه‌مندی">${isFav(p.id) ? '❤️' : '🤍'}</button>
      ${p.icon}
    </div>
    <h3>${p.name}</h3>
    <div class="rating"><span class="s">★</span> ${fa(p.rating)} <span style="color:var(--line2)">|</span> ${fa(p.ratingCount)} نظر</div>
    <div class="price-block">
      ${p.old ? `<div class="old-price">${money(p.old)}</div>` : '<div style="height:18px"></div>'}
      <div class="price-line"><span class="price">${fa(p.price)}<span class="unit">تومان</span></span></div>
      ${p.stock <= 5 && p.type === 'good' ? `<div class="stock-low">تنها ${fa(p.stock)} عدد در انبار</div>` : ''}
      <button class="add-btn" onclick="addToCart(${p.id});event.stopPropagation()">${p.type === 'service' ? 'رزرو خدمت' : 'افزودن به سبد'}</button>
    </div>
  </div>`;
}
const productGrid = list => list.length
  ? `<div class="grid">${list.map(productCard).join('')}</div>`
  : `<div class="empty-state"><div class="big">🔍</div><h3>موردی یافت نشد</h3><p>فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید.</p></div>`;

/* ============================================================
   روتر
   ============================================================ */
function currentRoute() {
  const h = (location.hash || '#/').slice(1); // مثل /category/digital
  const parts = h.split('?')[0].split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(h.split('?')[1] || ''));
  if (parts.length === 0)            return { name: 'home' };
  if (parts[0] === 'category')       return { name: 'category', param: parts[1] };
  if (parts[0] === 'product')        return { name: 'product', param: parts[1] };
  if (parts[0] === 'cart')           return { name: 'cart' };
  if (parts[0] === 'checkout')       return { name: 'checkout' };
  if (parts[0] === 'favorites')      return { name: 'favorites' };
  if (parts[0] === 'profile')        return { name: 'profile', param: parts[1] };
  if (parts[0] === 'amazing')        return { name: 'amazing' };
  if (parts[0] === 'search')         return { name: 'search', query };
  return { name: 'home' };
}
function go(hash) { location.hash = hash; }

function render() {
  const r = currentRoute();
  const app = $('#app');
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  switch (r.name) {
    case 'home':      app.innerHTML = viewHome(); afterHome(); break;
    case 'category':  app.innerHTML = viewListing(r.param); afterListing(r.param); break;
    case 'amazing':   app.innerHTML = viewListing('__amazing__'); afterListing('__amazing__'); break;
    case 'search':    app.innerHTML = viewListing('__search__', r.query.q || ''); afterListing('__search__', r.query.q || ''); break;
    case 'product':   app.innerHTML = viewProduct(r.param); afterProduct(r.param); break;
    case 'cart':      app.innerHTML = viewCart(); break;
    case 'checkout':  app.innerHTML = viewCheckout(); afterCheckout(); break;
    case 'favorites': app.innerHTML = viewFavorites(); break;
    case 'profile':   app.innerHTML = viewProfile(r.param || 'orders'); break;
    default:          app.innerHTML = viewHome(); afterHome();
  }
  renderCatNav();
}

/* ============================================================
   نمای صفحه اصلی
   ============================================================ */
function viewHome() {
  const amazing = PRODUCTS.filter(p => p.amazing);
  const bestSell = [...PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 10);
  const digital = PRODUCTS.filter(p => p.cat === 'digital').slice(0, 10);
  const home = PRODUCTS.filter(p => p.cat === 'home').slice(0, 10);

  return `
  <div class="hero">
    <div class="slides" id="slides">
      ${SLIDES.map(s => `
        <div class="slide" style="background:${s.bg}">
          <div>
            <h1>${s.title}</h1>
            <p>${s.sub}</p>
            <a class="cta" onclick="go('${s.link}')">${s.cta} ←</a>
          </div>
          <div class="big-emoji">${s.emoji}</div>
        </div>`).join('')}
    </div>
    <button class="slide-arrow prev" onclick="moveSlide(-1)">›</button>
    <button class="slide-arrow next" onclick="moveSlide(1)">‹</button>
    <div class="slide-dots" id="slideDots">
      ${SLIDES.map((_, i) => `<button class="${i === 0 ? 'active' : ''}" onclick="goSlide(${i})"></button>`).join('')}
    </div>
  </div>

  <div class="quick-cats">
    ${CATEGORIES.map(c => `
      <div class="qcat" onclick="go('#/category/${c.key}')">
        <div class="ic" style="background:${c.color}1a;color:${c.color}">${c.icon}</div>
        <span>${c.label}</span>
      </div>`).join('')}
    <div class="qcat" onclick="go('#/amazing')">
      <div class="ic" style="background:#ef40561a;color:var(--red)">🔥</div>
      <span>شگفت‌انگیز</span>
    </div>
  </div>

  <div class="amazing-strip">
    <div class="amazing-side">
      <div class="lbl">پیشنهاد شگفت‌انگیز</div>
      <div class="em">🔥</div>
      <div class="countdown" id="countdown"></div>
      <a onclick="go('#/amazing')">مشاهده همه</a>
    </div>
    <div class="amazing-track">
      ${amazing.map(productCard).join('')}
    </div>
  </div>

  <div class="sec-head"><h2>🔝 پرفروش‌ترین‌ها</h2><a class="more" onclick="go('#/category/digital')">مشاهده همه ←</a></div>
  ${productGrid(bestSell)}

  <div class="sec-head"><h2>📱 کالای دیجیتال</h2><a class="more" onclick="go('#/category/digital')">مشاهده همه ←</a></div>
  ${productGrid(digital)}

  <div class="sec-head"><h2>🏡 لوازم خانگی</h2><a class="more" onclick="go('#/category/home')">مشاهده همه ←</a></div>
  ${productGrid(home)}
  `;
}

/* اسلایدر */
let slideIdx = 0, slideTimer = null;
function goSlide(i) {
  slideIdx = (i + SLIDES.length) % SLIDES.length;
  const el = $('#slides'); if (!el) return;
  el.style.transform = `translateX(${slideIdx * 100}%)`;
  document.querySelectorAll('#slideDots button').forEach((b, k) => b.classList.toggle('active', k === slideIdx));
}
function moveSlide(d) { goSlide(slideIdx + d); }
function afterHome() {
  slideIdx = 0;
  clearInterval(slideTimer);
  slideTimer = setInterval(() => moveSlide(1), 5000);
  startCountdown();
}
/* شمارش معکوس تا پایان روز */
function startCountdown() {
  const el = $('#countdown'); if (!el) return;
  let secs = 8 * 3600 + 42 * 60 + 15; // مقدار نمایشی ثابت
  const tick = () => {
    if (!$('#countdown')) return;
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    el.innerHTML = `<div>${fa(s)}</div><div>:</div><div>${fa(m)}</div><div>:</div><div>${fa(h)}</div>`;
    secs = secs > 0 ? secs - 1 : 8 * 3600;
  };
  tick();
  clearInterval(window._cd); window._cd = setInterval(tick, 1000);
}

/* ============================================================
   نمای لیست کالا (دسته‌بندی / شگفت‌انگیز / جستجو) + فیلتر و مرتب‌سازی
   ============================================================ */
let listState = { sort: 'default', brands: [], onlyDiscount: false, onlyAvailable: false, maxPrice: null };

function viewListing(key, searchQ = '') {
  let title, base;
  if (key === '__amazing__') { title = '🔥 پیشنهادهای شگفت‌انگیز'; base = PRODUCTS.filter(p => p.amazing); }
  else if (key === '__search__') { title = `نتایج جستجو برای «${searchQ}»`; const t = searchQ.toLowerCase(); base = PRODUCTS.filter(p => p.name.toLowerCase().includes(t) || p.brand.toLowerCase().includes(t)); }
  else { title = catLabel(key); base = PRODUCTS.filter(p => p.cat === key); }

  const brandsHere = [...new Set(base.map(p => p.brand))];
  const prices = base.map(p => p.price);
  const maxP = Math.max(...prices, 1000000);

  return `
  <div class="breadcrumb">
    <a onclick="go('#/')">خانه</a><span>/</span><span>${title}</span>
  </div>
  <div class="sec-head"><h2>${title}</h2></div>
  <button class="filter-toggle" onclick="document.querySelector('.filters').classList.toggle('mobile-show')">⚙️ فیلترها</button>
  <div class="listing">
    <aside class="filters">
      <h3>فیلترها</h3>
      <div class="filter-group">
        <label class="chk"><input type="checkbox" id="fDiscount" ${listState.onlyDiscount ? 'checked' : ''} onchange="onFilterChange()"> فقط تخفیف‌دار</label>
        <label class="chk"><input type="checkbox" id="fAvailable" ${listState.onlyAvailable ? 'checked' : ''} onchange="onFilterChange()"> فقط موجود</label>
      </div>
      <div class="filter-group">
        <h4>برند</h4>
        ${brandsHere.map(b => `<label class="chk"><input type="checkbox" class="fBrand" value="${b}" ${listState.brands.includes(b) ? 'checked' : ''} onchange="onFilterChange()"> ${b}</label>`).join('')}
      </div>
      <div class="filter-group">
        <h4>حداکثر قیمت</h4>
        <input type="range" class="price-range" id="fPrice" min="0" max="${maxP}" step="100000" value="${listState.maxPrice ?? maxP}" oninput="onPriceInput(${maxP})">
        <div class="range-vals"><span>۰</span><span id="priceVal">${money(listState.maxPrice ?? maxP)}</span></div>
      </div>
      <button class="clear-filters" onclick="clearFilters()">حذف فیلترها</button>
    </aside>
    <div>
      <div class="toolbar">
        <span class="sort-label">مرتب‌سازی:</span>
        ${[['default', 'پیش‌فرض'], ['cheap', 'ارزان‌ترین'], ['expensive', 'گران‌ترین'], ['rating', 'بیشترین امتیاز'], ['sold', 'پرفروش‌ترین']]
          .map(([v, l]) => `<button class="sort-opt ${listState.sort === v ? 'active' : ''}" onclick="setSort('${v}')">${l}</button>`).join('')}
        <span class="res" id="resInfo"></span>
      </div>
      <div id="listGrid"></div>
    </div>
  </div>`;
}

function applyListFilters(base) {
  let list = base.slice();
  if (listState.onlyDiscount) list = list.filter(p => p.old);
  if (listState.onlyAvailable) list = list.filter(p => p.stock > 0);
  if (listState.brands.length) list = list.filter(p => listState.brands.includes(p.brand));
  if (listState.maxPrice != null) list = list.filter(p => p.price <= listState.maxPrice);
  switch (listState.sort) {
    case 'cheap':     list.sort((a, b) => a.price - b.price); break;
    case 'expensive': list.sort((a, b) => b.price - a.price); break;
    case 'rating':    list.sort((a, b) => b.rating - a.rating); break;
    case 'sold':      list.sort((a, b) => b.sold - a.sold); break;
  }
  return list;
}
let _listBase = [];
function afterListing(key, searchQ = '') {
  if (key === '__amazing__') _listBase = PRODUCTS.filter(p => p.amazing);
  else if (key === '__search__') { const t = searchQ.toLowerCase(); _listBase = PRODUCTS.filter(p => p.name.toLowerCase().includes(t) || p.brand.toLowerCase().includes(t)); }
  else _listBase = PRODUCTS.filter(p => p.cat === key);
  renderList();
}
function renderList() {
  const list = applyListFilters(_listBase);
  const g = $('#listGrid'); if (!g) return;
  g.innerHTML = productGrid(list);
  $('#resInfo').textContent = `${fa(list.length)} کالا`;
}
function onFilterChange() {
  listState.onlyDiscount = $('#fDiscount').checked;
  listState.onlyAvailable = $('#fAvailable').checked;
  listState.brands = [...document.querySelectorAll('.fBrand:checked')].map(c => c.value);
  renderList();
}
function onPriceInput(maxP) {
  listState.maxPrice = Number($('#fPrice').value);
  $('#priceVal').textContent = money(listState.maxPrice);
  renderList();
}
function setSort(v) { listState.sort = v; document.querySelectorAll('.sort-opt').forEach(b => b.classList.toggle('active', b.textContent.trim() === ({default:'پیش‌فرض',cheap:'ارزان‌ترین',expensive:'گران‌ترین',rating:'بیشترین امتیاز',sold:'پرفروش‌ترین'})[v])); renderList(); }
function clearFilters() { listState = { sort: 'default', brands: [], onlyDiscount: false, onlyAvailable: false, maxPrice: null }; render(); }

/* ============================================================
   نمای جزئیات کالا
   ============================================================ */
let pdpState = { color: 0, qty: 1, img: 0, tab: 'desc', starPick: 0 };

function viewProduct(id) {
  const p = byId(id);
  if (!p) return `<div class="empty-state"><div class="big">❓</div><h3>کالا یافت نشد</h3><a class="go-btn" onclick="go('#/')">بازگشت به خانه</a></div>`;
  pdpState = { color: 0, qty: 1, img: 0, tab: 'desc', starPick: 0 };
  const off = p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
  const related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 5);

  return `
  <div class="breadcrumb">
    <a onclick="go('#/')">خانه</a><span>/</span>
    <a onclick="go('#/category/${p.cat}')">${catLabel(p.cat)}</a><span>/</span>
    <span>${p.name.slice(0, 40)}…</span>
  </div>
  <div class="pdp">
    <div class="pdp-gallery">
      <div class="pdp-main-img" id="pdpMainImg">${p.gallery[0]}</div>
      <div class="pdp-thumbs">
        ${p.gallery.map((g, i) => `<button class="${i === 0 ? 'active' : ''}" onclick="pdpSetImg(${i},'${g}')">${g}</button>`).join('')}
      </div>
    </div>

    <div class="pdp-info">
      <h1>${p.name}</h1>
      <div class="brand-row">
        <span>برند: <b class="b">${p.brand}</b></span>
        <span class="type-tag ${p.type === 'good' ? 'tag-good' : 'tag-service'}">${p.type === 'good' ? 'کالا' : 'خدمت'}</span>
        <span class="pdp-rating"><span class="s">★</span> ${fa(p.rating)} (${fa(p.ratingCount)} امتیاز)</span>
        <span>🛍️ ${fa(p.sold)} فروش</span>
      </div>
      ${p.colors.length ? `<div><b style="font-size:13px">${p.type === 'service' ? 'نوع خدمت:' : 'رنگ / مدل:'}</b>
        <div class="colors">${p.colors.map((c, i) => `<div class="color-opt ${i === 0 ? 'active' : ''}" onclick="pdpSetColor(${i})">${c}</div>`).join('')}</div></div>` : ''}
      <ul class="feature-list">${p.features.map(f => `<li>${f}</li>`).join('')}</ul>
      <p style="font-size:13.5px;color:var(--muted);line-height:2">${p.desc}</p>
    </div>

    <div class="buy-box">
      <div class="seller">🏬 فروشنده: دیجی‌مارکت</div>
      <div class="guarantee"><span class="ic">✓</span> ${p.warranty || 'تضمین اصالت کالا'}</div>
      <div class="guarantee"><span class="ic">✓</span> ضمانت بازگشت ۷ روزه</div>
      <div class="guarantee"><span class="ic">✓</span> ${shipping() === 0 || p.price >= FREE_SHIP_MIN ? 'ارسال رایگان' : 'ارسال سریع'}</div>
      <div class="price-final">
        ${p.old ? `<div class="old-price">${money(p.old)} ${off ? `<span class="off-badge" style="position:static;display:inline-grid">٪${fa(off)}</span>` : ''}</div>` : ''}
        <div class="now">${fa(p.price)}<span class="unit" style="font-size:13px;color:var(--muted)">تومان</span></div>
      </div>
      ${p.stock > 0 ? `
        <div class="qty-inline">
          <button onclick="pdpQty(1)">+</button>
          <span id="pdpQty">۱</span>
          <button onclick="pdpQty(-1)">−</button>
        </div>
        <button class="add-btn" onclick="pdpAdd(${p.id})">${p.type === 'service' ? 'رزرو خدمت' : 'افزودن به سبد خرید'}</button>
      ` : `<button class="add-btn" disabled style="background:#ccc;cursor:not-allowed">ناموجود</button>`}
      <button class="ghost-btn" style="margin-top:8px" onclick="toggleFav(${p.id})">${isFav(p.id) ? '❤️ در علاقه‌مندی‌ها' : '🤍 افزودن به علاقه‌مندی'}</button>
    </div>

    <!-- تب‌ها -->
    <div class="pdp-tabs">
      <div class="tab-head">
        <button class="active" data-tab="desc" onclick="pdpTab('desc')">معرفی</button>
        <button data-tab="specs" onclick="pdpTab('specs')">مشخصات فنی</button>
        <button data-tab="reviews" onclick="pdpTab('reviews')">دیدگاه‌ها (${fa(p.reviews.length)})</button>
      </div>
      <div class="tab-pane active" id="tab-desc"><p>${p.desc}</p></div>
      <div class="tab-pane" id="tab-specs">
        <table class="spec-table">
          ${Object.entries(p.specs).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
        </table>
      </div>
      <div class="tab-pane" id="tab-reviews">${reviewsHTML(p)}</div>
    </div>
  </div>

  <div class="sec-head"><h2>کالاهای مشابه</h2></div>
  ${productGrid(related)}
  `;
}

function reviewsHTML(p) {
  const avg = p.rating;
  const list = p.reviews.length
    ? p.reviews.map(r => `
      <div class="rev">
        <div class="rev-head"><span class="u">${r.user}</span><span class="d">${r.date}</span></div>
        <div class="rev-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        <p>${r.text}</p>
        <span class="like" onclick="likeReview(this)">👍 مفید بود (${fa(r.likes)})</span>
      </div>`).join('')
    : `<p style="color:var(--muted);text-align:center;padding:20px">هنوز دیدگاهی ثبت نشده است. اولین نفر باشید!</p>`;
  return `
    <div class="review-summary">
      <div class="big-score"><div class="n">${fa(avg)}</div><div style="color:var(--star)">${'★'.repeat(Math.round(avg))}</div><div style="font-size:12px;color:var(--muted)">از ${fa(p.ratingCount)} نظر</div></div>
      <div style="flex:1;font-size:13px;color:var(--muted)">دیدگاه خریداران درباره این ${p.type === 'service' ? 'خدمت' : 'کالا'} را در زیر بخوانید و نظر خود را ثبت کنید.</div>
    </div>
    ${list}
    <div class="add-review">
      <b style="font-size:14px">ثبت دیدگاه شما</b>
      <div class="star-pick" id="starPick">${[1, 2, 3, 4, 5].map(i => `<span onclick="pickStar(${i})">★</span>`).join('')}</div>
      <textarea id="revText" rows="3" placeholder="تجربه خود را با دیگران به اشتراک بگذارید..."></textarea>
      <button class="primary-btn" style="width:auto;padding:10px 24px;margin-top:10px" onclick="submitReview(${p.id})">ثبت دیدگاه</button>
    </div>`;
}

function afterProduct() { /* state already reset in viewProduct */ }
function pdpSetImg(i, g) { pdpState.img = i; $('#pdpMainImg').textContent = g; document.querySelectorAll('.pdp-thumbs button').forEach((b, k) => b.classList.toggle('active', k === i)); }
function pdpSetColor(i) { pdpState.color = i; document.querySelectorAll('.color-opt').forEach((c, k) => c.classList.toggle('active', k === i)); }
function pdpQty(d) { pdpState.qty = Math.max(1, pdpState.qty + d); $('#pdpQty').textContent = fa(pdpState.qty); }
function pdpAdd(id) { addToCart(id, pdpState.qty); }
function pdpTab(t) {
  pdpState.tab = t;
  document.querySelectorAll('.tab-head button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + t));
}
function likeReview(el) { const m = el.textContent.match(/\d|[۰-۹]/); el.innerHTML = '👍 مفید بود (' + fa((parseInt(el.dataset.l || '0') + 1)) + ')'; el.dataset.l = (parseInt(el.dataset.l || '0') + 1); }
function pickStar(i) { pdpState.starPick = i; document.querySelectorAll('#starPick span').forEach((s, k) => s.classList.toggle('on', k < i)); }
function submitReview(id) {
  if (!Store.user) { toast('برای ثبت دیدگاه ابتدا وارد شوید'); openLogin(); return; }
  const text = $('#revText').value.trim();
  if (pdpState.starPick === 0) { toast('لطفاً امتیاز خود را انتخاب کنید'); return; }
  if (text.length < 3) { toast('متن دیدگاه را وارد کنید'); return; }
  const p = byId(id);
  p.reviews.unshift({ user: Store.user.name || 'کاربر دیجی‌مارکت', rating: pdpState.starPick, date: 'همین حالا', text, likes: 0 });
  toast('دیدگاه شما ثبت شد ✅');
  render();
}

/* ============================================================
   نمای سبد خرید (صفحه کامل)
   ============================================================ */
function viewCart() {
  const entries = cartEntries();
  if (!entries.length) {
    return `<div class="empty-state"><div class="big">🛒</div><h3>سبد خرید شما خالی است</h3><p>هنوز کالایی به سبد اضافه نکرده‌اید.</p><a class="go-btn" onclick="go('#/')">شروع خرید</a></div>`;
  }
  return `
  <div class="breadcrumb"><a onclick="go('#/')">خانه</a><span>/</span><span>سبد خرید</span></div>
  <div class="sec-head"><h2>🛒 سبد خرید (${fa(cartCount())} کالا)</h2></div>
  <div class="cart-page">
    <div class="cart-list">
      ${entries.map(e => {
        const off = e.p.old ? Math.round((1 - e.p.price / e.p.old) * 100) : 0;
        return `<div class="cart-row">
          <div class="cr-thumb" onclick="go('#/product/${e.p.id}')">${e.p.icon}</div>
          <div class="cr-info">
            <h4 onclick="go('#/product/${e.p.id}')">${e.p.name}</h4>
            <div class="cr-meta">${e.p.brand} ${e.p.colors.length ? '• ' + e.p.colors[0] : ''} ${off ? `• <span style="color:var(--red)">٪${fa(off)} تخفیف</span>` : ''}</div>
            <div class="cr-bottom">
              <div class="q-ctrl">
                <button onclick="setQty(${e.p.id}, ${e.q + 1})">+</button>
                <span>${fa(e.q)}</span>
                <button onclick="setQty(${e.p.id}, ${e.q - 1})">−</button>
              </div>
              <button class="rm" onclick="removeItem(${e.p.id})">🗑 حذف</button>
              <span style="margin-right:auto;font-weight:700">${money(e.p.price * e.q)}</span>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${summaryBox(true)}
  </div>`;
}

function summaryBox(withCheckout) {
  const st = subtotal(), sh = shipping(), ds = discountSum();
  return `
  <div class="cart-summary">
    <h3>خلاصه سفارش</h3>
    <div class="sumline"><span>قیمت کالاها (${fa(cartCount())})</span><span>${money(st + ds)}</span></div>
    ${ds ? `<div class="sumline discount"><span>سود شما از خرید</span><span>${money(ds)}−</span></div>` : ''}
    <div class="sumline"><span>هزینه ارسال</span><span>${sh === 0 ? '<span class="free-ship">رایگان</span>' : money(sh)}</span></div>
    ${st < FREE_SHIP_MIN && st > 0 ? `<div style="font-size:11.5px;color:var(--muted);background:var(--bg);padding:8px;border-radius:8px;margin:6px 0">${money(FREE_SHIP_MIN - st)} تا ارسال رایگان باقی مانده است.</div>` : ''}
    <div class="sumline total"><span>مبلغ قابل پرداخت</span><span>${money(st + sh)}</span></div>
    ${withCheckout ? `<button class="checkout-btn" onclick="goCheckout()">ادامه و ثبت سفارش</button>` : ''}
  </div>`;
}

/* ============================================================
   نمای علاقه‌مندی‌ها
   ============================================================ */
function viewFavorites() {
  const list = Store.fav.map(byId).filter(Boolean);
  if (!list.length) return `<div class="empty-state"><div class="big">❤️</div><h3>لیست علاقه‌مندی‌ها خالی است</h3><p>کالاهای مورد علاقه خود را با زدن آیکن قلب ذخیره کنید.</p><a class="go-btn" onclick="go('#/')">مشاهده کالاها</a></div>`;
  return `
  <div class="breadcrumb"><a onclick="go('#/')">خانه</a><span>/</span><span>علاقه‌مندی‌ها</span></div>
  <div class="sec-head"><h2>❤️ علاقه‌مندی‌های من (${fa(list.length)})</h2></div>
  ${productGrid(list)}`;
}

/* ============================================================
   نمای پروفایل / سفارش‌ها
   ============================================================ */
function viewProfile(tab) {
  const u = Store.user;
  if (!u) { setTimeout(openLogin, 50); return `<div class="empty-state"><div class="big">👤</div><h3>برای مشاهده حساب کاربری وارد شوید</h3><a class="go-btn" onclick="openLogin()">ورود / ثبت‌نام</a></div>`; }
  const orders = Store.orders;
  return `
  <div class="breadcrumb"><a onclick="go('#/')">خانه</a><span>/</span><span>حساب کاربری</span></div>
  <div class="profile">
    <aside class="profile-side">
      <div class="pu"><div class="av">${(u.name || 'ک')[0]}</div><div><div style="font-weight:700;font-size:14px">${u.name || 'کاربر دیجی‌مارکت'}</div><div style="font-size:12px;color:var(--muted)">${u.phone}</div></div></div>
      <a class="${tab === 'orders' ? 'active' : ''}" onclick="go('#/profile/orders')">📦 سفارش‌های من</a>
      <a class="${tab === 'favorites' ? 'active' : ''}" onclick="go('#/favorites')">❤️ علاقه‌مندی‌ها</a>
      <a class="${tab === 'info' ? 'active' : ''}" onclick="go('#/profile/info')">👤 اطلاعات حساب</a>
      <a onclick="logout()">🚪 خروج از حساب</a>
    </aside>
    <div class="profile-body">
      ${tab === 'info' ? profileInfo(u) : ordersHTML(orders)}
    </div>
  </div>`;
}
function profileInfo(u) {
  return `<h3>اطلاعات حساب کاربری</h3>
    <div class="field"><label>نام و نام خانوادگی</label><input id="piName" value="${u.name || ''}" placeholder="نام خود را وارد کنید"></div>
    <div class="field"><label>شماره موبایل</label><input value="${u.phone}" disabled style="opacity:.7"></div>
    <button class="primary-btn" style="width:auto;padding:10px 28px" onclick="saveProfile()">ذخیره تغییرات</button>`;
}
function saveProfile() { const u = Store.user; u.name = $('#piName').value.trim(); Store.user = u; refreshChrome(); toast('اطلاعات ذخیره شد ✅'); render(); }
function ordersHTML(orders) {
  if (!orders.length) return `<h3>سفارش‌های من</h3><div class="empty-state" style="padding:40px"><div class="big">📦</div><h3>هنوز سفارشی ثبت نکرده‌اید</h3><a class="go-btn" onclick="go('#/')">شروع خرید</a></div>`;
  return `<h3>سفارش‌های من (${fa(orders.length)})</h3>` + orders.map(o => `
    <div class="order-card">
      <div class="oc-head">
        <span>کد سفارش: <b>#${fa(o.id)}</b></span>
        <span>${o.date}</span>
        <span class="badge ${o.status === 'delivered' ? 'delivered' : 'processing'}">${o.status === 'delivered' ? '✓ تحویل شده' : '⏳ در حال پردازش'}</span>
      </div>
      <div class="oc-items">${o.items.map(it => `<div class="it" title="${it.name}">${it.icon}</div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:13px">
        <span style="color:var(--muted)">${fa(o.count)} کالا • ${o.payLabel}</span>
        <b>${money(o.total)}</b>
      </div>
    </div>`).join('');
}

/* ============================================================
   نمای تسویه‌حساب (چندمرحله‌ای)
   ============================================================ */
let checkoutStep = 1, checkoutData = {};
function goCheckout() {
  if (!cartEntries().length) { toast('سبد خرید خالی است'); return; }
  if (!Store.user) { toast('برای ثبت سفارش ابتدا وارد شوید'); openLogin(() => go('#/checkout')); return; }
  checkoutStep = 1; checkoutData = {};
  go('#/checkout');
}
function viewCheckout() {
  if (!cartEntries().length && checkoutStep !== 4) return `<div class="empty-state"><div class="big">🛒</div><h3>سبد خرید خالی است</h3><a class="go-btn" onclick="go('#/')">بازگشت به فروشگاه</a></div>`;
  return `
  <div class="sec-head" style="justify-content:center"><h2>تکمیل خرید</h2></div>
  <div class="steps">
    <div class="step ${checkoutStep >= 1 ? (checkoutStep > 1 ? 'done' : 'active') : ''}"><span class="num">${checkoutStep > 1 ? '✓' : '۱'}</span> آدرس</div>
    <div class="step-line"></div>
    <div class="step ${checkoutStep >= 2 ? (checkoutStep > 2 ? 'done' : 'active') : ''}"><span class="num">${checkoutStep > 2 ? '✓' : '۲'}</span> پرداخت</div>
    <div class="step-line"></div>
    <div class="step ${checkoutStep >= 3 ? (checkoutStep > 3 ? 'done' : 'active') : ''}"><span class="num">${checkoutStep > 3 ? '✓' : '۳'}</span> تأیید</div>
  </div>
  <div style="max-width:560px;margin:0 auto" id="checkoutInner">${checkoutInner()}</div>`;
}
function checkoutInner() {
  const u = Store.user || {};
  if (checkoutStep === 1) return `
    <div class="profile-body">
      <div class="field"><label>نام تحویل‌گیرنده</label><input id="coName" value="${checkoutData.name || u.name || ''}" placeholder="نام و نام خانوادگی"><span class="err">نام را وارد کنید</span></div>
      <div class="field"><label>شماره تماس</label><input id="coPhone" value="${checkoutData.phone || u.phone || ''}" maxlength="11" placeholder="۰۹۱۲۳۴۵۶۷۸۹"><span class="err">شماره معتبر وارد کنید</span></div>
      <div class="field"><label>آدرس کامل</label><textarea id="coAddr" rows="3" placeholder="استان، شهر، خیابان، پلاک، واحد...">${checkoutData.address || ''}</textarea><span class="err">آدرس را وارد کنید</span></div>
      <div class="field"><label>کد پستی</label><input id="coPostal" value="${checkoutData.postal || ''}" maxlength="10" placeholder="۱۰ رقم"><span class="err">کد پستی ۱۰ رقمی وارد کنید</span></div>
      <button class="primary-btn" onclick="checkoutNext()">ادامه ←</button>
    </div>`;
  if (checkoutStep === 2) return `
    <div class="profile-body">
      <h3>روش پرداخت</h3>
      <div class="pay-methods" style="margin-bottom:16px">
        <label><input type="radio" name="copay" value="online" checked><span>💳 آنلاین</span></label>
        <label><input type="radio" name="copay" value="cod"><span>💵 درب منزل</span></label>
        <label><input type="radio" name="copay" value="wallet"><span>👛 کیف پول</span></label>
      </div>
      ${summaryBox(false)}
      <button class="primary-btn" style="margin-top:14px" onclick="checkoutNext()">بررسی نهایی ←</button>
      <button class="ghost-btn" onclick="checkoutStep=1;refreshCheckout()">→ بازگشت</button>
    </div>`;
  if (checkoutStep === 3) {
    const payLabels = { online: '💳 پرداخت آنلاین', cod: '💵 پرداخت درب منزل', wallet: '👛 کیف پول' };
    return `
    <div class="profile-body">
      <h3>بررسی و تأیید سفارش</h3>
      <div class="ord-summary">
        <div class="sumline"><span>تحویل‌گیرنده</span><span>${checkoutData.name}</span></div>
        <div class="sumline"><span>تماس</span><span>${checkoutData.phone}</span></div>
        <div class="sumline"><span>آدرس</span><span style="max-width:300px;text-align:left">${checkoutData.address}</span></div>
        <div class="sumline"><span>روش پرداخت</span><span>${payLabels[checkoutData.pay]}</span></div>
      </div>
      ${summaryBox(false)}
      <button class="primary-btn" style="margin-top:14px" onclick="placeOrder()">پرداخت و ثبت نهایی سفارش</button>
      <button class="ghost-btn" onclick="checkoutStep=2;refreshCheckout()">→ بازگشت</button>
    </div>`;
  }
  // مرحله ۴: موفقیت
  const o = checkoutData.order;
  return `
    <div class="profile-body success">
      <div class="check">✓</div>
      <h2>سفارش شما با موفقیت ثبت شد!</h2>
      <p style="color:var(--muted)">کد پیگیری: <b style="color:var(--text)">#${fa(o.id)}</b></p>
      <p style="margin-top:6px">${o.name} عزیز، سفارش شما به‌زودی ارسال می‌شود.</p>
      <div class="ord-summary">
        <div class="sumline"><span>تعداد اقلام</span><span>${fa(o.count)} مورد</span></div>
        <div class="sumline"><span>روش پرداخت</span><span>${o.payLabel}</span></div>
        <div class="sumline total"><span>مبلغ پرداختی</span><span>${money(o.total)}</span></div>
      </div>
      <button class="primary-btn" onclick="go('#/profile/orders')">مشاهده سفارش‌ها</button>
      <button class="ghost-btn" onclick="go('#/')">بازگشت به فروشگاه</button>
    </div>`;
}
function refreshCheckout() { const el = $('#checkoutInner'); if (el) render(); }
function afterCheckout() {}
function checkoutNext() {
  if (checkoutStep === 1) {
    const name = $('#coName'), phone = $('#coPhone'), addr = $('#coAddr'), postal = $('#coPostal');
    let ok = true;
    const mark = (el, valid) => { el.closest('.field').classList.toggle('invalid', !valid); if (!valid) ok = false; };
    mark(name, name.value.trim().length >= 3);
    mark(phone, /^09\d{9}$/.test(phone.value.replace(/[^\d]/g, '')));
    mark(addr, addr.value.trim().length >= 5);
    mark(postal, postal.value.replace(/[^\d]/g, '').length === 10);
    if (!ok) return;
    Object.assign(checkoutData, { name: name.value.trim(), phone: phone.value, address: addr.value.trim(), postal: postal.value });
    checkoutStep = 2;
  } else if (checkoutStep === 2) {
    checkoutData.pay = document.querySelector('input[name="copay"]:checked').value;
    checkoutStep = 3;
  }
  render();
}
function placeOrder() {
  const payLabels = { online: 'پرداخت آنلاین', cod: 'پرداخت درب منزل', wallet: 'کیف پول' };
  const entries = cartEntries();
  const order = {
    id: 100000 + (Store.orders.length * 137 + entries.length * 7 + subtotal() % 9000),
    date: new Date().toLocaleDateString('fa-IR'),
    name: checkoutData.name,
    count: cartCount(),
    total: grandTotal(),
    pay: checkoutData.pay,
    payLabel: payLabels[checkoutData.pay],
    status: 'processing',
    items: entries.map(e => ({ name: e.p.name, icon: e.p.icon })),
  };
  const orders = Store.orders; orders.unshift(order); Store.orders = orders;
  checkoutData.order = order;
  Store.cart = {}; refreshChrome();
  checkoutStep = 4;
  render();
}

/* ============================================================
   سبد خرید کشویی (drawer)
   ============================================================ */
function openCart()  { renderDrawer(); $('#drawer').classList.add('show'); $('#overlay').classList.add('show'); }
function closeCart() { $('#drawer').classList.remove('show'); $('#overlay').classList.remove('show'); }
function renderDrawer() {
  const entries = cartEntries();
  const box = $('#cartItems');
  if (!entries.length) {
    box.innerHTML = `<div class="cart-empty"><div class="big">🛒</div>سبد خرید شما خالی است<br><small>برای افزودن کالا روی «افزودن به سبد» بزنید</small></div>`;
  } else {
    box.innerHTML = entries.map(e => `
      <div class="ci">
        <div class="ci-thumb">${e.p.icon}</div>
        <div class="ci-info">
          <h4>${e.p.name}</h4>
          <div class="ci-price">${money(e.p.price * e.q)}</div>
          <div class="qty">
            <div class="q-ctrl">
              <button onclick="setQty(${e.p.id}, ${e.q + 1})">+</button>
              <span>${fa(e.q)}</span>
              <button onclick="setQty(${e.p.id}, ${e.q - 1})">−</button>
            </div>
            <button class="rm" onclick="removeItem(${e.p.id})" title="حذف">🗑</button>
          </div>
        </div>
      </div>`).join('');
  }
  const st = subtotal(), sh = shipping();
  $('#dSubTotal').textContent = money(st);
  $('#dShipping').innerHTML = sh === 0 ? (st > 0 ? '<span class="free-ship">رایگان</span>' : '۰ تومان') : money(sh);
  $('#dGrandTotal').textContent = money(st + sh);
  $('#dCheckoutBtn').disabled = entries.length === 0;
}

/* ============================================================
   ورود / ثبت‌نام (شبیه‌سازی OTP)
   ============================================================ */
let loginPhase = 'phone', loginPhone = '', onLoginSuccess = null;
function openLogin(cb) {
  onLoginSuccess = cb || null;
  if (Store.user) { go('#/profile/orders'); return; }
  loginPhase = 'phone';
  renderLogin();
  $('#loginModal').classList.add('show');
}
function closeLogin() { $('#loginModal').classList.remove('show'); }
function renderLogin() {
  const box = $('#loginBox');
  if (loginPhase === 'phone') {
    box.innerHTML = `
      <h2>ورود | ثبت‌نام</h2>
      <p class="sub">شماره موبایل خود را وارد کنید تا کد تأیید برایتان ارسال شود.</p>
      <div class="field">
        <label>شماره موبایل</label>
        <input id="loginPhone" type="tel" maxlength="11" placeholder="۰۹۱۲۳۴۵۶۷۸۹" value="${loginPhone}">
        <span class="err">شماره موبایل ۱۱ رقمی معتبر وارد کنید.</span>
      </div>
      <button class="primary-btn" onclick="sendOtp()">ارسال کد تأیید</button>
      <button class="ghost-btn" onclick="closeLogin()">انصراف</button>`;
    setTimeout(() => $('#loginPhone') && $('#loginPhone').focus(), 50);
  } else {
    box.innerHTML = `
      <h2>تأیید شماره موبایل</h2>
      <p class="sub">کد ۴ رقمی ارسال‌شده به <b>${loginPhone}</b> را وارد کنید.</p>
      <div class="otp-inputs" id="otpInputs">
        ${[0, 1, 2, 3].map(i => `<input maxlength="1" inputmode="numeric" data-i="${i}">`).join('')}
      </div>
      <p class="otp-hint">کد تأیید (نمایشی): <b>۱۲۳۴</b></p>
      <button class="primary-btn" onclick="verifyOtp()">ورود</button>
      <button class="ghost-btn" onclick="loginPhase='phone';renderLogin()">→ تغییر شماره</button>`;
    setTimeout(setupOtp, 50);
  }
}
function sendOtp() {
  const v = $('#loginPhone').value.replace(/[^\d]/g, '');
  const field = $('#loginPhone').closest('.field');
  if (!/^09\d{9}$/.test(v)) { field.classList.add('invalid'); return; }
  field.classList.remove('invalid');
  loginPhone = v; loginPhase = 'otp'; renderLogin();
  toast('کد تأیید ارسال شد (کد نمایشی: ۱۲۳۴)');
}
function setupOtp() {
  const inputs = [...document.querySelectorAll('#otpInputs input')];
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/[^\d۰-۹]/g, '').slice(0, 1);
      if (inp.value && i < 3) inputs[i + 1].focus();
      if (inputs.every(x => x.value)) verifyOtp();
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus(); });
  });
  inputs[0].focus();
}
function verifyOtp() {
  const code = [...document.querySelectorAll('#otpInputs input')].map(x => x.value).join('')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  if (code !== '1234') { toast('کد وارد شده صحیح نیست (کد نمایشی: ۱۲۳۴)'); return; }
  Store.user = { phone: loginPhone, name: '' };
  refreshChrome();
  closeLogin();
  toast('خوش آمدید! با موفقیت وارد شدید ✅');
  if (onLoginSuccess) { const cb = onLoginSuccess; onLoginSuccess = null; cb(); }
  else if (location.hash.startsWith('#/profile')) render();
}
function logout() { localStorage.removeItem('dm_user'); refreshChrome(); toast('از حساب خارج شدید'); go('#/'); }

/* ============================================================
   جستجو (با پیشنهاد زنده)
   ============================================================ */
function onSearchInput() {
  const q = $('#searchInput').value.trim();
  const box = $('#suggest');
  if (!q) { box.classList.add('hidden'); return; }
  const t = q.toLowerCase();
  const matches = PRODUCTS.filter(p => p.name.toLowerCase().includes(t) || p.brand.toLowerCase().includes(t)).slice(0, 6);
  if (!matches.length) { box.classList.add('hidden'); return; }
  box.innerHTML = matches.map(p => `
    <a onclick="go('#/product/${p.id}');clearSearch()">
      <span class="ic">${p.icon}</span>
      <span style="flex:1">${p.name}</span>
      <span class="px">${money(p.price)}</span>
    </a>`).join('') +
    `<a onclick="doSearch()" style="justify-content:center;color:var(--red);font-weight:700">مشاهده همه نتایج «${q}» ←</a>`;
  box.classList.remove('hidden');
}
function doSearch() {
  const q = $('#searchInput').value.trim();
  if (!q) return;
  clearFiltersState();
  go('#/search?q=' + encodeURIComponent(q));
  clearSearch();
}
function clearFiltersState() { listState = { sort: 'default', brands: [], onlyDiscount: false, onlyAvailable: false, maxPrice: null }; }
function clearSearch() { $('#suggest').classList.add('hidden'); }

/* ============================================================
   توست
   ============================================================ */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ============================================================
   راه‌اندازی اولیه
   ============================================================ */
function init() {
  refreshChrome();
  render();
  window.addEventListener('hashchange', () => { clearFiltersStateOnNav(); render(); });
  // بستن پیشنهاد جستجو با کلیک بیرون
  document.addEventListener('click', e => {
    if (!e.target.closest('.search')) clearSearch();
  });
  // جستجو با اینتر
  $('#searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}
let _lastRouteName = '';
function clearFiltersStateOnNav() {
  // با تغییر دسته/جستجو، فیلترها ریست شود (اما نه هنگام تعامل داخل همان صفحه)
  const r = currentRoute();
  if (r.name !== _lastRouteName || r.param) clearFiltersState();
  _lastRouteName = r.name;
}

document.addEventListener('DOMContentLoaded', init);
