// assets/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("後台編輯器初始化...");
    initializeAdmin();
    setupEditorButtons();
    setupSaveAction();
});

async function initializeAdmin() {
    try {
        // 載入藥品清單與參數清單
        const [drugsData, paramsData] = await Promise.all([
            fetchFromGAS('getDrugs'),
            fetchFromGAS('getParameters')
        ]);

        if (drugsData && paramsData) {
            STORE.drugs = drugsData;
            STORE.parameters = paramsData;
            
            renderDrugSelect();
            renderParameterPad();
        } else {
            alert("資料載入失敗，請檢查 API。");
        }
    } catch (error) {
        console.error("初始化錯誤:", error);
    }
}

function renderDrugSelect() {
    const select = document.getElementById('admin-drug-select');
    select.innerHTML = '<option value="">-- 請選擇藥品 --</option>';
    
    STORE.drugs.forEach(drug => {
        const option = document.createElement('option');
        option.value = drug.drug_id;
        option.innerText = `${drug.local_name || drug.brand_name} (${drug.generic_name})`;
        select.appendChild(option);
    });
}

function renderParameterPad() {
    const pad = document.getElementById('admin-param-pad');
    pad.innerHTML = '';
    
    STORE.parameters.forEach(param => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'text-xs bg-[#1B365D] text-white px-2 py-1.5 rounded hover:bg-blue-800 transition';
        btn.innerText = `${param.param_name} (${param.default_unit})`;
        
        // 點擊將 {param_code} 插入到游標位置
        btn.onclick = () => insertAtCursor(`{${param.param_code}}`);
        pad.appendChild(btn);
    });
}

function setupEditorButtons() {
    // 綁定基礎運算子按鈕
    document.querySelectorAll('.op-btn').forEach(btn => {
        btn.onclick = (e) => {
            const op = e.target.innerText;
            // 運算子前後加個空白比較好讀
            insertAtCursor(` ${op} `);
        };
    });

    // 綁定測試按鈕
    document.getElementById('btn-generate-test').onclick = generateTestInputs;
}

function insertAtCursor(textToInsert) {
    const textarea = document.getElementById('admin-formula-string');
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, startPos) + textToInsert + text.substring(endPos);
    
    // 將游標移到插入文字的後方並聚焦
    textarea.selectionStart = textarea.selectionEnd = startPos + textToInsert.length;
    textarea.focus();
}

// ==========================================
// 測試模組邏輯
// ==========================================
function generateTestInputs() {
    const formulaStr = document.getElementById('admin-formula-string').value;
    const testContainer = document.getElementById('admin-test-inputs');
    testContainer.innerHTML = '';
    document.getElementById('admin-test-result').innerText = '--';

    const paramRegex = /{([^}]+)}/g;
    const requiredCodes = [];
    let match;
    while ((match = paramRegex.exec(formulaStr)) !== null) {
        if (!requiredCodes.includes(match[1])) requiredCodes.push(match[1]);
    }

    if (requiredCodes.length === 0) {
        alert("公式中尚未包含任何臨床參數！");
        return;
    }

    requiredCodes.forEach(code => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label class="block text-xs text-gray-600">${code}:</label>
            <input type="number" data-testcode="${code}" class="test-input w-full border rounded px-2 py-1 text-sm" placeholder="輸入測試數值">
        `;
        testContainer.appendChild(div);
    });

    // 綁定輸入即時測試運算
    document.querySelectorAll('.test-input').forEach(input => {
        input.addEventListener('input', runLiveTest);
    });
}

function runLiveTest() {
    let formulaStr = document.getElementById('admin-formula-string').value;
    const inputs = document.querySelectorAll('.test-input');
    let allFilled = true;

    inputs.forEach(input => {
        const code = input.getAttribute('data-testcode');
        const val = input.value;
        if (val === '') allFilled = false;
        else {
            const regex = new RegExp(`{${code}}`, 'g');
            formulaStr = formulaStr.replace(regex, val);
        }
    });

    if (!allFilled) {
        document.getElementById('admin-test-result').innerText = '--';
        return;
    }

    try {
        let result = math.evaluate(formulaStr);
        result = Math.round(result * 100) / 100;
        document.getElementById('admin-test-result').innerText = result;
    } catch (error) {
        document.getElementById('admin-test-result').innerText = "運算錯誤";
    }
}

// ==========================================
// 儲存寫入 Google Sheets 邏輯
// ==========================================
async function setupSaveAction() {
    document.getElementById('btn-save-formula').onclick = async () => {
        // 1. 抓取欄位資料
        const drugId = document.getElementById('admin-drug-select').value;
        const formulaName = document.getElementById('admin-formula-name').value.trim();
        const formulaString = document.getElementById('admin-formula-string').value.trim();
        const resultUnit = document.getElementById('admin-result-unit').value.trim();
        const remark = document.getElementById('admin-remark').value.trim();

        // 2. 基本防呆檢核
        if (!drugId || !formulaName || !formulaString || !resultUnit) {
            alert("請填寫所有帶有紅色 * 的必填欄位！");
            return;
        }

        const saveBtn = document.getElementById('btn-save-formula');
        saveBtn.innerText = "儲存中...";
        saveBtn.disabled = true;

        // 3. 打包資料與發送 POST 請求
        const payload = {
            action: "saveFormula",
            drug_id: drugId,
            formula_name: formulaName,
            formula_string: formulaString,
            result_unit: resultUnit,
            remark: remark
        };

        try {
            // 注意：向 GAS 發送 POST 時，必須使用 text/plain 以避免 CORS 預檢攔截
            const response = await fetch(CONFIG.GAS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.status === "success") {
                alert("公式已成功寫入資料庫！");
                // 清空輸入框
                document.getElementById('admin-formula-name').value = '';
                document.getElementById('admin-formula-string').value = '';
                document.getElementById('admin-test-inputs').innerHTML = '';
                document.getElementById('admin-test-result').innerText = '--';
            } else {
                alert("儲存失敗: " + result.message);
            }
        } catch (error) {
            console.error("寫入錯誤:", error);
            alert("網路連線錯誤，無法儲存。");
        } finally {
            saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 儲存寫入資料庫';
            saveBtn.disabled = false;
        }
    };
}
