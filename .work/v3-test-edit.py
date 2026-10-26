from pathlib import Path
p=Path('tests/progress-browser.mjs');s=p.read_text(encoding='utf-8-sig');s=s.replace("}finally{await browser.close();", "}catch(e){console.log('URL',page.url(),'ERRORS',errors);console.log((await page.locator('body').innerText()).slice(-3000));await shot('failure');throw e;}finally{await browser.close();")
p.write_text(s,encoding='utf-8')
