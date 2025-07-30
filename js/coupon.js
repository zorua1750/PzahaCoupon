// PzahaCoupon.github.io/js/coupon.js

// ==== Google Sheet 資料來源 URL ====
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTKgerM5MjHdI30iz8bVxdHZW3eXnjlqQTDAOJL-HrrthyZUf2shN7FYKkjEbezPAAbUtb2uqjNVede/pub?gid=779545197&single=true&output=csv';

let allCoupons = []; // 儲存所有優惠券資料
let filteredCoupons = []; // 儲存篩選後的優惠券資料
let selectedIncludeTags = new Set(); // 儲存選中的「包含」標籤
let selectedExcludeTags = new Set(); // 儲存選中的「排除」標籤
let selectedOrderTypes = new Set(); // 儲存選中的點餐類型

// ==== 數據獲取和處理 ====
async function fetchCoupons() {
    const spinner = document.getElementById('loading-spinner');
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        allCoupons = parseCSV(csvText);
        filteredCoupons = [...allCoupons];
        performSearchAndFilter(); // 初始渲染
        document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('zh-TW');
    } catch (error) {
        console.error('載入 PzahaCoupon 資料失敗:', error);
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入 PzahaCoupon 資料失敗，請稍後再試。</div>';
    } finally {
        if (spinner) {
            spinner.style.display = 'none';
        }
    }
}

// ==== CSV 解析函數 ====
function parseCSV(csv) {
    const lines = csv.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(header => header.trim().replace(/\r/g, ''));
    const data = [];
    const headerMap = {
        "優惠代碼": "couponCode", "名稱": "name", "套餐價格": "price", "套餐內容": "description",
        "標籤": "tags", "點餐類型": "orderType", "開始日期": "startDate", "結束日期": "endDate",
        "爬取時間": "crawlTime", "備註": "note"
    };
    
    // 簡易的 CSV 行解析，處理引號內的逗號
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = [];
        let currentField = '';
        let inQuotes = false;
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        values.push(currentField.trim());
        
        if (values.length >= headers.length) {
            const row = {};
            headers.forEach((header, j) => {
                const newKey = headerMap[header] || header;
                row[newKey] = values[j] ? values[j].replace(/\r/g, '') : '';
            });
            data.push(row);
        }
    }
    return data;
}

// ==== 渲染優惠券到頁面 ====
function renderCoupons(couponsToRender) {
    const rowContainer = document.getElementById('row');
    rowContainer.innerHTML = '';

    if (couponsToRender.length === 0) {
        rowContainer.innerHTML = '<div class="col-12 text-center text-muted mt-5">沒有找到符合條件的優惠券。</div>';
        updateSearchResultCount(0);
        return;
    }

    const fragment = document.createDocumentFragment();
    couponsToRender.forEach(coupon => {
        const priceValue = parseFloat(coupon.price);
        const formattedPrice = isNaN(priceValue) ? 'N/A' : `$${priceValue}`;
        const descriptionHtml = coupon.description ?
            `<p class="card-text coupon-description mt-2">${coupon.description.replace(/\n/g, '<br>')}</p>` : '';

        const cardDiv = document.createElement('div');
        cardDiv.className = 'col-md-4 mb-4';
        cardDiv.innerHTML = `
            <div class="card shadow-sm h-100">
                <div class="card-body d-flex flex-column">
                    <div class="coupon-price-badge">${formattedPrice}</div>
                    <h5 class="card-title">${coupon.name}</h5>
                    <p class="card-text coupon-code-display">
                        代碼: <strong class="coupon-code-text">${coupon.couponCode}</strong>
                        <i class="bi bi-files copy-code-btn" title="點擊複製代碼" data-coupon-code="${coupon.couponCode}"></i>
                    </p>
                    ${descriptionHtml}
                    <div class="mt-auto">
                        <p class="card-text mt-2"><small class="text-muted">到期日: ${coupon.endDate}</small></p>
                        <button type="button" class="btn btn-sm btn-outline-secondary view-detail-btn" data-coupon='${JSON.stringify(coupon)}'>
                            查看更多
                        </button>
                    </div>
                </div>
            </div>
        `;
        fragment.appendChild(cardDiv);
    });

    rowContainer.appendChild(fragment);
    updateSearchResultCount(couponsToRender.length);
}

