// assets/js/calculator.js

let currentDrug = null;
let currentFormula = null;
let calculatedMin = null;
let calculatedMax = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("計算機雙公式模組初始化...");
    document.getElementById('version-badge').innerText = CONFIG.VERSION || "v1.0.0";
    
    // 綁定防呆比對輸入框的即時檢核事件
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
            renderDrugList(STORE.drugs); setupSearch();
        } else {
            loadingStatus.innerText = "資料載入失敗，請確認 API 網址。";
            loadingStatus.classList.add('text-red-500');
        }
    } catch (error) { loadingStatus.innerText = "系統發生錯誤。"; }
}

function renderDrugList(drugsToRender) {
    const treeContainer = document.getElementById('category-tree');
    treeContainer.innerHTML = '';
    if (drugsToRender.length === 0) return treeContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">無符合的藥品</p>';

    const ul = document.createElement('ul');
    ul.className = 'flex flex-col gap-2 p-1';

    drugsToRender.forEach(drug => {
        if(drug.status && drug.status.toUpperCase() !== 'Y') return;
        const li = document.createElement('li');
        li.className = 'p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded cursor-pointer transition';
        li.innerHTML = `
            <div class="flex gap-1 mb-1">
                <span class="bg-blue-100 text-blue-800 text-[10px] px-1 rounded">${drug.cat_1||''}</span>
                ${drug.cat_2 ? `<span class="bg-blue-50 text-blue-800 text-[10px] px-1 rounded">${drug.cat_2}</span>` : ''}
            </div>
            <div class="font-bold text-[#1B365D] text-sm">${drug.local_name || '無中文名'} ${drug.common_brand?'('+drug.common_brand+')':''}</div>
            <div class="text-[10px] text-gray-500 mt-1">${drug.generic_name || ''}</div>
        `;
        li.onclick = () => selectDrug(drug);
        ul.appendChild(li);
    });
    treeContainer.appendChild(ul);
}

function setupSearch() {
    document.getElementById('search-input').addEventListener('input', (e) => {
        const k = e.target.value.toLowerCase();
        renderDrugList(STORE.drugs.filter(d => ((d.local_name||'')+(d.generic_name||'')+(d.brand_name||'')+(d.common_brand||'')+(d.cat_1||'')).toLowerCase().includes(k)));
    });
}

function selectDrug(drug) {
    currentDrug = drug;
    document.getElementById('calc-placeholder').classList.add('hidden');
    document.getElementById('calc-panel').classList.remove('hidden');

    // 1. 填寫藥品基本資訊
    document.getElementById('drug-title').innerText = `${drug.local_name || '無中文名'} ${drug.common_brand?'('+drug.common_brand+')':''}`;
    document.getElementById('drug-generic').innerText = `學名：${drug.generic_name || '無'}`;
    document.getElementById('drug-brand').innerText = `原廠商品名：${drug.brand_name || '無'}`;

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

    // 如果沒有參數 (例如固定數值的年齡段)，直接觸發計算
    if (requiredCodes.size === 0) {
        executeCalculation();
        return;
    }

    // 產生對應輸入框
    requiredCodes.forEach(code => {
        const paramDef = STORE.parameters.find(p => p.param_code === code);
        const paramName = paramDef ? paramDef.param_name : code;
        const paramUnit = paramDef ? paramDef.default_unit : '';

        const div = document.createElement('div');
        div.className = 'flex flex-col gap-1';
        div.innerHTML = `
            <label class="text-xs font-bold text-[#1B365D]">${paramName} (${paramUnit})</label>
            <input type="number" data-code="${code}" step="any" min="0" placeholder="請輸入數值..." 
                   class="param-input border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#1B365D] shadow-inner">
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
        
        // 渲染結果文字
        if (calculatedMin !== null && calculatedMax !== null) {
            resultEl.innerText = `${calculatedMin} ~ ${calculatedMax}`;
        } else if (calculatedMin !== null) {
            resultEl.innerText = `${calculatedMin}`;
            calculatedMax = calculatedMin; // 若只填下限，視為單一精確值
        } else {
            resultEl.innerText = "--";
        }
        
        resultEl.classList.add('text-[#1B365D]');

        // 每次計算完，重新檢核藥師填寫的處方防呆框
        checkPrescriptionSafety();

    } catch (error) {
        document.getElementById('result-value').innerText = "公式錯誤";
    }
}

function checkPrescriptionSafety() {
    const preInput = document.getElementById('prescribed-dose').value;
    const msgBox = document.getElementById('dose-eval-msg');
    
    // 如果沒有輸入處方數字，或還沒算出安全區間，就不顯示
    if (!preInput || calculatedMin === null) {
        msgBox.classList.add('hidden');
        return;
    }

    const val = parseFloat(preInput);
    msgBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-yellow-100', 'text-yellow-800');
    
    // 判斷邏輯
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
    
    // 極限防護：檢核絕對最大劑量 (如果不分單次單日，統一用數字比對)
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
