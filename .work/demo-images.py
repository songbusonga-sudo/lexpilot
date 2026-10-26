from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
out=Path('server/demo-assets');out.mkdir(exist_ok=True)
font='C:/Windows/Fonts/msyh.ttc'
f=lambda n:ImageFont.truetype(font,n)
for phase,key in [('入住','move-in'),('退租','move-out')]:
 im=Image.new('RGB',(1000,660),'white');d=ImageDraw.Draw(im)
 d.text((40,22),'模拟房屋示意图  /  '+phase,fill='#171717',font=f(30))
 d.text((40,76),'用于演示照片分类与并排对照，不是真实房屋照片',fill='#555555',font=f(19))
 d.rectangle((40,130,960,500),fill='#f3f3f3',outline='#aaa',width=2)
 d.polygon([(40,500),(960,500),(960,550),(40,550)],fill='#dedede')
 d.rectangle((690,195,885,365),fill='white',outline='#888',width=3)
 d.line((787,195,787,365),fill='#aaa',width=2)
 d.line((690,280,885,280),fill='#aaa',width=2)
 d.rectangle((120,398,600,500),fill='#ddd',outline='#aaa',width=2)
 d.line((350,238,390,250,365,268),fill='#888',width=4)
 d.ellipse((425,280,440,292),fill='#aaa')
 d.text((275,315),'墙面标记示意',fill='#666',font=f(18))
 d.text((40,578),'日期、损伤原因与责任需要结合原始材料另行核实',fill='#333',font=f(21))
 d.text((40,616),'SIMULATED MATERIAL · 青盾功能演示',fill='#666',font=f(16))
 im.save(out/(key+'.png'))
