window.matrixRules = []; 

document.addEventListener('DOMContentLoaded', () => {
    // 綁定輸入框游標追蹤
    document.querySelectorAll('#admin-formula-min, #admin-formula-max').forEach(el => {
        el.addEventListener('focus', function() { window.lastFocusedFormulaInput = this; });
        el.addEventListener('click', function() { window.lastFocusedFormulaInput = this; });
        el.addEventListener('keyup', function() { window.lastFocusedFormulaInput = this; });
    });
    
    setupFormulaDrugDropdown();
});

// 【核心 2】矩陣規則的 CRUD 邏輯
window.addMatrixRule = function(condition = '', result = '') {
    const ruleId = 'rule_' + Date.now() + Math.floor(Math.random() * 1000);
    window.matrixRules.push({ id: ruleId, condition, result });
    renderMatrixRulesUI();
};

window.removeMatrixRule = function(ruleId) {
    window.matrixRules = window.matrixRules.filter(r => r.id !== ruleId);
    renderMatrixRulesUI();
};

window.updateMatrixRule = function(ruleId, field, value) {
    const rule = window.matrixRules.find(r => r.id === ruleId);
    if (rule) rule[field] = value;
};

window.moveMatrixRule = function(index, direction) {
    if (direction === 'up' && index > 0) {
        const temp = window.matrixRules[index];
        window.matrixRules[index] = window.matrixRules[index - 1];
        window.matrixRules[index - 1] = temp;
    } else if (direction === 'down' && index < window.matrixRules.length - 1) {
        const temp = window.matrixRules[index];
        window.matrixRules[index] = window.matrixRules[index + 1];
        window.matrixRules[index + 1] = temp;
    }
    renderMatrixRulesUI();
};

