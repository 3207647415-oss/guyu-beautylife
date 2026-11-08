import{PROFILES,DEMO_FORMULA,parseCSV,splitIngredients,evaluate,initialSnapshots,summarizeSnapshots}from"./engine.js";

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let ingredients=[],rules=[],profileKey=localStorage.getItem("fuzhi-profile")||"sensitive";
let snapshots=loadSnapshots(profileKey);

async function boot(){
  try{const [a,b]=await Promise.all([fetch("./data/ingredients.csv").then(r=>r.text()),fetch("./data/combination_rules.csv").then(r=>r.text())]);ingredients=parseCSV(a);rules=parseCSV(b)}catch(e){console.error(e);toast("资料载入失败，请刷新页面重试")}
  bind();selectProfile(profileKey,false);updateInputCount();renderBaseline();
}

function bind(){
  $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>{showTab(b.dataset.go);$('#experience').scrollIntoView({behavior:'smooth'})}));
  $$('[data-profile]').forEach(b=>b.addEventListener('click',()=>selectProfile(b.dataset.profile,true)));
  $('#ingredients').addEventListener('input',updateInputCount);$('#loadDemo').addEventListener('click',()=>{$('#ingredients').value=DEMO_FORMULA;updateInputCount();toast('已载入路演配方')});
  $('#reviewButton').addEventListener('click',runReview);$('#skinScore').addEventListener('input',e=>$('#scoreOutput').value=`${e.target.value} / 5`);
  $('#checkinForm').addEventListener('submit',saveSnapshot);$('#resetSnapshots').addEventListener('click',()=>resetSnapshotData(true));$('#resetAll').addEventListener('click',resetAll);
  $$('[role="tab"]').forEach(tab=>tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const tabs=$$('[role="tab"]'),i=tabs.indexOf(tab),n=e.key==='ArrowRight'?(i+1)%tabs.length:(i-1+tabs.length)%tabs.length;tabs[n].click();tabs[n].focus()}));
}

function showTab(key){$$('[data-tab]').forEach(b=>{const active=b.dataset.tab===key;b.classList.toggle('active',active);b.setAttribute('aria-selected',active)});$$('.tab-panel').forEach(p=>{const active=p.id===`panel-${key}`;p.classList.toggle('active',active);p.hidden=!active})}

function selectProfile(key,announce){profileKey=key;localStorage.setItem('fuzhi-profile',key);$$('[data-profile]').forEach(b=>b.classList.toggle('active',b.dataset.profile===key));const p=PROFILES[key];$('#profileFacts').innerHTML=`<div class="fact"><span>基础肤质</span><strong>${p.skinType}</strong></div><div class="fact"><span>当前阶段</span><strong>${p.conditions[1]||'日常稳定期'}</strong></div><div class="fact"><span>个人黑名单</span><strong class="${p.blacklist.length?'danger-text':''}">${p.blacklist.length?p.blacklist.map(x=>nameCN(x)||x).join(' · '):'无'}</strong></div>`;snapshots=loadSnapshots(key);renderBaseline();if($('#resultWrap .result-hero'))runReview();if(announce)toast(`已切换为“${p.name}”档案`)}

function nameCN(inci){return ingredients.find(x=>x.inci_name===inci)?.cn_name}

function updateInputCount(){if(!ingredients.length){$('#inputCount').textContent=`输入 ${splitIngredients($('#ingredients').value).length} 项`;return}const index=new Set(ingredients.flatMap(x=>[x.inci_name,x.cn_name,...(x.aliases||'').split(';')]).filter(Boolean).map(x=>x.toLowerCase()));const tokens=splitIngredients($('#ingredients').value),count=tokens.filter(t=>index.has(t.toLowerCase())).length;$('#inputCount').textContent=`已识别 ${count} / ${tokens.length} 项`}

