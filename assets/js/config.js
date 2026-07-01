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
            .replace(/\]/g, ')')
            .replace(/\s+or\s+/gi, ' || ')
            .replace(/\s+and\s+/gi, ' && ')
            .replace(/＞/g, '>').replace(/＜/g, '<').replace(/＝/g, '=').replace(/｜｜/g, '||');

        // 智慧處理邏輯運算子 (修正 = 變成 ==)
        s = s.replace(/==/g, '===')
             .replace(/!=/g, '!==')
             .replace(/>=/g, '>=')
             .replace(/<=/g, '<=')
             .replace(/=/g, '===');

        // 【關鍵優化】：這裡改用「動態標籤法」進行替換
        // 我們把變數 {code} 全部包在 () 裡面，強制變成獨立的數值塊，防止運算子相撞
        for (let code in scope) {
            const val = (scope[code] === '' || isNaN(scope[code])) ? 0 : scope[code];
            // 建立一個正規表達式，將 {code} 替換為 (數值)
            const regex = new RegExp(`\\{${code}\\}`, 'gi');
            s = s.replace(regex, `(${val})`);
        }
        
        // 將剩下的未定義變數通通強制補 0
        s = s.replace(/{[a-zA-Z0-9_]+}/g, '(0)');
        
        // 執行運算
        return new Function('return (' + s + ')')();
    } catch(e) {
        console.error("運算失敗:", str, "錯誤原因:", e);
        return null;
    }
};
