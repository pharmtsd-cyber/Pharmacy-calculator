let currentDrug = null;
let currentFormula = null;
let calculatedMin = null;
let calculatedMax = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("計算機模組初始化...");
    document.getElementById('version-badge').innerText = CONFIG.VERSION || "v1.0.0";
    document.getElementById('prescribed-dose').addEventListener('input', checkPrescriptionSafety);
    initializeCalculator();
});

async function initializeCalculator() {
    const loadingStatus = document.getElementById('loading-status');
    try {
        // 同步載入公告檔
        const [drugsData, paramsData, formulasData, annoData] = await Promise.all([
            fetchFromGAS('getDrugs'), fetchFromGAS('getParameters'), fetchFromGAS('getFormulas'), fetchFromGAS('getAnnouncements')
        ]);

        if (drugsData && paramsData && formulasData) {
            STORE.drugs = drugsData; STORE.parameters = paramsData; STORE.formulas = formulasData;
            
            // 處理置頂公告顯示
            if (annoData) {
                const pinned = annoData.find(a => a.is_pinned === 'Y');
                if (pinned) {
                    document.getElementById('announcement-banner').classList.remove('hidden');
                    document.getElementById('announcement-text').innerText = `[${pinned.version}] ${pinned.date ? new Date(pinned.date).toLocaleDateString() : ''} - ${pinned.content}`;
                }
            }

            setupFilters();
            applyFilters();
        } else {
            loadingStatus.innerText = "資料載入失敗，請確認 API 網址。";
            loadingStatus.classList.add('text-red-500');
        }
    } catch (error) { loadingStatus.innerText = "系統發生錯誤。"; }
}

function setupFilters() {
    const cat1Select = document.getElementById('filter-cat1');
    const cat2Select = document.getElementById('filter-cat2');
    const cat3Select = document.getElementById('filter-cat3');
    const searchInput = document.getElementById('search-input');

    const cat1s = [...new Set(STORE.drugs.map(d => d.cat_1).filter(Boolean))];
    cat1s.forEach(c => cat1Select.add(new Option(c, c)));

    cat1Select.addEventListener('change', () => {
        const val1 = cat1Select.value;
        cat2Select.innerHTML = '<option value="">-- 所有第二層分類 --</option>';
        cat3Select.innerHTML = '<option value="">-- 所有第三層分類 --</option>';
        
        if (val1) {
            const cat2s = [...new Set(STORE.drugs.filter(d => d.cat_1 === val1).map(d => d.cat_2).filter(Boolean))];
            cat2s.forEach(c => cat2Select.add(new Option(c, c)));
            cat2Select.disabled = false;
        } else cat2Select.disabled = true;
        cat3Select.disabled = true;
        applyFilters();
    });

    cat2Select.addEventListener('change', () => {
        const val1 = cat1Select.value;
        const val2 = cat2Select.value;
        cat3Select.innerHTML = '<option value="">-- 所有第三層分類 --</option>';
        
        if (val2) {
            const cat3s = [...new Set(STORE.drugs.filter(d => d.cat_1 === val1 && d.cat_2 === val2).map(d => d.cat_3).filter(Boolean))];
            cat3s.forEach(c => cat3Select.add(new Option(c, c)));
            cat3Select.disabled = false;
        } else cat3Select.disabled = true;
        applyFilters();
    });

    cat3Select.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', applyFilters);
}

function applyFilters() {
    const c1 = document.getElementById('filter-cat1').value, c2 = document.getElementById('filter-cat2').value, c3 = document.getElementById('filter-cat3').value;
    const k = document.getElementById('search-input').value.toLowerCase();

    const filtered = STORE.drugs.filter(d => {
        if (d.status && d.status.toUpperCase() !== 'Y') return false;
        if (c1 && d.cat_1 !== c1) return false;
        if (c2 && d.cat_2 !== c2) return false;
        if (c3 && d.cat_3 !== c3) return false;
        if (k) {
            const searchStr = ((d.local_name||'') + (d.generic_name||'') + (d.brand_name||'') + (d.common_brand||'')).toLowerCase();
            if (!searchStr.includes(k)) return false;
        }
        return true;
    });

    renderDrugList(filtered);
}

