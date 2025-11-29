// 전역 변수
const competitors = [
  { id: 'soncoach', name: '손코치', url: 'https://soomgo.com/profile/users/16756708', color: '#4a5568' },
  { id: 'seoulcoach', name: '정코치', url: 'https://soomgo.com/profile/users/3379598', color: '#4a5568' },
  { id: 'passcoach', name: '패스', url: 'https://soomgo.com/profile/users/11571181', color: '#6C3CF2', isMine: true }
];

let currentMonth = new Date();
let currentWeekOffset = 0;
let currentStatMonth = new Date();
let currentTooltip = null;
let hoverTimeout = null;

// GitHub 동기화
async function syncFromGithub() {
  const GITHUB_BASE = 'https://raw.githubusercontent.com/sa03134/soomgo-competitor-tracker/main/collected_data';
  
  // showToast('📥 GitHub에서 데이터 가져오는 중...');
  
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
    
    // showToast('✅ 데이터 동기화 완료!');
    await renderAll();
    updateLastUpdateTime();
  } catch (error) {
    console.error('동기화 오류:', error);
    showToast('❌ 동기화 실패');
  }
}

// 토스트
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

// 캘린더 렌더링
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
    
    // 오늘 날짜 강조
    const today = new Date();
    const isToday = today.getFullYear() === year && 
                    today.getMonth() === month && 
                    today.getDate() === date;
    if (isToday) {
      dayEl.classList.add('today');
    }
    
    if (todayData) {
      const hChange = prevData ? todayData.hirings - prevData.hirings : 0;
      const rChange = prevData ? todayData.reviews - prevData.reviews : 0;
      
      if (hChange > 0) {
        dayEl.classList.add('has-hiring');
      }
      
      // 고용 없는 날 경고 (이전 데이터 있는데 증가 없음)
      if (hChange === 0 && prevData) {
        dayEl.classList.add('no-hiring');
      }
      
      dayEl.innerHTML = `
        <div class="day-num">${date}</div>
        ${hChange !== 0 || rChange !== 0 ? `
          <div class="day-data">
            <span class="h-change ${hChange < 0 ? 'neg' : ''}">${hChange < 0 ? '' : ''}${hChange}</span>
            <span class="r-change ${rChange < 0 ? 'neg' : ''}">${rChange < 0 ? '' : ''}${rChange}</span>
          </div>
        ` : ''}
      `;
      
      // 툴팁 이벤트
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
  
  // 캘린더 헤더에 링크 추가
  updateCalendarHeader(compId, comp);
}

// 캘린더 헤더 링크
function updateCalendarHeader(compId, comp) {
  const calEl = document.getElementById(`cal-${compId}`);
  if (!calEl) return;
  
  const headerEl = calEl.previousElementSibling;
  if (headerEl && headerEl.classList.contains('cal-header')) {
    headerEl.style.cursor = 'pointer';
    headerEl.onclick = () => {
      chrome.tabs.create({ url: comp.url });
    };
  }
}

// 오늘의 델타
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

// 툴팁
function showTooltip(element, comp, dateStr, todayData, prevData) {
  if (!element) return;
  
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
  try {
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    
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
    
    setTimeout(() => tooltip.classList.add('show'), 10);
  } catch (error) {
    console.error('툴팁 위치 오류:', error);
    if (tooltip.parentNode) {
      tooltip.remove();
    }
    currentTooltip = null;
  }
}

function hideTooltip() {
  if (currentTooltip) {
    currentTooltip.classList.remove('show');
    setTimeout(() => {
      if (currentTooltip && currentTooltip.parentNode) {
        currentTooltip.remove();
        currentTooltip = null;
      }
    }, 200);
  }
}

