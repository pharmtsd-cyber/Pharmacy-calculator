// assets/js/calculator.js

let currentDrug = null;
let currentFormula = null;
let calculatedMin = null;
let calculatedMax = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("計算機模組初始化...");
    document.getElementById('version-badge').innerText = CONFIG.VERSION || "v1.0.0";
    
    // 綁定防呆比對輸入框
    document.getElementById('prescribed-dose').addEventListener('input', checkPrescriptionSafety);
    
    initializeCalculator();
});

async function initializeCalculator() {
    const loadingStatus = document.getElementById('loading-status');
    try {
        const [drugsData, paramsData, formulasData] = await Promise.all([
            fetchFromGAS('getDrugs'), fetchFromGAS('getParameters'), fetchFromGAS('getFormulas')
        ]);

        if (drugsData && paramsData && formulasData) {
            STORE.drugs = drugsData; STORE.parameters = paramsData; STORE.formulas = formulasData;
            
            // 建立三層篩選與搜尋機制
            setupFilters();
            // 初始渲染所有啟用藥品
            applyFilters();
        } else {
            loadingStatus.innerText = "資料載入失敗，請確認 API 網址。";
            loadingStatus.classList.add('text-red-500');
        }
    } catch (error) { loadingStatus.innerText = "系統發生錯誤。"; }
}

// ==========================================
// 篩選器與分類聯動邏輯
// ==========================================
function setupFilters() {
    const cat1Select = document.getElementById('filter-cat1');
    const cat2Select = document.getElementById('filter-cat2');
    const cat3Select = document.getElementById('filter-cat3');
    const searchInput = document.getElementById('search-input');

    // 1. 初始化第一層分類 (Cat 1)
    const cat1s = [...new Set(STORE.drugs.map(d => d.cat_1).filter(Boolean))];
    cat1s.forEach(c => cat1Select.add(new Option(c, c)));

    // 2. 當第一層改變時，聯動更新第二層
    cat1Select.addEventListener('change', () => {
        const val1 = cat1Select.value;
        cat2Select.innerHTML = '<option value="">-- 所有第二層分類 --</option>';
        cat3Select.innerHTML = '<option value="">-- 所有第三層分類 --</option>';
        
        if (val1) {
            const cat2s = [...new Set(STORE.drugs.filter(d => d.cat_1 === val1).map(d => d.cat_2).filter(Boolean))];
            cat2s.forEach(c => cat2Select.add(new Option(c, c)));
            cat2Select.disabled = false;
        } else {
            cat2Select.disabled = true;
        }
        cat3Select.disabled = true;
        applyFilters();
    });

    // 3. 當第二層改變時，聯動更新第三層
    cat2Select.addEventListener('change', () => {
        const val1 = cat1Select.value;
        const val2 = cat2Select.value;
        cat3Select.innerHTML = '<option value="">-- 所有第三層分類 --</option>';
        
        if (val2) {
            const cat3s = [...new Set(STORE.drugs.filter(d => d.cat_1 === val1 && d.cat_2 === val2).map(d => d.cat_3).filter(Boolean))];
            cat3s.forEach(c => cat3Select.add(new Option(c, c)));
            cat3Select.disabled = false;
        } else {
            cat3Select.disabled = true;
        }
        applyFilters();
    });

    // 4. 第三層與搜尋框改變時觸發篩選
    cat3Select.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', applyFilters);
}

// 執行多重條件篩選
function applyFilters() {
    const c1 = document.getElementById('filter-cat1').value;
    const c2 = document.getElementById('filter-cat2').value;
    const c3 = document.getElementById('filter-cat3').value;
    const k = document.getElementById('search-input').value.toLowerCase();

    const filtered = STORE.drugs.filter(d => {
        // 排除已停用的藥品
        if (d.status && d.status.toUpperCase() !== 'Y') return false;
        
        // 判斷分類
        if (c1 && d.cat_1 !== c1) return false;
        if (c2 && d.cat_2 !== c2) return false;
        if (c3 && d.cat_3 !== c3) return false;
        
        // 判斷模糊搜尋 (含學名、中文名、商品名、原廠商品名)
        if (k) {
            const searchStr = ((d.local_name||'') + (d.generic_name||'') + (d.brand_name||'') + (d.common_brand||'')).toLowerCase();
            if (!searchStr.includes(k)) return false;
        }
        return true;
    });

    renderDrugList(filtered);
}

