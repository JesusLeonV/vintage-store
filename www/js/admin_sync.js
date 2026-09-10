function syncAPIProducts(callback) {
    fetch('/api/products').then(function(r) { return r.json(); }).then(function(apiProducts) {
        var products = apiProducts.map(function(p) {
            return {
                id: p.id, name: p.name, category: p.category, description: p.description || '',
                originalPrice: p.original_price || 0, price: p.price, stock: p.stock || 0,
                tag: p.tag || '', tagClass: p.tag_class || '',
                status: p.status === 'available' ? 'available' : p.status === 'scheduled' ? 'scheduled' : 'draft',
                scheduledAt: p.scheduled_at || null, images: p.images || [], createdAt: p.created_at
            };
        });
        localStorage.setItem('adminProducts', JSON.stringify(products));
        if (callback) callback();
    }).catch(function(e) { console.error('Sync products error:', e); if (callback) callback(); });
}

function syncAPIClaims(callback) {
    fetch('/api/claims').then(function(r) { return r.json(); }).then(function(apiClaims) {
        var claims = apiClaims.map(function(c) {
            return {
                id: c.id, userId: c.user_id, productId: c.product_id,
                userName: c.user_name, userEmail: c.user_email,
                userInstagram: c.user_instagram || '', userPhone: c.user_phone || '',
                status: c.status, date: c.created_at, confirmedAt: c.confirmed_at,
                shippedAt: c.shipped_at, receivedAt: c.received_at,
                discountCode: c.discount_code_id ? (c.discount_code || '') : null,
                discountedPrice: c.product_price - (c.discount_amount || 0),
                trackingNumber: c.tracking_number || null
            };
        });
        localStorage.setItem('adminClaims', JSON.stringify(claims));
        if (callback) callback();
    }).catch(function(e) { console.error('Sync claims error:', e); if (callback) callback(); });
}

function syncAPIUsers(callback) {
    fetch('/api/claims').then(function(r) { return r.json(); }).then(function(apiClaims) {
        var usersMap = {};
        apiClaims.forEach(function(c) {
            if (!usersMap[c.user_id]) {
                usersMap[c.user_id] = {
                    id: c.user_id, name: c.user_name, email: c.user_email,
                    phone: c.user_phone || '', instagram: c.user_instagram || '',
                    createdAt: c.created_at
                };
            }
        });
        localStorage.setItem('vintageUsers', JSON.stringify(Object.values(usersMap)));
        if (callback) callback();
    }).catch(function(e) { console.error('Sync users error:', e); if (callback) callback(); });
}

function syncAllFromAPI(callback) {
    var pending = 3;
    function done() { pending--; if (pending <= 0 && callback) callback(); }
    syncAPIProducts(done);
    syncAPIClaims(done);
    syncAPIUsers(done);
}

document.addEventListener('DOMContentLoaded', function() {
    syncAllFromAPI(function() {
        if (typeof loadDashboard === 'function') loadDashboard();
        var activePage = document.querySelector('.nav-item.active[data-page]');
        if (activePage) {
            var pg = activePage.dataset.page;
            if (pg === 'products' && typeof loadProducts === 'function') loadProducts();
            if (pg === 'claims' && typeof loadClaims === 'function') loadClaims();
            if (pg === 'history' && typeof loadHistory === 'function') loadHistory();
            if (pg === 'publish' && typeof loadPublish === 'function') loadPublish();
            if (pg === 'categories' && typeof renderCategories === 'function') renderCategories();
            if (pg === 'users' && typeof loadUsers === 'function') loadUsers();
            if (pg === 'discounts' && typeof loadDiscounts === 'function') loadDiscounts();
        }
    });
});
