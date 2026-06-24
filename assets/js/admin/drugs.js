document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('btn-save-drug')) document.getElementById('btn-save-drug').onclick = saveDrug;
});

window.debounce = function(func, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, delay);
    };
};

window.setupDrugListFilters = function() {
    const dc1 = document.getElementById('list-dash-cat1');
    const dfm = document.getElementById('list-dash-form');
    const dst = document.getElementById('list-dash-status');
    const dd = document.getElementById('list-dash-domain');
    const df = document.getElementById('filter-dash-drugs');

    if(dc1) {
        const cat1s = [...new Set(STORE.categories.map(c => c.cat_1).filter(Boolean))];
        dc1.innerHTML = '<option value="">-- 所有分類 --</option>'; 
        cat1s.forEach(c => dc1.add(new Option(c, c)));
        dc1.addEventListener('change', renderDrugsList);
    }
    if(dfm) {
        const forms = [...new Set(STORE.drugs.map(d => d.form).filter(Boolean))].sort();
        dfm.innerHTML = '<option value="">-- 所有劑型 --</option>';
        forms.forEach(f => dfm.add(new Option(f, f)));
        dfm.addEventListener('change', renderDrugsList);
    }
    if(dst) dst.addEventListener('change', renderDrugsList);
    if(dd) dd.addEventListener('change', renderDrugsList);
    if(df) df.addEventListener('input', window.debounce(renderDrugsList, 300));
};

