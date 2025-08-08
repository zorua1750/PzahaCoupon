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
        allCoupons = parseCSV(csvText); // 使用修正後的解析函數
        filteredCoupons = [...allCoupons];

        initFilterButtons(); // 初始化按鈕事件
        performSearchAndFilter(); // 初始渲染
        document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('zh-TW');

    } catch (error) {
        console.error('載入 PzahaCoupon 資料失敗:', error); 
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入 PzahaCoupon 資料失敗，請稍後再試。</div>'; 
    } finally {
        if(spinner) spinner.style.display = 'none';
    }
}

// ==== **修正後的 CSV 解析函數** ====
// 這個新版本可以正確處理包含換行符 (Alt+Enter) 的欄位
function parseCSV(csv) {
    const lines = csv.split(/\r?\n/);
    if (lines.length <= 1) {
        console.warn("CSV 數據不足或只有標題行。");
        return [];
    }

    const headers = lines[0].split(',').map(header => header.trim());
    const data = [];

    const headerMap = {
        "優惠代碼": "couponCode",
        "名稱": "name",
        "套餐價格": "price",
        "套餐內容": "description",
        "標籤": "tags",
        "點餐類型": "orderType",
        "開始日期": "startDate",
        "結束日期": "endDate",
        "爬取時間": "crawlTime", 
        "備註": "note",
        "精簡版內容": "simplifiedDescription"
    };
    
    // 將 CSV 標頭轉換為我們需要的 key
    const mappedHeaders = headers.map(h => headerMap[h] || h);

    let currentLine = '';
    for (let i = 1; i < lines.length; i++) {
        currentLine += lines[i];
        
        // 檢查引號數量是否為偶數，如果是，表示這是一行完整的資料
        if ((currentLine.match(/"/g) || []).length % 2 === 0) {
            if (currentLine.trim() === '') continue;

            const values = [];
            let inQuote = false;
            let currentField = '';

            for (let char of currentLine) {
                if (char === '"') {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentField.replace(/^"|"$/g, '').replace(/""/g, '"'));
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
            values.push(currentField.replace(/^"|"$/g, '').replace(/""/g, '"'));

            const row = {};
            for (let j = 0; j < mappedHeaders.length; j++) {
                row[mappedHeaders[j]] = values[j] || '';
            }
            data.push(row);
            currentLine = ''; // 重置 currentLine
        } else {
            // 如果引號是奇數，表示這是一個跨行的欄位，加上換行符並繼續讀取下一行
            currentLine += '\n';
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
        
        const descriptionToDisplay = coupon.simplifiedDescription || '';
        const descriptionHtml = descriptionToDisplay 
            ? `<ul class="coupon-description-list">${descriptionToDisplay.split('\n').map(line => line.trim() ? `<li>${line}</li>` : '').filter(line => line).join('')}</ul>`
            : '';

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

    // 清理舊的分享按鈕和關閉按鈕
    const oldShareBtn = detailHeader.querySelector('.share-btn');
    if (oldShareBtn) oldShareBtn.remove();
    const oldCloseBtn = detailHeader.querySelector('.btn-close');
    if (oldCloseBtn) oldCloseBtn.remove();

    // 建立新的分享按鈕並加入
    const shareBtn = document.createElement('i');
    shareBtn.className = 'bi bi-share-fill share-btn';
    shareBtn.title = '分享優惠';
    shareBtn.dataset.couponCode = coupon.couponCode;
    shareBtn.dataset.description = coupon.description;
    shareBtn.dataset.endDate = coupon.endDate;
    detailHeader.appendChild(shareBtn);
    
    detailTitle.textContent = coupon.name;
    detailBody.innerHTML = `
        <p><strong>優惠券代碼:</strong> <strong class="coupon-code-text">${coupon.couponCode}</strong> <i class="bi bi-files copy-code-btn" title="點擊複製代碼" data-coupon-code="${coupon.couponCode}"></i></p>
        <p><strong>價格:</strong> ${coupon.price}</p>
        <p><strong>到期日:</strong> ${coupon.endDate}</p>
        <p><strong>點餐類型:</strong> ${coupon.orderType || '不限'}</p>
        <p><strong>詳細內容:</strong><br>${(coupon.description || '').replace(/\n/g, '<br>')}</p>`;
    
    bootstrap.Modal.getOrCreateInstance(detailModal).show();
}

// ==== 篩選、排序、事件處理 ====
function performSearchAndFilter() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked;

    filteredCoupons = allCoupons.filter(coupon => {
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

// ==== **最終修正**：初始化所有事件監聽 ====
function initFilterButtons() {
    const handleFilterButtonClick = (button) => {
        const wasActive = button.classList.contains('active');
        const { filterType, filterValue } = button.dataset;
        const value = filterValue.toLowerCase();

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
        button.classList.toggle('active', !wasActive);
        
        button.blur();
        performSearchAndFilter();
    };

    document.querySelectorAll('.filter-btn, .exclude-filter-btn').forEach(button => {
        button.addEventListener('click', () => handleFilterButtonClick(button));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchCoupons();

    // 清除篩選
    document.querySelector('.clear-all-filters-btn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        
        document.querySelectorAll('.filter-btn.active, .exclude-filter-btn.active').forEach(button => {
            button.classList.remove('active');
        });

        selectedIncludeTags.clear();
        selectedOrderTypes.clear();
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

    // 事件委派 (主頁面)
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
            const shareText = `我在PzahaCoupon發現了一張必勝客優惠代碼:${couponCode}，${description}優惠只到${endDate}！`;
            copyToClipboard(shareText, shareBtn);
        }
    });
    
    // 事件委派 (彈出視窗)
    document.getElementById('detailModel').addEventListener('click', e => {
        const copyBtn = e.target.closest('.copy-code-btn');
        if (copyBtn) {
            copyToClipboard(copyBtn.dataset.couponCode, copyBtn);
        }

        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            const { couponCode, description, endDate } = shareBtn.dataset;
            const shareText = `我在PzahaCoupon發現了一張必勝客優惠代碼:${couponCode}，${description}優惠只到${endDate}！`;
            copyToClipboard(shareText, shareBtn);
        }
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