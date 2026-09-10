// ============================================
// VINTAGE STORE 1978 - Main JS (API connected)
// ============================================

let currentModalProduct = null;
var updateWindowActive = false;
var currentDiscount = null;
const CLAIM_TIMEOUT_MS = 30 * 60 * 1000;
const API = '/api';

// ============ API Helpers ============

async function apiGet(path) {
    try {
        const res = await fetch(API + path);
        if (!res.ok) throw new Error(res.statusText);
        return await res.json();
    } catch (e) { console.error('API GET error:', e); return null; }
}

async function apiPost(path, data) {
    try {
        const res = await fetch(API + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) { showToast(json.error || 'Error del servidor'); return null; }
        return json;
    } catch (e) { console.error('API POST error:', e); return null; }
}

async function apiPut(path, data) {
    try {
        const res = await fetch(API + path, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) { console.error('API PUT error:', e); return null; }
}

// ============ Init ============

document.addEventListener('DOMContentLoaded', function() {
    fetchUpdateWindowStatus();
    initProducts();
    initModal();
    initLoginModal();
    renderComingSoon();
    initCountdown();
    initMobileMenu();
    initScrollHeader();
    updateUserUI();
    setInterval(function() {
        fetchUpdateWindowStatus();
        initProducts();
        renderComingSoon();
    }, 30000);
});

// ============ Carousel ============

function scrollCarousel(gridId, dir) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    var scrollAmt = 340;
    grid.scrollBy({ left: dir * scrollAmt, behavior: 'smooth' });
}


// ============ UPDATE WINDOW ============
async function fetchUpdateWindowStatus() {
    try {
        var res = await fetch('/api/settings');
        if (!res.ok) return;
        var settings = await res.json();
        updateWindowActive = settings.update_window_active === 'true';
        updateClaimButton();
    } catch (e) { console.error('Error fetching window status:', e); }
}

function updateClaimButton() {
    var claimBtn = document.getElementById('claimBtn');
    if (!claimBtn || !currentModalProduct) return;

    if (!updateWindowActive) {
        claimBtn.textContent = 'Ventana cerrada';
        claimBtn.disabled = true;
        claimBtn.className = 'btn btn-disabled btn-lg btn-full';
        claimBtn.title = 'Las reclamaciones solo estan habilitadas durante ventanas de actualizacion';
    } else if (currentModalProduct.stock === 0) {
        claimBtn.textContent = 'Agotado';
        claimBtn.disabled = true;
        claimBtn.className = 'btn btn-disabled btn-lg btn-full';
    } else {
        claimBtn.textContent = 'Reclamar Ahora';
        claimBtn.disabled = false;
        claimBtn.className = 'btn btn-primary btn-lg btn-full';
        claimBtn.title = '';
    }
}

// ============ Products ============

var cachedProducts = [];

async function initProducts() {
    var grid = document.getElementById('productsGrid');
    var unsoldGrid = document.getElementById('unsoldGrid');

    var recentProducts = await apiGet('/products/recent');
    if (!recentProducts) recentProducts = [];

    var availableProducts = await apiGet('/products/available-not-recent');
    if (!availableProducts) availableProducts = [];

    cachedProducts = recentProducts.concat(availableProducts);

    if (grid) {
        grid.innerHTML = recentProducts.map(function(p) { return createProductCard(p); }).join('');
        grid.querySelectorAll('.product-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var id = parseInt(card.dataset.id);
                var product = cachedProducts.find(function(p) { return parseInt(p.id) === id; });
                if (product) openModal(product);
            });
        });
    }

    if (unsoldGrid) {
        unsoldGrid.innerHTML = availableProducts.map(function(p) { return createProductCard(p); }).join('');
        unsoldGrid.querySelectorAll('.product-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var id = parseInt(card.dataset.id);
                var product = cachedProducts.find(function(p) { return parseInt(p.id) === id; });
                if (product) openModal(product);
            });
        });
    }

    var recentSection = document.getElementById('recentSection');
    var availableSection = document.getElementById('availableSection');
    if (recentSection) recentSection.style.display = recentProducts.length > 0 ? 'block' : 'none';
    if (availableSection) availableSection.style.display = availableProducts.length > 0 ? 'block' : 'none';
}

