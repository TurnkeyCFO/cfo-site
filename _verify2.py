from playwright.sync_api import sync_playwright
from pathlib import Path
url=(Path.cwd()/'instant-estimate2'/'index.html').as_uri()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for label,vp in [("desktop",{'width':1280,'height':900}),("mobile",{'width':390,'height':844})]:
        ctx=b.new_context(viewport=vp); pg=ctx.new_page()
        pg.on('console', lambda m: errs.append(f"[{label}] {m.text}") if m.type=='error' else None)
        pg.on('pageerror', lambda e: errs.append(f"[{label}] {e}"))
        pg.goto(url, wait_until='domcontentloaded'); pg.wait_for_timeout(400)
        steplabel=pg.locator('#stepLabel').inner_text()
        pg.screenshot(path=f"_ie2_{label}_s1.png", full_page=True)
        pg.fill('#companyName','Grace Community Church'); pg.select_option('#revenue','250to1m'); pg.select_option('#software','quickbooks')
        pg.locator('#nextBtn').click(); pg.wait_for_timeout(200)   # -> merged step 2
        pg.screenshot(path=f"_ie2_{label}_s2.png", full_page=True)
        merged_label=pg.locator('.form-step.active #stepLabel').count()
        pg.select_option('#accountCount','6to10')
        pg.check('#pay-simple', force=True); pg.select_option('#billpay','lt40'); pg.select_option('#needs1099','yes')
        pg.locator('#nextBtn').click(); pg.wait_for_timeout(200)   # -> step 4 (months behind)
        pg.select_option('#monthsBehind','2')
        pg.locator('#nextBtn').click(); pg.wait_for_timeout(200)   # -> step 5 email
        pg.fill('#email','pastor@example.com'); pg.wait_for_timeout(150)
        pg.locator('#submitBtn').click(); pg.wait_for_timeout(1600)
        pg.screenshot(path=f"_ie2_{label}_result.png", full_page=True)
        try: summ=pg.locator('#estimateSummary').inner_text()
        except Exception: summ='(none)'
        print(f"--- {label} --- start step label='{steplabel}'")
        print(summ+"\n")
        ctx.close()
    b.close()
print(f"ERRORS({len(errs)}):", errs)
