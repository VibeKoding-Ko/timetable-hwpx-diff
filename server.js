const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const os = require('os');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' })); // Add JSON body parsing middleware
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Add Form URL-encoded parsing middleware

// Set up Multer for file uploads (Use /tmp for serverless environments like Vercel)
const upload = multer({ dest: os.tmpdir() });

// API route to parse an uploaded file using Kordoc
app.post('/api/parse', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const originalExt = path.extname(req.file.originalname);
    const tempFile = `${filePath}${originalExt}`;

    try {
        // Rename to include extension so Kordoc can detect format
        fs.renameSync(filePath, tempFile);

        // Vercel Serverless 환경에서 안정적으로 실행하기 위해 child_process 대신 모듈을 직접 호출
        const { parse } = await import('kordoc');
        const result = await parse(tempFile);
        const markdown = result.markdown || '';

        // Clean up temp file
        fs.unlinkSync(tempFile);
        
        res.send(markdown);
    } catch (error) {
        console.error('Kordoc parsing error:', error);
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        return res.status(500).send('Error parsing file.');
    }
});

app.post('/api/download-hwp', (req, res) => {
    const { beforeText, afterText } = req.body;

    const templatePath = path.join(__dirname, '결과템플릿.hwpx');
    const outputFileName = `diff_${Date.now()}`;
    const outputPath = path.join(os.tmpdir(), `${outputFileName}.hwpx`);
    const JSZip = require('adm-zip');
    
    try {
        const zip = new JSZip(templatePath);
        const entry = zip.getEntry('Contents/section0.xml');
        if (!entry) throw new Error('section0.xml not found in template');
        
        let xml = entry.getData().toString('utf8');
        
        // HWPX 줄바꿈 및 특수문자 이스케이프 처리 함수
        const formatHwpxText = (text) => {
            if (!text) return '';
            let escaped = text.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;');
            return escaped.replace(/\n/g, '</hp:t><hp:lineBreak/><hp:t>');
        };
        
        const bFormatted = formatHwpxText(beforeText || '변경 없음');
        const aFormatted = formatHwpxText(afterText || '변경 없음');
        
        // 누름틀의 정확한 설정 여부와 관계없이, 표 안에 적힌 텍스트 자체를 정규식으로 직접 치환합니다.
        // (사용자가 "교시"를 붙이든 안 붙이든 모두 매칭되도록 처리)
        xml = xml.replace(/<hp:t>변경 전 날짜 요일( 교시)?<\/hp:t>/g, `<hp:t>${bFormatted}</hp:t>`);
        xml = xml.replace(/<hp:t>변경 후 날짜 요일( 교시)?<\/hp:t>/g, `<hp:t>${aFormatted}</hp:t>`);
        
        // [중요] 한글(HWP) 고질적인 글자 겹침 현상 해결
        // linesegarray(절대 좌표 배열)를 삭제하면 한글 프로그램이 파일을 열 때 새롭게 좌표를 계산하여 줄바꿈에 맞게 표 높이와 글자 위치를 완벽하게 재정렬합니다.
        xml = xml.replace(/<hp:linesegarray[\s\S]*?<\/hp:linesegarray>/g, '');
        
        zip.updateFile('Contents/section0.xml', Buffer.from(xml, 'utf8'));
        zip.writeZip(outputPath);
        
        // 생성된 파일 다운로드 전송
        res.download(outputPath, '시간표_비교결과.hwpx', (err) => {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        });
        
    } catch (error) {
        console.error('HWPX generation error:', error);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        return res.status(500).send('Error generating HWPX.');
    }
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server listening on http://localhost:${port}`);
    });
}

module.exports = app;
