let currentDrug = null;
let currentFormula = null;
let calculatedMin = null;
let calculatedMax = null;
let currentDomain = 'home'; 

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version-badge').innerText = CONFIG.VERSION || "v1.0.0";
    document.getElementById('prescribed-dose').addEventListener('input', checkPrescriptionSafety);
    
    // 左側選單切換邏輯
    document.querySelectorAll('.front-nav').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.front-nav').forEach(n => {
                n.classList.remove('border-[#63B3ED]', 'bg-white/10');
                n.classList.add('border-transparent');
            });
            item.classList.remove('border-transparent');
            item.classList.add('border-[#63B3ED]', 'bg-white/10');

            const target = item.getAttribute('data-target');
            currentDomain = target;

            if(target === 'home') {
                document.getElementById('home-view').classList.remove('hidden');
                document.getElementById('calc-view').classList.add('hidden');
            } else {
                document.getElementById('home-view').classList.add('hidden');
                document.getElementById('calc-view').classList.remove('hidden');
                document.getElementById('calc-domain-title').innerText = item.innerText.trim();
                
                document.getElementById('search-input').value = '';
                document.getElementById('filter-cat1').value = '';
                document.getElementById('filter-cat2').innerHTML = '<option value="">-- 所有第二層分類 --</option>';
                document.getElementById('filter-cat2').disabled = true;
                document.getElementById('filter-cat3').innerHTML = '<option value="">-- 所有第三層分類 --</option>';
                document.getElementById('filter-cat3').disabled = true;
                
                document.getElementById('calc-placeholder').classList.remove('hidden');
                document.getElementById('calc-panel').classList.add('hidden');
                applyFilters(); 
            }
        });
    });

    initializeCalculator();
});

async function initializeCalculator() {
    const loadingStatus = document.getElementById('loading-status');
    try {
        const [drugsData, paramsData, formulasData, annoData, catData, settingsData] = await Promise.all([
            fetchFromGAS('getDrugs'), fetchFromGAS('getParameters'), fetchFromGAS('getFormulas'), fetchFromGAS('getAnnouncements'), fetchFromGAS('getCategories'), fetchFromGAS('getSettings')
        ]);

        if (drugsData && paramsData && formulasData) {
            STORE.drugs = drugsData; STORE.parameters = paramsData; STORE.formulas = formulasData;
            STORE.categories = catData || []; 
            STORE.announcements = annoData || [];
            STORE.settings = {};
            if(settingsData) settingsData.forEach(s => STORE.settings[s.setting_key] = s.setting_value);
            
            renderHomeContent();
            setupFilters();
            applyFilters();
        } else {
            loadingStatus.innerText = "資料載入失敗，請確認 API 網址。";
            loadingStatus.classList.add('text-red-500');
        }
    } catch (error) { loadingStatus.innerText = "系統發生錯誤。"; }
}

function renderHomeContent() {
    document.getElementById('home-welcome').innerText = STORE.settings.welcome_title || "歡迎使用臨床藥品劑量建議計算機";
    document.getElementById('home-owner').innerText = "系統維護：" + (STORE.settings.owner || "亞東醫院藥學部");
    document.getElementById('home-copyright').innerText = STORE.settings.copyright || "Copyright © 2026";
    document.getElementById('home-rules').innerText = STORE.settings.usage_rules || "暫無說明";

    const annoHtml = STORE.announcements.sort((a,b) => new Date(b.date) - new Date(a.date)).map(a =>
        `<div class="border-l-4 ${a.is_pinned === 'Y' ? 'border-yellow-400 bg-yellow-50' : 'border-blue-400 bg-blue-50'} p-3 rounded shadow-sm text-sm">
            <span class="font-bold text-gray-800">[${a.version}] ${new Date(a.date).toLocaleDateString()}</span>
            <div class="mt-1 text-gray-600 whitespace-pre-wrap">${a.content}</div>
        </div>`
    ).join('');
    document.getElementById('home-announcements').innerHTML = annoHtml || "暫無公告";
}