window.renderDrugsList = function() {
    const dashList = document.getElementById('list-dash-drugs');
    if (!dashList) return;
    
    const fd = document.getElementById('list-dash-domain') ? document.getElementById('list-dash-domain').value : '';
    const fc1 = document.getElementById('list-dash-cat1') ? document.getElementById('list-dash-cat1').value : '';
    const ffm = document.getElementById('list-dash-form') ? document.getElementById('list-dash-form').value : '';
    const fst = document.getElementById('list-dash-status') ? document.getElementById('list-dash-status').value : '';
    const fText = document.getElementById('filter-dash-drugs') ? document.getElementById('filter-dash-drugs').value.toLowerCase().trim() : '';
    
    const dashKeywords = fText ? fText.split(/\s+/) : [];

    const dashDrugs = STORE.drugs.filter(d => {
        if (fd && (d.domain || 'PED') !== fd) return false;
        if (fc1 && d.cat_1 !== fc1) return false;
        if (ffm && d.form !== ffm) return false;
        if (fst && (d.status || 'N') !== fst) return false;
        
        if (dashKeywords.length > 0) {
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
            <td class="pt-3 flex gap-2 flex-wrap">
                <button onclick="goToDrugView('${d.drug_id}')" class="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200"><i class="fa-solid fa-pen"></i> 編輯藥品</button>
                <button onclick="goToAddFormula('${d.drug_id}')" class="text-purple-600 hover:text-purple-800 font-bold text-xs bg-purple-50 px-2 py-1 rounded border border-purple-200"><i class="fa-solid fa-plus"></i> 新增公式</button>
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
    dashDrugs.forEach(d => { 
        validIds.add(String(d.drug_id).trim().toLowerCase()); 
        if (d.drug_code) validIds.add(String(d.drug_code).trim().toLowerCase()); 
    });

    const dashFormulas = STORE.formulas.filter(f => validIds.has(String(f.drug_id).trim().toLowerCase()));

    dashFormulasList.innerHTML = dashFormulas.length === 0 ? 
        `<tr><td colspan="5" class="text-center text-gray-400 py-4">目前篩選條件下無對應公式</td></tr>` :
        dashFormulas.map(f => {
            const targetId = String(f.drug_id).trim().toLowerCase();
            const d = dashDrugs.find(x => String(x.drug_id).trim().toLowerCase() === targetId || String(x.drug_code).trim().toLowerCase() === targetId); 
            const actualDrugId = d ? d.drug_id : f.drug_id;
            
            let drugNameHtml = `<div class="text-red-400 font-bold">遺失藥品關聯<br/><span class="text-xs text-gray-400">(${f.drug_id})</span></div>`;
            if (d) {
                drugNameHtml = `
                    <div class="font-bold text-orange-600 mb-1 text-[13px]">${d.drug_code||'--'}</div>
                    <div class="font-bold text-blue-900 leading-tight mb-1">${d.generic_name||'無學名'}</div>
                    <div class="text-[11px] text-gray-600 leading-tight flex flex-col gap-0.5">
                        <div><span class="font-bold text-gray-400">中:</span> ${d.local_name||'--'}</div>
                        <div><span class="font-bold text-gray-400">商:</span> ${d.brand_name||'--'}</div>
                    </div>`;
            }

            return `<tr class="hover:bg-purple-50 transition">
                <td class="pt-3">${drugNameHtml}</td>
                <td class="pt-3"><i class="fa-solid fa-pen text-xs text-gray-400 mr-1"></i> <span class="font-bold text-purple-900">${f.formula_name}</span></td>
                <td class="pt-3 font-mono text-[11px] text-blue-800 bg-blue-50 p-1 rounded">Min: ${f.formula_min||'--'}<br>Max: ${f.formula_max||'--'}</td>
                <td class="pt-3 text-xs text-red-600">單:${f.single_max||'--'} ${f.single_max_unit||''}<br>日:${f.daily_max||'--'} ${f.daily_max_unit||''}</td>
                <td class="pt-3 flex gap-2">
                    <button onclick="goToFormulaEdit('${actualDrugId}', '${f.formula_id}')" class="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200"><i class="fa-solid fa-pen"></i> 編輯</button>
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

// 【優化核心】公式專屬排序維護（支援 HTML5 拖拉自動同步）
window.renderCurrentDrugFormulas = function(drugId, drugCode) {
    const localFormulas = STORE.formulas.filter(f => f.drug_id === drugId || (drugCode && f.drug_id === drugCode));
    const container = document.getElementById('list-current-drug-formulas');
    if(!container) return;
    
    if(localFormulas.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-4">此藥品尚未建立任何公式</td></tr>`;
        return;
    }

    container.innerHTML = localFormulas.map(f => `
        <tr class="cursor-move hover:bg-purple-50/50 transition drag-row" draggable="true" data-fid="${f.formula_id}">
            <td class="text-gray-400 text-center"><i class="fa-solid fa-bars"></i></td>
            <td class="font-bold text-purple-900"><i class="fa-solid fa-pen text-xs text-purple-300 mr-1"></i> ${f.formula_name}</td>
            <td class="font-mono text-[11px] text-blue-800 bg-blue-50/50 p-1 rounded">Min: ${f.formula_min||'--'}<br>Max: ${f.formula_max||'--'}</td>
            <td class="text-xs text-red-600">單:${f.single_max||'--'} ${f.single_max_unit||''}<br>日:${f.daily_max||'--'} ${f.daily_max_unit||''}</td>
            <td onclick="event.stopPropagation()"><button onclick="deleteRecord('deleteFormula', '${f.formula_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`).join('');

    // 綁定原生拖拉排序事件監聽器
    let dragSourceEl = null;
    const rows = container.querySelectorAll('.drag-row');
    
    rows.forEach(row => {
        row.addEventListener('dragstart', (e) => {
            dragSourceEl = row;
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('bg-purple-100', 'opacity-50');
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            return false;
        });

        row.addEventListener('dragenter', (e) => {
            row.classList.add('border-t-2', 'border-purple-500');
        });

        row.addEventListener('dragleave', (e) => {
            row.classList.remove('border-t-2', 'border-purple-500');
        });

        row.addEventListener('drop', async (e) => {
            e.stopPropagation();
            row.classList.remove('border-t-2', 'border-purple-500');
            
            if (dragSourceEl !== row) {
                // 交換 DOM 節點位置
                if (row.nextSibling === dragSourceEl) {
                    container.insertBefore(dragSourceEl, row);
                } else {
                    container.insertBefore(dragSourceEl, row.nextSibling);
                }
                
                // 收集排序完畢後的全新 ID 陣列
                const orderedIds = [];
                container.querySelectorAll('.drag-row').forEach(r => {
                    orderedIds.push(r.getAttribute('data-fid'));
                });

                // 自動安靜地非同步儲存至 Google 試算表，不再跳彈窗打斷藥師
                const originalText = container.previousElementSibling ? container.parentElement.parentElement.querySelector('span').innerHTML : '';
                const spanTitle = container.parentElement.parentElement.querySelector('span');
                if(spanTitle) spanTitle.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-purple-600 mr-1"></i> 正在儲存全新公式排序...`;
                
                await sendPost({ action: 'reorderFormulas', ordered_ids: orderedIds });
                
                if(spanTitle) spanTitle.innerHTML = `<i class="fa-solid fa-circle-check text-green-500 mr-1"></i> 排序已自動儲存成功！`;
                setTimeout(() => { if(spanTitle) spanTitle.innerHTML = originalText; }, 2000);
            }
            return false;
        });

        row.addEventListener('dragend', () => {
            row.classList.remove('bg-purple-100', 'opacity-50');
            rows.forEach(r => r.classList.remove('border-t-2', 'border-purple-500'));
        });
    });
};

window.enableDrugEditMode = function() {
    document.getElementById('drug-fieldset').disabled = false;
    document.getElementById('btn-edit-drug-mode').classList.add('hidden');
    document.getElementById('btn-save-drug').classList.remove('hidden');
    document.getElementById('btn-save-drug').innerText = "更新儲存";
};

window.jumpToFormula = function() {
    const drugId = document.getElementById('drug-id').value;
    if(drugId) window.goToAddFormula(drugId);
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
            const label = `<span class="text-orange-600 font-bold mr-1">${item.drug_code||''}</span> <span class="text-blue-900 font-bold">${item.generic_name||''}</span> <span class="text-gray-500 text-xs ml-1">${item.local_name||''} ${item.brand_name||''}</span>`;
            
            if (stateTags.relatedDrugs.includes(val)) return ''; 
            return `<div class="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 truncate" onclick="addCustomTag('relatedDrugs', '${val.replace(/'/g, "\\'")}')">${label}</div>`;
        }).join('');
        finalDrop.innerHTML = html || '<div class="p-2 text-xs text-gray-500 text-center">無符合資料</div>';
        finalDrop.classList.remove('hidden');
    };

    finalInput.addEventListener('focus', () => { if(document.getElementById('drug-fieldset') && document.getElementById('drug-fieldset').disabled) return; updateDrop(); });
    finalInput.addEventListener('input', window.debounce(updateDrop, 300));
    document.addEventListener('click', (e) => { if (!finalInput.contains(e.target) && !finalDrop.contains(e.target)) finalDrop.classList.add('hidden'); });
};
