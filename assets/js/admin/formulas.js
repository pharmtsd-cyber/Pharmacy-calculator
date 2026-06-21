document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('btn-show-add-formula')) document.getElementById('btn-show-add-formula').onclick = () => { resetFormulaForm(); document.getElementById('formula-editor-container').classList.remove('hidden'); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); };
    if(document.getElementById('btn-close-formula-editor')) document.getElementById('btn-close-formula-editor').onclick = () => document.getElementById('formula-editor-container').classList.add('hidden');
    if(document.getElementById('btn-save-formula')) document.getElementById('btn-save-formula').onclick = saveFormula;

    let ACTIVE_FORMULA_INPUT = 'admin-formula-min';
    const minI = document.getElementById('admin-formula-min'), maxI = document.getElementById('admin-formula-max');
    if(minI) { minI.addEventListener('focus', () => ACTIVE_FORMULA_INPUT = 'admin-formula-min'); minI.addEventListener('input', generateTestInputs); }
    if(maxI) { maxI.addEventListener('focus', () => ACTIVE_FORMULA_INPUT = 'admin-formula-max'); maxI.addEventListener('input', generateTestInputs); }

    document.querySelectorAll('.op-btn').forEach(btn => {
        btn.onclick = (e) => {
            const textarea = document.getElementById(ACTIVE_FORMULA_INPUT);
            const startPos = textarea.selectionStart;
            const textToInsert = ` ${e.target.innerText} `;
            textarea.value = textarea.value.substring(0, startPos) + textToInsert + textarea.value.substring(textarea.selectionEnd);
            textarea.selectionStart = textarea.selectionEnd = startPos + textToInsert.length;
            textarea.focus(); generateTestInputs();
        };
    });
});

