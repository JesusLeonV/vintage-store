// ============ GLOBAL CACHE ============
var _products = [];
var _claims = [];
var _discounts = [];
var _categories = [];
var formImages = [];
var claimTimerInterval = null;

// ============ API HELPERS ============
async function apiGet(path) {
    var res = await fetch('/api' + path);
    if (!res.ok) throw new Error('API GET error: ' + path);
    return res.json();
}
async function apiPost(path, data) {
    var res = await fetch('/api' + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return res.json();
}
async function apiPut(path, data) {
    var res = await fetch('/api' + path, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return res.json();
}
async function apiDelete(path) {
    var res = await fetch('/api' + path, { method: 'DELETE' });
    return res.json();
}

// ============ DATA LOADERS ============
async function loadAllData() {
    try {
        var results = await Promise.all([
            apiGet('/products'),
            apiGet('/claims'),
            apiGet('/discounts')
        ]);
        _products = results[0];
        _claims = results[1].map(function(c) {
            return {
                id: c.id, userId: c.user_id, productId: c.product_id,
                userName: c.user_name, userEmail: c.user_email,
                userInstagram: c.user_instagram || '', userPhone: c.user_phone || '',
                status: c.status, date: c.created_at, confirmedAt: c.confirmed_at,
                shippedAt: c.shipped_at, receivedAt: c.received_at,
                discountCode: c.discount_code_id ? (c.discount_code || '') : null,
                discountAmount: c.discount_amount || 0,
                discountedPrice: c.product_price - (c.discount_amount || 0),
                trackingNumber: c.tracking_number || null
            };
        });
        _discounts = results[2].map(function(d) {
            return {
                id: d.id, code: d.code, type: d.type, value: d.value,
                maxUses: d.max_uses || 0, maxUsesPerClient: d.max_uses_per_client || 1,
                currentUses: d.current_uses || 0, minPurchase: 0,
                expiry: d.valid_until || '', description: '',
                active: d.active, createdAt: d.created_at
            };
        });
    } catch (e) {
        console.error('Error loading data:', e);
    }
}

// ============ DATA ACCESSORS (sync, from cache) ============
function getProducts() { return _products; }
function getClaims() { return _claims; }
function getDiscounts() { return _discounts; }
function getCategories() {
    var stored = JSON.parse(localStorage.getItem('adminCategories') || 'null');
    if (stored && stored.length) return stored;
    var cats = [];
    _products.forEach(function(p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
    if (!cats.length) cats = ['LEGO Star Wars', 'LEGO Technic', 'LEGO Minecraft', 'LEGO Creator', 'Hot Wheels', 'Funko Pop', 'Figuras de Accion'];
    return cats;
}
function saveCategories(c) { localStorage.setItem('adminCategories', JSON.stringify(c)); }
function seedCategories() { getCategories(); }

// ============ TOAST ============
function toast(msg) {
    var t = document.getElementById('toast');
    var m = document.getElementById('toastMessage');
    if (!t || !m) return;
    m.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 3000);
}

// ============ AUTH ============
function initAdminLogin() {
    var form = document.getElementById('adminLoginForm');
    if (!form) return;
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var email = document.getElementById('adminEmail').value;
        var pass = document.getElementById('adminPass').value;
        if (email === 'admin@vintagestore.cl' && pass === 'admin123') {
            localStorage.setItem('vintageUser', JSON.stringify({ role: 'admin', email: email, name: 'Admin' }));
            showDashboard();
        } else {
            toast('Credenciales incorrectas');
        }
    });
}

function showDashboard() {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    loadDashboard();
}

function initLogout() {
    var btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', function() {
        localStorage.removeItem('vintageUser');
        window.location.href = 'index.html';
    });
}

function initMobileSidebar() {
    var btn = document.getElementById('mobileMenuBtn');
    var sidebar = document.querySelector('.sidebar');
    if (btn && sidebar) {
        btn.addEventListener('click', function() { sidebar.classList.toggle('open'); });
        document.addEventListener('click', function(e) {
            if (!sidebar.contains(e.target) && e.target !== btn) sidebar.classList.remove('open');
        });
    }
}

// ============ NAV ============
function initNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            var page = btn.dataset.page;
            document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
            document.getElementById('page-' + page).classList.add('active');
            var loaders = { dashboard: loadDashboard, products: loadProducts, claims: loadClaims, history: loadHistory, publish: loadPublish, categories: renderCategories, users: loadUsers, discounts: loadDiscounts };
            if (loaders[page]) loaders[page]();
        });
    });
}

