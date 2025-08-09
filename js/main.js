// pizacoupon-website/js/main.js

/**
 * 功能導覽函式 (由 coupon.js 在資料載入後呼叫)
 */
function startSiteTour() {
    // 1. 檢查是否是第一次訪問，如果不是，就直接結束
    if (localStorage.getItem('pzahaTourCompleted')) {
        return;
    }

    // 2. 確保頁面上至少有一張優惠券卡片，否則不啟動導覽
    if (!document.querySelector('#row .card')) {
        console.log("沒有優惠券可供導覽，跳過功能介紹。");
        return;
    }

    const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
            classes: 'shadow-md bg-purple-dark',
            scrollTo: true,
            cancelIcon: {
                enabled: true
            },
        }
    });

    tour.addStep({
        title: '歡迎來到 PzahaCoupon！',
        text: '這是一個快速的功能導覽，將帶您了解如何輕鬆找到最划算的必勝客優惠。',
        buttons: [
            {
                action() { return this.next(); },
                text: '開始導覽'
            }
        ]
    });

    tour.addStep({
        title: '關鍵字搜尋',
        text: '在這裡輸入您想找的關鍵字，例如「比薩」、「雞翅」或優惠代碼，來快速篩選。',
        attachTo: { element: '#searchInput', on: 'bottom' },
        buttons: [
            { action() { return this.back(); }, secondary: true, text: '上一步' },
            { action() { return this.next(); }, text: '下一步' }
        ]
    });

    tour.addStep({
        title: '內容篩選',
        text: '點擊按鈕來篩選包含或排除特定餐點的優惠券。',
        attachTo: { element: '#contentTagButtons', on: 'bottom' },
        buttons: [
            { action() { return this.back(); }, secondary: true, text: '上一步' },
            { action() { return this.next(); }, text: '下一步' }
        ]
    });

    tour.addStep({
        title: '收藏優惠',
        text: '點擊卡片右上角的書籤圖示，就可以收藏您喜歡的優惠券！',
        attachTo: { element: '#row .card:first-child .bookmark-btn', on: 'right' },
        buttons: [
             { action() { return this.back(); }, secondary: true, text: '上一步' },
             { action() { return this.next(); }, text: '下一步' }
        ]
    });

    tour.addStep({
        title: '查看我的收藏',
        text: '點擊這裡，就可以只看您收藏過的優惠券。再點一次即可返回所有列表。',
        attachTo: { element: '#favoritesBtn', on: 'bottom' },
        buttons: [
            { action() { return this.back(); }, secondary: true, text: '上一步' },
            { action() { tour.complete(); }, text: '完成導覽' }
        ]
    });

    // 當導覽完成或被取消時，標記為已完成
    const markTourAsCompleted = () => {
        localStorage.setItem('pzahaTourCompleted', 'true');
    };
    tour.on('complete', markTourAsCompleted);
    tour.on('cancel', markTourAsCompleted);

    tour.start();
}


document.addEventListener('DOMContentLoaded', function() {
    console.log('main.js 載入成功！');
    // 現在 main.js 只負責定義導覽函式，由 coupon.js 在適當時機呼叫。
});