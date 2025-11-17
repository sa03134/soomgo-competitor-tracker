const competitors = [
  { id: 'soncoach', name: '손코치' },
  { id: 'seoulcoach', name: '정코치' },
  { id: 'passcoach', name: '패스' }
];

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let weekOffset = 0; // 0=최근 7일, -1=이전 7일
let statsMonthOffset = 0; // 0=현재 표시 월, -1=이전 달

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupEvents();
  loadSettings();
});

// 설정 로드
async function loadSettings() {
  const result = await chrome.storage.local.get(['settings']);
  const settings = result.settings || { autoCollectTime: '09:00', isAutoCollectEnabled: true };
  
  document.getElementById('autoCollectTime').value = settings.autoCollectTime;
  document.getElementById('autoCollectToggle').checked = settings.isAutoCollectEnabled;
}

// 이벤트 설정
function setupEvents() {
  // 수집 버튼
  document.getElementById('collectNowBtn').addEventListener('click', async () => {
    const btn = document.getElementById('collectNowBtn');
    btn.textContent = '수집 중...';
    btn.disabled = true;
    
    chrome.runtime.sendMessage({ action: 'collectNow' }, () => {
      setTimeout(() => {
        btn.textContent = '완료!';
        setTimeout(() => {
          btn.textContent = '지금 수집';
          btn.disabled = false;
          loadData();
        }, 1000);
      }, 2000);
    });
  });

  // 설정 버튼
  document.getElementById('settingsBtn').addEventListener('click', () => {
    const panel = document.getElementById('settingsPanel');
    panel.classList.toggle('hidden');
  });

  // GitHub 동기화 버튼
  document.getElementById('syncGithubBtn').addEventListener('click', async () => {
    const btn = document.getElementById('syncGithubBtn');
    btn.classList.add('loading');
    btn.disabled = true;
    
    try {
      await syncFromGithub();
      alert('✅ GitHub에서 데이터를 가져왔습니다!');
      loadData(); // 화면 새로고침
    } catch (error) {
      alert('❌ 동기화 실패: ' + error.message);
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  // 설정 저장
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const settings = {
      autoCollectTime: document.getElementById('autoCollectTime').value,
      isAutoCollectEnabled: document.getElementById('autoCollectToggle').checked
    };
    
    await chrome.storage.local.set({ settings });
    chrome.runtime.sendMessage({ action: 'updateAlarm', time: settings.autoCollectTime });
    
    document.getElementById('settingsPanel').classList.add('hidden');
  });

  // 월 네비게이션
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    loadData();
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    loadData();
  });
  
  // 주차 통계 네비게이션
  document.getElementById('prevWeekBtn').addEventListener('click', () => {
    weekOffset--;
    updateWeekStats();
  });
  
  document.getElementById('nextWeekBtn').addEventListener('click', () => {
    weekOffset++;
    updateWeekStats();
  });
  
  // 월 통계 네비게이션
  document.getElementById('prevStatMonthBtn').addEventListener('click', () => {
    statsMonthOffset--;
    updateMonthStats();
  });
  
  document.getElementById('nextStatMonthBtn').addEventListener('click', () => {
    statsMonthOffset++;
    updateMonthStats();
  });
}

// 데이터 로드
async function loadData() {
  updateMonthDisplay();
  await updateQuickStats();
  await renderCalendars();
  
  // 통계 오프셋 초기화
  weekOffset = 0;
  statsMonthOffset = 0;
  
  await updateWeekStats();
  await updateMonthStats();
  updateLastUpdate();
}

// 월 표시
function updateMonthDisplay() {
  document.getElementById('currentMonth').textContent = `${currentYear}년 ${currentMonth + 1}월`;
  
  const now = new Date();
  const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const isOneYearAgo = currentYear === oneYearAgo.getFullYear() && currentMonth === oneYearAgo.getMonth();
  
  document.getElementById('nextMonthBtn').disabled = isCurrentMonth;
  document.getElementById('prevMonthBtn').disabled = isOneYearAgo;
}

// 빠른 통계 업데이트
async function updateQuickStats() {
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    const data = result[comp.id] || {};
    const dates = Object.keys(data).sort();
    
    if (dates.length === 0) continue;
    
    const latest = data[dates[dates.length - 1]];
    const qsId = comp.id === 'soncoach' ? 'qs-son' : 
                 comp.id === 'seoulcoach' ? 'qs-seoul' : 'qs-pass';
    
    document.getElementById(qsId).textContent = `${comp.name} ${latest.hirings}/${latest.reviews}`;
    
    // 오늘 증감
    if (dates.length >= 2) {
      const prev = data[dates[dates.length - 2]];
      const hChange = latest.hirings - prev.hirings;
      const rChange = latest.reviews - prev.reviews;
      
      const tdId = comp.id === 'soncoach' ? 'td-son' : 
                   comp.id === 'seoulcoach' ? 'td-seoul' : 'td-pass';
      const tdEl = document.getElementById(tdId);
      
      if (tdEl) {
        const hText = hChange < 0 ? `-${Math.abs(hChange)}` : hChange;
        const rText = rChange < 0 ? `-${Math.abs(rChange)}` : rChange;
        tdEl.textContent = `${hText}/${rText}`;
        tdEl.className = 'today-delta' + (hChange < 0 ? ' neg' : '');
      }
    }
    
    // 패스 연속 일수
    if (comp.id === 'passcoach') {
      const streak = calcStreak(data, dates);
      const streakEl = document.getElementById('streak');
      if (streakEl) {
        if (streak > 0) {
          streakEl.textContent = `🔥${streak}`;
          streakEl.style.display = 'inline-block';
        } else {
          streakEl.style.display = 'none';
        }
      }
    }
  }
}