// ============ DASHBOARD ============
function loadDashboard() {
    var products = _products;
    var claims = _claims;
    var activeStatuses = ['confirmed','shipped','received'];
    var activeClaims = claims.filter(function(c) { return activeStatuses.indexOf(c.status) !== -1; });
    var pendingClaims = claims.filter(function(c) { return ['pending','confirmed','preparing','shipped'].indexOf(c.status) !== -1; });
    var completedClaims = claims.filter(function(c) { return activeStatuses.indexOf(c.status) !== -1; });

    var revenue = 0;
    completedClaims.forEach(function(c) {
        var prod = products.find(function(p) { return p.id === c.productId; });
        if (prod) revenue += prod.price - (c.discountAmount || 0);
    });

    document.getElementById('statProducts').textContent = products.length;
    document.getElementById('statRevenue').textContent = '$' + revenue.toLocaleString();
    document.getElementById('statSold').textContent = completedClaims.length;
    document.getElementById('statPending').textContent = pendingClaims.length;
    var schedEl = document.getElementById('statScheduled');
    if (schedEl) schedEl.textContent = products.filter(function(p) { return p.status === 'scheduled'; }).length;

    var conversion = claims.length > 0 ? Math.round((completedClaims.length + claims.filter(function(c) { return c.status === 'expired'; }).length) / claims.length * 100) : 0;
    var conversionEl = document.getElementById('statConversion');
    if (conversionEl) conversionEl.textContent = conversion + '%';

    var weeklyList = document.getElementById('weeklySalesList');
    if (weeklyList) {
        var now = new Date();
        var days = [];
        for (var d = 6; d >= 0; d--) {
            var date = new Date(now);
            date.setDate(date.getDate() - d);
            var dayStr = date.toISOString().slice(0, 10);
            var count = claims.filter(function(c) {
                return c.date && c.date.slice(0, 10) === dayStr;
            }).length;
            var dayNames = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
            days.push({ name: dayNames[date.getDay()], count: count });
        }
        weeklyList.innerHTML = '<div class="chart-vertical"><div class="chart-bars">' + days.map(function(d) {
            var maxCount = Math.max.apply(null, days.map(function(x) { return x.count; }));
            var pct = maxCount > 0 ? (d.count / maxCount * 100) : 0;
            return '<div class="chart-col"><div class="chart-count">' + (d.count > 0 ? d.count : '') + '</div><div class="chart-bar-wrap"><div class="chart-bar" style="height:' + Math.max(pct, d.count > 0 ? 8 : 0) + '%"></div></div><div class="chart-label">' + d.name + '</div></div>';
        }).join('') + '</div></div>';
    }

    var list = document.getElementById('activityList');
    var recent = claims.slice(-6).reverse();
    if (!recent.length) { list.innerHTML = '<p class="activity-empty">No hay actividad reciente</p>'; return; }
    list.innerHTML = recent.map(function(c) {
        var prod = products.find(function(p) { return p.id === c.productId; });
        var colors = {pending:'var(--warn)', confirmed:'var(--success)', preparing:'var(--accent)', shipped:'var(--info)', received:'var(--success)', rejected:'var(--danger)', expired:'var(--text3)'};
        var color = colors[c.status] || 'var(--text3)';
        return '<div class="activity-item"><div class="activity-dot" style="background:' + color + '"></div><div class="activity-text"><strong>' + c.userName + '</strong> reclamo <strong>' + (prod ? prod.name : 'Producto') + '</strong></div><div class="activity-time">' + new Date(c.date).toLocaleDateString() + '</div></div>';
    }).join('');
}

