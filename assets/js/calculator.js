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
        // 💡【極速優化】不需要等 loadAllData，網頁一打開立刻先從本機快取渲染科別選單
        const cachedDomains = localStorage.getItem('PHARMA_DOMAINS_CACHE');
        if (cachedDomains) {
            renderDynamicNav(cachedDomains);
        }

        // 背景靜默下載/更新最新的雲端資料
        await window.loadAllData();
        
        // 雲端資料回來後，再刷一次最新的科別設定並存入快取
        const latestDomains = STORE.settings.domain_settings || "PED:小兒科,NICU:新生兒ICU,ADU:成人抗生素";
        localStorage.setItem('PHARMA_DOMAINS_CACHE', latestDomains);
        renderDynamicNav(latestDomains);

        // 初始化篩選器
        setupFilters();
        
        // 恢復前次瀏覽狀態
        const savedStateStr = localStorage.getItem('pharma_front_state');
        if (savedStateStr) {
            try {
                const savedState = JSON.parse(savedStateStr);
                if (savedState && savedState.domain && savedState.domain !== 'home') {
                    const tab = document.querySelector(`.front-nav[data-target="${savedState.domain}"]`);
                    if (tab) tab.click(); 
                }
                if (savedState && savedState.drugId) {
                    setTimeout(() => {
                        const d = STORE.drugs.find(x => String(x.drug_id) === String(savedState.drugId));
                        if (d) selectDrug(d);
                    }, 100);
                }
            } catch(e) { console.error(e); }
            localStorage.removeItem('pharma_front_state');
        }
    } catch (error) { 
        if(loadingStatus) {
            loadingStatus.innerText = "系統資料載入發生錯誤。"; 
            loadingStatus.classList.add('text-red-500');
        }
    }
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
    
    if (!cat1Select || !formSelect) return;

    // 💡【動態防刷】先清空舊選項，避免重複疊加
    cat1Select.innerHTML = '<option value="">-- 所有分類 --</option>';
    const cat1s = [...new Set(STORE.categories.map(c => c.cat_1).filter(Boolean))];
    cat1s.forEach(c => cat1Select.add(new Option(c, c)));

    formSelect.innerHTML = '<option value="">-- 所有劑型 --</option>';
    const forms = [...new Set(STORE.drugs.map(d => d.form).filter(Boolean))].sort();
    forms.forEach(f => formSelect.add(new Option(f, f)));

    // 💡【精準綁定】確保變更選擇時能即時觸發過濾條件
    cat1Select.onchange = applyFilters;
    formSelect.onchange = applyFilters;
    if (statusSelect) statusSelect.onchange = applyFilters;
    if (searchInput) {
        searchInput.oninput = window.debounce(applyFilters, 300);
    }
}