function setupFilters() {
    const cat1Select = document.getElementById('filter-cat1'), cat2Select = document.getElementById('filter-cat2'), cat3Select = document.getElementById('filter-cat3');
    const searchInput = document.getElementById('search-input');

    const cat1s = [...new Set(STORE.categories.map(c => c.cat_1).filter(Boolean))];
    cat1s.forEach(c => cat1Select.add(new Option(c, c)));

    cat1Select.addEventListener('change', () => {
        const val1 = cat1Select.value;
        cat2Select.innerHTML = '<option value="">-- 所有第二層分類 --</option>'; cat3Select.innerHTML = '<option value="">-- 所有第三層分類 --</option>';
        if (val1) {
            const cat2s = [...new Set(STORE.categories.filter(c => c.cat_1 === val1).map(c => c.cat_2).filter(Boolean))];
            cat2s.forEach(c => cat2Select.add(new Option(c, c))); cat2Select.disabled = false;
        } else cat2Select.disabled = true;
        cat3Select.disabled = true; applyFilters();
    });

    cat2Select.addEventListener('change', () => {
        const val1 = cat1Select.value, val2 = cat2Select.value;
        cat3Select.innerHTML = '<option value="">-- 所有第三層分類 --</option>';
        if (val2) {
            const cat3s = [...new Set(STORE.categories.filter(c => c.cat_1 === val1 && c.cat_2 === val2).map(c => c.cat_3).filter(Boolean))];
            cat3s.forEach(c => cat3Select.add(new Option(c, c))); cat3Select.disabled = false;
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
        const drugDomain = d.domain || 'PED';
        if (currentDomain !== 'home' && drugDomain !== currentDomain) return false; 
        
        if (c1 && d.cat_1 !== c1) return false;
        if (c2 && d.cat_2 !== c2) return false;
        if (c3 && d.cat_3 !== c3) return false;
        if (k) {
            const searchStr = ((d.drug_code||'') + (d.local_name||'') + (d.generic_name||'') + (d.brand_name||'') + (d.common_brand||'')).toLowerCase();
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
    
    const badgeCode = document.getElementById('drug-badge-code'), badgeCrush = document.getElementById('drug-badge-crush');
    if(drug.drug_code) { badgeCode.innerText = drug.drug_code; badgeCode.classList.remove('hidden'); } else badgeCode.classList.add('hidden');
    if(drug.can_crush === 'Y') { badgeCrush.innerText = '可磨粉'; badgeCrush.className = 'text-[10px] font-bold px-2 py-0.5 rounded border border-green-300 bg-green-50 text-green-700'; badgeCrush.classList.remove('hidden'); }
    else if(drug.can_crush === 'N') { badgeCrush.innerText = '不可磨粉'; badgeCrush.className = 'text-[10px] font-bold px-2 py-0.5 rounded border border-red-300 bg-red-50 text-red-700'; badgeCrush.classList.remove('hidden'); }
    else if(drug.can_crush === 'NA') { badgeCrush.innerText = '非磨粉劑型'; badgeCrush.className = 'text-[10px] font-bold px-2 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-700'; badgeCrush.classList.remove('hidden'); }
    else badgeCrush.classList.add('hidden');

    const relContainer = document.getElementById('drug-related-container'), relList = document.getElementById('drug-related-list');
    if(drug.related_drugs) {
        relList.innerHTML = drug.related_drugs.split(',').filter(Boolean).map(r => {
            const matchedDrug = STORE.drugs.find(x => x.local_name === r || x.generic_name === r);
            const formText = matchedDrug && matchedDrug.form ? ` <span class="text-teal-600 font-normal">(${matchedDrug.form})</span>` : '';
            return `<span class="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded shadow-sm text-xs font-bold">${r}${formText}</span>`;
        }).join('');
        relContainer.classList.remove('hidden');
    } else relContainer.classList.add('hidden');

    const rightMetaContainer = document.getElementById('drug-sub3').parentElement.parentElement;
    let formRow = document.getElementById('drug-form-row');
    if (!formRow) {
        formRow = document.createElement('div'); formRow.id = 'drug-form-row'; formRow.className = 'border-t border-gray-100 mt-2 pt-2 flex flex-col gap-1';
        rightMetaContainer.insertBefore(formRow, document.getElementById('drug-related-container'));
    }
    formRow.innerHTML = `<div class="flex"><span class="w-24 font-bold text-gray-500">主要劑型</span><span class="font-medium text-gray-800">${drug.form || '--'}</span></div>`;
    
    const refContainer = document.getElementById('drug-ref-container');
    if (drug.reference_url) {
        document.getElementById('drug-ref-text').innerText = drug.reference_url;
        refContainer.classList.remove('hidden');
    } else refContainer.classList.add('hidden');

    const instContainer = document.getElementById('drug-dose-inst-container');
    if (drug.dose_instruction) {
        document.getElementById('drug-dose-inst').innerText = drug.dose_instruction;
        instContainer.classList.remove('hidden');
    } else instContainer.classList.add('hidden');

    const suppContainer = document.getElementById('drug-supplemental-container');
    if (suppContainer) {
        if (drug.supplemental_info) {
            document.getElementById('drug-supplemental').innerText = drug.supplemental_info;
            suppContainer.classList.remove('hidden');
        } else suppContainer.classList.add('hidden');
    }

    // 【修復核心】支援新舊版 ID (drug_id 或 drug_code) 雙向比對，加入 String() 和 trim() 確保比對不會因為空白失敗
    const targetId = String(drug.drug_id).trim();
    const targetCode = drug.drug_code ? String(drug.drug_code).trim() : null;
    
    const drugFormulas = STORE.formulas.filter(f => {
        const fId = String(f.drug_id).trim();
        return fId === targetId || (targetCode && fId === targetCode);
    });

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

window.openFeedbackModal = function(contextInfo) {
    document.getElementById('feedback-context').innerText = contextInfo;
    document.getElementById('feedback-content').value = '';
    document.getElementById('feedback-modal').classList.remove('hidden');
};

window.submitFeedback = async function() {
    const content = document.getElementById('feedback-content').value.trim();
    const contextInfo = document.getElementById('feedback-context').innerText;
    if(!content) return alert("請輸入回報內容");
    
    const btn = document.getElementById('btn-submit-feedback');
    btn.innerText = '傳送中...'; btn.disabled = true;
    
    try {
        await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveFeedback', mode: 'add', drug_info: contextInfo, content: content }) });
        alert("回報成功！感謝您的協助。");
        document.getElementById('feedback-modal').classList.add('hidden');
    } catch(e) { alert("連線失敗"); }
    btn.innerText = '送出回報'; btn.disabled = false;
};

window.goToAdminEdit = function() {
    if(!currentDrug) return;
    window.location.href = `./admin.html?drug_id=${currentDrug.drug_id}`;
};
