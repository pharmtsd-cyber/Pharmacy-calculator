// assets/js/api.js

/**
 * 統一發送 GET 請求到 GAS
 * @param {string} action - GAS 裡面對應的 action 參數
 * @returns {Promise<any>}
 */
async function fetchFromGAS(action) {
    if (!CONFIG.GAS_API_URL || CONFIG.GAS_API_URL === "https://script.google.com/macros/s/AKfycbxEnA79SWNy5m-sVhVl7wxMINbI3wXLI5Bsz3MbNGSgowU1WE_Lr40pDLu712wTATzA/exec") {
        console.error("尚未設定 GAS API 網址");
        return null;
    }

    try {
        const response = await fetch(`${CONFIG.GAS_API_URL}?action=${action}`);
        const result = await response.json();
        
        if (result.status === "success") {
            return result.data;
        } else {
            console.error("API 回傳錯誤:", result.message);
            return null;
        }
    } catch (error) {
        console.error("Fetch 失敗:", error);
        return null;
    }
}
