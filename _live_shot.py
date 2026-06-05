from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':900})
    pg.goto("https://turnkeycfo.com/instant-estimate-test/", wait_until='domcontentloaded'); pg.wait_for_timeout(1500)
    pg.screenshot(path="_ie_LIVE.png", full_page=True)
    print("title:", pg.title())
    b.close()
