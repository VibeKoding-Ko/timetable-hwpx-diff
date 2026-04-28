# 연간 시간표 비교 자동화 웹앱 (Timetable Compare)

두 개의 한글(HWP) 파일로 된 시간표를 업로드하면 변경 사항을 자동으로 비교하고 추출하여, 요약된 결과물을 새로운 HWPX 템플릿 파일로 만들어주는 서비스입니다.

## 🚀 주요 기능
*   **시간표 변경점 추출:** 변경 전/후 시간표를 비교하여 바뀐 수업(과목명, 교사명 등)을 자동으로 감지합니다.
*   **자동 HWPX 생성:** 추출된 변경 내용을 지정된 `결과템플릿.hwpx` 양식에 완벽하게 채워 넣어 다운로드할 수 있게 해줍니다.
*   **로컬 환경 기반:** DB 연동 없이 파일 시스템과 Node.js만을 이용하여 매우 가볍고 빠릅니다.

## 📦 설치 및 실행 방법

1. **의존성 모듈 설치**
   ```bash
   npm install
   ```

2. **서버 실행**
   ```bash
   npm start
   ```

3. **접속**
   브라우저에서 `http://localhost:3000` 으로 접속합니다.

## 🛠 기술 스택
*   **Frontend:** HTML5, CSS (TailwindCSS CDN), Vanilla JavaScript
*   **Backend:** Node.js, Express, Multer (파일 업로드 처리)
*   **HWP Processing:** [Kordoc CLI](https://github.com/kordoc) (한글 문서 마크다운 파싱), adm-zip (HWPX 내부 XML 조작)

## 📌 주의사항
*   루트 폴더에 반드시 `결과템플릿.hwpx` 파일이 존재해야 합니다.
*   서버는 무상태(Stateless)로 작동하므로, 처리가 끝난 업로드 파일 및 임시 파일은 자동 삭제됩니다.
