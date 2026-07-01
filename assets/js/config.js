// assets/js/config.js

// 部署核心提示：請替換為您在第一階段部署的 Google Apps Script Web App 網址
const CONFIG = {
    GAS_API_URL: "https://script.google.com/macros/s/AKfycbxEnA79SWNy5m-sVhVl7wxMINbI3wXLI5Bsz3MbNGSgowU1WE_Lr40pDLu712wTATzA/exec",
    VERSION: "v1.0.0"
};

// 全域暫存資料庫
const STORE = {
    drugs: [],
    parameters: [],
    formulas: []
};

// ==========================================
// 共用公式運算引擎 (前後台共用 - 終極防呆版)
// ==========================================

window.sharedCalc = function(str, scope) {
    if (!str || String(str).trim() === '') return null;
    try {
        let s = String(str)
            .replace(/x/gi, '*')
            .replace(/<>/g, '!=')
            .replace(/\[/g, '(')
            .replace(/\]/g, ')');

        // 1. 預先將邏輯關鍵字轉譯，避免與比較運算子衝突
        s = s.replace(/\s+or\s+/gi, ' || ')
             .replace(/\s+and\s+/gi, ' && ');

        // 2. 處理系統保留變數 {min} 和 {max} (強制包裹在 Number() 中確保是數值)
        s = s.replace(/{min}/gi, `(Number(${scope['min']}) || 0)`);
        s = s.replace(/{max}/gi, `(Number(${scope['max']}) || 0)`);

        // 3. 處理使用者參數
        for (let code in scope) {
            if (code === 'min' || code === 'max') continue;
            const val = (scope[code] === '' || isNaN(scope[code])) ? 0 : scope[code];
            const regex = new RegExp(`\\{${code}\\}`, 'gi');
            s = s.replace(regex, `(Number(${val}) || 0)`);
        }
        
        // 4. 最後補 0 處理未定義變數
        s = s.replace(/{[a-zA-Z0-9_]+}/g, '(0)');
        
        // 5. 執行安全運算
        return new Function('return (' + s + ')')();
    } catch(e) {
        console.error("運算失敗:", str, "錯誤:", e);
        return null;
    }
};
