// assets/js/api.js

/**
 * 統一發送 GET 請求到 GAS (具備轉址防呆機制)
 */
async function fetchFromGAS(action) {
    if (!CONFIG.GAS_API_URL) {
        console.error("尚未設定 GAS API 網址");
        return null;
    }

    try {
        const response = await fetch(`${CONFIG.GAS_API_URL}?action=${action}`, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (!response.ok) return null;

        const text = await response.text();
        
        // 防呆：如果 Google 伺服器因為權限阻擋而回傳網頁，在此攔截
        if (text.trim().startsWith('<')) {
            console.error(`API [${action}] 被伺服器攔截 (可能是 302 重導向)`);
            return null;
        }

        const result = JSON.parse(text);
        return result.status === "success" ? result.data : null;
    } catch (error) {
        console.error("Fetch 發生異常:", error);
        return null;
    }
}
