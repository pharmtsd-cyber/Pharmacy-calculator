let CURRENT_USER = null;
let CONTEXT_DRUG = null;
let ACTIVE_FORMULA_INPUT = 'admin-formula-min';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').onclick = handleLogin;
    document.getElementById('btn-open-pw').onclick = () => document.getElementById('pw-modal').classList.remove('hidden');
    document.getElementById('btn-pw-cancel').onclick = () => document.getElementById('pw-modal').classList.add('hidden');
    document.getElementById('btn-pw-save').onclick = handleChangePassword;

    document.getElementById('btn-save-staff').onclick = saveStaff;
    document.getElementById('btn-save-param').onclick = saveParameter;
    document.getElementById('btn-cancel-param').onclick = resetParameterForm;
    document.getElementById('btn-save-cat').onclick = saveCategory;
    document.getElementById('btn-cancel-cat').onclick = resetCategoryForm;
    document.getElementById('btn-save-anno').onclick = saveAnnouncement;
    document.getElementById('btn-cancel-anno').onclick = resetAnnouncementForm;
    document.getElementById('btn-save-drug').onclick = saveDrug;
    document.getElementById('btn-cancel-drug').onclick = resetDrugForm;
    
    document.getElementById('btn-show-add-formula').onclick = () => { resetFormulaForm(); document.getElementById('formula-editor-container').classList.remove('hidden'); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); };
    document.getElementById('btn-close-formula-editor').onclick = () => document.getElementById('formula-editor-container').classList.add('hidden');
    document.getElementById('btn-save-formula').onclick = saveFormula;

    document.getElementById('filter-staff').addEventListener('input', renderLists);
    document.getElementById('filter-params').addEventListener('input', renderLists);
    document.getElementById('filter-cats').addEventListener('input', renderLists);
    document.getElementById('filter-drugs').addEventListener('input', renderLists);

    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(item.getAttribute('data-target')).classList.add('active');
            if (item.getAttribute('data-target') !== 'formulas') document.getElementById('nav-formulas').classList.add('hidden');
        });
    });

    document.getElementById('admin-formula-min').addEventListener('focus', () => ACTIVE_FORMULA_INPUT = 'admin-formula-min');
    document.getElementById('admin-formula-max').addEventListener('focus', () => ACTIVE_FORMULA_INPUT = 'admin-formula-max');
    document.getElementById('admin-formula-min').addEventListener('input', generateTestInputs);
    document.getElementById('admin-formula-max').addEventListener('input', generateTestInputs);

    document.querySelectorAll('.op-btn').forEach(btn => {
        btn.onclick = (e) => {
            const textarea = document.getElementById(ACTIVE_FORMULA_INPUT);
            const startPos = textarea.selectionStart;
            const textToInsert = ` ${e.target.innerText} `;
            textarea.value = textarea.value.substring(0, startPos) + textToInsert + textarea.value.substring(textarea.selectionEnd);
            textarea.selectionStart = textarea.selectionEnd = startPos + textToInsert.length;
            textarea.focus();
            generateTestInputs();
        };
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
            document.getElementById('current-user-info').innerText = `${CURRENT_USER.name} (${CURRENT_USER.role})`;
            if (CURRENT_USER.role !== 'Admin' && CURRENT_USER.role !== 'Programmer') {
                document.getElementById('btn-save-staff').disabled = true; document.getElementById('btn-save-staff').classList.replace('bg-[#1B365D]', 'bg-gray-400');
            }
            loadAllData();
        } else msg.innerText = result.message;
    } catch(e) { msg.innerText = "網路連線異常"; } finally { btn.innerText = "登入系統"; btn.disabled = false; }
}

async function handleChangePassword() {
    const oldPw = document.getElementById('pw-old').value, newPw = document.getElementById('pw-new').value;
    if(!oldPw || !newPw) return alert("請完整輸入密碼");
    const res = await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'updatePassword', emp_id: CURRENT_USER.emp_id, old_password: oldPw, new_password: newPw }) });
    const result = await res.json();
    if(result.status === "success") { alert("密碼修改成功！"); document.getElementById('pw-modal').classList.add('hidden'); } else alert("修改失敗：" + result.message);
}

