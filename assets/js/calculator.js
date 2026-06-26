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
    
    // 【修正】移除對已不存在的 prescribed-dose 元素的綁定
    // document.getElementById('prescribed-dose').addEventListener('input', window.debounce(checkPrescriptionSafety, 300));
    
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

// ================== [替換：前台邏輯 3 個函式] ==================

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

    // 【修改】說明卡片預設展開
    const instW = document.getElementById('drug-dose-inst-wrapper');
    if (drug.dose_instruction && drug.dose_instruction.trim() !== '') { 
        document.getElementById('drug-dose-inst-content').innerText = drug.dose_instruction; 
        instW.classList.remove('hidden'); 
        document.getElementById('drug-dose-inst-content').classList.remove('hidden'); // 預設打開
        instW.querySelector('button i').classList.add('rotate-180');
    } else instW.classList.add('hidden');

    const suppW = document.getElementById('drug-supplemental-wrapper');
    if (drug.supplemental_info && drug.supplemental_info.trim() !== '') { 
        document.getElementById('drug-supplemental-content').innerText = drug.supplemental_info; 
        suppW.classList.remove('hidden'); 
        document.getElementById('drug-supplemental-content').classList.remove('hidden'); // 預設打開
        suppW.querySelector('button i').classList.add('rotate-180');
    } else suppW.classList.add('hidden');

    const refW = document.getElementById('drug-ref-wrapper');
    if (drug.reference_url && drug.reference_url.trim() !== '') { 
        document.getElementById('drug-ref-content').innerText = drug.reference_url; 
        refW.classList.remove('hidden'); 
        document.getElementById('drug-ref-content').classList.remove('hidden'); // 預設打開
        refW.querySelector('button i').classList.add('rotate-180');
    } else refW.classList.add('hidden');

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
        document.getElementById('dynamic-parameters-container').classList.add('hidden');
        document.getElementById('formula-remark-card').classList.add('hidden');
        document.getElementById('absolute-max-alert').classList.add('hidden');
        if (calcResultCard) calcResultCard.classList.add('hidden');
        resetResult(); return; 
    } else {
        document.getElementById('dynamic-parameters-container').classList.remove('hidden');
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

    // 1. 解析矩陣規則
    let matrixRules = [];
    try { 
        if (formula.matrix_rules && formula.matrix_rules.trim() !== '' && formula.matrix_rules !== '[]') {
            matrixRules = JSON.parse(formula.matrix_rules); 
        }
    } catch(e) { console.error("矩陣解析失敗", e); }
    currentFormula.parsedMatrixRules = matrixRules;

    // 2. 處理備註說明
    const remarkCard = document.getElementById('formula-remark-card');
    const safeRemark = String(formula.remark || '').trim();
    if (safeRemark !== '') {
        document.getElementById('formula-remark').innerText = safeRemark;
        remarkCard.classList.remove('hidden');
    } else remarkCard.classList.add('hidden');

    // 3. 設定結果單位顯示
    document.getElementById('result-unit').innerText = formula.result_unit || ''; 

    // 4. 處理絕對上限 (現在支援公式化)
    const alertBox = document.getElementById('absolute-max-alert');
    // 注意：絕對上限的公式計算邏輯已移至 executeCalculation 處理，這裡僅負責顯隱容器
    if (formula.single_max || formula.daily_max) {
        alertBox.classList.remove('hidden');
    } else {
        alertBox.classList.add('hidden');
    }

// 5. 【動態解析配置】萃取參數並決定生成 input 還是 select
    const paramContainer = document.getElementById('dynamic-parameters');
    paramContainer.innerHTML = '';
    const requiredCodes = new Set(); 
    const paramRegex = /{([a-zA-Z0-9_]+)}/g; 
    let match;

    const combinedText = (formula.formula_min || '') + (formula.formula_max || '') + 
                         matrixRules.map(r => r.condition + r.result).join('');
    
    while ((match = paramRegex.exec(combinedText)) !== null) {
        if (match[1].toLowerCase() !== 'prescribed') {
            requiredCodes.add(match[1]);
        }
    }

    if (requiredCodes.size === 0) { 
        document.getElementById('dynamic-parameters-container').classList.add('hidden');
        executeCalculation(); 
    } else {
        document.getElementById('dynamic-parameters-container').classList.remove('hidden');
        
        requiredCodes.forEach(code => {
            // 從後台載入的 STORE 尋找參數設定
            const paramDef = STORE.parameters.find(p => p.param_code === code);
            const paramName = paramDef ? paramDef.param_name : code; 
            const paramUnit = paramDef ? paramDef.default_unit : '';
            const paramType = paramDef ? paramDef.param_type : 'INPUT'; // 預設為常規輸入框
            const paramOptionsStr = paramDef ? paramDef.param_options : '';

            const div = document.createElement('div');
            div.className = 'flex flex-col gap-1';

            // 狀況 A：後台設定此變數為「下拉選單型定值」
            if (paramType === 'SELECT' && paramOptionsStr) {
                let optionsHtml = `<option value="">請選擇...</option>`;
                
                // 解析 "男:1|女:0.85" 格式
                const optionPairs = paramOptionsStr.split('|');
                optionPairs.forEach(pair => {
                    const [text, val] = pair.split(':');
                    if (text && val !== undefined) {
                        optionsHtml += `<option value="${val}">${text}</option>`;
                    }
                });

                div.innerHTML = `
                    <label class="text-xs font-bold text-gray-700">${paramName}</label>
                    <select data-code="${code}" class="param-input border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#1B365D] shadow-inner bg-white">
                        ${optionsHtml}
                    </select>
                `;
            } 
            // 狀況 B：常規數字變數輸入框
            else {
                div.innerHTML = `
                    <label class="text-xs font-bold text-gray-700">${paramName} ${paramUnit ? `<span class="text-gray-400">(${paramUnit})</span>` : ''}</label>
                    <input type="number" data-code="${code}" step="any" min="0" placeholder="輸入數值..." class="param-input border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#1B365D] shadow-inner bg-white">
                `;
            }
            paramContainer.appendChild(div);
        });

        // 監聽所有動態元件 (不論 select 或 input)，值改變就觸發 executeCalculation
        document.querySelectorAll('.param-input').forEach(input => {
            input.addEventListener('change', window.debounce(executeCalculation, 100));
            input.addEventListener('input', window.debounce(executeCalculation, 100));
        });
        executeCalculation();
    }
}

