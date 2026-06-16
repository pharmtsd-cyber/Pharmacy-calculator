// assets/js/calculator.js

// 當前選擇的狀態
let currentDrug = null;
let currentFormula = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("計算機模組初始化完成。");
    document.getElementById('version-badge').innerText = CONFIG.VERSION || "v1.0.0";
    
    // 啟動時先載入資料
    initializeCalculator();
});

async function initializeCalculator() {
    const loadingStatus = document.getElementById('loading-status');
    const treeContainer = document.getElementById('category-tree');
    
    try {
        // 並行發送三個請求到 GAS，大幅縮短載入時間
        const [drugsData, paramsData, formulasData] = await Promise.all([
            fetchFromGAS('getDrugs'),
            fetchFromGAS('getParameters'),
            fetchFromGAS('getFormulas')
        ]);

        if (drugsData && paramsData && formulasData) {
            STORE.drugs = drugsData;
            STORE.parameters = paramsData;
            STORE.formulas = formulasData;

            // 渲染左側清單與啟動搜尋
            renderDrugList(STORE.drugs);
            setupSearch();
        } else {
            loadingStatus.innerText = "資料載入失敗，請確認 API 網址是否正確或網路狀態。";
            loadingStatus.classList.add('text-red-500');
        }
    } catch (error) {
        console.error("初始化錯誤:", error);
        loadingStatus.innerText = "系統發生未預期錯誤。";
    }
}

// ==========================================
// 左側面板：藥品清單與搜尋邏輯
// ==========================================

function renderDrugList(drugsToRender) {
    const treeContainer = document.getElementById('category-tree');
    treeContainer.innerHTML = '';

    if (drugsToRender.length === 0) {
        treeContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">無符合的藥品</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'flex flex-col gap-2 p-1';

    drugsToRender.forEach(drug => {
        // 僅顯示啟用狀態的藥品 (假設欄位名稱為 status，值為 Y)
        if(drug.status && drug.status.toUpperCase() !== 'Y') return;

        const li = document.createElement('li');
        li.className = 'p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded cursor-pointer transition';
        li.innerHTML = `
            <div class="font-bold text-[#1B365D] text-sm">${drug.local_name || drug.brand_name}</div>
            <div class="text-xs text-gray-500 mt-1">${drug.generic_name || ''}</div>
        `;
        
        // 點擊藥品時觸發右側面板更新
        li.onclick = () => selectDrug(drug);
        ul.appendChild(li);
    });

    treeContainer.appendChild(ul);
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const filteredDrugs = STORE.drugs.filter(drug => {
            return (drug.local_name && drug.local_name.toLowerCase().includes(keyword)) ||
                   (drug.generic_name && drug.generic_name.toLowerCase().includes(keyword)) ||
                   (drug.brand_name && drug.brand_name.toLowerCase().includes(keyword));
        });
        renderDrugList(filteredDrugs);
    });
}

// ==========================================
// 右側面板：動態參數與計算邏輯
// ==========================================

function selectDrug(drug) {
    currentDrug = drug;
    
    // 切換介面顯示
    document.getElementById('calc-placeholder').classList.add('hidden');
    document.getElementById('calc-panel').classList.remove('hidden');

    // 填寫藥品基本資訊
    document.getElementById('drug-title').innerText = drug.local_name || drug.generic_name;
    document.getElementById('drug-meta').innerText = `學名：${drug.generic_name || '無'} | 成分：${drug.ingredients || '無'}`;
    
    // 處理最大上限標籤
    const maxBadge = document.getElementById('drug-max-badge');
    if (drug.max_dose) {
        maxBadge.innerText = `最大劑量：${drug.max_dose} ${drug.max_unit || ''}`;
        maxBadge.classList.remove('hidden');
    } else {
        maxBadge.classList.add('hidden');
    }

    // 篩選該藥品專屬的公式
    const drugFormulas = STORE.formulas.filter(f => f.drug_id === drug.drug_id);
    const selectEl = document.getElementById('formula-select');
    selectEl.innerHTML = '';

    if (drugFormulas.length === 0) {
        selectEl.innerHTML = '<option value="">(尚未建置計算公式)</option>';
        document.getElementById('dynamic-parameters').innerHTML = '';
        resetResult();
        return;
    }

    // 生成公式下拉選單
    drugFormulas.forEach((f, index) => {
        const option = document.createElement('option');
        option.value = f.formula_id;
        option.innerText = f.formula_name;
        selectEl.appendChild(option);
    });

    // 監聽公式切換
    selectEl.onchange = (e) => {
        const selectedId = e.target.value;
        currentFormula = drugFormulas.find(f => f.formula_id === selectedId);
        renderDynamicParameters(currentFormula);
    };

    // 預設載入第一個公式
    currentFormula = drugFormulas[0];
    renderDynamicParameters(currentFormula);
}

