// 全域變數供各模組使用
var CURRENT_USER = null;
var CONTEXT_DRUG = null;
var stateTags = { relatedDrugs: [] };
Object.assign(STORE, { staff: [], categories: [], announcements: [], forms: [], feedbacks: [], settings: {} });

document.addEventListener('DOMContentLoaded', () => {
    // 防呆綁定：確認元素存在才綁定事件，確保前後台都能順利運行
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.onclick = handleLogin;
    
    const btnOpenPw = document.getElementById('btn-open-pw');
    if (btnOpenPw) btnOpenPw.onclick = () => document.getElementById('pw-modal').classList.remove('hidden');
    
    const btnPwCancel = document.getElementById('btn-pw-cancel');
    if (btnPwCancel) btnPwCancel.onclick = () => document.getElementById('pw-modal').classList.add('hidden');
    
    const btnPwSave = document.getElementById('btn-pw-save');
    if (btnPwSave) btnPwSave.onclick = handleChangePassword;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.getAttribute('data-target')));
    });

    checkAutoLogin();
});

window.switchTab = function(targetId) {
    // 利用 requestAnimationFrame 避免阻塞 UI 渲染，解決卡頓問題
    requestAnimationFrame(() => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if(targetNav) targetNav.classList.add('active');
        
        const targetContent = document.getElementById(targetId);
        if(targetContent) targetContent.classList.add('active');
        
        const navFormulas = document.getElementById('nav-formulas');
        if (targetId !== 'formulas') {
            if(navFormulas) navFormulas.classList.add('hidden');
        } else {
            if(navFormulas) {
                navFormulas.classList.remove('hidden');
                navFormulas.classList.add('active');
            }
        }
    });
};

window.scrollToTop = function() {
    const main = document.querySelector('main');
    if(main) main.scrollTo({ top: 0, behavior: 'smooth' });
};
window.scrollToBottom = function() {
    const main = document.querySelector('main');
    if(main) main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
};
window.scrollToElement = function(id) {
    const el = document.getElementById(id);
    if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

async function checkAutoLogin() {
    const savedUser = localStorage.getItem('pharma_user');
    if (savedUser) {
        try {
            CURRENT_USER = JSON.parse(savedUser);
            if (document.getElementById('login-overlay')) document.getElementById('login-overlay').classList.add('hidden');
            if (document.getElementById('dash-name')) document.getElementById('dash-name').innerText = CURRENT_USER.name;
            if (document.getElementById('current-user-info')) document.getElementById('current-user-info').innerText = `${CURRENT_USER.name} (${CURRENT_USER.role})`;
            
            if (CURRENT_USER.role !== 'Admin' && CURRENT_USER.role !== 'Programmer') {
                const btnStaff = document.getElementById('btn-save-staff');
                if (btnStaff) {
                    btnStaff.disabled = true; 
                    btnStaff.classList.replace('bg-[#1B365D]', 'bg-gray-400');
                }
            }
            
            // 後台才需要跳轉，前台交給 calculator.js 處理
            if (document.getElementById('login-overlay')) {
                await window.loadAllData();
                handleUrlJump();
            }
        } catch(e) {
            localStorage.removeItem('pharma_user');
        }
    }
}

async function handleLogin() {
    const id = document.getElementById('login-id').value.trim();
    const pw = document.getElementById('login-pw').value;
    const msg = document.getElementById('login-msg');
    
    if(!id || !pw) return msg.innerText = "請輸入員編與密碼";
    const btn = document.getElementById('btn-login'); 
    btn.innerText = "驗證中..."; btn.disabled = true;
    
    try {
        const response = await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', emp_id: id, password: pw }) });
        const result = await response.json();
        if (result.status === "success") {
            CURRENT_USER = result;
            localStorage.setItem('pharma_user', JSON.stringify(CURRENT_USER)); 
            
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('dash-name').innerText = CURRENT_USER.name;
            document.getElementById('current-user-info').innerText = `${CURRENT_USER.name} (${CURRENT_USER.role})`;
            
            if (CURRENT_USER.role !== 'Admin' && CURRENT_USER.role !== 'Programmer') {
                const btnStaff = document.getElementById('btn-save-staff');
                if (btnStaff) {
                    btnStaff.disabled = true; 
                    btnStaff.classList.replace('bg-[#1B365D]', 'bg-gray-400');
                }
            }
            
            await window.loadAllData();
            handleUrlJump();
        } else {
            msg.innerText = result.message;
        }
    } catch(e) { 
        msg.innerText = "網路連線異常"; 
    } finally { 
        btn.innerText = "登入系統"; btn.disabled = false; 
    }
}

window.handleChangePassword = async function() {
    const oldPw = document.getElementById('pw-old').value, newPw = document.getElementById('pw-new').value;
    if(!oldPw || !newPw) return alert("請完整輸入密碼");
    const res = await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'updatePassword', emp_id: CURRENT_USER.emp_id, old_password: oldPw, new_password: newPw }) });
    const result = await res.json();
    if(result.status === "success") { 
        alert("密碼修改成功！"); 
        document.getElementById('pw-modal').classList.add('hidden'); 
    } else {
        alert("修改失敗：" + result.message);
    }
};

