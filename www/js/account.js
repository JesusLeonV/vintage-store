document.addEventListener('DOMContentLoaded', function() {
    var user = JSON.parse(localStorage.getItem('vintageUser') || 'null');
    if (!user || user.role === 'admin') {
        document.getElementById('guestView').style.display = 'flex';
        document.getElementById('accountView').style.display = 'none';
        return;
    }
    document.getElementById('guestView').style.display = 'none';
    document.getElementById('accountView').style.display = 'flex';

    loadProfile(user);
    loadOrders(user);
    initNav();
    initProfileEdit(user);
    initShippingEdit(user);
    initMobileSidebar();

    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('vintageUser');
        window.location.href = 'index.html';
    });
});

function initNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            var page = btn.dataset.page;
            document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
            document.getElementById('page-' + page).classList.add('active');
        });
    });
}

function loadProfile(user) {
    var initials = (user.name || '?').split(' ').map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('sidebarName').textContent = user.name || '-';
    document.getElementById('sidebarEmail').textContent = user.email || '-';
    document.getElementById('profileName').textContent = user.name || '-';
    document.getElementById('profileEmail').textContent = user.email || '-';
    document.getElementById('infoPhone').textContent = user.phone || '-';
    document.getElementById('infoInstagram').textContent = user.instagram || 'No indicado';
    document.getElementById('infoDate').textContent = user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-CL') : '-';

    var s = user.shipping || {};
    document.getElementById('infoRegion').textContent = s.region || '-';
    document.getElementById('infoComuna').textContent = s.comuna || '-';
    document.getElementById('infoAddress').textContent = s.address || '-';
    document.getElementById('infoNumber').textContent = s.addressNum || '-';
    document.getElementById('infoExtra').textContent = s.addressExtra || '-';
    document.getElementById('infoPostal').textContent = s.postalCode || '-';
    document.getElementById('infoNotes').textContent = s.notes || '-';
}

function initProfileEdit(user) {
    var editBtn = document.getElementById('editProfileBtn');
    var cancelBtn = document.getElementById('cancelEditBtn');
    var form = document.getElementById('profileForm');
    var view = document.getElementById('profileView');

    if (editBtn) {
        editBtn.addEventListener('click', function() {
            document.getElementById('editPhone').value = user.phone || '';
            document.getElementById('editInstagram').value = user.instagram || '';
            view.style.display = 'none';
            form.style.display = 'block';
            editBtn.style.display = 'none';
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            form.style.display = 'none';
            view.style.display = '';
            editBtn.style.display = '';
        });
    }

    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var instagram = document.getElementById('editInstagram').value.trim();
            if (!instagram) {
                showToast('El usuario de Instagram es obligatorio.');
                return;
            }
            var phone = document.getElementById('editPhone').value.trim();

            try {
                await fetch('/api/users/' + user.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: user.name, phone: phone, instagram: instagram, address: null })
                });
                user.phone = phone;
                user.instagram = instagram;
                localStorage.setItem('vintageUser', JSON.stringify(user));
                loadProfile(user);
                form.style.display = 'none';
                view.style.display = '';
                editBtn.style.display = '';
                showToast('Perfil actualizado.');
            } catch (e) { showToast('Error al actualizar perfil.'); }
        });
    }
}

function initShippingEdit(user) {
    var editBtn = document.getElementById('editShippingBtn');
    var cancelBtn = document.getElementById('cancelShippingBtn');
    var form = document.getElementById('shippingForm');
    var view = document.getElementById('shippingView');

    if (editBtn) {
        editBtn.addEventListener('click', function() {
            var s = user.shipping || {};
            document.getElementById('editRegion').value = s.region || '';
            document.getElementById('editComuna').value = s.comuna || '';
            document.getElementById('editAddress').value = s.address || '';
            document.getElementById('editAddressNum').value = s.addressNum || '';
            document.getElementById('editAddressExtra').value = s.addressExtra || '';
            document.getElementById('editPostalCode').value = s.postalCode || '';
            document.getElementById('editNotes').value = s.notes || '';
            view.style.display = 'none';
            form.style.display = 'block';
            editBtn.style.display = 'none';
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            form.style.display = 'none';
            view.style.display = '';
            editBtn.style.display = '';
        });
    }

    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var region = document.getElementById('editRegion').value;
            var comuna = document.getElementById('editComuna').value.trim();
            var address = document.getElementById('editAddress').value.trim();
            var addressNum = document.getElementById('editAddressNum').value.trim();
            if (!region || !comuna || !address || !addressNum) {
                showToast('Completa region, ciudad, direccion y numero.');
                return;
            }
            var shipping = {
                region: region,
                comuna: comuna,
                address: address,
                number: addressNum,
                depto: document.getElementById('editAddressExtra').value.trim(),
                postal_code: document.getElementById('editPostalCode').value.trim(),
                notes: document.getElementById('editNotes').value.trim()
            };

            try {
                await fetch('/api/users/' + user.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: user.name, phone: user.phone, instagram: user.instagram, address: shipping })
                });
                user.shipping = {
                    region: region, comuna: comuna, address: address,
                    addressNum: addressNum, addressExtra: shipping.depto || '',
                    postalCode: shipping.postal_code || '', notes: shipping.notes || ''
                };
                localStorage.setItem('vintageUser', JSON.stringify(user));
                loadProfile(user);
                form.style.display = 'none';
                view.style.display = '';
                editBtn.style.display = '';
                showToast('Direccion de envio actualizada.');
            } catch (e) { showToast('Error al actualizar direccion.'); }
        });
    }
}

