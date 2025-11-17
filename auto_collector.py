"""
숨고 경쟁사 분석 - 자동 데이터 수집
실제 웹 페이지를 크롤링하여 데이터를 수집합니다.
"""

import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime
import os
import re


class SoomgoCompetitorCollector:
    def __init__(self):
        """초기화"""
        self.base_url = "https://soomgo.com"
        
        # 실제 경쟁사 프로필 URL
        self.competitors = {
            'soncoach': {
                'url': 'https://soomgo.com/profile/users/16756708',
                'name': '손코치'
            },
            'seoulcoach': {
                'url': 'https://soomgo.com/profile/users/3379598',
                'name': '정코치'
            },
            'passcoach': {
                'url': 'https://soomgo.com/profile/users/11571181',
                'name': '패스'
            }
        }
        
    def get_headers(self):
        """실제 브라우저처럼 보이게 헤더 설정"""
        return {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://soomgo.com',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
        }
    
    def extract_numbers_from_html(self, html_content):
        """
        HTML에서 고용/리뷰 숫자 추출
        
        숨고 프로필 페이지 구조:
        - "고용 507" 같은 형식
        - "리뷰 205" 같은 형식
        """
        soup = BeautifulSoup(html_content, 'html.parser')
        
        hirings = 0
        reviews = 0
        
        try:
            # 방법 1: 텍스트에서 직접 찾기
            text = soup.get_text()
            
            # "고용 507" 형식 찾기
            hiring_match = re.search(r'고용[:\s]*(\d+)', text)
            if hiring_match:
                hirings = int(hiring_match.group(1))
            
            # "리뷰 205" 형식 찾기
            review_match = re.search(r'리뷰[:\s]*(\d+)', text)
            if review_match:
                reviews = int(review_match.group(1))
            
            # 방법 2: 특정 클래스/ID로 찾기 (숨고 구조에 맞게 수정 필요)
            # hiring_element = soup.find('div', class_='hiring-count')
            # if hiring_element:
            #     hirings = int(hiring_element.text.strip())
            
            print(f"  추출 결과: 고용 {hirings}, 리뷰 {reviews}")
            
        except Exception as e:
            print(f"  ❌ 숫자 추출 실패: {e}")
        
        return hirings, reviews
    
    def collect_competitor_data(self, competitor_id):
        """특정 경쟁사 데이터 수집"""
        competitor = self.competitors.get(competitor_id)
        if not competitor:
            print(f"❌ {competitor_id} 설정 없음")
            return None
        
        url = competitor['url']
        name = competitor['name']
        
        print(f"🔍 {name} 수집 중...")
        print(f"   URL: {url}")
        
        try:
            # 웹 페이지 가져오기
            response = requests.get(url, headers=self.get_headers(), timeout=15)
            
            if response.status_code == 200:
                print(f"  ✅ 페이지 로드 성공")
                
                # HTML에서 숫자 추출
                hirings, reviews = self.extract_numbers_from_html(response.text)
                
                if hirings == 0 and reviews == 0:
                    print(f"  ⚠️  데이터 추출 실패 - HTML 구조 확인 필요")
                    # HTML 일부 저장 (디버깅용)
                    with open(f'debug_{competitor_id}.html', 'w', encoding='utf-8') as f:
                        f.write(response.text[:5000])  # 처음 5000자만
                    print(f"  💾 debug_{competitor_id}.html 저장됨 (구조 확인용)")
                
                data = {
                    'hirings': hirings,
                    'reviews': reviews,
                    'timestamp': datetime.now().isoformat(),
                    'date': datetime.now().strftime('%Y-%m-%d')
                }
                
                print(f"  ✅ {name}: 고용 {hirings}, 리뷰 {reviews}")
                return data
            else:
                print(f"  ❌ HTTP {response.status_code} - URL 확인 필요")
                return None
                
        except requests.exceptions.Timeout:
            print(f"  ❌ 타임아웃 - 네트워크 확인")
            return None
        except requests.exceptions.RequestException as e:
            print(f"  ❌ 요청 실패: {e}")
            return None
    
    def save_data(self, competitor_id, data):
        """Chrome Storage 형식으로 데이터 저장"""
        if not data:
            return
        
        # data 디렉토리 생성
        os.makedirs('collected_data', exist_ok=True)
        
        # 기존 데이터 로드
        filepath = f'collected_data/{competitor_id}.json'
        
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                storage_data = json.load(f)
        else:
            storage_data = {}
        
        # 날짜별로 저장 (Chrome Storage와 동일한 형식)
        date_key = data['date']
        storage_data[date_key] = {
            'hirings': data['hirings'],
            'reviews': data['reviews']
        }
        
        # 저장
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(storage_data, f, ensure_ascii=False, indent=2)
        
        print(f"💾 {competitor_id} 데이터 저장 완료")
        print(f"   파일: {filepath}")
    
    def collect_all(self):
        """모든 경쟁사 데이터 수집"""
        print(f"\n{'='*60}")
        print(f"🔍 데이터 수집 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")
        
        success_count = 0
        
        for competitor_id in self.competitors.keys():
            data = self.collect_competitor_data(competitor_id)
            if data and (data['hirings'] > 0 or data['reviews'] > 0):
                self.save_data(competitor_id, data)
                success_count += 1
            time.sleep(3)  # 요청 간 대기 (서버 부하 방지)
            print()
        
        print(f"{'='*60}")
        print(f"✅ 수집 완료! ({success_count}/{len(self.competitors)})")
        print(f"{'='*60}\n")
    
    def run_continuous(self, interval_minutes=60):
        """
        주기적으로 데이터 수집 (무한 루프)
        
        interval_minutes: 수집 주기 (분)
        """
        print(f"🤖 자동 수집 시작 (주기: {interval_minutes}분)")
        print(f"종료하려면 Ctrl+C를 누르세요\n")
        
        try:
            while True:
                self.collect_all()
                
                # 다음 수집 시간 계산
                next_time = datetime.now()
                next_hour = (next_time.hour + interval_minutes // 60) % 24
                next_minute = (next_time.minute + interval_minutes % 60) % 60
                
                print(f"⏰ 다음 수집: {next_hour:02d}:{next_minute:02d}")
                print(f"대기 중...\n")
                
                time.sleep(interval_minutes * 60)
                
        except KeyboardInterrupt:
            print("\n\n🛑 수집 중단됨")


def main():
    """메인 실행 함수"""
    
    print("=" * 60)
    print("🎯 숨고 경쟁사 분석 - 자동 데이터 수집")
    print("=" * 60)
    print()
    
    # 수집기 생성
    collector = SoomgoCompetitorCollector()
    
    # ✅ 설정 확인
    print("📋 설정 확인:")
    for comp_id, comp_info in collector.competitors.items():
        print(f"   {comp_info['name']}: {comp_info['url']}")
    print()
    
    # 실행 모드 선택
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        # 1회만 수집
        collector.collect_all()
    else:
        # 지속적 수집
        COLLECT_INTERVAL = 60  # 60분마다
        collector.run_continuous(interval_minutes=COLLECT_INTERVAL)


if __name__ == '__main__':
    main()
