// pizacoupon-website/js/main.js

let siteTour = null; // 將 tour 實例移至外部，以便事件監聽器可以訪問
let siteTourInitialized = false;

/**
 * 功能導覽函式 (由 coupon.js 在資料載入後呼叫)
 */
function startSiteTour() {
    // 1. 檢查導覽是否已完成，或在本輪瀏覽中是否已啟動過
    if (localStorage.getItem('pzahaTourCompleted') || siteTourInitialized) {
        return;
    }

    // 2. 確保頁面上至少有一張優惠券卡片，否則不啟動導覽
    if (!document.querySelector('#row .card')) {
        console.log("沒有優惠券可供導覽，跳過功能介紹。");
        return;
    }
    
    // 3. 標記導覽已啟動
    siteTourInitialized = true;

    // 建立一個自訂的關閉按鈕 HTML
    const customCancelIcon = '<button type="button" class="tour-close-btn" aria-label="Close">&times;</button>';

    siteTour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
            scrollTo: true,
            cancelIcon: {
                enabled: false // 徹底禁用預設的關閉按鈕和 header
            },
        }
    });

    const header = document.querySelector('header');
    const disableStickyHeader = () => header.classList.add('tour-active');
    const enableStickyHeader = () => header.classList.remove('tour-active');

    siteTour.on('show', disableStickyHeader);
    siteTour.on('complete', enableStickyHeader);
    siteTour.on('cancel', enableStickyHeader);

    siteTour.addStep({
        text: `${customCancelIcon}<strong>歡迎來到 PzahaCoupon！</strong><br><br>這是一個快速的功能導覽，將帶您了解如何輕鬆找到最划算的必勝客優惠。`,
        buttons: [
            {
                action() { return this.next(); },
                text: '開始導覽'
            }
        ]
    });

    siteTour.addStep({
        text: `${customCancelIcon}<strong>關鍵字搜尋</strong><br><br>在這裡輸入您想找的關鍵字，例如「比薩」、「雞翅」或優惠代碼，來快速篩選。`,
        attachTo: { element: '#searchInput', on: 'bottom' },
        buttons: [
            { action() { return this.back(); }, secondary: true, text: '上一步' },
            { action() { return this.next(); }, text: '下一步' }
        ]
    });

    siteTour.addStep({
        text: `${customCancelIcon}<strong>內容篩選</strong><br><br>點擊按鈕來篩選包含或排除特定餐點的優惠券。`,
        attachTo: { element: '#contentTagButtons', on: 'bottom' },
        buttons: [
            { action() { return this.back(); }, secondary: true, text: '上一步' },
            { action() { return this.next(); }, text: '下一步' }
        ]
    });

    siteTour.addStep({
        text: `${customCancelIcon}<strong>收藏優惠</strong><br><br>點擊卡片右上角的書籤圖示，就可以收藏您喜歡的優惠券！`,
        attachTo: { element: '#row .card:first-child .bookmark-btn', on: 'bottom' },
        buttons: [
             { action() { return this.back(); }, secondary: true, text: '上一步' },
             { action() { return this.next(); }, text: '下一步' }
        ]
    });

    siteTour.addStep({
        text: `${customCancelIcon}<strong>查看我的收藏</strong><br><br>點擊這裡，就可以只看您收藏過的優惠券。再點一次即可返回所有列表。<br><br><small>請注意：收藏紀錄只會儲存在您的瀏覽器上，清除Cookie或快取可能會導致紀錄遺失。</small>`,
        attachTo: { element: '#favoritesBtn', on: 'bottom' },
        buttons: [
            { action() { return this.back(); }, secondary: true, text: '上一步' },
            { action() { siteTour.complete(); }, text: '完成導覽' }
        ]
    });

    // 當導覽完成或被取消時，標記為已完成
    const markTourAsCompleted = () => {
        localStorage.setItem('pzahaTourCompleted', 'true');
    };
    siteTour.on('complete', markTourAsCompleted);
    siteTour.on('cancel', markTourAsCompleted);

    siteTour.start();
}


document.addEventListener('DOMContentLoaded', function() {
    // 為我們自訂的關閉按鈕新增事件監聽器
    document.body.addEventListener('click', function(e) {
        if (e.target.matches('.tour-close-btn') && siteTour && siteTour.isActive()) {
            siteTour.cancel();
        }
    });

    // Initialize all Bootstrap tooltips on the page
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
});