document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('btn-save-formula')) document.getElementById('btn-save-formula').onclick = saveFormula;

    let ACTIVE_FORMULA_INPUT = 'admin-formula-min';
    const minI = document.getElementById('admin-formula-min'), maxI = document.getElementById('admin-formula-max');
    if(minI) { minI.addEventListener('focus', () => ACTIVE_FORMULA_INPUT = 'admin-formula-min'); minI.addEventListener('input', generateTestInputs); }
    if(maxI) { maxI.addEventListener('focus', () => ACTIVE_FORMULA_INPUT = 'admin-formula-max'); maxI.addEventListener('input', generateTestInputs); }

    document.querySelectorAll('.op-btn').forEach(btn => {
        btn.onclick = (e) => {
            const textarea = document.getElementById(ACTIVE_FORMULA_INPUT);
            if(!textarea) return;
            const startPos = textarea.selectionStart;
            const textToInsert = ` ${e.target.innerText} `;
            textarea.value = textarea.value.substring(0, startPos) + textToInsert + textarea.value.substring(textarea.selectionEnd);
            textarea.selectionStart = textarea.selectionEnd = startPos + textToInsert.length;
            textarea.focus(); generateTestInputs();
        };
    });

    // 初始化公式頁面的藥品模糊搜尋
    setupFormulaDrugSearch();
});

// 【新增】公式專用的單選藥品模糊搜尋
function setupFormulaDrugSearch() {
    const input = document.getElementById('input-formulaDrug');
    const drop = document.getElementById('drop-formulaDrug');
    if(!input || !drop) return;

    const updateDrop = () => {
        const keyword = input.value.toLowerCase().trim();
        const keywords = keyword ? keyword.split(/\s+/) : [];
        
        const filtered = STORE.drugs.filter(item => {
            if(keywords.length === 0) return true;
            const searchStr = `${item.drug_code||''} ${item.local_name||''} ${item.generic_name||''} ${item.brand_name||''} ${item.common_brand||''}`.toLowerCase();
            return keywords.every(kw => searchStr.includes(kw));
        });
        
        const html = filtered.map(item => {
            const label = `<span class="text-orange-600 font-bold mr-1">${item.drug_code||''}</span> <span class="text-blue-900 font-bold">${item.generic_name||''}</span> <span class="text-gray-500 text-xs ml-1">${item.local_name||''} ${item.brand_name||''}</span>`;
            return `<div class="p-2 text-sm hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-0 truncate" 
                         onclick="setFormulaDrug('${item.drug_id}', '${(item.drug_code||'') + ' ' + (item.local_name||item.generic_name||'').replace(/'/g, "\\'")}')">${label}</div>`;
        }).join('');
        
        drop.innerHTML = html || '<div class="p-2 text-xs text-gray-500 text-center">無符合藥品</div>';
        drop.classList.remove('hidden');
    };

    input.addEventListener('focus', updateDrop);
    input.addEventListener('input', updateDrop);
    document.addEventListener('click', (e) => { if (!input.contains(e.target) && !drop.contains(e.target)) drop.classList.add('hidden'); });
}

// 【新增】選中藥品後，隱藏輸入框並顯示標籤
window.setFormulaDrug = function(drugId, displayLabel) {
    document.getElementById('formula-drug-id-hidden').value = drugId;
    document.getElementById('tags-formulaDrug').innerHTML = `
        <div class="bg-purple-100 border border-purple-300 text-purple-900 rounded px-3 py-1.5 text-sm font-bold flex items-center justify-between w-full shadow-sm">
            <span><i class="fa-solid fa-pills mr-1 text-purple-600"></i> ${displayLabel}</span>
            <i class="fa-solid fa-xmark cursor-pointer text-purple-400 hover:text-red-600 ml-2 text-lg px-2" onclick="removeFormulaDrug()"></i>
        </div>`;
    document.getElementById('input-formulaDrug').classList.add('hidden');
    document.getElementById('drop-formulaDrug').classList.add('hidden');
};