async function loadOrders(user) {
    var list = document.getElementById('ordersList');
    var countEl = document.getElementById('orderCount');

    try {
        var res = await fetch('/api/claims/user/' + user.id);
        var claims = await res.json();

        var productIds = claims.map(function(c) { return c.product_id; });
        var products = [];
        if (productIds.length) {
            var prodRes = await fetch('/api/products');
            var allProducts = await prodRes.json();
            products = allProducts.filter(function(p) { return productIds.indexOf(p.id) !== -1; });
        }

        countEl.textContent = claims.length + ' pedido' + (claims.length !== 1 ? 's' : '');

        if (!claims.length) {
            list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg><p>No tienes pedidos aun</p><a href="index.html" class="btn btn-outline btn-sm" style="margin-top:12px">Explorar productos</a></div>';
            return;
        }

        list.innerHTML = claims.map(function(c) {
            var prod = products.find(function(p) { return p.id === c.product_id; });
            var imgs = prod && prod.images ? prod.images : [];
            var img = imgs.length ? '<img src="' + imgs[0] + '" class="order-img" alt="">' : '<div class="order-img order-img-empty"></div>';

            var statusLabels = {pending:'Pendiente', confirmed:'Confirmado', preparing:'Preparando', shipped:'Enviado', received:'Recibido', rejected:'Rechazado', expired:'Expirado'};
            var statusLabel = statusLabels[c.status] || c.status;
            var statusClass = 'status-' + c.status;

            var trackingHtml = '';
            if ((c.status === 'confirmed' || c.status === 'shipped' || c.status === 'received') && c.tracking_number) {
                trackingHtml = '<a href="https://www.starken.cl/seguimiento/' + encodeURIComponent(c.tracking_number) + '" target="_blank" class="track-link">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                    'Seguimiento Starken</a>';
            } else if (c.status === 'confirmed') {
                trackingHtml = '<span class="track-link" style="opacity:.5;cursor:default">Envio pendiente de despacho</span>';
            }

            var igContact = '<a href="https://ig.me/m/vintage_store_1978" target="_blank" class="track-link" style="margin-top:8px">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>' +
                'Contactar por Instagram</a>';

            var statusSteps = ['pending', 'confirmed', 'shipped', 'received'];
            var statusStepLabels = ['Pendiente', 'Confirmado', 'Enviado', 'Recibido'];
            var currentIdx = statusSteps.indexOf(c.status);
            if (c.status === 'rejected' || c.status === 'expired') currentIdx = -1;

            var stepsHtml = '<div class="order-steps">';
            for (var i = 0; i < statusSteps.length; i++) {
                var done = currentIdx >= i;
                stepsHtml += '<div class="step' + (done ? ' done' : '') + '"><div class="step-dot"></div><span class="step-label">' + statusStepLabels[i] + '</span></div>';
                if (i < statusSteps.length - 1) stepsHtml += '<div class="step-line' + (currentIdx > i ? ' done' : '') + '"></div>';
            }
            stepsHtml += '</div>';

            var price = prod ? prod.price : 0;
            var discount = c.discount_amount || 0;
            var finalPrice = price - discount;

            return '<div class="order-card">' +
                img +
                '<div class="order-details">' +
                    '<h3>' + (prod ? prod.name : 'Producto eliminado') + '</h3>' +
                    '<div class="order-meta">' +
                        '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + new Date(c.created_at).toLocaleDateString('es-CL') + '</span>' +
                        (c.tracking_number ? '<span>Guia: ' + c.tracking_number + '</span>' : '') +
                    '</div>' +
                    stepsHtml +
                    trackingHtml +
                    igContact +
                '</div>' +
                '<div class="order-right">' +
                    '<span class="order-price">' + (discount > 0 ? '<span style="text-decoration:line-through;color:var(--text3);font-size:12px;margin-right:6px">$' + price.toLocaleString() + '</span><span style="color:var(--accent)">$' + finalPrice.toLocaleString() + '</span>' : '$' + price.toLocaleString()) + '</span>' +
                    '<div class="order-status ' + statusClass + '"><div class="status-dot"></div>' + statusLabel + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    } catch (e) {
        console.error('Error loading orders:', e);
        countEl.textContent = '0 pedidos';
        list.innerHTML = '<div class="empty-state"><p>Error al cargar pedidos.</p></div>';
    }
}

function showToast(msg) {
    var el = document.getElementById('toast');
    var msgEl = document.getElementById('toastMessage');
    if (!el || !msgEl) return;
    msgEl.textContent = msg;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 3000);
}

function initMobileSidebar() {
    var btn = document.getElementById('mobileMenuBtn');
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (!btn || !sidebar) return;
    btn.addEventListener('click', function() {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });
    if (overlay) overlay.addEventListener('click', function() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
    document.querySelectorAll('.sidebar .nav-item[data-page]').forEach(function(item) {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            }
        });
    });
}
