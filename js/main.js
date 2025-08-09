// pizacoupon-website/js/main.js

let siteTourInitialized = false;

/**
 * 功能導覽函式 (由 coupon.js 在資料載入後呼叫)
 */
function startSiteTour() {
    if (localStorage.getItem('pzahaTourCompleted') || siteTourInitialized) {
        return;
    }
    if (!document.querySelector('#row .card')) {
        console.log("沒有優惠券可供導覽，跳過功能介紹。");
        return;
    }
    
    siteTourInitialized = true;

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

    // MODIFIED: Get header element and define functions to change its state
    const header = document.querySelector('header');
    const disableStickyHeader = () => header.classList.add('tour-active');
    const enableStickyHeader = () => header.classList.remove('tour-active');

    // MODIFIED: Add event listeners to the tour
    tour.on('show', disableStickyHeader); // 導覽開始時，取消置頂
    tour.on('complete', enableStickyHeader); // 導覽完成時，恢復置頂
    tour.on('cancel', enableStickyHeader); // 導覽取消時，恢復置頂

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
        attachTo: { element: '#row .card:first-child .bookmark-btn', on: 'bottom' },
        buttons: [
             { action() { return this.back(); }, secondary: true, text: '上一步' },
             { action() { return this.next(); }, text: '下一步' }
        ]
    });

    tour.addStep({
        title: '查看我的收藏',
        text: '點擊這裡，就可以只看您收藏過的優惠券。再點一次即可返回所有列表。<br><br><small>請注意：收藏紀錄只會儲存在您的瀏覽器上，清除Cookie或快取可能會導致紀錄遺失。</small>',
        attachTo: { element: '#favoritesBtn', on: 'bottom' },
        buttons: [
            { action() { return this.back(); }, secondary: true, text: '上一步' },
            { action() { tour.complete(); }, text: '完成導覽' }
        ]
    });

    tour.on('complete', () => localStorage.setItem('pzahaTourCompleted', 'true'));
    tour.on('cancel', () => localStorage.setItem('pzahaTourCompleted', 'true'));

    tour.start();
}


document.addEventListener('DOMContentLoaded', function() {
    console.log('main.js 載入成功！');
    
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
});