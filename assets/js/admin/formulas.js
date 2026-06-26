window.matrixRules = []; 
window.lastFocusedFormulaInput = null;

document.addEventListener('DOMContentLoaded', () => {
    // 綁定輸入框游標追蹤
    document.querySelectorAll('#admin-formula-min, #admin-formula-max').forEach(el => {
        el.addEventListener('focus', function() { window.lastFocusedFormulaInput = this; });
        el.addEventListener('click', function() { window.lastFocusedFormulaInput = this; });
        el.addEventListener('keyup', function() { window.lastFocusedFormulaInput = this; });
    });
    
    // 初始化藥品下拉選單
    setupFormulaDrugDropdown();
});

// --- 矩陣規則 CRUD ---
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
                    <input type="text" value="${rule.condition}" onchange="updateMatrixRule('${rule.id}', 'condition', this.value)" onfocus="window.lastFocusedFormulaInput = this" placeholder="判斷條件 (例: {age_Y} >= 6)" class="flex-grow border border-gray-300 rounded p-1.5 text-xs font-mono focus:border-indigo-500 focus:bg-indigo-50 shadow-inner">
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

// --- 公式頁面導航與表單重置 ---
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

    window.matrixRules = (f.matrix_rules) ? JSON.parse(f.matrix_rules) : [];
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
    document.getElementById('admin-formula-min').value = '';
    document.getElementById('admin-formula-max').value = '';
    window.matrixRules = [];
    window.renderMatrixRulesUI();
    window.renderAdminParamPad();
};

