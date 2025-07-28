// pizacoupon-website/js/coupon.js

// ==== Google Sheet 資料來源 URL ====
// 請確保這是您從 Google Sheet 發佈到網路後得到的 CSV 連結
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTKgerM5MjHdI30iz8bVxdHZW3eXnjlqQTDAOJL-HrrthyZUf2shN7FYKkjEbezPAAbUtb2uqjNVede/pub?gid=779545197&single=true&output=csv';

let allCoupons = []; // 用於儲存所有優惠券資料的陣列
let filteredCoupons = []; // 用於儲存篩選後的優惠券資料

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
        filteredCoupons = [...allCoupons]; // 初始化時，篩選的資料等於所有資料

        console.log('優惠券資料已成功載入:', allCoupons.length, '條'); // 打印載入的條目數

        // 初始化標籤建議（從所有優惠券的標籤中提取）
        initTagItAvailableTags();
        
        // 渲染初始優惠券列表
        renderCoupons(filteredCoupons);
        updateSearchResultCount(filteredCoupons.length);

        // 更新最後更新時間 (您可以從 Google Sheet 中獲取，或手動設定)
        document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('zh-TW');

    } catch (error) {
        console.error('載入優惠券資料失敗:', error);
        console.error('詳細錯誤訊息:', error.message); // 打印更詳細的錯誤訊息
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入優惠券資料失敗，請稍後再試。</div>';
    }
}

// ==== CSV 解析函數 ====
// 根據您提供的 Google Sheet 欄位名稱進行解析和映射
function parseCSV(csv) {
    const lines = csv.split(/\r?\n/).filter(line => line.trim() !== ''); // 處理不同換行符，並移除空行
    if (lines.length <= 1) { // 至少需要標題行和一行數據
        console.warn("CSV 數據不足或只有標題行。");
        return [];
    }

    // 清理標題，移除空白並確保正確分割。
    const headers = lines[0].split(',').map(header => header.trim().replace(/\r/g, '')); 
    console.log('--- 解析後的標題 ---');
    console.log(headers);
    console.log('期望的標題數量:', headers.length);
    console.log('--------------------');

    const data = [];

    // 定義中文標題到英文 key 的映射
    // 再次確認這裡的中文鍵名與您Google Sheet發佈的CSV第一行完全一致
    // 根據您提供的錯誤訊息，CSV實際有9個欄位，最後一個是「來源備註」
    const headerMap = {
        "優惠代碼": "couponCode",
        "名稱": "name",
        "套餐價格": "price",
        "套餐內容": "description",
        "標籤": "tags",
        "點餐類型": "orderType",
        "開始日期": "startDate",
        "結束日期": "endDate",
        "來源備註": "sourceNote" // 假設這是第9個欄位
    };

    // 如果 headers 數量與 headerMap 數量不符，這裡的邏輯需要您根據實際 CSV 導出的標題來手動調整 headerMap
    if (headers.length === 8 && Object.keys(headerMap).length === 9) {
        headers.push(Object.keys(headerMap)[8]); // 將headerMap的最後一個中文鍵名添加到headers
        console.warn("偵測到CSV標題行比數據行少一個欄位，已自動補齊。請檢查Google Sheet。");
    }


    // **核心修正：更簡單且更直接的 CSV 行解析方法**
    // 這種方法可能無法完美處理包含逗號的引號字段，但對於 Google Sheets 導出且格式相對規律的 CSV 可能更有效
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        let currentLine = line.split(','); // 最簡單的逗號分割

        // 處理行末可能因多餘逗號產生的空字串字段
        // 如果 currentLine 比 headers 長一個，並且多的那個是空字串，就將其移除
        if (currentLine.length === headers.length + 1 && currentLine[currentLine.length - 1].trim() === '') {
            currentLine.pop(); 
        }

        console.log(`--- 處理行 ${i} ---`);
        console.log(`原始行: "${line}"`);
        console.log(`分割後的字段: (${currentLine.length})`, currentLine.map(f => `"${f}"`).join(', '));
        
        // 檢查解析後的列數是否與標題數匹配
        if (currentLine.length !== headers.length) {
            console.warn(`跳過不完整的行（列數不匹配）：`);
            console.warn(`期望列數: ${headers.length}, 實際列數: ${currentLine.length}`);
            console.warn("這是解析失敗的行:", line);
            console.warn("分割後的字段:", currentLine);
            console.warn("期望的標題:", headers);
            continue; // 如果還是不匹配，跳過此行
        } 
        
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            const originalHeader = headers[j];
            const newKey = headerMap[originalHeader] || originalHeader; 
            // 確保 currentLine[j] 存在且為字串
            // 使用 String() 強制轉換，防止 `undefined` 導致 `trim()` 錯誤
            row[newKey] = String(currentLine[j] || '').trim().replace(/\r/g, ''); 
        }
        data.push(row);
    }
    return data;
}

