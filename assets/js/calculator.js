// assets/js/calculator.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("計算機模組初始化完成。");
    document.getElementById('version-badge').innerText = CONFIG.VERSION;
    
    // 啟動時先載入資料
    initializeCalculator();
});

async function initializeCalculator() {
    const loadingStatus = document.getElementById('loading-status');
    
    // 第三階段我們將在這裡加入呼叫 api.js 的語法：
    // STORE.drugs = await fetchFromGAS('getDrugs');
    // STORE.parameters = await fetchFromGAS('getParameters');
    
    // 預留位置：更新畫面 UI
    loadingStatus.innerText = "資料載入完成，等待實作選單生成...";
}
