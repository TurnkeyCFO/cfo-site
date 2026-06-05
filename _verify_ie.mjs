import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
const url = pathToFileURL(path.join(process.cwd(),'instant-estimate-test','index.html')).href;
const errors = [];
const b = await chromium.launch();
async function run(label, vp){
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type()==='error') errors.push(`[${label}] console: ${m.text()}`); });
  p.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
  await p.goto(url, { waitUntil:'networkidle' });
  await p.waitForTimeout(400);
  await p.screenshot({ path:`_ie_${label}_step1.png`, fullPage:true });
  await p.fill('#companyName','Test Co LLC');
  await p.selectOption('#revenue','1to3m');
  await p.selectOption('#software','quickbooks');
  const hasIndustry = await p.locator('input[name="industry"]').count();
  const hasJobCost = await p.locator('#jobCosting').count();
  let guard=0;
  while(guard++ < 12){
    if(await p.locator('#submitBtn').isVisible()) break;
    if(await p.locator('.form-step.active select#accountCount').count()) await p.selectOption('#accountCount','6to10').catch(()=>{});
    if(await p.locator('.form-step.active select#inventory').count()) await p.selectOption('#inventory','no').catch(()=>{});
    if(await p.locator('.form-step.active input#pay-none').count()) await p.check('#pay-none').catch(()=>{});
    if(await p.locator('.form-step.active select#billpay').count()) await p.selectOption('#billpay','none').catch(()=>{});
    if(await p.locator('.form-step.active select#needs1099').count()) await p.selectOption('#needs1099','no').catch(()=>{});
    if(await p.locator('.form-step.active select#monthsBehind').count()) await p.selectOption('#monthsBehind','0').catch(()=>{});
    if(await p.locator('.form-step.active input#email').count()) await p.fill('#email','test@example.com').catch(()=>{});
    await p.locator('#nextBtn').click().catch(()=>{});
    await p.waitForTimeout(250);
  }
  await p.screenshot({ path:`_ie_${label}_last.png`, fullPage:true });
  if(await p.locator('#submitBtn').isVisible()){ await p.locator('#submitBtn').click(); await p.waitForTimeout(1200); }
  await p.screenshot({ path:`_ie_${label}_result.png`, fullPage:true });
  const resultText = await p.locator('#estimateSummary').innerText().catch(()=> '(no summary)');
  console.log(`--- ${label} --- industryInputs=${hasIndustry} jobCostFields=${hasJobCost}`);
  console.log(`[${label}] summary:\n${resultText}\n`);
  await ctx.close();
}
await run('desktop', { width:1280, height:900 });
await run('mobile', { width:390, height:844 });
await b.close();
console.log('=== CONSOLE/PAGE ERRORS ('+errors.length+') ===');
errors.forEach(e=>console.log(e));
