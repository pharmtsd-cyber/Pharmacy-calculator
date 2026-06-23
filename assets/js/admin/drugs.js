document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('btn-save-drug')) document.getElementById('btn-save-drug').onclick = saveDrug;
});

window.setupDrugListFilters = function() {
    const dc1 = document.getElementById('list-dash-cat1'), dc2 = document.getElementById('list-dash-cat2'), dc3 = document.getElementById('list-dash-cat3');
    const dd = document.getElementById('list-dash-domain'), df = document.getElementById('filter-dash-drugs');
    const cat1s = [...new Set(STORE.categories.map(c => c.cat_1).filter(Boolean))];

    const bindCascading = (c1, c2, c3) => {
        if(!c1) return;
        c1.innerHTML = '<option value="">-- 第一層分類篩選 --</option>'; cat1s.forEach(c => c1.add(new Option(c, c)));
        c1.addEventListener('change', () => {
            c2.innerHTML = '<option value="">-- 第二層分類篩選 --</option>'; c3.innerHTML = '<option value="">-- 第三層分類篩選 --</option>';
            if (c1.value) {
                const cat2s = [...new Set(STORE.categories.filter(c => c.cat_1 === c1.value).map(c => c.cat_2).filter(Boolean))];
                cat2s.forEach(c => c2.add(new Option(c, c))); c2.disabled = false;
            } else c2.disabled = true;
            c3.disabled = true; renderDrugsList();
        });
        c2.addEventListener('change', () => {
            c3.innerHTML = '<option value="">-- 第三層分類篩選 --</option>';
            if (c2.value) {
                const cat3s = [...new Set(STORE.categories.filter(c => c.cat_1 === c1.value && c.cat_2 === c2.value).map(c => c.cat_3).filter(Boolean))];
                cat3s.forEach(c => c3.add(new Option(c, c))); c3.disabled = false;
            } else c3.disabled = true; renderDrugsList();
        });
        c3.addEventListener('change', renderDrugsList);
    };

    bindCascading(dc1, dc2, dc3);
    if(dd) dd.addEventListener('change', renderDrugsList);
    if(df) df.addEventListener('input', renderDrugsList);
};