function renderDrugList(drugsToRender) {
    const treeContainer = document.getElementById('category-tree');
    treeContainer.innerHTML = '';
    if (drugsToRender.length === 0) return treeContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">無符合的篩選結果</p>';

    const ul = document.createElement('ul');
    ul.className = 'flex flex-col gap-3 p-1';

    drugsToRender.forEach(drug => {
        const li = document.createElement('li');
        li.className = 'p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded cursor-pointer transition shadow-sm';
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

    document.getElementById('drug-right-cats').innerHTML = `
        ${drug.cat_1 ? `<span class="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_1}</span>` : ''}
        ${drug.cat_2 ? `<span class="bg-blue-50 text-blue-800 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_2}</span>` : ''}
        ${drug.cat_3 ? `<span class="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.5 rounded">${drug.cat_3}</span>` : ''}
    `;
    
    document.getElementById('drug-title').innerText = drug.generic_name || '無學名';
    document.getElementById('drug-sub1').innerText = drug.brand_name || '--';
    document.getElementById('drug-sub2').innerText = drug.local_name || '--';
    document.getElementById('drug-sub3').innerText = drug.common_brand || '--';
    
// 渲染代碼與磨粉 Badge
    const badgeCode = document.getElementById('drug-badge-code'), badgeCrush = document.getElementById('drug-badge-crush');
    if(drug.drug_code) { badgeCode.innerText = drug.drug_code; badgeCode.classList.remove('hidden'); } else badgeCode.classList.add('hidden');
    if(drug.can_crush === 'Y') { badgeCrush.innerText = '可磨粉'; badgeCrush.className = 'text-[10px] font-bold px-2 py-0.5 rounded border border-green-300 bg-green-50 text-green-700'; badgeCrush.classList.remove('hidden'); }
    else if(drug.can_crush === 'N') { badgeCrush.innerText = '不可磨粉'; badgeCrush.className = 'text-[10px] font-bold px-2 py-0.5 rounded border border-red-300 bg-red-50 text-red-700'; badgeCrush.classList.remove('hidden'); }
    else if(drug.can_crush === 'NA') { badgeCrush.innerText = '非磨粉劑型'; badgeCrush.className = 'text-[10px] font-bold px-2 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-700'; badgeCrush.classList.remove('hidden'); }
    else badgeCrush.classList.add('hidden');

    // 動態渲染關聯藥品並「自動附加劑型」
    const relContainer = document.getElementById('drug-related-container'), relList = document.getElementById('drug-related-list');
    if(drug.related_drugs) {
        relList.innerHTML = drug.related_drugs.split(',').filter(Boolean).map(r => {
            // 從資料庫尋找同名藥品，並抓取它的劑型
            const matchedDrug = STORE.drugs.find(x => x.local_name === r || x.generic_name === r);
            const formText = matchedDrug && matchedDrug.form ? ` <span class="text-teal-600 font-normal">(${matchedDrug.form})</span>` : '';
            return `<span class="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded shadow-sm text-xs font-bold">${r}${formText}</span>`;
        }).join('');
        relContainer.classList.remove('hidden');
    } else {
        relContainer.classList.add('hidden');
    }

    const rightMetaContainer = document.getElementById('drug-sub3').parentElement.parentElement;
    let formRow = document.getElementById('drug-form-row');
    if (!formRow) {
        formRow = document.createElement('div'); formRow.id = 'drug-form-row'; formRow.className = 'border-t border-gray-100 mt-2 pt-2 flex flex-col gap-1';
        rightMetaContainer.insertBefore(formRow, document.getElementById('drug-related-container'));
    }
    // 移除其他劑型顯示，只顯示主要劑型
    formRow.innerHTML = `<div class="flex"><span class="w-24 font-bold text-gray-500">主要劑型</span><span class="font-medium text-gray-800">${drug.form || '--'}</span></div>`;
    
    const urlBtn = document.getElementById('drug-url-btn');
    if (drug.reference_url && drug.reference_url.startsWith('http')) {
        urlBtn.href = drug.reference_url; urlBtn.classList.remove('hidden');
    } else urlBtn.classList.add('hidden');

    const instContainer = document.getElementById('drug-dose-inst-container');
    if (drug.dose_instruction) {
        document.getElementById('drug-dose-inst').innerText = drug.dose_instruction;
        instContainer.classList.remove('hidden');
    } else instContainer.classList.add('hidden');

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
    
    document.getElementById('prescribed-dose').value = '';
    document.getElementById('dose-eval-msg').classList.add('hidden');
    resetResult();

    document.getElementById('formula-remark').innerText = formula.remark ? `*指引備註：${formula.remark}` : '';
    document.getElementById('result-unit').innerText = formula.result_unit || '';
    document.querySelector('.prescribed-unit-display').innerText = formula.result_unit || '';

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

    const paramContainer = document.getElementById('dynamic-parameters');
    paramContainer.innerHTML = '';

    const combinedFormula = (formula.formula_min || '') + " " + (formula.formula_max || '');
    const paramRegex = /{([^}]+)}/g;
    const requiredCodes = new Set();
    let match;
    while ((match = paramRegex.exec(combinedFormula)) !== null) requiredCodes.add(match[1]);

    if (requiredCodes.size === 0) { executeCalculation(); return; }

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

    let fMin = currentFormula.formula_min || '', fMax = currentFormula.formula_max || '';
    const inputs = document.querySelectorAll('.param-input');
    let allFilled = true;

    inputs.forEach(input => {
        const code = input.getAttribute('data-code'), val = input.value;
        if (val === '') allFilled = false;
        else {
            const regex = new RegExp(`{${code}}`, 'g');
            fMin = fMin.replace(regex, val); fMax = fMax.replace(regex, val);
        }
    });

    if (!allFilled && inputs.length > 0) { resetResult(); return; }

    calculatedMin = null; calculatedMax = null;
    try {
        if (fMin.trim()) calculatedMin = Math.round(math.evaluate(fMin) * 100) / 100;
        if (fMax.trim()) calculatedMax = Math.round(math.evaluate(fMax) * 100) / 100;

        const resultEl = document.getElementById('result-value');
        if (calculatedMin !== null && calculatedMax !== null) resultEl.innerText = `${calculatedMin} ~ ${calculatedMax}`;
        else if (calculatedMin !== null) { resultEl.innerText = `${calculatedMin}`; calculatedMax = calculatedMin; }
        else resultEl.innerText = "--";
        
        resultEl.classList.add('text-[#1B365D]');
        checkPrescriptionSafety();
    } catch (error) { document.getElementById('result-value').innerText = "公式錯誤"; }
}

function checkPrescriptionSafety() {
    const preInput = document.getElementById('prescribed-dose').value;
    const msgBox = document.getElementById('dose-eval-msg');
    
    if (!preInput || calculatedMin === null) { msgBox.classList.add('hidden'); return; }

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
    calculatedMin = null; calculatedMax = null;
    document.getElementById('dose-eval-msg').classList.add('hidden');
}
