"""
숨고 경쟁사 분석 - 초고속 버전
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
        options.add_argument('--disable-images')
        options.add_argument('--disable-javascript')  # JS 비활성화 (더 빠름)
        options.page_load_strategy = 'none'  # 최대 속도
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(10)
        return driver
    
    def extract_data_from_page(self, driver):
        # 간단하게 3초만 대기
        time.sleep(3)
        
        hirings = 0
        reviews = 0
        rating = 0.0
        
        try:
            page_text = driver.find_element(By.TAG_NAME, 'body').text
            
            # 정규식으로 한방에 추출
            hiring_match = re.search(r'고용\s*(\d+)', page_text)
            if hiring_match:
                hirings = int(hiring_match.group(1))
            
            review_match = re.search(r'\((\d+)\)', page_text)
            if review_match:
                reviews = int(review_match.group(1))
            
            rating_match = re.search(r'(\d\.\d)', page_text)
            if rating_match:
                rating = float(rating_match.group(1))
            
            print(f"  ✅ 고용 {hirings}, 리뷰 {reviews}, 평점 {rating}")
            
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
            
            if hirings == 0:
                return None
            
            return {
                'hirings': hirings,
                'reviews': reviews,
                'rating': rating,
                'timestamp': datetime.now().isoformat(),
                'date': datetime.now().strftime('%Y-%m-%d')
            }
        except:
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
            print(f"✅ 완료")
        finally:
            driver.quit()

def main():
    collector = SoomgoSeleniumCollector()
    collector.collect_all()

if __name__ == '__main__':
    main()
