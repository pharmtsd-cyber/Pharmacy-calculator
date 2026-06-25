window.matrixRules = []; 

document.addEventListener('DOMContentLoaded', () => {
    // 綁定所有可能作為輸入目標的文字框，以利插入參數
    document.querySelectorAll('#admin-formula-min, #admin-formula-max').forEach(el => {
        el.addEventListener('focus', function() { window.lastFocusedFormulaInput = this; });
        el.addEventListener('click', function() { window.lastFocusedFormulaInput = this; });
        el.addEventListener('keyup', function() { window.lastFocusedFormulaInput = this; });
    });
    
    setupFormulaDrugDropdown();
});

// 矩陣規則 CRUD
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
        [window.matrixRules[index], window.matrixRules[index-1]] = [window.matrixRules[index-1], window.matrixRules[index]];
    } else if (direction === 'down' && index < window.matrixRules.length - 1) {
        [window.matrixRules[index], window.matrixRules[index+1]] = [window.matrixRules[index+1], window.matrixRules[index]];
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
                    <input type="text" value="${rule.condition}" onchange="updateMatrixRule('${rule.id}', 'condition', this.value)" onfocus="window.lastFocusedFormulaInput = this" class="flex-grow border border-gray-300 rounded p-1.5 text-xs font-mono focus:border-indigo-500 focus:bg-indigo-50 shadow-inner">
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-green-600 w-10 text-right"><i class="fa-solid fa-arrow-right"></i> THEN</span>
                    <textarea onchange="updateMatrixRule('${rule.id}', 'result', this.value)" onfocus="window.lastFocusedFormulaInput = this" rows="2" class="flex-grow border border-gray-300 rounded p-1.5 text-xs focus:border-green-500 focus:bg-green-50 shadow-inner">${rule.result}</textarea>
                </div>
            </div>
            <button type="button" onclick="removeMatrixRule('${rule.id}')" class="text-red-400 hover:text-red-600 mt-3 px-1"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('');
};

window.resetFormulaForm = function() {
    document.getElementById('formula-mode').value = 'add';
    document.getElementById('formula-id').value = '';
    document.getElementById('admin-formula-name').value = '';
    document.getElementById('admin-result-unit').value = '';
    document.getElementById('admin-remark').value = '';
    document.getElementById('admin-formula-min').value = '';
    document.getElementById('admin-formula-max').value = '';
    window.matrixRules = [];
    window.renderMatrixRulesUI();
    window.renderAdminParamPad();
};

window.saveFormula = async function() {
    const drugId = document.getElementById('formula-drug-id-hidden').value;
    const formulaName = document.getElementById('admin-formula-name').value.trim();
    if (!drugId || !formulaName) return alert("請務必【綁定藥品】並填寫【計算方法名稱】！");

    const btn = document.getElementById('btn-save-formula');
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> 儲存中...`;
    
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
        matrix_rules: JSON.stringify(window.matrixRules)
    };
    
    await sendPost(payload); 
    window.returnToDashboard(drugId); 
};

window.renderAdminParamPad = function() {
    const pad = document.getElementById('admin-param-pad');
    if(!pad) return;
    pad.innerHTML = STORE.parameters.map(p => 
        `<button type="button" class="bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-200 rounded px-2 py-1 text-[10px] font-bold shadow-sm transition" onclick="insertParamToFormula('{${p.param_code}}')">
            ${p.param_name} <span class="text-gray-400 font-normal ml-0.5">{${p.param_code}}</span>
        </button>`
    ).join('');
    document.querySelectorAll('.op-btn').forEach(btn => btn.onclick = () => insertParamToFormula(' ' + btn.innerText + ' '));
};

window.insertParamToFormula = function(text) {
    const input = window.lastFocusedFormulaInput || document.getElementById('admin-formula-min');
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    input.value = input.value.substring(0, start) + text + input.value.substring(end);
    input.focus();
    input.setSelectionRange(start + text.length, start + text.length);
};
