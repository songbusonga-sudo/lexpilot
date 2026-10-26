from pathlib import Path
from zipfile import ZipFile
from copy import deepcopy
import json, hashlib
from lxml import etree as E

base = Path(__file__).parent
source = base / 'reference.docx'
out = base.parents[1] / 'output' / '青盾项目申报书.docx'
data = json.loads((base/'content.json').read_text(encoding='utf-8'))
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns={'w':W}
def tag(n): return '{'+W+'}'+n
with ZipFile(source) as z:
    root=E.fromstring(z.read('word/document.xml'))
    body=root.find('w:body',ns)
    ps=body.findall('w:p',ns)
    sections=[E.tostring(s) for s in root.findall('.//w:sectPr',ns)]
    blank=ps[8].findall('w:r/w:t',ns)[-1]
    blank.text='扫丝欧深参赛队'+' '*17
    def para(template,text,level=None):
        p=deepcopy(template)
        props=p.find('w:pPr',ns)
        rp=deepcopy(p.find('w:r/w:rPr',ns))
        for child in list(p):
            if child.tag!=tag('pPr'): p.remove(child)
        for name in ['widowControl']+(['keepNext'] if level is not None else []):
            if props.find('w:'+name,ns) is None: E.SubElement(props,tag(name))
        if level is not None: E.SubElement(props,tag('outlineLvl')).set(tag('val'),str(level))
        r=E.SubElement(p,tag('r'))
        if rp is not None: r.append(rp)
        E.SubElement(r,tag('t')).text=text
        return p
    new=[para(ps[20],'申报材料正文',0),deepcopy(ps[21])]
    counts=[]
    for section in data['sections']:
        count=sum(len(t) for _,t in section['blocks'])
        assert count<section['limit']
        counts.append({'title':section['title'],'characters':count,'limit':section['limit']})
        new.append(para(ps[26],section['title'],0))
        for kind,text in section['blocks']:
            new.append(para(ps[26] if kind=='h' else ps[23],text,1 if kind=='h' else None))
    new.append(para(ps[26],'附件：其他证明材料',0))
    for _,text in data['appendix']: new.append(para(ps[23],text))
    for p in ps[20:]: body.remove(p)
    pos=list(body).index(body.find('w:sectPr',ns))
    for p in new:
        body.insert(pos,p);pos+=1
    assert sections==[E.tostring(s) for s in root.findall('.//w:sectPr',ns)]
    xml=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
    out.parent.mkdir(exist_ok=True)
    with ZipFile(out,'w') as target:
        for item in z.infolist(): target.writestr(deepcopy(item),xml if item.filename=='word/document.xml' else z.read(item.filename))
    with ZipFile(out) as target:
        assert all(z.read(n)==target.read(n) for n in z.namelist() if n!='word/document.xml')
    for i in range(9,20):
        assert E.tostring(ps[i])==E.tostring(body.findall('w:p',ns)[i])
assert hashlib.sha256(source.read_bytes()).hexdigest()=='94f97788b66c0c277ddd3c0c641fbfee8746a0d267083467c9db163283376ce2'
(base/'final-audit.json').write_text(json.dumps({'sections':counts,'only_document_xml_changed':True,'source_unchanged':True,'other_cover_fields_unchanged':True},ensure_ascii=False,indent=2),encoding='utf-8')
print(str(out))