// 연속 고용 (연속된 날짜만 카운트)
async function updateStreak() {
  const result = await chrome.storage.local.get(['passcoach']);
  const data = result.passcoach || {};
  
  const dates = Object.keys(data).sort(); // 오래된 순
  if (dates.length === 0) return;
  
  console.log('=== Streak 계산 시작 ===');
  console.log('전체 날짜:', dates);
  
  let streak = 0;
  
  // 뒤에서부터 (최신부터) 확인
  for (let i = dates.length - 1; i > 0; i--) {
    const todayStr = dates[i];
    const yesterdayStr = dates[i - 1];
    
    const todayData = data[todayStr];
    const yesterdayData = data[yesterdayStr];
    
    // 날짜 간격 확인
    const today = new Date(todayStr);
    const yesterday = new Date(yesterdayStr);
    const dayDiff = Math.floor((today - yesterday) / (1000 * 60 * 60 * 24));
    
    console.log(`${todayStr}(${todayData.hirings}) vs ${yesterdayStr}(${yesterdayData.hirings}): 간격 ${dayDiff}일`);
    
    // 연속된 날짜이고 고용 증가
    if (dayDiff === 1 && todayData.hirings > yesterdayData.hirings) {
      streak++;
      console.log(`  ✅ Streak +1 = ${streak}`);
    } else if (dayDiff > 1) {
      console.log(`  ❌ 날짜 건너뛰기 (${dayDiff}일 간격)`);
      break;
    } else if (todayData.hirings <= yesterdayData.hirings) {
      console.log(`  ❌ 고용 증가 없음`);
      break;
    }
  }
  
  console.log(`최종 Streak: ${streak}일`);
  
  const streakEl = document.getElementById('streak');
  if (streakEl) {
    streakEl.textContent = streak > 0 ? `🔥 ${streak}일` : '';
  }
}

// 빠른 통계
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
      const rating = todayData.rating ? ` ⭐${todayData.rating}` : '';
      qsEl.textContent = `${comp.name} ${todayData.hirings}/${todayData.reviews}${rating}`;
    } else {
      qsEl.textContent = `${comp.name} -/-`;
    }
  }
}

// 통계 테이블
async function updateStats7() {
  const tbody = document.getElementById('stats7Body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  // 현재 월의 첫 번째 일요일 찾기
  const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const firstDayOfWeek = currentMonthStart.getDay();
  
  let firstSunday = new Date(currentMonthStart);
  if (firstDayOfWeek !== 0) {
    firstSunday.setDate(currentMonthStart.getDate() - firstDayOfWeek);
  }
  
  const weekStart = new Date(firstSunday.getTime() + (currentWeekOffset * 7 * 24 * 60 * 60 * 1000));
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  const weekNumber = currentWeekOffset + 1;
  
  const weekRangeEl = document.getElementById('weekRange');
  if (weekRangeEl) {
    weekRangeEl.textContent = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
  }
  
  const weekTitle = document.querySelector('.stat-title');
  if (weekTitle) {
    weekTitle.childNodes[0].textContent = `${weekNumber}주차 `;
  }
  
  // 모든 경쟁자 데이터 수집
  const statsData = [];
  
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    const data = result[comp.id] || {};
    
    let totalH = 0;
    let totalR = 0;
    let daysWithData = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const prevDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      
      const dayData = data[dateStr];
      const prevData = data[prevDateStr];
      
      if (dayData && prevData) {
        totalH += dayData.hirings - prevData.hirings;
        totalR += dayData.reviews - prevData.reviews;
        daysWithData++;
      }
    }
    
    const avgH = daysWithData > 0 ? (totalH / daysWithData).toFixed(1) : '0.0';
    const avgR = daysWithData > 0 ? (totalR / daysWithData).toFixed(1) : '0.0';
    
    statsData.push({ comp, totalH, totalR, avgH, avgR });
  }
  
  // 1등 찾기
  const maxH = Math.max(...statsData.map(s => s.totalH));
  const maxR = Math.max(...statsData.map(s => s.totalR));
  
  // 테이블 렌더링
  for (const stat of statsData) {
    const row = tbody.insertRow();
    const isTopH = stat.totalH === maxH && maxH > 0;
    const isTopR = stat.totalR === maxR && maxR > 0;
    
    row.innerHTML = `
      <td class="stat-name ${stat.comp.isMine ? 'stat-highlight' : ''}">${stat.comp.name}</td>
      <td class="${stat.comp.isMine ? 'stat-highlight' : ''}">
        <div style="font-size: 10px; font-weight: 500; margin-bottom: 1px;">${stat.totalH > 0 ? '+' : ''}${stat.totalH} ${isTopH ? '🥇' : ''}</div>
        <div style="font-size: 8px; color: #6C3CF2; font-weight: 500;">${stat.avgH}/일</div>
      </td>
      <td class="${stat.comp.isMine ? 'stat-highlight' : ''}">
        <div style="font-size: 10px; font-weight: 500; margin-bottom: 1px;">${stat.totalR > 0 ? '+' : ''}${stat.totalR} ${isTopR ? '🥇' : ''}</div>
        <div style="font-size: 8px; color: #6C3CF2; font-weight: 500;">${stat.avgR}/일</div>
      </td>
    `;
  }
}