// ==== 渲染優惠券到頁面 ====
function renderCoupons(couponsToRender) {
    const rowContainer = document.getElementById('row');
    rowContainer.innerHTML = ''; // 清空現有內容

    if (couponsToRender.length === 0) {
        rowContainer.innerHTML = '<div class="col-12 text-center text-muted mt-5">沒有找到符合條件的優惠券。</div>';
        updateSearchResultCount(0); // 如果沒有結果，更新計數為0
        return;
    }

    couponsToRender.forEach(coupon => {
        // 確保價格是數字，以便格式化
        const priceValue = parseFloat(coupon.price);
        const formattedPrice = isNaN(priceValue) ? 'N/A' : `$${priceValue}`; // 如果不是數字則顯示N/A

        // 顯示詳細內容在外層
        const descriptionHtml = coupon.description ? 
            `<p class="card-text coupon-description mt-2">${coupon.description.replace(/\n/g, '<br>')}</p>` : '';

        const couponCard = `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm h-100"> <div class="card-body d-flex flex-column"> <div class="coupon-price-badge">${formattedPrice}</div> <h5 class="card-title">${coupon.name}</h5>
                        <p class="card-text">代碼: <strong>${coupon.couponCode}</strong></p>
                        ${descriptionHtml} <div class="mt-auto"> <p class="card-text mt-2"><small class="text-muted">到期日: ${coupon.endDate}</small></p>
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="btn-group w-100"> <button type="button" class="btn btn-sm btn-outline-secondary view-detail-btn" data-coupon='${JSON.stringify(coupon).replace(/'/g, "&apos;")}' style="width:100%;">
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

    // 為動態生成的「查看詳情」按鈕添加事件監聽器
    document.querySelectorAll('.view-detail-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            // 從 data-coupon 屬性中解析 JSON 字串
            const couponData = JSON.parse(event.currentTarget.dataset.coupon.replace(/&apos;/g, "'"));
            showCouponDetailModal(couponData);
        });
    });

    updateSearchResultCount(couponsToRender.length); // 更新計數
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

// ==== 初始化 Tag-it 自動完成建議標籤 ====
function initTagItAvailableTags() {
    const allTags = new Set();
    allCoupons.forEach(coupon => {
        if (coupon.tags) {
            // 將標籤字串按逗號分割，並處理每個標籤
            coupon.tags.split(',').forEach(tag => {
                const trimmedTag = tag.trim();
                if (trimmedTag) {
                    allTags.add(trimmedTag);
                }
            });
        }
    });
    // 更新 Tag-it 的 availableTags 選項
    $('#myTags').tagit('option', 'availableTags', Array.from(allTags));
    console.log('可用的標籤已載入:', Array.from(allTags));
}


// ==== 主要搜尋與篩選邏輯 ====
function performSearchAndFilter() {
    const currentTags = $('#myTags').tagit('assignedTags').map(tag => tag.toLowerCase()); // 獲取當前所有標籤並轉為小寫
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked; // 搜尋所有選項的狀態
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim(); // 獲取搜尋框內容

    filteredCoupons = allCoupons.filter(coupon => {
        // 1. 標籤篩選邏輯
        let tagMatch = true;
        if (currentTags.length > 0) {
            const couponTags = coupon.tags ? coupon.tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
            // 檢查優惠券是否包含所有選定的標籤
            tagMatch = currentTags.every(tag => couponTags.includes(tag));
        }

        // 2. 通用關鍵字搜尋邏輯
        let generalSearchMatch = true;
        if (searchTerm) {
            const searchableFields = [
                coupon.name,
                coupon.couponCode,
                coupon.description,
                coupon.tags,
                coupon.orderType
            ].map(field => String(field || '').toLowerCase()); // 確保所有欄位都是字串並轉小寫

            generalSearchMatch = searchableFields.some(field => field.includes(searchTerm));
        }

        // 3. 「同時搜尋詳細內容中的關鍵字」邏輯 (原 enableFlavorSearch)
        // 這個選項現在會影響標籤篩選和通用搜尋的結合方式
        let flavorSearchMatch = true; // 預設為真，除非 enableFlavorSearch 啟用且有標籤
        if (enableFlavorSearch && currentTags.length > 0) {
            // 如果啟用且有標籤，則標籤必須在 description 中找到一個
            const descriptionLower = String(coupon.description || '').toLowerCase();
            flavorSearchMatch = currentTags.some(tag => descriptionLower.includes(tag));
        }


        // 組合篩選條件
        // 如果沒有任何標籤和搜尋詞，則顯示所有
        if (currentTags.length === 0 && !searchTerm) {
            return true;
        }

        // 情況1: 只有標籤篩選 (不啟用 enableFlavorSearch)
        if (currentTags.length > 0 && !enableFlavorSearch && !searchTerm) {
            return tagMatch;
        }
        
        // 情況2: 只有通用搜尋 (沒有標籤)
        if (!currentTags.length && searchTerm) {
            return generalSearchMatch;
        }

        // 情況3: 標籤篩選 + 通用搜尋 (不啟用 enableFlavorSearch)
        if (currentTags.length > 0 && searchTerm && !enableFlavorSearch) {
            return tagMatch && generalSearchMatch;
        }

        // 情況4: 標籤篩選 + 啟用 enableFlavorSearch (無論是否有通用搜尋詞)
        // 這裡的邏輯是：標籤必須匹配 AND (標籤在詳細內容中找到 OR 通用搜尋詞找到)
        if (currentTags.length > 0 && enableFlavorSearch) {
            return tagMatch && (flavorSearchMatch || generalSearchMatch);
        }

        // 情況5: 只有通用搜尋 + 啟用 enableFlavorSearch (沒有標籤)
        // 這種情況下，enableFlavorSearch 其實沒有額外作用，直接用通用搜尋
        if (!currentTags.length && searchTerm && enableFlavorSearch) {
            return generalSearchMatch;
        }
        
        return true; // 預設返回 true，以防所有條件都不符合
    });

    // 重新排序篩選後的結果，保持排序狀態
    sortCoupons(document.getElementById('sortSelect').value);
}

// ==== 排序邏輯 (不變) ====
function sortCoupons(sortBy) {
    let sortedCoupons = [...filteredCoupons]; // 對篩選後的結果進行排序

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
            sortedCoupons.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
            break;
        case 'end_date-desc': 
            sortedCoupons.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
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

    // 清除按鈕邏輯
    document.querySelector('.clear-btn').addEventListener('click', () => {
        $('#myTags').tagit('removeAll'); // 清除 Tag-it 標籤
        document.getElementById('enableFlavorSearch').checked = false; // 重置搜尋所有選項
        document.getElementById('searchInput').value = ''; // 清空搜尋框
        document.getElementById('sortSelect').value = 'price-asc'; // 重置排序
        performSearchAndFilter(); // 重新觸發篩選和渲染
    });

    // 排序功能監聽
    document.getElementById('sortSelect').addEventListener('change', (event) => {
        sortCoupons(event.target.value);
    });

    // Tag-it 初始化
    $('#myTags').tagit({
        availableTags: [], // 這裡會動態填充
        afterTagAdded: function(evt, ui) {
            performSearchAndFilter(); // 當標籤添加時觸發搜尋/篩選
        },
        afterTagRemoved: function(evt, ui) {
            performSearchAndFilter(); // 當標籤移除時觸發搜尋/篩選
        },
        singleField: true, // 確保只有一個輸入框
        singleFieldNode: $('#myTags') // 綁定到這個元素
    });

    // 監聽 enableFlavorSearch 的變化
    document.getElementById('enableFlavorSearch').addEventListener('change', performSearchAndFilter);

    // 監聽搜尋框輸入事件
    document.getElementById('searchInput').addEventListener('input', performSearchAndFilter);
});