async function loadAllData() {
    try {
        STORE.categories = []; STORE.announcements = [];
        const [drugsData, paramsData, formulasData, staffData, catData, annoData] = await Promise.all([
            fetchFromGAS('getDrugs'), fetchFromGAS('getParameters'), fetchFromGAS('getFormulas'), fetchFromGAS('getStaff'), fetchFromGAS('getCategories'), fetchFromGAS('getAnnouncements')
        ]);
        if(drugsData) STORE.drugs = drugsData; if(paramsData) STORE.parameters = paramsData;
        if(formulasData) STORE.formulas = formulasData; if(staffData) STORE.staff = staffData;
        if(catData) STORE.categories = catData; if(annoData) STORE.announcements = annoData;
        
        document.getElementById('stat-drugs').innerText = STORE.drugs.length;
        document.getElementById('stat-formulas').innerText = STORE.formulas.length;
        document.getElementById('stat-params').innerText = STORE.parameters.length;
        document.getElementById('stat-staff').innerText = STORE.staff.length;

        renderLists(); renderParameterPad(); setupDrugCategorySelects();
        if (CONTEXT_DRUG) renderLocalFormulas();
    } catch(e) { console.error(e); }
}

function renderLists() {
    const fStaff = document.getElementById('filter-staff').value.toLowerCase(), fParams = document.getElementById('filter-params').value.toLowerCase(), fDrugs = document.getElementById('filter-drugs').value.toLowerCase(), fCats = document.getElementById('filter-cats').value.toLowerCase();
    
    // 員工清單
    document.getElementById('list-staff').innerHTML = STORE.staff.filter(s => (s.name||'').toLowerCase().includes(fStaff) || String(s.emp_id).includes(fStaff))
        .map(s => `<tr><td>${s.emp_id}</td><td>${s.name}</td><td>${s.role}</td><td><span class="${s.status==='Y'?'text-green-600':'text-red-500'}">${s.status}</span></td>
            <td>${(CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'Programmer') ? `<button onclick="deleteRecord('deleteStaff', '${s.emp_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>` : ''}</td></tr>`).join('');

    // 參數清單
    document.getElementById('list-params').innerHTML = STORE.parameters.filter(p => (p.param_code||'').toLowerCase().includes(fParams) || (p.param_name||'').toLowerCase().includes(fParams))
        .map(p => `<tr><td>${p.param_code}</td><td>${p.param_name}</td><td>${p.default_unit}</td>
            <td><button onclick='editParameter(${JSON.stringify(p).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteParameter', '${p.param_code}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');

    // 分類清單
    document.getElementById('list-categories').innerHTML = STORE.categories.filter(c => ((c.cat_1||'')+(c.cat_2||'')+(c.cat_3||'')).toLowerCase().includes(fCats))
        .map(c => `<tr><td>${c.cat_1}</td><td>${c.cat_2||''}</td><td>${c.cat_3||''}</td>
            <td><button onclick='editCategory(${JSON.stringify(c).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteCategory', '${c.cat_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');

    // 公告清單
    document.getElementById('list-announcements').innerHTML = STORE.announcements.sort((a,b) => new Date(b.date) - new Date(a.date)).map(a => `<tr>
            <td>${a.is_pinned==='Y' ? '<i class="fa-solid fa-star text-yellow-500"></i>' : ''}</td><td>${a.version}</td><td>${a.date ? new Date(a.date).toLocaleDateString() : ''}</td><td class="whitespace-pre-wrap">${a.content}</td>
            <td><button onclick='editAnnouncement(${JSON.stringify(a).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteAnnouncement', '${a.announce_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');

    // 藥品清單
    document.getElementById('list-drugs').innerHTML = STORE.drugs.filter(d => ((d.local_name||'')+(d.generic_name||'')+(d.brand_name||'')+(d.common_brand||'')+(d.cat_1||'')).toLowerCase().includes(fDrugs))
        .map(d => `<tr>
            <td><span class="bg-blue-100 text-blue-800 text-[10px] px-1 rounded">${d.cat_1||''}</span>${d.cat_2 ? `<i class="fa-solid fa-angle-right text-[10px] mx-1 text-gray-400"></i><span class="bg-blue-50 text-blue-800 text-[10px] px-1 rounded">${d.cat_2}</span>` : ''}</td>
            <td><div class="font-bold text-blue-900">${d.local_name||'無中文名稱'} ${d.common_brand?'('+d.common_brand+')':''}</div><div class="text-[10px] text-gray-500">${d.generic_name||'無一般名稱'}</div></td>
            <td><span class="${d.status==='Y'?'text-green-600':'text-red-500'} font-bold">${d.status}</span></td>
            <td>
                <button onclick="openFormulaManager('${d.drug_id}')" class="text-purple-600 hover:text-purple-800 mr-3 font-bold text-xs bg-purple-50 px-2 py-1 rounded border border-purple-200" title="管理專屬公式"><i class="fa-solid fa-flask"></i> 公式 (${STORE.formulas.filter(f => f.drug_id === d.drug_id).length})</button>
                <button onclick='editDrug(${JSON.stringify(d).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 mr-2" title="編輯藥品"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteRecord('deleteDrug', '${d.drug_id}')" class="text-red-500 hover:text-red-700" title="刪除藥品"><i class="fa-solid fa-trash"></i></button>
            </td></tr>`).join('');
}

// 聯動藥品分類的下拉選單
function setupDrugCategorySelects() {
    const c1 = document.getElementById('drug-cat1'), c2 = document.getElementById('drug-cat2'), c3 = document.getElementById('drug-cat3');
    const cat1s = [...new Set(STORE.categories.map(c => c.cat_1).filter(Boolean))];
    c1.innerHTML = '<option value="">--請選擇--</option>'; cat1s.forEach(c => c1.add(new Option(c, c)));
    c1.onchange = () => {
        c2.innerHTML = '<option value="">--請選擇--</option>'; c3.innerHTML = '<option value="">--請選擇--</option>';
        if (c1.value) {
            const cat2s = [...new Set(STORE.categories.filter(c => c.cat_1 === c1.value).map(c => c.cat_2).filter(Boolean))];
            cat2s.forEach(c => c2.add(new Option(c, c))); c2.disabled = false;
        } else c2.disabled = true; c3.disabled = true;
    };
    c2.onchange = () => {
        c3.innerHTML = '<option value="">--請選擇--</option>';
        if (c2.value) {
            const cat3s = [...new Set(STORE.categories.filter(c => c.cat_1 === c1.value && c.cat_2 === c2.value).map(c => c.cat_3).filter(Boolean))];
            cat3s.forEach(c => c3.add(new Option(c, c))); c3.disabled = false;
        } else c3.disabled = true;
    };
}

// CRUD - 公告
function editAnnouncement(a) {
    document.getElementById('anno-mode').value = 'edit'; document.getElementById('anno-id').value = a.announce_id;
    document.getElementById('anno-version').value = a.version; 
    document.getElementById('anno-date').value = a.date ? new Date(a.date).toISOString().split('T')[0] : '';
    document.getElementById('anno-pinned').value = a.is_pinned; document.getElementById('anno-content').value = a.content;
    document.getElementById('btn-save-anno').innerText = "更新公告"; document.getElementById('btn-cancel-anno').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetAnnouncementForm() {
    document.getElementById('anno-mode').value = 'add'; document.getElementById('anno-id').value = '';
    ['version', 'date', 'content'].forEach(id => document.getElementById('anno-'+id).value = ''); document.getElementById('anno-pinned').value = 'N';
    document.getElementById('btn-save-anno').innerText = "新增公告"; document.getElementById('btn-cancel-anno').classList.add('hidden');
}
async function saveAnnouncement() {
    const payload = { action: 'saveAnnouncement', mode: document.getElementById('anno-mode').value, announce_id: document.getElementById('anno-id').value, version: document.getElementById('anno-version').value, date: document.getElementById('anno-date').value, is_pinned: document.getElementById('anno-pinned').value, content: document.getElementById('anno-content').value };
    if(!payload.version || !payload.date || !payload.content) return alert("必填不可空白");
    await sendPost(payload); resetAnnouncementForm();
}

// CRUD - 分類
function editCategory(c) {
    document.getElementById('cat-mode').value = 'edit'; document.getElementById('cat-id').value = c.cat_id;
    document.getElementById('cat-level1').value = c.cat_1; document.getElementById('cat-level2').value = c.cat_2 || ''; document.getElementById('cat-level3').value = c.cat_3 || '';
    document.getElementById('btn-save-cat').innerText = "更新分類"; document.getElementById('btn-cancel-cat').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetCategoryForm() {
    document.getElementById('cat-mode').value = 'add'; document.getElementById('cat-id').value = '';
    ['level1', 'level2', 'level3'].forEach(id => document.getElementById('cat-'+id).value = '');
    document.getElementById('btn-save-cat').innerText = "新增分類組合"; document.getElementById('btn-cancel-cat').classList.add('hidden');
}
async function saveCategory() {
    const payload = { action: 'saveCategory', mode: document.getElementById('cat-mode').value, cat_id: document.getElementById('cat-id').value, cat_1: document.getElementById('cat-level1').value.trim(), cat_2: document.getElementById('cat-level2').value.trim(), cat_3: document.getElementById('cat-level3').value.trim() };
    if(!payload.cat_1) return alert("第一層分類為必填");
    await sendPost(payload); resetCategoryForm();
}

// CRUD - 參數
function editParameter(p) {
    document.getElementById('param-mode').value = 'edit'; document.getElementById('param-code').value = p.param_code; document.getElementById('param-code').disabled = true;
    document.getElementById('param-name').value = p.param_name; document.getElementById('param-unit').value = p.default_unit;
    document.getElementById('btn-save-param').innerText = "更新參數"; document.getElementById('btn-cancel-param').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetParameterForm() {
    document.getElementById('param-mode').value = 'add'; document.getElementById('param-code').value = ''; document.getElementById('param-code').disabled = false;
    document.getElementById('param-name').value = ''; document.getElementById('param-unit').value = '';
    document.getElementById('btn-save-param').innerText = "新增參數"; document.getElementById('btn-cancel-param').classList.add('hidden');
}
async function saveParameter() {
    const mode = document.getElementById('param-mode').value, code = document.getElementById('param-code').value.trim(), name = document.getElementById('param-name').value.trim();
    if(!code || !name) return alert("必填"); if(!/^[a-zA-Z0-9_]+$/.test(code)) return alert("代碼限英文與底線");
    if(mode === 'add' && STORE.parameters.some(p => p.param_code === code)) return alert("代碼已存在");
    await sendPost({ action: 'saveParameter', mode: mode, param_code: code, param_name: name, default_unit: document.getElementById('param-unit').value }); resetParameterForm();
}

// CRUD - 藥品
function editDrug(d) {
    document.getElementById('drug-mode').value = 'edit'; document.getElementById('drug-id').value = d.drug_id;
    // 為了觸發下拉聯動，要依序給值並發送 change 事件
    const c1 = document.getElementById('drug-cat1'), c2 = document.getElementById('drug-cat2'), c3 = document.getElementById('drug-cat3');
    c1.value = d.cat_1 || ''; c1.dispatchEvent(new Event('change'));
    c2.value = d.cat_2 || ''; c2.dispatchEvent(new Event('change'));
    c3.value = d.cat_3 || '';
    
    ['local','brand','common-brand','generic','ingred','dose-inst','url','form','other-forms'].forEach(id => document.getElementById(`drug-${id}`).value = d[id.replace('-','_')+'_name'] || d[id.replace('-','_')] || '');
    document.getElementById('drug-status').value = d.status; document.getElementById('btn-save-drug').innerText = "更新儲存"; document.getElementById('btn-cancel-drug').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetDrugForm() {
    document.getElementById('drug-mode').value = 'add'; document.getElementById('drug-id').value = '';
    ['cat1','cat2','cat3'].forEach(id => { const el = document.getElementById(`drug-${id}`); el.value = ''; if(id!=='cat1') el.disabled = true; });
    ['local','brand','common-brand','generic','ingred','dose-inst','url','form','other-forms'].forEach(id => document.getElementById(`drug-${id}`).value = '');
    document.getElementById('btn-save-drug').innerText = "儲存藥品"; document.getElementById('btn-cancel-drug').classList.add('hidden');
}
async function saveDrug() {
    const p = { action: 'saveDrug', mode: document.getElementById('drug-mode').value, drug_id: document.getElementById('drug-id').value, status: document.getElementById('drug-status').value };
    ['cat1','cat2','cat3','local','brand','common-brand','generic','ingred','dose-inst','url','form','other-forms'].forEach(id => p[id.replace('-','_') + (id.includes('brand')||id==='local'||id==='generic'?'_name':'')] = document.getElementById(`drug-${id}`).value);
    if(!p.cat_1 || !p.local_name || !p.generic_name) return alert("必填欄位空白");
    await sendPost(p); resetDrugForm();
}

async function saveStaff() {
    if (CURRENT_USER.role !== 'Admin' && CURRENT_USER.role !== 'Programmer') return alert('權限不足');
    const id = document.getElementById('staff-id').value.trim(), name = document.getElementById('staff-name').value.trim();
    if(!id || !name) return alert("必填"); if(STORE.staff.some(s => String(s.emp_id) === String(id))) return alert("員編已存在");
    await sendPost({ action: 'saveStaff', emp_id: id, name: name, role: document.getElementById('staff-role').value, status: document.getElementById('staff-status').value });
    document.getElementById('staff-id').value = ''; document.getElementById('staff-name').value = '';
}

// CRUD - 公式主從架構
function openFormulaManager(drugId) {
    CONTEXT_DRUG = STORE.drugs.find(d => d.drug_id === drugId);
    if (!CONTEXT_DRUG) return;
    document.getElementById('formula-context-name').innerText = CONTEXT_DRUG.local_name || CONTEXT_DRUG.generic_name || '未命名藥品';
    document.querySelectorAll('.nav-item, .tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('formulas').classList.add('active');
    document.getElementById('nav-formulas').classList.remove('hidden'); document.getElementById('nav-formulas').classList.add('active');
    document.getElementById('formula-editor-container').classList.add('hidden');
    renderLocalFormulas(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderLocalFormulas() {
    if (!CONTEXT_DRUG) return;
    const localFormulas = STORE.formulas.filter(f => f.drug_id === CONTEXT_DRUG.drug_id);
    document.getElementById('list-local-formulas').innerHTML = localFormulas.length === 0 
        ? `<tr><td colspan="4" class="text-center text-gray-400 py-4">此藥品尚未建立任何公式</td></tr>`
        : localFormulas.map(f => `
            <tr class="cursor-pointer hover:bg-blue-50 transition" onclick='editFormula(${JSON.stringify(f).replace(/'/g, "&#39;")})'>
                <td class="font-bold text-blue-900"><i class="fa-solid fa-pen text-xs text-gray-300 mr-1"></i> ${f.formula_name}</td>
                <td class="font-mono text-[11px] text-blue-800 bg-blue-50 p-1 rounded">Min: ${f.formula_min||'--'}<br>Max: ${f.formula_max||'--'}</td>
                <td class="text-xs text-red-600">單:${f.single_max||'--'} ${f.single_max_unit||''}<br>日:${f.daily_max||'--'} ${f.daily_max_unit||''}</td>
                <td onclick="event.stopPropagation()"><button onclick="deleteRecord('deleteFormula', '${f.formula_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`).join('');
}

