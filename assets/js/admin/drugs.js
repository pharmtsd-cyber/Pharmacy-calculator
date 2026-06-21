document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('btn-save-drug')) document.getElementById('btn-save-drug').onclick = saveDrug;
    if(document.getElementById('btn-cancel-drug')) document.getElementById('btn-cancel-drug').onclick = resetDrugForm;
    if(document.getElementById('filter-drugs')) document.getElementById('filter-drugs').addEventListener('input', renderDrugsList);
});

window.setupDrugListFilters = function() {
    const lc1 = document.getElementById('list-cat1'), lc2 = document.getElementById('list-cat2'), lc3 = document.getElementById('list-cat3');
    if(!lc1) return;
    const cat1s = [...new Set(STORE.categories.map(c => c.cat_1).filter(Boolean))];
    lc1.innerHTML = '<option value="">-- 第一層分類篩選 --</option>'; 
    cat1s.forEach(c => lc1.add(new Option(c, c)));
    
    lc1.addEventListener('change', () => {
        lc2.innerHTML = '<option value="">-- 第二層分類篩選 --</option>'; lc3.innerHTML = '<option value="">-- 第三層分類篩選 --</option>';
        if (lc1.value) {
            const cat2s = [...new Set(STORE.categories.filter(c => c.cat_1 === lc1.value).map(c => c.cat_2).filter(Boolean))];
            cat2s.forEach(c => lc2.add(new Option(c, c))); lc2.disabled = false;
        } else lc2.disabled = true;
        lc3.disabled = true; renderDrugsList();
    });
    
    lc2.addEventListener('change', () => {
        lc3.innerHTML = '<option value="">-- 第三層分類篩選 --</option>';
        if (lc2.value) {
            const cat3s = [...new Set(STORE.categories.filter(c => c.cat_1 === lc1.value && c.cat_2 === lc2.value).map(c => c.cat_3).filter(Boolean))];
            cat3s.forEach(c => lc3.add(new Option(c, c))); lc3.disabled = false;
        } else lc3.disabled = true;
        renderDrugsList();
    });
    
    lc3.addEventListener('change', renderDrugsList);
};