async function updateStatsMonth() {
  const tbody = document.getElementById('statsMonthBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const year = currentStatMonth.getFullYear();
  const month = currentStatMonth.getMonth();
  
  const titleEl = document.getElementById('monthStatsTitle');
  if (titleEl) {
    titleEl.textContent = `${year}년 ${month + 1}월`;
  }
  
  // 모든 경쟁자 데이터 수집
  const statsData = [];
  
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    const data = result[comp.id] || {};
    
    const dates = Object.keys(data).filter(d => {
      const date = new Date(d);
      return date.getFullYear() === year && date.getMonth() === month;
    }).sort();
    
    let totalH = 0;
    let totalR = 0;
    let daysWithData = 0;
    
    for (let i = 1; i < dates.length; i++) {
      const today = data[dates[i]];
      const yesterday = data[dates[i - 1]];
      
      totalH += today.hirings - yesterday.hirings;
      totalR += today.reviews - yesterday.reviews;
      daysWithData++;
    }
    
    const avgH = daysWithData > 0 ? (totalH / daysWithData).toFixed(1) : '0.0';
    const avgR = daysWithData > 0 ? (totalR / daysWithData).toFixed(1) : '0.0';
    
    statsData.push({ comp, totalH, totalR, avgH, avgR });
  }
  
  // 1등 찾기
  const maxH = Math.max(...statsData.map(s => s.totalH));
  const maxR = Math.max(...statsData.map(s => s.totalR));
  
  // 테이블 렌더링
  for (const stat of statsData) {
    const row = tbody.insertRow();
    const isTopH = stat.totalH === maxH && maxH > 0;
    const isTopR = stat.totalR === maxR && maxR > 0;
    
    row.innerHTML = `
      <td class="stat-name ${stat.comp.isMine ? 'stat-highlight' : ''}">${stat.comp.name}</td>
      <td class="${stat.comp.isMine ? 'stat-highlight' : ''}">
        <div style="font-size: 10px; font-weight: 500; margin-bottom: 1px;">${stat.totalH > 0 ? '+' : ''}${stat.totalH} ${isTopH ? '🥇' : ''}</div>
        <div style="font-size: 8px; color: #6C3CF2; font-weight: 500;">${stat.avgH}/일</div>
      </td>
      <td class="${stat.comp.isMine ? 'stat-highlight' : ''}">
        <div style="font-size: 10px; font-weight: 500; margin-bottom: 1px;">${stat.totalR > 0 ? '+' : ''}${stat.totalR} ${isTopR ? '🥇' : ''}</div>
        <div style="font-size: 8px; color: #6C3CF2; font-weight: 500;">${stat.avgR}/일</div>
      </td>
    `;
  }
}

// 네비게이션
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
  
  // 다음 주 버튼: 현재 주차보다 미래면 비활성화
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  
  // 이번 주 일요일
  const todayWeekStart = new Date(today);
  todayWeekStart.setDate(today.getDate() - today.getDay());
  
  // 이번 달 첫 번째 일요일
  const firstDayOfWeek = monthStart.getDay();
  const firstSunday = new Date(monthStart);
  if (firstDayOfWeek !== 0) {
    firstSunday.setDate(monthStart.getDate() - firstDayOfWeek);
  }
  
  const maxWeekOffset = Math.floor((todayWeekStart - firstSunday) / (7 * 24 * 60 * 60 * 1000));
  
  const nextWeekBtn = document.getElementById('nextWeekBtn');
  if (nextWeekBtn) {
    nextWeekBtn.disabled = currentWeekOffset >= maxWeekOffset;
  }
  
  const nextStatMonthBtn = document.getElementById('nextStatMonthBtn');
  if (nextStatMonthBtn) {
    nextStatMonthBtn.disabled = 
      currentStatMonth.getFullYear() === today.getFullYear() &&
      currentStatMonth.getMonth() === today.getMonth();
  }
}

