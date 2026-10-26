import { randomUUID } from 'node:crypto';

export function makeDemo(scene) {
  if (!['rental','parttime','internship'].includes(scene)) throw Error('演示场景无效');
  const id=randomUUID();
  const c={id,scene,demo:true,demoRevision:3,archived:false,workflowVersion:2,stage:scene==='rental'?'已经发生问题':'准备签约',
    title: {rental:'梧桐公寓 · 退租押金核对',parttime:'周末活动兼职 · 薪酬约定核对',internship:'暑期实习 · 协议签约检查'}[scene],
    date:'2026-10-26',location:'模拟案例',facts:[],disputes:[],tasks:[],context:{},events:[],worklogs:[],checklist:{},
    settlement:{depositCents:scene==='rental'?200000:null,refundedCents:0,depositMaterialIds:[],refundMaterialIds:[]}};
  const materials=[];
  function material(name,type,date,text,extra={}) {
    const m={id:randomUUID(),caseId:id,name,type,date,text,source:'模拟材料',status:'已整理',demo:true,dateConfirmed:true,...extra};materials.push(m);return m.id;
  }
  const event=(title,date,note,ids)=>c.events.push({id:randomUUID(),title,date,note,materialIds:ids,status:'材料记载',dateConfirmed:true});
  const dispute=(title,otherClaim,myStatement,missing,ids,amountCents=null)=>c.disputes.push({id:randomUUID(),title,otherClaim,myStatement,missing,materialIds:ids,amountCents,monetary:amountCents!==null,status:'待核实'});
  if(scene==='rental') {
    const contract=material('房屋租赁合同.txt','合同协议','2026-07-01','【模拟】第四条：押金2000元。租期结束验收后视情况扣除相关费用，剩余押金退还。第五条：维修责任根据实际情况协商。');
    const handover=material('入住交接记录.txt','交接记录','2026-07-01','【模拟】卧室墙面存在旧痕。此文字记录尚无双方签认，不证明损伤原因。');
    const pay=material('押金付款记录.txt','付款凭证','2026-07-01','【模拟】租客向出租方转账2000元，备注押金，仅用于演示。');
    const chat=material('退租沟通记录.txt','聊天记录','2026-10-24','【模拟】房东：墙面需要维修，扣款800元。租客：入住时已有旧痕，请提供维修明细与凭证。房东尚未提供。');
    const before=material('入住墙面示意图.png','照片图片','2026-07-01','【模拟示意图】卧室墙面标记，仅演示并排查看功能，不是真实原始照片。',{demoAsset:'move-in.png',mime:'image/png',room:'卧室',phase:'入住',dateConfirmed:false,caption:'模拟图，不证明拍摄时间或损伤原因。'});
    const after=material('退租墙面示意图.png','照片图片','2026-10-24','【模拟示意图】退租墙面示意，与入住图共同演示分类和证据关联。',{demoAsset:'move-out.png',mime:'image/png',room:'卧室',phase:'退租',dateConfirmed:false,caption:'模拟图，不据此认定责任。'});
    c.settlement.depositMaterialIds=[pay];
    dispute('墙面维修扣款','房东要求扣800元','入住交接记录有旧痕说明，责任待核对','补充维修费用凭证、双方交接确认及真实原始照片。',[contract,handover,chat,before,after],80000);
    c.disputes[0].status='有争议';
    dispute('押金退还时间','尚未明确退款日期','希望确认书面结算与退款日期','书面退款安排。',[contract,pay,chat]);
    event('签约前核对押金条件','2026-06-29','押金扣款条件尚不明确，准备书面提问。',[contract]);
    event('入住交接与支付押金','2026-07-01','登记旧痕、付款并留存材料。',[handover,pay]);
    event('退租发生扣款争议','2026-10-24','对方扣款为单方主张，未计入双方确认扣款。',[chat]);
    c.tasks=[{text:'请房东提供扣款明细和维修凭证',done:false},{text:'核对入住与退租原始照片',done:false}];
  } else if(scene==='parttime') {
    const ad=material('招聘广告.txt','招聘信息','2026-10-23','【模拟】周末活动协助，日薪200元，每天8小时。结算方式面议。');
    const chat=material('招聘沟通.txt','聊天记录','2026-10-24','【模拟】招聘方：200元包含最高绩效，实际报酬按公司规定结算。求职者：保底金额是多少？尚未回复。');
    dispute('日薪与绩效口径不一致','200元包含最高绩效','广告未说明保底金额','书面确认保底报酬、绩效条件与结算日期。',[ad,chat]);
    event('查看日薪招聘广告','2026-10-23','记录广告薪酬口径。',[ad]);
    event('沟通中出现绩效条件','2026-10-24','保底报酬仍待确认，未自动记为应收款。',[chat]);
    c.context={studentStatus:'全日制在校（模拟）',management:'招聘方安排活动任务，具体管理待核实'};
    c.tasks=[{text:'书面确认保底报酬与绩效条件',done:false}];
  } else {
    const agreement=material('实习协议.txt','合同协议','2026-10-24','【模拟】报酬每月1800元。保险安排另行通知，实习生自行注意人身安全。提前退出与企业协商，通知期限未定。');
    dispute('保险与退出安排待明确','保险另行通知，退出需协商','希望明确保障和退出程序','保险主体、保障期间、通知期限和学校联系人。',[agreement]);
    c.context={studentStatus:'在校学生（模拟）',schoolArrangement:'学校推荐，是否纳入教学安排待确认'};
    c.checklist={insurance:{status:'待确认',note:'协议写明另行通知，尚未取得保险凭证。',materialIds:[agreement]}};
    event('收到实习协议','2026-10-24','签约前核对保险、报酬和退出条件。',[agreement]);
    c.tasks=[{text:'向企业确认保险购买主体',done:false},{text:'向学校核实实习安排',done:false}];
  }
  return {c,materials};
}