window.saveFormula = async function() {
    const drugId = document.getElementById('formula-drug-id-hidden').value;
    const formulaName = document.getElementById('admin-formula-name').value.trim();
    if (!drugId || !formulaName) return alert("請務必綁定藥品並填寫公式名稱！");

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

// --- 下拉選單與輔助輸入 ---
window.renderFormulaDrugTag = function(drugId) {
    const container = document.getElementById('tags-formulaDrug');
    const d = STORE.drugs.find(x => String(x.drug_id) === String(drugId));
    if (d) {
        container.innerHTML = `<span class="bg-purple-100 border border-purple-300 text-purple-900 rounded px-2 py-1 text-sm font-bold flex items-center gap-2">
            ${d.drug_code||'--'} ${d.generic_name||'無學名'}
            <i class="fa-solid fa-xmark cursor-pointer" onclick="document.getElementById('tags-formulaDrug').innerHTML=''; document.getElementById('formula-drug-id-hidden').value='';"></i>
        </span>`;
    }
};

window.setupFormulaDrugDropdown = function() {
    const input = document.getElementById('input-formulaDrug');
    const drop = document.getElementById('drop-formulaDrug');
    if(!input || !drop) return;

    const updateDrop = () => {
        const keyword = input.value.toLowerCase().trim();
        const filtered = STORE.drugs.filter(item => 
            `${item.drug_code||''} ${item.local_name||''} ${item.generic_name||''}`.toLowerCase().includes(keyword)
        );
        drop.innerHTML = filtered.map(item => `
            <div class="p-2 text-sm hover:bg-purple-50 cursor-pointer border-b" onclick="document.getElementById('formula-drug-id-hidden').value='${item.drug_id}'; window.renderFormulaDrugTag('${item.drug_id}'); document.getElementById('drop-formulaDrug').classList.add('hidden');">
                ${item.drug_code} ${item.generic_name}
            </div>`).join('');
        drop.classList.remove('hidden');
    };
    input.addEventListener('focus', updateDrop);
    input.addEventListener('input', window.debounce(updateDrop, 300));
};

window.renderAdminParamPad = function() {
    const pad = document.getElementById('admin-param-pad');
    if(!pad) return;
    
    // 渲染一般參數
    let html = STORE.parameters.map(p => 
        `<button type="button" class="bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-200 rounded px-2 py-1 text-[10px] font-bold shadow-sm transition" onclick="insertParamToFormula('{${p.param_code}}')">
            ${p.param_name} <span class="text-gray-400 font-normal ml-0.5">{${p.param_code}}</span>
        </button>`
    ).join('');
    
    // 【新增】加入虛擬參數按鈕 (使用不同顏色區隔)
    html += `
        <button type="button" class="bg-pink-100 hover:bg-pink-200 text-pink-800 border border-pink-200 rounded px-2 py-1 text-[10px] font-bold shadow-sm transition ml-2" onclick="insertParamToFormula('{min}')">
            下限結果 <span class="text-pink-400 font-normal ml-0.5">{min}</span>
        </button>
        <button type="button" class="bg-pink-100 hover:bg-pink-200 text-pink-800 border border-pink-200 rounded px-2 py-1 text-[10px] font-bold shadow-sm transition" onclick="insertParamToFormula('{max}')">
            上限結果 <span class="text-pink-400 font-normal ml-0.5">{max}</span>
        </button>
    `;
    
    pad.innerHTML = html;
    
    document.querySelectorAll('.op-btn').forEach(btn => {
        btn.onclick = () => insertParamToFormula(' ' + btn.innerText + ' ');
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

// ==========================================
// 公式範本載入功能 (Copy Template Feature)
// ==========================================

window.openTemplateModal = function() {
    document.getElementById('modal-template').classList.remove('hidden');
    document.getElementById('input-template-search').value = '';
    window.renderTemplateList('');
};

window.renderTemplateList = function(keyword) {
    const list = document.getElementById('list-template-formulas');
    const kw = keyword.toLowerCase().trim();
    
    // 篩選出符合關鍵字的公式
    const filtered = STORE.formulas.filter(f => {
        if (!kw) return true;
        const searchStr = `${f.formula_name} ${f.drug_id}`.toLowerCase();
        return searchStr.includes(kw);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<tr><td class="text-center py-4 text-gray-400">找不到相符的公式</td></tr>`;
        return;
    }

    // 渲染清單，並找出對應的藥品名稱讓您好辨識
    list.innerHTML = filtered.map(f => {
        const d = STORE.drugs.find(x => String(x.drug_id) === String(f.drug_id));
        const drugDisplay = d ? `<span class="text-orange-600">${d.drug_code||''}</span> ${d.generic_name||''}` : `<span class="text-gray-400">未知藥品 ID: ${f.drug_id}</span>`;
        
        return `<tr class="hover:bg-orange-50 cursor-pointer transition border-b border-gray-100" onclick="window.applyTemplate('${f.formula_id}')">
            <td class="p-3">
                <div class="font-bold text-blue-900 text-sm mb-1"><i class="fa-solid fa-calculator text-gray-400 mr-1"></i> ${f.formula_name}</div>
                <div class="text-[11px] text-gray-500 font-bold">來源: ${drugDisplay}</div>
            </td>
            <td class="p-3 text-right w-24 align-middle">
                <span class="text-xs bg-orange-500 hover:bg-orange-600 text-white shadow-sm px-3 py-1.5 rounded font-bold">套用此公式</span>
            </td>
        </tr>`;
    }).join('');
};

// 綁定搜尋框事件
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('input-template-search');
    if (searchInput) {
        searchInput.addEventListener('input', window.debounce((e) => window.renderTemplateList(e.target.value), 300));
    }
});

// 核心：將選擇的公式資料灌入目前的編輯表單
window.applyTemplate = function(formulaId) {
    const f = STORE.formulas.find(x => x.formula_id === formulaId);
    if (!f) return;
    
    if (!confirm(`確定要載入「${f.formula_name}」？\n注意：這將會覆蓋您目前編輯區的內容！`)) return;

    // 將資料寫入目前的表單欄位 (不修改 drug-id，保持綁定在當前藥品)
    document.getElementById('admin-formula-name').value = f.formula_name + " (複製)";
    document.getElementById('admin-result-unit').value = f.result_unit || '';
    document.getElementById('admin-remark').value = f.remark || '';
    document.getElementById('admin-formula-min').value = f.formula_min || '';
    document.getElementById('admin-formula-max').value = f.formula_max || '';

    // 解析矩陣規則
    if (f.matrix_rules && f.matrix_rules.trim() !== '' && f.matrix_rules !== '[]') {
        try { window.matrixRules = JSON.parse(f.matrix_rules); } catch(e) { window.matrixRules = []; }
    } else {
        window.matrixRules = [];
    }
    
    // 【關鍵防護】重新生成矩陣規則的 ruleId，避免未來在拖拉排序或修改時產生 ID 衝突
    window.matrixRules = window.matrixRules.map(r => ({
        ...r,
        id: 'rule_' + Date.now() + Math.floor(Math.random() * 1000)
    }));

    // 重繪矩陣 UI 並關閉彈窗
    window.renderMatrixRulesUI();
    document.getElementById('modal-template').classList.add('hidden');
};

// --- [公式編輯即時預覽功能] ---
window.setupFormulaPreview = function() {
    const minEl = document.getElementById('admin-formula-min');
    const maxEl = document.getElementById('admin-formula-max');
    const container = document.getElementById('test-params-container');
    const displayEl = document.getElementById('preview-result-value');
    
    if (!minEl || !maxEl || !container || !displayEl) return;

    const runPreview = () => {
        const params = new Set([...minEl.value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1])
                        .concat([...maxEl.value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1])));
        
        if (container.dataset.rendered !== JSON.stringify([...params])) {
            container.innerHTML = '';
            params.forEach(code => {
                const div = document.createElement('div');
                div.innerHTML = `<label class="text-[9px] font-bold text-gray-500 uppercase">${code}</label>
                                 <input type="number" class="w-20 border border-gray-300 rounded p-1 text-xs" data-param="${code}" placeholder="數值">`;
                div.querySelector('input').addEventListener('input', runPreview);
                container.appendChild(div);
            });
            container.dataset.rendered = JSON.stringify([...params]);
        }

        let scope = {};
        container.querySelectorAll('input').forEach(i => scope[i.getAttribute('data-param')] = parseFloat(i.value) || 0);

        // 使用內建邏輯運算，不再依賴外部 window.sharedCalc，保證穩定
        const smartEval = (str) => {
            try {
                let s = String(str).replace(/x/gi, '*').replace(/<>/g, '!=');
                for (let code in scope) s = s.replace(new RegExp(`\\{${code}\\}`, 'gi'), scope[code] || 0);
                s = s.replace(/{[a-zA-Z0-9_]+}/g, '0');
                return new Function('return ' + s)();
            } catch(e) { return null; }
        };

        const vMin = smartEval(minEl.value);
        const vMax = smartEval(maxEl.value);
        displayEl.innerText = `Min: ${typeof vMin === 'number' ? vMin.toFixed(2) : '--'} | Max: ${typeof vMax === 'number' ? vMax.toFixed(2) : '--'}`;
    };

    minEl.addEventListener('input', runPreview);
    maxEl.addEventListener('input', runPreview);
};