function handleUrlJump() {
    const urlParams = new URLSearchParams(window.location.search);
    const drugId = urlParams.get('drug_id');
    const action = urlParams.get('action');

    if (drugId) {
        if (action === 'formula_view') {
            switchTab('dashboard');
            const df = document.getElementById('filter-dash-drugs');
            if (df) {
                const d = STORE.drugs.find(x => String(x.drug_id) === String(drugId) || String(x.drug_code) === String(drugId));
                if (d) {
                    df.value = d.drug_code || d.generic_name || d.local_name;
                    if(typeof window.renderDrugsList === 'function') window.renderDrugsList();
                    setTimeout(() => { scrollToElement('list-dash-formulas'); }, 200);
                }
            }
        } else {
            if(typeof window.viewDrug === 'function') window.viewDrug(drugId);
        }
    }
}

window.logout = function() {
    localStorage.removeItem('pharma_user');
    window.location.reload();
};

// ==========================================
// 核心：全域資料渲染函數
// ==========================================
window.applyDataToStoreAndRender = function(data) {
    if (!data) return;
    
    STORE.drugs = data.drugs || []; 
    STORE.parameters = data.parameters || [];
    STORE.formulas = data.formulas || []; 
    STORE.staff = data.staff || [];
    STORE.categories = data.categories || []; 
    STORE.announcements = data.announcements || [];
    STORE.forms = data.forms || []; 
    STORE.feedbacks = data.feedbacks || [];
    
    // 處理設定檔轉為 key-value
    STORE.settings = {};
    if (data.settings && Array.isArray(data.settings)) {
        data.settings.forEach(s => STORE.settings[s.setting_key] = s.setting_value);
    }
    
    if(document.getElementById('stat-drugs')) document.getElementById('stat-drugs').innerText = STORE.drugs.length;
    if(document.getElementById('stat-formulas')) document.getElementById('stat-formulas').innerText = STORE.formulas.length;
    if(document.getElementById('stat-params')) document.getElementById('stat-params').innerText = STORE.parameters.length;
    if(document.getElementById('stat-staff')) document.getElementById('stat-staff').innerText = STORE.staff.length;

    // 觸發各頁面渲染 (前後台共用，不報錯)
    try { if(typeof setupDrugListFilters === 'function') setupDrugListFilters(); } catch(e){}
    try { if(typeof renderSystemLists === 'function') renderSystemLists(); } catch(e){}
    try { if(typeof renderDrugsList === 'function') renderDrugsList(); } catch(e){}
    try { if(typeof setupDrugCategorySelects === 'function') setupDrugCategorySelects(); } catch(e){}
    try { if(typeof setupDrugDropdowns === 'function') setupDrugDropdowns(); } catch(e){}
    try { if(typeof renderParameterPad === 'function') renderParameterPad(); } catch(e){}
    try { if(CONTEXT_DRUG && typeof renderLocalFormulas === 'function') renderLocalFormulas(); } catch(e){}
    try { if(typeof renderHomeContent === 'function') renderHomeContent(); } catch(e){} 
    try { if(typeof applyFilters === 'function') applyFilters(); } catch(e){}
    try { if(typeof setupDrugDomainSelect === 'function') setupDrugDomainSelect(); } catch(e){}
    try { if(typeof setupToolDropdown === 'function') setupToolDropdown(); } catch(e){}
};

