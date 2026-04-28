import { diffTimetables } from './diffEngine.js';

document.addEventListener('DOMContentLoaded', () => {
    const fileBefore = document.getElementById('fileBefore');
    const fileAfter = document.getElementById('fileAfter');
    const btnBefore = document.getElementById('btnBefore');
    const btnAfter = document.getElementById('btnAfter');
    const btnCompare = document.getElementById('btnCompare');
    const btnReset = document.getElementById('btnReset');
    const compareBtnText = document.getElementById('compareBtnText');
    const resultsContainer = document.getElementById('resultsContainer');
    const btnDownload = document.getElementById('btnDownload');
    const downloadSection = document.getElementById('downloadSection');

    let beforeHtml = '';
    let afterHtml = '';
    let currentDifferences = [];

    // Trigger file selection
    btnBefore.addEventListener('click', () => fileBefore.click());
    btnAfter.addEventListener('click', () => fileAfter.click());

    // Update UI on file select
    fileBefore.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            btnBefore.querySelector('h3').textContent = e.target.files[0].name;
            btnBefore.classList.add('border-primary');
        }
    });

    fileAfter.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            btnAfter.querySelector('h3').textContent = e.target.files[0].name;
            btnAfter.classList.add('border-primary');
        }
    });

    // Parse file via API
    async function parseFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/parse', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Failed to parse file');
        return await response.text();
    }

    // Reset button click
    btnReset.addEventListener('click', () => {
        fileBefore.value = '';
        fileAfter.value = '';

        btnBefore.querySelector('h3').textContent = '변경 전 시간표 (HWP)';
        btnBefore.classList.remove('border-primary');

        btnAfter.querySelector('h3').textContent = '변경 후 시간표 (HWP)';
        btnAfter.classList.remove('border-primary');

        resultsContainer.innerHTML = '';
        beforeHtml = '';
        afterHtml = '';
        currentDifferences = [];
        downloadSection.classList.add('hidden');
    });

    // Compare button click
    btnCompare.addEventListener('click', async () => {
        if (!fileBefore.files[0] || !fileAfter.files[0]) {
            alert('변경 전, 후 HWP 파일을 업로드 해주세요.');
            return;
        }

        // Hide download button while parsing
        downloadSection.classList.add('hidden');
        resultsContainer.innerHTML = '<div class="col-span-2 p-8 text-center text-zinc-400">파일을 분석 중입니다...</div>';
        compareBtnText.textContent = '비교 중... ⏳';
        btnCompare.disabled = true;

        try {
            // Fetch parsed markdown from backend
            const [beforeText, afterText] = await Promise.all([
                parseFile(fileBefore.files[0]),
                parseFile(fileAfter.files[0])
            ]);

            // diffEngine uses parseTimetable which expects HTML containing <table> elements.
            // Since kordoc --format markdown outputs literal HTML tables for complex structures, 
            // diffEngine can parse it directly!
            beforeHtml = beforeText;
            afterHtml = afterText;

            currentDifferences = diffTimetables(beforeHtml, afterHtml, new Date().getFullYear());

            renderResults(currentDifferences);

            if (currentDifferences.length > 0) {
                downloadSection.classList.remove('hidden');
            }

        } catch (error) {
            console.error(error);
            alert('파일을 분석하는 중 오류가 발생했습니다.');
        } finally {
            compareBtnText.textContent = '시간표 비교하기 🚀';
            btnCompare.disabled = false;
        }
    });

    function renderResults(diffs) {
        resultsContainer.innerHTML = '';
        if (diffs.length === 0) {
            resultsContainer.innerHTML = '<div class="p-4 text-center text-zinc-400">변경 사항이 없습니다.</div>';
            return;
        }

        diffs.forEach(diff => {
            // diff string format: "변경전 : X\n변경후 : Y\n"
            const lines = diff.trim().split('\n');
            let beforeContent = lines[0] ? lines[0].replace('변경전 : ', '') : '';
            let afterContent = lines[1] ? lines[1].replace('변경후 : ', '') : '';

            const rowHtml = `
            <div class="grid grid-cols-2">
                <div class="p-table-cell-padding bg-error-container/5 border-r border-zinc-700">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold bg-error-container/20 text-error px-2 py-0.5 rounded">OLD</span>
                        <span class="font-table-data text-table-data text-error">${beforeContent}</span>
                    </div>
                </div>
                <div class="p-table-cell-padding bg-secondary-container/5">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold bg-secondary-container/20 text-secondary px-2 py-0.5 rounded">NEW</span>
                        <span class="font-table-data text-table-data text-secondary">${afterContent}</span>
                    </div>
                </div>
            </div>
            `;
            resultsContainer.insertAdjacentHTML('beforeend', rowHtml);
        });
    }

    // Download button click
    btnDownload.addEventListener('click', async () => {
        if (currentDifferences.length === 0) {
            alert('비교 결과가 없습니다.');
            return;
        }

        let beforeTextAll = [];
        let afterTextAll = [];

        currentDifferences.forEach(diff => {
            const match = diff.match(/변경전 : (.*)\n변경후 : (.*)/);
            if (match) {
                beforeTextAll.push(match[1]);
                afterTextAll.push(match[2]);
            }
        });

        const beforeFinal = beforeTextAll.join('\n');
        const afterFinal = afterTextAll.join('\n');

        try {
            // 웹 표준 Form 방식 다운로드 (크롬 폴더 열기 문제 해결)
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/api/download-hwp';

            const beforeInput = document.createElement('input');
            beforeInput.type = 'hidden';
            beforeInput.name = 'beforeText';
            beforeInput.value = beforeFinal;

            const afterInput = document.createElement('input');
            afterInput.type = 'hidden';
            afterInput.name = 'afterText';
            afterInput.value = afterFinal;

            form.appendChild(beforeInput);
            form.appendChild(afterInput);
            document.body.appendChild(form);

            form.submit();

            // 폼을 너무 빨리 지우면 브라우저가 다운로드를 취소해버리므로 10초 뒤에 삭제합니다.
            setTimeout(() => {
                if (document.body.contains(form)) {
                    document.body.removeChild(form);
                }
            }, 10000);

        } catch (error) {
            console.error(error);
            alert('다운로드 처리 중 오류가 발생했습니다.');
        }
    });
});
