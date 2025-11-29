"""
숨고 경쟁사 분석 - 정규식 전용 + hourly 데이터 저장
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
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(30)
        return driver
    
    def extract_data_from_page(self, driver):
        time.sleep(8)
        
        hirings = 0
        reviews = 0
        rating = 0.0
        
        try:
            page_text = driver.find_element(By.TAG_NAME, 'body').text
            
            # 고용수
            hiring_patterns = [
                r'(\d{1,4})\s*회',
                r'고용\s*(\d{1,4})',
            ]
            
            for pattern in hiring_patterns:
                match = re.search(pattern, page_text)
                if match:
                    hirings = int(match.group(1))
                    print(f"  ✅ 고용: {hirings}")
                    break
            
            # 리뷰수
            review_patterns = [
                r'\((\d{1,4})\)',
                r'리뷰\s*(\d{1,4})',
            ]
            
            for pattern in review_patterns:
                matches = re.findall(pattern, page_text)
                if matches:
                    reviews = max([int(m) for m in matches])
                    print(f"  ✅ 리뷰: {reviews}")
                    break
            
            # 평점
            rating_patterns = [
                r'(\d\.\d)',
                r'평점\s*(\d\.\d)',
            ]
            
            for pattern in rating_patterns:
                match = re.search(pattern, page_text)
                if match:
                    rating = float(match.group(1))
                    print(f"  ✅ 평점: {rating}")
                    break
            
        except Exception as e:
            print(f"  ❌ 오류: {e}")
        
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
                    storage_data = json.load(f)
            except:
                storage_data = {}
        
        date_key = data['date']
        current_time = datetime.now().strftime('%H:%M')
        
        # 기존 날짜 데이터가 있으면 가져오기
        if date_key in storage_data:
            existing_data = storage_data[date_key]
            # hourly 데이터 초기화 (없으면)
            if 'hourly' not in existing_data:
                existing_data['hourly'] = {}
            
            # 현재 시간대 데이터 추가
            existing_data['hourly'][current_time] = {
                'hirings': data['hirings'],
                'reviews': data['reviews']
            }
            
            # 최신 데이터로 메인 값 업데이트
            existing_data['hirings'] = data['hirings']
            existing_data['reviews'] = data['reviews']
            existing_data['rating'] = data.get('rating', 0.0)
            existing_data['timestamp'] = datetime.now().isoformat()
            
            storage_data[date_key] = existing_data
        else:
            # 새로운 날짜 데이터
            storage_data[date_key] = {
                'hirings': data['hirings'],
                'reviews': data['reviews'],
                'rating': data.get('rating', 0.0),
                'timestamp': datetime.now().isoformat(),
                'hourly': {
                    current_time: {
                        'hirings': data['hirings'],
                        'reviews': data['reviews']
                    }
                }
            }
        
        # 원자적 쓰기
        temp_filepath = f'{filepath}.tmp'
        with open(temp_filepath, 'w', encoding='utf-8') as f:
            json.dump(storage_data, f, ensure_ascii=False, indent=2)
        os.replace(temp_filepath, filepath)
        
        print(f"💾 저장 완료 ({current_time})")
    
    def collect_all(self):
        print(f"🔍 수집 시작")
        driver = self.setup_driver()
        
        try:
            for competitor_id in self.competitors.keys():
                data = self.collect_competitor_data(driver, competitor_id)
                if data:
                    self.save_data(competitor_id, data)
                time.sleep(2)
            print(f"✅ 완료")
        finally:
            driver.quit()

def main():
    collector = SoomgoSeleniumCollector()
    collector.collect_all()

if __name__ == '__main__':
    main()