// 【新增】移除選中的藥品
window.removeFormulaDrug = function() {
    document.getElementById('formula-drug-id-hidden').value = '';
    document.getElementById('tags-formulaDrug').innerHTML = '';
    const inp = document.getElementById('input-formulaDrug');
    inp.classList.remove('hidden');
    inp.value = '';
    inp.focus();
};

// 【修改】全域呼叫的新增公式 (支援預設帶入藥品)
window.goToAddFormula = function(prefillDrugId = null) {
    resetFormulaForm();
    document.getElementById('formula-editor-title').innerText = "新增計算公式";
    
    if (prefillDrugId) {
        const d = STORE.drugs.find(x => String(x.drug_id) === String(prefillDrugId) || String(x.drug_code) === String(prefillDrugId));
        if (d) {
            const label = `${d.drug_code||''} ${d.local_name||d.generic_name||''}`;
            setFormulaDrug(d.drug_id, label);
        }
    }
    
    switchTab('formulas');
    scrollToTop();
};

window.goToFormulaEdit = function(drugId, formulaId) {
    const f = STORE.formulas.find(x => x.formula_id === formulaId);
    if(!f) return;
    
    resetFormulaForm();
    
    // 綁定藥品標籤
    const d = STORE.drugs.find(x => String(x.drug_id) === String(drugId) || String(x.drug_code) === String(drugId));
    if (d) {
        const label = `${d.drug_code||''} ${d.local_name||d.generic_name||''}`;
        setFormulaDrug(d.drug_id, label);
    } else {
        setFormulaDrug(f.drug_id, "遺失藥品關聯 (舊資料 ID: " + f.drug_id + ")");
    }

    const setVal = (elId, val) => { if(document.getElementById(elId)) document.getElementById(elId).value = val; };
    setVal('formula-mode', 'edit'); setVal('formula-id', f.formula_id);
    setVal('admin-formula-name', f.formula_name); setVal('admin-result-unit', f.result_unit);
    setVal('admin-remark', f.remark || ''); setVal('formula-single-max', f.single_max || '');
    setVal('formula-single-unit', f.single_max_unit || ''); setVal('formula-daily-max', f.daily_max || '');
    setVal('formula-daily-unit', f.daily_max_unit || ''); setVal('admin-formula-min', f.formula_min || '');
    setVal('admin-formula-max', f.formula_max || '');
    
    generateTestInputs();
    document.getElementById('formula-editor-title').innerText = "編輯公式：" + f.formula_name;
    document.getElementById('btn-save-formula').innerText = "更新儲存區間"; 
    
    switchTab('formulas');
    scrollToTop();
};

window.resetFormulaForm = function() {
    const setVal = (elId, val) => { if(document.getElementById(elId)) document.getElementById(elId).value = val; };
    setVal('formula-mode', 'add'); setVal('formula-id', '');
    ['admin-formula-name','admin-result-unit','admin-remark','formula-single-max','formula-single-unit','formula-daily-max','formula-daily-unit','admin-formula-min','admin-formula-max'].forEach(id => setVal(id, ''));
    
    // 清空藥品綁定標籤
    removeFormulaDrug();

    const testInp = document.getElementById('admin-test-inputs');
    if(testInp) testInp.innerHTML = '請先輸入公式'; 
    const testRes = document.getElementById('admin-test-result');
    if(testRes) testRes.innerText = '-- ~ --';
};

