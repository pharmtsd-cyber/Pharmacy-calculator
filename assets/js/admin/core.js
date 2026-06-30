// 全域變數供各模組使用
var CURRENT_USER = null;
var CONTEXT_DRUG = null;
var stateTags = { relatedDrugs: [] };
Object.assign(STORE, { staff: [], categories: [], announcements: [], forms: [], feedbacks: [] });

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').onclick = handleLogin;
    document.getElementById('btn-open-pw').onclick = () => document.getElementById('pw-modal').classList.remove('hidden');
    document.getElementById('btn-pw-cancel').onclick = () => document.getElementById('pw-modal').classList.add('hidden');
    document.getElementById('btn-pw-save').onclick = handleChangePassword;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.getAttribute('data-target'));
        });
    });

    checkAutoLogin();
});

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

// 【優化核心】防呆跳轉引擎：處理公式檢視與一般編輯的雙重情境
function handleUrlJump() {
    const urlParams = new URLSearchParams(window.location.search);
    const drugId = urlParams.get('drug_id');
    const action = urlParams.get('action');

    if (drugId) {
        if (action === 'formula_view') {
            // 情境二：點選「公式修改」
            switchTab('dashboard');
            const df = document.getElementById('filter-dash-drugs');
            if (df) {
                // 精準鎖定該藥品
                const d = STORE.drugs.find(x => String(x.drug_id) === String(drugId) || String(x.drug_code) === String(drugId));
                if (d) {
                    // 自動填入搜尋框，並觸發總表連動
                    df.value = d.drug_code || d.generic_name || d.local_name;
                    if(typeof window.renderDrugsList === 'function') window.renderDrugsList();
                    
                    // 貼心設計：稍微延遲讓畫面繪製完成後，自動滾動到公式大表
                    setTimeout(() => {
                        scrollToElement('list-dash-formulas');
                    }, 200);
                }
            }
        } else {
            // 情境一：點選「資訊修改」，直接進入藥品詳細編輯頁
            if(typeof window.viewDrug === 'function') window.viewDrug(drugId);
        }
        
        // ⚠️ 【關鍵修復】：已經將這行 replaceState 註解刪除！
        // 保留網址列的參數，避免打斷 Tailwind CSS v4 CDN 的背景模組載入，
        // 同時也帶來好處：如果使用者重新整理網頁，依然能準確回到該藥品的編輯畫面。
        // window.history.replaceState({}, document.title, window.location.pathname);
    }
}

window.logout = function() {
    localStorage.removeItem('pharma_user');
    window.location.reload();
};

async function loadAllData() {
    try {
        // 【優化】拋棄 Promise.all 多重請求，改用單一高速接口
        const data = await fetchFromGAS('getAllData');
        
        if (data) {
            STORE.drugs = data.drugs || []; 
            STORE.parameters = data.parameters || [];
            STORE.formulas = data.formulas || []; 
            STORE.staff = data.staff || [];
            STORE.categories = data.categories || []; 
            STORE.announcements = data.announcements || [];
            STORE.forms = data.forms || []; 
            STORE.feedbacks = data.feedbacks || [];
            
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
        }
    } catch(e) { 
        console.error("資料載入失敗:", e); 
    }
}

window.sendPost = async function(payload) {
    const res = await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    if(result.status === 'success') { 
        loadAllData();
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
