// pizacoupon-website/js/coupon.js

// ==== Google Sheet 資料來源 URL ====
// 請確保這是您從 Google Sheet 發佈到網路後得到的 CSV 連結
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTKgerM5MjHdI30iz8bVxdHZW3eXnjlqQTDAOJL-HrrthyZUf2shN7FYKkjEbezPAAbUtb2uqjNVede/pub?gid=779545197&single=true&output=csv';

let allCoupons = []; // 用於儲存所有優惠券資料的陣列
let filteredCoupons = []; // 用於儲選後的優惠券資料

// ==== 數據獲取和處理 ====
async function fetchCoupons() {
    try {
        console.log('正在從 Google Sheet 載入優惠券資料...');
        const response = await fetch(GOOGLE_SHEET_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
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
        document.getElementById('row').innerHTML = '<div class="col-12 text-center text-danger mt-5">載入優惠券資料失敗，請稍後再試。</div>';
    }
}

// ==== CSV 解析函數 ====
// 根據您提供的 Google Sheet 欄位名稱進行解析和映射
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== ''); // 移除空行
    if (lines.length <= 1) { // 至少需要標題行和一行數據
        console.warn("CSV 數據不足或只有標題行。");
        return [];
    }

    // 清理標題，移除空白並確保正確分割。注意：這裡假設標題行不會有逗號在引號內的問題。
    const headers = lines[0].split(',').map(header => header.trim().replace(/\r/g, '')); 
    const data = [];

    // 定義中文標題到英文 key 的映射，方便 JavaScript 中使用
    // 這裡我根據您的截圖和警告，判斷CSV實際有9個欄位
    // 請務必讓這裡的中文鍵名與您Google Sheet發佈的CSV第一行完全一致
    const headerMap = {
        "優惠代碼": "couponCode",
        "名稱": "name",
        "套餐價格": "price",
        "套餐內容": "description",
        "標籤": "tags",
        "點餐類型": "orderType",
        "開始日期": "startDate",
        "結束日期": "endDate",
        "來源備註": "sourceNote" // <--- 根據您提供的截圖，這是最後一個欄位。如果CSV實際標題不同，請修改
    };

    // 重新檢查並調整headers的數量，如果Google Sheet最後一欄沒有標題，headers.length可能會少1
    // 我們可以手動確保headers的長度是9
    // 如果headers的長度是8，但實際行數是9，就需要特別處理
    if (headers.length === 8 && lines[1].split(',').length >= 9) {
        // 如果標題只有8個，但第一行數據有9個欄位，則自動補上一個空標題
        headers.push("未知欄位"); // 或者您可以給它一個具體的名稱，例如 "最後編輯時間"
        headerMap["未知欄位"] = "unknownField";
        console.warn("偵測到CSV標題行比數據行少一個欄位，已自動補齊。請檢查Google Sheet。");
    }

    // 使用一個更強健的正則表達式來解析 CSV 行，處理引號內的逗號
    // 參考：https://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript-which-contains-empty-values
    const CSV_REGEX = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^,\"]*))(?:,|$)/g;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        let match;
        const currentLine = [];

        // 逐個匹配字段
        while ((match = CSV_REGEX.exec(line)) !== null) {
            currentLine.push(match[1] !== undefined ? match[1].replace(/\"\"/g, '"') : match[2]);
        }
        
        // 移除行末可能因多餘逗號產生的空字串字段
        // 注意：這個修正需要更精確，以避免移除中間的有效空字串
        // 這裡嘗試在處理前先清理可能導致額外空字段的尾部逗號
        // 更好的做法是確保CSV本身沒有不符合規範的額外逗號
        
        // 確保解析出的字段數與標題數匹配
        // 如果 currentLine 比 headers 長，我們只取前面 headers.length 個
        // 如果 currentLine 比 headers 短，則數據不完整，我們跳過
        if (currentLine.length < headers.length) {
            console.warn(`跳過不完整的行（列數不足，可能是數據缺失）：${lines[i]}`);
            continue; 
        } 
        // 如果 currentLine.length > headers.length，表示 CSV 行比預期多欄
        // 我們將只取前 headers.length 這麼多個欄位來解析
        // 這是因為我們已經在 headerMap 裡定義了我們關心的欄位數量

        const row = {};
        for (let j = 0; j < headers.length; j++) {
            const originalHeader = headers[j];
            const newKey = headerMap[originalHeader] || originalHeader; 
            // 確保 currentLine[j] 存在，如果不存在則給予空字串避免錯誤
            row[newKey] = (currentLine[j] || '').trim().replace(/\r/g, ''); 
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

        // 簡易的卡片 HTML 結構 (基於 Bootstrap Album 範例)
        // 移除圖片部分，並添加價格徽章
        const couponCard = `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div class="coupon-price-badge">${formattedPrice}</div> <h5 class="card-title">${coupon.name}</h5>
                        <p class="card-text">代碼: <strong>${coupon.couponCode}</strong></p>
                        <p class="card-text"><small class="text-muted">到期日: ${coupon.endDate}</small></p>
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="btn-group">
                                <button type="button" class="btn btn-sm btn-outline-secondary view-detail-btn" data-coupon='${JSON.stringify(coupon).replace(/'/g, "&apos;")}' style="width:100%;">
                                    查看詳情
                                </button>
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

// ==== 顯示優惠券詳情 Modal 的函數 ====
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
}


// ==== 主要搜尋與篩選邏輯 ====
function performSearchAndFilter() {
    const currentTags = $('#myTags').tagit('assignedTags').map(tag => tag.toLowerCase()); // 獲取當前所有標籤並轉為小寫
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked; // 搜尋所有選項的狀態

    filteredCoupons = allCoupons.filter(coupon => {
        let tagMatch = true;
        if (currentTags.length > 0) {
            const couponTags = coupon.tags ? coupon.tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
            tagMatch = currentTags.every(tag => couponTags.includes(tag));
        }

        let flavorMatch = true;
        if (enableFlavorSearch && coupon.description) {
            const descriptionLower = coupon.description.toLowerCase();
            if (currentTags.length > 0) {
                flavorMatch = currentTags.some(tag => descriptionLower.includes(tag));
            } else {
                flavorMatch = true; 
            }
        }
        
        if (currentTags.length === 0 && !enableFlavorSearch) {
            return true; 
        } else if (currentTags.length > 0 && enableFlavorSearch) {
            return tagMatch || flavorMatch; 
        } else if (currentTags.length > 0 && !enableFlavorSearch) {
            return tagMatch; 
        } else if (currentTags.length === 0 && enableFlavorSearch) {
            return true; 
        }
        return true; 
    });

    // 重新排序篩選後的結果，保持排序狀態
    sortCoupons(document.getElementById('sortSelect').value);
}

// ==== 排序邏輯 ====
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
    // 載入優惠券資料
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
});