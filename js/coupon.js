// PzahaCoupon-website/js/coupon.js (檔案路徑名稱也建議修改)

// ==== Google Sheet 資料來源 URL ====
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTKgerM5MjHdI30iz8bVxdHZW3eXnjlqQTDAOJL-HrrthyZUf2shN7FYKkjEbezPAAbUtb2uqjNVede/pub?gid=779545197&single=true&output=csv';

let allCoupons = []; // 儲存所有優惠券資料
let filteredCoupons = []; // 儲存篩選後的優惠券資料
let selectedIncludeTags = new Set(); // 儲存選中的「包含」標籤
let selectedExcludeTags = new Set(); // 儲存選中的「排除」標籤
let selectedOrderTypes = new Set(); // 儲存選中的點餐類型

// ==== 數據獲取和處理 ====
async function fetchCoupons() {
    try {
        console.log('正在從 Google Sheet 載入 PzahaCoupon 資料...'); // 已修改
        const response = await fetch(GOOGLE_SHEET_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log('--- 原始 CSV 文本 (前500字元) ---');
        console.log(csvText.substring(0, 500)); 
        console.log('-----------------------------------');

        allCoupons = parseCSV(csvText); 
        filteredCoupons = [...allCoupons]; 

        console.log('PzahaCoupon 資料已成功載入:', allCoupons.length, '條'); // 已修改

        // 初始化篩選按鈕的事件監聽
        initFilterButtons(); 
        
        // 渲染初始優惠券列表
        renderCoupons(filteredCoupons);
        updateSearchResultCount(filteredCoupons.length);

        document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('zh-TW');

    } catch (error) {
        console.error('載入 PzahaCoupon 資料失敗:', error); // 已修改
        console.error('詳細錯誤訊息:', error.message); 
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入 PzahaCoupon 資料失敗，請稍後再試。</div>'; // 已修改
    }
}

// ==== CSV 解析函數 (維持現有工作版本) ====
function parseCSV(csv) {
    const lines = csv.split(/\r?\n/).filter(line => line.trim() !== ''); 
    if (lines.length <= 1) { 
        console.warn("CSV 數據不足或只有標題行。");
        return [];
    }

    const headers = lines[0].split(',').map(header => header.trim().replace(/\r/g, '')); 
    console.log('--- 解析後的標題 ---');
    console.log(headers);
    console.log('期望的標題數量:', headers.length);
    console.log('--------------------');

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
        "備註": "note" 
    };
    
    const expectedHeaderCount = Object.keys(headerMap).length;
    if (headers.length !== expectedHeaderCount) {
        console.warn(`警告: CSV標題行實際列數 (${headers.length}) 與程式碼期望列數 (${expectedHeaderCount}) 不符。`);
        if (headers.length < expectedHeaderCount) {
            for (let k = headers.length; k < expectedHeaderCount; k++) {
                headers.push(Object.keys(headerMap)[k]); 
            }
        }
    }

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
        if (currentLine.length !== expectedHeaderCount) {
            console.warn(`跳過不完整的行（列數不匹配）：`);
            console.warn(`期望列數: ${expectedHeaderCount}, 實際列數: ${currentLine.length}`);
            console.warn("這是解析失敗的行:", line);
            console.warn("解析後的字段:", currentLine.map(f => `"${f}"`).join(', ')); 
            console.warn("期望的標題:", headers.map(h => `"${h}"`).join(', '));
            continue; 
        } 
        
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

// ==== 渲染優惠券到頁面 (更新以顯示複製按鈕) ====
function renderCoupons(couponsToRender) {
    const rowContainer = document.getElementById('row');
    rowContainer.innerHTML = ''; 

    if (couponsToRender.length === 0) {
        rowContainer.innerHTML = '<div class="col-12 text-center text-muted mt-5">沒有找到符合條件的優惠券。</div>';
        updateSearchResultCount(0); 
        return;
    }

    couponsToRender.forEach(coupon => {
        const priceValue = parseFloat(coupon.price);
        const formattedPrice = isNaN(priceValue) ? 'N/A' : `$${priceValue}`; 

        const fullDescription = coupon.description || '';
        const displayDescription = fullDescription.length > 100 ? 
                                   fullDescription.substring(0, 100) + '...' : 
                                   fullDescription;
        const descriptionHtml = coupon.description ? 
            `<p class="card-text coupon-description mt-2">${displayDescription.replace(/\n/g, '<br>')}</p>` : '';

        const couponCard = `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm h-100"> 
                    <div class="card-body d-flex flex-column"> 
                        <div class="coupon-price-badge">${formattedPrice}</div> 
                        <h5 class="card-title">${coupon.name}</h5>
                        <p class="card-text coupon-code-display">
                            代碼: <strong class="coupon-code-text" data-coupon-code="${coupon.couponCode}">${coupon.couponCode}</strong> 
                            <i class="bi bi-files copy-code-btn" title="點擊複製代碼" data-coupon-code="${coupon.couponCode}"></i>
                        </p>
                        ${descriptionHtml} 
                        <div class="mt-auto"> 
                            <p class="card-text mt-2"><small class="text-muted">到期日: ${coupon.endDate}</small></p>
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="btn-group w-100"> 
                                    <button type="button" class="btn btn-sm btn-outline-secondary view-detail-btn" data-coupon='${JSON.stringify(coupon).replace(/'/g, "&apos;")}' style="width:100%;">
                                        查看更多
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        rowContainer.insertAdjacentHTML('beforeend', couponCard);
    });

    document.querySelectorAll('.view-detail-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const couponData = JSON.parse(event.currentTarget.dataset.coupon.replace(/&apos;/g, "'"));
            showCouponDetailModal(couponData);
        });
    });

    document.querySelectorAll('.copy-code-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const couponCode = event.currentTarget.dataset.couponCode;
            copyToClipboard(couponCode, event.currentTarget);
        });
    });

    updateSearchResultCount(couponsToRender.length); 
}

// ==== 複製代碼到剪貼簿功能 (不變) ====
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalTitle = element.title;
        element.title = '已複製!';
        element.classList.remove('bi-files');
        element.classList.add('bi-check-lg'); 
        
        setTimeout(() => {
            element.title = originalTitle;
            element.classList.remove('bi-check-lg');
            element.classList.add('bi-files');
        }, 1500);
    }).catch(err => {
        console.error('無法複製:', err);
        alert('複製失敗，請手動複製: ' + text);
    });
}


// ==== 更新搜尋結果數量的函數 (不變) ====
function updateSearchResultCount(count) {
    document.getElementById('searchResultCount').textContent = count;
}

// ==== 顯示優惠券詳情 Modal 的函數 (移除標籤顯示) ====
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

// ==== 初始化篩選按鈕的事件監聽 (更新篩選邏輯和清除按鈕) ====
function initFilterButtons() {
    // 通用處理函數
    const handleFilterButtonClick = (button, isExclude = false) => {
        button.classList.toggle('active');
        if (isExclude) {
            button.classList.toggle('btn-outline-danger');
            button.classList.toggle('btn-danger');
        } else {
            button.classList.toggle('btn-outline-primary');
            button.classList.toggle('btn-primary');
        }

        const filterType = button.dataset.filterType;
        const filterValue = button.dataset.filterValue.toLowerCase();

        if (button.classList.contains('active')) {
            if (filterType === 'tags') {
                selectedIncludeTags.add(filterValue);
            } else if (filterType === 'excludeTags') {
                selectedExcludeTags.add(filterValue);
            } else if (filterType === 'orderType') {
                selectedOrderTypes.add(filterValue);
            }
        } else {
            if (filterType === 'tags') {
                selectedIncludeTags.delete(filterValue);
            } else if (filterType === 'excludeTags') {
                selectedExcludeTags.delete(filterValue);
            } else if (filterType === 'orderType') {
                selectedOrderTypes.delete(filterValue);
            }
        }
        performSearchAndFilter(); // 每次點擊按鈕後重新篩選
    };

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => handleFilterButtonClick(button, false));
    });

    document.querySelectorAll('.exclude-filter-btn').forEach(button => {
        button.addEventListener('click', () => handleFilterButtonClick(button, true));
    });
}

// ==== 主要搜尋與篩選邏輯 (更新精確篩選和排除邏輯) ====
function performSearchAndFilter() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim(); 
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked; 

    filteredCoupons = allCoupons.filter(coupon => {
        const couponName = String(coupon.name || '').toLowerCase();
        const couponCode = String(coupon.couponCode || '').toLowerCase();
        const couponDescription = String(coupon.description || '').toLowerCase();
        const couponTags = String(coupon.tags || '').toLowerCase().split(',').map(tag => tag.trim());
        const couponOrderType = String(coupon.orderType || '').toLowerCase();


        // 1. 「包含」篩選邏輯 (來自按鈕)
        let includeTagsPass = true; // 預設標籤篩選通過
        if (selectedIncludeTags.size > 0) {
            // 只要優惠券的標籤包含選中的任何一個「包含」標籤，就匹配
            includeTagsPass = Array.from(selectedIncludeTags).some(filterTag => couponTags.includes(filterTag));
        }

        let orderTypeFilterPass = true; // 預設點餐類型篩選通過
        if (selectedOrderTypes.size > 0) {
            let foundOrderTypeMatch = false; 
            Array.from(selectedOrderTypes).forEach(filterValue => {
                if (couponOrderType === filterValue) { 
                    foundOrderTypeMatch = true;
                }
            });
            orderTypeFilterPass = foundOrderTypeMatch; 
        }
        
        // 最終包含篩選必須同時滿足選中的標籤和點餐類型
        let finalIncludeFilterPass = includeTagsPass && orderTypeFilterPass;


        // 2. 「排除」篩選邏輯 (來自按鈕)
        let excludeFilterPass = true; // 預設通過
        if (selectedExcludeTags.size > 0) {
            // 只要優惠券包含任何一個「排除」標籤，就不匹配
            excludeFilterPass = !Array.from(selectedExcludeTags).some(filterTag => couponTags.includes(filterTag));
        }

        // 3. 通用關鍵字搜尋邏輯 (來自搜尋框)
        let generalSearchPass = true; // 預設通過
        if (searchTerm) {
            const searchableFields = [
                couponName,
                couponCode,
                String(coupon.price || '').toLowerCase(), 
                couponOrderType,
                String(coupon.tags || '').toLowerCase()
            ]; 

            if (enableFlavorSearch) {
                searchableFields.push(couponDescription); 
            }

            generalSearchPass = searchableFields.some(field => field.includes(searchTerm));
        }

        // 組合所有篩選條件
        return finalIncludeFilterPass && excludeFilterPass && generalSearchPass;
    });

    sortCoupons(document.getElementById('sortSelect').value);
}

// ==== 排序邏輯 (不變) ====
function sortCoupons(sortBy) {
    let sortedCoupons = [...filteredCoupons];

    switch (sortBy) {
        case 'price-asc':
            sortedCoupons.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
            break;
        case 'price-desc':
            sortedCoupons.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
            break;
        case 'coupon_code-asc': 
            sortedCoupons.sort((a, b) => (a.couponCode || '').localeCompare(b.couponCode || ''));
            break;
        case 'coupon_code-desc': 
            sortedCoupons.sort((a, b) => (b.couponCode || '').localeCompare(a.couponCode || ''));
            break;
        case 'end_date-asc': 
            sortedCoupons.sort((a, b) => {
                const dateA = new Date(a.endDate);
                const dateB = new Date(b.endDate);
                if (isNaN(dateA.getTime())) return isNaN(dateB.getTime()) ? 0 : 1; 
                if (isNaN(dateB.getTime())) return -1;
                return dateA.getTime() - dateB.getTime();
            });
            break;
        case 'end_date-desc': 
            sortedCoupons.sort((a, b) => {
                const dateA = new Date(a.endDate);
                const dateB = new Date(b.endDate);
                if (isNaN(dateA.getTime())) return isNaN(dateB.getTime()) ? 0 : 1; 
                if (isNaN(dateB.getTime())) return -1;
                return dateB.getTime() - dateA.getTime();
            });
            break;
    }
    renderCoupons(sortedCoupons);
}


// ==== DOMContentLoaded 事件監聽器 (頁面載入完成後執行) ====
document.addEventListener('DOMContentLoaded', () => {
    fetchCoupons(); // 啟動數據載入

    // 初始化 Bootstrap Popover
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    const topBtn = document.querySelector('.top-btn');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            topBtn.style.display = 'block';
        } else {
            topBtn.style.display = 'none';
        }
    });
    topBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

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

    document.getElementById('sortSelect').addEventListener('change', (event) => {
        sortCoupons(event.target.value);
    });

    document.getElementById('enableFlavorSearch').addEventListener('change', performSearchAndFilter);

    document.getElementById('searchInput').addEventListener('input', performSearchAndFilter);
});