function createProductCard(p, userEmail) {
    var pid = parseInt(p.id);
    var stock = p.stock;

    var statusBadge = '';
    if (stock === 0) {
        statusBadge = '<span class="stock-badge out">Agotado</span>';
    } else {
        var stockClass = stock <= 2 ? 'low' : '';
        statusBadge = '<span class="stock-badge ' + stockClass + '">Quedan ' + stock + '</span>';
    }

    var imgHtml = p.images && p.images.length
        ? '<img src="' + p.images[0] + '" alt="' + p.name + '" loading="lazy">'
        : '<svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="#1a1a1a"/><rect x="50" y="40" width="200" height="130" rx="8" fill="#2a2a2a"/><circle cx="150" cy="105" r="40" fill="#333"/><rect x="80" y="190" width="140" height="70" rx="6" fill="#2a2a2a"/><text x="150" y="230" text-anchor="middle" fill="#555" font-size="12" font-family="Inter">' + p.category + '</text></svg>';

    return '<div class="product-card" data-id="' + p.id + '">' +
        '<div class="product-card-image">' +
            imgHtml +
            '<span class="product-tag ' + (p.tag_class || '') + '">' + (p.tag || '') + '</span>' +
        '</div>' +
        '<div class="product-card-body">' +
            '<div class="product-card-category">' + p.category + '</div>' +
            '<h3 class="product-card-title">' + p.name + '</h3>' +
            '<p class="product-card-desc">' + (p.description || '') + '</p>' +
            '<div class="product-card-footer">' +
                '<div class="product-card-price">' +
                    '<span class="price-current">$' + parseInt(p.price).toLocaleString() + '</span>' +
                    (p.original_price ? '<span class="price-original">$' + parseInt(p.original_price).toLocaleString() + '</span>' : '') +
                '</div>' +
                statusBadge +
            '</div>' +
        '</div>' +
    '</div>';
}

// ============ Modal ============

function initModal() {
    var overlay = document.getElementById('modalOverlay');
    var closeBtn = document.getElementById('modalClose');
    if (overlay) overlay.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });
}