window.renderDrugsList = function() {
    const dashList = document.getElementById('list-dash-drugs');
    if (!dashList) return;
    
    const fd = document.getElementById('list-dash-domain') ? document.getElementById('list-dash-domain').value : '';
    const fc1 = document.getElementById('list-dash-cat1') ? document.getElementById('list-dash-cat1').value : '';
    const fc2 = document.getElementById('list-dash-cat2') ? document.getElementById('list-dash-cat2').value : '';
    const fc3 = document.getElementById('list-dash-cat3') ? document.getElementById('list-dash-cat3').value : '';
    const fText = document.getElementById('filter-dash-drugs') ? document.getElementById('filter-dash-drugs').value.toLowerCase().trim() : '';
    
    // 【優化】支援多組關鍵字空白分隔搜尋
    const dashKeywords = fText ? fText.split(/\s+/) : [];

    const dashDrugs = STORE.drugs.filter(d => {
        if (fd && (d.domain || 'PED') !== fd) return false;
        if (fc1 && d.cat_1 !== fc1) return false;
        if (fc2 && d.cat_2 !== fc2) return false;
        if (fc3 && d.cat_3 !== fc3) return false;
        if (dashKeywords.length > 0) {
            // 【優化】搜尋字串包含全部需要的欄位
            const searchStr = `${d.drug_code||''} ${d.local_name||''} ${d.generic_name||''} ${d.brand_name||''} ${d.common_brand||''} ${d.cat_1||''}`.toLowerCase();
            if (!dashKeywords.every(kw => searchStr.includes(kw))) return false;
        }
        return true;
    });

    if(document.getElementById('dash-drug-count')) document.getElementById('dash-drug-count').innerText = dashDrugs.length;
    
    dashList.innerHTML = dashDrugs.map(d => {
        const dom = d.domain || 'PED';
        let domText = dom === 'NICU' ? '新生兒 ICU' : (dom === 'ADU' ? '成人抗生素' : '小兒科');
        let domColor = dom === 'NICU' ? 'bg-pink-100 text-pink-800' : (dom === 'ADU' ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800');
        
        const statusHtml = d.status === 'Y' 
            ? `<button onclick="toggleDrugStatus('${d.drug_id}', 'Y', event)" class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold hover:bg-green-200 border border-green-300">上線中</button>`
            : `<button onclick="toggleDrugStatus('${d.drug_id}', 'N', event)" class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-200 border border-red-300">未上線</button>`;

        return `<tr class="hover:bg-blue-50 transition">
            <td class="pt-3"><span class="${domColor} text-[10px] px-2 py-0.5 rounded font-bold">${domText}</span></td>
            <td class="pt-3"><div class="font-bold text-orange-600 mb-1">${d.drug_code||'--'}</div><span class="bg-blue-100 text-blue-800 text-[10px] px-1 rounded">${d.cat_1||''}</span></td>
            <td class="pt-3"><div class="font-bold text-blue-900">${d.generic_name||'無學名'}</div><div class="text-[10px] text-gray-500">${d.local_name||''} ${d.brand_name?'('+d.brand_name+')':''}</div></td>
            <td class="pt-3">${statusHtml}</td>
            <td class="pt-3 flex gap-2">
                <button onclick="goToDrugView('${d.drug_id}')" class="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200"><i class="fa-solid fa-pen"></i> 編輯</button>
                <button onclick="deleteRecord('deleteDrug', '${d.drug_id}')" class="text-red-500 hover:text-red-700 text-xs px-2 py-1"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');

    if(typeof renderDashFormulas === 'function') renderDashFormulas(dashDrugs);
};

window.renderDashFormulas = function(dashDrugs) {
    const dashFormulasList = document.getElementById('list-dash-formulas');
    if (!dashFormulasList) return;

    const validIds = new Set();
    dashDrugs.forEach(d => { validIds.add(String(d.drug_id).trim().toLowerCase()); if (d.drug_code) validIds.add(String(d.drug_code).trim().toLowerCase()); });

    const dashFormulas = STORE.formulas.filter(f => validIds.has(String(f.drug_id).trim().toLowerCase()));

    dashFormulasList.innerHTML = dashFormulas.length === 0 ? 
        `<tr><td colspan="5" class="text-center text-gray-400 py-4">目前篩選條件下無對應公式</td></tr>` :
        dashFormulas.map(f => {
            const targetId = String(f.drug_id).trim().toLowerCase();
            const d = dashDrugs.find(x => String(x.drug_id).trim().toLowerCase() === targetId || String(x.drug_code).trim().toLowerCase() === targetId); 
            const actualDrugId = d ? d.drug_id : f.drug_id;
            
            // 【優化】公式總表顯示豐富的藥品資訊
            let drugNameHtml = '<div class="text-gray-400">未知藥品 (舊綁定)</div>';
            if (d) {
                drugNameHtml = `
                    <div class="font-bold text-orange-600 mb-0.5">${d.drug_code||'--'}</div>
                    <div class="font-bold text-blue-900">${d.generic_name||'無學名'}</div>
                    <div class="text-[10px] text-gray-500 leading-tight mt-0.5">${d.local_name||''}<br/>${d.brand_name||''}</div>
                `;
            }

            return `<tr class="hover:bg-purple-50 transition">
                <td class="pt-3">${drugNameHtml}</td>
                <td class="pt-3"><i class="fa-solid fa-pen text-xs text-gray-400 mr-1"></i> <span class="font-bold text-purple-900">${f.formula_name}</span></td>
                <td class="pt-3 font-mono text-[11px] text-blue-800 bg-blue-50 p-1 rounded">Min: ${f.formula_min||'--'}<br>Max: ${f.formula_max||'--'}</td>
                <td class="pt-3 text-xs text-red-600">單:${f.single_max||'--'} ${f.single_max_unit||''}<br>日:${f.daily_max||'--'} ${f.daily_max_unit||''}</td>
                <td class="pt-3">
                    <button onclick="goToFormulaEdit('${actualDrugId}', '${f.formula_id}')" class="text-blue-600 hover:text-blue-800 mr-2 font-bold text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200"><i class="fa-solid fa-pen"></i> 編輯</button>
                    <button onclick="deleteRecord('deleteFormula', '${f.formula_id}')" class="text-red-500 hover:text-red-700 text-xs px-2 py-1"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
};

window.toggleDrugStatus = async function(drugId, currentStatus, event) {
    event.stopPropagation();
    const newStatus = currentStatus === 'Y' ? 'N' : 'Y';
    const d = STORE.drugs.find(x => x.drug_id === drugId);
    if(!d) return;
    
    event.currentTarget.innerText = '處理中...';
    event.currentTarget.disabled = true;

    const payload = { 
        action: 'saveDrug', mode: 'edit', drug_id: d.drug_id, status: newStatus,
        domain: d.domain, cat_1: d.cat_1, cat_2: d.cat_2, cat_3: d.cat_3,
        local_name: d.local_name, brand_name: d.brand_name, common_brand: d.common_brand,
        generic_name: d.generic_name, ingredients: d.ingredients, dose_instruction: d.dose_instruction,
        supplemental_info: d.supplemental_info, reference_url: d.reference_url,
        drug_code: d.drug_code, can_crush: d.can_crush, form: d.form, related_drugs: d.related_drugs
    };
    await sendPost(payload); 
};

window.returnToDashboard = function() {
    switchTab('dashboard');
    scrollToTop();
};

window.goToAddDrug = function() {
    resetDrugForm();
    document.getElementById('drug-form-title').innerText = "新增藥品";
    switchTab('drugs');
    scrollToTop();
};

window.goToDrugView = function(drugId) {
    viewDrug(drugId);
};

window.setupDrugCategorySelects = function() {
    const c1 = document.getElementById('drug-cat1'), c2 = document.getElementById('drug-cat2'), c3 = document.getElementById('drug-cat3');
    if(!c1) return;
    const cat1s = [...new Set(STORE.categories.map(c => c.cat_1).filter(Boolean))];
    c1.innerHTML = '<option value="">-- 可空白 --</option>'; cat1s.forEach(c => c1.add(new Option(c, c)));
    c1.onchange = () => {
        c2.innerHTML = '<option value="">--請選擇--</option>'; c3.innerHTML = '<option value="">--請選擇--</option>';
        if (c1.value) {
            const cat2s = [...new Set(STORE.categories.filter(c => c.cat_1 === c1.value).map(c => c.cat_2).filter(Boolean))];
            cat2s.forEach(c => c2.add(new Option(c, c))); c2.disabled = false;
        } else c2.disabled = true; c3.disabled = true;
    };
    c2.onchange = () => {
        c3.innerHTML = '<option value="">--請選擇--</option>';
        if (c2.value) {
            const cat3s = [...new Set(STORE.categories.filter(c => c.cat_1 === c1.value && c.cat_2 === c2.value).map(c => c.cat_3).filter(Boolean))];
            cat3s.forEach(c => c3.add(new Option(c, c))); c3.disabled = false;
        } else c3.disabled = true;
    };
};

window.viewDrug = function(drugId) {
    const d = STORE.drugs.find(x => String(x.drug_id) === String(drugId) || String(x.drug_code) === String(drugId)); 
    if(!d) return;

    switchTab('drugs');
    document.getElementById('drug-form-title').innerText = "編輯藥品基本檔";

    document.getElementById('drug-mode').value = 'edit'; 
    document.getElementById('drug-id').value = d.drug_id;
    document.getElementById('drug-domain').value = d.domain || 'PED';

    const c1 = document.getElementById('drug-cat1'), c2 = document.getElementById('drug-cat2'), c3 = document.getElementById('drug-cat3');
    c1.value = d.cat_1 || ''; c1.dispatchEvent(new Event('change')); 
    c2.value = d.cat_2 || ''; c2.dispatchEvent(new Event('change')); 
    c3.value = d.cat_3 || '';
    
    document.getElementById('drug-local').value = d.local_name || '';
    document.getElementById('drug-brand').value = d.brand_name || '';
    document.getElementById('drug-common-brand').value = d.common_brand || '';
    document.getElementById('drug-generic').value = d.generic_name || '';
    document.getElementById('drug-ingred').value = d.ingredients || '';
    document.getElementById('drug-dose-inst').value = d.dose_instruction || '';
    document.getElementById('drug-supplemental').value = d.supplemental_info || '';
    document.getElementById('drug-url').value = d.reference_url || '';
    document.getElementById('drug-code').value = d.drug_code || '';
    document.getElementById('drug-status').value = d.status || 'Y';
    document.getElementById('drug-can-crush').value = d.can_crush || '';
    document.getElementById('drug-form').value = d.form || '';
    
    stateTags.relatedDrugs = d.related_drugs ? d.related_drugs.split(',').filter(Boolean) : [];
    renderTagsUI('relatedDrugs');

    if (document.getElementById('drug-fieldset')) document.getElementById('drug-fieldset').disabled = false; 
    if (document.getElementById('btn-save-drug')) {
        document.getElementById('btn-save-drug').classList.remove('hidden');
        document.getElementById('btn-save-drug').innerText = "更新儲存"; 
    }
    
    if (document.getElementById('btn-edit-drug-mode')) document.getElementById('btn-edit-drug-mode').classList.add('hidden');
    if (document.getElementById('btn-manage-formula')) document.getElementById('btn-manage-formula').classList.remove('hidden'); 
    
    if (typeof renderCurrentDrugFormulas === 'function') renderCurrentDrugFormulas(d.drug_id, d.drug_code);
    if (document.getElementById('drug-formulas-section')) document.getElementById('drug-formulas-section').classList.remove('hidden');

    scrollToTop();
};

window.resetDrugForm = function() {
    document.getElementById('drug-mode').value = 'add'; 
    document.getElementById('drug-id').value = '';
    document.getElementById('drug-domain').value = 'PED';
    
    const c1 = document.getElementById('drug-cat1'), c2 = document.getElementById('drug-cat2'), c3 = document.getElementById('drug-cat3');
    c1.value = ''; c2.value = ''; c3.value = '';
    c2.disabled = true; c3.disabled = true;

    document.getElementById('drug-local').value = '';
    document.getElementById('drug-brand').value = '';
    document.getElementById('drug-common-brand').value = '';
    document.getElementById('drug-generic').value = '';
    document.getElementById('drug-ingred').value = '';
    document.getElementById('drug-dose-inst').value = '';
    document.getElementById('drug-supplemental').value = '';
    document.getElementById('drug-url').value = '';
    document.getElementById('drug-code').value = '';
    document.getElementById('drug-status').value = 'Y';
    document.getElementById('drug-can-crush').value = '';
    document.getElementById('drug-form').value = '';
    
    stateTags.relatedDrugs = []; renderTagsUI('relatedDrugs');
    if(document.getElementById('input-relatedDrugs')) document.getElementById('input-relatedDrugs').value = '';

    if (document.getElementById('drug-fieldset')) document.getElementById('drug-fieldset').disabled = false;
    if (document.getElementById('btn-edit-drug-mode')) document.getElementById('btn-edit-drug-mode').classList.add('hidden');
    if (document.getElementById('btn-manage-formula')) document.getElementById('btn-manage-formula').classList.add('hidden'); 
    
    if (document.getElementById('btn-save-drug')) {
        document.getElementById('btn-save-drug').classList.remove('hidden');
        document.getElementById('btn-save-drug').innerText = "儲存新藥品"; 
    }
    
    if (document.getElementById('drug-formulas-section')) document.getElementById('drug-formulas-section').classList.add('hidden');
};

window.saveDrug = async function() {
    const payload = { 
        action: 'saveDrug', mode: document.getElementById('drug-mode').value, drug_id: document.getElementById('drug-id').value, status: document.getElementById('drug-status').value,
        domain: document.getElementById('drug-domain').value, cat_1: document.getElementById('drug-cat1').value, cat_2: document.getElementById('drug-cat2').value, cat_3: document.getElementById('drug-cat3').value,
        local_name: document.getElementById('drug-local').value.trim(), brand_name: document.getElementById('drug-brand').value.trim(), common_brand: document.getElementById('drug-common-brand').value.trim(),
        generic_name: document.getElementById('drug-generic').value.trim(), ingredients: document.getElementById('drug-ingred').value.trim(), dose_instruction: document.getElementById('drug-dose-inst').value.trim(),
        supplemental_info: document.getElementById('drug-supplemental').value.trim(), reference_url: document.getElementById('drug-url').value.trim(),
        drug_code: document.getElementById('drug-code').value.trim(), can_crush: document.getElementById('drug-can-crush').value, form: document.getElementById('drug-form').value,
        related_drugs: stateTags.relatedDrugs.join(',')
    };
    
    if(!payload.drug_code || !payload.generic_name || !payload.domain) return alert("請務必填寫：【所屬科別】、【藥品代碼】與【一般名稱(原學名)】！");
    await sendPost(payload); 
    returnToDashboard(); 
};

window.removeCustomTag = function(type, val) {
    if(document.getElementById('drug-fieldset') && document.getElementById('drug-fieldset').disabled) return;
    stateTags[type] = stateTags[type].filter(v => v !== val); renderTagsUI(type);
};
window.addCustomTag = function(type, val) {
    if (!stateTags[type].includes(val)) { stateTags[type].push(val); renderTagsUI(type); }
    const input = document.getElementById(`input-${type}`); input.value = ''; document.getElementById(`drop-${type}`).classList.add('hidden'); input.focus();
};
window.renderTagsUI = function(type) {
    const container = document.getElementById(`tags-${type}`);
    if(container) {
        container.innerHTML = stateTags[type].map(val => `<span class="bg-blue-50 border border-blue-200 text-blue-800 rounded px-2 py-0.5 text-xs flex items-center gap-1 shadow-sm">${val} <i class="fa-solid fa-xmark cursor-pointer text-blue-400 hover:text-red-500" onclick="removeCustomTag('${type}', '${val.replace(/'/g, "\\'")}')"></i></span>`).join('');
    }
};

window.setupDrugDropdowns = function() {
    const fSel = document.getElementById('drug-form');
    if(!fSel) return;
    fSel.innerHTML = '<option value="">-- 可空白 --</option>'; STORE.forms.forEach(f => fSel.add(new Option(f.form_name, f.form_name)));

    const input = document.getElementById(`input-relatedDrugs`), drop = document.getElementById(`drop-relatedDrugs`);
    if(!input || !drop) return;

    const newDrop = drop.cloneNode(true); drop.parentNode.replaceChild(newDrop, drop);
    const newInput = input.cloneNode(true); input.parentNode.replaceChild(newInput, input);
    const finalInput = document.getElementById(`input-relatedDrugs`), finalDrop = document.getElementById(`drop-relatedDrugs`);

    const updateDrop = () => {
        const keyword = finalInput.value.toLowerCase().trim();
        const keywords = keyword ? keyword.split(/\s+/) : [];
        
        const filtered = STORE.drugs.filter(item => {
            if(keywords.length === 0) return true;
            const searchStr = `${item.drug_code||''} ${item.local_name||''} ${item.generic_name||''} ${item.brand_name||''} ${item.common_brand||''}`.toLowerCase();
            return keywords.every(kw => searchStr.includes(kw));
        });
        
        const html = filtered.map(item => {
            const val = item.local_name||item.generic_name;
            // 【優化】關聯藥品下拉選單顯示豐富資訊
            const label = `<span class="text-orange-600 font-bold mr-1">${item.drug_code||''}</span> <span class="text-blue-900 font-bold">${item.generic_name||''}</span> <span class="text-gray-500 text-xs ml-1">${item.local_name||''} ${item.brand_name||''}</span>`;
            
            if (stateTags.relatedDrugs.includes(val)) return ''; 
            return `<div class="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 truncate" onclick="addCustomTag('relatedDrugs', '${val.replace(/'/g, "\\'")}')">${label}</div>`;
        }).join('');
        finalDrop.innerHTML = html || '<div class="p-2 text-xs text-gray-500 text-center">無符合資料</div>';
        finalDrop.classList.remove('hidden');
    };

    finalInput.addEventListener('focus', () => { if(document.getElementById('drug-fieldset') && document.getElementById('drug-fieldset').disabled) return; updateDrop(); });
    finalInput.addEventListener('input', updateDrop);
    document.addEventListener('click', (e) => { if (!finalInput.contains(e.target) && !finalDrop.contains(e.target)) finalDrop.classList.add('hidden'); });
};
