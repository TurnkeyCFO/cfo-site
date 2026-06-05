from playwright.sync_api import sync_playwright
from pathlib import Path
url=(Path.cwd()/'instant-estimate-test'/'index.html').as_uri()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append(f"pageerror: {e}"))
    pg.goto(url, wait_until='domcontentloaded'); pg.wait_for_timeout(400)
    pg.fill('#companyName','Test Co LLC'); pg.select_option('#revenue','1to3m'); pg.select_option('#software','quickbooks')
    pg.locator('#nextBtn').click(); pg.wait_for_timeout(200)          # ->step2
    pg.select_option('#accountCount','6to10'); pg.select_option('#inventory','no')
    pg.locator('#nextBtn').click(); pg.wait_for_timeout(200)          # ->step3
    pg.check('#pay-none', force=True); pg.select_option('#billpay','none'); pg.select_option('#needs1099','no')
    pg.locator('#nextBtn').click(); pg.wait_for_timeout(200)          # ->step4
    pg.select_option('#monthsBehind','0')
    pg.locator('#nextBtn').click(); pg.wait_for_timeout(200)          # ->step5
    pg.fill('#email','test@example.com'); pg.wait_for_timeout(150)
    pg.locator('#submitBtn').click(); pg.wait_for_timeout(1800)
    pg.screenshot(path="_ie_FINAL_result.png", full_page=True)
    summ=pg.locator('#estimateSummary').inner_text()
    print("SUMMARY:\n"+summ)
    print(f"\nERRORS({len(errs)}):", errs)
    b.close()
