import undetected_chromedriver as uc
import time

if __name__ == '__main__':
    print("Testing undetected-chromedriver...")
    options = uc.ChromeOptions()
    options.headless = False
    driver = uc.Chrome(options=options)
    
    driver.get("https://www.ligaonepiece.com.br/?view=cards%2Fsearch&card=luffy&tipo=1")
    time.sleep(5)
    
    html = driver.page_source
    if 'card-item' in html:
        print("SUCCESS: Found cards!")
    else:
        print(f"FAILURE: Cloudflare blocked us. HTML length: {len(html)}")
        print("Title:", driver.title)
    
    driver.quit()