// ==== 複製代碼到剪貼簿功能 ====
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalTitle = element.title;
        element.title = '已複製!';
        element.classList.replace('bi-files', 'bi-check-lg');
        setTimeout(() => {
            element.title = originalTitle;
            element.classList.replace('bi-check-lg', 'bi-files');
        }, 1500);
    }).catch(err => {
        console.error('無法複製:', err);
        alert('複製失敗，請手動複製: ' + text);
    });
}

// ==== 更新搜尋結果數量 ====
function updateSearchResultCount(count) {
    document.getElementById('searchResultCount').textContent = count;
}

// ==== 顯示優惠券詳情 Modal ====
function showCouponDetailModal(coupon) {
    document.getElementById('detail-title').textContent = coupon.name;
    const detailBody = document.getElementById('detail-body');
    detailBody.innerHTML = `
        <p><strong>優惠券代碼:</strong> ${coupon.couponCode}</p>
        <p><strong>價格:</strong> ${coupon.price}</p>
        <p><strong>到期日:</strong> ${coupon.endDate}</p>
        <p><strong>點餐類型:</strong> ${coupon.orderType || '不限'}</p>
        <p><strong>詳細內容:</strong><br>${(coupon.description || '').replace(/\n/g, '<br>')}</p>
    `;
    const detailModal = new bootstrap.Modal(document.getElementById('detailModel'));
    detailModal.show();
}

// ==== 主要搜尋與篩選邏輯 ====
function performSearchAndFilter() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked;

    filteredCoupons = allCoupons.filter(coupon => {
        const couponTags = String(coupon.tags || '').toLowerCase().split(',').map(tag => tag.trim());
        const couponOrderType = String(coupon.orderType || '').toLowerCase();

        // 包含標籤篩選
        if (selectedIncludeTags.size > 0 && ![...selectedIncludeTags].some(tag => couponTags.includes(tag))) {
            return false;
        }
        // 點餐類型篩選
        if (selectedOrderTypes.size > 0 && ![...selectedOrderTypes].some(type => couponOrderType.includes(type))) {
            return false;
        }
        // 排除標籤篩選
        if (selectedExcludeTags.size > 0 && [...selectedExcludeTags].some(tag => couponTags.includes(tag))) {
            return false;
        }
        // 關鍵字搜尋
        if (searchTerm) {
            const searchableFields = [
                String(coupon.name || '').toLowerCase(),
                String(coupon.couponCode || '').toLowerCase(),
                String(coupon.price || '').toLowerCase(),
                couponOrderType,
                ...couponTags
            ];
            if (enableFlavorSearch) {
                searchableFields.push(String(coupon.description || '').toLowerCase());
            }
            if (!searchableFields.some(field => field.includes(searchTerm))) {
                return false;
            }
        }
        return true;
    });

    sortCoupons(document.getElementById('sortSelect').value);
}

