"""
숨고 경쟁사 분석 - Selenium 기반 데이터 수집
JavaScript 렌더링 페이지에서 데이터 추출
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import json
import time
from datetime import datetime
import os
import re


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
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # webdriver-manager로 자동 설치 및 관리
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            return driver
        except Exception as e:
            print(f"  ❌ Chrome 드라이버 초기화 실패: {e}")
            print(f"  💡 해결 방법: pip install --upgrade selenium webdriver-manager")
            raise
    
    def extract_data_from_page(self, driver):
        """Selenium으로 데이터 추출"""
        try:
            # 페이지 로딩 대기
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            time.sleep(3)  # JavaScript 렌더링 대기
            
            hirings = 0
            reviews = 0
            
            # 방법 1: CSS Selector로 정확한 위치에서 가져오기
            try:
                # 고용 수 - 첫 번째 statistics-info-item-contents
                hiring_element = driver.find_element(
                    By.CSS_SELECTOR, 
                    'div.statistics-info > div:nth-child(1) > div.statistics-info-item-contents'
                )
                hiring_text = hiring_element.text
                # "1,009회" -> 1009
                hirings = int(hiring_text.replace('회', '').replace(',', '').strip())
                print(f"  📊 고용 추출: {hiring_text} → {hirings}")
            except Exception as e:
                print(f"  ⚠️  고용 추출 실패 (방법 1): {e}")
            
            try:
                # 리뷰 수 - review-info의 span.count
                review_element = driver.find_element(
                    By.CSS_SELECTOR,
                    'div.statistics-info-item.review-info > div.statistics-info-item-contents > span.count'
                )
                review_text = review_element.text
                # "5.0 (571)" -> 571
                reviews = int(review_text.replace('(', '').replace(')', '').replace(',', '').strip())
                print(f"  ⭐ 리뷰 추출: {review_text} → {reviews}")
            except Exception as e:
                print(f"  ⚠️  리뷰 추출 실패 (방법 1): {e}")
            
            # 방법 2: Fallback - 전체 텍스트에서 정규식으로 찾기
            if hirings == 0 or reviews == 0:
                print(f"  🔄 대체 방법으로 재시도...")
                page_text = driver.find_element(By.TAG_NAME, 'body').text
                
                if hirings == 0:
                    # "고용\n1,009회" 패턴
                    hiring_match = re.search(r'고용\s*[\n\s]*([0-9,]+)\s*회', page_text)
                    if hiring_match:
                        hirings = int(hiring_match.group(1).replace(',', ''))
                        print(f"  📊 고용 추출 (방법 2): {hirings}")
                
                if reviews == 0:
                    # "5.0 (571)" 패턴
                    review_match = re.search(r'5\.0\s*\(([0-9,]+)\)', page_text)
                    if review_match:
                        reviews = int(review_match.group(1).replace(',', ''))
                        print(f"  ⭐ 리뷰 추출 (방법 2): {reviews}")
            
            print(f"  ✅ 최종 결과: 고용 {hirings}, 리뷰 {reviews}")
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
            
            if hirings == 0 and reviews == 0:
                print(f"  ⚠️  데이터 추출 실패 - HTML 구조 확인 필요")
                # HTML 저장 (디버깅용)
                try:
                    with open(f'debug_{competitor_id}_selenium.html', 'w', encoding='utf-8') as f:
                        f.write(driver.page_source)
                    print(f"  💾 debug_{competitor_id}_selenium.html 저장됨")
                except:
                    pass
            else:
                print(f"  ✅ {name}: 고용 {hirings}, 리뷰 {reviews}")
            
            data = {
                'hirings': hirings,
                'reviews': reviews,
                'timestamp': datetime.now().isoformat(),
                'date': datetime.now().strftime('%Y-%m-%d')
            }
            
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
        try:
            driver = self.setup_driver()
            print("✅ Chrome 브라우저 시작 완료\n")
        except Exception as e:
            print(f"❌ Chrome 브라우저 시작 실패: {e}")
            return
        
        try:
            success_count = 0
            
            for competitor_id in self.competitors.keys():
                data = self.collect_competitor_data(driver, competitor_id)
                if data and (data['hirings'] > 0 or data['reviews'] > 0):
                    self.save_data(competitor_id, data)
                    success_count += 1
                elif data:
                    # 0/0이라도 저장 (디버깅용)
                    self.save_data(competitor_id, data)
                
                time.sleep(2)  # 요청 간 대기
            
            print(f"{'='*60}")
            print(f"✅ 수집 완료! ({success_count}/{len(self.competitors)})")
            print(f"{'='*60}\n")
            
        except KeyboardInterrupt:
            print("\n\n⚠️  사용자에 의해 중단됨")
        except Exception as e:
            print(f"\n❌ 수집 중 오류 발생: {e}")
        finally:
            driver.quit()
            print("🌐 Chrome 브라우저 종료\n")


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
    
    # 수집된 데이터 요약
    print("📊 수집된 데이터:")
    for comp_id in collector.competitors.keys():
        filepath = f'collected_data/{comp_id}.json'
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                dates = sorted(data.keys())
                if dates:
                    latest = data[dates[-1]]
                    print(f"   {collector.competitors[comp_id]['name']}: "
                          f"고용 {latest['hirings']}, 리뷰 {latest['reviews']} "
                          f"({dates[-1]})")
    print()


if __name__ == '__main__':
    main()