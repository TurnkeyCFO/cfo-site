from playwright.sync_api import sync_playwright
from pathlib import Path
url = (Path.cwd()/'instant-estimate-test'/'index.html').as_uri()
errors=[]
def run(b,label,vp):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.on('console', lambda m: errors.append(f"[{label}] {m.text}") if m.type=='error' else None)
    pg.on('pageerror', lambda e: errors.append(f"[{label}] pageerror: {e}"))
    pg.goto(url, wait_until='domcontentloaded'); pg.wait_for_timeout(500)
    pg.screenshot(path=f"_ie_{label}_step1.png", full_page=True)
    pg.fill('#companyName','Test Co LLC'); pg.select_option('#revenue','1to3m'); pg.select_option('#software','quickbooks')
    has_ind=pg.locator('input[name="industry"]').count()
    has_jc=pg.locator('#jobCosting').count()
    for _ in range(12):
        if pg.locator('#submitBtn').is_visible(): break
        a='.form-step.active '
        if pg.locator(a+'select#accountCount').count(): pg.select_option('#accountCount','6to10')
        if pg.locator(a+'select#inventory').count(): pg.select_option('#inventory','no')
        if pg.locator(a+'input#pay-none').count(): pg.check('#pay-none', force=True)
        if pg.locator(a+'select#billpay').count(): pg.select_option('#billpay','none')
        if pg.locator(a+'select#needs1099').count(): pg.select_option('#needs1099','no')
        if pg.locator(a+'select#monthsBehind').count(): pg.select_option('#monthsBehind','0')
        if pg.locator(a+'input#email').count(): pg.fill('#email','test@example.com')
        try: pg.locator('#nextBtn').click()
        except Exception: pass
        pg.wait_for_timeout(250)
    pg.screenshot(path=f"_ie_{label}_last.png", full_page=True)
    if pg.locator('#submitBtn').is_visible():
        pg.locator('#submitBtn').click(); pg.wait_for_timeout(1500)
    pg.screenshot(path=f"_ie_{label}_result.png", full_page=True)
    try: summary=pg.locator('#estimateSummary').inner_text()
    except Exception: summary='(no summary)'
    print(f"--- {label} --- industryInputs={has_ind} jobCostFields={has_jc}")
    print(f"[{label}] summary:\n{summary}\n")
    ctx.close()
with sync_playwright() as p:
    b=p.chromium.launch()
    run(b,"desktop",{'width':1280,'height':900})
    run(b,"mobile",{'width':390,'height':844})
    b.close()
print(f"=== CONSOLE/PAGE ERRORS ({len(errors)}) ===")
[print(e) for e in errors]