function editFormula(f) {
    document.getElementById('formula-mode').value = 'edit'; document.getElementById('formula-id').value = f.formula_id; 
    document.getElementById('admin-formula-name').value = f.formula_name; document.getElementById('admin-result-unit').value = f.result_unit; document.getElementById('admin-remark').value = f.remark || '';
    document.getElementById('formula-single-max').value = f.single_max||''; document.getElementById('formula-single-unit').value = f.single_max_unit||''; document.getElementById('formula-daily-max').value = f.daily_max||''; document.getElementById('formula-daily-unit').value = f.daily_max_unit||'';
    document.getElementById('admin-formula-min').value = f.formula_min||''; document.getElementById('admin-formula-max').value = f.formula_max||'';
    generateTestInputs();
    document.getElementById('formula-editor-title').innerText = "編輯公式：" + f.formula_name;
    document.getElementById('btn-save-formula').innerText = "更新儲存區間"; document.getElementById('formula-editor-container').classList.remove('hidden'); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
function resetFormulaForm() {
    document.getElementById('formula-mode').value = 'add'; document.getElementById('formula-id').value = '';
    ['admin-formula-name','admin-result-unit','admin-remark','formula-single-max','formula-single-unit','formula-daily-max','formula-daily-unit','admin-formula-min','admin-formula-max'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('admin-test-inputs').innerHTML = '請先輸入公式'; document.getElementById('admin-test-result').innerText = '-- ~ --';
    document.getElementById('formula-editor-title').innerText = "新增計算公式"; document.getElementById('btn-save-formula').innerText = "儲存區間公式";
}
async function saveFormula() {
    if (!CONTEXT_DRUG) return alert("發生錯誤：遺失藥品關聯綁定。");
    const payload = {
        action: 'saveFormula', mode: document.getElementById('formula-mode').value, formula_id: document.getElementById('formula-id').value, drug_id: CONTEXT_DRUG.drug_id,
        formula_name: document.getElementById('admin-formula-name').value, formula_min: document.getElementById('admin-formula-min').value, formula_max: document.getElementById('admin-formula-max').value, result_unit: document.getElementById('admin-result-unit').value,
        single_max: document.getElementById('formula-single-max').value, single_max_unit: document.getElementById('formula-single-unit').value, daily_max: document.getElementById('formula-daily-max').value, daily_max_unit: document.getElementById('formula-daily-unit').value, remark: document.getElementById('admin-remark').value
    };
    if(!payload.formula_name || !payload.formula_min) return alert("方法名稱與下限公式必填");
    await sendPost(payload); resetFormulaForm(); document.getElementById('formula-editor-container').classList.add('hidden');
}

// 共用工具
async function sendPost(payload) {
    const res = await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    if(result.status === 'success') { alert("操作成功！"); loadAllData(); } else { alert("失敗：" + result.message); }
}
async function deleteRecord(action, id) {
    if (action === 'deleteStaff' && id === '93397') return alert("不可刪除程式管理員！");
    if (!confirm("確定要刪除嗎？")) return;
    const payload = { action: action };
    if(action==='deleteStaff') payload.emp_id = id; if(action==='deleteParameter') payload.param_code = id; if(action==='deleteDrug') payload.drug_id = id; if(action==='deleteFormula') payload.formula_id = id;
    if(action==='deleteCategory') payload.cat_id = id; if(action==='deleteAnnouncement') payload.announce_id = id;
    await sendPost(payload);
}
function renderParameterPad() {
    document.getElementById('admin-param-pad').innerHTML = STORE.parameters.map(p => `<button type="button" class="text-xs bg-[#1B365D] text-white px-2 py-1 rounded hover:bg-blue-800" onclick="const ta=document.getElementById(ACTIVE_FORMULA_INPUT); ta.value = ta.value.substring(0, ta.selectionStart) + '{${p.param_code}}' + ta.value.substring(ta.selectionEnd); generateTestInputs();">${p.param_name}</button>`).join('');
}
function generateTestInputs() {
    const fMin = document.getElementById('admin-formula-min').value, fMax = document.getElementById('admin-formula-max').value, combinedStr = fMin + " " + fMax;
    const uniqueCodes = new Set(); let match; const paramRegex = /{([^}]+)}/g; 
    while ((match = paramRegex.exec(combinedStr)) !== null) uniqueCodes.add(match[1]);
    const testContainer = document.getElementById('admin-test-inputs');
    if (uniqueCodes.size === 0) { testContainer.innerHTML = '尚無參數'; document.getElementById('admin-test-result').innerText = '-- ~ --'; return; }
    
    const oldValues = {}; document.querySelectorAll('.test-input').forEach(input => oldValues[input.getAttribute('data-testcode')] = input.value);
    testContainer.innerHTML = '';
    uniqueCodes.forEach(code => {
        const paramDef = STORE.parameters.find(p => p.param_code === code), displayName = paramDef ? paramDef.param_name : code;
        testContainer.innerHTML += `<div><label class="block text-[10px] font-bold">${displayName}</label><input type="number" data-testcode="${code}" class="test-input w-full border border-blue-300 rounded px-1 py-0.5 text-xs focus:border-[#1B365D]" value="${oldValues[code]||''}"></div>`;
    });
    document.querySelectorAll('.test-input').forEach(input => input.addEventListener('input', runLiveTest)); runLiveTest();
}
function runLiveTest() {
    let fMin = document.getElementById('admin-formula-min').value, fMax = document.getElementById('admin-formula-max').value;
    document.querySelectorAll('.test-input').forEach(input => { 
        const val = input.value || '0', regex = new RegExp(`{${input.getAttribute('data-testcode')}}`, 'g');
        fMin = fMin.replace(regex, val); fMax = fMax.replace(regex, val);
    });
    let resMin = '--', resMax = '--';
    try { if (fMin.trim()) resMin = Math.round(math.evaluate(fMin) * 100) / 100; } catch(e){}
    try { if (fMax.trim()) resMax = Math.round(math.evaluate(fMax) * 100) / 100; } catch(e){}
    document.getElementById('admin-test-result').innerText = (fMax.trim() && resMax !== '--') ? `${resMin} ~ ${resMax}` : `${resMin}`;
}
