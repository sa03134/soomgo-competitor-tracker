// =========================================
// 숨고 경쟁사 분석 - 메인 로직
// v10.1.0 - 툴팁 버그 수정, 손코치 정보 표시
// =========================================

// 전역 변수
const competitors = [
  { id: 'soncoach', name: '손코치', color: '#4a5568' },
  { id: 'seoulcoach', name: '정코치', color: '#4a5568' },
  { id: 'passcoach', name: '패스', color: '#6C3CF2', isMine: true }
];

let currentMonth = new Date();
let currentWeekOffset = 0;
let currentStatMonth = new Date();
let currentTooltip = null;
let hoverTimeout = null;

// =========================================
// GitHub 동기화
// =========================================

async function syncFromGithub() {
  const GITHUB_BASE = 'https://raw.githubusercontent.com/sa03134/soomgo-competitor-tracker/main/collected_data';
  
  showToast('📥 GitHub에서 데이터 가져오는 중...');
  
  try {
    for (const comp of competitors) {
      const url = `${GITHUB_BASE}/${comp.id}.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`⚠️ ${comp.id} 데이터 없음`);
        continue;
      }
      
      const data = await response.json();
      await chrome.storage.local.set({ [comp.id]: data });
      console.log(`✅ ${comp.name} 데이터 저장 완료`);
    }
    
    showToast('✅ 데이터 동기화 완료!');
    await renderAll();
    updateLastUpdateTime();
  } catch (error) {
    console.error('동기화 오류:', error);
    showToast('❌ 동기화 실패');
  }
}

// =========================================
// 토스트 알림
// =========================================

function showToast(message) {
  let toast = document.querySelector('.toast');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// =========================================
// 캘린더 렌더링
// =========================================

async function renderCalendar(compId) {
  const comp = competitors.find(c => c.id === compId);
  if (!comp) return;
  
  const result = await chrome.storage.local.get([compId]);
  const data = result[compId] || {};
  
  const calEl = document.getElementById(`cal-${compId}`);
  if (!calEl) return;
  
  calEl.innerHTML = '';
  
  // 요일 헤더
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  days.forEach(day => {
    const dayEl = document.createElement('div');
    dayEl.className = 'cal-header-day';
    dayEl.textContent = day;
    calEl.appendChild(dayEl);
  });
  
  // 날짜 계산
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  
  // 빈 셀
  for (let i = 0; i < startDay; i++) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'cal-day empty';
    calEl.appendChild(emptyEl);
  }
  
  // 날짜별 데이터
  let prevData = null;
  const dates = Object.keys(data).sort();
  
  for (let date = 1; date <= lastDay.getDate(); date++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const todayData = data[dateStr];
    
    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day';
    
    if (todayData) {
      const hChange = prevData ? todayData.hirings - prevData.hirings : 0;
      const rChange = prevData ? todayData.reviews - prevData.reviews : 0;
      
      if (hChange > 0) {
        dayEl.classList.add('has-hiring');
      }
      
      dayEl.innerHTML = `
        <div class="day-num">${date}</div>
        ${hChange !== 0 || rChange !== 0 ? `
          <div class="day-data">
            <span class="h-change ${hChange < 0 ? 'neg' : ''}">${hChange > 0 ? '+' : ''}${hChange}</span>
            <span class="r-change ${rChange < 0 ? 'neg' : ''}">${rChange > 0 ? '+' : ''}${rChange}</span>
          </div>
        ` : ''}
      `;
      
      // 툴팁 이벤트 (debounce 적용)
      dayEl.addEventListener('mouseenter', (e) => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        
        hoverTimeout = setTimeout(() => {
          showTooltip(e.currentTarget, comp, dateStr, todayData, prevData);
        }, 100);
      });
      
      dayEl.addEventListener('mouseleave', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        hideTooltip();
      });
      
      prevData = todayData;
    } else {
      dayEl.innerHTML = `<div class="day-num">${date}</div>`;
    }
    
    calEl.appendChild(dayEl);
  }
  
  // 오늘의 델타 업데이트
  updateTodayDelta(compId, data);
}

// =========================================
// 오늘의 델타 (Today Delta) 업데이트
// =========================================

function updateTodayDelta(compId, data) {
  const today = new Date().toISOString().split('T')[0];
  const todayData = data[today];
  
  const dates = Object.keys(data).sort();
  const todayIndex = dates.indexOf(today);
  const yesterdayData = todayIndex > 0 ? data[dates[todayIndex - 1]] : null;
  
  const tdEl = document.getElementById(`td-${compId === 'soncoach' ? 'son' : compId === 'seoulcoach' ? 'seoul' : 'pass'}`);
  if (!tdEl) return;
  
  if (!todayData || !yesterdayData) {
    tdEl.textContent = '-';
    tdEl.className = 'today-delta';
    return;
  }
  
  const hChange = todayData.hirings - yesterdayData.hirings;
  const rChange = todayData.reviews - yesterdayData.reviews;
  
  tdEl.textContent = `${hChange > 0 ? '+' : ''}${hChange}/${rChange > 0 ? '+' : ''}${rChange}`;
  tdEl.className = hChange < 0 || rChange < 0 ? 'today-delta neg' : 'today-delta';
}

// =========================================
// 툴팁 표시/숨김
// =========================================

function showTooltip(element, comp, dateStr, todayData, prevData) {
  // 기존 툴팁 즉시 제거
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
  
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  
  const hChange = prevData ? todayData.hirings - prevData.hirings : 0;
  const rChange = prevData ? todayData.reviews - prevData.reviews : 0;
  
  let tooltipHTML = `
    <div class="tooltip-header">${comp.name} - ${dateStr}</div>
    <div class="tooltip-body">
      <div class="tooltip-row">
        <span class="tooltip-label">고용</span>
        <span class="tooltip-value">${todayData.hirings}</span>
        ${hChange !== 0 ? `<span class="tooltip-change ${hChange > 0 ? 'positive' : 'negative'}">${hChange > 0 ? '+' : ''}${hChange}</span>` : ''}
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">리뷰</span>
        <span class="tooltip-value">${todayData.reviews}</span>
        ${rChange !== 0 ? `<span class="tooltip-change ${rChange > 0 ? 'positive' : 'negative'}">${rChange > 0 ? '+' : ''}${rChange}</span>` : ''}
      </div>
      ${todayData.rating ? `
        <div class="tooltip-row">
          <span class="tooltip-label">평점</span>
          <span class="tooltip-value">${todayData.rating}</span>
        </div>
      ` : ''}
    </div>
  `;
  
  // 시간대별 데이터
  if (todayData.hourly) {
    const hours = Object.keys(todayData.hourly).sort();
    
    if (hours.length > 0) {
      tooltipHTML += `<div class="tooltip-hourly">`;
      
      hours.forEach((hour, index) => {
        const hourData = todayData.hourly[hour];
        const prevHourData = index > 0 ? todayData.hourly[hours[index - 1]] : prevData;
        
        const hDiff = prevHourData ? hourData.hirings - prevHourData.hirings : 0;
        const rDiff = prevHourData ? hourData.reviews - prevHourData.reviews : 0;
        
        tooltipHTML += `
          <div class="hourly-item">
            <span class="hourly-time">${hour}</span>
            <span class="hourly-values">${hourData.hirings}/${hourData.reviews}</span>
            ${hDiff !== 0 || rDiff !== 0 ? `<span class="hourly-diff">(${hDiff > 0 ? '+' : ''}${hDiff}/${rDiff > 0 ? '+' : ''}${rDiff})</span>` : ''}
          </div>
        `;
      });
      
      tooltipHTML += `</div>`;
    }
  }
  
  tooltip.innerHTML = tooltipHTML;
  document.body.appendChild(tooltip);
  currentTooltip = tooltip;
  
  // 위치 계산
  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let top = rect.top - tooltipRect.height - 8;
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  
  // 화면 밖으로 나가지 않게
  if (top < 0) {
    top = rect.bottom + 8;
  }
  if (left < 0) {
    left = 8;
  }
  if (left + tooltipRect.width > window.innerWidth) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  
  // 애니메이션
  setTimeout(() => tooltip.classList.add('show'), 10);
}

function hideTooltip() {
  if (currentTooltip) {
    currentTooltip.classList.remove('show');
    setTimeout(() => {
      if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
      }
    }, 200);
  }
}

// =========================================
// 연속 고용 일수 계산
// =========================================

async function updateStreak() {
  const result = await chrome.storage.local.get(['passcoach']);
  const data = result.passcoach || {};
  
  const dates = Object.keys(data).sort().reverse();
  let streak = 0;
  
  for (let i = 0; i < dates.length - 1; i++) {
    const today = data[dates[i]];
    const yesterday = data[dates[i + 1]];
    
    if (today.hirings > yesterday.hirings) {
      streak++;
    } else {
      break;
    }
  }
  
  const streakEl = document.getElementById('streak');
  if (streakEl) {
    streakEl.textContent = streak > 0 ? `🔥 ${streak}일` : '';
  }
}

// =========================================
// 빠른 통계 (Quick Stats)
// =========================================

async function updateQuickStats() {
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    const data = result[comp.id] || {};
    
    const today = new Date().toISOString().split('T')[0];
    const todayData = data[today];
    
    const qsId = comp.id === 'soncoach' ? 'qs-son' : comp.id === 'seoulcoach' ? 'qs-seoul' : 'qs-pass';
    const qsEl = document.getElementById(qsId);
    
    if (!qsEl) continue;
    
    if (todayData) {
      qsEl.textContent = `${comp.name.substring(0, 1)} ${todayData.hirings}/${todayData.reviews}`;
    } else {
      qsEl.textContent = `${comp.name.substring(0, 1)} -/-`;
    }
  }
}

// =========================================
// 통계 테이블
// =========================================

async function updateStats7() {
  const tbody = document.getElementById('stats7Body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  // 주차 계산
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = currentWeekOffset * 7;
  const weekStart = new Date(startOfMonth.getTime() + offset * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  // 범위 표시
  const weekRangeEl = document.getElementById('weekRange');
  if (weekRangeEl) {
    weekRangeEl.textContent = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
  }
  
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    const data = result[comp.id] || {};
    
    let totalH = 0;
    let totalR = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = data[dateStr];
      
      if (dayData) {
        const dates = Object.keys(data).sort();
        const index = dates.indexOf(dateStr);
        const prevData = index > 0 ? data[dates[index - 1]] : null;
        
        if (prevData) {
          totalH += dayData.hirings - prevData.hirings;
          totalR += dayData.reviews - prevData.reviews;
        }
      }
    }
    
    const row = tbody.insertRow();
    row.innerHTML = `
      <td class="stat-name ${comp.isMine ? 'stat-highlight' : ''}">${comp.name}</td>
      <td class="${comp.isMine ? 'stat-highlight' : ''}">${totalH > 0 ? '+' : ''}${totalH}</td>
      <td class="${comp.isMine ? 'stat-highlight' : ''}">${totalR > 0 ? '+' : ''}${totalR}</td>
    `;
  }
}

async function updateStatsMonth() {
  const tbody = document.getElementById('statsMonthBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const year = currentStatMonth.getFullYear();
  const month = currentStatMonth.getMonth();
  
  // 제목 업데이트
  const titleEl = document.getElementById('monthStatsTitle');
  if (titleEl) {
    titleEl.textContent = `${year}년 ${month + 1}월`;
  }
  
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    const data = result[comp.id] || {};
    
    const dates = Object.keys(data).filter(d => {
      const date = new Date(d);
      return date.getFullYear() === year && date.getMonth() === month;
    }).sort();
    
    let totalH = 0;
    let totalR = 0;
    
    for (let i = 1; i < dates.length; i++) {
      const today = data[dates[i]];
      const yesterday = data[dates[i - 1]];
      
      totalH += today.hirings - yesterday.hirings;
      totalR += today.reviews - yesterday.reviews;
    }
    
    const row = tbody.insertRow();
    row.innerHTML = `
      <td class="stat-name ${comp.isMine ? 'stat-highlight' : ''}">${comp.name}</td>
      <td class="${comp.isMine ? 'stat-highlight' : ''}">${totalH > 0 ? '+' : ''}${totalH}</td>
      <td class="${comp.isMine ? 'stat-highlight' : ''}">${totalR > 0 ? '+' : ''}${totalR}</td>
    `;
  }
}

// =========================================
// 네비게이션
// =========================================

function updateMonthText() {
  const monthText = document.getElementById('currentMonth');
  if (monthText) {
    monthText.textContent = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
  }
}

function updateNavButtons() {
  const today = new Date();
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  
  if (nextMonthBtn) {
    nextMonthBtn.disabled = 
      currentMonth.getFullYear() === today.getFullYear() &&
      currentMonth.getMonth() === today.getMonth();
  }
  
  const nextWeekBtn = document.getElementById('nextWeekBtn');
  if (nextWeekBtn) {
    nextWeekBtn.disabled = currentWeekOffset >= 0;
  }
  
  const nextStatMonthBtn = document.getElementById('nextStatMonthBtn');
  if (nextStatMonthBtn) {
    nextStatMonthBtn.disabled = 
      currentStatMonth.getFullYear() === today.getFullYear() &&
      currentStatMonth.getMonth() === today.getMonth();
  }
}

// =========================================
// 최종 업데이트 시간
// =========================================

function updateLastUpdateTime() {
  const lastUpdateEl = document.getElementById('lastUpdate');
  if (lastUpdateEl) {
    const now = new Date();
    lastUpdateEl.textContent = `업데이트: ${now.getMonth() + 1}월 ${now.getDate()}일 오전 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

// =========================================
// 전체 렌더링
// =========================================

async function renderAll() {
  for (const comp of competitors) {
    await renderCalendar(comp.id);
  }
  
  updateMonthText();
  await updateStreak();
  await updateQuickStats();
  await updateStats7();
  await updateStatsMonth();
  updateNavButtons();
}

// =========================================
// 이벤트 리스너
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  // 초기 렌더링
  await syncFromGithub();
  
  // 새로고침
  document.getElementById('collectNowBtn')?.addEventListener('click', async () => {
    await syncFromGithub();
  });
  
  // 설정
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('settingsPanel');
    panel?.classList.toggle('hidden');
  });
  
  // 월 네비게이션
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderAll();
  });
  
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderAll();
  });
  
  // 주차 네비게이션
  document.getElementById('prevWeekBtn')?.addEventListener('click', () => {
    currentWeekOffset--;
    updateStats7();
    updateNavButtons();
  });
  
  document.getElementById('nextWeekBtn')?.addEventListener('click', () => {
    currentWeekOffset++;
    updateStats7();
    updateNavButtons();
  });
  
  // 월 통계 네비게이션
  document.getElementById('prevStatMonthBtn')?.addEventListener('click', () => {
    currentStatMonth.setMonth(currentStatMonth.getMonth() - 1);
    updateStatsMonth();
    updateNavButtons();
  });
  
  document.getElementById('nextStatMonthBtn')?.addEventListener('click', () => {
    currentStatMonth.setMonth(currentStatMonth.getMonth() + 1);
    updateStatsMonth();
    updateNavButtons();
  });
});