// ============ PRODUCTS ============
function populateCategorySelect(selected) {
    var sel = document.getElementById('prodCategory');
    if (!sel) return;
    var cats = getCategories();
    sel.innerHTML = cats.map(function(c) {
        return '<option' + (c === selected ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
}

function initProductForm() {
    var form = document.getElementById('productForm');
    if (!form) return;
    populateCategorySelect();
    document.getElementById('addProductBtn').addEventListener('click', function() { openForm(null); });
    document.getElementById('cancelProductBtn').addEventListener('click', closeForm);
    document.getElementById('prodStatus').addEventListener('change', function() { toggleSchedule(this.value === 'scheduled'); });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var editId = document.getElementById('editProductId').value;
        var tagVal = document.getElementById('prodTag').value;
        var status = document.getElementById('prodStatus').value;
        var schedVal = document.getElementById('prodScheduleDate').value;

        if (status === 'scheduled' && !schedVal) {
            toast('Selecciona fecha y hora de publicacion');
            return;
        }

        var payload = {
            name: document.getElementById('prodName').value,
            category: document.getElementById('prodCategory').value,
            description: document.getElementById('prodDesc').value,
            original_price: parseInt(document.getElementById('prodOrigPrice').value) || 0,
            price: parseInt(document.getElementById('prodSalePrice').value),
            stock: parseInt(document.getElementById('prodStock').value),
            tag: tagVal,
            tag_class: tagVal === 'Popular' ? 'tag-hot' : tagVal === 'Raro' ? 'tag-rare' : '',
            status: status,
            scheduled_at: status === 'scheduled' ? new Date(schedVal).toISOString() : null,
            images: formImages.slice()
        };

        try {
            if (editId) {
                await apiPut('/products/' + editId, payload);
                toast('Producto actualizado');
            } else {
                await apiPost('/products', payload);
                toast('Producto guardado');
            }
            await loadAllData();
            closeForm();
            loadProducts();
        } catch (err) {
            toast('Error al guardar: ' + err.message);
        }
    });
}

function toggleSchedule(show) {
    document.getElementById('scheduleWrapper').style.display = show ? 'block' : 'none';
}

function openForm(product) {
    populateCategorySelect(product ? product.category : getCategories()[0]);
    document.getElementById('productFormContainer').style.display = 'block';
    document.getElementById('formTitle').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('productForm').reset();
    document.getElementById('prodStock').value = '1';
    toggleSchedule(false);
    formImages = product && product.images ? product.images.slice() : [];
    renderImagePreviews();
    if (product) {
        document.getElementById('editProductId').value = product.id;
        document.getElementById('prodName').value = product.name;
        document.getElementById('prodDesc').value = product.description || '';
        document.getElementById('prodOrigPrice').value = product.original_price || product.originalPrice || '';
        document.getElementById('prodSalePrice').value = product.price;
        document.getElementById('prodStock').value = product.stock;
        document.getElementById('prodTag').value = product.tag || '';
        document.getElementById('prodStatus').value = product.status;
        if (product.status === 'scheduled') {
            toggleSchedule(true);
            var d = product.scheduled_at || product.scheduledAt;
            if (d) {
                var dt = new Date(d);
                var pad = function(n) { return (n < 10 ? '0' : '') + n; };
                document.getElementById('prodScheduleDate').value =
                    dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
            }
        }
    } else {
        document.getElementById('editProductId').value = '';
    }
    document.getElementById('productFormContainer').scrollIntoView({behavior:'smooth'});
}

function closeForm() {
    document.getElementById('productFormContainer').style.display = 'none';
}

function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function initProductImages() {
    var btn = document.getElementById('addImageBtn');
    var input = document.getElementById('prodImages');
    if (btn && input) {
        btn.addEventListener('click', function() { input.click(); });
        input.addEventListener('change', function() {
            Array.from(this.files).forEach(function(file) {
                if (formImages.length >= 6) return;
                var reader = new FileReader();
                reader.onload = function(e) {
                    formImages.push(e.target.result);
                    renderImagePreviews();
                };
                reader.readAsDataURL(file);
            });
            input.value = '';
        });
    }
}

function renderImagePreviews() {
    var container = document.getElementById('imagePreviews');
    if (!container) return;
    container.innerHTML = formImages.map(function(src, i) {
        return '<div class="img-preview-wrap"><img src="' + src + '" class="img-preview" alt=""><button type="button" class="img-remove" onclick="removeImage(' + i + ')">&times;</button></div>';
    }).join('');
}

function removeImage(i) {
    formImages.splice(i, 1);
    renderImagePreviews();
}

function loadProducts() {
    var products = _products;
    var tbody = document.getElementById('productsTableBody');
    document.getElementById('productsCount').textContent = products.length + ' productos';
    if (!products.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay productos. Crea uno nuevo.</td></tr>'; return; }
    var labels = {draft:'Borrador', available:'Publicado', scheduled:'Programado', reserved:'Reservado', sold:'Vendido'};
    tbody.innerHTML = products.map(function(p) {
        var sub = '';
        if (p.status === 'scheduled' && (p.scheduled_at || p.scheduledAt)) sub = '<br><small style="color:var(--warn)">' + fmtDate(p.scheduled_at || p.scheduledAt) + '</small>';
        var imgs = p.images || [];
        return '<tr>' +
            '<td data-label="Producto"><div class="prod-cell">' +
                (imgs.length ? '<img src="' + imgs[0] + '" class="prod-mini" alt="">' : '<div class="prod-mini prod-mini-empty"></div>') +
                '<strong>' + p.name + '</strong>' +
            '</div></td>' +
            '<td data-label="Categoria"><span class="cat-chip">' + p.category + '</span></td>' +
            '<td data-label="Precio">$' + p.price.toLocaleString() + '</td>' +
            '<td data-label="Stock">' + p.stock + '</td>' +
            '<td data-label="Estado"><span class="badge badge-' + p.status + '">' + (labels[p.status]||p.status) + '</span>' + sub + '</td>' +
            '<td class="actions-cell">' +
                '<button class="btn btn-sm btn-outline" onclick="editProduct(' + p.id + ')">Editar</button>' +
                '<button class="btn btn-sm btn-ghost danger" onclick="deleteProduct(' + p.id + ')">Eliminar</button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

function editProduct(id) {
    var p = _products.find(function(x) { return x.id === id; });
    if (p) openForm(p);
}

async function deleteProduct(id) {
    if (!confirm('Eliminar este producto?')) return;
    try {
        await apiDelete('/products/' + id);
        await loadAllData();
        loadProducts();
        toast('Producto eliminado');
    } catch (e) { toast('Error al eliminar'); }
}

// ============ CLAIMS ============
function getClaimAge(dateStr) {
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    var secs = Math.floor((diff % 60000) / 1000);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function loadClaims() {
    if (claimTimerInterval) { clearInterval(claimTimerInterval); claimTimerInterval = null; }
    var claims = _claims;
    var products = _products;
    var activeStatuses = ['pending', 'confirmed', 'preparing', 'shipped'];
    var active = claims.filter(function(c) { return activeStatuses.indexOf(c.status) !== -1; });
    var tbody = document.getElementById('claimsTableBody');
    document.getElementById('claimsCount').textContent = active.length + ' reclamos activos';
    if (!active.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay reclamaciones pendientes.</td></tr>'; return; }
    var st = {pending:'Pendiente', confirmed:'Confirmado', preparing:'Preparando', shipped:'Enviado', received:'Recibido'};
    tbody.innerHTML = active.map(function(c) {
        var prod = products.find(function(p) { return p.id === c.productId; });
        var prodName = prod ? prod.name : 'tu producto';
        var msgMap = {
            pending: 'Hola! Gracias por tu compra de ' + prodName + '. Por favor envia el comprobante de pago a este usuario.',
            confirmed: 'Hola! Tu pedido de ' + prodName + ' ha sido confirmado. Estara preparado proximamente.',
            preparing: 'Hola! Tu pedido de ' + prodName + ' esta en preparacion. Te avisaremos cuando sea despachado.',
            shipped: 'Hola! Tu pedido de ' + prodName + ' ha sido despachado.' + (c.trackingNumber ? ' Guia Starken: ' + c.trackingNumber + '. Seguimiento: starken.cl/seguimiento/' + c.trackingNumber + '.' : '')
        };
        var igMsg = (msgMap[c.status] || msgMap.pending) + ' - Vintage Store';
        var igIcon = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>';
        var igBtn = '<a href="https://ig.me/m/vintage_store_1978" target="_blank" class="btn btn-sm btn-ig" title="Enviar mensaje" onclick="copyIgMsg(this,\'' + igMsg.replace(/'/g,"\\'") + '\')">' + igIcon + ' Instagram</a>';
        var actions = '';
        if (c.status === 'pending') {
            actions = '<button class="btn btn-sm btn-success" onclick="confirmClaim(' + c.id + ')">Confirmar</button>' +
                '<button class="btn btn-sm btn-ghost danger" onclick="rejectClaim(' + c.id + ')">Rechazar</button>';
        } else if (c.status === 'confirmed') {
            actions = '<button class="btn btn-sm btn-outline" onclick="markPreparing(' + c.id + ')">Preparar</button>' +
                '<button class="btn btn-sm btn-ghost danger" onclick="rejectClaim(' + c.id + ')">Rechazar</button>';
        } else if (c.status === 'preparing') {
            actions = '<button class="btn btn-sm btn-accent" onclick="markShipped(' + c.id + ')">Despachar</button>';
        } else if (c.status === 'shipped') {
            actions = '<button class="btn btn-sm btn-outline" onclick="addTracking(' + c.id + ')">Guia</button>' +
                '<button class="btn btn-sm btn-success" onclick="setClaimStatus(' + c.id + ',\'received\')">Recibido</button>';
        }
        return '<tr>' +
            '<td data-label="Cliente"><strong>' + c.userName + '</strong><br><small style="color:var(--text3)">' + (c.userEmail||'') + '</small></td>' +
            '<td data-label="Producto">' + (prod ? prod.name : 'Producto eliminado') + (c.discountCode ? '<br><small style="color:var(--accent)">Code: ' + c.discountCode + ' &rarr; $' + (c.discountedPrice || prod.price).toLocaleString() + '</small>' : '') + '</td>' +
            '<td data-label="Tiempo">' + fmtDate(c.date) + (c.trackingNumber ? '<br><small style="color:var(--success)">Guia: ' + c.trackingNumber + '</small>' : '') + '</td>' +
            '<td data-label="Estado"><span class="badge badge-' + c.status + '">' + (st[c.status]||c.status) + '</span></td>' +
            '<td class="claim-timer">' + (c.status === 'pending' ? getClaimAge(c.date) : '-') + '</td>' +
            '<td class="actions-cell">' + actions + ' ' + igBtn + '</td>' +
        '</tr>';
    }).join('');
}

async function confirmClaim(id) {
    try {
        await apiPut('/claims/' + id + '/confirm', {});
        await loadAllData();
        loadClaims(); loadDashboard();
        toast('Pago confirmado');
    } catch (e) { toast('Error al confirmar'); }
}

async function rejectClaim(id) {
    try {
        await apiPut('/claims/' + id + '/reject', {});
        await loadAllData();
        loadClaims(); loadDashboard();
        toast('Reclamacion rechazada');
    } catch (e) { toast('Error al rechazar'); }
}

async function markPreparing(id) {
    try {
        await apiPut('/claims/' + id + '/status', { status: 'preparing' });
        await loadAllData();
        loadClaims(); loadDashboard();
        toast('Marcado como preparando');
    } catch (e) { toast('Error'); }
}

async function markShipped(id) {
    var tracking = prompt('Numero de guia Starken (opcional):');
    try {
        await apiPut('/claims/' + id + '/status', { status: 'shipped' });
        await loadAllData();
        loadClaims(); loadDashboard();
        toast('Marcado como despachado');
    } catch (e) { toast('Error'); }
}

function addTracking(id) {
    var tracking = prompt('Numero de guia Starken:', '');
    if (tracking !== null && tracking.trim()) {
        toast('Guia actualizada: ' + tracking.trim());
    }
}

async function setClaimStatus(id, status) {
    try {
        await apiPut('/claims/' + id + '/status', { status: status });
        await loadAllData();
        loadClaims(); loadDashboard();
        var labels = {received:'Recibido', expired:'Expirado', confirmed:'Confirmado', rejected:'Rechazado'};
        toast('Estado actualizado a ' + (labels[status] || status));
    } catch (e) { toast('Error'); }
}

function copyIgMsg(el, msg) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).then(function() {
            toast('Mensaje copiado. Pegalo en el chat de Instagram.');
        });
    }
}

// ============ HISTORY ============
function loadHistory() {
    var claims = _claims;
    var products = _products;
    var histStatuses = ['expired', 'rejected', 'received'];
    var history = claims.filter(function(c) { return histStatuses.indexOf(c.status) !== -1; });
    var tbody = document.getElementById('historyTableBody');
    document.getElementById('historyCount').textContent = history.length + ' en historial';
    if (!history.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No hay historial.</td></tr>'; return; }
    var st = {expired:'Expirado', rejected:'Rechazado', received:'Recibido', confirmed:'Completado'};
    tbody.innerHTML = history.map(function(c) {
        var prod = products.find(function(p) { return p.id === c.productId; });
        return '<tr>' +
            '<td data-label="Cliente"><strong>' + c.userName + '</strong><br><small style="color:var(--text3)">' + (c.userEmail||'') + '</small></td>' +
            '<td data-label="Producto">' + (prod ? prod.name : 'Producto eliminado') + '</td>' +
            '<td data-label="Fecha">' + fmtDate(c.date) + '</td>' +
            '<td data-label="Estado"><span class="badge badge-' + c.status + '">' + (st[c.status]||c.status) + '</span></td>' +
        '</tr>';
    }).join('');
}

// ============ PUBLISH / SCHEDULE ============
function initPublishAll() {
    var btn = document.getElementById('publishAllBtn');
    if (!btn) return;
    btn.addEventListener('click', async function() {
        var drafts = _products.filter(function(p) { return p.status === 'draft'; });
        if (!drafts.length) { toast('No hay borradores para publicar.'); return; }
        for (var i = 0; i < drafts.length; i++) {
            await apiPut('/products/' + drafts[i].id, { ...drafts[i], status: 'available', original_price: drafts[i].original_price || drafts[i].originalPrice });
        }
        await loadAllData();
        loadPublish(); loadDashboard();
        toast(drafts.length + ' productos publicados');
    });
}

function loadPublish() {
    var products = _products;
    var drafts = products.filter(function(p) { return p.status === 'draft'; });
    var scheduled = products.filter(function(p) { return p.status === 'scheduled'; })
        .sort(function(a,b) { return new Date(a.scheduled_at || a.scheduledAt) - new Date(b.scheduled_at || b.scheduledAt); });

    document.getElementById('draftCount').textContent = drafts.length;
    document.getElementById('scheduledCount').textContent = scheduled.length + ' programados';

    var list = document.getElementById('scheduledList');
    if (!scheduled.length) { list.innerHTML = '<p class="activity-empty">No hay productos programados.<br>Crea uno desde Productos con estado "Programado".</p>'; return; }
    list.innerHTML = scheduled.map(function(p) {
        return '<div class="schedule-item">' +
            '<div class="schedule-info"><strong>' + p.name + '</strong><span class="when"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + fmtDate(p.scheduled_at || p.scheduledAt) + '</span></div>' +
            '<div class="schedule-actions">' +
                '<button class="btn btn-sm btn-accent" onclick="publishNow(' + p.id + ')">Publicar ahora</button>' +
                '<button class="btn btn-sm btn-ghost danger" onclick="cancelSchedule(' + p.id + ')">Cancelar</button>' +
            '</div></div>';
    }).join('');
}

async function publishNow(id) {
    var p = _products.find(function(x) { return x.id === id; });
    if (!p) return;
    try {
        await apiPut('/products/' + id, { name: p.name, category: p.category, description: p.description, price: p.price, original_price: p.original_price || p.originalPrice, stock: p.stock, tag: p.tag, tag_class: p.tag_class || p.tagClass || '', status: 'available', scheduled_at: null, images: p.images || [] });
        await loadAllData();
        loadPublish(); loadDashboard();
        toast('Producto publicado');
    } catch (e) { toast('Error'); }
}

async function cancelSchedule(id) {
    var p = _products.find(function(x) { return x.id === id; });
    if (!p) return;
    try {
        await apiPut('/products/' + id, { name: p.name, category: p.category, description: p.description, price: p.price, original_price: p.original_price || p.originalPrice, stock: p.stock, tag: p.tag, tag_class: p.tag_class || p.tagClass || '', status: 'draft', scheduled_at: null, images: p.images || [] });
        await loadAllData();
        loadPublish(); loadDashboard();
        toast('Programacion cancelada, paso a borrador');
    } catch (e) { toast('Error'); }
}

// ============ CATEGORIES ============
function initCategories() {
    var btn = document.getElementById('addCategoryBtn');
    if (!btn) return;
    btn.addEventListener('click', addCategory);
    document.getElementById('newCategoryName').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
    });
}

function addCategory() {
    var input = document.getElementById('newCategoryName');
    var name = input.value.trim();
    if (!name) { toast('Escribe un nombre de categoria'); return; }
    var cats = getCategories();
    if (cats.some(function(c) { return c.toLowerCase() === name.toLowerCase(); })) {
        toast('Esa categoria ya existe'); return;
    }
    cats.push(name);
    saveCategories(cats);
    input.value = '';
    renderCategories();
    populateCategorySelect();
    toast('Categoria "' + name + '" creada');
}

function deleteCategory(index) {
    var cats = getCategories();
    var name = cats[index];
    var inUse = _products.some(function(p) { return p.category === name; });
    if (inUse && !confirm('Hay productos usando "' + name + '". Eliminar de todas formas?')) return;
    cats.splice(index, 1);
    saveCategories(cats);
    renderCategories();
    populateCategorySelect();
    toast('Categoria eliminada');
}

function renderCategories() {
    var cats = getCategories();
    var list = document.getElementById('categoriesList');
    document.getElementById('categoriesCount').textContent = cats.length + ' categorias';
    if (!cats.length) { list.innerHTML = '<p class="activity-empty">No hay categorias. Agrega una arriba.</p>'; return; }
    list.innerHTML = cats.map(function(c, i) {
        var count = _products.filter(function(p) { return p.category === c; }).length;
        return '<div class="cat-row"><div><span class="cat-chip">' + c + '</span><small class="cat-count">' + count + ' producto' + (count === 1 ? '' : 's') + '</small></div><button class="btn btn-sm btn-ghost danger" onclick="deleteCategory(' + i + ')">Eliminar</button></div>';
    }).join('');
}

// ============ USERS ============
async function loadUsers() {
    var users = [];
    try {
        var claimsData = await apiGet('/claims');
        var usersMap = {};
        claimsData.forEach(function(c) {
            if (!usersMap[c.user_id]) {
                usersMap[c.user_id] = { id: c.user_id, name: c.user_name, email: c.user_email, phone: c.user_phone || '', instagram: c.user_instagram || '', createdAt: c.created_at };
            }
        });
        users = Object.values(usersMap);
    } catch (e) { console.error('Error loading users:', e); }
    var tbody = document.getElementById('usersTableBody');
    document.getElementById('usersCount').textContent = users.length + ' usuarios';
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay usuarios registrados.</td></tr>'; return; }
    tbody.innerHTML = users.map(function(u) {
        var igLink = u.instagram ? '<a href="https://instagram.com/' + u.instagram.replace('@','') + '" target="_blank" style="color:var(--accent)">' + u.instagram + '</a>' : '-';
        return '<tr>' +
            '<td data-label="Nombre"><strong>' + u.name + '</strong></td>' +
            '<td data-label="Email">' + u.email + '</td>' +
            '<td data-label="Telefono">' + (u.phone || '-') + '</td>' +
            '<td data-label="Instagram">' + igLink + '</td>' +
            '<td data-label="Registro">' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-') + '</td>' +
        '</tr>';
    }).join('');
}

// ============ DISCOUNTS ============
function formatCLP(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function parseDiscountValue() {
    var raw = document.getElementById('discountValue').value.replace(/\./g, '').replace(/,/g, '').trim();
    return parseInt(raw) || 0;
}
function switchDiscountTypeUI(type) {
    var prefix = document.getElementById('dvPrefix');
    var suffix = document.getElementById('dvSuffix');
    var input = document.getElementById('discountValue');
    if (type === 'fixed') {
        prefix.style.display = ''; suffix.style.display = 'none';
        input.placeholder = 'Ej: 10.000';
    } else {
        prefix.style.display = 'none'; suffix.style.display = '';
        input.placeholder = 'Ej: 10';
    }
}

function initDiscounts() {
    var addBtn = document.getElementById('addDiscountBtn');
    var cancelBtn = document.getElementById('cancelDiscountBtn');
    var form = document.getElementById('discountForm');
    var formContainer = document.getElementById('discountFormContainer');
    var typeSelect = document.getElementById('discountType');
    var valueInput = document.getElementById('discountValue');

    if (typeSelect) { typeSelect.addEventListener('change', function() { switchDiscountTypeUI(this.value); }); switchDiscountTypeUI(typeSelect.value); }
    if (valueInput) {
        valueInput.addEventListener('input', function() {
            var type = typeSelect ? typeSelect.value : 'fixed';
            var raw = this.value.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '');
            if (type === 'fixed') { this.value = raw ? formatCLP(parseInt(raw)) : ''; }
            else { var num = parseInt(raw) || ''; if (num > 100) num = 100; this.value = num; }
        });
    }

    if (addBtn) addBtn.addEventListener('click', function() {
        document.getElementById('editDiscountId').value = '';
        document.getElementById('discountFormTitle').textContent = 'Nuevo Codigo';
        form.reset();
        if (typeSelect) switchDiscountTypeUI(typeSelect.value);
        formContainer.style.display = 'block';
    });
    if (cancelBtn) cancelBtn.addEventListener('click', function() { formContainer.style.display = 'none'; form.reset(); });

    if (form) form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var id = document.getElementById('editDiscountId').value;
        var code = document.getElementById('discountCode').value.trim().toUpperCase();
        var type = typeSelect ? typeSelect.value : 'percent';
        var value = parseDiscountValue();
        var maxUses = parseInt(document.getElementById('discountMaxUses').value) || 0;
        var maxPerClient = parseInt(document.getElementById('discountMaxPerClient').value) || 0;
        var expiry = document.getElementById('discountExpiry').value;
        if (!code || !value) { toast('Completa codigo y valor.'); return; }
        if (type === 'percent' && value > 100) { toast('El porcentaje no puede superar 100%.'); return; }
        try {
            if (!id) {
                await apiPost('/discounts', { code: code, type: type, value: value, max_uses: maxUses, max_uses_per_client: maxPerClient, valid_until: expiry || null });
                toast('Codigo "' + code + '" creado.');
            } else {
                toast('Codigo actualizado.');
            }
            formContainer.style.display = 'none';
            form.reset();
            await loadAllData();
            loadDiscounts();
        } catch (e) { toast('Error al guardar codigo'); }
    });
}

function loadDiscounts() {
    var discounts = _discounts;
    var tbody = document.getElementById('discountsTableBody');
    document.getElementById('discountsCount').textContent = discounts.length + ' codigos';
    if (!discounts.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay codigos de descuento.</td></tr>'; return; }
    tbody.innerHTML = discounts.map(function(d) {
        var discountLabel = d.type === 'percent' ? d.value + '%' : '$' + d.value.toLocaleString();
        var usesLabel = d.maxUses > 0 ? d.currentUses + '/' + d.maxUses : d.currentUses + '/inf';
        var expired = d.expiry && new Date(d.expiry) < new Date();
        var status = expired ? 'Expirado' : d.active ? 'Activo' : 'Inactivo';
        var statusClass = expired ? 'rejected' : d.active ? 'confirmed' : 'pending';
        return '<tr>' +
            '<td data-label="Codigo"><strong style="font-family:monospace;font-size:14px">' + d.code + '</strong></td>' +
            '<td data-label="Descuento">' + discountLabel + '</td>' +
            '<td data-label="Usos">' + usesLabel + '</td>' +
            '<td data-label="Expira">' + (d.expiry || '-') + '</td>' +
            '<td data-label="Estado"><span class="badge badge-' + statusClass + '">' + status + '</span></td>' +
            '<td class="actions-cell">' +
                '<button class="btn btn-sm btn-ghost danger" onclick="deleteDiscount(' + d.id + ')">Eliminar</button>' +
            '</td></tr>';
    }).join('');
}

async function deleteDiscount(id) {
    if (!confirm('Eliminar este codigo?')) return;
    try {
        await apiDelete('/discounts/' + id);
        await loadAllData();
        loadDiscounts();
        toast('Codigo eliminado.');
    } catch (e) { toast('Error al eliminar'); }
}

function editDiscount(id) {
    var d = _discounts.find(function(x) { return x.id === id; });
    if (!d) return;
    document.getElementById('editDiscountId').value = d.id;
    document.getElementById('discountFormTitle').textContent = 'Editar Codigo';
    document.getElementById('discountCode').value = d.code;
    document.getElementById('discountType').value = d.type;
    document.getElementById('discountMaxUses').value = d.maxUses || 0;
    document.getElementById('discountMaxPerClient').value = d.maxUsesPerClient || 0;
    document.getElementById('discountExpiry').value = d.expiry || '';
    switchDiscountTypeUI(d.type);
    document.getElementById('discountValue').value = d.type === 'fixed' ? formatCLP(d.value) : d.value;
    document.getElementById('discountFormContainer').style.display = 'block';
}

// ============ UPDATE WINDOW ============
async function loadUpdateWindowStatus() {
    try {
        var res = await fetch('/api/settings');
        if (!res.ok) return;
        var settings = await res.json();
        var isActive = settings.update_window_active === 'true';
        var btn = document.getElementById('toggleWindowBtn');
        var label = document.getElementById('windowStateLabel');
        if (btn) {
            btn.textContent = isActive ? 'Cerrar Ventana' : 'Abrir Ventana';
            btn.className = isActive ? 'btn btn-lg btn-danger' : 'btn btn-lg btn-accent';
        }
        if (label) {
            label.textContent = isActive ? 'Abierta' : 'Cerrada';
            label.style.color = isActive ? 'var(--success)' : 'var(--text3)';
        }
    } catch (e) { console.error('Error loading window status:', e); }
}

async function toggleUpdateWindow() {
    try {
        var res = await fetch('/api/settings');
        var settings = await res.json();
        var currentActive = settings.update_window_active === 'true';
        var newActive = !currentActive;
        await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'update_window_active', value: String(newActive) }) });
        loadUpdateWindowStatus();
        toast(newActive ? 'Ventana ABIERTA - Los clientes pueden reclamar' : 'Ventana CERRADA - No se permiten reclamaciones');
    } catch (e) { toast('Error al cambiar estado de ventana'); }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async function() {
    seedCategories();
    var user = JSON.parse(localStorage.getItem('vintageUser') || 'null');
    if (user && user.role === 'admin') {
        await loadAllData();
        showDashboard();
    } else {
        document.getElementById('adminLogin').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
        initAdminLogin();
    }
    initNav();
    initProductForm();
    initProductImages();
    initPublishAll();
    initCategories();
    initDiscounts();
    initLogout();
    initMobileSidebar();
    loadUpdateWindowStatus();
});
