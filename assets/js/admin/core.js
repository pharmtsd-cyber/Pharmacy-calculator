// 全域變數供各模組使用
var CURRENT_USER = null;
var CONTEXT_DRUG = null;
var STORE = { drugs: [], parameters: [], formulas: [], staff: [], categories: [], announcements: [], forms: [], feedbacks: [] };
var stateTags = { relatedDrugs: [] };

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').onclick = handleLogin;
    
    // 綁定側邊欄切換
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(item.getAttribute('data-target')).classList.add('active');
            if (item.getAttribute('data-target') !== 'formulas') {
                const navFormulas = document.getElementById('nav-formulas');
                if(navFormulas) navFormulas.classList.add('hidden');
            }
        });
    });
});

async function handleLogin() {
    const id = document.getElementById('login-id').value.trim(), pw = document.getElementById('login-pw').value, msg = document.getElementById('login-msg');
    if(!id || !pw) return msg.innerText = "請輸入員編與密碼";
    const btn = document.getElementById('btn-login'); btn.innerText = "驗證中..."; btn.disabled = true;
    try {
        const response = await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', emp_id: id, password: pw }) });
        const result = await response.json();
        if (result.status === "success") {
            CURRENT_USER = result;
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('dash-name').innerText = CURRENT_USER.name;
            
            if (CURRENT_USER.role !== 'Admin' && CURRENT_USER.role !== 'Programmer') {
                document.getElementById('btn-save-staff').disabled = true; document.getElementById('btn-save-staff').classList.replace('bg-[#1B365D]', 'bg-gray-400');
            }
            await loadAllData();

            // 【跳轉檢查】如果前台帶了 drug_id 來，自動切換到藥品頁面並開啟該藥品
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('drug_id')) {
                const targetTab = document.querySelector('[data-target="drugs"]');
                if(targetTab) targetTab.click();
                if(typeof window.viewDrug === 'function') window.viewDrug(urlParams.get('drug_id'));
            }
        } else msg.innerText = result.message;
    } catch(e) { msg.innerText = "網路連線異常"; } finally { btn.innerText = "登入系統"; btn.disabled = false; }
}

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

        // 呼叫其他模組的初始化與渲染函數
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
    if(result.status === 'success') { alert("操作成功！"); loadAllData(); } else { alert("失敗：" + result.message); }
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