// ==== 排序邏輯 ====
function sortCoupons(sortBy) {
    const sortedCoupons = [...filteredCoupons];
    const priceSort = (a, b, desc = false) => {
        const priceA = parseFloat(a.price);
        const priceB = parseFloat(b.price);
        if (isNaN(priceA)) return 1;
        if (isNaN(priceB)) return -1;
        return desc ? priceB - priceA : priceA - priceB;
    };
    const dateSort = (a, b, desc = false) => {
        const dateA = new Date(a.endDate);
        const dateB = new Date(b.endDate);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return desc ? dateB - dateA : dateA - dateB;
    };

    switch (sortBy) {
        case 'price-asc': sortedCoupons.sort((a, b) => priceSort(a, b)); break;
        case 'price-desc': sortedCoupons.sort((a, b) => priceSort(a, b, true)); break;
        case 'coupon_code-asc': sortedCoupons.sort((a, b) => (a.couponCode || '').localeCompare(b.couponCode || '')); break;
        case 'coupon_code-desc': sortedCoupons.sort((a, b) => (b.couponCode || '').localeCompare(a.couponCode || '')); break;
        case 'end_date-asc': sortedCoupons.sort((a, b) => dateSort(a, b)); break;
        case 'end_date-desc': sortedCoupons.sort((a, b) => dateSort(a, b, true)); break;
    }
    renderCoupons(sortedCoupons);
}

// ==== 初始化所有事件監聽 ====
function initializeEventListeners() {
    // 篩選按鈕
    document.querySelectorAll('.filter-btn, .exclude-filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            // **修正核心**：只切換 .active class
            button.classList.toggle('active');
            // **修正核心**：點擊後立即讓按鈕失焦
            button.blur();

            const { filterType, filterValue } = button.dataset;
            const value = filterValue.toLowerCase();
            const isActive = button.classList.contains('active');
            
            const sets = {
                tags: selectedIncludeTags,
                excludeTags: selectedExcludeTags,
                orderType: selectedOrderTypes
            };
            
            if (isActive) {
                sets[filterType].add(value);
            } else {
                sets[filterType].delete(value);
            }
            
            performSearchAndFilter();
        });
    });

    // 清除所有篩選
    document.querySelector('.clear-all-filters-btn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.querySelectorAll('.filter-btn.active, .exclude-filter-btn.active').forEach(b => b.classList.remove('active'));
        selectedIncludeTags.clear();
        selectedExcludeTags.clear();
        selectedOrderTypes.clear();
        document.getElementById('enableFlavorSearch').checked = false;
        document.getElementById('sortSelect').value = 'price-asc';
        performSearchAndFilter();
    });

    // 排序、搜尋框、詳細搜尋開關
    document.getElementById('sortSelect').addEventListener('change', (e) => sortCoupons(e.target.value));
    document.getElementById('searchInput').addEventListener('input', performSearchAndFilter);
    document.getElementById('enableFlavorSearch').addEventListener('change', performSearchAndFilter);

    // 回到頂部按鈕
    const topBtn = document.querySelector('.top-btn');
    window.addEventListener('scroll', () => {
        topBtn.style.display = window.scrollY > 200 ? 'block' : 'none';
    });
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    
    // 事件委派：處理卡片內的點擊事件
    document.getElementById('row').addEventListener('click', (event) => {
        const detailButton = event.target.closest('.view-detail-btn');
        if (detailButton) {
            const couponData = JSON.parse(detailButton.dataset.coupon);
            showCouponDetailModal(couponData);
            return;
        }
        
        const copyButton = event.target.closest('.copy-code-btn');
        if (copyButton) {
            copyToClipboard(copyButton.dataset.couponCode, copyButton);
            return;
        }
    });

    // 夜間模式
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    body.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'dark') {
        themeToggle.querySelector('i').classList.replace('bi-moon-fill', 'bi-sun-fill');
    }

    themeToggle.addEventListener('click', () => {
        const newTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        themeToggle.querySelector('i').classList.replace(
            newTheme === 'dark' ? 'bi-moon-fill' : 'bi-sun-fill',
            newTheme === 'dark' ? 'bi-sun-fill' : 'bi-moon-fill'
        );
        localStorage.setItem('theme', newTheme);
    });

    // 初始化 Bootstrap Popover
    new bootstrap.Popover(document.getElementById('flavorSearchInfo'));
}


// ==== DOMContentLoaded 事件監聽器 (頁面載入完成後執行) ====
document.addEventListener('DOMContentLoaded', () => {
    fetchCoupons();
    initializeEventListeners();
});