window.openFormulaManager = function(drugId) {
    CONTEXT_DRUG = STORE.drugs.find(d => d.drug_id === drugId);
    if (!CONTEXT_DRUG) return;
    document.getElementById('formula-context-name').innerText = CONTEXT_DRUG.local_name || CONTEXT_DRUG.generic_name || '未命名藥品';
    document.querySelectorAll('.nav-item, .tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('formulas').classList.add('active');
    document.getElementById('nav-formulas').classList.remove('hidden'); document.getElementById('nav-formulas').classList.add('active');
    document.getElementById('formula-editor-container').classList.add('hidden');
    renderLocalFormulas(); window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.renderLocalFormulas = function() {
    if (!CONTEXT_DRUG) return;
    const localFormulas = STORE.formulas.filter(f => f.drug_id === CONTEXT_DRUG.drug_id);
    document.getElementById('list-local-formulas').innerHTML = localFormulas.length === 0 
        ? `<tr><td colspan="4" class="text-center text-gray-400 py-4">此藥品尚未建立任何公式</td></tr>`
        : localFormulas.map(f => `
            <tr class="cursor-pointer hover:bg-blue-50 transition" onclick="editFormula('${f.formula_id}')">
                <td class="font-bold text-blue-900"><i class="fa-solid fa-pen text-xs text-gray-300 mr-1"></i> ${f.formula_name}</td>
                <td class="font-mono text-[11px] text-blue-800 bg-blue-50 p-1 rounded">Min: ${f.formula_min||'--'}<br>Max: ${f.formula_max||'--'}</td>
                <td class="text-xs text-red-600">單:${f.single_max||'--'} ${f.single_max_unit||''}<br>日:${f.daily_max||'--'} ${f.daily_max_unit||''}</td>
                <td onclick="event.stopPropagation()"><button onclick="deleteRecord('deleteFormula', '${f.formula_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`).join('');
};

window.editFormula = function(id) {
    const f = STORE.formulas.find(x => x.formula_id === id);
    if(!f) return;
    document.getElementById('formula-mode').value = 'edit'; document.getElementById('formula-id').value = f.formula_id; 
    document.getElementById('admin-formula-name').value = f.formula_name; document.getElementById('admin-result-unit').value = f.result_unit; document.getElementById('admin-remark').value = f.remark || '';
    document.getElementById('formula-single-max').value = f.single_max||''; document.getElementById('formula-single-unit').value = f.single_max_unit||''; document.getElementById('formula-daily-max').value = f.daily_max||''; document.getElementById('formula-daily-unit').value = f.daily_max_unit||'';
    document.getElementById('admin-formula-min').value = f.formula_min||''; document.getElementById('admin-formula-max').value = f.formula_max||'';
    generateTestInputs();
    
    document.getElementById('formula-editor-title').innerText = "編輯公式：" + f.formula_name;
    document.getElementById('btn-save-formula').innerText = "更新儲存區間"; 
    document.getElementById('formula-editor-container').classList.remove('hidden'); 
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
};

window.resetFormulaForm = function() {
    document.getElementById('formula-mode').value = 'add'; document.getElementById('formula-id').value = '';
    ['admin-formula-name','admin-result-unit','admin-remark','formula-single-max','formula-single-unit','formula-daily-max','formula-daily-unit','admin-formula-min','admin-formula-max'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('admin-test-inputs').innerHTML = '請先輸入公式'; document.getElementById('admin-test-result').innerText = '-- ~ --';
    document.getElementById('formula-editor-title').innerText = "新增計算公式"; document.getElementById('btn-save-formula').innerText = "儲存區間公式";
};

window.saveFormula = async function() {
    if (!CONTEXT_DRUG) return alert("發生錯誤：遺失藥品關聯綁定。");
    const payload = {
        action: 'saveFormula', mode: document.getElementById('formula-mode').value, formula_id: document.getElementById('formula-id').value, drug_id: CONTEXT_DRUG.drug_id,
        formula_name: document.getElementById('admin-formula-name').value, formula_min: document.getElementById('admin-formula-min').value, formula_max: document.getElementById('admin-formula-max').value, result_unit: document.getElementById('admin-result-unit').value,
        single_max: document.getElementById('formula-single-max').value, single_max_unit: document.getElementById('formula-single-unit').value, daily_max: document.getElementById('formula-daily-max').value, daily_max_unit: document.getElementById('formula-daily-unit').value, remark: document.getElementById('admin-remark').value
    };
    if(!payload.formula_name || !payload.formula_min) return alert("方法名稱與下限公式必填");
    await sendPost(payload); resetFormulaForm(); document.getElementById('formula-editor-container').classList.add('hidden');
};

window.renderParameterPad = function() {
    let activeInput = window.ACTIVE_FORMULA_INPUT || 'admin-formula-min';
    const pad = document.getElementById('admin-param-pad');
    if(pad) pad.innerHTML = STORE.parameters.map(p => `<button type="button" class="text-xs bg-[#1B365D] text-white px-2 py-1 rounded hover:bg-blue-800" onclick="const ta=document.getElementById('${activeInput}'); ta.value = ta.value.substring(0, ta.selectionStart) + '{${p.param_code}}' + ta.value.substring(ta.selectionEnd); generateTestInputs();">${p.param_name}</button>`).join('');
};

window.generateTestInputs = function() {
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
};

window.runLiveTest = function() {
    let fMin = document.getElementById('admin-formula-min').value, fMax = document.getElementById('admin-formula-max').value;
    document.querySelectorAll('.test-input').forEach(input => { 
        const val = input.value || '0', regex = new RegExp(`{${input.getAttribute('data-testcode')}}`, 'g');
        fMin = fMin.replace(regex, val); fMax = fMax.replace(regex, val);
    });
    let resMin = '--', resMax = '--';
    try { if (fMin.trim()) resMin = Math.round(math.evaluate(fMin) * 100) / 100; } catch(e){}
    try { if (fMax.trim()) resMax = Math.round(math.evaluate(fMax) * 100) / 100; } catch(e){}
    document.getElementById('admin-test-result').innerText = (fMax.trim() && resMax !== '--') ? `${resMin} ~ ${resMax}` : `${resMin}`;
};
