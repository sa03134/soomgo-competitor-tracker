# 숨고 경쟁사 분석기 📊

> Chrome 확장 프로그램으로 숨고(Soomgo) 플랫폼의 경쟁사 실적을 실시간 추적하고 분석합니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-blue)](https://chrome.google.com/webstore)

## ✨ 주요 기능

### 📅 실시간 캘린더 뷰
- 3개 경쟁사의 월별 고용/리뷰 증감 추이를 한눈에 확인
- 날짜별 상세 데이터 표시
- 고용 발생일 하이라이트 표시

### 📈 통계 대시보드
- **주간 통계**: 최근 7일간 증감 추이 (날짜 범위 표시)
- **월간 통계**: 선택한 월의 전체 통계
- 과거 데이터 탐색 기능 (◀▶ 네비게이션)

### 🔥 연속 고용 추적
- 연속으로 고용이 발생한 일수 표시
- 경쟁 우위 파악

### ⚙️ 자동 수집
- 매일 정해진 시간에 자동으로 데이터 수집
- 수집 시간 커스터마이징 가능
- 수동 수집 버튼 제공

## 🚀 설치 방법

### Chrome 확장 프로그램 설치

1. **저장소 클론**
   ```bash
   git clone https://github.com/wst2024/soomgo-competitor-tracker.git
   cd soomgo-competitor-tracker
   ```

2. **Chrome 확장 프로그램 로드**
   - Chrome 브라우저에서 `chrome://extensions` 접속
   - 우측 상단 "개발자 모드" 활성화
   - "압축해제된 확장 프로그램을 로드합니다" 클릭
   - 클론한 폴더 선택

3. **완료!**
   - Chrome 툴바에 아이콘이 나타납니다
   - 클릭하여 대시보드 확인

### 자동 데이터 수집 (선택사항)

Python 스크립트를 사용하여 웹 없이 자동으로 데이터를 수집할 수 있습니다.

```bash
# 의존성 설치
pip install -r requirements.txt

# 1회 수집
python auto_collector.py --once

# 지속적 수집 (60분 간격)
python auto_collector.py
```

**설정 방법:**
1. `auto_collector.py` 파일 열기
2. 경쟁사 URL 설정
   ```python
   collector.competitors = {
       'soncoach': 'https://soomgo.com/profile/users/...',
       'seoulcoach': 'https://soomgo.com/profile/users/...',
   }
   ```
3. 실행

## 📖 사용 방법

### 기본 사용

1. **Chrome 아이콘 클릭**
   - 대시보드가 팝업으로 열립니다

2. **데이터 수집**
   - "지금 수집" 버튼 클릭
   - 또는 자동 수집 시간 설정 (⚙️ 버튼)

3. **통계 확인**
   - 캘린더에서 날짜별 증감 확인
   - 하단 통계 테이블에서 요약 확인
   - ◀▶ 버튼으로 과거 데이터 탐색

### 고급 기능

**월별 비교**
- 상단 ◀ 2025년 11월 ▶ 버튼으로 월 변경
- 캘린더와 월간 통계가 자동으로 업데이트

**주간 통계 탐색**
- 좌측 하단 "1주차" 통계에서 ◀▶ 버튼 클릭
- 과거 주차별 데이터 확인

**자동 수집 설정**
- ⚙️ 버튼 클릭
- "수집 시간" 설정 (예: 09:00)
- "저장" 클릭

## 🎨 UI 특징

- **Apple 디자인 시스템** 적용
- **간결한 정보 밀도**: 여백 최소화, 핵심 정보 집중
- **직관적 색상 코딩**:
  - 보라색: 내 데이터 (패스)
  - 회색: 경쟁사 데이터
  - 빨간색: 감소 (마이너스)
- **반응형 레이아웃**: 680x510px 최적화

## 🛠️ 기술 스택

- **Frontend**: Vanilla JavaScript
- **Storage**: Chrome Storage API
- **UI Framework**: Custom CSS (Apple-inspired)
- **Data Collection**: Background Service Worker
- **Auto Collector**: Python + Requests

## 📁 프로젝트 구조

```
soomgo-competitor-tracker/
├── manifest.json           # Chrome 확장 프로그램 설정
├── popup.html              # 메인 UI
├── popup.css               # 스타일시트
├── popup.js                # 프론트엔드 로직
├── background.js           # 백그라운드 작업 (자동 수집)
├── auto_collector.py       # Python 자동 수집 스크립트
├── requirements.txt        # Python 의존성
├── icons/                  # 아이콘 이미지
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md               # 이 파일
```

## 🔒 개인정보 보호

- **로컬 저장소만 사용**: 모든 데이터는 Chrome 로컬 스토리지에 저장
- **외부 전송 없음**: 수집한 데이터는 외부로 전송되지 않습니다
- **오픈소스**: 코드를 직접 확인할 수 있습니다

## 🤝 기여하기

이슈 리포트와 PR을 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 👤 개발자

**Jung Woo Sohn (패스)**
- GitHub: [@wst2024](https://github.com/wst2024)
- 서비스: 패스 자소서/면접 컨설팅

## 🙏 감사의 말

이 프로젝트는 숨고 플랫폼에서 활동하는 전문가들이 경쟁력을 높이는 데 도움이 되기를 바라며 개발되었습니다.

---

**⭐ 이 프로젝트가 도움이 되었다면 Star를 눌러주세요!**