window.renderMatrixRulesUI = function() {
    const container = document.getElementById('matrix-rules-list');
    if (!container) return;
    
    container.innerHTML = window.matrixRules.map((rule, index) => `
        <div class="flex gap-2 items-start bg-white p-2.5 border border-indigo-200 rounded shadow-sm hover:border-indigo-400 transition">
            <div class="flex flex-col gap-1 items-center justify-center pt-1">
                <button type="button" onclick="window.moveMatrixRule(${index}, 'up')" class="text-gray-400 hover:text-indigo-600 disabled:opacity-30" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-caret-up"></i></button>
                <span class="bg-indigo-100 text-indigo-800 font-bold text-[10px] px-1.5 py-0.5 rounded">#${index + 1}</span>
                <button type="button" onclick="window.moveMatrixRule(${index}, 'down')" class="text-gray-400 hover:text-indigo-600 disabled:opacity-30" ${index === window.matrixRules.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-caret-down"></i></button>
            </div>
            
            <div class="flex-grow flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-gray-500 w-10 text-right"><i class="fa-solid fa-code-branch"></i> IF</span>
                    <input type="text" value="${rule.condition}" onchange="updateMatrixRule('${rule.id}', 'condition', this.value)" onfocus="window.lastFocusedFormulaInput = this" onclick="window.lastFocusedFormulaInput = this" onkeyup="window.lastFocusedFormulaInput = this" placeholder="判斷條件 (例: {CrCl} >= 50)" class="flex-grow border border-gray-300 rounded p-1.5 text-xs font-mono focus:border-indigo-500 focus:bg-indigo-50 shadow-inner">
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-green-600 w-10 text-right"><i class="fa-solid fa-arrow-right"></i> THEN</span>
                    <input type="text" value="${rule.result}" onchange="updateMatrixRule('${rule.id}', 'result', this.value)" onfocus="window.lastFocusedFormulaInput = this" onclick="window.lastFocusedFormulaInput = this" onkeyup="window.lastFocusedFormulaInput = this" placeholder="輸出建議 (例: 1g Q8H)" class="flex-grow border border-gray-300 rounded p-1.5 text-xs focus:border-green-500 focus:bg-green-50 shadow-inner">
                </div>
            </div>
            <button type="button" onclick="removeMatrixRule('${rule.id}')" class="text-red-400 hover:text-red-600 mt-3 px-1"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('');
};

window.goToAddFormula = function(drugId = '') {
    resetFormulaForm();
    document.getElementById('formula-editor-title').innerText = "新增計算公式";
    if (drugId) {
        document.getElementById('formula-drug-id-hidden').value = drugId;
        renderFormulaDrugTag(drugId);
    }
    switchTab('formulas');
    scrollToTop();
};

window.goToFormulaEdit = function(drugId, formulaId) {
    const f = STORE.formulas.find(x => x.formula_id === formulaId);
    if (!f) return;
    
    resetFormulaForm();
    document.getElementById('formula-editor-title').innerText = "編輯計算公式";
    document.getElementById('formula-mode').value = 'edit';
    document.getElementById('formula-id').value = f.formula_id;
    document.getElementById('formula-drug-id-hidden').value = drugId;
    
    renderFormulaDrugTag(drugId);

    document.getElementById('admin-formula-name').value = f.formula_name || '';
    document.getElementById('admin-result-unit').value = f.result_unit || '';
    document.getElementById('admin-remark').value = f.remark || '';
    document.getElementById('admin-formula-min').value = f.formula_min || '';
    document.getElementById('admin-formula-max').value = f.formula_max || '';

    // 直接讀取矩陣資料
    if (f.matrix_rules && f.matrix_rules.trim() !== '' && f.matrix_rules !== '[]') {
        try {
            window.matrixRules = JSON.parse(f.matrix_rules);
        } catch(e) {
            window.matrixRules = [];
        }
    } else {
        window.matrixRules = [];
    }
    
    window.renderMatrixRulesUI();
    switchTab('formulas');
    scrollToTop();
};

window.resetFormulaForm = function() {
    document.getElementById('formula-mode').value = 'add';
    document.getElementById('formula-id').value = '';
    document.getElementById('formula-drug-id-hidden').value = '';
    document.getElementById('tags-formulaDrug').innerHTML = '';
    document.getElementById('input-formulaDrug').value = '';
    document.getElementById('admin-formula-name').value = '';
    document.getElementById('admin-result-unit').value = '';
    document.getElementById('admin-remark').value = '';
    
    // 清除區間欄位
    document.getElementById('admin-formula-min').value = '';
    document.getElementById('admin-formula-max').value = '';
    
    // 徹底清除矩陣規則
    window.matrixRules = [];
    window.renderMatrixRulesUI();
    
    // 重新載入參數按鈕面板
    window.renderAdminParamPad();
};

window.saveFormula = async function() {
    const drugId = document.getElementById('formula-drug-id-hidden').value;
    const formulaName = document.getElementById('admin-formula-name').value.trim();
    
    if (!drugId || !formulaName) return alert("請務必【綁定藥品】並填寫【計算方法名稱】！");

    const payload = {
        action: 'saveFormula',
        mode: document.getElementById('formula-mode').value,
        formula_id: document.getElementById('formula-id').value,
        drug_id: drugId,
        formula_name: formulaName,
        result_unit: document.getElementById('admin-result-unit').value.trim(),
        remark: document.getElementById('admin-remark').value.trim(),
        formula_min: document.getElementById('admin-formula-min').value.trim(),
        formula_max: document.getElementById('admin-formula-max').value.trim(),
        // 絕對上限欄位已移除，這裡不再傳送
        matrix_rules: JSON.stringify(window.matrixRules)
    };
    
    await sendPost(payload); 
    window.returnToDashboard(drugId); 
};

window.renderFormulaDrugTag = function(drugId) {
    const container = document.getElementById('tags-formulaDrug');
    const d = STORE.drugs.find(x => String(x.drug_id) === String(drugId) || String(x.drug_code) === String(drugId));
    if (d) {
        container.innerHTML = `<span class="bg-purple-100 border border-purple-300 text-purple-900 rounded px-2 py-1 text-sm font-bold shadow-sm flex items-center gap-2">
            ${d.drug_code||'--'} ${d.generic_name||'無學名'}
            <i class="fa-solid fa-xmark cursor-pointer text-purple-400 hover:text-red-500 ml-1" onclick="document.getElementById('tags-formulaDrug').innerHTML=''; document.getElementById('formula-drug-id-hidden').value='';"></i>
        </span>`;
        document.getElementById('input-formulaDrug').value = '';
    }
};

window.setupFormulaDrugDropdown = function() {
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
            return `<div class="p-2 text-sm hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-0 truncate" onclick="document.getElementById('formula-drug-id-hidden').value='${item.drug_id}'; window.renderFormulaDrugTag('${item.drug_id}'); document.getElementById('drop-formulaDrug').classList.add('hidden');">
                <span class="text-orange-600 font-bold mr-1">${item.drug_code||''}</span> <span class="text-blue-900 font-bold">${item.generic_name||''}</span> <span class="text-gray-500 text-xs ml-1">${item.local_name||''}</span>
            </div>`;
        }).join('');
        drop.innerHTML = html || '<div class="p-2 text-xs text-gray-500 text-center">無符合資料</div>';
        drop.classList.remove('hidden');
    };

    input.addEventListener('focus', updateDrop);
    input.addEventListener('input', window.debounce(updateDrop, 300));
    document.addEventListener('click', (e) => { if (!input.contains(e.target) && !drop.contains(e.target)) drop.classList.add('hidden'); });
};

window.renderAdminParamPad = function() {
    const pad = document.getElementById('admin-param-pad');
    if(!pad) return;
    
    // 只渲染參數基本檔中的參數，不再包含 {prescribed}
    let html = STORE.parameters.map(p => 
        `<button type="button" class="bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-200 rounded px-2 py-1 text-[10px] font-bold shadow-sm transition" onclick="insertParamToFormula('{${p.param_code}}')">
            ${p.param_name} <span class="text-gray-400 font-normal ml-0.5">{${p.param_code}}</span>
        </button>`
    ).join('');
    
    pad.innerHTML = html;
    
    // 綁定運算子按鈕
    document.querySelectorAll('.op-btn').forEach(btn => {
        btn.onclick = function() { insertParamToFormula(' ' + this.innerText + ' '); };
    });
};

window.insertParamToFormula = function(text) {
    const input = window.lastFocusedFormulaInput || document.getElementById('admin-formula-min');
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    input.value = input.value.substring(0, start) + text + input.value.substring(end);
    input.focus();
    input.setSelectionRange(start + text.length, start + text.length);
};

window.toggleFormulaMode = function() {
    const mode = document.querySelector('input[name="formula-mode-switch"]:checked').value;
    const maxContainer = document.getElementById('absolute-max-container');
    if (mode === 'matrix') {
        document.getElementById('mode-basic-container').classList.add('hidden');
        document.getElementById('mode-matrix-container').classList.remove('hidden');
        maxContainer.classList.add('opacity-40', 'pointer-events-none');
    } else {
        document.getElementById('mode-basic-container').classList.remove('hidden');
        document.getElementById('mode-matrix-container').classList.add('hidden');
        maxContainer.classList.remove('opacity-40', 'pointer-events-none');
    }
};
