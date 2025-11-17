// 경쟁사 정보
const competitors = [
  {
    id: 'soncoach',
    name: '손코치 Smart 반값자소서',
    url: 'https://soomgo.com/profile/users/16756708'
  },
  {
    id: 'seoulcoach',
    name: '서울대 수석 정코치 불패자소서',
    url: 'https://soomgo.com/profile/users/3379598'
  },
  {
    id: 'passcoach',
    name: '패스 자소서/면접 컨설팅',
    url: 'https://soomgo.com/profile/users/11571181'
  }
];

// 확장 프로그램 설치 시 초기화
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('숨고 경쟁사 분석기 설치됨');
  console.log('💡 확장을 열면 자동으로 GitHub에서 데이터를 가져옵니다!');
  
  const defaultSettings = {
    autoCollectTime: '09:00',
    isAutoCollectEnabled: true
  };
  
  await chrome.storage.local.set({ settings: defaultSettings });
  setupAlarm(defaultSettings.autoCollectTime);
});

// 알람 설정 함수
function setupAlarm(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const scheduledTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0
  );
  
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }
  
  const delayInMinutes = (scheduledTime - now) / 1000 / 60;
  
  chrome.alarms.clear('dailyCollection');
  chrome.alarms.create('dailyCollection', {
    delayInMinutes: delayInMinutes,
    periodInMinutes: 24 * 60
  });
  
  console.log(`다음 데이터 수집 예정: ${scheduledTime.toLocaleString('ko-KR')}`);
}

// 알람 실행 시 데이터 수집
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyCollection') {
    console.log('자동 데이터 수집 시작');
    collectAllData();
  }
});

// 모든 경쟁사 데이터 수집
async function collectAllData() {
  console.log('=== 데이터 수집 시작 ===');
  
  for (const competitor of competitors) {
    try {
      console.log(`\n${competitor.name} 수집 시작...`);
      await collectCompetitorData(competitor);
      console.log(`${competitor.name} 수집 완료`);
      await sleep(3000); // 3초 대기
    } catch (error) {
      console.error(`${competitor.name} 데이터 수집 실패:`, error);
    }
  }
  
  console.log('\n=== 모든 데이터 수집 완료 ===');
}

// 개별 경쟁사 데이터 수집
async function collectCompetitorData(competitor) {
  return new Promise((resolve, reject) => {
    let isResolved = false;
    let tabId = null;
    let loadListener = null;
    
    chrome.tabs.create({ url: competitor.url, active: false }, (tab) => {
      if (!tab || !tab.id) {
        console.error('탭 생성 실패');
        resolve();
        return;
      }
      
      tabId = tab.id;
      console.log(`탭 생성: ${tabId}`);
      
      loadListener = (updatedTabId, changeInfo) => {
        if (updatedTabId !== tabId) return;
        
        if (changeInfo.status === 'complete' && !isResolved) {
          console.log('페이지 로딩 완료, 데이터 추출 대기...');
          
          // 5초 후 데이터 추출
          setTimeout(async () => {
            if (isResolved) return;
            
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: extractDataFromPage
              });
              
              if (results && results[0] && results[0].result) {
                const data = results[0].result;
                console.log('추출된 데이터:', data);
                
                if (data.hirings > 0 || data.reviews > 0) {
                  await saveData(competitor.id, data);
                  console.log('✅ 데이터 저장 완료');
                } else {
                  console.warn('⚠️ 데이터가 0입니다. 저장하지 않습니다.');
                }
              }
              
              isResolved = true;
              chrome.tabs.onUpdated.removeListener(loadListener);
              await chrome.tabs.remove(tabId);
              resolve();
            } catch (error) {
              console.error('데이터 추출 오류:', error);
              isResolved = true;
              chrome.tabs.onUpdated.removeListener(loadListener);
              try {
                await chrome.tabs.remove(tabId);
              } catch (e) {}
              resolve();
            }
          }, 5000);
        }
      };
      
      chrome.tabs.onUpdated.addListener(loadListener);
      
      // 60초 타임아웃
      setTimeout(() => {
        if (!isResolved) {
          console.warn('⏱️ 타임아웃');
          isResolved = true;
          if (loadListener) {
            chrome.tabs.onUpdated.removeListener(loadListener);
          }
          if (tabId) {
            chrome.tabs.remove(tabId).catch(() => {});
          }
          resolve();
        }
      }, 60000);
    });
  });
}

// 페이지에서 실행될 데이터 추출 함수
function extractDataFromPage() {
  console.log('=== 페이지에서 데이터 추출 시작 ===');
  
  let hirings = 0;
  let reviews = 0;
  
  // 고용수 추출
  try {
    const hiringSelectors = [
      'div.statistics-info > div:first-child div.statistics-info-item-contents',
      'div.statistics-info-item-contents'
    ];
    
    for (const selector of hiringSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`고용 선택자 "${selector}": ${elements.length}개 발견`);
      
      if (elements.length > 0) {
        const text = elements[0].textContent.replace(/[^0-9]/g, '');
        if (text) {
          hirings = parseInt(text) || 0;
          console.log(`✅ 고용수: ${hirings}`);
          break;
        }
      }
    }
  } catch (e) {
    console.error('고용수 추출 오류:', e);
  }
  
  // 리뷰수 추출
  try {
    const reviewSelectors = [
      'div.review-info span.count',
      'span.count'
    ];
    
    for (const selector of reviewSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`리뷰 선택자 "${selector}": ${elements.length}개 발견`);
      
      if (elements.length > 0) {
        const text = elements[0].textContent.replace(/[^0-9]/g, '');
        if (text) {
          reviews = parseInt(text) || 0;
          console.log(`✅ 리뷰수: ${reviews}`);
          break;
        }
      }
    }
  } catch (e) {
    console.error('리뷰수 추출 오류:', e);
  }
  
  console.log('=== 최종 결과 ===', { hirings, reviews });
  
  return {
    hirings: hirings,
    reviews: reviews,
    timestamp: new Date().toISOString()
  };
}

// 데이터 저장
async function saveData(competitorId, data) {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get([competitorId]);
  const competitorData = result[competitorId] || {};
  
  competitorData[today] = data;
  
  const dates = Object.keys(competitorData).sort();
  if (dates.length > 90) {
    const toDelete = dates.slice(0, dates.length - 90);
    toDelete.forEach(date => delete competitorData[date]);
  }
  
  await chrome.storage.local.set({ [competitorId]: competitorData });
}

// 유틸리티: sleep 함수
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 메시지 핸들러
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectNow') {
    collectAllData().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'updateAlarm') {
    setupAlarm(request.time);
    sendResponse({ success: true });
    return true;
  }
});