// 연속 고용 계산 (실제 날짜 기준)
function calcStreak(data, dates) {
  if (dates.length < 2) return 0;
  
  let streak = 0;
  const sorted = dates.sort().reverse(); // 최신 날짜부터
  
  // 오늘부터 거슬러 올라가며 체크
  const today = new Date(sorted[0]); // 가장 최근 날짜
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentDate = sorted[i];
    const nextDate = sorted[i + 1];
    
    const currentData = data[currentDate];
    const nextData = data[nextDate];
    
    if (!currentData || !nextData) break;
    
    // 날짜가 연속된지 확인
    const curr = new Date(currentDate);
    const next = new Date(nextDate);
    const daysDiff = Math.round((curr - next) / (1000 * 60 * 60 * 24));
    
    // 연속되지 않으면 중단
    if (daysDiff > 1) break;
    
    // 고용 증가 체크
    const hiringChange = currentData.hirings - nextData.hirings;
    
    if (hiringChange >= 1) {
      streak++;
    } else {
      break; // 고용이 없으면 연속 중단
    }
  }
  
  return streak;
}

// 1주차 통계 (최근 7일 + 오프셋)
async function updateWeekStats() {
  const tbody = document.getElementById('stats7Body');
  const dateEl = document.getElementById('weekRange');
  const prevBtn = document.getElementById('prevWeekBtn');
  const nextBtn = document.getElementById('nextWeekBtn');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + (weekOffset * 7));
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  
  // 날짜 범위 표시
  if (dateEl) {
    const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
    const endStr = `${endDate.getMonth() + 1}/${endDate.getDate()}`;
    dateEl.textContent = `${startStr} ~ ${endStr}`;
  }
  
  // 버튼 활성화/비활성화
  if (nextBtn) {
    nextBtn.disabled = weekOffset >= 0;
  }
  
  await fillStatsTable(tbody, startDate, endDate);
}

// 월 통계 (현재 표시 월 + 오프셋)
async function updateMonthStats() {
  const tbody = document.getElementById('statsMonthBody');
  const titleEl = document.getElementById('monthStatsTitle');
  const prevBtn = document.getElementById('prevStatMonthBtn');
  const nextBtn = document.getElementById('nextStatMonthBtn');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // 오프셋 적용
  let targetYear = currentYear;
  let targetMonth = currentMonth + statsMonthOffset;
  
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear--;
  }
  while (targetMonth > 11) {
    targetMonth -= 12;
    targetYear++;
  }
  
  const startDate = new Date(targetYear, targetMonth, 1);
  const endDate = new Date(targetYear, targetMonth + 1, 0);
  
  if (titleEl) {
    titleEl.textContent = `${targetYear}년 ${targetMonth + 1}월`;
  }
  
  // 버튼 활성화/비활성화
  const now = new Date();
  if (nextBtn) {
    nextBtn.disabled = (targetYear === now.getFullYear() && targetMonth >= now.getMonth());
  }
  
  await fillStatsTable(tbody, startDate, endDate);
}