window.renderDrugsList = function() {
    if (!document.getElementById('list-drugs')) return;
    const fDrugs = document.getElementById('filter-drugs').value.toLowerCase();
    const lc1 = document.getElementById('list-cat1').value, lc2 = document.getElementById('list-cat2').value, lc3 = document.getElementById('list-cat3');

    const filteredDrugs = STORE.drugs.filter(d => {
        if (lc1 && d.cat_1 !== lc1) return false;
        if (lc2 && d.cat_2 !== lc2) return false;
        if (lc3 && d.cat_3 !== lc3) return false;
        if (fDrugs) {
            const searchStr = ((d.drug_code||'')+(d.local_name||'')+(d.generic_name||'')+(d.brand_name||'')+(d.common_brand||'')+(d.cat_1||'')).toLowerCase();
            if (!searchStr.includes(fDrugs)) return false;
        }
        return true;
    });

    document.getElementById('drug-list-count').innerText = filteredDrugs.length;

    document.getElementById('list-drugs').innerHTML = filteredDrugs.map(d => `
        <tr class="cursor-pointer hover:bg-blue-50 transition" onclick="viewDrug('${d.drug_id}')">
            <td><div class="font-bold text-orange-600 mb-1">${d.drug_code||'--'}</div><span class="bg-blue-100 text-blue-800 text-[10px] px-1 rounded">${d.cat_1||''}</span>${d.cat_2 ? `<i class="fa-solid fa-angle-right text-[10px] mx-1 text-gray-400"></i><span class="bg-blue-50 text-blue-800 text-[10px] px-1 rounded">${d.cat_2}</span>` : ''}</td>
            <td><div class="font-bold text-blue-900">${d.generic_name||'無學名'}</div><div class="text-[10px] text-gray-500">${d.local_name||''} ${d.common_brand?'('+d.common_brand+')':''}</div></td>
            <td><span class="${d.status==='Y'?'text-green-600':'text-red-500'} font-bold">${d.status}</span></td>
            <td onclick="event.stopPropagation()">
                <button onclick="openFormulaManager('${d.drug_id}')" class="text-purple-600 hover:text-purple-800 mr-3 font-bold text-xs bg-purple-50 px-2 py-1 rounded border border-purple-200" title="管理專屬公式"><i class="fa-solid fa-flask"></i> 公式 (${STORE.formulas.filter(f => f.drug_id === d.drug_id).length})</button>
                <button onclick="deleteRecord('deleteDrug', '${d.drug_id}')" class="text-red-500 hover:text-red-700" title="刪除藥品"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`).join('');
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
    const d = STORE.drugs.find(x => x.drug_id === drugId);
    if(!d) return;

    document.getElementById('drug-mode').value = 'edit'; 
    document.getElementById('drug-id').value = d.drug_id;
    
    const c1 = document.getElementById('drug-cat1'), c2 = document.getElementById('drug-cat2'), c3 = document.getElementById('drug-cat3');
    c1.value = d.cat_1 || ''; c1.dispatchEvent(new Event('change')); 
    c2.value = d.cat_2 || ''; c2.dispatchEvent(new Event('change')); 
    c3.value = d.cat_3 || '';
    
    // 直白指定欄位，避免 forEach 解析錯誤
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

    document.getElementById('drug-fieldset').disabled = true;
    document.getElementById('btn-edit-drug-mode').classList.remove('hidden');
    document.getElementById('btn-save-drug').classList.add('hidden');
    document.getElementById('btn-cancel-drug').classList.remove('hidden'); 
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.enableDrugEditMode = function() {
    document.getElementById('drug-fieldset').disabled = false;
    document.getElementById('btn-edit-drug-mode').classList.add('hidden');
    document.getElementById('btn-save-drug').classList.remove('hidden');
    document.getElementById('btn-save-drug').innerText = "更新儲存";
};

window.resetDrugForm = function() {
    document.getElementById('drug-mode').value = 'add'; 
    document.getElementById('drug-id').value = '';
    
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

    document.getElementById('drug-fieldset').disabled = false;
    document.getElementById('btn-edit-drug-mode').classList.add('hidden');
    document.getElementById('btn-save-drug').classList.remove('hidden');
    document.getElementById('btn-save-drug').innerText = "儲存藥品"; 
    document.getElementById('btn-cancel-drug').classList.add('hidden');
};

window.saveDrug = async function() {
    const payload = { 
        action: 'saveDrug', mode: document.getElementById('drug-mode').value, drug_id: document.getElementById('drug-id').value, status: document.getElementById('drug-status').value,
        cat_1: document.getElementById('drug-cat1').value, cat_2: document.getElementById('drug-cat2').value, cat_3: document.getElementById('drug-cat3').value,
        local_name: document.getElementById('drug-local').value.trim(), brand_name: document.getElementById('drug-brand').value.trim(), common_brand: document.getElementById('drug-common-brand').value.trim(),
        generic_name: document.getElementById('drug-generic').value.trim(), ingredients: document.getElementById('drug-ingred').value.trim(), dose_instruction: document.getElementById('drug-dose-inst').value.trim(),
        supplemental_info: document.getElementById('drug-supplemental').value.trim(), reference_url: document.getElementById('drug-url').value.trim(),
        drug_code: document.getElementById('drug-code').value.trim(), can_crush: document.getElementById('drug-can-crush').value, form: document.getElementById('drug-form').value,
        related_drugs: stateTags.relatedDrugs.join(',')
    };
    
    if(!payload.drug_code || !payload.generic_name) return alert("請務必填寫：【藥品代碼】與【一般名稱(原學名)】！");
    await sendPost(payload); resetDrugForm();
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
        const keyword = finalInput.value.toLowerCase();
        const filtered = STORE.drugs.filter(item => (`${item.drug_code||''} ${item.local_name||item.generic_name}`).toLowerCase().includes(keyword));
        const html = filtered.map(item => {
            const val = item.local_name||item.generic_name, label = `${item.drug_code||''} ${val}`.trim();
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