// ==========================================
// 畫面渲染邏輯
// ==========================================
function renderDrugList(drugsToRender) {
    const treeContainer = document.getElementById('category-tree');
    treeContainer.innerHTML = '';
    if (drugsToRender.length === 0) return treeContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">無符合的篩選結果</p>';

    const ul = document.createElement('ul');
    ul.className = 'flex flex-col gap-3 p-1';

    drugsToRender.forEach(drug => {
        const li = document.createElement('li');
        li.className = 'p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded cursor-pointer transition shadow-sm';
        
        // 左側小卡格式對齊要求：主標學名，副標由上至下 (現有商品名F, 中文商品名E, 原廠商品名G)
        li.innerHTML = `
            <div class="flex gap-1 mb-2">
                ${drug.cat_1 ? `<span class="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_1}</span>` : ''}
                ${drug.cat_2 ? `<span class="bg-blue-50 text-blue-800 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_2}</span>` : ''}
                ${drug.cat_3 ? `<span class="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_3}</span>` : ''}
            </div>
            <div class="font-bold text-[#1B365D] text-sm break-words leading-tight mb-2">${drug.generic_name || '無學名'}</div>
            <div class="text-[11px] text-gray-600 flex flex-col gap-1 bg-white p-2 rounded border border-gray-100">
                <div class="flex"><span class="w-16 font-bold text-gray-400">現有商品</span><span class="font-medium text-gray-800 truncate" title="${drug.brand_name || '--'}">${drug.brand_name || '--'}</span></div>
                <div class="flex"><span class="w-16 font-bold text-gray-400">中文商品</span><span class="font-medium text-gray-800 truncate" title="${drug.local_name || '--'}">${drug.local_name || '--'}</span></div>
                <div class="flex"><span class="w-16 font-bold text-gray-400">原廠商品</span><span class="font-medium text-gray-800 truncate" title="${drug.common_brand || '--'}">${drug.common_brand || '--'}</span></div>
            </div>
        `;
        li.onclick = () => selectDrug(drug);
        ul.appendChild(li);
    });
    treeContainer.appendChild(ul);
}

function selectDrug(drug) {
    currentDrug = drug;
    document.getElementById('calc-placeholder').classList.add('hidden');
    document.getElementById('calc-panel').classList.remove('hidden');

    // 1. 填寫藥品基本資訊 (完全對齊左側小卡結構)
    document.getElementById('drug-right-cats').innerHTML = `
        ${drug.cat_1 ? `<span class="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_1}</span>` : ''}
        ${drug.cat_2 ? `<span class="bg-blue-50 text-blue-800 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_2}</span>` : ''}
        ${drug.cat_3 ? `<span class="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_3}</span>` : ''}
    `;
    
    // 主標題：學名
    document.getElementById('drug-title').innerText = drug.generic_name || '無學名';
    
    // 副標題：現有F, 中文E, 原廠G
    document.getElementById('drug-sub1').innerText = drug.brand_name || '--';
    document.getElementById('drug-sub2').innerText = drug.local_name || '--';
    document.getElementById('drug-sub3').innerText = drug.common_brand || '--';

    // 2. 仿單連結
    const urlBtn = document.getElementById('drug-url-btn');
    if (drug.reference_url && drug.reference_url.startsWith('http')) {
        urlBtn.href = drug.reference_url; urlBtn.classList.remove('hidden');
    } else urlBtn.classList.add('hidden');

    // 3. 建議劑量說明 (多行顯示)
    const instContainer = document.getElementById('drug-dose-inst-container');
    if (drug.dose_instruction) {
        document.getElementById('drug-dose-inst').innerText = drug.dose_instruction;
        instContainer.classList.remove('hidden');
    } else instContainer.classList.add('hidden');

    // 4. 準備公式
    const drugFormulas = STORE.formulas.filter(f => f.drug_id === drug.drug_id);
    const selectEl = document.getElementById('formula-select');
    selectEl.innerHTML = '';

    if (drugFormulas.length === 0) {
        selectEl.innerHTML = '<option value="">(尚未建置計算公式)</option>';
        document.getElementById('dynamic-parameters').innerHTML = '';
        resetResult(); return;
    }

    drugFormulas.forEach(f => {
        const option = document.createElement('option');
        option.value = f.formula_id; option.innerText = f.formula_name;
        selectEl.appendChild(option);
    });

    selectEl.onchange = (e) => {
        currentFormula = drugFormulas.find(f => f.formula_id === e.target.value);
        renderDynamicParameters(currentFormula);
    };

    currentFormula = drugFormulas[0];
    renderDynamicParameters(currentFormula);
}

// ==========================================
// 動態參數與計算邏輯 (保持雙公式設計)
// ==========================================
function renderDynamicParameters(formula) {
    if (!formula) return;
    
    // 清除防呆輸入框與結果
    document.getElementById('prescribed-dose').value = '';
    document.getElementById('dose-eval-msg').classList.add('hidden');
    resetResult();

    document.getElementById('formula-remark').innerText = formula.remark ? `*指引備註：${formula.remark}` : '';
    document.getElementById('result-unit').innerText = formula.result_unit || '';
    document.querySelector('.prescribed-unit-display').innerText = formula.result_unit || '';

    // 處理絕對最大上限警示文字
    const alertBox = document.getElementById('absolute-max-alert');
    let hasAlert = false;
    if (formula.single_max) {
        document.getElementById('single-max-text').innerText = `單次最大：${formula.single_max} ${formula.single_max_unit||''}`;
        hasAlert = true;
    } else document.getElementById('single-max-text').innerText = '';
    
    if (formula.daily_max) {
        document.getElementById('daily-max-text').innerText = `單日最大：${formula.daily_max} ${formula.daily_max_unit||''}`;
        hasAlert = true;
    } else document.getElementById('daily-max-text').innerText = '';
    
    if (hasAlert) alertBox.classList.remove('hidden'); else alertBox.classList.add('hidden');

    // 動態解析雙公式變數
    const paramContainer = document.getElementById('dynamic-parameters');
    paramContainer.innerHTML = '';

    const combinedFormula = (formula.formula_min || '') + " " + (formula.formula_max || '');
    const paramRegex = /{([^}]+)}/g;
    const requiredCodes = new Set();
    let match;
    while ((match = paramRegex.exec(combinedFormula)) !== null) requiredCodes.add(match[1]);

    if (requiredCodes.size === 0) {
        executeCalculation();
        return;
    }

    requiredCodes.forEach(code => {
        const paramDef = STORE.parameters.find(p => p.param_code === code);
        const paramName = paramDef ? paramDef.param_name : code;
        const paramUnit = paramDef ? paramDef.default_unit : '';

        const div = document.createElement('div');
        div.className = 'flex flex-col gap-1';
        div.innerHTML = `
            <label class="text-xs font-bold text-[#1B365D]">${paramName} (${paramUnit})</label>
            <input type="number" data-code="${code}" step="any" min="0" placeholder="請輸入數值..." 
                   class="param-input border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#1B365D] shadow-inner bg-white">
        `;
        paramContainer.appendChild(div);
    });

    document.querySelectorAll('.param-input').forEach(input => input.addEventListener('input', executeCalculation));
}

function executeCalculation() {
    if (!currentFormula) return;

    let fMin = currentFormula.formula_min || '';
    let fMax = currentFormula.formula_max || '';
    const inputs = document.querySelectorAll('.param-input');
    let allFilled = true;

    inputs.forEach(input => {
        const code = input.getAttribute('data-code');
        const val = input.value;
        if (val === '') allFilled = false;
        else {
            const regex = new RegExp(`{${code}}`, 'g');
            fMin = fMin.replace(regex, val);
            fMax = fMax.replace(regex, val);
        }
    });

    if (!allFilled && inputs.length > 0) { resetResult(); return; }

    calculatedMin = null;
    calculatedMax = null;

    try {
        if (fMin.trim()) calculatedMin = Math.round(math.evaluate(fMin) * 100) / 100;
        if (fMax.trim()) calculatedMax = Math.round(math.evaluate(fMax) * 100) / 100;

        const resultEl = document.getElementById('result-value');
        
        if (calculatedMin !== null && calculatedMax !== null) {
            resultEl.innerText = `${calculatedMin} ~ ${calculatedMax}`;
        } else if (calculatedMin !== null) {
            resultEl.innerText = `${calculatedMin}`;
            calculatedMax = calculatedMin;
        } else {
            resultEl.innerText = "--";
        }
        
        resultEl.classList.add('text-[#1B365D]');
        checkPrescriptionSafety();

    } catch (error) {
        document.getElementById('result-value').innerText = "公式錯誤";
    }
}

function checkPrescriptionSafety() {
    const preInput = document.getElementById('prescribed-dose').value;
    const msgBox = document.getElementById('dose-eval-msg');
    
    if (!preInput || calculatedMin === null) {
        msgBox.classList.add('hidden');
        return;
    }

    const val = parseFloat(preInput);
    msgBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-yellow-100', 'text-yellow-800');
    
    if (calculatedMax !== null) {
        if (val < calculatedMin) {
            msgBox.classList.add('bg-yellow-100', 'text-yellow-800');
            msgBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> 提示：處方劑量 <b>低於</b> 建議區間下限 (${calculatedMin})。`;
        } else if (val > calculatedMax) {
            msgBox.classList.add('bg-red-100', 'text-red-800');
            msgBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation animate-pulse"></i> 警告：處方劑量 <b>高於</b> 建議區間上限 (${calculatedMax})！請與醫師確認！`;
        } else {
            msgBox.classList.add('bg-green-100', 'text-green-800');
            msgBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> 處方劑量安全：落在 ${calculatedMin} ~ ${calculatedMax} 建議區間內。`;
        }
    }
    
    if (currentFormula.single_max && val > parseFloat(currentFormula.single_max)) {
        msgBox.className = 'text-sm font-bold mt-2 flex items-center gap-1.5 p-2 rounded bg-red-600 text-white animate-pulse shadow-lg';
        msgBox.innerHTML = `<i class="fa-solid fa-skull-crossbones"></i> 極度危險：處方劑量已突破「單次絕對最大劑量 (${currentFormula.single_max})」！請立刻停用！`;
    }
}

function resetResult() {
    document.getElementById('result-value').innerText = '--';
    document.getElementById('result-value').className = 'text-3xl font-extrabold text-[#1B365D]';
    calculatedMin = null;
    calculatedMax = null;
    document.getElementById('dose-eval-msg').classList.add('hidden');
}
