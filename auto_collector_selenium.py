"""
숨고 경쟁사 분석 - HTML 구조 기반 수정
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
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
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(30)
        return driver
    
    def extract_data_from_page(self, driver):
        time.sleep(5)
        
        hirings = 0
        reviews = 0
        rating = 0.0
        
        try:
            # 통계 영역 찾기
            stats_info = driver.find_element(By.CSS_SELECTOR, "div.statistics-info")
            
            # 모든 statistics-info-item 찾기
            items = stats_info.find_elements(By.CSS_SELECTOR, "div.statistics-info-item")
            
            print(f"  찾은 항목 수: {len(items)}")
            
            for idx, item in enumerate(items):
                text = item.text.strip()
                print(f"  항목 {idx}: {text[:50]}")
                
                # 첫 번째 항목 = 고용수
                if idx == 0:
                    numbers = re.findall(r'\d+', text.replace(',', ''))
                    if numbers:
                        hirings = int(numbers[0])
                        print(f"  ✅ 고용수: {hirings}")
                
                # review-info 클래스 있는 항목 = 리뷰
                if 'review-info' in item.get_attribute('class'):
                    # 평점 찾기
                    try:
                        rate_el = item.find_element(By.CSS_SELECTOR, "span.rate")
                        rating = float(rate_el.text.strip())
                        print(f"  ✅ 평점: {rating}")
                    except:
                        pass
                    
                    # 리뷰수 찾기
                    try:
                        count_el = item.find_element(By.CSS_SELECTOR, "span.count")
                        count_text = count_el.text.strip().replace('(', '').replace(')', '')
                        reviews = int(count_text)
                        print(f"  ✅ 리뷰수: {reviews}")
                    except:
                        pass
            
        except Exception as e:
            print(f"  ❌ 선택자 오류: {e}")
        
        # 최후의 수단: 정규식
        if hirings == 0 or reviews == 0:
            print(f"  백업: 정규식 사용")
            try:
                page_text = driver.find_element(By.TAG_NAME, 'body').text
                
                if hirings == 0:
                    # "525회" 또는 "고용 525"
                    hiring_match = re.search(r'(\d+)회|고용\D*(\d+)', page_text)
                    if hiring_match:
                        hirings = int(hiring_match.group(1) or hiring_match.group(2))
                        print(f"  ✅ 고용수 (정규식): {hirings}")
                
                if reviews == 0:
                    # "(207)"
                    review_match = re.search(r'\((\d+)\)', page_text)
                    if review_match:
                        reviews = int(review_match.group(1))
                        print(f"  ✅ 리뷰수 (정규식): {reviews}")
                
                if rating == 0:
                    # "5.0"
                    rating_match = re.search(r'(\d\.\d)', page_text)
                    if rating_match:
                        rating = float(rating_match.group(1))
                        print(f"  ✅ 평점 (정규식): {rating}")
            except:
                pass
        
        return hirings, reviews, rating
    
    def collect_competitor_data(self, driver, competitor_id):
        competitor = self.competitors.get(competitor_id)
        if not competitor:
            return None
        
        url = competitor['url']
        name = competitor['name']
        
        print(f"🔍 {name}...")
        
        try:
            driver.get(url)
            hirings, reviews, rating = self.extract_data_from_page(driver)
            
            if hirings == 0 and reviews == 0:
                print(f"  ⚠️ 데이터 없음")
                return None
            
            return {
                'hirings': hirings,
                'reviews': reviews,
                'rating': rating,
                'timestamp': datetime.now().isoformat(),
                'date': datetime.now().strftime('%Y-%m-%d')
            }
        except Exception as e:
            print(f"  ❌ 오류: {e}")
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
                    storage_data = json.load(f)
            except:
                storage_data = {}
        
        date_key = data['date']
        storage_data[date_key] = {
            'hirings': data['hirings'],
            'reviews': data['reviews'],
            'rating': data.get('rating', 0.0),
            'timestamp': datetime.now().isoformat()
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(storage_data, f, ensure_ascii=False, indent=2)
        
        print(f"💾 {competitor_id} 저장")
    
    def collect_all(self):
        print(f"🔍 수집 시작")
        driver = self.setup_driver()
        
        try:
            for competitor_id in self.competitors.keys():
                data = self.collect_competitor_data(driver, competitor_id)
                if data:
                    self.save_data(competitor_id, data)
                time.sleep(1)
            print(f"✅ 완료")
        finally:
            driver.quit()

def main():
    collector = SoomgoSeleniumCollector()
    collector.collect_all()

if __name__ == '__main__':
    main()