document.addEventListener('DOMContentLoaded', function() {
    console.log('main.js 載入成功！');

    // ==== 功能導覽 (Shepherd.js) ====
    function startTour() {
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
                    action() {
                        return this.next();
                    },
                    text: '開始導覽'
                }
            ]
        });

        tour.addStep({
            title: '關鍵字搜尋',
            text: '在這裡輸入您想找的關鍵字，例如「比薩」、「雞翅」或優惠代碼，來快速篩選。',
            attachTo: {
                element: '#searchInput',
                on: 'bottom'
            },
            buttons: [
                {
                    action() {
                        return this.back();
                    },
                    secondary: true,
                    text: '上一步'
                },
                {
                    action() {
                        return this.next();
                    },
                    text: '下一步'
                }
            ]
        });

        tour.addStep({
            title: '內容篩選',
            text: '點擊按鈕來篩選包含或排除特定餐點的優惠券。',
            attachTo: {
                element: '#contentTagButtons',
                on: 'bottom'
            },
            buttons: [
                {
                    action() {
                        return this.back();
                    },
                    secondary: true,
                    text: '上一步'
                },
                {
                    action() {
                        return this.next();
                    },
                    text: '下一步'
                }
            ]
        });

        tour.addStep({
            title: '收藏優惠',
            text: '點擊卡片左上角的書籤圖示，就可以收藏您喜歡的優惠券！',
            attachTo: {
                element: '#row .card:first-child .bookmark-btn',
                on: 'right'
            },
            buttons: [
                 {
                    action() {
                        return this.back();
                    },
                    secondary: true,
                    text: '上一步'
                },
                {
                    action() {
                        return this.next();
                    },
                    text: '下一步'
                }
            ]
        });

        tour.addStep({
            title: '查看我的收藏',
            text: '點擊這裡，就可以只看您收藏過的優惠券。再點一次即可返回所有列表。',
            attachTo: {
                element: '#favoritesBtn',
                on: 'bottom'
            },
            buttons: [
                {
                    action() {
                        return this.back();
                    },
                    secondary: true,
                    text: '上一步'
                },
                {
                    action() {
                        tour.complete();
                    },
                    text: '完成導覽'
                }
            ]
        });

        // 檢查是否是第一次訪問
        if (!localStorage.getItem('pzahaTourCompleted')) {
             // 稍微延遲以確保優惠券卡片已渲染
            setTimeout(() => {
                // 確保頁面上有卡片可以附加導覽步驟
                if (document.querySelector('#row .card')) {
                    tour.start();
                    localStorage.setItem('pzahaTourCompleted', 'true');
                }
            }, 1500); // 延遲 1.5 秒
        }
    }
    
    // 等待 coupon.js 載入並渲染卡片後再啟動導覽
    // 我們透過監聽 #row 的內容變化來觸發
    const observer = new MutationObserver((mutationsList, observer) => {
        for(const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                startTour();
                observer.disconnect(); // 導覽啟動後就停止監聽
                break;
            }
        }
    });

    const rowElement = document.getElementById('row');
    if (rowElement) {
        observer.observe(rowElement, { childList: true });
    }
});