window.renderSystemLists = function() {
    const fStaff = document.getElementById('filter-staff') ? document.getElementById('filter-staff').value.toLowerCase() : '';
    const fParams = document.getElementById('filter-params') ? document.getElementById('filter-params').value.toLowerCase() : '';
    const fCats = document.getElementById('filter-cats') ? document.getElementById('filter-cats').value.toLowerCase() : '';

    if (document.getElementById('list-staff')) {
        document.getElementById('list-staff').innerHTML = STORE.staff.filter(s => (s.name||'').toLowerCase().includes(fStaff) || String(s.emp_id).includes(fStaff))
            .map(s => `<tr><td>${s.emp_id}</td><td>${s.name}</td><td>${s.role}</td><td><span class="${s.status==='Y'?'text-green-600':'text-red-500'}">${s.status}</span></td>
                <td>${(CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'Programmer') ? `<button onclick="deleteRecord('deleteStaff', '${s.emp_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>` : ''}</td></tr>`).join('');
    }

    if (document.getElementById('list-params')) {
        document.getElementById('list-params').innerHTML = STORE.parameters.filter(p => (p.param_code||'').toLowerCase().includes(fParams) || (p.param_name||'').toLowerCase().includes(fParams))
            .map(p => `<tr><td>${p.param_code}</td><td>${p.param_name}</td><td>${p.default_unit}</td>
                <td><button onclick="editParameter('${p.param_code}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteParameter', '${p.param_code}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
    }

    if (document.getElementById('list-categories')) {
        document.getElementById('list-categories').innerHTML = STORE.categories.filter(c => ((c.cat_1||'')+(c.cat_2||'')+(c.cat_3||'')).toLowerCase().includes(fCats))
            .map(c => `<tr><td>${c.cat_1}</td><td>${c.cat_2||''}</td><td>${c.cat_3||''}</td>
                <td><button onclick="editCategory('${c.cat_id}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteCategory', '${c.cat_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
    }

    if (document.getElementById('list-announcements')) {
        document.getElementById('list-announcements').innerHTML = STORE.announcements.sort((a,b) => new Date(b.date) - new Date(a.date)).map(a => `<tr>
                <td>${a.is_pinned==='Y' ? '<i class="fa-solid fa-star text-yellow-500"></i>' : ''}</td><td>${a.version}</td><td>${a.date ? new Date(a.date).toLocaleDateString() : ''}</td><td class="whitespace-pre-wrap">${a.content}</td>
                <td><button onclick="editAnnouncement('${a.announce_id}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteAnnouncement', '${a.announce_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
    }

    if (document.getElementById('list-forms')) {
        document.getElementById('list-forms').innerHTML = STORE.forms.map(f => `<tr><td>${f.form_name}</td>
            <td><button onclick="editForm('${f.form_id}', '${f.form_name}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRecord('deleteForm', '${f.form_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
    }

    if (document.getElementById('list-feedbacks')) {
        document.getElementById('list-feedbacks').innerHTML = (STORE.feedbacks || []).sort((a,b) => new Date(b.date) - new Date(a.date)).map(f => `<tr>
                <td class="text-xs text-gray-500">${new Date(f.date).toLocaleDateString()}</td>
                <td class="font-bold text-blue-800">${f.drug_info}</td>
                <td class="whitespace-pre-wrap">${f.content}</td>
                <td><select onchange="updateFeedbackStatus('${f.feedback_id}', this.value)" class="border rounded p-1 text-xs ${f.status==='已解決'?'bg-green-100 text-green-800':(f.status==='處理中'?'bg-yellow-100 text-yellow-800':'bg-red-100 text-red-800')}">
                        <option value="未處理" ${f.status==='未處理'?'selected':''}>未處理</option>
                        <option value="處理中" ${f.status==='處理中'?'selected':''}>處理中</option>
                        <option value="已解決" ${f.status==='已解決'?'selected':''}>已解決</option>
                    </select></td>
                <td><button onclick="deleteRecord('deleteFeedback', '${f.feedback_id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
    }
};

window.updateFeedbackStatus = async function(id, status) {
    await sendPost({ action: 'saveFeedback', mode: 'edit', feedback_id: id, status: status });
};

document.addEventListener('DOMContentLoaded', () => {
    const bind = (id, fn) => { if(document.getElementById(id)) document.getElementById(id).onclick = fn; };
    
    // 員工存檔
    bind('btn-save-staff', async () => {
        const id = document.getElementById('staff-id').value.trim(), name = document.getElementById('staff-name').value.trim();
        if(!id || !name) return alert("必填"); if(STORE.staff.some(s => String(s.emp_id) === String(id))) return alert("員編已存在");
        await sendPost({ action: 'saveStaff', emp_id: id, name: name, role: document.getElementById('staff-role').value, status: document.getElementById('staff-status').value });
        document.getElementById('staff-id').value = ''; document.getElementById('staff-name').value = '';
    });
    
    // 參數存檔
    bind('btn-save-param', async () => {
        const mode = document.getElementById('param-mode').value, code = document.getElementById('param-code').value.trim(), name = document.getElementById('param-name').value.trim();
        if(!code || !name) return alert("必填"); if(!/^[a-zA-Z0-9_]+$/.test(code)) return alert("代碼限英文與底線");
        if(mode === 'add' && STORE.parameters.some(p => p.param_code === code)) return alert("代碼已存在");
        await sendPost({ action: 'saveParameter', mode: mode, param_code: code, param_name: name, default_unit: document.getElementById('param-unit').value }); 
        document.getElementById('btn-cancel-param').click();
    });
    bind('btn-cancel-param', () => {
        document.getElementById('param-mode').value = 'add'; document.getElementById('param-code').value = ''; document.getElementById('param-code').disabled = false;
        document.getElementById('param-name').value = ''; document.getElementById('param-unit').value = '';
        document.getElementById('btn-save-param').innerText = "新增參數"; document.getElementById('btn-cancel-param').classList.add('hidden');
    });

    // 公告存檔
    bind('btn-save-anno', async () => {
        const payload = { action: 'saveAnnouncement', mode: document.getElementById('anno-mode').value, announce_id: document.getElementById('anno-id').value, version: document.getElementById('anno-version').value, date: document.getElementById('anno-date').value, is_pinned: document.getElementById('anno-pinned').value, content: document.getElementById('anno-content').value };
        if(!payload.version || !payload.date || !payload.content) return alert("必填不可空白");
        await sendPost(payload); document.getElementById('btn-cancel-anno').click();
    });
    bind('btn-cancel-anno', () => {
        document.getElementById('anno-mode').value = 'add'; document.getElementById('anno-id').value = '';
        ['version', 'date', 'content'].forEach(id => document.getElementById('anno-'+id).value = ''); document.getElementById('anno-pinned').value = 'N';
        document.getElementById('btn-save-anno').innerText = "新增公告"; document.getElementById('btn-cancel-anno').classList.add('hidden');
    });

    // 分類存檔
    bind('btn-save-cat', async () => {
        const payload = { action: 'saveCategory', mode: document.getElementById('cat-mode').value, cat_id: document.getElementById('cat-id').value, cat_1: document.getElementById('cat-level1').value.trim(), cat_2: document.getElementById('cat-level2').value.trim(), cat_3: document.getElementById('cat-level3').value.trim() };
        if(!payload.cat_1) return alert("第一層分類為必填");
        await sendPost(payload); document.getElementById('btn-cancel-cat').click();
    });
    bind('btn-cancel-cat', () => {
        document.getElementById('cat-mode').value = 'add'; document.getElementById('cat-id').value = '';
        ['level1', 'level2', 'level3'].forEach(id => document.getElementById('cat-'+id).value = '');
        document.getElementById('btn-save-cat').innerText = "新增分類組合"; document.getElementById('btn-cancel-cat').classList.add('hidden');
    });

    // 劑型存檔
    bind('btn-save-form', async () => {
        const name = document.getElementById('form-name').value.trim();
        if(!name) return alert("名稱必填");
        await sendPost({ action: 'saveForm', mode: document.getElementById('form-mode').value, form_id: document.getElementById('form-id').value, form_name: name }); 
        document.getElementById('btn-cancel-form').click();
    });
    bind('btn-cancel-form', () => {
        document.getElementById('form-mode').value = 'add'; document.getElementById('form-id').value = ''; document.getElementById('form-name').value = '';
        document.getElementById('btn-save-form').innerText = "新增劑型"; document.getElementById('btn-cancel-form').classList.add('hidden');
    });
    
    // 即時搜尋綁定
    ['filter-staff', 'filter-params', 'filter-cats'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).addEventListener('input', renderSystemLists);
    });
});

window.editParameter = function(code) {
    const p = STORE.parameters.find(x => x.param_code === code);
    if(!p) return;
    document.getElementById('param-mode').value = 'edit'; document.getElementById('param-code').value = p.param_code; document.getElementById('param-code').disabled = true;
    document.getElementById('param-name').value = p.param_name; document.getElementById('param-unit').value = p.default_unit;
    document.getElementById('btn-save-param').innerText = "更新參數"; document.getElementById('btn-cancel-param').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.editCategory = function(id) {
    const c = STORE.categories.find(x => x.cat_id === id);
    if(!c) return;
    document.getElementById('cat-mode').value = 'edit'; document.getElementById('cat-id').value = c.cat_id;
    document.getElementById('cat-level1').value = c.cat_1; document.getElementById('cat-level2').value = c.cat_2 || ''; document.getElementById('cat-level3').value = c.cat_3 || '';
    document.getElementById('btn-save-cat').innerText = "更新分類"; document.getElementById('btn-cancel-cat').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.editAnnouncement = function(id) {
    const a = STORE.announcements.find(x => x.announce_id === id);
    if(!a) return;
    document.getElementById('anno-mode').value = 'edit'; document.getElementById('anno-id').value = a.announce_id;
    document.getElementById('anno-version').value = a.version; document.getElementById('anno-date').value = a.date ? new Date(a.date).toISOString().split('T')[0] : '';
    document.getElementById('anno-pinned').value = a.is_pinned; document.getElementById('anno-content').value = a.content;
    document.getElementById('btn-save-anno').innerText = "更新公告"; document.getElementById('btn-cancel-anno').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.editForm = function(id, name) {
    document.getElementById('form-mode').value = 'edit'; document.getElementById('form-id').value = id; document.getElementById('form-name').value = name;
    document.getElementById('btn-save-form').innerText = "更新劑型"; document.getElementById('btn-cancel-form').classList.remove('hidden');
};

// 【新增】儲存與載入首頁設定
window.saveSettings = async function() {
    const payload = {
        action: 'saveSettings',
        settings: {
            welcome_title: document.getElementById('set-welcome').value,
            owner: document.getElementById('set-owner').value,
            copyright: document.getElementById('set-copyright').value,
            usage_rules: document.getElementById('set-rules').value
        }
    };
    await sendPost(payload);
};

// 讓介面打開時能讀取設定 (將其加入系統總覽渲染中)
const originalRenderSystemLists = window.renderSystemLists;
window.renderSystemLists = function() {
    originalRenderSystemLists(); // 執行原本的渲染
    
    // 渲染設定檔
    if(STORE.settings && document.getElementById('set-welcome')) {
        document.getElementById('set-welcome').value = STORE.settings.welcome_title || '';
        document.getElementById('set-owner').value = STORE.settings.owner || '';
        document.getElementById('set-copyright').value = STORE.settings.copyright || '';
        document.getElementById('set-rules').value = STORE.settings.usage_rules || '';
    }
};