function openModal(product) {
    var modal = document.getElementById('productModal');
    if (!modal || !product) return;
    currentModalProduct = product;

    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalDescription').textContent = product.description || '';
    document.getElementById('modalPrice').textContent = '$' + parseInt(product.price).toLocaleString();
    document.getElementById('modalOriginalPrice').textContent = product.original_price ? '$' + parseInt(product.original_price).toLocaleString() : '';
    document.getElementById('modalTag').textContent = product.tag || '';
    document.getElementById('modalTag').className = 'product-tag ' + (product.tag_class || '');
    document.getElementById('modalViewers').textContent = Math.floor(Math.random() * 20) + 5 + ' personas viendo';

    var stockBadge = document.getElementById('modalStock');
    stockBadge.className = 'stock-badge' + (product.stock <= 2 ? ' low' : '');
    stockBadge.textContent = product.stock === 0 ? 'Agotado' : 'Quedan ' + product.stock;

    var images = (product.images && product.images.length) ? product.images : [];
    var wrap = modal.querySelector('.modal-images');
    wrap.innerHTML = '';
    var mainDiv = document.createElement('div');
    mainDiv.className = 'modal-main-image';
    mainDiv.innerHTML = images.length
        ? '<img src="' + images[0] + '" alt="' + product.name + '" id="modalMainImg">'
        : '<svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="#141414"/><rect x="60" y="50" width="180" height="120" rx="8" fill="#222"/><circle cx="150" cy="110" r="35" fill="#333"/><rect x="90" y="195" width="120" height="60" rx="6" fill="#222"/></svg>';
    wrap.appendChild(mainDiv);

    if (images.length > 1) {
        var thumbs = document.createElement('div');
        thumbs.className = 'modal-thumbs';
        images.forEach(function(src, i) {
            var t = document.createElement('button');
            t.type = 'button';
            t.className = 'modal-thumb' + (i === 0 ? ' active' : '');
            t.innerHTML = '<img src="' + src + '" alt="Foto ' + (i + 1) + '">';
            t.addEventListener('click', function() {
                document.getElementById('modalMainImg').src = src;
                thumbs.querySelectorAll('.modal-thumb').forEach(function(x) { x.classList.remove('active'); });
                t.classList.add('active');
            });
            thumbs.appendChild(t);
        });
        wrap.appendChild(thumbs);
    }

    currentDiscount = null;
    var discountInput = document.getElementById('discountInput');
    var discountMsg = document.getElementById('discountMessage');
    var applyBtn = document.getElementById('applyDiscountBtn');
    if (discountInput) discountInput.value = '';
    if (discountMsg) { discountMsg.style.display = 'none'; discountMsg.textContent = ''; }
    if (applyBtn) {
        applyBtn.onclick = async function() {
            var code = discountInput.value.trim().toUpperCase();
            if (!code) { showToast('Escribe un codigo de descuento.'); return; }
            var user = null;
            try { user = JSON.parse(localStorage.getItem('vintageUser')); } catch(e) {}
            var result = await apiPost('/discounts/validate', { code: code, user_id: user ? user.id : null });
            if (!result) return;
            var discounted = result.type === 'percent' ? Math.round(product.price * (1 - result.value / 100)) : Math.max(0, product.price - result.value);
            currentDiscount = { code: result.code, type: result.type, value: result.value, discountedPrice: discounted };
            discountMsg.style.display = 'block';
            discountMsg.style.color = 'var(--success)';
            discountMsg.textContent = 'Descuento aplicado: ' + (result.type === 'percent' ? result.value + '%' : '$' + result.value.toLocaleString()) + ' -> Nuevo precio: $' + discounted.toLocaleString();
        };
    }

    updateClaimButton();

    var claimBtn = document.getElementById('claimBtn');
    if (claimBtn) {
        claimBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); handleClaim(); };
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    var modal = document.getElementById('productModal');
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}

// ============ Claim ============

async function handleClaim() {
    if (!updateWindowActive) {
        showToast('Las reclamaciones solo estan habilitadas durante ventanas de actualizacion.');
        return;
    }

    var ustr = localStorage.getItem('vintageUser');
    if (!ustr) { closeModal(); openLoginModal(); showToast('Debes iniciar sesion para reclamar productos.'); return; }
    var user = JSON.parse(ustr);
    var product = currentModalProduct;
    if (!product) { showToast('Error: producto no identificado.'); return; }

    var result = await apiPost('/claims', {
        user_id: user.id,
        product_id: product.id,
        discount_code: currentDiscount ? currentDiscount.code : null
    });

    if (result && result.id) {
        showToast('Reserva creada. Tienes 30 minutos para enviar tu comprobante de pago.');
        closeModal();
        initProducts();
    }
}

// ============ Toast ============

function showToast(message) {
    var toast = document.getElementById('toast');
    var msg = document.getElementById('toastMessage');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.add('active');
    setTimeout(function() { toast.classList.remove('active'); }, 4000);
}

// ============ Coming Soon ============

async function renderComingSoon() {
    var grid = document.getElementById('comingSoonGrid');
    if (!grid) return;
    var items = await apiGet('/products?status=scheduled');
    if (!items || !items.length) {
        grid.innerHTML = '<p style="color:var(--text3);text-align:center;grid-column:1/-1;padding:40px">Proximamente articulos nuevos...</p>';
        return;
    }
    var defaultSvg = '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" rx="12" fill="#141414"/><rect x="20" y="15" width="80" height="55" rx="6" fill="#242424"/><circle cx="60" cy="42" r="18" fill="#333"/><rect x="30" y="80" width="60" height="25" rx="4" fill="#242424"/></svg>';
    grid.innerHTML = items.map(function(item) {
        var imgHtml = (item.images && item.images.length) ? '<img src="' + item.images[0] + '" alt="' + item.name + '">' : defaultSvg;
        var countdownDate = item.scheduled_at || '';
        return '<div class="coming-soon-card">' +
            '<div class="coming-soon-img">' + imgHtml + '</div>' +
            '<div class="coming-soon-info">' +
                '<h3>' + item.name + '</h3>' +
                (item.description ? '<p>' + item.description + '</p>' : '') +
                (countdownDate ? '<div class="countdown" data-date="' + countdownDate + '">' +
                    '<div class="countdown-item"><span class="cd-days">0</span><small>dias</small></div>' +
                    '<div class="countdown-item"><span class="cd-hours">0</span><small>hrs</small></div>' +
                    '<div class="countdown-item"><span class="cd-minutes">0</span><small>min</small></div>' +
                '</div>' : '') +
            '</div>' +
        '</div>';
    }).join('');
    initCountdown();
}

