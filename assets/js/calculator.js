let currentDrug = null;
let currentFormula = null;
let calculatedMin = null;
let calculatedMax = null;
let currentDomain = 'home'; 

window.debounce = function(func, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, delay);
    };
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version-badge').innerText = CONFIG.VERSION || "v1.0.0";
    document.getElementById('prescribed-dose').addEventListener('input', window.debounce(checkPrescriptionSafety, 300));
    
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
                document.getElementById('filter-form').value = '';
                document.getElementById('filter-status').value = 'Y';
                
                document.getElementById('calc-placeholder').classList.remove('hidden');
                document.getElementById('calc-panel').classList.add('hidden');
                applyFilters(); 
            }
        });
    });

    initializeCalculator();
});

window.toggleAccordion = function(contentId, btnElement) {
    const content = document.getElementById(contentId);
    const icon = btnElement.querySelector('i.fa-chevron-down');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden'); icon.classList.add('rotate-180');
    } else {
        content.classList.add('hidden'); icon.classList.remove('rotate-180');
    }
};

async function initializeCalculator() {
    const loadingStatus = document.getElementById('loading-status');
    try {
        const [drugsData, paramsData, formulasData, annoData, catData, settingsData] = await Promise.all([
            fetchFromGAS('getDrugs'), fetchFromGAS('getParameters'), fetchFromGAS('getFormulas'), fetchFromGAS('getAnnouncements'), fetchFromGAS('getCategories'), fetchFromGAS('getSettings')
        ]);

        if (drugsData && paramsData && formulasData) {
            STORE.drugs = drugsData; STORE.parameters = paramsData; STORE.formulas = formulasData;
            STORE.categories = catData || []; STORE.announcements = annoData || [];
            STORE.settings = {}; if(settingsData) settingsData.forEach(s => STORE.settings[s.setting_key] = s.setting_value);
            
            renderHomeContent(); setupFilters(); applyFilters();

            const savedStateStr = localStorage.getItem('pharma_front_state');
            if(savedStateStr) {
                try {
                    const savedState = JSON.parse(savedStateStr);
                    if(savedState && savedState.domain && savedState.domain !== 'home') {
                        const tab = document.querySelector(`.front-nav[data-target="${savedState.domain}"]`);
                        if(tab) tab.click(); 
                    }
                    if(savedState && savedState.drugId) {
                        const d = STORE.drugs.find(x => String(x.drug_id) === String(savedState.drugId));
                        if(d) setTimeout(() => selectDrug(d), 300);
                    }
                } catch(e) { console.error(e); }
                localStorage.removeItem('pharma_front_state');
            }
        } else {
            loadingStatus.innerText = "資料載入失敗，請確認 API 網址。"; loadingStatus.classList.add('text-red-500');
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
    const cat1Select = document.getElementById('filter-cat1');
    const formSelect = document.getElementById('filter-form');
    const statusSelect = document.getElementById('filter-status');
    const searchInput = document.getElementById('search-input');
    
    const cat1s = [...new Set(STORE.categories.map(c => c.cat_1).filter(Boolean))];
    cat1s.forEach(c => cat1Select.add(new Option(c, c)));

    const forms = [...new Set(STORE.drugs.map(d => d.form).filter(Boolean))].sort();
    forms.forEach(f => formSelect.add(new Option(f, f)));

    cat1Select.addEventListener('change', applyFilters);
    formSelect.addEventListener('change', applyFilters);
    statusSelect.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', window.debounce(applyFilters, 300));
}

function applyFilters() {
    const c1 = document.getElementById('filter-cat1').value;
    const formVal = document.getElementById('filter-form').value;
    const statusVal = document.getElementById('filter-status').value;
    const k = document.getElementById('search-input').value.toLowerCase();

    const filtered = STORE.drugs.filter(d => {
        const drugStatus = d.status ? d.status.toUpperCase() : 'N';
        if (statusVal !== 'ALL' && drugStatus !== statusVal) return false;
        
        const drugDomain = d.domain || 'PED';
        if (currentDomain !== 'home' && drugDomain !== currentDomain) return false; 
        if (c1 && d.cat_1 !== c1) return false;
        if (formVal && d.form !== formVal) return false;
        
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

    const ul = document.createElement('ul'); ul.className = 'flex flex-col gap-2 p-1';

    drugsToRender.forEach(drug => {
        const li = document.createElement('li');
        const isSelected = currentDrug && String(drug.drug_id).trim() === String(currentDrug.drug_id).trim();
        
        li.className = `p-3 rounded cursor-pointer transition shadow-sm border-2 ${isSelected ? '!bg-blue-200 !border-[#1B365D] !ring-2 !ring-blue-400' : 'bg-gray-50 hover:bg-blue-50 border-gray-200'}`;
        li.id = `drug-item-${drug.drug_id}`;
        
        li.innerHTML = `
            <div class="flex gap-1 mb-2 flex-wrap">
                ${drug.cat_1 ? `<span class="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-bold">${drug.cat_1}</span>` : ''}
                ${drug.form ? `<span class="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] px-1.5 py-0.5 rounded font-bold">${drug.form}</span>` : ''}
            </div>
            <div class="font-bold text-[#1B365D] text-sm break-words leading-tight mb-2">${drug.generic_name || '無學名'}</div>
            <div class="text-[11px] text-gray-600 truncate">${drug.local_name || '--'}</div>
        `;
        li.onclick = () => selectDrug(drug);
        ul.appendChild(li);
    });
    treeContainer.appendChild(ul);
}

function selectDrug(drug) {
    currentDrug = drug;

    const allItems = document.querySelectorAll('#category-tree li');
    allItems.forEach(el => {
        el.classList.remove('!bg-blue-200', '!border-[#1B365D]', '!ring-2', '!ring-blue-400');
        el.classList.add('bg-gray-50', 'border-gray-200');
    });
    
    const selectedEl = document.getElementById(`drug-item-${drug.drug_id}`);
    if (selectedEl) {
        selectedEl.classList.remove('bg-gray-50', 'border-gray-200');
        selectedEl.classList.add('!bg-blue-200', '!border-[#1B365D]', '!ring-2', '!ring-blue-400');
        selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    document.getElementById('calc-placeholder').classList.add('hidden');
    document.getElementById('calc-panel').classList.remove('hidden');

    document.getElementById('drug-right-cats').innerHTML = `
        ${drug.cat_1 ? `<span class="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-bold">${drug.cat_1}</span>` : ''}
        ${drug.form ? `<span class="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] px-1.5 py-0.5 rounded font-bold">${drug.form}</span>` : ''}`;
    
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

    const instW = document.getElementById('drug-dose-inst-wrapper');
    if (drug.dose_instruction && drug.dose_instruction.trim() !== '') { document.getElementById('drug-dose-inst-content').innerText = drug.dose_instruction; instW.classList.remove('hidden'); } else instW.classList.add('hidden');
    const suppW = document.getElementById('drug-supplemental-wrapper');
    if (drug.supplemental_info && drug.supplemental_info.trim() !== '') { document.getElementById('drug-supplemental-content').innerText = drug.supplemental_info; suppW.classList.remove('hidden'); } else suppW.classList.add('hidden');
    const refW = document.getElementById('drug-ref-wrapper');
    if (drug.reference_url && drug.reference_url.trim() !== '') { document.getElementById('drug-ref-content').innerText = drug.reference_url; refW.classList.remove('hidden'); } else refW.classList.add('hidden');

    document.querySelectorAll('#drug-dose-inst-content, #drug-supplemental-content, #drug-ref-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('#drug-dose-inst-wrapper button i, #drug-supplemental-wrapper button i, #drug-ref-wrapper button i').forEach(icon => icon.classList.remove('rotate-180'));

    const targetId = String(drug.drug_id || '').trim().toLowerCase();
    const targetCode = String(drug.drug_code || '').trim().toLowerCase();
    const drugFormulas = STORE.formulas.filter(f => {
        const fId = String(f.drug_id || '').trim().toLowerCase();
        return fId !== '' && (fId === targetId || fId === targetCode);
    });

    const selectEl = document.getElementById('formula-select'); selectEl.innerHTML = '';
    const calcResultCard = document.getElementById('calc-result-card');
    
    if (drugFormulas.length === 0) { 
        selectEl.innerHTML = '<option value="">(尚未建置計算公式)</option>'; 
        document.getElementById('dynamic-parameters').classList.add('hidden');
        document.getElementById('formula-remark-card').classList.add('hidden');
        document.getElementById('formula-remark').innerText = '';
        document.getElementById('absolute-max-alert').classList.add('hidden');
        document.getElementById('single-max-text').innerText = '';
        document.getElementById('daily-max-text').innerText = '';
        if (calcResultCard) calcResultCard.classList.add('hidden');
        resetResult(); return; 
    } else {
        document.getElementById('dynamic-parameters').classList.remove('hidden');
        if (calcResultCard) calcResultCard.classList.remove('hidden');
        
        drugFormulas.forEach(f => {
            const option = document.createElement('option'); option.value = f.formula_id; option.innerText = f.formula_name; selectEl.appendChild(option);
        });
        selectEl.onchange = (e) => { 
            currentFormula = drugFormulas.find(f => String(f.formula_id).trim() === String(e.target.value).trim()); 
            renderDynamicParameters(currentFormula); 
        };
        currentFormula = drugFormulas[0]; 
        renderDynamicParameters(currentFormula);
    }
}

function renderDynamicParameters(formula) {
    if (!formula) return;
    resetResult();

    const remarkCard = document.getElementById('formula-remark-card');
    const safeRemark = String(formula.remark || '').trim();
    if (safeRemark !== '') {
        document.getElementById('formula-remark').innerText = safeRemark;
        remarkCard.classList.remove('hidden');
    } else {
        remarkCard.classList.add('hidden');
        document.getElementById('formula-remark').innerText = '';
    }

    const calcResultCard = document.getElementById('calc-result-card');
    const minStr = String(formula.formula_min || '').trim();
    const maxStr = String(formula.formula_max || '').trim();
    
    if (minStr === "" && maxStr === "") {
        if(document.getElementById('dynamic-parameters')) document.getElementById('dynamic-parameters').classList.add('hidden');
        if(document.getElementById('absolute-max-alert')) document.getElementById('absolute-max-alert').classList.add('hidden');
        if(calcResultCard) calcResultCard.classList.add('hidden');
        resetResult(); return; 
    } else {
        if(document.getElementById('dynamic-parameters')) document.getElementById('dynamic-parameters').classList.remove('hidden');
        if(calcResultCard) calcResultCard.classList.remove('hidden');
    }

    document.getElementById('result-unit').innerText = formula.result_unit || ''; 
    document.querySelectorAll('.prescribed-unit-display').forEach(el => el.innerText = formula.result_unit || '');

    const alertBox = document.getElementById('absolute-max-alert'); let hasAlert = false;
    if (formula.single_max) { document.getElementById('single-max-text').innerText = `單次最大：${formula.single_max} ${formula.single_max_unit||''}`; hasAlert = true;
    } else document.getElementById('single-max-text').innerText = '';
    if (formula.daily_max) { document.getElementById('daily-max-text').innerText = `單日最大：${formula.daily_max} ${formula.daily_max_unit||''}`; hasAlert = true;
    } else document.getElementById('daily-max-text').innerText = '';
    if (hasAlert) alertBox.classList.remove('hidden'); else alertBox.classList.add('hidden');

    const paramContainer = document.getElementById('dynamic-parameters'); paramContainer.innerHTML = '';
    const combinedFormula = minStr + " " + maxStr;
    const paramRegex = /{([^}]+)}/g; const requiredCodes = new Set(); let match;
    while ((match = paramRegex.exec(combinedFormula)) !== null) requiredCodes.add(match[1]);

    if (requiredCodes.size === 0) { executeCalculation(); return; }

    requiredCodes.forEach(code => {
        const paramDef = STORE.parameters.find(p => p.param_code === code);
        const paramName = paramDef ? paramDef.param_name : code; const paramUnit = paramDef ? paramDef.default_unit : '';
        const div = document.createElement('div'); div.className = 'flex flex-col gap-1';
        div.innerHTML = `
            <label class="text-xs font-bold text-[#1B365D]">${paramName} (${paramUnit})</label>
            <input type="number" data-code="${code}" step="any" min="0" placeholder="請輸入數值..." class="param-input border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#1B365D] shadow-inner bg-white">
        `;
        paramContainer.appendChild(div);
    });

    document.querySelectorAll('.param-input').forEach(input => input.addEventListener('input', window.debounce(executeCalculation, 100)));
}

function executeCalculation() {
    if (!currentFormula) return;
    let fMin = currentFormula.formula_min || '', fMax = currentFormula.formula_max || '';
    const inputs = document.querySelectorAll('.param-input'); let allFilled = true;

    inputs.forEach(input => {
        const code = input.getAttribute('data-code'), val = input.value;
        if (val === '') allFilled = false;
        else { const regex = new RegExp(`{${code}}`, 'g'); fMin = fMin.replace(regex, val); fMax = fMax.replace(regex, val); }
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
        
        resultEl.classList.add('text-[#1B365D]'); checkPrescriptionSafety();
    } catch (error) { document.getElementById('result-value').innerText = "公式錯誤"; }
}

function checkPrescriptionSafety() {
    const preInput = document.getElementById('prescribed-dose').value; const msgBox = document.getElementById('dose-eval-msg');
    if (!preInput || calculatedMin === null) { msgBox.classList.add('hidden'); return; }

    const val = parseFloat(preInput); msgBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-yellow-100', 'text-yellow-800', 'bg-red-600', 'text-white', 'animate-pulse', 'shadow-lg');
    
    if (calculatedMax !== null) {
        if (val < calculatedMin) {
            msgBox.className = 'text-sm font-bold mt-2 flex items-center gap-1.5 p-2 rounded bg-yellow-100 text-yellow-800';
            msgBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> 提示：處方劑量低於建議下限 (${calculatedMin})，不在建議劑量範圍內，應再確認。`;
        } else if (val > calculatedMax) {
            msgBox.className = 'text-sm font-bold mt-2 flex items-center gap-1.5 p-2 rounded bg-red-100 text-red-800 animate-pulse';
            msgBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 警告：處方劑量高於建議上限 (${calculatedMax})，不在建議劑量範圍內，應再確認。`;
        } else {
            msgBox.className = 'text-sm font-bold mt-2 flex items-center gap-1.5 p-2 rounded bg-green-100 text-green-800';
            msgBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> 處方劑量相符：落在 ${calculatedMin} ~ ${calculatedMax} 建議區間內。`;
        }
    }
    
    if (currentFormula.single_max && val > parseFloat(currentFormula.single_max)) {
        msgBox.className = 'text-sm font-bold mt-2 flex items-center gap-1.5 p-2 rounded bg-red-600 text-white animate-pulse shadow-lg';
        msgBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 注意：處方劑量已突破單次絕對最大劑量上限 (${currentFormula.single_max})，不在建議劑量範圍內，應再確認。`;
    }
}

function resetResult() {
    document.getElementById('result-value').innerText = '--'; 
    document.getElementById('result-value').className = 'text-3xl font-extrabold text-[#1B365D]';
    
    const resUnit = document.getElementById('result-unit');
    if(resUnit) resUnit.innerText = ''; 
    document.querySelectorAll('.prescribed-unit-display').forEach(el => el.innerText = '');
    const preDose = document.getElementById('prescribed-dose');
    if(preDose) preDose.value = '';
    
    calculatedMin = null; calculatedMax = null; 
    document.getElementById('dose-eval-msg').classList.add('hidden');
}

window.openFeedbackModal = function(contextInfo) { document.getElementById('feedback-context').innerText = contextInfo; document.getElementById('feedback-content').value = ''; document.getElementById('feedback-modal').classList.remove('hidden'); };
window.submitFeedback = async function() {
    const content = document.getElementById('feedback-content').value.trim(); const contextInfo = document.getElementById('feedback-context').innerText;
    if(!content) return alert("請輸入回報內容");
    const btn = document.getElementById('btn-submit-feedback'); btn.innerText = '傳送中...'; btn.disabled = true;
    try { await fetch(CONFIG.GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveFeedback', mode: 'add', drug_info: contextInfo, content: content }) }); alert("回報成功！感謝您的協助。"); document.getElementById('feedback-modal').classList.add('hidden');
    } catch(e) { alert("連線失敗"); } btn.innerText = '送出回報'; btn.disabled = false;
};

window.saveCurrentState = function() {
    if (!currentDrug) return;
    localStorage.setItem('pharma_front_state', JSON.stringify({ domain: currentDomain, drugId: currentDrug.drug_id }));
};

window.goToAdminEdit = function() { if(!currentDrug) return; saveCurrentState(); window.location.href = `./admin.html?drug_id=${currentDrug.drug_id}`; };
window.goToAdminFormula = function() { if(!currentDrug) return; saveCurrentState(); window.location.href = `./admin.html?action=formula_view&drug_id=${currentDrug.drug_id}`; };
