export const PROFILES={
  sensitive:{name:"敏感肌 · 术后",skinType:"敏感性皮肤",conditions:["玫瑰痤疮","医美术后恢复期"],blacklist:["Methylparaben","Limonene","Linalool"],concern:"泛红"},
  oily:{name:"健康油皮",skinType:"油性皮肤",conditions:[],blacklist:[],concern:"出油"}
};

export const DEMO_FORMULA="Glycerin, Salicylic Acid, Retinol, Glycolic Acid, Methylparaben, Niacinamide";

export function parseCSV(text){const rows=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){field+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===','&&!quoted){row.push(field);field=""}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field);if(row.some(v=>v!==""))rows.push(row);row=[];field=""}else field+=c}if(field||row.length){row.push(field);rows.push(row)}const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,"").trim());return rows.map(cols=>Object.fromEntries(headers.map((h,i)=>[h,(cols[i]||"").trim()])))}

export function splitIngredients(text){return [...new Set(text.split(/[，,;；\n]+/).map(x=>x.trim()).filter(Boolean))]}

export function buildIndex(records){const map=new Map();records.forEach(r=>{[r.inci_name,r.cn_name,...(r.aliases||"").split(";")].filter(Boolean).forEach(k=>map.set(k.trim().toLowerCase(),r))});return map}

export function evaluate({input,profile,ingredients,rules}){
  const index=buildIndex(ingredients),tokens=splitIngredients(input),matched=[],unknown=[];
  tokens.forEach(t=>{const item=index.get(t.toLowerCase());item?matched.push(item):unknown.push(t)});
  const names=new Set(matched.map(x=>x.inci_name));const findings=[];
  const blacklist=matched.filter(x=>profile.blacklist.includes(x.inci_name));
  blacklist.forEach(x=>findings.push({level:"block",title:`命中你的个人黑名单：${x.cn_name}`,body:`档案中已记录对 ${x.inci_name} 的已知过敏史。个人过敏史优先于一般人群的安全结论，本次建议暂缓使用。`,source:x.source_authority,url:x.source_url,tags:["个人边界","优先拦截"]}));
  if(profile.conditions.includes("医美术后恢复期")){
    matched.filter(x=>["Salicylic Acid","Retinol","Glycolic Acid","Lactic Acid"].includes(x.inci_name)).forEach(x=>findings.push({level:"caution",title:`术后阶段谨慎引入：${x.cn_name}`,body:`${x.cn_name}具有活性或潜在刺激性。当前档案处于术后恢复期，建议先遵医嘱、待屏障稳定后再逐项评估。`,source:x.source_authority,url:x.source_url,tags:["当前肤况","保守提示"]}));
  }
  rules.forEach(r=>{if(names.has(r.ingredient_a)&&names.has(r.ingredient_b))findings.push({level:"caution",title:`${nameOf(r.ingredient_a,ingredients)} × ${nameOf(r.ingredient_b,ingredients)}：${r.relation_type}`,body:`${r.description} ${r.recommendation}`,source:r.source.split("；")[0]||"组合规则资料",url:extractUrl(r.source),tags:[`置信度：${r.confidence}`,"非配方禁忌"]})});
  matched.filter(x=>!findings.some(f=>f.title.includes(x.cn_name))).slice(0,4).forEach(x=>findings.push({level:"info",title:`${x.cn_name}：已核对基础资料`,body:`${x.function||"化妆品成分"}。${x.max_concentration?`资料中的条件参考：${x.max_concentration}。`:"仍需结合实际浓度、剂型与使用方式判断。"}`,source:x.source_authority,url:x.source_url,tags:[x.category||"成分资料",x.safety_level||"视情况"]}));
  const level=blacklist.length?"block":findings.some(f=>f.level==="caution")?"caution":"observe";
  return{level,matched,unknown,findings:findings.slice(0,8),score:level==="block"?38:level==="caution"?62:84};
}

function nameOf(inci,items){const x=items.find(i=>i.inci_name===inci);return x?x.cn_name:inci}
function extractUrl(source){const m=(source||"").match(/https?:\/\/[^\s；]+/);return m?m[0]:""}

export function initialSnapshots(profileKey="sensitive"){
  const sensitive=[3,3,4,4,4,4,4,4,4,4,3,4,3,4],oily=[5,5,4,5,5,5,5,5,4,5,5,5,4,5];
  const base=profileKey==="oily"?oily:sensitive;return base.map((score,i)=>({id:`base-${i}`,day:i*2+1,score,issues:score<4?[profileKey==="oily"?"出油":"泛红"]:["无异常"],custom:false}));
}

export function summarizeSnapshots(snapshots,profile){const latest=snapshots[snapshots.length-1],recent=snapshots.slice(-8),avg=recent.reduce((s,x)=>s+x.score,0)/recent.length;const alerts=recent.filter(x=>x.score<=2||x.issues.some(i=>["刺痛","泛红"].includes(i))).length;const unstable=latest.score<=2||alerts>=2;const issueCounts={};recent.flatMap(x=>x.issues).filter(x=>x!=="无异常").forEach(i=>issueCounts[i]=(issueCounts[i]||0)+1);const concern=Object.entries(issueCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||profile.concern;return{latest:latest.score,average:avg.toFixed(1),unstable,concern,count:snapshots.length,note:unstable?`最新自评 ${latest.score} 分，近期出现 ${concern} 等信号。系统已把基线调整为“波动中”，建议暂停新增高刺激产品并持续观察。`:`最近 8 次平均自评 ${avg.toFixed(1)} 分，整体状态平稳。继续保持当前节奏，单次波动不会被直接当作长期肤质变化。`}}