// ============ Countdown ============

function initCountdown() {
    document.querySelectorAll('.countdown').forEach(function(cd) {
        var date = cd.dataset.date;
        if (!date) return;
        var target = new Date(date).getTime();
        function update() {
            var diff = target - Date.now();
            if (diff <= 0) { cd.querySelectorAll('span').forEach(function(s) { s.textContent = '0'; }); return; }
            var days = Math.floor(diff / (1000 * 60 * 60 * 24));
            var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            var spans = cd.querySelectorAll('span');
            if (spans[0]) spans[0].textContent = days;
            if (spans[1]) spans[1].textContent = hours;
            if (spans[2]) spans[2].textContent = minutes;
        }
        update();
        setInterval(update, 1000);
    });
}

// ============ Mobile menu ============

function initMobileMenu() {
    var btn = document.getElementById('mobileMenuBtn');
    var nav = document.querySelector('.nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function() {
        nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
    });
}

// ============ Scroll header ============

function initScrollHeader() {
    var header = document.querySelector('.header');
    if (!header) return;
    window.addEventListener('scroll', function() {
        header.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
}

// ============ Login / Register ============

function initLoginModal() {
    var overlay = document.getElementById('loginOverlay');
    var closeBtn = document.getElementById('loginClose');
    var showRegister = document.getElementById('showRegister');
    var showLogin = document.getElementById('showLogin');
    var showLogin2 = document.getElementById('showLogin2');
    var loginForm = document.getElementById('loginForm');
    var registerForm = document.getElementById('registerForm');

    if (overlay) overlay.addEventListener('click', closeLoginModal);
    if (closeBtn) closeBtn.addEventListener('click', closeLoginModal);

    if (showRegister) {
        showRegister.addEventListener('click', function(e) {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'flex';
            document.getElementById('authTitle').textContent = 'Crear Cuenta';
            document.getElementById('authSubtitle').textContent = 'Registrate para empezar a comprar';
            resetRegSteps();
        });
    }

    if (showLogin2) {
        showLogin2.addEventListener('click', function(e) {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'flex';
            document.getElementById('authTitle').textContent = 'Iniciar Sesion';
            document.getElementById('authSubtitle').textContent = 'Accede a tu cuenta para reclamar productos';
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', function(e) {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'flex';
            document.getElementById('authTitle').textContent = 'Iniciar Sesion';
            document.getElementById('authSubtitle').textContent = 'Accede a tu cuenta para reclamar productos';
        });
    }

    var regNextBtn = document.getElementById('regNextBtn');
    var regBackBtn = document.getElementById('regBackBtn');
    if (regNextBtn) {
        regNextBtn.addEventListener('click', function() {
            var step1 = document.getElementById('regStep1');
            var required = step1.querySelectorAll('[required]');
            for (var i = 0; i < required.length; i++) {
                if (!required[i].value.trim() || !required[i].validity.valid) {
                    required[i].focus();
                    showToast('Completa todos los campos obligatorios.');
                    return;
                }
                if (required[i].id === 'regPassword2') {
                    var pw = document.getElementById('regPassword').value;
                    if (required[i].value !== pw) {
                        required[i].focus();
                        showToast('Las contrasenas no coinciden.');
                        return;
                    }
                }
            }
            goToRegStep(2);
        });
    }
    if (regBackBtn) {
        regBackBtn.addEventListener('click', function() { goToRegStep(1); });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var email = document.getElementById('loginEmail').value;
            var password = document.getElementById('loginPassword').value;

            if (email === 'admin@vintagestore.cl' && password === 'admin123') {
                var adminUser = { id: 0, name: 'Administrador', email: email, role: 'admin' };
                localStorage.setItem('vintageUser', JSON.stringify(adminUser));
                closeLoginModal();
                showToast('Bienvenido, Admin!');
                setTimeout(function() { window.location.href = 'admin.html'; }, 500);
                return;
            }

            var result = await apiPost('/users/login', { email: email, password: password });
            if (result && result.id) {
                result.role = 'client';
                localStorage.setItem('vintageUser', JSON.stringify(result));
                closeLoginModal();
                updateUserUI();
                initProducts();
                showToast('Bienvenido de vuelta, ' + result.name + '!');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var name = document.getElementById('regName').value;
            var email = document.getElementById('regEmail').value;
            var phone = document.getElementById('regPhone').value;
            var instagram = document.getElementById('regInstagram').value;
            var password = document.getElementById('regPassword').value;
            var password2 = document.getElementById('regPassword2').value;

            if (password !== password2) { showToast('Las contrasenas no coinciden.'); return; }

            var region = document.getElementById('regRegion').value;
            var comuna = document.getElementById('regComuna').value;
            var address = document.getElementById('regAddress').value;
            var addressNum = document.getElementById('regAddressNum').value;
            var addressExtra = document.getElementById('regAddressExtra').value;
            var postalCode = document.getElementById('regPostalCode').value;
            var notes = document.getElementById('regNotes').value;

            if (!region || !comuna || !address || !addressNum) {
                goToRegStep(2);
                showToast('Completa los datos de envio.');
                return;
            }

            var result = await apiPost('/users/register', {
                name: name, email: email, phone: phone, instagram: instagram, password: password,
                address: { region: region, comuna: comuna, address: address, number: addressNum, depto: addressExtra, postal_code: postalCode, notes: notes }
            });

            if (result && result.id) {
                result.role = 'client';
                localStorage.setItem('vintageUser', JSON.stringify(result));
                closeLoginModal();
                updateUserUI();
                initProducts();
                showToast('Cuenta creada. Bienvenido, ' + name + '!');
            }
        });
    }

    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeLoginModal(); });
}

