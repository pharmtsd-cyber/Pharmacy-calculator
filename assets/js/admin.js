let CURRENT_USER = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').onclick = handleLogin;
    document.getElementById('btn-open-pw').onclick = () => document.getElementById('pw-modal').classList.remove('hidden');
    document.getElementById('btn-pw-cancel').onclick = () => document.getElementById('pw-modal').classList.add('hidden');
    document.getElementById('btn-pw-save').onclick = handleChangePassword;

    document.getElementById('btn-save-staff').onclick = saveStaff;
    document.getElementById('btn-save-param').onclick = saveParameter;
    document.getElementById('btn-cancel-param').onclick = resetParameterForm;
    document.getElementById('btn-save-drug').onclick = saveDrug;
    document.getElementById('btn-cancel-drug').onclick = resetDrugForm;
    document.getElementById('btn-save-formula').onclick = saveFormula;
    document.getElementById('btn-cancel-formula').onclick = resetFormulaForm;

    document.getElementById('filter-staff').addEventListener('input', renderLists);
    document.getElementById('filter-params').addEventListener('input', renderLists);
    document.getElementById('filter-drugs').addEventListener('input', renderLists);
    document.getElementById('filter-formulas').addEventListener('input', renderLists);

    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(item.getAttribute('data-target')).classList.add('active');
        });
    });

    document.getElementById('admin-formula-string').addEventListener('input', generateTestInputs);
    document.querySelectorAll('.op-btn').forEach(btn => {
        btn.onclick = (e) => {
            const textarea = document.getElementById('admin-formula-string');
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
        const [drugsData, paramsData, formulasData, staffData] = await Promise.all([
            fetchFromGAS('getDrugs'), fetchFromGAS('getParameters'), fetchFromGAS('getFormulas'), fetchFromGAS('getStaff')
        ]);
        if(drugsData) STORE.drugs = drugsData; if(paramsData) STORE.parameters = paramsData;
        if(formulasData) STORE.formulas = formulasData; if(staffData) STORE.staff = staffData;
        
        document.getElementById('stat-drugs').innerText = STORE.drugs.length;
        document.getElementById('stat-formulas').innerText = STORE.formulas.length;
        document.getElementById('stat-params').innerText = STORE.parameters.length;
        document.getElementById('stat-staff').innerText = STORE.staff.length;

        renderLists(); renderDrugSelect(); renderParameterPad();
    } catch(e) { console.error(e); }
}

function renderLists() {
    const fStaff = document.getElementById('filter-staff').value.toLowerCase();
    const fParams = document.getElementById('filter-params').value.toLowerCase();
    const fDrugs = document.getElementById('filter-drugs').value.toLowerCase();
    const fFormulas = document.getElementById('filter-formulas').value.toLowerCase();

    document.getElementById('list-staff').innerHTML = STORE.staff.filter(s => (s.name||'').toLowerCase().includes(fStaff) || String(s.emp_id).includes(fStaff))
        .map(s => `<tr><td>${s.emp_id}</td><td>${s.name}</td><td>${s.role}</td><td><span class="${s.status==='Y'?'text-green-600':'text-red-500'}">${s.status}</span></td>
            <td>${(CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'Programmer') ? `<button onclick="deleteRecord('deleteStaff', '${s.emp_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>` : ''}</td></tr>`).join('');

    document.getElementById('list-params').innerHTML = STORE.parameters.filter(p => (p.param_code||'').toLowerCase().includes(fParams) || (p.param_name||'').toLowerCase().includes(fParams))
        .map(p => `<tr><td>${p.param_code}</td><td>${p.param_name}</td><td>${p.default_unit}</td>
            <td><button onclick='editParameter(${JSON.stringify(p).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteParameter', '${p.param_code}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');

    // 修正 Drug undefined: 使用預設空字串
    document.getElementById('list-drugs').innerHTML = STORE.drugs.filter(d => ((d.local_name||'')+(d.generic_name||'')+(d.brand_name||'')+(d.common_brand||'')+(d.cat_1||'')).toLowerCase().includes(fDrugs))
        .map(d => `<tr>
            <td><span class="bg-blue-100 text-blue-800 text-[10px] px-1 rounded">${d.cat_1||''}</span>${d.cat_2 ? `<i class="fa-solid fa-angle-right text-[10px] mx-1 text-gray-400"></i><span class="bg-blue-50 text-blue-800 text-[10px] px-1 rounded">${d.cat_2}</span>` : ''}</td>
            <td><div class="font-bold text-blue-900">${d.local_name||'無中文名稱'} ${d.common_brand?'('+d.common_brand+')':''}</div><div class="text-[10px] text-gray-500">${d.generic_name||'無一般名稱'}</div></td>
            <td><span class="${d.status==='Y'?'text-green-600':'text-red-500'} font-bold">${d.status}</span></td>
            <td><button onclick='editDrug(${JSON.stringify(d).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteDrug', '${d.drug_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');

    // 修正 Formula undefined: 根據 ID 查找 Drug，若無則顯示未知藥品
    document.getElementById('list-formulas').innerHTML = STORE.formulas.map(f => {
        const drug = STORE.drugs.find(d => d.drug_id === f.drug_id);
        return { ...f, drug_name: drug ? (drug.local_name || drug.generic_name || '無名稱') : '未知藥品' };
    }).filter(f => (f.drug_name||'').toLowerCase().includes(fFormulas) || (f.formula_name||'').toLowerCase().includes(fFormulas))
        .map(f => `<tr><td class="font-bold">${f.drug_name}</td><td>${f.formula_name}</td><td class="font-mono text-xs text-blue-800 bg-blue-50 p-1 rounded">${f.formula_string}</td>
            <td class="text-xs text-red-600">單:${f.single_max||'--'} ${f.single_max_unit||''}<br>日:${f.daily_max||'--'} ${f.daily_max_unit||''}</td>
            <td><button onclick='editFormula(${JSON.stringify(f).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteFormula', '${f.formula_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
}

async function saveStaff() {
    if (CURRENT_USER.role !== 'Admin' && CURRENT_USER.role !== 'Programmer') return alert('權限不足');
    const id = document.getElementById('staff-id').value.trim(), name = document.getElementById('staff-name').value.trim();
    if(!id || !name) return alert("必填欄位空白");
    if(STORE.staff.some(s => String(s.emp_id) === String(id))) return alert("員編已存在");
    await sendPost({ action: 'saveStaff', emp_id: id, name: name, role: document.getElementById('staff-role').value, status: document.getElementById('staff-status').value });
    document.getElementById('staff-id').value = ''; document.getElementById('staff-name').value = '';
}

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
    if(!code || !name) return alert("必填欄位空白"); if(!/^[a-zA-Z0-9_]+$/.test(code)) return alert("代碼限英文與底線");
    if(mode === 'add' && STORE.parameters.some(p => p.param_code === code)) return alert("代碼已存在");
    await sendPost({ action: 'saveParameter', mode: mode, param_code: code, param_name: name, default_unit: document.getElementById('param-unit').value }); resetParameterForm();
}

function editDrug(d) {
    document.getElementById('drug-mode').value = 'edit'; document.getElementById('drug-id').value = d.drug_id;
    document.getElementById('drug-cat1').value = d.cat_1||''; document.getElementById('drug-cat2').value = d.cat_2||''; document.getElementById('drug-cat3').value = d.cat_3||'';
    document.getElementById('drug-local').value = d.local_name||''; document.getElementById('drug-brand').value = d.brand_name||''; document.getElementById('drug-common-brand').value = d.common_brand||''; document.getElementById('drug-generic').value = d.generic_name||'';
    document.getElementById('drug-ingred').value = d.ingredients||''; document.getElementById('drug-dose-inst').value = d.dose_instruction||''; document.getElementById('drug-url').value = d.reference_url||''; document.getElementById('drug-status').value = d.status;
    document.getElementById('btn-save-drug').innerText = "更新儲存"; document.getElementById('btn-cancel-drug').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetDrugForm() {
    document.getElementById('drug-mode').value = 'add'; document.getElementById('drug-id').value = '';
    ['cat1','cat2','cat3','local','brand','common-brand','generic','ingred','dose-inst','url'].forEach(id => document.getElementById(`drug-${id}`).value = '');
    document.getElementById('btn-save-drug').innerText = "儲存藥品"; document.getElementById('btn-cancel-drug').classList.add('hidden');
}
async function saveDrug() {
    const payload = {
        action: 'saveDrug', mode: document.getElementById('drug-mode').value, drug_id: document.getElementById('drug-id').value,
        cat_1: document.getElementById('drug-cat1').value, cat_2: document.getElementById('drug-cat2').value, cat_3: document.getElementById('drug-cat3').value,
        local_name: document.getElementById('drug-local').value, brand_name: document.getElementById('drug-brand').value, common_brand: document.getElementById('drug-common-brand').value, generic_name: document.getElementById('drug-generic').value,
        ingredients: document.getElementById('drug-ingred').value, dose_instruction: document.getElementById('drug-dose-inst').value, reference_url: document.getElementById('drug-url').value, status: document.getElementById('drug-status').value
    };
    if(!payload.cat_1 || !payload.local_name || !payload.generic_name) return alert("必填欄位空白");
    await sendPost(payload); resetDrugForm();
}

function editFormula(f) {
    document.getElementById('formula-mode').value = 'edit'; document.getElementById('formula-id').value = f.formula_id; document.getElementById('admin-drug-select').value = f.drug_id;
    document.getElementById('admin-formula-name').value = f.formula_name; document.getElementById('admin-result-unit').value = f.result_unit; document.getElementById('admin-remark').value = f.remark || '';
    document.getElementById('formula-single-max').value = f.single_max||''; document.getElementById('formula-single-unit').value = f.single_max_unit||''; document.getElementById('formula-daily-max').value = f.daily_max||''; document.getElementById('formula-daily-unit').value = f.daily_max_unit||'';
    document.getElementById('admin-formula-string').value = f.formula_string; generateTestInputs();
    document.getElementById('btn-save-formula').innerText = "更新公式"; document.getElementById('btn-cancel-formula').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetFormulaForm() {
    document.getElementById('formula-mode').value = 'add'; document.getElementById('formula-id').value = '';
    ['admin-drug-select','admin-formula-name','admin-result-unit','admin-remark','formula-single-max','formula-single-unit','formula-daily-max','formula-daily-unit','admin-formula-string'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('admin-test-inputs').innerHTML = '請先輸入公式'; document.getElementById('admin-test-result').innerText = '--';
    document.getElementById('btn-save-formula').innerText = "新增公式"; document.getElementById('btn-cancel-formula').classList.add('hidden');
}
async function saveFormula() {
    const payload = {
        action: 'saveFormula', mode: document.getElementById('formula-mode').value, formula_id: document.getElementById('formula-id').value, drug_id: document.getElementById('admin-drug-select').value,
        formula_name: document.getElementById('admin-formula-name').value, formula_string: document.getElementById('admin-formula-string').value, result_unit: document.getElementById('admin-result-unit').value,
        single_max: document.getElementById('formula-single-max').value, single_max_unit: document.getElementById('formula-single-unit').value, daily_max: document.getElementById('formula-daily-max').value, daily_max_unit: document.getElementById('formula-daily-unit').value, remark: document.getElementById('admin-remark').value
    };
    if(!payload.drug_id || !payload.formula_name || !payload.formula_string) return alert("必填欄位空白");
    await sendPost(payload); resetFormulaForm();
}

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
    await sendPost(payload);
}

function renderDrugSelect() {
    document.getElementById('admin-drug-select').innerHTML = '<option value="">-- 請選擇 --</option>' + STORE.drugs.map(d => `<option value="${d.drug_id}">${d.local_name || d.generic_name || '無名稱'}</option>`).join('');
}
function renderParameterPad() {
    document.getElementById('admin-param-pad').innerHTML = STORE.parameters.map(p => `<button type="button" class="text-xs bg-[#1B365D] text-white px-2 py-1 rounded hover:bg-blue-800" onclick="const ta=document.getElementById('admin-formula-string'); ta.value = ta.value.substring(0, ta.selectionStart) + '{${p.param_code}}' + ta.value.substring(ta.selectionEnd); generateTestInputs();">${p.param_name}</button>`).join('');
}
function generateTestInputs() {
    const formulaStr = document.getElementById('admin-formula-string').value, testContainer = document.getElementById('admin-test-inputs'), uniqueCodes = new Set();
    let match; const paramRegex = /{([^}]+)}/g; while ((match = paramRegex.exec(formulaStr)) !== null) uniqueCodes.add(match[1]);
    if (uniqueCodes.size === 0) { testContainer.innerHTML = '尚無參數'; document.getElementById('admin-test-result').innerText = '--'; return; }
    const oldValues = {}; document.querySelectorAll('.test-input').forEach(input => oldValues[input.getAttribute('data-testcode')] = input.value);
    testContainer.innerHTML = '';
    uniqueCodes.forEach(code => {
        const paramDef = STORE.parameters.find(p => p.param_code === code), displayName = paramDef ? paramDef.param_name : code;
        testContainer.innerHTML += `<div><label class="block text-[10px] font-bold">${displayName}</label><input type="number" data-testcode="${code}" class="test-input w-full border rounded px-1 py-0.5 text-xs" value="${oldValues[code]||''}"></div>`;
    });
    document.querySelectorAll('.test-input').forEach(input => input.addEventListener('input', runLiveTest));
    runLiveTest();
}
function runLiveTest() {
    let formulaStr = document.getElementById('admin-formula-string').value, allFilled = true;
    const inputs = document.querySelectorAll('.test-input');
    inputs.forEach(input => { if (!input.value) allFilled = false; else formulaStr = formulaStr.replace(new RegExp(`{${input.getAttribute('data-testcode')}}`, 'g'), input.value); });
    if (!allFilled || inputs.length === 0) return document.getElementById('admin-test-result').innerText = '--';
    try { document.getElementById('admin-test-result').innerText = Math.round(math.evaluate(formulaStr) * 100) / 100; } catch(e) { document.getElementById('admin-test-result').innerText = "錯誤"; }
}
