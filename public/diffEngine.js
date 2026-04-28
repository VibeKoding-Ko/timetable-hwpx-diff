/**
 * Kordoc HTML 테이블 파싱 및 핵심 대조(Diff) 로직
 */

// [🔥 2. 화이트리스트 딕셔너리 및 예외 처리]
const subjectMap = {
  "국": "국어", "수": "수학", "사": "사회", "과": "과학", "영": "영어",
  "음": "음악", "미": "미술", "체": "체육", "도": "도덕", "융": "학교자율시간",
  "실": "실과", "자": "자율", "동": "동아리", "봉": "봉사", "진": "진로"
};

/**
 * 셀 텍스트를 필터링하는 함수
 */
function filterSubject(rawText) {
  // 1. 텍스트 내부의 공백 및 특수문자 제거 (한글, 영문, 숫자 유지)
  const cleanText = rawText.replace(/[^\w\uAC00-\uD7A3]/g, "");
  
  if (!cleanText) return "(수업 없음/휴일)";
  
  // 2. 남은 텍스트의 '첫 번째 글자' 추출
  const firstChar = cleanText.charAt(0);
  
  // 3. subjectMap에 존재하면 Value로 변환, 아니면 휴일 처리
  if (subjectMap[firstChar]) {
    return subjectMap[firstChar];
  }
  
  return "(수업 없음/휴일)";
}

/**
 * [🔥 1. 테이블 파싱 및 인덱스 평탄화]
 * HTML 문자열과 기준 연도를 입력받아 파싱된 날짜별 시간표 맵을 반환합니다.
 * 반환 구조 예시: { "3월 25일(수) 2교시": "국어", ... }
 */
function parseTimetable(htmlString, year = 2026) {
  // 브라우저 DOMParser 활용 (Node.js 환경일 경우 JSDOM 등 대체 가능)
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const rows = doc.querySelectorAll("tr");
  
  const scheduleData = {};
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    if (cells.length < 3) return; // 데이터 행이 아니면 스킵

    const weekText = cells[0].textContent.trim();
    const periodText = cells[1].textContent.trim();

    // "3. 3- 3. 6" 형태에서 첫 번째 날짜(시작일) 추출
    const periodMatch = periodText.match(/(\d+)\.\s*(\d+)/);
    if (!periodMatch || isNaN(parseInt(weekText))) return; // 주차 숫자가 없거나 기간 형식이 아니면 스킵

    const startMonth = parseInt(periodMatch[1], 10);
    const startDay = parseInt(periodMatch[2], 10);

    // 해당 주의 월요일 날짜 계산 (테이블은 항상 월~금 기준이므로)
    const startDate = new Date(year, startMonth - 1, startDay);
    const startDayOfWeek = startDate.getDay(); // 0: 일, 1: 월 ... 6: 토
    const diffToMonday = 1 - startDayOfWeek; // 월요일 기준 오프셋
    
    const mondayDate = new Date(startDate);
    mondayDate.setDate(startDate.getDate() + diffToMonday);

    // 열 평탄화 (Flatten) 로직 - colspan을 고려한 정확한 셀 매핑
    let colIndex = 0;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const text = cell.textContent.trim();
      const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
      
      for (let c = 0; c < colspan; c++) {
        const currentCol = colIndex + c;
        
        // 데이터 셀은 colIndex 3부터 33까지 (월~금, 각 6교시씩 총 30교시)
        if (currentCol >= 3 && currentCol <= 33) {
          let dayOffset = -1;
          let periodNum = -1;
          
          if (currentCol >= 3 && currentCol <= 8) {
            dayOffset = 0; // 월요일
            periodNum = currentCol - 3 + 1;
          } else if (currentCol >= 9 && currentCol <= 15) {
            dayOffset = 1; // 화요일 (header colspan=7 이므로 1교시가 colspan=2를 가짐)
            if (currentCol === 9 || currentCol === 10) periodNum = 1;
            else periodNum = currentCol - 10 + 1;
          } else if (currentCol >= 16 && currentCol <= 21) {
            dayOffset = 2; // 수요일
            periodNum = currentCol - 16 + 1;
          } else if (currentCol >= 22 && currentCol <= 27) {
            dayOffset = 3; // 목요일
            periodNum = currentCol - 22 + 1;
          } else if (currentCol >= 28 && currentCol <= 33) {
            dayOffset = 4; // 금요일
            periodNum = currentCol - 28 + 1;
          }

          if (dayOffset !== -1 && periodNum !== -1) {
            const targetDate = new Date(mondayDate);
            targetDate.setDate(mondayDate.getDate() + dayOffset);
            const m = targetDate.getMonth() + 1;
            const d = targetDate.getDate();
            const dayStr = dayNames[targetDate.getDay()];
            
            const subject = filterSubject(text);
            const key = `${m}월 ${d}일(${dayStr}) ${periodNum}교시`;
            scheduleData[key] = subject;
          }
        }
      }
      colIndex += colspan;
    }
  });

  return scheduleData;
}

/**
 * [🔥 3. 대조(Diff) 엔진 로직] 및 [🔥 4. 최종 출력 포맷]
 */
function diffTimetables(htmlBefore, htmlAfter, year = 2026) {
  const dataBefore = parseTimetable(htmlBefore, year);
  const dataAfter = parseTimetable(htmlAfter, year);
  
  const differences = [];
  
  // 두 데이터셋의 모든 키(날짜 및 교시)를 중복 없이 수집
  const allKeys = new Set([...Object.keys(dataBefore), ...Object.keys(dataAfter)]);
  
  // 정렬을 위해 키를 배열로 변환 (월, 일, 교시 순으로 대략적 정렬 가능)
  // 여기서는 단순히 등록된 순서대로 순회
  for (const key of allKeys) {
    const beforeVal = dataBefore[key] || "(수업 없음/휴일)";
    const afterVal = dataAfter[key] || "(수업 없음/휴일)";
    
    // 둘 다 "수업 없음/휴일"인 경우 변경이 없으므로 무시
    if (beforeVal === "(수업 없음/휴일)" && afterVal === "(수업 없음/휴일)") {
      continue;
    }
    
    // 값이 서로 다를 때만 변경 사항으로 기록
    if (beforeVal !== afterVal) {
      differences.push(
        `변경전 : ${key} ${beforeVal}\n변경후 : ${key} ${afterVal}\n`
      );
    }
  }
  
  return differences;
}

// 모듈 내보내기 (UI 통합을 위해)
export { parseTimetable, filterSubject, diffTimetables };
