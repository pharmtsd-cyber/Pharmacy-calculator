// 全域變數供各模組使用 (STORE 已經在 config.js 中宣告，這裡僅擴充新屬性)
var CURRENT_USER = null;
var CONTEXT_DRUG = null;
var stateTags = { relatedDrugs: [] };
Object.assign(STORE, { staff: [], categories: [], announcements: [], forms: [], feedbacks: [] });

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').onclick = handleLogin;
    document.getElementById('btn-open-pw').onclick = () => document.getElementById('pw-modal').classList.remove('hidden');
    document.getElementById('btn-pw-cancel').onclick = () => document.getElementById('pw-modal').classList.add('hidden');
    document.getElementById('btn-pw-save').onclick = handleChangePassword;

    // 綁定側邊欄切換 (改用平滑的 switchTab)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.getAttribute('data-target'));
        });
    });

    checkAutoLogin();
});

// 【新增】全域分頁切換控制器
window.switchTab = function(targetId) {
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
};

// 【新增】全域平滑滾動引擎 (解決畫面消失/找不到視窗的問題)
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
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('dash-name').innerText = CURRENT_USER.name;
            document.getElementById('current-user-info').innerText = `${CURRENT_USER.name} (${CURRENT_USER.role})`;
            
            if (CURRENT_USER.role !== 'Admin' && CURRENT_USER.role !== 'Programmer') {
                document.getElementById('btn-save-staff').disabled = true; 
                document.getElementById('btn-save-staff').classList.replace('bg-[#1B365D]', 'bg-gray-400');
            }
            
            await loadAllData();
            handleUrlJump();
        } catch(e) {
            localStorage.removeItem('pharma_user');
        }
    }
}

async function handleLogin() {
    const id = document.getElementById('login-id').value.trim(), pw = document.getElementById('login-pw').value, msg = document.getElementById('login-msg');
    if(!id || !pw) return msg.innerText = "請輸入員編與密碼";
    const btn = document.getElementById('btn-login'); btn.innerText = "驗證中..."; btn.disabled = true;
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
                document.getElementById('btn-save-staff').disabled = true; document.getElementById('btn-save-staff').classList.replace('bg-[#1B365D]', 'bg-gray-400');
            }
            
            await loadAllData();
            handleUrlJump();
        } else msg.innerText = result.message;
    } catch(e) { msg.innerText = "網路連線異常"; } finally { btn.innerText = "登入系統"; btn.disabled = false; }
}

function handleUrlJump() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('drug_id')) {
        if(typeof window.viewDrug === 'function') window.viewDrug(urlParams.get('drug_id'));
        // 核心：跳轉後立刻把網址清空，防止重整時不斷觸發
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

window.logout = function() {
    localStorage.removeItem('pharma_user');
    window.location.reload();
};

async function loadAllData() {
    try {
        const [drugsData, paramsData, formulasData, staffData, catData, annoData, formData, feedData] = await Promise.all([
            fetchFromGAS('getDrugs'), fetchFromGAS('getParameters'), fetchFromGAS('getFormulas'), fetchFromGAS('getStaff'), 
            fetchFromGAS('getCategories'), fetchFromGAS('getAnnouncements'), fetchFromGAS('getForms'), fetchFromGAS('getFeedback')
        ]);
        if(drugsData) STORE.drugs = drugsData; if(paramsData) STORE.parameters = paramsData;
        if(formulasData) STORE.formulas = formulasData; if(staffData) STORE.staff = staffData;
        if(catData) STORE.categories = catData; if(annoData) STORE.announcements = annoData;
        if(formData) STORE.forms = formData; if(feedData) STORE.feedbacks = feedData;
        
        document.getElementById('stat-drugs').innerText = STORE.drugs.length;
        document.getElementById('stat-formulas').innerText = STORE.formulas.length;
        document.getElementById('stat-params').innerText = STORE.parameters.length;
        document.getElementById('stat-staff').innerText = STORE.staff.length;

        if(typeof setupDrugListFilters === 'function') setupDrugListFilters();
        if(typeof renderSystemLists === 'function') renderSystemLists();
        if(typeof renderDrugsList === 'function') renderDrugsList();
        if(typeof setupDrugCategorySelects === 'function') setupDrugCategorySelects();
        if(typeof setupDrugDropdowns === 'function') setupDrugDropdowns();
        if(typeof renderParameterPad === 'function') renderParameterPad();
        if(CONTEXT_DRUG && typeof renderLocalFormulas === 'function') renderLocalFormulas();
    } catch(e) { console.error(e); }
}

window.sendPost = async function(payload) {
    const res = await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    if(result.status === 'success') { 
        loadAllData(); // 安靜重載，不再跳出 annoying 的 alert 中斷體驗
    } else { alert("失敗：" + result.message); }
};

window.deleteRecord = async function(action, id) {
    if (action === 'deleteStaff' && id === '93397') return alert("不可刪除程式管理員！");
    if (!confirm("確定要刪除這筆資料嗎？此操作無法復原！")) return;
    
    const payload = { action: action };
    if(action==='deleteStaff') payload.emp_id = id; if(action==='deleteParameter') payload.param_code = id; if(action==='deleteDrug') payload.drug_id = id; 
    if(action==='deleteFormula') payload.formula_id = id; if(action==='deleteCategory') payload.cat_id = id; if(action==='deleteAnnouncement') payload.announce_id = id; 
    if(action==='deleteForm') payload.form_id = id; if(action==='deleteFeedback') payload.feedback_id = id;
    await sendPost(payload);
};

// 【補回】修改密碼功能
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
