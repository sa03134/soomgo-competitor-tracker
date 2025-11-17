"""
숨고 경쟁사 분석 - Selenium (최적화)
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import json
import time
import re
from datetime import datetime
import os

class SoomgoSeleniumCollector:
    def __init__(self):
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
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-images')  # 이미지 로딩 안함 (속도 향상)
        options.add_argument('--blink-settings=imagesEnabled=false')  # 이미지 비활성화
        options.page_load_strategy = 'eager'  # DOM 준비 후 바로 실행
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(20)  # 타임아웃 설정
        return driver
    
    def extract_data_from_page(self, driver):
        try:
            # WebDriverWait 사용 (더 스마트한 대기)
            wait = WebDriverWait(driver, 10)
            
            # 통계 정보가 나타날 때까지 대기
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.statistics-info")))
            
            hirings = 0
            reviews = 0
            rating = 0.0
            
            # 고용수 - 개선된 선택자
            hiring_selectors = [
                "div.statistics-info > div:first-of-type div.statistics-info-item-contents",
                "div.statistics-info-item-contents"
            ]
            
            for selector in hiring_selectors:
                try:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        text = elements[0].text.replace(',', '').replace('회', '').strip()
                        numbers = re.findall(r'\d+', text)
                        if numbers:
                            hirings = int(numbers[0])
                            print(f"  ✅ 고용수: {hirings}")
                            break
                except:
                    continue
            
            # 리뷰수 - 개선된 선택자
            review_selectors = [
                "div.review-info span.count",
                "span.count"
            ]
            
            for selector in review_selectors:
                try:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        text = elements[0].text.replace(',', '').replace('(', '').replace(')', '').strip()
                        numbers = re.findall(r'\d+', text)
                        if numbers:
                            reviews = int(numbers[0])
                            print(f"  ✅ 리뷰수: {reviews}")
                            break
                except:
                    continue
            
            # 평점
            rating_selectors = [
                "div.review-info span.rate",
                "span.rate"
            ]
            
            for selector in rating_selectors:
                try:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        text = elements[0].text.strip()
                        rating_match = re.search(r'(\d+\.?\d*)', text)
                        if rating_match:
                            rating = float(rating_match.group(1))
                            print(f"  ✅ 평점: {rating}")
                            break
                except:
                    continue
            
            return hirings, reviews, rating
            
        except Exception as e:
            print(f"  ❌ 추출 오류: {e}")
            return 0, 0, 0.0
    
    def collect_competitor_data(self, driver, competitor_id):
        competitor = self.competitors.get(competitor_id)
        if not competitor:
            return None
        
        url = competitor['url']
        name = competitor['name']
        
        print(f"🔍 {name} 수집 중...")
        
        try:
            driver.get(url)
            hirings, reviews, rating = self.extract_data_from_page(driver)
            
            if hirings == 0 and reviews == 0:
                print(f"  ⚠️ 데이터 추출 실패")
                return None
            
            data = {
                'hirings': hirings,
                'reviews': reviews,
                'rating': rating,
                'timestamp': datetime.now().isoformat(),
                'date': datetime.now().strftime('%Y-%m-%d')
            }
            
            print(f"  ✅ {name}: 고용 {hirings}, 리뷰 {reviews}, 평점 {rating}")
            return data
            
        except Exception as e:
            print(f"  ❌ 수집 실패: {e}")
            return None
    
    def save_data(self, competitor_id, data):
        if not data:
            return
        
        os.makedirs('collected_data', exist_ok=True)
        filepath = f'collected_data/{competitor_id}.json'
        
        storage_data = {}
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        storage_data = json.loads(content)
            except:
                storage_data = {}
        
        date_key = data['date']
        storage_data[date_key] = {
            'hirings': data['hirings'],
            'reviews': data['reviews'],
            'rating': data.get('rating', 0.0),
            'timestamp': datetime.now().isoformat()
        }
        
        temp_filepath = f'{filepath}.tmp'
        try:
            with open(temp_filepath, 'w', encoding='utf-8') as f:
                json.dump(storage_data, f, ensure_ascii=False, indent=2)
            os.replace(temp_filepath, filepath)
            print(f"💾 {competitor_id} 저장 완료\n")
        except Exception as e:
            print(f"  ❌ 저장 실패: {e}")
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
    
    def collect_all(self):
        print(f"\n{'='*60}")
        print(f"🔍 데이터 수집 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")
        
        print("🌐 Chrome 시작...")
        driver = self.setup_driver()
        
        try:
            success_count = 0
            
            for competitor_id in self.competitors.keys():
                data = self.collect_competitor_data(driver, competitor_id)
                if data and (data['hirings'] > 0 or data['reviews'] > 0):
                    self.save_data(competitor_id, data)
                    success_count += 1
                time.sleep(1)  # 1초로 단축
            
            print(f"{'='*60}")
            print(f"✅ 수집 완료! ({success_count}/{len(self.competitors)})")
            print(f"{'='*60}\n")
            
        finally:
            driver.quit()

def main():
    print("🎯 숨고 경쟁사 분석 - Selenium")
    collector = SoomgoSeleniumCollector()
    collector.collect_all()

if __name__ == '__main__':
    main()