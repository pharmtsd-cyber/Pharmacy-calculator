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
// 共用公式運算引擎 (前後台共用)
// ==========================================
window.sharedCalc = function(str, scope) {
    if (!str || String(str).trim() === '') return null;
    try {
        // 正規化邏輯統一在此：x轉*，<>轉!=，所有括號轉小括號
        let s = String(str).replace(/x/gi, '*').replace(/<>/g, '!=').replace(/\[/g, '(').replace(/\]/g, ')');
        
        // 變數替換 (依照傳入的 scope)
        for (let code in scope) {
            // 如果沒填數值預設為 0
            const val = (scope[code] === '' || isNaN(scope[code])) ? 0 : scope[code];
            s = s.replace(new RegExp(`\\{${code}\\}`, 'gi'), val);
        }
        
        // 剩下的未替換變數強迫補 0，避免 eval 壞掉
        s = s.replace(/{[a-zA-Z0-9_]+}/g, '0');
        
        // 執行運算
        return new Function('return ' + s)();
    } catch(e) {
        console.error("運算失敗:", str, e);
        return null;
    }
};