function renderDynamicParameters(formula) {
    if (!formula) return;
    
    document.getElementById('formula-remark').innerText = formula.remark ? `*指引備註：${formula.remark}` : '';
    document.getElementById('result-unit').innerText = formula.result_unit || '';
    resetResult();

    const paramContainer = document.getElementById('dynamic-parameters');
    paramContainer.innerHTML = '';

    // 使用正則表達式提取公式中的參數代碼，例如從 "({weight_kg} * 15)" 提取出 "weight_kg"
    const paramRegex = /{([^}]+)}/g;
    const requiredCodes = [];
    let match;
    while ((match = paramRegex.exec(formula.formula_string)) !== null) {
        if (!requiredCodes.includes(match[1])) {
            requiredCodes.push(match[1]);
        }
    }

    // 根據提取出的代碼，從 STORE.parameters 尋找對應的設定來生成輸入框
    requiredCodes.forEach(code => {
        const paramDef = STORE.parameters.find(p => p.param_code === code);
        const paramName = paramDef ? paramDef.param_name : code;
        const paramUnit = paramDef ? paramDef.default_unit : '';

        const div = document.createElement('div');
        div.className = 'flex flex-col gap-1';
        div.innerHTML = `
            <label class="text-xs font-bold text-[#1B365D]">${paramName} (${paramUnit})</label>
            <input type="number" id="input-${code}" data-code="${code}" step="any" min="0" placeholder="請輸入數值..." 
                   class="param-input border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#1B365D]">
        `;
        paramContainer.appendChild(div);
    });

    // 綁定輸入事件，每次輸入就自動計算
    document.querySelectorAll('.param-input').forEach(input => {
        input.addEventListener('input', executeCalculation);
    });
}

function executeCalculation() {
    if (!currentFormula) return;

    let formulaStr = currentFormula.formula_string;
    const inputs = document.querySelectorAll('.param-input');
    let allFilled = true;

    // 將公式中的 {變數} 替換為實際輸入的數值
    inputs.forEach(input => {
        const code = input.getAttribute('data-code');
        const val = input.value;
        if (val === '') {
            allFilled = false;
        } else {
            // 全域替換該變數
            const regex = new RegExp(`{${code}}`, 'g');
            formulaStr = formulaStr.replace(regex, val);
        }
    });

    // 如果必填參數還沒填完，不執行計算
    if (!allFilled) {
        resetResult();
        return;
    }

    try {
        // 使用 math.js 安全解析數學字串
        let result = math.evaluate(formulaStr);
        // 四捨五入到小數點後兩位
        result = Math.round(result * 100) / 100;
        
        const resultEl = document.getElementById('result-value');
        resultEl.innerText = result;

        // 檢查是否超過最大劑量 (防呆警示機制)
        const limitWarning = document.getElementById('limit-warning');
        if (currentDrug.max_dose && result > parseFloat(currentDrug.max_dose)) {
            limitWarning.classList.remove('hidden');
            resultEl.classList.add('text-red-600');
            resultEl.classList.remove('text-[#1B365D]');
        } else {
            limitWarning.classList.add('hidden');
            resultEl.classList.add('text-[#1B365D]');
            resultEl.classList.remove('text-red-600');
        }

    } catch (error) {
        console.error("公式解析錯誤:", error);
        document.getElementById('result-value').innerText = "公式錯誤";
    }
}

function resetResult() {
    document.getElementById('result-value').innerText = '--';
    document.getElementById('limit-warning').classList.add('hidden');
    document.getElementById('result-value').classList.add('text-[#1B365D]');
    document.getElementById('result-value').classList.remove('text-red-600');
}
