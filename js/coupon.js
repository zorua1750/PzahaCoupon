// pizacoupon-website/js/coupon.js

// ==== Google Sheet 資料來源 URL ====
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTKgerM5MjHdI30iz8bVxdHZW3eXnjlqQTDAOJL-HrrthyZUf2shN7FYKkjEbezPAAbUtb2uqjNVede/pub?gid=779545197&single=true&output=csv';

let allCoupons = []; // 儲存所有優惠券資料
let filteredCoupons = []; // 儲存篩選後的優惠券資料
let selectedTagFilters = new Set(); // 儲存選中的內容標籤
let selectedOrderTypeFilters = new Set(); // 儲存選中的點餐類型標籤

// ==== 數據獲取和處理 ====
async function fetchCoupons() {
    try {
        console.log('正在從 Google Sheet 載入優惠券資料...');
        const response = await fetch(GOOGLE_SHEET_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log('--- 原始 CSV 文本 (前500字元) ---');
        console.log(csvText.substring(0, 500)); // 打印部分原始 CSV 文本
        console.log('-----------------------------------');

        allCoupons = parseCSV(csvText); 
        filteredCoupons = [...allCoupons]; 

        console.log('優惠券資料已成功載入:', allCoupons.length, '條'); 

        // 初始化篩選按鈕的事件監聽
        initFilterButtons(); // 新增的初始化函數
        
        // 渲染初始優惠券列表
        renderCoupons(filteredCoupons);
        updateSearchResultCount(filteredCoupons.length);

        document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('zh-TW');

    } catch (error) {
        console.error('載入優惠券資料失敗:', error);
        console.error('詳細錯誤訊息:', error.message); 
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入優惠券資料失敗，請稍後再試。</div>';
    }
}

// ==== CSV 解析函數 ====
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
        "來源備註": "sourceNote" 
    };

    // 如果 headers 數量與 headerMap 數量不符，這裡的邏輯需要您根據實際 CSV 導出的標題來手動調整 headerMap
    if (headers.length === 8 && Object.keys(headerMap).length === 9) {
        headers.push(Object.keys(headerMap)[8]); 
        console.warn("偵測到CSV標題行比數據行少一個欄位，已自動補齊。請檢查Google Sheet。");
    }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        let currentLine = [];
        let inQuote = false;
        let currentField = '';

        for (let k = 0; k < line.length; k++) {
            const char = line[k];
            if (char === '"') {
                if (inQuote && k + 1 < line.length && line[k+1] === '"') { // 處理轉義的雙引號 ""
                    currentField += '"';
                    k++; // 跳過下一個引號
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                currentLine.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        currentLine.push(currentField.trim()); // 添加最後一個字段


        // 修正：處理 Google Sheet 導出 CSV 最後多一個空字段的問題
        if (currentLine.length > headers.length && currentLine[currentLine.length - 1].trim() === '') {
            currentLine.pop(); 
        }
        // 如果還是比headers長，就截斷
        if (currentLine.length > headers.length) {
            currentLine.length = headers.length; 
        }

        console.log(`--- 處理行 ${i} ---`);
        console.log(`原始行: "${line}"`);
        console.log(`解析後的字段: (${currentLine.length})`, currentLine.map(f => `"${f}"`).join(', '));
        
        // 檢查解析後的列數是否與標題數匹配
        if (currentLine.length !== headers.length) {
            console.warn(`跳過不完整的行（列數不匹配）：`);
            console.warn(`期望列數: ${headers.length}, 實際列數: ${currentLine.length}`);
            console.warn("這是解析失敗的行:", line);
            console.warn("解析後的字段:", currentLine);
            console.warn("期望的標題:", headers);
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

// ==== 渲染優惠券到頁面 ====
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

        // 顯示詳細內容在外層，並截斷防止過長
        const fullDescription = coupon.description || '';
        const displayDescription = fullDescription.length > 80 ? 
                                   fullDescription.substring(0, 80) + '...' : // 調整截斷長度
                                   fullDescription;
        const descriptionHtml = coupon.description ? 
            `<p class="card-text coupon-description mt-2">${displayDescription.replace(/\n/g, '<br>')}</p>` : '';

        const couponCard = `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm h-100"> 
                    <div class="card-body d-flex flex-column"> 
                        <div class="coupon-price-badge">${formattedPrice}</div> 
                        <h5 class="card-title">${coupon.name}</h5>
                        <p class="card-text">代碼: <strong>${coupon.couponCode}</strong></p>
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

    updateSearchResultCount(couponsToRender.length); 
}

// ==== 更新搜尋結果數量的函數 ====
function updateSearchResultCount(count) {
    document.getElementById('searchResultCount').textContent = count;
}

// ==== 顯示優惠券詳情 Modal 的函數 (不變) ====
function showCouponDetailModal(coupon) {
    document.getElementById('detail-title').textContent = coupon.name;
    const detailBody = document.getElementById('detail-body');
    detailBody.innerHTML = `
        <p><strong>優惠券代碼:</strong> ${coupon.couponCode}</p>
        <p><strong>價格:</strong> ${coupon.price}</p>
        <p><strong>到期日:</strong> ${coupon.endDate}</p>
        <p><strong>點餐類型:</strong> ${coupon.orderType || '不限'}</p>
        <p><strong>標籤:</strong> ${coupon.tags || '無'}</p>
        <p><strong>詳細內容:</strong><br>${(coupon.description || '').replace(/\n/g, '<br>')}</p>
    `;
    const detailModal = new bootstrap.Modal(document.getElementById('detailModel'));
    detailModal.show();
}

// ==== 新增：初始化篩選按鈕的事件監聽 ====
function initFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            button.classList.toggle('active'); // 切換 active class
            button.classList.toggle('btn-outline-primary'); // 切換未選中樣式
            button.classList.toggle('btn-primary'); // 切換選中樣式

            const filterType = button.dataset.filterType;
            const filterValue = button.dataset.filterValue.toLowerCase();

            if (button.classList.contains('active')) {
                if (filterType === 'tags') {
                    selectedTagFilters.add(filterValue);
                } else if (filterType === 'orderType') {
                    selectedOrderTypeFilters.add(filterValue);
                }
            } else {
                if (filterType === 'tags') {
                    selectedTagFilters.delete(filterValue);
                } else if (filterType === 'orderType') {
                    selectedOrderTypeFilters.delete(filterValue);
                }
            }
            performSearchAndFilter(); // 每次點擊按鈕後重新篩選
        });
    });
}

// ==== 主要搜尋與篩選邏輯 (更新以使用按鈕篩選) ====
function performSearchAndFilter() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim(); // 獲取搜尋框內容
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked; // 「同時搜尋詳細內容」的狀態

    filteredCoupons = allCoupons.filter(coupon => {
        // 1. 按鈕篩選邏輯 (標籤和點餐類型)
        let buttonFilterMatch = true;

        if (selectedTagFilters.size > 0) {
            const couponTags = String(coupon.tags || '').toLowerCase().split(',').map(tag => tag.trim());
            // 優惠券必須包含所有選中的標籤
            buttonFilterMatch = Array.from(selectedTagFilters).every(filterTag => couponTags.includes(filterTag));
        }

        if (selectedOrderTypeFilters.size > 0) {
            const couponOrderType = String(coupon.orderType || '').toLowerCase();
            // 優惠券必須至少匹配一個選中的點餐類型
            let orderTypeFound = false;
            Array.from(selectedOrderTypeFilters).forEach(filterType => {
                if (couponOrderType.includes(filterType)) { // 使用 includes 更靈活，例如 "外送/外帶" 可匹配 "外送"
                    orderTypeFound = true;
                }
            });
            buttonFilterMatch = buttonFilterMatch && orderTypeFound; // 確保與標籤篩選結果結合 (AND 關係)
        }


        // 2. 通用關鍵字搜尋邏輯 (來自搜尋框)
        let generalSearchMatch = true;
        if (searchTerm) {
            const searchableFields = [
                coupon.name,
                coupon.couponCode,
                coupon.price, // 價格也納入搜尋
                coupon.orderType,
                coupon.tags
            ].map(field => String(field || '').toLowerCase()); 

            // 如果勾選了「同時搜尋詳細內容」，則將 description 納入通用搜尋
            if (enableFlavorSearch) {
                searchableFields.push(String(coupon.description || '').toLowerCase());
            }

            generalSearchMatch = searchableFields.some(field => field.includes(searchTerm));
        }

        // 組合所有篩選條件 (按鈕篩選 AND 關鍵字搜尋)
        return buttonFilterMatch && generalSearchMatch;
    });

    // 重新排序篩選後的結果，保持排序狀態
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
                if (isNaN(dateA)) return isNaN(dateB) ? 0 : 1; 
                if (isNaN(dateB)) return -1;
                return dateA - dateB;
            });
            break;
        case 'end_date-desc': 
            sortedCoupons.sort((a, b) => {
                const dateA = new Date(a.endDate);
                const dateB = new Date(b.endDate);
                if (isNaN(dateA)) return isNaN(dateB) ? 0 : 1; 
                if (isNaN(dateB)) return -1;
                return dateB - dateA;
            });
            break;
    }
    renderCoupons(sortedCoupons);
}


// ==== DOMContentLoaded 事件監聽器 (頁面載入完成後執行) ====
document.addEventListener('DOMContentLoaded', () => {
    fetchCoupons();

    // 初始化 Bootstrap Popover
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // 回到頂部按鈕邏輯
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

    // 清除所有篩選按鈕的邏輯
    document.querySelector('.clear-all-filters-btn').addEventListener('click', () => {
        // 清空搜尋框
        document.getElementById('searchInput').value = ''; 
        // 取消所有篩選按鈕的選中狀態
        document.querySelectorAll('.filter-btn.active').forEach(button => {
            button.classList.remove('active');
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline-primary');
        });
        selectedTagFilters.clear(); // 清空選中的標籤集合
        selectedOrderTypeFilters.clear(); // 清空選中的點餐類型集合

        document.getElementById('enableFlavorSearch').checked = false; // 重置「同時搜尋詳細內容」
        document.getElementById('sortSelect').value = 'price-asc'; // 重置排序
        performSearchAndFilter(); // 重新觸發篩選和渲染
    });

    // 排序功能監聽
    document.getElementById('sortSelect').addEventListener('change', (event) => {
        sortCoupons(event.target.value);
    });

    // Tag-it 已移除，這裡不再需要初始化。
    // 如果您在 index.html 中還保留了 Tag-it 的 JS 引用，但沒用到，可以考慮移除。
    // initTagItAvailableTags() 函數現在用於獲取所有標籤，但不再用於 Tag-it UI。

    // 監聽「同時搜尋詳細內容」的變化
    document.getElementById('enableFlavorSearch').addEventListener('change', performSearchAndFilter);

    // 監聽搜尋框輸入事件
    document.getElementById('searchInput').addEventListener('input', performSearchAndFilter);
});