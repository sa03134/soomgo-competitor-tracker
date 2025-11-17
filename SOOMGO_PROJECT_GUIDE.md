# 숨고 경쟁사 분석 프로젝트 완전 가이드

> 프로젝트 시작: 2025-11-17  
> 최종 업데이트: 2025-11-18  
> 버전: v10.0.0

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [숨고 웹사이트 구조 분석](#숨고-웹사이트-구조-분석)
3. [기술 스택](#기술-스택)
4. [주요 기능](#주요-기능)
5. [파일 구조](#파일-구조)
6. [데이터 수집 메커니즘](#데이터-수집-메커니즘)
7. [Chrome 확장 프로그램](#chrome-확장-프로그램)
8. [GitHub Actions 자동화](#github-actions-자동화)
9. [문제 해결 히스토리](#문제-해결-히스토리)
10. [다음 개발을 위한 체크리스트](#다음-개발을-위한-체크리스트)

---

## 🎯 프로젝트 개요

### 목적
숨고 플랫폼에서 경쟁사(자소서/면접 컨설턴트)의 고용수, 리뷰수, 평점을 자동으로 수집하고 시각화하여 시장 동향을 파악

### 타겟 사용자
- **패스 (본인)**: 숨고 플랫폼에서 자소서/면접 컨설팅 제공
- **경쟁사**: 손코치, 정코치

### 핵심 가치
1. **실시간 모니터링**: 경쟁사 지표 추적
2. **자동화**: GitHub Actions로 매시간 자동 수집
3. **시각화**: 캘린더, 통계, 그래프로 한눈에 파악
4. **알림**: 평점 하락 등 중요 변화 감지

---

## 🌐 숨고 웹사이트 구조 분석

### 1. 프로필 페이지 구조

#### URL 패턴
```
https://soomgo.com/profile/users/{USER_ID}

예시:
- 손코치: https://soomgo.com/profile/users/16756708
- 정코치: https://soomgo.com/profile/users/3379598
- 패스: https://soomgo.com/profile/users/11571181
```

#### DOM 구조 (핵심 요소)

```html
<body id="app-body">
  <div>
    <div class="container">
      <div class="row no-gutters">
        <div class="profile-section col-lg-auto col-12">
          <div>
            <div class="profile-overview">
              <div class="info">
                <div class="detail-info">
                  
                  <!-- 통계 정보 영역 -->
                  <div class="statistics-info">
                    
                    <!-- 고용수 -->
                    <div class="statistics-info-item">
                      <div class="statistics-info-item-contents">
                        521 <!-- 고용 횟수 -->
                      </div>
                    </div>
                    
                    <!-- 리뷰수 & 평점 -->
                    <div class="statistics-info-item review-info">
                      <div class="statistics-info-item-contents">
                        <span class="rate">5.0</span> <!-- 평점 -->
                        <span class="count">207</span> <!-- 리뷰 개수 -->
                      </div>
                    </div>
                    
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
```

### 2. CSS 선택자 (정확한 경로)

#### 고용수
```css
/* 최우선 선택자 (가장 정확) */
#app-body > div > div.container > div.row.no-gutters > div.profile-section.col-lg-auto.col-12 > div > div.profile-overview > div.info > div.detail-info > div.statistics-info > div:nth-child(1) > div.statistics-info-item-contents

/* 백업 선택자 1 */
div.statistics-info > div:nth-child(1) > div.statistics-info-item-contents

/* 백업 선택자 2 */
div.statistics-info div.statistics-info-item-contents
```

#### 리뷰수
```css
/* 최우선 선택자 */
#app-body > div > div.container > div.row.no-gutters > div.profile-section.col-lg-auto.col-12 > div > div.profile-overview > div.info > div.detail-info > div.statistics-info > div.statistics-info-item.review-info > div.statistics-info-item-contents > span.count

/* 백업 선택자 1 */
div.statistics-info-item.review-info span.count

/* 백업 선택자 2 */
div.review-info span.count
```

#### 평점
```css
/* 최우선 선택자 */
#app-body > div > div.container > div.row.no-gutters > div.profile-section.col-lg-auto.col-12 > div > div.profile-overview > div.info > div.detail-info > div.statistics-info > div.statistics-info-item.review-info > div.statistics-info-item-contents > span.rate

/* 백업 선택자 1 */
div.statistics-info-item.review-info span.rate

/* 백업 선택자 2 */
span.rate
```

### 3. 리뷰 데이터 구조

```html
<section class="review-content">
  <div class="review-content-item">
    <div class="review-content-wrapper">
      
      <!-- 리뷰 텍스트 -->
      <span class="prisma-typography body14-regular primary review-content">
        정문석이 최선을 다해주신거 같습니다!!
      </span>
      
    </div>
  </div>
</section>
```

#### 리뷰 CSS 선택자
```css
/* 리뷰 컨테이너 */
section.review-content

/* 개별 리뷰 */
div.review-content-item

/* 리뷰 텍스트 */
span.prisma-typography.body14-regular.primary.review-content
```

### 4. JavaScript 렌더링 특성

숨고는 **React 기반 SPA (Single Page Application)**입니다.

#### 중요 특징
1. **동적 렌더링**: 페이지 로드 후 JavaScript로 콘텐츠 생성
2. **지연 로딩**: 초기 HTML에는 데이터 없음
3. **필요한 대기 시간**: 최소 5초 이상

#### 데이터 추출 전략
```python
# 1. 페이지 로드
driver.get(url)

# 2. 충분한 대기 (JavaScript 실행 완료)
time.sleep(5)  # 최소 5초

# 3. 요소 추출
elements = driver.find_elements(By.CSS_SELECTOR, selector)
```

### 5. 데이터 형식

#### 숫자 표시
- **고용수**: `521` (콤마 없음)
- **리뷰수**: `207` (콤마 없음)
- **평점**: `5.0` (소수점 1자리)

#### 주의사항
- 콤마가 있을 수 있으므로 `.replace(',', '')` 필수
- 평점은 `float`, 나머지는 `int`

---

## 🛠 기술 스택

### Backend (데이터 수집)
```python
# 핵심 라이브러리
selenium==4.15.2
webdriver-manager==4.0.1

# 데이터 처리
json (표준 라이브러리)
datetime (표준 라이브러리)
re (정규식)
```

### Frontend (Chrome 확장)
```javascript
// 웹 표준
HTML5
CSS3
JavaScript (ES6+)

// Chrome APIs
chrome.storage.local  // 로컬 저장소
chrome.alarms         // 스케줄링
chrome.tabs           // 탭 제어
```

### DevOps
```yaml
# GitHub Actions
- Ubuntu 22.04
- Python 3.10
- Chrome + ChromeDriver
- Cron 스케줄링
```

---

## ⭐ 주요 기능

### 1. 자동 데이터 수집
- **주기**: 매시간 정각 (00분)
- **방식**: GitHub Actions + Selenium
- **저장**: `collected_data/*.json`

### 2. Chrome 확장 프로그램
#### 캘린더 뷰
- 3개 캘린더 (손코치, 정코치, 패스)
- 월별 데이터 시각화
- 고용/리뷰 증감 표시

#### 통계
- 1주차 통계 (최근 7일)
- 월간 통계 (현재 월)
- 네비게이션 (이전/다음)

#### 툴팁
- 마우스 호버 시 상세 정보
- 시간대별 데이터 (있는 경우)
- 부드러운 애니메이션

### 3. 알림/경고
- **평점 경고**: 5.0 미만 시 빨간색 표시
- **연속 고용**: 패스의 연속 고용 일수 표시 (🔥)

### 4. 빠른 접근
- 고수 이름 클릭 → 프로필 페이지 이동
- 새로고침 버튼으로 최신 데이터 가져오기

---

## 📁 파일 구조

```
soomgo-competitor-tracker/
│
├── manifest.json                    # Chrome 확장 설정
├── popup.html                       # 확장 UI
├── popup.css                        # 스타일
├── popup.js                         # 로직
├── background.js                    # 백그라운드 작업
│
├── icons/                           # 아이콘
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── collected_data/                  # 수집된 데이터
│   ├── soncoach.json
│   ├── seoulcoach.json
│   └── passcoach.json
│
├── auto_collector_selenium.py       # 데이터 수집 스크립트
├── requirements.txt                 # Python 의존성
│
├── .github/
│   └── workflows/
│       └── collect-data.yml         # GitHub Actions
│
├── README.md
└── LICENSE
```

---

## 🤖 데이터 수집 메커니즘

### Python 스크립트 (`auto_collector_selenium.py`)

#### 1. 초기화
```python
class SoomgoSeleniumCollector:
    def __init__(self):
        self.competitors = {
            'soncoach': {
                'name': '손코치',
                'url': 'https://soomgo.com/profile/users/16756708'
            },
            # ...
        }
```

#### 2. Chrome 드라이버 설정
```python
def setup_driver(self):
    options = Options()
    options.add_argument('--headless')       # 화면 없이
    options.add_argument('--no-sandbox')     # 샌드박스 비활성화
    options.add_argument('--disable-dev-shm-usage')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver
```

#### 3. 데이터 추출
```python
def extract_data_from_page(self, driver):
    # 페이지 로딩 대기
    time.sleep(5)
    
    # 고용수
    hiring_selectors = [...]
    for selector in hiring_selectors:
        elements = driver.find_elements(By.CSS_SELECTOR, selector)
        if elements:
            text = elements[0].text.replace(',', '')
            hirings = int(re.findall(r'\d+', text)[0])
            break
    
    # 리뷰수
    # ...
    
    # 평점
    # ...
    
    return hirings, reviews, rating
```

#### 4. 데이터 저장
```python
def save_data(self, competitor_id, data):
    filepath = f'collected_data/{competitor_id}.json'
    
    # 기존 데이터 로드
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            storage_data = json.load(f)
    else:
        storage_data = {}
    
    # 새 데이터 추가
    date_key = data['date']
    storage_data[date_key] = {
        'hirings': data['hirings'],
        'reviews': data['reviews'],
        'rating': data['rating'],
        'timestamp': datetime.now().isoformat()
    }
    
    # 원자적 쓰기 (안전성)
    temp_filepath = f'{filepath}.tmp'
    with open(temp_filepath, 'w') as f:
        json.dump(storage_data, f, ensure_ascii=False, indent=2)
    os.replace(temp_filepath, filepath)
```

### JSON 데이터 형식

```json
{
  "2025-11-17": {
    "hirings": 525,
    "reviews": 207,
    "rating": 5.0,
    "timestamp": "2025-11-17T09:00:00Z",
    "hourly": {
      "09:00": { "hirings": 520, "reviews": 206 },
      "15:00": { "hirings": 525, "reviews": 207 }
    }
  }
}
```

---

## 🔌 Chrome 확장 프로그램

### Manifest v3
```json
{
  "manifest_version": 3,
  "name": "숨고 경쟁사 분석",
  "version": "10.0.0",
  "permissions": [
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "https://raw.githubusercontent.com/*"
  ]
}
```

### 데이터 흐름

```
GitHub (collected_data/*.json)
    ↓
[새로고침 버튼 클릭]
    ↓
fetch(https://raw.githubusercontent.com/.../soncoach.json)
    ↓
chrome.storage.local.set({ soncoach: data })
    ↓
캘린더/통계 렌더링
```

### 주요 함수

#### 1. GitHub 동기화
```javascript
async function syncFromGithub() {
  const GITHUB_BASE = 'https://raw.githubusercontent.com/sa03134/soomgo-competitor-tracker/main/collected_data';
  
  for (const compId of ['soncoach', 'seoulcoach', 'passcoach']) {
    const url = `${GITHUB_BASE}/${compId}.json`;
    const response = await fetch(url);
    const data = await response.json();
    
    await chrome.storage.local.set({ [compId]: data });
  }
}
```

#### 2. 캘린더 렌더링
```javascript
async function renderCalendar(compId) {
  const result = await chrome.storage.local.get([compId]);
  const data = result[compId] || {};
  
  // 날짜별로 증감 계산
  for (let date = 1; date <= lastDay.getDate(); date++) {
    const dateStr = `${year}-${month}-${date}`;
    const todayData = data[dateStr];
    
    if (todayData && prevData) {
      const hChange = todayData.hirings - prevData.hirings;
      const rChange = todayData.reviews - prevData.reviews;
      
      // 셀에 표시
      dayEl.innerHTML = `
        <div>${date}</div>
        <div class="change">${hChange}/${rChange}</div>
      `;
    }
  }
}
```

#### 3. 툴팁 (부드러운 애니메이션)
```javascript
let currentTooltip = null;

function showTooltip(element, compId, dateStr, data) {
  // 기존 툴팁 즉시 제거
  if (currentTooltip) {
    currentTooltip.remove();
  }
  
  // 새 툴팁 생성
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.innerHTML = `...`;
  
  document.body.appendChild(tooltip);
  currentTooltip = tooltip;
  
  // 위치 계산
  const rect = element.getBoundingClientRect();
  tooltip.style.top = `${rect.top - tooltip.height - 8}px`;
  tooltip.style.left = `${rect.left}px`;
  
  // 애니메이션
  setTimeout(() => tooltip.classList.add('show'), 10);
}
```

#### 4. Debounce (버벅거림 방지)
```javascript
let hoverTimeout = null;

dayEl.addEventListener('mouseenter', (e) => {
  if (hoverTimeout) clearTimeout(hoverTimeout);
  
  hoverTimeout = setTimeout(() => {
    showTooltip(e.currentTarget, compId, dateStr, data);
  }, 100); // 100ms 대기
});
```

---

## ⚙️ GitHub Actions 자동화

### Workflow 파일 (`.github/workflows/collect-data.yml`)

```yaml
name: 자동 데이터 수집

on:
  schedule:
    - cron: '0 * * * *'  # 매시간 00분
  workflow_dispatch:     # 수동 실행

jobs:
  collect:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Python 설치
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: 의존성 설치
        run: |
          pip install -r requirements.txt
      
      - name: 데이터 수집
        run: |
          python auto_collector_selenium.py
      
      - name: Git 커밋 & 푸시
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add collected_data/
          git commit -m "chore: update data [skip ci]"
          git push
```

### 실행 흐름

```
[매시간 00분]
    ↓
GitHub Actions 트리거
    ↓
Ubuntu VM 시작
    ↓
Python + Selenium 설치
    ↓
auto_collector_selenium.py 실행
    ↓
collected_data/*.json 업데이트
    ↓
Git commit & push
    ↓
GitHub 저장소에 저장 ✅
```

---

## 🐛 문제 해결 히스토리

### 1. JavaScript 렌더링 문제
**증상**: 페이지 로드 후 데이터 없음  
**원인**: React SPA - 동적 렌더링  
**해결**: `time.sleep(5)` 추가

### 2. CSS 선택자 변경
**증상**: 선택자로 요소 못 찾음  
**원인**: 숨고 웹사이트 구조 변경  
**해결**: 다중 백업 선택자 전략

### 3. JSON 파일 손상
**증상**: `JSONDecodeError`  
**원인**: 쓰기 중 프로세스 중단  
**해결**: 원자적 쓰기 (`.tmp` → 원본)

### 4. 툴팁 겹침/버벅거림
**증상**: 마우스 빠르게 움직이면 툴팁 여러 개  
**원인**: 이벤트 리스너 중복 실행  
**해결**: 
- `currentTooltip` 변수로 단일 인스턴스 보장
- Debounce (100ms) 추가

### 5. `re` 모듈 없음
**증상**: `name 're' is not defined`  
**원인**: `import re` 누락  
**해결**: import 추가

### 6. GitHub URL 오류
**증상**: 동기화 실패  
**원인**: 잘못된 사용자명 (wst2024 → sa03134)  
**해결**: URL 수정

---

## ✅ 다음 개발을 위한 체크리스트

### 숨고 웹 구조 관련

- [ ] **리뷰 데이터 수집** 구현
  ```python
  review_selector = "span.prisma-typography.body14-regular.primary.review-content"
  reviews = driver.find_elements(By.CSS_SELECTOR, review_selector)
  review_texts = [r.text for r in reviews[:5]]  # 최신 5개
  ```

- [ ] **평점 하락 알림** (5.0 미만)
  - 푸시 알림 or 이메일
  - Chrome Notifications API

- [ ] **경쟁사 추가** 기능
  - 설정 UI에서 URL 입력
  - 동적으로 추가/제거

### UI/UX 개선

- [ ] **다크 모드** 지원
- [ ] **차트/그래프** (Chart.js)
  - 고용 증가 추세선
  - 월별 비교 막대그래프
- [ ] **필터링**
  - 날짜 범위 선택
  - 특정 경쟁사만 보기

### 성능 최적화

- [ ] **캐싱**
  - 최근 데이터를 메모리에 보관
  - 불필요한 fetch 감소
- [ ] **지연 로딩**
  - 캘린더 스크롤 시 렌더링

### 데이터 분석

- [ ] **AI 인사이트**
  - Claude API로 트렌드 분석
  - "정코치가 최근 급성장 중입니다"
- [ ] **예측 모델**
  - 다음 주 고용 예측

---

## 🔑 핵심 코드 스니펫 (재사용)

### 1. 숨고 데이터 추출 (Python)
```python
import re
from selenium import webdriver
from selenium.webdriver.common.by import By

def extract_soomgo_data(url):
    driver = webdriver.Chrome()
    driver.get(url)
    time.sleep(5)
    
    # 고용수
    hiring_el = driver.find_element(
        By.CSS_SELECTOR,
        "div.statistics-info > div:nth-child(1) > div.statistics-info-item-contents"
    )
    hirings = int(re.findall(r'\d+', hiring_el.text)[0])
    
    # 리뷰수
    review_el = driver.find_element(
        By.CSS_SELECTOR,
        "div.review-info span.count"
    )
    reviews = int(re.findall(r'\d+', review_el.text)[0])
    
    # 평점
    rating_el = driver.find_element(
        By.CSS_SELECTOR,
        "span.rate"
    )
    rating = float(rating_el.text)
    
    driver.quit()
    return hirings, reviews, rating
```

### 2. GitHub Raw 파일 가져오기 (JavaScript)
```javascript
async function fetchGithubData(username, repo, filepath) {
  const url = `https://raw.githubusercontent.com/${username}/${repo}/main/${filepath}`;
  const response = await fetch(url);
  return await response.json();
}

// 사용
const data = await fetchGithubData(
  'sa03134',
  'soomgo-competitor-tracker',
  'collected_data/passcoach.json'
);
```

### 3. Chrome Storage 저장/불러오기
```javascript
// 저장
await chrome.storage.local.set({ 
  passcoach: { "2025-11-17": { hirings: 197, reviews: 130 } }
});

// 불러오기
const result = await chrome.storage.local.get(['passcoach']);
const data = result.passcoach || {};
```

---

## 📊 데이터 스키마

### JSON 구조
```typescript
interface CompetitorData {
  [date: string]: {
    hirings: number;      // 고용 횟수
    reviews: number;      // 리뷰 개수
    rating: number;       // 평점 (0.0 ~ 5.0)
    timestamp: string;    // ISO 8601
    hourly?: {            // 시간대별 (선택)
      [time: string]: {
        hirings: number;
        reviews: number;
      }
    }
  }
}

// 예시
{
  "2025-11-17": {
    "hirings": 197,
    "reviews": 130,
    "rating": 4.9,
    "timestamp": "2025-11-17T09:00:00Z",
    "hourly": {
      "09:00": { "hirings": 195, "reviews": 128 },
      "15:00": { "hirings": 197, "reviews": 130 }
    }
  }
}
```

---

## 🚀 빠른 시작 (다음 개발자용)

### 1. 저장소 클론
```bash
git clone https://github.com/sa03134/soomgo-competitor-tracker.git
cd soomgo-competitor-tracker
```

### 2. Python 환경 설정
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 로컬 데이터 수집 테스트
```bash
python auto_collector_selenium.py
```

### 4. Chrome 확장 로드
```
1. chrome://extensions
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 프로젝트 폴더 선택
```

### 5. GitHub Actions 설정
```bash
# 저장소 설정
git config user.name "Your Name"
git config user.email "your@email.com"

# Actions 활성화 (Settings → Actions → General)
```

---

## 📚 참고 자료

### 공식 문서
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [Selenium Python](https://selenium-python.readthedocs.io/)
- [GitHub Actions](https://docs.github.com/en/actions)

### 숨고 플랫폼
- [숨고 홈페이지](https://soomgo.com)
- [고수 프로필 예시](https://soomgo.com/profile/users/11571181)

---

## 🎓 학습한 핵심 개념

### 1. SPA (Single Page Application) 스크래핑
- JavaScript 렌더링 대기
- Selenium의 필요성
- 동적 콘텐츠 추출

### 2. Chrome Extension 아키텍처
- Manifest V3
- Background Service Worker
- Content Scripts vs Popup

### 3. GitHub Actions CI/CD
- Cron 스케줄링
- 환경 변수 관리
- 자동 커밋/푸시

### 4. 데이터 시각화
- 캘린더 UI 구현
- 툴팁 애니메이션
- 반응형 레이아웃

---

## 💡 베스트 프랙티스

### 1. 에러 핸들링
```python
try:
    data = extract_data()
except Exception as e:
    print(f"❌ 오류: {e}")
    # 디버깅용 HTML 저장
    with open('debug.html', 'w') as f:
        f.write(driver.page_source)
```

### 2. 다중 백업 전략
```python
selectors = [
    "매우 구체적인 선택자",
    "중간 선택자",
    "일반적인 선택자"
]

for selector in selectors:
    try:
        element = driver.find_element(By.CSS_SELECTOR, selector)
        return element.text
    except:
        continue
```

### 3. 원자적 파일 쓰기
```python
# 임시 파일에 먼저 쓰기
with open('data.json.tmp', 'w') as f:
    json.dump(data, f)

# 원본으로 교체 (원자적)
os.replace('data.json.tmp', 'data.json')
```

---

## 🔮 미래 로드맵

### Phase 1 (완료 ✅)
- [x] 기본 데이터 수집
- [x] Chrome 확장 UI
- [x] GitHub Actions 자동화
- [x] 캘린더 시각화

### Phase 2 (진행 중 🚧)
- [ ] 평점 표시
- [ ] 리뷰 데이터 수집
- [ ] 고수 이름 클릭 링크

### Phase 3 (계획 📅)
- [ ] AI 인사이트
- [ ] 예측 모델
- [ ] 모바일 앱

---

## 📞 연락처 & 지원

**개발자**: Pass (패스)  
**이메일**: [당신의 이메일]  
**GitHub**: [@sa03134](https://github.com/sa03134)

---

**마지막 업데이트**: 2025-11-18  
**문서 버전**: v1.0.0

이 문서는 프로젝트를 다른 환경이나 다른 채팅방에서 이어서 개발할 때 필요한 모든 정보를 포함하고 있습니다. 🚀
