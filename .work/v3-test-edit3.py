from pathlib import Path
p=Path('tests/progress-browser.mjs');s=p.read_text(encoding='utf-8');s=s.replace("page.on('pageerror',e=>errors.push(e.message));", "page.on('pageerror',e=>errors.push(e.message));\npage.on('response',async r=>{if(!r.ok())console.log('HTTP',r.status(),r.url(),(await r.text()).slice(0,300));});")
p.write_text(s,encoding='utf-8')
