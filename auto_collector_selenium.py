"""
숨고 경쟁사 분석 - Selenium 기반 데이터 수집
JavaScript 렌더링 페이지에서 데이터 추출
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import json
import time
from datetime import datetime
import os


class SoomgoSeleniumCollector:
    def __init__(self):
        """초기화"""
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
    
    def setup_driver(self):
        """Chrome 드라이버 설정"""
        options = Options()
        options.add_argument('--headless')  # 백그라운드 실행
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        # webdriver-manager로 자동 설치 및 관리
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    
    def extract_data_from_page(self, driver):
        """Selenium으로 데이터 추출"""
        try:
            # 페이지 로딩 대기
            time.sleep(3)
            
            # 방법 1: XPath로 찾기
            try:
                # "고용 507회" 같은 텍스트 찾기
                hiring_element = driver.find_element(By.XPATH, "//*[contains(text(), '고용')]")
                hiring_text = hiring_element.text
                hirings = int(''.join(filter(str.isdigit, hiring_text)))
            except:
                hirings = 0
            
            try:
                # "리뷰 205개" 같은 텍스트 찾기
                review_element = driver.find_element(By.XPATH, "//*[contains(text(), '리뷰')]")
                review_text = review_element.text
                # 숫자만 추출하되, 가장 큰 숫자 선택 (리뷰 개수가 클 것)
                import re
                numbers = re.findall(r'\d+', review_text)
                if numbers:
                    reviews = max([int(n) for n in numbers])
            except:
                reviews = 0
            
            # 방법 2: 페이지 전체 텍스트에서 정규식으로 찾기
            if hirings == 0 and reviews == 0:
                import re
                page_text = driver.find_element(By.TAG_NAME, 'body').text
                
                hiring_match = re.search(r'고용[^\d]*(\d+)', page_text)
                if hiring_match:
                    hirings = int(hiring_match.group(1))
                
                # 리뷰는 더 큰 숫자 찾기 (100 이상)
                review_match = re.search(r'리뷰[^\d]*(\d{2,3})', page_text)
                if review_match:
                    reviews = int(review_match.group(1))
            
            return hirings, reviews
            
        except Exception as e:
            print(f"  ❌ 데이터 추출 오류: {e}")
            return 0, 0
    
    def collect_competitor_data(self, driver, competitor_id):
        """특정 경쟁사 데이터 수집"""
        competitor = self.competitors.get(competitor_id)
        if not competitor:
            return None
        
        url = competitor['url']
        name = competitor['name']
        
        print(f"🔍 {name} 수집 중...")
        print(f"   URL: {url}")
        
        try:
            # 페이지 열기
            driver.get(url)
            print(f"  ✅ 페이지 로드 완료")
            
            # 데이터 추출
            hirings, reviews = self.extract_data_from_page(driver)
            
            print(f"  추출 결과: 고용 {hirings}, 리뷰 {reviews}")
            
            if hirings == 0 and reviews == 0:
                print(f"  ⚠️  데이터 추출 실패")
                # HTML 저장 (디버깅용)
                with open(f'debug_{competitor_id}_selenium.html', 'w', encoding='utf-8') as f:
                    f.write(driver.page_source)
                print(f"  💾 debug_{competitor_id}_selenium.html 저장됨")
            
            data = {
                'hirings': hirings,
                'reviews': reviews,
                'timestamp': datetime.now().isoformat(),
                'date': datetime.now().strftime('%Y-%m-%d')
            }
            
            print(f"  ✅ {name}: 고용 {hirings}, 리뷰 {reviews}")
            return data
            
        except Exception as e:
            print(f"  ❌ 수집 실패: {e}")
            return None
    
    def save_data(self, competitor_id, data):
        """데이터 저장"""
        if not data:
            return
        
        os.makedirs('collected_data', exist_ok=True)
        filepath = f'collected_data/{competitor_id}.json'
        
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                storage_data = json.load(f)
        else:
            storage_data = {}
        
        date_key = data['date']
        storage_data[date_key] = {
            'hirings': data['hirings'],
            'reviews': data['reviews']
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(storage_data, f, ensure_ascii=False, indent=2)
        
        print(f"💾 {competitor_id} 데이터 저장 완료")
        print(f"   파일: {filepath}\n")
    
    def collect_all(self):
        """모든 경쟁사 데이터 수집"""
        print(f"\n{'='*60}")
        print(f"🔍 데이터 수집 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")
        
        # 드라이버 시작
        print("🌐 Chrome 브라우저 시작 중...")
        driver = self.setup_driver()
        
        try:
            success_count = 0
            
            for competitor_id in self.competitors.keys():
                data = self.collect_competitor_data(driver, competitor_id)
                if data and (data['hirings'] > 0 or data['reviews'] > 0):
                    self.save_data(competitor_id, data)
                    success_count += 1
                time.sleep(2)
            
            print(f"{'='*60}")
            print(f"✅ 수집 완료! ({success_count}/{len(self.competitors)})")
            print(f"{'='*60}\n")
            
        finally:
            driver.quit()
            print("🌐 Chrome 브라우저 종료")


def main():
    print("=" * 60)
    print("🎯 숨고 경쟁사 분석 - Selenium 데이터 수집")
    print("=" * 60)
    print()
    
    collector = SoomgoSeleniumCollector()
    
    print("📋 설정 확인:")
    for comp_id, comp_info in collector.competitors.items():
        print(f"   {comp_info['name']}: {comp_info['url']}")
    print()
    
    collector.collect_all()


if __name__ == '__main__':
    main()