// 최종 업데이트 시간
function updateLastUpdateTime() {
  const lastUpdateEl = document.getElementById('lastUpdate');
  if (lastUpdateEl) {
    const now = new Date();
    lastUpdateEl.textContent = `업데이트: ${now.getMonth() + 1}월 ${now.getDate()}일 오전 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

// 전체 렌더링
async function renderAll() {
  // 초기 로드 시 오늘이 속한 주차로 설정
  const today = new Date();
  if (today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear()) {
    // 이번 주 일요일 찾기
    const todayWeekStart = new Date(today);
    todayWeekStart.setDate(today.getDate() - today.getDay());
    
    // 이번 달 첫 번째 일요일 찾기
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstDayOfWeek = monthStart.getDay();
    const firstSunday = new Date(monthStart);
    if (firstDayOfWeek !== 0) {
      firstSunday.setDate(monthStart.getDate() - firstDayOfWeek);
    }
    
    // 몇 주차인지 계산
    currentWeekOffset = Math.floor((todayWeekStart - firstSunday) / (7 * 24 * 60 * 60 * 1000));
  }
  
  for (const comp of competitors) {
    await renderCalendar(comp.id);
  }
  
  updateMonthText();
  await updateStreak();
  await updateQuickStats();
  await updateStats7();
  await updateStatsMonth();
  await updateDailyMission();
  updateNavButtons();
}

// 이벤트 리스너
document.addEventListener('DOMContentLoaded', async () => {
  await syncFromGithub();
  
  document.getElementById('collectNowBtn')?.addEventListener('click', async () => {
    await syncFromGithub();
  });
  
  document.getElementById('downloadDataBtn')?.addEventListener('click', async () => {
    await downloadAllData();
  });
  
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('settingsPanel');
    panel?.classList.toggle('hidden');
  });
  
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderAll();
  });
  
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderAll();
  });
  
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
  
  // Quick Stats 클릭
  document.getElementById('qs-son')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://soomgo.com/profile/users/16756708' });
  });
  
  document.getElementById('qs-seoul')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://soomgo.com/profile/users/3379598' });
  });
  
  document.getElementById('qs-pass')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://soomgo.com/profile/users/11571181' });
  });
});

// 데이터 다운로드
async function downloadAllData() {
  const allData = {};
  
  for (const comp of competitors) {
    const result = await chrome.storage.local.get([comp.id]);
    allData[comp.name] = result[comp.id] || {};
  }
  
  // UTF-8 BOM 추가 (Excel 한글 깨짐 방지)
  let csv = '\uFEFF';
  csv += 'Date,Competitor,Hirings,Reviews,Rating,Hiring_Change,Review_Change\n';
  
  for (const [name, data] of Object.entries(allData)) {
    const dates = Object.keys(data).sort();
    
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const dayData = data[date];
      const prevData = i > 0 ? data[dates[i - 1]] : null;
      
      const hChange = prevData ? dayData.hirings - prevData.hirings : 0;
      const rChange = prevData ? dayData.reviews - prevData.reviews : 0;
      
      csv += `${date},${name},${dayData.hirings},${dayData.reviews},${dayData.rating || 0},${hChange},${rChange}\n`;
    }
  }
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `soomgo_data_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  console.log('✅ CSV 다운로드 완료');
}

// 오늘의 미션 업데이트
async function updateDailyMission() {
  const result = await chrome.storage.local.get(['passcoach']);
  const data = result.passcoach || {};
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const todayData = data[todayStr];
  const yesterdayData = data[yesterdayStr];
  
  // 날짜 업데이트
  const missionDateEl = document.getElementById('missionDate');
  if (missionDateEl) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    missionDateEl.textContent = `${today.getMonth() + 1}/${today.getDate()} ${days[today.getDay()]}`;
  }
  
  let completed = 0;
  const total = 3;
  
  if (todayData && yesterdayData) {
    const hChange = todayData.hirings - yesterdayData.hirings;
    
    // 미션 1: 고용 1건
    const mission1 = document.getElementById('mission1');
    if (hChange >= 1) {
      mission1.classList.add('completed');
      mission1.querySelector('.mission-icon').textContent = '✅';
      completed++;
      
      if (todayData.hourly) {
        const hours = Object.keys(todayData.hourly).sort();
        for (const hour of hours) {
          const hourData = todayData.hourly[hour];
          const prevHourIndex = hours.indexOf(hour) - 1;
          const prevHourData = prevHourIndex >= 0 ? todayData.hourly[hours[prevHourIndex]] : yesterdayData;
          
          if (hourData.hirings > prevHourData.hirings) {
            mission1.querySelector('.mission-time').textContent = `${hour} 완료`;
            break;
          }
        }
      }
    }
    
    // 미션 2: 고용 2건
    const mission2 = document.getElementById('mission2');
    if (hChange >= 2) {
      mission2.classList.add('completed');
      mission2.querySelector('.mission-icon').textContent = '✅';
      completed++;
    } else if (hChange >= 1) {
      const now = new Date();
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59);
      const hoursLeft = Math.ceil((endOfDay - now) / (1000 * 60 * 60));
      mission2.querySelector('.mission-time').textContent = `남은 ${hoursLeft}h`;
    }
    
    // 미션 3: 고용 3건
    const mission3 = document.getElementById('mission3');
    if (hChange >= 3) {
      mission3.classList.add('completed');
      mission3.querySelector('.mission-icon').textContent = '✅';
      completed++;
    } else if (hChange >= 2) {
      const now = new Date();
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59);
      const hoursLeft = Math.ceil((endOfDay - now) / (1000 * 60 * 60));
      mission3.querySelector('.mission-time').textContent = `남은 ${hoursLeft}h`;
    }
  }
  
  // 진행률 업데이트
  const percentage = Math.round((completed / total) * 100);
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  if (progressFill) {
    progressFill.style.width = `${percentage}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${completed}/${total} 완료 (${percentage}%)`;
  }
  
  // 연속 달성 계산
  await updateMissionStreak(data);
  
  // 주간 성공 계산
  await updateWeekSuccess(data);
}

