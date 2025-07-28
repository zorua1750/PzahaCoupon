// pizacoupon-website/js/coupon.js

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
        console.log('正在從 Google Sheet 載入優惠券資料...');
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

        console.log('優惠券資料已成功載入:', allCoupons.length, '條'); 
        
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
        "爬取時間": "crawlTime", // 根據您提供的CSV，這是一個額外的欄位
        "備註": "note" // 根據您提供的CSV，這是最後一個欄位
    };
    
    // 確保 headers 的長度與我們期望的數據欄位數量匹配
    const expectedHeaderCount = Object.keys(headerMap).length;
    if (headers.length !== expectedHeaderCount) {
        console.warn(`警告: CSV標題行實際列數 (${headers.length}) 與程式碼期望列數 (${expectedHeaderCount}) 不符。`);
        // 嘗試調整 headers 陣列，使其長度匹配 headerMap
        if (headers.length < expectedHeaderCount) {
            for (let k = headers.length; k < expectedHeaderCount; k++) {
                headers.push(Object.keys(headerMap)[k]); // 補足缺失的標題
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
                if (inQuote && k + 1 < line.length && line[k+1] === '"') { // 處理 "" 轉義
                    currentField += '"';
                    k++; // 跳過下一個引號
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

        // 修正：處理 Google Sheet 導出 CSV 最後多一個空字段的問題
        if (currentLine.length > expectedHeaderCount && currentLine[currentLine.length - 1].trim() === '') {
            currentLine.pop(); 
        }
        // 如果解析出的字段數量仍然不符合預期，則打印警告並跳過此行
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

// ==== 複製代碼到剪貼簿功能 ====
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


// ==== 更新搜尋結果數量的函數 ====
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

// ==== 初始化篩選按鈕的事件監聽 ====
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
        performSearchAndFilter();
    };

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => handleFilterButtonClick(button, false));
    });

    document.querySelectorAll('.exclude-filter-btn').forEach(button => {
        button.addEventListener('click', () => handleFilterButtonClick(button, true));
    });
}

// ==== 主要搜尋與篩選邏輯 (更新以處理「外帶」和「外送/外帶」精確篩選) ====
function performSearchAndFilter() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim(); 
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked; 

    filteredCoupons = allCoupons.filter(coupon => {
        // 1. 「包含」篩選邏輯 (來自按鈕)
        let includeFilterMatch = true;

        if (selectedIncludeTags.size > 0) {
            const couponTags = String(coupon.tags || '').toLowerCase().split(',').map(tag => tag.trim());
            includeFilterMatch = Array.from(selectedIncludeTags).every(filterTag => couponTags.includes(filterTag));
        }

        if (selectedOrderTypes.size > 0) {
            const couponOrderType = String(coupon.orderType || '').toLowerCase();
            let orderTypeFound = false;
            Array.from(selectedOrderTypes).forEach(filterType => {
                // **修正：點餐類型精確匹配**
                if (filterType === '外送/外帶' || filterType === '外送') { // 如果按鈕是外送/外帶或外送
                    // 則數據中必須包含 '外送' 關鍵字 (例如 '外送/外帶')
                    if (couponOrderType.includes('外送')) {
                        orderTypeFound = true;
                    }
                } else { // 其他情況，如「外帶」按鈕
                    // 確保精確匹配，同時排除「外送/外帶」這種情況
                    // 如果數據是「外送/外帶」，但篩選「外帶」，則不匹配
                    if (couponOrderType === filterType && !couponOrderType.includes('外送/外帶') && filterType === '外帶') { // 如果按鈕是「外帶」，數據也是「外帶」，則匹配
                         orderTypeFound = true;
                    } else if (couponOrderType === filterType) { // 其他精確匹配
                        orderTypeFound = true;
                    }
                }
            });
            includeFilterMatch = includeFilterMatch && orderTypeFound; 
        }

        // 2. 「排除」篩選邏輯 (來自按鈕)
        let excludeFilterMatch = true;
        if (selectedExcludeTags.size > 0) {
            const couponTags = String(coupon.tags || '').toLowerCase().split(',').map(tag => tag.trim());
            // 只要優惠券包含任何一個「排除」標籤，就不匹配
            excludeFilterMatch = !Array.from(selectedExcludeTags).some(filterTag => couponTags.includes(filterTag));
        }

        // 3. 通用關鍵字搜尋邏輯 (來自搜尋框)
        let generalSearchMatch = true;
        if (searchTerm) {
            const searchableFields = [
                coupon.name,
                coupon.couponCode,
                coupon.price, 
                coupon.orderType,
                coupon.tags
            ].map(field => String(field || '').toLowerCase()); 

            if (enableFlavorSearch) {
                searchableFields.push(String(coupon.description || '').toLowerCase());
            }

            generalSearchMatch = searchableFields.some(field => field.includes(searchTerm));
        }

        // 組合所有篩選條件 (必須同時符合「包含」篩選 AND 「排除」篩選 AND 「通用關鍵字搜尋」)
        return includeFilterMatch && excludeFilterMatch && generalSearchMatch;
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
                if (isNaN(dateA.getTime())) return isNaN(dateB.getTime()) ? 0 : 1; // 無效日期排在後面
                if (isNaN(dateB.getTime())) return -1;
                return dateA.getTime() - dateB.getTime();
            });
            break;
        case 'end_date-desc': 
            sortedCoupons.sort((a, b) => {
                const dateA = new Date(a.endDate);
                const dateB = new Date(b.endDate);
                if (isNaN(dateA.getTime())) return isNaN(dateB.getTime()) ? 0 : 1; // 無效日期排在後面
                if (isNaN(dateB.getTime())) return -1;
                return dateB.getTime() - dateA.getTime();
            });
            break;
    }
    renderCoupons(sortedCoupons);
}


// ==== DOMContentLoaded 事件監聽器 (頁面載入完成後執行) ====
document.addEventListener('DOMContentLoaded', () => {
    fetchCoupons();

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

    // 監聽「同時搜尋詳細內容」的變化
    document.getElementById('enableFlavorSearch').addEventListener('change', performSearchAndFilter);

    // 監聽搜尋框輸入事件
    document.getElementById('searchInput').addEventListener('input', performSearchAndFilter);
});