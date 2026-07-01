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
        // 1. 全形轉半形、大小寫 x 轉 *、英文字母邏輯轉換
        let s = String(str)
            .replace(/x/gi, '*')
            .replace(/<>/g, '!=')
            .replace(/\[/g, '(')
            .replace(/\]/g, ')')
            .replace(/\s+or\s+/gi, ' || ')
            .replace(/\s+and\s+/gi, ' && ')
            .replace(/＞/g, '>')
            .replace(/＜/g, '<')
            .replace(/＝/g, '=')
            .replace(/｜｜/g, '||');
        
        // 2. 智慧處理等號 (把單個 = 變成 JS 的 ==，同時保護 >=, <=, != 不被破壞)
        s = s.replace(/==/g, '=')
             .replace(/!=/g, '#NEQ#')
             .replace(/>=/g, '#GTE#')
             .replace(/<=/g, '#LTE#')
             .replace(/=/g, '==')
             .replace(/#NEQ#/g, '!=')
             .replace(/#GTE#/g, '>=')
             .replace(/#LTE#/g, '<=');
        
        // 3. 變數替換 (依照傳入的 scope)
        for (let code in scope) {
            const val = (scope[code] === '' || isNaN(scope[code])) ? 0 : scope[code];
            s = s.replace(new RegExp(`\\{${code}\\}`, 'gi'), val);
        }
        
        // 4. 剩下的未替換變數強迫補 0，避免 eval 壞掉
        s = s.replace(/{[a-zA-Z0-9_]+}/g, '0');
        
        // 5. 執行運算
        return new Function('return ' + s)();
    } catch(e) {
        // 如果還是有奇怪的語法錯誤，會在瀏覽器 F12 顯示，不會讓整個網頁白畫面
        console.error("運算失敗:", str, "錯誤原因:", e);
        return null;
    }
};
