window.matrixRules = []; 

// 1. 定義輔助工具函式
window.debounce = function(func, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, delay);
    };
};

// 2. 定義各類業務邏輯函式 (確保這些定義在 DOMContentLoaded 之前)
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
    pad.innerHTML = STORE.parameters.map(p => 
        `<button type="button" class="bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-200 rounded px-2 py-1 text-[10px] font-bold shadow-sm transition" onclick="insertParamToFormula('{${p.param_code}}')">
            ${p.param_name} <span class="text-gray-400 font-normal ml-0.5">{${p.param_code}}</span>
        </button>`
    ).join('');
    
    document.querySelectorAll('.op-btn').forEach(btn => {
        btn.onclick = function() { insertParamToFormula(' ' + this.innerText + ' '); };
    });
};

window.renderMatrixRulesUI = function() { /* ... (您的 renderMatrixRulesUI 內容) ... */ };
// (其餘 CRUD 函式請繼續保持在這邊)

// 3. 綁定初始化邏輯
document.addEventListener('DOMContentLoaded', () => {
    // 綁定輸入框游標追蹤
    document.querySelectorAll('#admin-formula-min, #admin-formula-max').forEach(el => {
        el.addEventListener('focus', function() { window.lastFocusedFormulaInput = this; });
        el.addEventListener('click', function() { window.lastFocusedFormulaInput = this; });
        el.addEventListener('keyup', function() { window.lastFocusedFormulaInput = this; });
    });
    
    // 現在 setupFormulaDrugDropdown 已被定義，不會報錯
    setupFormulaDrugDropdown();
});
