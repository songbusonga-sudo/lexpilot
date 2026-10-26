from pathlib import Path
p=Path('tests/progress-browser.mjs');s=p.read_text(encoding='utf-8-sig').replace("fullPage:true});","fullPage:true,animations:'disabled'});")
p.write_text(s,encoding='utf-8')