function runReview(){if(!ingredients.length){toast('证据库仍在载入，请稍候');return}const input=$('#ingredients').value.trim();if(!input){toast('请先粘贴产品成分表');return}const out=evaluate({input,profile:PROFILES[profileKey],ingredients,rules});const meta={block:{label:'暂缓使用',sub:'命中个人绝对边界',symbol:'!',copy:'本次建议先不要尝试这款产品。'},caution:{label:'谨慎评估',sub:'当前肤况存在叠加风险',symbol:'△',copy:'建议降低频率、错开使用或待肤况稳定后再试。'},observe:{label:'可观察使用',sub:'未发现明确个人拦截项',symbol:'✓',copy:'先局部试用，并持续记录真实耐受。'}}[out.level];const decisions=out.findings.map((f,i)=>`<article class="decision-card"><span class="decision-no">${String(i+1).padStart(2,'0')}</span><div><h4>${escapeHTML(f.title)}</h4><p>${escapeHTML(f.body)}</p><div class="decision-tags">${f.tags.map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div></div>${f.url?`<a href="${safeURL(f.url)}" target="_blank" rel="noopener">查看出处 ↗</a>`:''}</article>`).join('');const unknown=out.unknown.length?`另有 ${out.unknown.length} 项未被当前体验库识别，不代表安全或不安全。`:'';$('#resultWrap').innerHTML=`<div class="result-hero ${out.level}"><div class="result-symbol">${meta.symbol}</div><div><small>${meta.sub}</small><h3>${meta.label}</h3><p>${meta.copy}</p></div><div class="result-score"><strong>${out.score}</strong><span>决策适配分 / 100</span></div></div><div class="decision-list">${decisions}</div><div class="result-foot"><span>ⓘ</span>已核对 ${out.matched.length} 项原料；${unknown||'所有结论均可追溯到当前证据库。'} 结论不替代医生诊断或成品完整安全评估。</div>`;$('#resultWrap').scrollIntoView({behavior:'smooth',block:'start'})}

function loadSnapshots(key){try{const saved=JSON.parse(localStorage.getItem(`fuzhi-snapshots-${key}`));if(Array.isArray(saved)&&saved.length)return saved}catch{}return initialSnapshots(key)}

function saveSnapshot(e){e.preventDefault();const score=Number($('#skinScore').value),issues=$$('input[name="issue"]:checked').map(x=>x.value);snapshots.push({id:`custom-${Date.now()}`,day:snapshots.length*2+1,score,issues:issues.length?issues:['无异常'],note:$('#snapshotNote').value.trim(),custom:true});localStorage.setItem(`fuzhi-snapshots-${profileKey}`,JSON.stringify(snapshots));renderBaseline();toast('肤况快照已保存，动态基线已更新');$('#snapshotNote').value=''}

function resetSnapshotData(announce){localStorage.removeItem(`fuzhi-snapshots-${profileKey}`);snapshots=initialSnapshots(profileKey);renderBaseline();if(announce)toast('已恢复演示初始状态')}

function resetAll(){['sensitive','oily'].forEach(k=>localStorage.removeItem(`fuzhi-snapshots-${k}`));localStorage.removeItem('fuzhi-profile');profileKey='sensitive';$('#ingredients').value=DEMO_FORMULA;selectProfile('sensitive',false);updateInputCount();$('#resultWrap').innerHTML='<div class="empty-result"><div class="empty-orb">AI</div><h3>你的专属结论会显示在这里</h3><p>系统会依次核对个人黑名单、当前肤况、单成分证据与叠加风险。</p></div>';showTab('review');toast('公开体验已重置')}

function renderBaseline(){if(!$('#skinChart'))return;const p=PROFILES[profileKey],s=summarizeSnapshots(snapshots,p);$('#skinTypeMetric').textContent=p.skinType;$('#latestScoreMetric').textContent=s.latest;$('#concernMetric').textContent=s.concern;$('#recordCountMetric').textContent=s.count;const chip=$('#baselineStatus');chip.textContent=s.unstable?'状态波动中':'状态平稳';chip.className=`status-chip ${s.unstable?'alert':'stable'}`;$('#chartSummary').textContent=s.unstable?'新快照触发基线更新':'整体平稳，偶有波动';const note=$('#baselineNote');note.textContent=s.note;note.className=`baseline-note ${s.unstable?'alert':''}`;renderChart(snapshots)}

function renderChart(data){const w=640,h=170,pad={l:25,r:16,t:14,b:22},min=1,max=5;const x=i=>pad.l+i*(w-pad.l-pad.r)/Math.max(1,data.length-1),y=v=>pad.t+(max-v)*(h-pad.t-pad.b)/(max-min);const points=data.map((d,i)=>`${x(i)},${y(d.score)}`).join(' '),area=`${pad.l},${h-pad.b} ${points} ${x(data.length-1)},${h-pad.b}`;const grids=[1,2,3,4,5].map(v=>`<line class="grid-line" x1="${pad.l}" x2="${w-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-label" x="2" y="${y(v)+3}">${v}</text>`).join('');const dots=data.map((d,i)=>`<circle class="chart-dot ${i===data.length-1&&d.custom?'latest':''}" cx="${x(i)}" cy="${y(d.score)}" r="${i===data.length-1?5:3}"/>`).join('');$('#skinChart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#68c19c" stop-opacity=".32"/><stop offset="1" stop-color="#68c19c" stop-opacity="0"/></linearGradient></defs>${grids}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${points}"/>${dots}<text class="axis-label" x="${pad.l}" y="${h-2}">起始</text><text class="axis-label" x="${w-pad.r-24}" y="${h-2}">今天</text></svg>`}

function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function safeURL(v=''){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}}
let toastTimer;function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}

boot();