// ================== [最終整合版：前台計算引擎] ==================

function executeCalculation() {
    if (!currentFormula) return;
    
    const inputs = document.querySelectorAll('.param-input'); 
    let allFilled = true;
    let scopeVals = {};

    inputs.forEach(input => {
        const val = input.value;
        if (val === '') allFilled = false;
        scopeVals[input.getAttribute('data-code')] = val;
    });

    const resultEl = document.getElementById('result-value');
    const baseSection = document.getElementById('base-range-section');
    const matrixSection = document.getElementById('matrix-result-section');
    
    // 【體驗優化】參數未填完時，清除結果顯示
    if (!allFilled && inputs.length > 0) { 
        resultEl.innerText = "--";
        baseSection.classList.add('hidden');
        matrixSection.classList.add('hidden');
        return; 
    }

    calculatedMin = null; calculatedMax = null;
    matrixSection.classList.add('hidden'); 
    matrixSection.innerText = '';

    // 協助計算公式 (支援參數替換)
    const evalFormula = (f) => {
        if (!f || f.trim() === '') return null;
        let str = f;
        for(let code in scopeVals) {
            str = str.replace(new RegExp(`{${code}}`, 'gi'), scopeVals[code] || 0);
        }
        try { return Math.round(math.evaluate(str) * 100) / 100; } catch(e) { return null; }
    };

    // 1. 執行基礎區間計算
    calculatedMin = evalFormula(currentFormula.formula_min);
    calculatedMax = evalFormula(currentFormula.formula_max);
    
    // ==========================================
    // 【新增】將基礎公式的計算結果，變成虛擬變數供矩陣使用
    // ==========================================
    scopeVals['min'] = calculatedMin !== null ? calculatedMin : 0;
    scopeVals['max'] = calculatedMax !== null ? calculatedMax : 0;
    
    if (calculatedMin !== null || calculatedMax !== null) {
        if (calculatedMin !== null && calculatedMax !== null) resultEl.innerText = `${calculatedMin} ~ ${calculatedMax}`;
        else resultEl.innerText = `${calculatedMin !== null ? calculatedMin : calculatedMax}`;
        baseSection.classList.remove('hidden');
    } else {
        baseSection.classList.add('hidden');
    }

// 2. 執行進階動態矩陣判斷 (這邊的程式碼完全不用動)
    // 因為 scopeVals 裡面已經有 'min' 和 'max' 了，
    // 所以底下的 replace('{min}') 會自動把它替換成算出來的數字！
    if (currentFormula.parsedMatrixRules && currentFormula.parsedMatrixRules.length > 0) {
        let matchedResult = "⚠️ 數值超出所有設定的安全條件範圍";
        
        // 確保迴圈中的變數宣告正確
        for (let rule of currentFormula.parsedMatrixRules) {
            let evalCondition = rule.condition;
            
            // 參數替換
            for(let code in scopeVals) {
                const regex = new RegExp(`{${code}}`, 'gi');
                evalCondition = evalCondition.replace(regex, scopeVals[code] || 0);
            }
            
            // 轉換邏輯運算子
            let sanitizedCondition = evalCondition.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');

            try {
                // 如果條件空白或是判定為 True
                if (sanitizedCondition.trim() === '' || math.evaluate(sanitizedCondition)) {
                    let evalOutput = rule.result;
                    
                    // 輸出結果文字替換
                    for(let code in scopeVals) {
                        const regex = new RegExp(`{${code}}`, 'gi');
                        evalOutput = evalOutput.replace(regex, scopeVals[code] || 0);
                    }
                    
                    // 解析輸出中的 [[數學公式]]
                    evalOutput = evalOutput.replace(/\[\[(.*?)\]\]/g, (match, expr) => {
                        try { return Math.round(math.evaluate(expr) * 100) / 100; } catch(e) { return expr; }
                    });
                    
                    matchedResult = evalOutput;
                    break; // 命中條件即跳出
                }
            } catch(e) { 
                console.warn("矩陣判定錯誤:", sanitizedCondition, e); 
            }
        }
        
        const matrixTextEl = document.getElementById('matrix-result-text');
        if (matchedResult !== "⚠️ 條件未命中" && matrixTextEl) {
            matrixTextEl.innerText = matchedResult; // 這裡會保留您 textarea 的換行符號
            matrixSection.classList.remove('hidden');
        } else if (matchedResult !== "⚠️ 條件未命中") {
            // 如果找不到 matrix-result-text 這個 ID，確保舊的寫法也有效
            matrixSection.innerText = matchedResult;
            matrixSection.classList.remove('hidden');
        }
    }
}

// =====================================================================

function resetResult() {
    // 重置建議區間顯示
    document.getElementById('result-value').innerText = '--'; 
    document.getElementById('result-value').className = 'text-3xl font-extrabold text-[#1B365D]';
    
    const resUnit = document.getElementById('result-unit');
    if(resUnit) resUnit.innerText = ''; 
    
    // 重置矩陣分析顯示
    const matrixSection = document.getElementById('matrix-result-section');
    if(matrixSection) {
        matrixSection.innerText = '';
        matrixSection.classList.add('hidden');
    }
    
    // 清除全域暫存變數
    calculatedMin = null; 
    calculatedMax = null; 
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
