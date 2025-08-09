// PzahaCoupon.github.io/js/coupon.js

// ==== Supabase 初始化設定 ====
const SUPABASE_URL = 'https://klficsifsxcqxwqkpwav.supabase.co'; // << 請記得換成您自己的金鑰
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZmljc2lmc3hjcXh3cWtwd2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NTQ5NzksImV4cCI6MjA3MDMzMDk3OX0.X9fZuCL5h_XwZ9uC74zWevhcpmiiKvTCkDVA0xv-KrA'; // << 請記得換成您自己的金鑰

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================

let allCoupons = []; // 儲存所有優惠券資料
let filteredCoupons = []; // 儲存篩選後的優惠券資料
let selectedIncludeTags = new Set();
let selectedExcludeTags = new Set();
let selectedOrderTypes = new Set();
let favoriteCoupons = new Set();
let isViewingFavorites = false;
let couponCodeFromUrl = null;

// ==== Favorites Logic ====
function loadFavorites() {
    const savedFavorites = localStorage.getItem('pzahaFavorites');
    if (savedFavorites) {
        favoriteCoupons = new Set(JSON.parse(savedFavorites));
    }
}

function saveFavorites() {
    localStorage.setItem('pzahaFavorites', JSON.stringify([...favoriteCoupons]));
}

function toggleFavorite(couponCode) {
    if (favoriteCoupons.has(couponCode)) {
        favoriteCoupons.delete(couponCode);
    } else {
        favoriteCoupons.add(couponCode);
    }
    saveFavorites();
    if (isViewingFavorites) {
        performSearchAndFilter();
    }
}

// ==== URL Handling Logic ====
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    couponCodeFromUrl = urlParams.get('coupon');
}

function showCouponFromUrl() {
    if (couponCodeFromUrl && allCoupons.length > 0) {
        const couponToShow = allCoupons.find(c => c.couponCode === couponCodeFromUrl);
        if (couponToShow) {
            showCouponDetailModal(couponToShow);
        }
        const newUrl = window.location.pathname;
        history.replaceState({}, '', newUrl);
    }
}

// ==== 數據獲取和處理 ====
async function fetchCoupons() {
    try {
        const { data, error } = await supabaseClient
            .from('coupons')
            .select('*');

        if (error) {
            throw error;
        }

        allCoupons = data;
        filteredCoupons = [...allCoupons];

        initFilterButtons();
        performSearchAndFilter();
        document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('zh-TW');

        showCouponFromUrl();

    } catch (error) {
        console.error('載入 PzahaCoupon 資料失敗:', error);
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入 PzahaCoupon 資料失敗，請稍後再試。</div>';
    }
}

// ==== 渲染優惠券到頁面 ====
function renderCoupons(couponsToRender) {
    const rowContainer = document.getElementById('row');
    rowContainer.innerHTML = '';

    if (couponsToRender.length === 0) {
        const message = isViewingFavorites ? '您的收藏清單是空的。' : '沒有找到符合條件的優惠券。';
        rowContainer.innerHTML = `<div class="col-12 text-center text-muted mt-5">${message}</div>`;
        updateSearchResultCount(0);
        return;
    }

    const fragment = document.createDocumentFragment();
    couponsToRender.forEach(coupon => {
        const priceValue = parseFloat(coupon.price);
        const formattedPrice = isNaN(priceValue) ? 'N/A' : `$${priceValue}`;
        
        const descriptionToDisplay = coupon.simplifiedDescription || '';
        
        // 【最終修正 1】使用正規表示式來處理所有可能的換行符號
        const descriptionHtml = descriptionToDisplay
            ? `<ul class="coupon-description-list">${descriptionToDisplay.split(/\n|\\n/g).map(line => line.trim() ? `<li>${line}</li>` : '').filter(line => line).join('')}</ul>`
            : '';
        
        const isFavorited = favoriteCoupons.has(coupon.couponCode);

        const cardDiv = document.createElement('div');
        cardDiv.className = 'col-md-4 mb-4';
        cardDiv.innerHTML = `
            <div class="card shadow-sm h-100">
                <div class="card-top-right-actions">
                    <i class="bi ${isFavorited ? 'bi-bookmark-fill' : 'bi-bookmark'} bookmark-btn ${isFavorited ? 'favorited' : ''}" title="收藏此優惠券" data-coupon-code="${coupon.couponCode}"></i>
                    <div class="coupon-price-badge">${formattedPrice}</div>
                </div>
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${coupon.name}</h5>
                    <p class="card-text coupon-code-display">
                        代碼: <strong class="coupon-code-text">${coupon.couponCode}</strong>
                        <i class="bi bi-files copy-code-btn" title="點擊複製代碼" data-coupon-code="${coupon.couponCode}"></i>
                    </p>
                    ${descriptionHtml}
                    <div class="mt-auto">
                        <p class="card-text mt-2"><small class="text-muted">到期日: ${coupon.endDate}</small></p>
                         <div class="coupon-actions">
                            <button type="button" class="btn btn-sm btn-outline-secondary view-detail-btn" data-coupon-json='${JSON.stringify(coupon).replace(/'/g, "&apos;")}'>
                                查看詳情
                            </button>
                            <i class="bi bi-share-fill share-btn" title="分享優惠" data-coupon-code="${coupon.couponCode}" data-description="${coupon.description}" data-end-date="${coupon.endDate}"></i>
                        </div>
                    </div>
                </div>
            </div>`;
        fragment.appendChild(cardDiv);
    });
    rowContainer.appendChild(fragment);
    updateSearchResultCount(couponsToRender.length);

    if (typeof startSiteTour === 'function' && !couponCodeFromUrl) {
        startSiteTour();
    }
}