function applyFilters() {
    const c1 = document.getElementById('filter-cat1').value;
    const formVal = document.getElementById('filter-form').value;
    const statusVal = document.getElementById('filter-status').value;
    
    // 模糊搜尋支援多欄位及多關鍵字 (包含代碼、中英文名、商品名)
    const keywordString = document.getElementById('search-input').value.toLowerCase().trim();
    const keywords = keywordString ? keywordString.split(/\s+/) : [];

    const filtered = STORE.drugs.filter(d => {
        // 修正狀態篩選：ALL 為顯示全部
        const drugStatus = d.status ? d.status.toUpperCase() : 'N';
        if (statusVal && statusVal !== 'ALL' && drugStatus !== statusVal) return false;
        
        const drugDomain = d.domain || 'PED';
        if (currentDomain !== 'home' && drugDomain !== currentDomain) return false; 
        
        // 修復分類與劑型的篩選邏輯
        if (c1 && d.cat_1 !== c1) return false;
        if (formVal && d.form !== formVal) return false;
        
        if (keywords.length > 0) {
            const searchStr = ((d.drug_code||'') + ' ' + (d.local_name||'') + ' ' + (d.generic_name||'') + ' ' + (d.brand_name||'') + ' ' + (d.common_brand||'')).toLowerCase();
            if (!keywords.every(kw => searchStr.includes(kw))) return false;
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
        
        // 新增藥品卡片的狀態徽章
        const statusBadge = drug.status === 'Y' 
            ? `<span class="bg-green-100 text-green-700 border border-green-300 text-[10px] px-1.5 py-0.5 rounded font-bold">上線</span>` 
            : `<span class="bg-red-100 text-red-700 border border-red-300 text-[10px] px-1.5 py-0.5 rounded font-bold">關檔</span>`;

        li.innerHTML = `
            <div class="flex gap-1 mb-2 flex-wrap items-center">
                ${statusBadge}
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

    const formulaContainer = document.getElementById('formula-list-container'); 
    if(formulaContainer) formulaContainer.innerHTML = '';
    const calcResultCard = document.getElementById('calc-result-card');
    
    if (drugFormulas.length === 0) { 
        if(formulaContainer) formulaContainer.innerHTML = '<div class="text-sm text-gray-400 italic py-2">(尚未建置計算公式)</div>'; 
        document.getElementById('dynamic-parameters-container').classList.add('hidden');
        document.getElementById('formula-remark-card').classList.add('hidden');
        document.getElementById('absolute-max-alert').classList.add('hidden');
        if (calcResultCard) calcResultCard.classList.add('hidden');
        resetResult(); return; 
    } else {
        document.getElementById('dynamic-parameters-container').classList.remove('hidden');
        if (calcResultCard) calcResultCard.classList.remove('hidden');
        
        // 將每個公式變成一個可點擊的 Radio 卡片
        drugFormulas.forEach((f, index) => {
            const isChecked = index === 0 ? 'checked' : '';
            const activeClass = index === 0 ? 'border-[#1B365D] bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50';
            
            const label = document.createElement('label');
            label.className = `cursor-pointer border-2 rounded-lg p-3 text-sm flex items-center gap-3 transition shadow-sm ${activeClass}`;
            label.innerHTML = `
                <input type="radio" name="formula_choice" value="${f.formula_id}" class="w-4 h-4 text-[#1B365D] focus:ring-[#1B365D] mt-0.5" ${isChecked}>
                <div class="font-bold text-gray-800 flex-grow">${f.formula_name}</div>
            `;
            
            // 綁定點擊切換事件
            label.querySelector('input').addEventListener('change', (e) => {
                // 將所有卡片恢復原狀
                formulaContainer.querySelectorAll('label').forEach(lbl => {
                    lbl.classList.remove('border-[#1B365D]', 'bg-blue-50');
                    lbl.classList.add('border-gray-200', 'bg-white');
                });
                // 把被選中的卡片高亮
                label.classList.remove('border-gray-200', 'bg-white');
                label.classList.add('border-[#1B365D]', 'bg-blue-50');

                currentFormula = drugFormulas.find(fx => String(fx.formula_id).trim() === String(e.target.value).trim()); 
                renderDynamicParameters(currentFormula); 
            });

            formulaContainer.appendChild(label);
        });

        // 預設載入第一筆公式
        currentFormula = drugFormulas[0]; 
        renderDynamicParameters(currentFormula);
    }
} // selectDrug 結束的地方

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
        const paramCode = match[1];
        const codeLower = paramCode.toLowerCase();
        
        // 【關鍵修正】把不需要產生輸入框的「內部變數」通通排除
        if (codeLower !== 'prescribed' && codeLower !== 'min' && codeLower !== 'max') {
            requiredCodes.add(paramCode);
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

// =====================================================================
// 最終整合版：前台計算引擎（支援將 Min/Max 答案轉換為矩陣變數）
// =====================================================================
window.executeCalculation = function() {
    if (!currentFormula) return;
    
    const inputs = document.querySelectorAll('.param-input'); 
    let allFilled = true;
    let scopeVals = {};

    // 收集畫面上使用者輸入的生理參數
    inputs.forEach(input => {
        const val = input.value;
        if (val === '') allFilled = false;
        scopeVals[input.getAttribute('data-code')] = parseFloat(val) || 0;
    });

    const resultEl = document.getElementById('result-value');
    const resultUnitEl = document.getElementById('result-unit');
    const baseSection = document.getElementById('base-range-section');
    const matrixSection = document.getElementById('matrix-result-section');
    
    if (!allFilled && inputs.length > 0) { 
        if(resultEl) resultEl.innerText = "--";
        if(baseSection) baseSection.classList.add('hidden');
        if(matrixSection) matrixSection.classList.add('hidden');
        return; 
    }

    if(matrixSection) {
        matrixSection.classList.add('hidden'); 
        const matrixTextEl = document.getElementById('matrix-result-text');
        if (matrixTextEl) matrixTextEl.innerText = '';
    }

    // --- 1. 使用定義在 config.js 的統一引擎計算基礎區間 ---
    let calculatedMin = window.sharedCalc(currentFormula.formula_min, scopeVals);
    let calculatedMax = window.sharedCalc(currentFormula.formula_max, scopeVals);

    // ==========================================
    // 【核心修改】將算出的答案動態註冊為全新變數
    // ==========================================
    // 如此一來，動態條件判定矩陣內部就能直接識別並使用 {min} 與 {max}
    scopeVals['min'] = calculatedMin !== null ? calculatedMin : 0;
    scopeVals['max'] = calculatedMax !== null ? calculatedMax : 0;

    // --- 2. 顯示基礎結果 ---
    if (baseSection && resultEl) {
        if (calculatedMin !== null || calculatedMax !== null) {
            resultEl.innerText = (calculatedMin !== null ? calculatedMin.toFixed(2) : '--') + 
                                 (calculatedMax !== null ? ' ~ ' + calculatedMax.toFixed(2) : '');
            if(resultUnitEl) resultUnitEl.innerText = currentFormula.result_unit || '';
            baseSection.classList.remove('hidden');
        } else {
            baseSection.classList.add('hidden');
        }
    }

    // --- 3. 執行進階動態矩陣判斷（此時 scopeVals 已內含 {min} 與 {max}） ---
    if (currentFormula.parsedMatrixRules && currentFormula.parsedMatrixRules.length > 0) {
        let matchedResults = []; 
        
        for (let rule of currentFormula.parsedMatrixRules) {
            // 使用 sharedCalc 來判定 IF 條件是否成立（例如條件寫：{min} >= 50）
            if (window.sharedCalc(rule.condition, scopeVals)) {
                
                // 解析 THEN 結果中可能包含的 [[ ]] 運算式（例如結果寫：建議給予 [[ {min} * 0.8 ]] mg）
                let evalOutput = rule.result.replace(/\[\[(.*?)\]\]/g, (match, expr) => {
                    let val = window.sharedCalc(expr, scopeVals);
                    return val !== null ? Math.round(val * 100) / 100 : expr;
                });
                
                matchedResults.push(evalOutput);
            }
        }
        
        const finalResult = matchedResults.length > 0 ? matchedResults.join('\n\n------------------------\n\n') : "⚠️ 數值未命中任何設定條件";
        const matrixTextEl = document.getElementById('matrix-result-text');
        
        if (matrixTextEl) {
            matrixTextEl.innerText = finalResult;
            if (matrixSection) {
                // 確保容器內有對應的文字節點並顯現
                matrixSection.classList.remove('hidden');
            }
        }
    }
}

function resetResult() {
    // 重置建議區間顯示
    const resVal = document.getElementById('result-value');
    if(resVal) {
        resVal.innerText = '--'; 
        resVal.className = 'text-3xl font-extrabold text-[#1B365D]';
    }
    
    const resUnit = document.getElementById('result-unit');
    if(resUnit) resUnit.innerText = ''; 
    
    // 重置矩陣分析顯示 (保護內部 DOM)
    const matrixSection = document.getElementById('matrix-result-section');
    if(matrixSection) {
        matrixSection.classList.add('hidden');
        const matrixTextEl = document.getElementById('matrix-result-text');
        if (matrixTextEl) matrixTextEl.innerText = '';
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


function renderDynamicNav(domainStr) {
    const navContainer = document.getElementById('dynamic-nav-container');
    if (!navContainer) return;

    const targetDomainStr = domainStr || "PED:小兒科,NICU:新生兒ICU,ADU:成人抗生素";
    const domains = targetDomainStr.split(',').map(d => {
        const [code, name] = d.split(':');
        return { code: code ? code.trim() : '', name: name ? name.trim() : (code ? code.trim() : '') };
    }).filter(d => d.code);

    let navHtml = `<button class="front-nav w-full text-left border-l-4 border-[#63B3ED] bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20" data-target="home"><i class="fa-solid fa-house mr-2"></i>首頁</button>`;
    
    domains.forEach(d => {
        navHtml += `<button class="front-nav w-full text-left border-l-4 border-transparent px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20" data-target="${d.code}"><i class="fa-solid fa-prescription-bottle-medical mr-2"></i>${d.name}</button>`;
    });

    navContainer.innerHTML = navHtml;

    // 重新綁定直向選單的點擊切換事件
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
                if(document.getElementById('filter-cat1')) document.getElementById('filter-cat1').value = '';
                if(document.getElementById('filter-form')) document.getElementById('filter-form').value = '';
                if(document.getElementById('filter-status')) document.getElementById('filter-status').value = 'ALL';
                
                document.getElementById('calc-placeholder').classList.remove('hidden');
                document.getElementById('calc-panel').classList.add('hidden');
                applyFilters(); 
            }
        });
    });

    // 💡 保持當前已被選取科別的高亮狀態
    if (typeof currentDomain !== 'undefined' && currentDomain) {
        const activeTab = document.querySelector(`.front-nav[data-target="${currentDomain}"]`);
        if (activeTab) {
            document.querySelectorAll('.front-nav').forEach(n => n.classList.remove('border-[#63B3ED]', 'bg-white/10'));
            activeTab.classList.add('border-[#63B3ED]', 'bg-white/10');
        }
    }
}

// ==========================================
// 擴充功能：工具箱/流速計算機 (一次運算多公式)
// ==========================================

window.setupToolDropdown = function() {
    const selector = document.getElementById('tool-selector');
    const container = document.getElementById('tool-toolbox-container');
    if (!selector || !container) return;
    
    // 尋找科別為 'TOOL' 且上線中的藥品(工具)
    const tools = STORE.drugs.filter(d => d.domain === 'TOOL' && d.status === 'Y');
    
    if (tools.length === 0) {
        container.classList.add('hidden'); // 如果沒建置工具，隱藏按鈕區塊
        return;
    }
    
    container.classList.remove('hidden');
    selector.innerHTML = tools.map(t => `<option value="${t.drug_id}">${t.local_name || t.generic_name}</option>`).join('');
};

// 💡 新增：用來記憶計算機輸入過數值的快取
window.toolInputCache = {}; 

window.openToolModal = function() {
    const selector = document.getElementById('tool-selector');
    if (!selector || !selector.value) return;
    
    const toolId = selector.value;
    const toolDrug = STORE.drugs.find(d => String(d.drug_id) === String(toolId));
    if (!toolDrug) return;
    
    document.getElementById('tool-modal-title').innerText = toolDrug.local_name || toolDrug.generic_name;
    
    const formulas = STORE.formulas.filter(f => String(f.drug_id) === String(toolId) || (toolDrug.drug_code && String(f.drug_id) === String(toolDrug.drug_code)));
    window.currentToolFormulas = formulas;
    
    const requiredCodes = new Set();
    const paramRegex = /{([a-zA-Z0-9_]+)}/g;
    
    formulas.forEach(f => {
        const combinedText = (f.formula_min || '') + (f.formula_max || '');
        let match;
        while ((match = paramRegex.exec(combinedText)) !== null) {
            const code = match[1].toLowerCase();
            if (code !== 'min' && code !== 'max' && code !== 'prescribed') requiredCodes.add(match[1]);
        }
    });
    
    const paramContainer = document.getElementById('tool-dynamic-parameters');
    paramContainer.innerHTML = '';
    
    if (requiredCodes.size === 0) {
        paramContainer.innerHTML = '<div class="col-span-full text-sm text-gray-500 italic">此工具不需要輸入任何參數，請直接看下方結果。</div>';
    } else {
        const mainInputs = document.querySelectorAll('#dynamic-parameters .param-input');
        const currentMainValues = {};
        mainInputs.forEach(input => {
            const code = input.getAttribute('data-code');
            if (code && input.value !== '') currentMainValues[code] = input.value;
        });
        
        requiredCodes.forEach(code => {
            const paramDef = STORE.parameters.find(p => p.param_code === code);
            const paramName = paramDef ? paramDef.param_name : code;
            const paramUnit = paramDef ? paramDef.default_unit : '';
            const paramType = paramDef ? paramDef.param_type : 'INPUT';
            const paramOptionsStr = paramDef ? paramDef.param_options : '';
            
            // 💡 邏輯修改：優先讀取「記憶快取」，如果有值就用記憶的；如果沒有才去抓主畫面的參數預設值
            const prefillValue = (window.toolInputCache[code] !== undefined && window.toolInputCache[code] !== '') 
                                 ? window.toolInputCache[code] 
                                 : (currentMainValues[code] !== undefined ? currentMainValues[code] : '');
            
            const div = document.createElement('div');
            div.className = 'flex flex-col gap-1';
            
            if (paramType === 'SELECT' && paramOptionsStr) {
                let optionsHtml = `<option value="">請選擇...</option>`;
                paramOptionsStr.split('|').forEach(pair => {
                    const [text, val] = pair.split(':');
                    if (text && val !== undefined) {
                        const selected = String(val) === String(prefillValue) ? 'selected' : '';
                        optionsHtml += `<option value="${val}" ${selected}>${text}</option>`;
                    }
                });
                div.innerHTML = `
                    <label class="text-[11px] font-bold text-gray-700">${paramName}</label>
                    <select data-code="${code}" class="tool-param-input border border-orange-200 rounded p-1.5 text-sm focus:border-orange-500 focus:outline-none bg-orange-50 shadow-inner">
                        ${optionsHtml}
                    </select>
                `;
            } else {
                div.innerHTML = `
                    <label class="text-[11px] font-bold text-gray-700">${paramName} ${paramUnit ? `<span class="text-gray-400">(${paramUnit})</span>` : ''}</label>
                    <input type="number" data-code="${code}" value="${prefillValue}" step="any" min="0" placeholder="輸入..." class="tool-param-input border border-orange-200 rounded p-1.5 text-sm focus:border-orange-500 focus:outline-none bg-orange-50 shadow-inner">
                `;
            }
            paramContainer.appendChild(div);
        });
    }
    
    document.querySelectorAll('.tool-param-input').forEach(input => {
        input.addEventListener('change', window.executeToolCalculation);
        input.addEventListener('input', window.debounce(window.executeToolCalculation, 100));
    });
    
    document.getElementById('tool-modal').classList.remove('hidden');
    window.executeToolCalculation(); 
};

window.executeToolCalculation = function() {
    if (!window.currentToolFormulas || window.currentToolFormulas.length === 0) return;
    
    const scopeVals = {};
    let allFilled = true;
    document.querySelectorAll('.tool-param-input').forEach(input => {
        if(input.value === '') allFilled = false;
        scopeVals[input.getAttribute('data-code')] = parseFloat(input.value) || 0;
        
        // 💡 新增：每次使用者輸入或變更時，即時將數值存入記憶快取
        window.toolInputCache[input.getAttribute('data-code')] = input.value;
    });
    
    const resultsContainer = document.getElementById('tool-results-container');
    resultsContainer.innerHTML = '';
    
    if (!allFilled && document.querySelectorAll('.tool-param-input').length > 0) {
        resultsContainer.innerHTML = '<div class="text-sm text-gray-500 italic text-center py-4">請先填寫上方所有參數，以顯示換算結果</div>';
        return;
    }
    
    window.currentToolFormulas.forEach(f => {
        let calcMin = window.sharedCalc(f.formula_min, scopeVals);
        let calcMax = window.sharedCalc(f.formula_max, scopeVals);
        
        let resultText = '--';
        if (calcMin !== null || calcMax !== null) {
            const sMin = calcMin !== null ? Math.round(calcMin * 100) / 100 : '--';
            const sMax = calcMax !== null ? Math.round(calcMax * 100) / 100 : '';
            resultText = sMin + (sMax !== '' ? ' ~ ' + sMax : '');
        }
        
        const card = document.createElement('div');
        card.className = 'border-l-4 border-orange-400 bg-white p-3 rounded shadow-sm flex flex-col justify-center';
        card.innerHTML = `
            <div class="flex justify-between items-center flex-wrap gap-2">
                <div class="font-bold text-gray-800 text-sm"><i class="fa-solid fa-angle-right text-orange-400 mr-1 text-[10px]"></i> ${f.formula_name}</div>
                <div class="text-lg font-extrabold text-orange-600">${resultText} <span class="text-xs text-gray-500 font-normal ml-0.5">${f.result_unit || ''}</span></div>
            </div>
            ${f.remark ? `<div class="text-[10px] text-gray-500 mt-1 border-t border-gray-100 pt-1">${f.remark}</div>` : ''}
        `;
        resultsContainer.appendChild(card);
    });
};

// 💡 全新功能：一鍵清空所有計算機輸入，並移除記憶快取
window.clearToolInputs = function() {
    document.querySelectorAll('.tool-param-input').forEach(input => {
        input.value = '';
        delete window.toolInputCache[input.getAttribute('data-code')];
    });
    // 觸發重新計算 (因為變成空值，會自動顯示「請填寫所有參數」的提示文字)
    window.executeToolCalculation();
};
