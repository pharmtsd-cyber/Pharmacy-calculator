async function fetchFromGAS(action) {
    if (!CONFIG.GAS_API_URL) return null;

    try {
        // 加入 mode: 'cors' 與 credentials: 'omit'
        const response = await fetch(`${CONFIG.GAS_API_URL}?action=${action}`, {
            method: 'GET',
            mode: 'cors',         // 明確要求跨域資源共享
            credentials: 'omit'   // 排除 Cookie，防止 Google 因為帳號衝突而轉址
        });
        
        if (!response.ok) return null;

        const text = await response.text();
        if (text.trim().startsWith('<')) {
            console.error("API 被伺服器攔截 (重導向)");
            return null;
        }

        const result = JSON.parse(text);
        return result.status === "success" ? result.data : null;
    } catch (error) {
        console.error("Fetch 發生異常:", error);
        return null;
    }
}