function resetRegSteps() { goToRegStep(1); }

function goToRegStep(n) {
    document.querySelectorAll('.reg-step').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById('regStep' + n).classList.add('active');
    document.querySelectorAll('.step-indicator .step').forEach(function(s) {
        s.classList.toggle('active', parseInt(s.dataset.step) <= n);
        s.classList.toggle('done', parseInt(s.dataset.step) < n);
    });
}

function openLoginModal() {
    var modal = document.getElementById('loginModal');
    if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeLoginModal() {
    var modal = document.getElementById('loginModal');
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}

// ============ User UI ============

function updateUserUI() {
    var user = localStorage.getItem('vintageUser');
    var btn = document.getElementById('loginBtn');
    var cuentaBtn = document.getElementById('cuentaBtn');
    if (!btn) return;

    if (user) {
        var u = JSON.parse(user);
        btn.textContent = 'Salir';
        btn.onclick = function() {
            localStorage.removeItem('vintageUser');
            window.location.href = 'index.html';
        };
        if (cuentaBtn) {
            cuentaBtn.style.display = 'inline-flex';
            if (u.role === 'admin') {
                cuentaBtn.textContent = 'Admin';
                cuentaBtn.href = 'admin.html';
            } else {
                cuentaBtn.textContent = 'Mi Cuenta';
                cuentaBtn.href = 'cuenta.html';
            }
        }
    } else {
        btn.textContent = 'Ingresar';
        btn.onclick = function() { openLoginModal(); };
        if (cuentaBtn) cuentaBtn.style.display = 'none';
    }
}