// ==== 輔助函數 ====
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalTitle = element.title;
        element.title = '已複製!';
        const originalIcon = element.className;
        element.className = originalIcon.includes('bi-share-fill') ? 'bi bi-check-lg share-btn text-success' : 'bi bi-check-lg copy-code-btn text-success';
        setTimeout(() => {
            element.title = originalTitle;
            element.className = originalIcon;
        }, 1500);
    }).catch(() => alert('複製失敗: ' + text));
}

function updateSearchResultCount(count) {
    document.getElementById('searchResultCount').textContent = count;
}

// ==== 顯示優惠券詳情 Modal ====
function showCouponDetailModal(coupon) {
    const detailModal = document.getElementById('detailModel');
    const detailTitle = detailModal.querySelector('#detail-title');
    const detailBody = detailModal.querySelector('#detail-body');
    const detailHeader = detailModal.querySelector('.modal-header');

    const oldShareBtn = detailHeader.querySelector('.share-btn');
    if (oldShareBtn) oldShareBtn.remove();
    const oldCloseBtn = detailHeader.querySelector('.btn-close');
    if (oldCloseBtn) oldCloseBtn.remove();

    const shareBtn = document.createElement('i');
    shareBtn.className = 'bi bi-share-fill share-btn';
    shareBtn.title = '分享優惠';
    shareBtn.dataset.couponCode = coupon.couponCode;
    shareBtn.dataset.description = coupon.description;
    shareBtn.dataset.endDate = coupon.endDate;
    detailHeader.appendChild(shareBtn);
    
    detailTitle.textContent = coupon.name;
    
    // 【最終修正 2】使用正規表示式來處理所有可能的換行符號
    detailBody.innerHTML = `
        <p><strong>優惠券代碼:</strong> <strong class="coupon-code-text">${coupon.couponCode}</strong> <i class="bi bi-files copy-code-btn" title="點擊複製代碼" data-coupon-code="${coupon.couponCode}"></i></p>
        <p><strong>價格:</strong> ${coupon.price}</p>
        <p><strong>到期日:</strong> ${coupon.endDate}</p>
        <p><strong>點餐類型:</strong> ${coupon.orderType || '不限'}</p>
        <p><strong>詳細內容:</strong><br>${(coupon.description || '').replace(/\n|\\n/g, '<br>')}</p>`;
    
    bootstrap.Modal.getOrCreateInstance(detailModal).show();
}

// ==== 篩選、排序、事件處理 (以下程式碼不變) ====
function performSearchAndFilter() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked;

    let couponsToProcess = allCoupons;
    if (isViewingFavorites) {
        couponsToProcess = allCoupons.filter(c => favoriteCoupons.has(c.couponCode));
    }

    filteredCoupons = couponsToProcess.filter(coupon => {
        const couponTags = (coupon.tags || '').toLowerCase().split(',').map(t => t.trim());
        const couponOrderType = (coupon.orderType || '').toLowerCase();
        
        if (selectedIncludeTags.size > 0 && ![...selectedIncludeTags].some(tag => couponTags.includes(tag))) return false;
        if (selectedOrderTypes.size > 0 && ![...selectedOrderTypes].some(type => couponOrderType === type)) return false;
        if (selectedExcludeTags.size > 0 && [...selectedExcludeTags].some(tag => couponTags.includes(tag))) return false;

        if (searchTerm) {
            const fields = [coupon.name, coupon.couponCode, coupon.price, couponOrderType, coupon.simplifiedDescription, ...couponTags];
            if (enableFlavorSearch) fields.push(coupon.description);
            if (!fields.some(f => (f || '').toLowerCase().includes(searchTerm))) return false;
        }
        return true;
    });
    sortCoupons(document.getElementById('sortSelect').value);
}

function sortCoupons(sortBy) {
    const sorters = {
        'price-asc': (a, b) => (parseFloat(a.price) || Infinity) - (parseFloat(b.price) || Infinity),
        'price-desc': (a, b) => (parseFloat(b.price) || -Infinity) - (parseFloat(a.price) || -Infinity),
        'coupon_code-asc': (a, b) => (a.couponCode || '').localeCompare(b.couponCode || ''),
        'coupon_code-desc': (a, b) => (b.couponCode || '').localeCompare(a.couponCode || ''),
        'end_date-asc': (a, b) => new Date(a.endDate) - new Date(b.endDate),
        'end_date-desc': (a, b) => new Date(b.endDate) - new Date(a.endDate)
    };
    renderCoupons([...filteredCoupons].sort(sorters[sortBy]));
}