// 미션 연속 달성
async function updateMissionStreak(data) {
  const dates = Object.keys(data).sort().reverse(); // 최신부터
  let streak = 0;
  
  for (let i = 0; i < dates.length - 1; i++) {
    const todayStr = dates[i];
    const yesterdayStr = dates[i + 1];
    
    const today = new Date(todayStr);
    const yesterday = new Date(yesterdayStr);
    const dayDiff = Math.floor((today - yesterday) / (1000 * 60 * 60 * 24));
    
    if (dayDiff !== 1) break; // 연속 아님
    
    const todayData = data[todayStr];
    const yesterdayData = data[yesterdayStr];
    
    const hChange = todayData.hirings - yesterdayData.hirings;
    
    // 미션 달성 (고용 1건 이상)
    if (hChange >= 1) {
      streak++;
    } else {
      break;
    }
  }
  
  const streakEl = document.getElementById('missionStreak');
  if (streakEl) {
    streakEl.textContent = `${streak}일`;
  }
}

// 주간 성공 (이번 주 월~오늘까지 고용 1건 이상 달성한 날 / 경과한 날)
async function updateWeekSuccess(data) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = 일요일
  
  // 이번 주 일요일
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);
  
  let successDays = 0;
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (date > today) continue; // 미래는 건너뜀
    
    const todayData = data[dateStr];
    const yesterdayStr = new Date(date.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yesterdayData = data[yesterdayStr];
    
    if (todayData && yesterdayData) {
      const hChange = todayData.hirings - yesterdayData.hirings;
      if (hChange >= 1) {
        successDays++;
      }
    }
  }
  
  const weekSuccessEl = document.getElementById('weekSuccess');
  if (weekSuccessEl) {
    const currentDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 일요일 = 7
    weekSuccessEl.textContent = `${successDays}/${currentDay}일`;
  }
}