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
    try {
        const response = await fetch(GOOGLE_SHEET_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        allCoupons = parseCSV(csvText); 
        filteredCoupons = [...allCoupons]; 

        initFilterButtons(); 
        
        performSearchAndFilter(); 

        document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('zh-TW');

    } catch (error) {
        console.error('載入 PzahaCoupon 資料失敗:', error); 
        console.error('詳細錯誤訊息:', error.message); 
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入 PzahaCoupon 資料失敗，請稍後再試。</div>'; 
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
                                    <button type="button" class="btn btn-sm btn-outline-secondary view-detail-btn" 
                                            data-bs-toggle="modal" data-bs-target="#detailModel" 
                                            data-coupon-json='${JSON.stringify(coupon).replace(/'/g, "&apos;")}' style="width:100%;">
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

    // 移除這裡的事件監聽器，改為監聽 Modal 的 show 事件
    // document.querySelectorAll('.view-detail-btn').forEach(button => {
    //     button.addEventListener('click', (event) => {
    //         const couponData = JSON.parse(event.currentTarget.dataset.coupon.replace(/&apos;/g, "'"));
    //         showCouponDetailModal(couponData);
    //     });
    // });

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

// ==== 顯示優惠券詳情 Modal 的函數 (現在由 Modal 事件觸發) ====
// 這個函數現在將被移除，其邏輯將移到 Modal 的 'show.bs.modal' 事件監聽器中

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
        performSearchAndFilter(); 
        button.blur(); 
    };

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', (event) => handleFilterButtonClick(event.currentTarget, false));
    });

    document.querySelectorAll('.exclude-filter-btn').forEach(button => {
        button.addEventListener('click', (event) => handleFilterButtonClick(event.currentTarget, true));
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
        let includeTagsPass = true; 
        if (selectedIncludeTags.size > 0) {
            includeTagsPass = Array.from(selectedIncludeTags).some(filterTag => couponTags.includes(filterTag));
        }

        let orderTypeFilterPass = true; 
        if (selectedOrderTypes.size > 0) {
            let foundOrderTypeMatch = false; 
            Array.from(selectedOrderTypes).forEach(filterValue => {
                if (couponOrderType === filterValue) { 
                    foundOrderTypeMatch = true;
                }
            });
            orderTypeFilterPass = foundOrderTypeMatch; 
        }
        
        let finalIncludeFilterPass = includeTagsPass && orderTypeFilterPass;


        // 2. 「排除」篩選邏輯 (來自按鈕)
        let excludeFilterPass = true; 
        if (selectedExcludeTags.size > 0) {
            excludeFilterPass = !Array.from(selectedExcludeTags).some(filterTag => couponTags.includes(filterTag));
        }

        // 3. 通用關鍵字搜尋邏輯 (來自搜尋框)
        let generalSearchPass = true; 
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

// ==== 排序邏輯 (修正 N/A 價格排序) ====
function sortCoupons(sortBy) {
    let sortedCoupons = [...filteredCoupons];

    switch (sortBy) {
        case 'price-asc':
            sortedCoupons.sort((a, b) => {
                const priceA = parseFloat(a.price);
                const priceB = parseFloat(b.price);
                // 將 NaN (N/A) 價格排在最後
                if (isNaN(priceA) && isNaN(priceB)) return 0;
                if (isNaN(priceA)) return 1; // A 是 NaN，排在 B 後面 (升序)
                if (isNaN(priceB)) return -1; // B 是 NaN，排在 A 後面 (升序)
                return priceA - priceB;
            });
            break;
        case 'price-desc':
            sortedCoupons.sort((a, b) => {
                const priceA = parseFloat(a.price);
                const priceB = parseFloat(b.price);
                // 將 NaN (N/A) 價格排在最後
                if (isNaN(priceA) && isNaN(priceB)) return 0;
                if (isNaN(priceA)) return 1; // A 是 NaN，排在 B 後面 (降序)
                if (isNaN(priceB)) return -1; // B 是 NaN，排在 A 後面 (降序)
                return priceB - priceA;
            });
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

    // 夜間模式切換邏輯
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    // 載入用戶偏好主題
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.setAttribute('data-theme', savedTheme);
        if (savedTheme === 'dark') {
            themeToggle.querySelector('i').classList.replace('bi-moon-fill', 'bi-sun-fill');
        }
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        // 如果沒有保存偏好，但系統偏好是暗色模式
        body.setAttribute('data-theme', 'dark');
        themeToggle.querySelector('i').classList.replace('bi-moon-fill', 'bi-sun-fill');
    }

    themeToggle.addEventListener('click', () => {
        if (body.getAttribute('data-theme') === 'dark') {
            body.setAttribute('data-theme', 'light');
            themeToggle.querySelector('i').classList.replace('bi-sun-fill', 'bi-moon-fill');
            localStorage.setItem('theme', 'light');
        } else {
            body.setAttribute('data-theme', 'dark');
            themeToggle.querySelector('i').classList.replace('bi-moon-fill', 'bi-sun-fill');
            localStorage.setItem('theme', 'dark');
        }
    });

    // 監聽 Modal 的 show 事件來填充內容
    const detailModalElement = document.getElementById('detailModel');
    if (detailModalElement) {
        detailModalElement.addEventListener('show.bs.modal', function (event) {
            // 觸發 Modal 的按鈕
            const button = event.relatedTarget; 
            // 從 data-coupon-json 屬性中提取優惠券資料
            const couponJson = button.getAttribute('data-coupon-json');
            const couponData = JSON.parse(couponJson.replace(/&apos;/g, "'")); 

            const detailTitle = detailModalElement.querySelector('#detail-title');
            const detailBody = detailModalElement.querySelector('#detail-body');

            if (detailTitle) {
                detailTitle.textContent = couponData.name;
            }
            
            if (detailBody) {
                detailBody.innerHTML = `
                    <p><strong>優惠券代碼:</strong> ${couponData.couponCode}</p>
                    <p><strong>價格:</strong> ${couponData.price}</p>
                    <p><strong>到期日:</strong> ${couponData.endDate}</p>
                    <p><strong>點餐類型:</strong> ${couponData.orderType || '不限'}</p>
                    <p><strong>詳細內容:</strong><br>${(couponData.description || '').replace(/\n/g, '<br>')}</p>
                `;
            }
        });
    }
});