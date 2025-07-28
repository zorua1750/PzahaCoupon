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
        allCoupons = parseCSV(csvText); // 這裡可能發生 Invalid array length
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

    // 清理標題，移除空白並確保正確分割。
    // 這個headers應該和Google Sheet導出的CSV第一行完全匹配
    const headers = lines[0].split(',').map(header => header.trim().replace(/\r/g, '')); 
    const data = [];

    // 定義中文標題到英文 key 的映射
    // 再次確認這裡的中文鍵名與您Google Sheet發佈的CSV第一行完全一致
    const headerMap = {
        "優惠代碼": "couponCode",
        "名稱": "name",
        "套餐價格": "price",
        "套餐內容": "description",
        "標籤": "tags",
        "點餐類型": "orderType",
        "開始日期": "startDate",
        "結束日期": "endDate",
        "來源備註": "sourceNote" // 假設這是第9個欄位，其CSV標題為「來源備註」
                               // 如果它沒有標題，或者標題是別的，請務必修改這裡
    };

    // 為了處理標題行可能少一個欄位的特殊情況
    // 如果headers只有8個，但headerMap期望9個，且數據行的確有9個字段，則補充headers
    if (headers.length === 8 && Object.keys(headerMap).length === 9) {
        // 使用 headerMap 中的最後一個中文鍵名作為補充標題
        headers.push(Object.keys(headerMap)[8]); 
        console.warn("偵測到CSV標題行比數據行少一個欄位，已自動補齊。請檢查Google Sheet。");
    }


    // 使用一個更強健的正則表達式來解析 CSV 行，處理引號內的逗號和換行符
    // 這個 regex 應該能正確處理大部分 CSV 格式，包括引號內逗號和空字段
    const CSV_REGEX = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^,\"]*))(?:,|$)/g;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        let match;
        const currentLine = [];
        CSV_REGEX.lastIndex = 0; // 重置正則表達式的 lastIndex，防止上次匹配的影響

        // 逐個匹配字段
        while ((match = CSV_REGEX.exec(line)) !== null) {
            // match[1] 是引號內的內容，match[2] 是非引號的內容
            currentLine.push(match[1] !== undefined ? match[1].replace(/\"\"/g, '"') : match[2]);
        }
        
        // **修正：處理 Google Sheet 導出 CSV 最後多一個空字段的問題**
        // 如果解析出的字段數比期望多一個，並且多出的那個是空字符串，就將其移除
        // 這是因為 Google Sheet 導出的 CSV 常在最後一個非空欄位後多一個逗號，導致一個額外的空欄位
        if (currentLine.length > headers.length && currentLine[currentLine.length - 1] === '') {
            currentLine.pop(); // 移除最後多餘的空字段
        }
        // 如果還是比headers長，就截斷
        if (currentLine.length > headers.length) {
            currentLine.length = headers.length; // 直接截斷多餘的字段
        }


        // 檢查解析後的列數是否與標題數匹配
        if (currentLine.length !== headers.length) {
            console.warn(`跳過不完整的行（列數不匹配）：${lines[i]} - 解析後列數: ${currentLine.length}, 期望列數: ${headers.length}`);
            console.warn("解析後的字段:", currentLine.map(f => `"${f}"`).join(', ')); // 讓打印更清晰
            console.warn("期望的標題:", headers.map(h => `"${h}"`).join(', '));
            continue; // 如果還是不匹配，跳過此行
        } 
        
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

// ==== 渲染優惠券到頁面 (不變) ====
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

        const couponCard = `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div class="coupon-price-badge">${formattedPrice}</div>
                        <h5 class="card-title">${coupon.name}</h5>
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

    document.querySelectorAll('.view-detail-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const couponData = JSON.parse(event.currentTarget.dataset.coupon.replace(/&apos;/g, "'"));
            showCouponDetailModal(couponData);
        });
    });

    updateSearchResultCount(couponsToRender.length); 
}

// ==== 其他函數 (不變) ====
function updateSearchResultCount(count) {
    document.getElementById('searchResultCount').textContent = count;
}

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
    $('#myTags').tagit('option', 'availableTags', Array.from(allTags));
}

function performSearchAndFilter() {
    const currentTags = $('#myTags').tagit('assignedTags').map(tag => tag.toLowerCase());
    const enableFlavorSearch = document.getElementById('enableFlavorSearch').checked;

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

    sortCoupons(document.getElementById('sortSelect').value);
}

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

    document.querySelector('.clear-btn').addEventListener('click', () => {
        $('#myTags').tagit('removeAll'); 
        document.getElementById('enableFlavorSearch').checked = false; 
        document.getElementById('sortSelect').value = 'price-asc'; 
        performSearchAndFilter(); 
    });

    document.getElementById('sortSelect').addEventListener('change', (event) => {
        sortCoupons(event.target.value);
    });

    $('#myTags').tagit({
        availableTags: [], 
        afterTagAdded: function(evt, ui) {
            performSearchAndFilter(); 
        },
        afterTagRemoved: function(evt, ui) {
            performSearchAndFilter(); 
        },
        singleField: true, 
        singleFieldNode: $('#myTags') 
    });

    document.getElementById('enableFlavorSearch').addEventListener('change', performSearchAndFilter);
});