function initFilterButtons() {
    const handleFilterButtonClick = (button) => {
        const { filterType, filterValue } = button.dataset;
        const value = filterValue.toLowerCase();

        const sets = {
            tags: selectedIncludeTags,
            excludeTags: selectedExcludeTags,
            orderType: selectedOrderTypes
        };
        const currentSet = sets[filterType];

        button.classList.toggle('active') ? currentSet.add(value) : currentSet.delete(value);
        
        button.blur();
        performSearchAndFilter();
    };

    document.querySelectorAll('.filter-btn, .exclude-filter-btn').forEach(button => {
        button.addEventListener('click', () => handleFilterButtonClick(button));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadFavorites();
    handleUrlParameters();
    fetchCoupons();

    function resetAllFilters() {
        document.getElementById('searchInput').value = '';
        
        document.querySelectorAll('.filter-btn.active, .exclude-filter-btn.active').forEach(button => {
            button.classList.remove('active');
        });

        selectedIncludeTags.clear();
        selectedOrderTypes.clear();
        selectedExcludeTags.clear();
        
        document.getElementById('enableFlavorSearch').checked = false;
        document.getElementById('sortSelect').value = 'price-asc';
        
        isViewingFavorites = false;
        document.getElementById('favoritesBtn').classList.remove('active');

        performSearchAndFilter();
    }

    document.querySelector('.clear-all-filters-btn').addEventListener('click', resetAllFilters);

    document.getElementById('favoritesBtn').addEventListener('click', (e) => {
        isViewingFavorites = !isViewingFavorites;
        e.currentTarget.classList.toggle('active', isViewingFavorites);
        performSearchAndFilter();
    });

    document.getElementById('sortSelect').addEventListener('change', e => sortCoupons(e.target.value));
    document.getElementById('searchInput').addEventListener('input', performSearchAndFilter);
    document.getElementById('enableFlavorSearch').addEventListener('change', performSearchAndFilter);

    const topBtn = document.querySelector('.top-btn');
    window.addEventListener('scroll', () => {
        topBtn.style.display = window.scrollY > 200 ? 'block' : 'none';
    });
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Event Delegation for main content
    document.getElementById('row').addEventListener('click', e => {
        const detailBtn = e.target.closest('.view-detail-btn');
        if (detailBtn) {
            const couponData = JSON.parse(detailBtn.dataset.couponJson.replace(/&apos;/g, "'"));
            showCouponDetailModal(couponData);
        }

        const copyBtn = e.target.closest('.copy-code-btn');
        if (copyBtn) {
            copyToClipboard(copyBtn.dataset.couponCode, copyBtn);
        }
        
        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            const { couponCode, description, endDate } = shareBtn.dataset;
            const baseUrl = window.location.origin + window.location.pathname;
            const shareUrl = `${baseUrl}?coupon=${couponCode}`;
            const shareText = `我在PzahaCoupon發現了一張必勝客優惠代碼:${couponCode}，${description}優惠只到${endDate}！\n\n快來看看：${shareUrl}`;
            copyToClipboard(shareText, shareBtn);
        }

        const bookmarkBtn = e.target.closest('.bookmark-btn');
        if (bookmarkBtn) {
            const { couponCode } = bookmarkBtn.dataset;
            toggleFavorite(couponCode);
            bookmarkBtn.classList.toggle('favorited');
            bookmarkBtn.classList.toggle('bi-bookmark');
            bookmarkBtn.classList.toggle('bi-bookmark-fill');
        }
    });
    
    // Event Delegation for Modal
    const detailModalEl = document.getElementById('detailModel');
    detailModalEl.addEventListener('click', e => {
        const copyBtn = e.target.closest('.copy-code-btn');
        if (copyBtn) {
            copyToClipboard(copyBtn.dataset.couponCode, copyBtn);
        }

        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            const { couponCode, description, endDate } = shareBtn.dataset;
            const baseUrl = window.location.origin + window.location.pathname;
            const shareUrl = `${baseUrl}?coupon=${couponCode}`;
            const shareText = `我在PzahaCoupon發現了一張必勝客優惠代碼:${couponCode}，${description}優惠只到${endDate}！\n\n快來看看：${shareUrl}`;
            copyToClipboard(shareText, shareBtn);
        }
    });

    detailModalEl.addEventListener('hidden.bs.modal', () => {
        if (couponCodeFromUrl && typeof startSiteTour === 'function') {
            startSiteTour();
            couponCodeFromUrl = null; 
        }
    });


    // Dark Mode
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');

    body.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'dark') {
        themeToggle.querySelector('i').classList.replace('bi-moon-fill', 'bi-sun-fill');
    }

    themeToggle.addEventListener('click', () => {
        const newTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.querySelector('i').classList.toggle('bi-moon-fill', newTheme === 'light');
        themeToggle.querySelector('i').classList.toggle('bi-sun-fill', newTheme === 'dark');
    });
});