// ==========================================
// 極速載入引擎 (Offline-First)
// ==========================================
window.loadAllData = async function(forceRefresh = false) {
    try {
        const cachedDataStr = localStorage.getItem('PHARMA_DB_CACHE');
        const localVersion = localStorage.getItem('PHARMA_DB_VERSION');

        // 1. 若有快取且非強制更新，瞬間畫出畫面
        if (cachedDataStr && !forceRefresh) {
            console.log("⚡ 從本機快取瞬間載入");
            window.applyDataToStoreAndRender(JSON.parse(cachedDataStr));
        }

        // 2. 靜默抓取最新版本號
        const remoteVersion = await fetchFromGAS('getVersion');

        // 3. 版本號不同 或 強制更新 時，從雲端拉取全部資料
        if (!localVersion || remoteVersion !== localVersion || forceRefresh) {
            console.log("🔄 版本更新或強制重整，開始下載最新資料庫...");
            const freshData = await fetchFromGAS('getAllData');
            
            if (freshData) {
                localStorage.setItem('PHARMA_DB_CACHE', JSON.stringify(freshData));
                if(remoteVersion) localStorage.setItem('PHARMA_DB_VERSION', remoteVersion);
                window.applyDataToStoreAndRender(freshData);
                console.log("✅ 資料庫更新完畢");
            }
        }
    } catch(e) { 
        console.error("資料載入失敗:", e); 
    }
};

// ==========================================
// 共用寫入引擎 (POST)
// ==========================================
window.sendPost = async function(payload) {
    try {
        const res = await fetch(CONFIG.GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify(payload) 
        });
        
        const text = await res.text();
        if (text.trim().startsWith('<')) {
            console.error("API 遭攔截，回傳了 HTML:", text);
            alert("系統安全機制阻擋了請求 (可能是權限衝突)，請嘗試使用無痕視窗。");
            return { status: 'error' };
        }

        const result = JSON.parse(text);
        if(result.status === 'success') { 
            // 寫入成功後，立刻觸發背景強制更新快取
            await window.loadAllData(true);
            return result;
        } else { 
            alert("失敗：" + result.message); 
            return result;
        }
    } catch(e) { 
        console.error("連線錯誤:", e);
        alert("網路連線異常，請確認網址或網路狀態。"); 
        return { status: 'error' };
    }
};

// ==========================================
// 共用刪除功能
// ==========================================
window.deleteRecord = async function(action, id) {
    if (action === 'deleteStaff' && id === '93397') return alert("不可刪除程式管理員！");
    if (!confirm("確定要刪除這筆資料嗎？此操作無法復原！")) return;
    
    const payload = { action: action };
    if(action==='deleteStaff') payload.emp_id = id; 
    if(action==='deleteParameter') payload.param_code = id; 
    if(action==='deleteDrug') payload.drug_id = id; 
    if(action==='deleteFormula') payload.formula_id = id; 
    if(action==='deleteCategory') payload.cat_id = id; 
    if(action==='deleteAnnouncement') payload.announce_id = id; 
    if(action==='deleteForm') payload.form_id = id; 
    if(action==='deleteFeedback') payload.feedback_id = id;
    
    const res = await window.sendPost(payload);
    if(res && res.status === 'success') alert("刪除成功！");
};