// 통계 테이블 채우기
async function fillStatsTable(tbody, startDate, endDate) {
  const stats = [];
  
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    const data = result[comp.id] || {};
    
    const dates = Object.keys(data).filter(date => {
      const d = new Date(date);
      return d >= startDate && d <= endDate;
    }).sort();
    
    if (dates.length < 2) {
      stats.push({ name: comp.name, hChange: 0, rChange: 0, isPass: comp.id === 'passcoach' });
      continue;
    }
    
    const first = data[dates[0]];
    const last = data[dates[dates.length - 1]];
    
    stats.push({
      name: comp.name,
      hChange: last.hirings - first.hirings,
      rChange: last.reviews - first.reviews,
      isPass: comp.id === 'passcoach'
    });
  }
  
  stats.forEach(stat => {
    const tr = document.createElement('tr');
    const hText = stat.hChange < 0 ? `-${Math.abs(stat.hChange)}` : stat.hChange;
    const rText = stat.rChange < 0 ? `-${Math.abs(stat.rChange)}` : stat.rChange;
    
    tr.innerHTML = `
      <td class="${stat.isPass ? 'stat-highlight' : 'stat-name'}">${stat.name}</td>
      <td class="${stat.isPass ? 'stat-highlight' : ''}">${hText}</td>
      <td class="${stat.isPass ? 'stat-highlight' : ''}">${rText}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 통계 업데이트 (삭제 예정 - 호환성 유지)
async function updateStats(days, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  
  const stats = [];
  
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    const data = result[comp.id] || {};
    
    const dates = Object.keys(data).filter(date => {
      const d = new Date(date);
      return d >= startDate && d <= now;
    }).sort();
    
    if (dates.length < 2) {
      stats.push({ name: comp.name, hChange: 0, rChange: 0, isPass: comp.id === 'passcoach' });
      continue;
    }
    
    const first = data[dates[0]];
    const last = data[dates[dates.length - 1]];
    
    stats.push({
      name: comp.name,
      hChange: last.hirings - first.hirings,
      rChange: last.reviews - first.reviews,
      isPass: comp.id === 'passcoach'
    });
  }
  
  stats.forEach(stat => {
    const tr = document.createElement('tr');
    const hText = stat.hChange < 0 ? `-${Math.abs(stat.hChange)}` : stat.hChange;
    const rText = stat.rChange < 0 ? `-${Math.abs(stat.rChange)}` : stat.rChange;
    
    tr.innerHTML = `
      <td class="${stat.isPass ? 'stat-highlight' : 'stat-name'}">${stat.name}</td>
      <td class="${stat.isPass ? 'stat-highlight' : ''}">${hText}</td>
      <td class="${stat.isPass ? 'stat-highlight' : ''}">${rText}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 캘린더 렌더링
async function renderCalendars() {
  for (const comp of competitors) {
    await renderCalendar(comp.id);
  }
}

async function renderCalendar(compId) {
  const calEl = document.getElementById(`cal-${compId}`);
  if (!calEl) return;
  
  const result = await chrome.storage.local.get([compId]);
  const data = result[compId] || {};
  
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  
  calEl.innerHTML = '';
  
  // 요일 헤더
  ['일', '월', '화', '수', '목', '금', '토'].forEach(day => {
    const h = document.createElement('div');
    h.className = 'cal-header-day';
    h.textContent = day;
    calEl.appendChild(h);
  });
  
  // 빈 칸
  for (let i = 0; i < firstDay.getDay(); i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    calEl.appendChild(empty);
  }
  
  // 날짜
  for (let date = 1; date <= lastDay.getDate(); date++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day';
    
    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = date;
    dayEl.appendChild(num);
    
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const todayData = data[dateStr];
    
    if (todayData) {
      const allDates = Object.keys(data).sort();
      const idx = allDates.indexOf(dateStr);
      
      if (idx > 0) {
        const prevData = data[allDates[idx - 1]];
        
        if (prevData) {
          const hChange = todayData.hirings - prevData.hirings;
          const rChange = todayData.reviews - prevData.reviews;
          
          if (hChange !== 0 || rChange !== 0) {
            if (hChange >= 1) {
              dayEl.classList.add('has-hiring');
            }
            
            const dataDiv = document.createElement('div');
            dataDiv.className = 'day-data';
            
            const hSpan = document.createElement('span');
            hSpan.className = 'h-change' + (hChange < 0 ? ' neg' : '');
            hSpan.textContent = hChange < 0 ? `-${Math.abs(hChange)}` : hChange;
            
            const rSpan = document.createElement('span');
            rSpan.className = 'r-change' + (rChange < 0 ? ' neg' : '');
            rSpan.textContent = rChange < 0 ? `-${Math.abs(rChange)}` : rChange;
            
            dataDiv.appendChild(hSpan);
            dataDiv.appendChild(rSpan);
            dayEl.appendChild(dataDiv);
          }
        }
      }
    }
    
    calEl.appendChild(dayEl);
  }
}

// GitHub에서 데이터 가져오기
async function syncFromGithub() {
  // ⚠️ GitHub 저장소 URL (본인 것으로 변경)
  const GITHUB_BASE = 'https://raw.githubusercontent.com/sa03134/soomgo-competitor-tracker/main/collected_data';
  
  const competitors = ['soncoach', 'seoulcoach', 'passcoach'];
  
  for (const compId of competitors) {
    try {
      const url = `${GITHUB_BASE}/${compId}.json`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        // Chrome Storage에 저장
        await chrome.storage.local.set({ [compId]: data });
        
        console.log(`✅ ${compId} 동기화 완료`);
      } else {
        console.log(`⚠️ ${compId} 파일 없음 (${response.status})`);
      }
    } catch (error) {
      console.error(`❌ ${compId} 동기화 실패:`, error);
    }
  }
}

// 마지막 업데이트
function updateLastUpdate() {
  const now = new Date();
  const time = now.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  document.getElementById('lastUpdate').textContent = `업데이트: ${time}`;
}