window.saveFormula = async function() {
    const assignedDrugId = document.getElementById('formula-drug-id-hidden').value;
    if (!assignedDrugId) return alert("請先從上方搜尋並點擊綁定一個藥品！");

    const getVal = id => document.getElementById(id) ? document.getElementById(id).value : '';
    const payload = {
        action: 'saveFormula', mode: getVal('formula-mode'), formula_id: getVal('formula-id'), drug_id: assignedDrugId,
        formula_name: getVal('admin-formula-name'), formula_min: getVal('admin-formula-min'), formula_max: getVal('admin-formula-max'), result_unit: getVal('admin-result-unit'),
        single_max: getVal('formula-single-max'), single_max_unit: getVal('formula-single-unit'), daily_max: getVal('formula-daily-max'), daily_max_unit: getVal('formula-daily-unit'), remark: getVal('admin-remark')
    };
    if(!payload.formula_name || !payload.formula_min) return alert("方法名稱與下限公式必填");
    await sendPost(payload); 
    returnToDashboard();
};

window.renderParameterPad = function() {
    let activeInput = window.ACTIVE_FORMULA_INPUT || 'admin-formula-min';
    const pad = document.getElementById('admin-param-pad');
    if(pad) pad.innerHTML = STORE.parameters.map(p => `<button type="button" class="text-xs bg-[#1B365D] text-white px-2 py-1 rounded hover:bg-blue-800" onclick="const ta=document.getElementById('${activeInput}'); ta.value = ta.value.substring(0, ta.selectionStart) + '{${p.param_code}}' + ta.value.substring(ta.selectionEnd); generateTestInputs();">${p.param_name}</button>`).join('');
};

window.generateTestInputs = function() {
    const fMin = document.getElementById('admin-formula-min') ? document.getElementById('admin-formula-min').value : '';
    const fMax = document.getElementById('admin-formula-max') ? document.getElementById('admin-formula-max').value : '';
    const combinedStr = fMin + " " + fMax;
    
    const uniqueCodes = new Set(); let match; const paramRegex = /{([^}]+)}/g; 
    while ((match = paramRegex.exec(combinedStr)) !== null) uniqueCodes.add(match[1]);
    
    const testContainer = document.getElementById('admin-test-inputs');
    if(!testContainer) return;
    
    if (uniqueCodes.size === 0) { testContainer.innerHTML = '尚無參數'; document.getElementById('admin-test-result').innerText = '-- ~ --'; return; }
    
    const oldValues = {}; document.querySelectorAll('.test-input').forEach(input => oldValues[input.getAttribute('data-testcode')] = input.value);
    testContainer.innerHTML = '';
    uniqueCodes.forEach(code => {
        const paramDef = STORE.parameters.find(p => p.param_code === code), displayName = paramDef ? paramDef.param_name : code;
        testContainer.innerHTML += `<div><label class="block text-[10px] font-bold">${displayName}</label><input type="number" data-testcode="${code}" class="test-input w-full border border-blue-300 rounded px-1 py-0.5 text-xs focus:border-[#1B365D]" value="${oldValues[code]||''}"></div>`;
    });
    document.querySelectorAll('.test-input').forEach(input => input.addEventListener('input', runLiveTest)); runLiveTest();
};

window.runLiveTest = function() {
    let fMin = document.getElementById('admin-formula-min') ? document.getElementById('admin-formula-min').value : '';
    let fMax = document.getElementById('admin-formula-max') ? document.getElementById('admin-formula-max').value : '';
    
    document.querySelectorAll('.test-input').forEach(input => { 
        const val = input.value || '0', regex = new RegExp(`{${input.getAttribute('data-testcode')}}`, 'g');
        fMin = fMin.replace(regex, val); fMax = fMax.replace(regex, val);
    });
    let resMin = '--', resMax = '--';
    try { if (fMin.trim()) resMin = Math.round(math.evaluate(fMin) * 100) / 100; } catch(e){}
    try { if (fMax.trim()) resMax = Math.round(math.evaluate(fMax) * 100) / 100; } catch(e){}
    
    const resEl = document.getElementById('admin-test-result');
    if(resEl) resEl.innerText = (fMax.trim() && resMax !== '--') ? `${resMin} ~ ${resMax}` : `${resMin}`;
};
