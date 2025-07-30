// PzahaCoupon.github.io/js/coupon.js

// ==== Google Sheet 資料來源 URL ====
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTKgerM5MjHdI30iz8bVxdHZW3eXnjlqQTDAOJL-HrrthyZUf2shN7FYKkjEbezPAAbUtb2uqjNVede/pub?gid=779545197&single=true&output=csv';

let allCoupons = []; // 儲存所有優惠券資料
let filteredCoupons = []; // 儲存篩選後的優惠券資料
let selectedIncludeTags = new Set();
let selectedExcludeTags = new Set();
let selectedOrderTypes = new Set();

// ==== 數據獲取和處理 ====
async function fetchCoupons() {
    const spinner = document.getElementById('loading-spinner');
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const csvText = await response.text();
        allCoupons = parseCSV(csvText);
        filteredCoupons = [...allCoupons];

        initFilterButtons(); // 初始化按鈕事件
        performSearchAndFilter(); // 初始渲染
        document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('zh-TW');
    } catch (error) {
        console.error('載入 PzahaCoupon 資料失敗:', error);
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入資料失敗，請稍後再試。</div>';
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

// ==== CSV 解析函數 (使用健壯版本) ====
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

    const expectedHeaderCount = Object.keys(headerMap).length;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        let currentLine = [];
        let inQuote = false;
        let currentField = '';

        for (let k = 0; k < line.length; k++) {
            const char = line[k];
            if (char === '"') {
                if (inQuote && k + 1 < line.length && line[k+1] === '"') {
                    currentField += '"';
                    k++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                currentLine.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        currentLine.push(currentField);

        if (currentLine.length > expectedHeaderCount && currentLine[currentLine.length - 1].trim() === '') {
            currentLine.pop();
        }
        if (currentLine.length !== expectedHeaderCount) continue;

        const row = {};
        for (let j = 0; j < headers.length; j++) {
            const originalHeader = headers[j];
            const newKey = headerMap[originalHeader] || originalHeader;
            row[newKey] = String(currentLine[j] || '').trim().replace(/\r/g, '');
        }
        data.push(row);
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
        const descriptionHtml = coupon.description ? `<p class="card-text coupon-description mt-2">${coupon.description.replace(/\n/g, '<br>')}</p>` : '';

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
                        <button type="button" class="btn btn-sm btn-outline-secondary view-detail-btn" data-coupon='${JSON.stringify(coupon).replace(/'/g, "&apos;")}'>
                            查看更多
                        </button>
                    </div>
                </div>
            </div>`;
        fragment.appendChild(cardDiv);
    });
    rowContainer.appendChild(fragment);
    updateSearchResultCount(couponsToRender.length);
}

// ==== 輔助函數 ====
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        element.title = '已複製!';
        element.classList.replace('bi-files', 'bi-check-lg');
        setTimeout(() => {
            element.title = '點擊複製代碼';
            element.classList.replace('bi-check-lg', 'bi-files');
        }, 1500);
    }).catch(() => alert('複製失敗: ' + text));
}

function updateSearchResultCount(count) {
    document.getElementById('searchResultCount').textContent = count;
}

function showCouponDetailModal(coupon) {
    document.getElementById('detail-title').textContent = coupon.name;
    document.getElementById('detail-body').innerHTML = `
        <p><strong>優惠券代碼:</strong> ${coupon.couponCode}</p>
        <p><strong>價格:</strong> ${coupon.price}</p>
        <p><strong>到期日:</strong> ${coupon.endDate}</p>
        <p><strong>點餐類型:</strong> ${coupon.orderType || '不限'}</p>
        <p><strong>詳細內容:</strong><br>${(coupon.description || '').replace(/\n/g, '<br>')}</p>`;
    new bootstrap.Modal(document.getElementById('detailModel')).show();
}

// ==== 篩選、排序、事件處理 ====
function performSearchAndFilter() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked;

    filteredCoupons = allCoupons.filter(coupon => {
        const couponTags = (coupon.tags || '').toLowerCase().split(',').map(t => t.trim());
        const couponOrderType = (coupon.orderType || '').toLowerCase();

        if (selectedIncludeTags.size > 0 && ![...selectedIncludeTags].some(tag => couponTags.includes(tag))) return false;
        
        // **修正後的點餐類型篩選邏輯**：使用嚴格等於 `===`
        if (selectedOrderTypes.size > 0 && ![...selectedOrderTypes].some(type => couponOrderType === type)) return false;

        if (selectedExcludeTags.size > 0 && [...selectedExcludeTags].some(tag => couponTags.includes(tag))) return false;

        if (searchTerm) {
            const fields = [coupon.name, coupon.couponCode, coupon.price, couponOrderType, ...couponTags];
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

// ==== **最終修正**：初始化所有事件監聽 ====
function initFilterButtons() {
    document.querySelectorAll('.filter-btn, .exclude-filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            const wasActive = button.classList.contains('active');
            const { filterType, filterValue } = button.dataset;
            const value = filterValue.toLowerCase();
            const isExclude = button.classList.contains('exclude-filter-btn');

            const sets = {
                tags: selectedIncludeTags,
                excludeTags: selectedExcludeTags,
                orderType: selectedOrderTypes
            };
            const currentSet = sets[filterType];

            // 1. 更新資料模型
            if (wasActive) {
                currentSet.delete(value);
            } else {
                currentSet.add(value);
            }

            // 2. 根據新狀態明確更新 UI
            if (currentSet.has(value)) { // 如果現在應該是啟用
                button.classList.add('active');
                if (isExclude) {
                    button.classList.remove('btn-outline-danger');
                    button.classList.add('btn-danger');
                } else {
                    button.classList.remove('btn-outline-primary');
                    button.classList.add('btn-primary');
                }
            } else { // 如果現在應該是未啟用
                button.classList.remove('active');
                if (isExclude) {
                    button.classList.remove('btn-danger');
                    button.classList.add('btn-outline-danger');
                } else {
                    button.classList.remove('btn-primary');
                    button.classList.add('btn-outline-primary');
                }
            }
            
            button.blur(); // 確保失焦
            performSearchAndFilter();
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchCoupons();

    // 清除篩選
    document.querySelector('.clear-all-filters-btn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        
        document.querySelectorAll('.filter-btn.active').forEach(button => {
            button.classList.remove('active', 'btn-primary');
            button.classList.add('btn-outline-primary');
        });
        selectedIncludeTags.clear();
        selectedOrderTypes.clear();

        document.querySelectorAll('.exclude-filter-btn.active').forEach(button => {
            button.classList.remove('active', 'btn-danger');
            button.classList.add('btn-outline-danger');
        });
        selectedExcludeTags.clear();
        
        document.getElementById('enableFlavorSearch').checked = false;
        document.getElementById('sortSelect').value = 'price-asc';
        performSearchAndFilter();
    });

    // 其他控制項
    document.getElementById('sortSelect').addEventListener('change', e => sortCoupons(e.target.value));
    document.getElementById('searchInput').addEventListener('input', performSearchAndFilter);
    document.getElementById('enableFlavorSearch').addEventListener('change', performSearchAndFilter);

    // 回到頂部
    const topBtn = document.querySelector('.top-btn');
    window.addEventListener('scroll', () => {
        topBtn.style.display = window.scrollY > 200 ? 'block' : 'none';
    });
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // 事件委派
    document.getElementById('row').addEventListener('click', e => {
        const detailBtn = e.target.closest('.view-detail-btn');
        if (detailBtn) showCouponDetailModal(JSON.parse(detailBtn.dataset.coupon.replace(/&apos;/g, "'")));

        const copyBtn = e.target.closest('.copy-code-btn');
        if (copyBtn) copyToClipboard(copyBtn.dataset.couponCode, copyBtn);
    });

    // 夜間模式
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

    new bootstrap.Popover(document.getElementById('flavorSearchInfo'));
});