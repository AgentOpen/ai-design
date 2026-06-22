/* =====================================================================
 * app.js — AI 全屋装修设计平台 React 应用 v2
 * 浅色模式 + 多楼层 + CAD 门窗 + 真实图片 + 引导提示 + 拖拽编辑
 * ===================================================================== */
const { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } = React;
const AH = window.AIHome;
const AC = window.AICanvas;
const A3 = window.AIScene3D;

/* ====================== Store ====================== */
const Store = createContext(null);

function useProvideStore(){
  const [project, setProject] = useState(()=>({
    name:'我的家 · 演示项目',
    floor_plan: null,            // 选定的户型（含 floors[]）
    current_floor_id: null,      // 当前查看的楼层
    scale: null,                 // 是否已标定比例（Step1 关卡）
    cad_imported: false,         // Step1 是否点了"导入CAD"
    requirement: {
      budget_tier:'comfort', budget_total:200000,
      occupants:{ count:3, elderly:false, children:true, pets:false },
      style:'modern', functions:['storage'], confirmed:false,
    },
    plans: [],
    selected_plan_id: null,
    layout: null,
    renders: [],
    panoramas: [],
    quotation: null,
    stale: {},
    share_token: null,
    comments: [],
  }));

  const update = useCallback((patch)=>{
    setProject(p => typeof patch==='function' ? {...p,...patch(p)} : {...p,...patch});
  },[]);
  const markStale = useCallback((keys)=>{
    setProject(p=>({ ...p, stale:{ ...p.stale, ...Object.fromEntries(keys.map(k=>[k,true]))}}));
  },[]);
  const clearStale = useCallback((k)=>{
    setProject(p=>{ const s={...p.stale}; delete s[k]; return {...p, stale:s }; });
  },[]);

  const [toast, setToast] = useState(null);
  const notify = useCallback(msg=>{ setToast(msg); setTimeout(()=>setToast(null),2400); },[]);

  return { project, setProject, update, markStale, clearStale, toast, notify };
}

/* ====================== 路由 ====================== */
const STEPS = [
  { key:'home', n:'·', label:'首页', hidden:true },
  { key:'step0', n:0, label:'需求' },
  { key:'step1', n:1, label:'户型' },
  { key:'step2', n:2, label:'3D 墙体' },
  { key:'step3', n:3, label:'AI 布局' },
  { key:'step4', n:4, label:'编辑' },
  { key:'step5', n:5, label:'效果图' },
  { key:'step55', n:'5.5', label:'全景' },
  { key:'step6', n:6, label:'换品' },
  { key:'step7', n:7, label:'报价' },
];

function useRoute(){
  const [route, setRoute] = useState(()=>(location.hash.replace('#/','')||'home'));
  useEffect(()=>{
    const fn=()=>setRoute(location.hash.replace('#/','')||'home');
    window.addEventListener('hashchange', fn);
    return ()=>window.removeEventListener('hashchange', fn);
  },[]);
  const go = useCallback(k=>{ location.hash = '/'+k; }, []);
  return { route, go };
}

/* ====================== "敬请期待" 模态 ====================== */
function ComingSoonModal({ feature, onClose }){
  if (!feature) return null;
  return React.createElement('div', { className:'modal-mask', onClick:onClose },
    React.createElement('div', { className:'modal', onClick:e=>e.stopPropagation() },
      React.createElement('div', { style:{fontSize:42,marginBottom:8}}, '🚧'),
      React.createElement('h3', null, feature + ' · 敬请期待'),
      React.createElement('p', null, '该功能正在开发中，预计在后续版本上线。当前演示版聚焦于 8 步设计闭环的主链路。'),
      React.createElement('div', { className:'actions' },
        React.createElement('button', { className:'btn-primary', onClick:onClose }, '知道了'))
    ));
}

/* ====================== 顶栏 ====================== */
function TopBar({ onComingSoon }){
  const { project, notify, update } = useContext(Store);
  const { go } = useRoute();
  // 工具栏：标记哪些是"敬请期待"
  const tools = [
    ['📁','文件',true],['💾','保存',false],['↩','撤销',false],['↪','恢复',false],
    ['🗑','清空',true],['🤖','AI',true],['◎','显示',true],['🔧','工具',true],
    ['📐','渲染',true],['🖼','图册',true]
  ];
  const share = ()=>{
    const tok = project.share_token || Math.random().toString(36).slice(2,9);
    update({ share_token: tok });
    try{ navigator.clipboard.writeText(location.href.split('#')[0] + '#/share/' + tok); }catch(e){}
    notify('分享链接已复制：' + tok);
  };
  return React.createElement('div', { className:'topbar' },
    React.createElement('div', { className:'brand', onClick:()=>go('home') },
      React.createElement('div', { className:'logo' }, '宅'),
      React.createElement('div', null, 'AI 全屋装修设计',
        React.createElement('small', null, 'AI HOME DESIGN'))),
    React.createElement('div', { className:'tools' },
      tools.map(([ic, t, soon])=>
        React.createElement('button', {
          key:t, className:'tool-btn' + (soon?' disabled':''),
          onClick: ()=>{
            if (soon) onComingSoon(t);
            else if (t==='保存') notify('已保存到本地（演示）');
            else if (t==='撤销' || t==='恢复') notify(t + '（演示）');
          }
        },
          React.createElement('span', { className:'ic' }, ic),
          t,
          soon && React.createElement('span', { className:'tip' }, '敬请期待')))),
    React.createElement('div', { className:'spacer' }),
    React.createElement('div', { className:'right' },
      React.createElement('button', { className:'pill', onClick:share }, '👥 协作分享'),
      React.createElement('button', { className:'btn-ghost', onClick:()=>go('home') }, '退出')));
}

/* ====================== 步骤条 ====================== */
function StepBar(){
  const { route, go } = useRoute();
  const visible = STEPS.filter(s=>!s.hidden);
  const cur = visible.findIndex(s=>s.key===route);
  return React.createElement('div', { className:'steps' },
    visible.map((s,i)=>{
      const done = i<cur, active = i===cur;
      const cls = 'step' + (active?' active': done?' done':'');
      return React.createElement(React.Fragment, { key:s.key },
        React.createElement('div', {
          className: cls,
          onClick: ()=>{ if (done||active) go(s.key); }
        },
          React.createElement('span', { className:'n' }, done?'✓':s.n),
          s.label),
        i<visible.length-1 && React.createElement('span', { className:'sep' }, '›'));
    }));
}

/* ====================== StaleBanner ====================== */
function StaleBanner(){
  const { project, clearStale } = useContext(Store);
  const keys = Object.keys(project.stale||{});
  if (!keys.length) return null;
  const map = { layout:'布局', renders:'效果图', panoramas:'全景', quotation:'报价' };
  return React.createElement('div', { className:'stale-banner' },
    '⚠ 上游已修改，以下内容可能过期：' + keys.map(k=>map[k]||k).join('、'),
    React.createElement('button', { onClick:()=>keys.forEach(clearStale) }, '忽略'));
}

/* ====================== Workspace 框架 ====================== */
function Workspace({ rail, left, center, right, viewToggle, floorSwitch, hint }){
  const railItems = rail || [
    ['◳','户型',true],['◰','样板间',false],['☁','云素材',false],
    ['◫','定制',false],['◈','3D++',false],['☺','我的',false]
  ];
  return React.createElement('div', { className:'workspace' },
    React.createElement('div', { className:'rail' },
      railItems.map(([ic,t,on],i)=>React.createElement('div', {
        key:i, className:'rail-item'+(on?' on':'')
      }, React.createElement('span', { className:'ic' }, ic), t))),
    left && React.createElement('div', { className:'lpanel' }, left),
    React.createElement('div', { className:'canvas-wrap' },
      floorSwitch, viewToggle, center,
      hint && React.createElement('div', { className:'canvas-hint' }, hint)),
    right && React.createElement('div', { className:'rpanel' }, right));
}

/* ====================== StepFooter ====================== */
function StepFooter({ prev, next, nextLabel, nextDisabled, onNext, onPrev, hint }){
  const { go } = useRoute();
  return React.createElement('div', {
    style:{
      position:'absolute', bottom:0, left:0, right:0, height:60, display:'flex',
      alignItems:'center', justifyContent:'space-between', padding:'0 22px',
      background:'var(--panel)', borderTop:'1px solid var(--line)', zIndex:8,
      boxShadow:'0 -1px 4px rgba(15,23,42,.04)'
    }
  },
    React.createElement('button', {
      className:'btn-ghost', disabled:!prev,
      onClick: ()=> onPrev ? onPrev() : go(prev)
    }, '← 上一步'),
    hint && React.createElement('span', {
      style:{color:'var(--ink-3)', fontSize:12 }
    }, hint),
    React.createElement('button', {
      className:'btn-primary', disabled: nextDisabled,
      onClick: ()=>{ if (onNext) onNext(); else go(next); }
    }, (nextLabel||'下一步') + ' →'));
}

/* ====================== 首页 ====================== */
function HomePage({ onComingSoon }){
  const { go } = useRoute();
  const { update } = useContext(Store);
  const flow = ['需求问询','户型上传','3D 墙体','AI 布局','多方案对比','手动编辑','2D 效果图','720°全景','效果图换品','空间报价'];
  const start = (planType)=>{
    const fp = planType==='villa' ? AH.VILLA_2F : AH.APT_3BR;
    update({
      floor_plan: fp,
      current_floor_id: fp.floors[0].id,
      cad_imported: false, scale: null,
      plans: [], layout: null, renders: [], panoramas: [], stale: {}
    });
    go('step0');
  };
  return React.createElement('div', { className:'home fade-in' },
    React.createElement('h1', null, 'AI 全屋装修设计平台'),
    React.createElement('p', null,
      '从户型图到报价单的 8 步闭环演示：上传户型、标定比例、生成 3D 墙体、AI 布局多方案对比、手动编辑、效果图与 720° 全景、换品、智能报价。'),
    React.createElement('div', { className:'flow' },
      flow.map((f,i)=>React.createElement('span', { key:i }, (i+1)+'. '+f))),
    React.createElement('div', { className:'cta' },
      React.createElement('button', { className:'btn-primary', onClick:()=>start('apt') }, '🏢 体验单层公寓'),
      React.createElement('button', { className:'btn-primary', onClick:()=>start('villa') }, '🏡 体验双层别墅')),
    React.createElement('small', { className:'note', style:{marginTop:28, maxWidth:520}},
      '※ 纯前端演示，所有 AI 能力为 Mock；3D / 全景为实时渲染；产品图来自公开图库。'));
}

/* ====================== Step 0：需求问询 ====================== */
function Step0(){
  const { project, update } = useContext(Store);
  const { go } = useRoute();
  const r = project.requirement;
  const setR = patch => update(p=>({ requirement:{ ...p.requirement, ...patch }}));
  const budgets = [['economy','经济','8–15 万'],['comfort','舒适','15–25 万'],['luxury','豪华','25 万+']];
  const occ = r.occupants;
  const setOcc = patch => setR({ occupants:{ ...occ, ...patch }});
  const funcs = [['study','书房'],['guest','客卧'],['storage','储物'],['tea','茶室'],['office','居家办公']];

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' },
      React.createElement('h2', null, '需求问询'),
      React.createElement('p', null, '告诉我们你的偏好，AI 布局更精准')),
    React.createElement('div', { className:'pb' },
      React.createElement('small', { className:'note', style:{marginTop:0}},
        '画像将注入布局、选品与报价。可跳过用默认值。')));

  const center = React.createElement('div', {
    style:{ position:'absolute', inset:0, overflowY:'auto', padding:'32px 48px 80px'}
  },
    React.createElement('div', { className:'fade-in', style:{maxWidth:780, margin:'0 auto'}},
      // 预算
      React.createElement('div', { className:'group' },
        React.createElement('label', null, '装修预算'),
        React.createElement('div', { style:{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }},
          budgets.map(([id,nm,range])=>React.createElement('div', {
            key:id, className:'plan-card'+(r.budget_tier===id?' on':''),
            onClick:()=>setR({budget_tier:id}), style:{margin:0}
          },
            React.createElement('div', { className:'meta', style:{textAlign:'center', padding:'18px 12px'}},
              r.budget_tier===id && React.createElement('div', { className:'check' }, '✓'),
              React.createElement('b', { style:{fontSize:16}}, nm),
              React.createElement('div', { className:'price', style:{marginTop:6}}, range)))))),
      // 风格（图片选择）
      React.createElement('div', { className:'group' },
        React.createElement('label', null, '风格偏好（点图选择）'),
        React.createElement('div', { className:'style-grid' },
          AH.STYLES.map(s=>React.createElement('div', {
            key:s.id, className:'style-card'+(r.style===s.id?' on':''),
            onClick:()=>setR({style:s.id})
          },
            React.createElement('div', { className:'sw',
              style:{ backgroundImage:`url(${s.img})` }}),
            React.createElement('div', { className:'nm' }, s.name))))),
      // 人口
      React.createElement('div', { className:'group' },
        React.createElement('label', null, '居住人口'),
        React.createElement('div', { style:{display:'flex', alignItems:'center', gap:14, marginBottom:12 }},
          React.createElement('span', { className:'muted' }, '人数'),
          React.createElement('button', { className:'btn-ghost', onClick:()=>setOcc({count:Math.max(1, occ.count-1)})}, '−'),
          React.createElement('span', { style:{fontFamily:'var(--mono)', fontSize:18, minWidth:24, textAlign:'center'}}, occ.count),
          React.createElement('button', { className:'btn-ghost', onClick:()=>setOcc({count:occ.count+1})}, '+')),
        React.createElement('div', { className:'chips' },
          [['elderly','有老人'],['children','有小孩'],['pets','养宠物']].map(([k,t])=>
            React.createElement('button', { key:k, className:'chip'+(occ[k]?' on':''),
              onClick:()=>setOcc({[k]:!occ[k]})}, t)))),
      // 功能
      React.createElement('div', { className:'group' },
        React.createElement('label', null, '功能需求（多选）'),
        React.createElement('div', { className:'chips' },
          funcs.map(([k,t])=>React.createElement('button', {
            key:k, className:'chip'+(r.functions.includes(k)?' on':''),
            onClick:()=>setR({functions: r.functions.includes(k)? r.functions.filter(x=>x!==k):[...r.functions,k]})
          }, t))))));

  const next = ()=>{ setR({confirmed:true}); go('step1'); };
  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, center }),
    React.createElement(StepFooter, { prev:'home', onNext:next, nextLabel:'保存并进入户型' }));
}

/* ====================== Step 1：户型上传（含引导） ====================== */
function Step1(){
  const { project, update, notify } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan;
  const currentFloor = fp && fp.floors.find(f=>f.id===project.current_floor_id);
  const [showImportHint, setShowImportHint] = useState(!project.cad_imported);

  // 模拟"导入CAD"
  const doImport = ()=>{
    update({ cad_imported: true });
    setShowImportHint(false);
    notify('CAD 已成功识别 · ' + fp.name + ' · ' + fp.floors.length + ' 层');
  };
  const setScale = ()=>{
    update({ scale: { pixels_per_cm:2.45, method:'manual' } });
    notify('已按基准线换算全屋比例');
  };
  const switchFloor = (fid)=> update({ current_floor_id: fid });

  const totalArea = fp ? fp.floors.reduce((s,f)=>s + f.rooms.reduce((ss,r)=>ss+r.area_m2,0), 0).toFixed(1) : 0;

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' },
      React.createElement('h2', null, '户型'),
      React.createElement('p', null, '导入 CAD/图纸 → 标定比例')),
    React.createElement('div', { className:'pb' },
      // 导入 CAD（关键操作，加 pulse 动画）
      React.createElement('div', {
        className:'upload-zone'+(project.cad_imported?'':' pulse'),
        onClick: doImport
      },
        project.cad_imported
          ? React.createElement(React.Fragment, null,
              React.createElement('div', { className:'done' }, '✓ CAD 已导入'),
              React.createElement('small', { className:'note' }, fp.name + ' · ' + fp.floors.length + ' 层 · ' + totalArea + 'm²'))
          : React.createElement(React.Fragment, null,
              React.createElement('div', { className:'ic' }, '⬆'),
              React.createElement('div', { style:{fontWeight:600, color:'var(--ink)'}}, '导入户型图 / CAD'),
              React.createElement('small', { className:'note' }, '支持 JPG / PNG / PDF / DXF'),
              React.createElement('small', { className:'note', style:{color:'var(--primary)', fontWeight:600, marginTop:10}}, '👆 请先点这里'))),
      React.createElement('div', { className:'divider' }),
      React.createElement('div', { className:'group' },
        React.createElement('label', null, '比例标注'),
        React.createElement('p', { className:'muted', style:{fontSize:12, marginBottom:10 }},
          '画一条已知长度的墙输入真实尺寸，系统换算全屋。'),
        React.createElement('button', {
          className: project.scale ? 'btn-ghost' : 'btn-primary',
          style:{width:'100%'},
          disabled: !project.cad_imported,
          onClick: setScale
        }, project.scale ? '✓ 已标定 5.5m 基准' : '标定基准线（5.5m）')),
      React.createElement('div', { className:'group' },
        React.createElement('label', null, '画墙工具'),
        React.createElement('div', { className:'chips' },
          ['直墙','弧形墙','矩形墙','单开门','双开门','推拉门','普通窗','飘窗'].map(t=>
            React.createElement('button', { key:t, className:'chip',
              onClick:()=>notify(t + ' · 工具就绪（演示）')
            }, t))))));

  const right = currentFloor && React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' }, '楼层属性'),
    React.createElement('div', { className:'pb' },
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '当前楼层'),
        React.createElement('span', { className:'v' }, currentFloor.name)),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '本层面积'),
        React.createElement('span', { className:'v' }, currentFloor.rooms.reduce((s,r)=>s+r.area_m2,0).toFixed(1), React.createElement('span', { className:'vn' }, 'm²'))),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '本层房间数'),
        React.createElement('span', { className:'v' }, currentFloor.rooms.length)),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '本层层高'),
        React.createElement('span', { className:'v' }, currentFloor.height_cm*10, React.createElement('span', { className:'vn' }, 'mm'))),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '总面积'),
        React.createElement('span', { className:'v' }, totalArea, React.createElement('span', { className:'vn' }, 'm²'))),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '比例状态'),
        React.createElement('span', { className:'v', style:{color: project.scale?'var(--good)':'var(--warn)'}},
          project.scale?'已标定':'未标定')),
      React.createElement('div', { className:'divider' }),
      React.createElement('label', { style:{fontSize:11, color:'var(--ink-3)', textTransform:'uppercase'}}, '本层房间'),
      currentFloor.rooms.map(r=>React.createElement('div', { key:r.id, className:'field-row' },
        React.createElement('span', null, r.name),
        React.createElement('span', { className:'v' }, r.area_m2, React.createElement('span', { className:'vn' }, 'm²'))))));

  const center = React.createElement('div', { className:'canvas-2d', style:{position:'absolute', inset:0, padding:'20px 20px 76px'}},
    currentFloor && React.createElement(PlanCanvas2D, {
      floor: currentFloor,
      key: currentFloor.id  // 切换楼层强制重渲
    }));

  // 多楼层切换
  const floorSwitch = fp && fp.floors.length>1 && React.createElement('div', { className:'floor-switch' },
    fp.floors.map(f=>React.createElement('button', {
      key: f.id, className: project.current_floor_id===f.id?'on':'',
      onClick: ()=>switchFloor(f.id)
    }, f.name)),
    React.createElement('div', { className:'sep' }),
    React.createElement('button', { className:'add', onClick:()=>notify('新增楼层 · 敬请期待')}, '+'));

  const vt = React.createElement('div', { className:'view-toggle' },
    React.createElement('button', { className:'on' }, '2D'),
    React.createElement('button', { onClick:()=>{ if(project.cad_imported && project.scale) go('step2'); else notify('请先导入 CAD 并标定比例'); }}, '3D'));

  // 引导提示：未导入 CAD 时
  const guide = !project.cad_imported && React.createElement('div', {
    className:'guide right',
    style:{ top:130, left:316 }
  }, '👈 请先在左侧点「导入 CAD」');

  const nextDisabled = !project.cad_imported || !project.scale;
  const nextHint = !project.cad_imported ? '请先导入 CAD' : !project.scale ? '请标定基准线' : '';

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, right, center, viewToggle: vt, floorSwitch,
      hint: fp ? fp.name + ' · ' + totalArea+'㎡' : '' }),
    guide,
    React.createElement(StepFooter, {
      prev:'step0', next:'step2', nextDisabled, hint: nextHint,
      onNext: ()=> nextDisabled ? notify(nextHint) : go('step2')
    }));
}

/* 单独的 2D Canvas 组件（自适应大小） */
function PlanCanvas2D({ floor, items, highlightId, onPick, onDrag, draggable }){
  const wrapRef = useRef(null);
  const cvsRef = useRef(null);
  const [dims, setDims] = useState([800,600]);
  const mapRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(()=>{
    if(!wrapRef.current) return;
    const ro = new ResizeObserver(es=>{
      const { width, height } = es[0].contentRect;
      setDims([Math.max(200, Math.floor(width)), Math.max(200, Math.floor(height))]);
    });
    ro.observe(wrapRef.current);
    return ()=>ro.disconnect();
  },[]);

  useEffect(()=>{
    const c = cvsRef.current; if(!c) return;
    c.width = dims[0]; c.height = dims[1];
    mapRef.current = AC.drawFloor(c, floor, { items, highlightId });
  }, [floor, items, highlightId, dims]);

  const handleDown = (e)=>{
    if(!draggable && !onPick) return;
    const rect = cvsRef.current.getBoundingClientRect();
    const px = (e.clientX-rect.left) * (dims[0]/rect.width);
    const py = (e.clientY-rect.top) * (dims[1]/rect.height);
    const hit = AC.hitItem(items||[], px, py, mapRef.current);
    if (hit){
      if (draggable){
        dragRef.current = { ...hit, lastPx: px, lastPy: py };
        document.body.classList.add('dragging-cursor');
      }
      if (onPick) onPick(hit.item);
    } else if (onPick){
      onPick(null);
    }
  };
  const handleMove = (e)=>{
    if (!dragRef.current) return;
    const rect = cvsRef.current.getBoundingClientRect();
    const px = (e.clientX-rect.left) * (dims[0]/rect.width);
    const py = (e.clientY-rect.top) * (dims[1]/rect.height);
    const dragInfo = dragRef.current;
    // 屏幕中心 = px - dx
    const [cmX, cmY] = AC.screenToCm(px - dragInfo.dx, py - dragInfo.dy, mapRef.current);
    if (onDrag) onDrag(dragInfo.item.item_id, [cmX, cmY]);
  };
  const handleUp = ()=>{
    if (dragRef.current){
      dragRef.current = null;
      document.body.classList.remove('dragging-cursor');
    }
  };
  useEffect(()=>{
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return ()=>{
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  },[dims, items]);

  return React.createElement('div', {
    ref: wrapRef,
    style:{ width:'100%', height:'100%', borderRadius:8, overflow:'hidden',
      background:'#fff', boxShadow:'0 2px 12px rgba(15,23,42,.05)', border:'1px solid var(--line)' }
  },
    React.createElement('canvas', {
      ref: cvsRef,
      onMouseDown: handleDown,
      style:{ width:'100%', height:'100%', display:'block',
        cursor: draggable? 'grab' : (onPick? 'pointer':'default') }
    }));
}

/* ====================== Step 2：3D 墙体 ====================== */
function Step2(){
  const { project, update, notify } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan;
  const [view, setView] = useState('3d');
  const [showAllFloors, setShowAllFloors] = useState(fp && fp.floors.length>1);

  const currentFloor = fp && fp.floors.find(f=>f.id===project.current_floor_id);
  const floorsToShow = showAllFloors ? fp.floors : [currentFloor];

  const mountRef = useRef(null);
  useEffect(()=>{
    if (view!=='3d' || !mountRef.current || !fp) return;
    const inst = A3.createScene(mountRef.current, floorsToShow, null, {});
    return ()=>inst.dispose();
  }, [view, fp, project.current_floor_id, showAllFloors]);

  const right = fp && React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' }, '3D 视图'),
    React.createElement('div', { className:'pb' },
      fp.floors.length>1 && React.createElement('div', { className:'group' },
        React.createElement('label', null, '查看模式'),
        React.createElement('div', { className:'seg' },
          React.createElement('button', { className: showAllFloors?'':'on',
            onClick:()=>setShowAllFloors(false)}, '单层'),
          React.createElement('button', { className: showAllFloors?'on':'',
            onClick:()=>setShowAllFloors(true)}, '全楼'))),
      React.createElement('div', { className:'group' },
        React.createElement('label', null, '层高 (mm)'),
        currentFloor && React.createElement('input', {
          className:'slider', type:'range', min:2400, max:3200, step:100,
          defaultValue: currentFloor.height_cm*10, disabled:true
        }),
        currentFloor && React.createElement('div', { className:'field-row' },
          React.createElement('span', { className:'muted' }, '当前'),
          React.createElement('span', { className:'v' }, currentFloor.height_cm*10, ' mm'))),
      React.createElement('small', { className:'note' }, '🖱 拖动旋转 · 滚轮缩放 · 自动环绕'),
      React.createElement('div', { className:'divider' }),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '门窗数量'),
        React.createElement('span', { className:'v' },
          fp.floors.reduce((s,f)=>s+(f.openings||[]).length, 0))),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '楼层数'),
        React.createElement('span', { className:'v' }, fp.floors.length))));

  const center = view==='3d'
    ? React.createElement('div', { ref: mountRef, style:{position:'absolute', inset:0, paddingBottom:60 }})
    : React.createElement('div', { className:'canvas-2d', style:{position:'absolute', inset:0, padding:'20px 20px 76px'}},
      currentFloor && React.createElement(PlanCanvas2D, { floor: currentFloor, key: currentFloor.id }));

  const vt = React.createElement('div', { className:'view-toggle' },
    React.createElement('button', { className: view==='2d'?'on':'', onClick:()=>setView('2d') }, '2D'),
    React.createElement('button', { className: view==='3d'?'on':'', onClick:()=>setView('3d') }, '3D'));

  const floorSwitch = fp && fp.floors.length>1 && !showAllFloors && React.createElement('div', { className:'floor-switch' },
    fp.floors.map(f=>React.createElement('button', {
      key:f.id, className: project.current_floor_id===f.id?'on':'',
      onClick: ()=>update({current_floor_id:f.id})
    }, f.name)));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { right, center, viewToggle:vt, floorSwitch,
      hint: view==='3d'? '含门、窗（双线/飘窗/落地窗）·'+(showAllFloors?'全楼视图':'单层视图') : '2D 平面' }),
    React.createElement(StepFooter, { prev:'step1', next:'step3' }));
}

/* ====================== Step 3：AI 布局 + 多方案 ====================== */
function Step3(){
  const { project, update, notify } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan;
  const [tab, setTab] = useState('recommend');
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(()=>{
    setGenerating(true);
    setTimeout(()=>{
      const plans = AH.generateLayouts(fp, project.requirement);
      update({ plans, selected_plan_id: plans[0].plan_id, layout: plans[0] });
      setGenerating(false);
    }, 1000);
  },[fp, project.requirement]);

  useEffect(()=>{ if (!project.plans.length) generate(); },[]);

  const select = (plan)=> update({ selected_plan_id: plan.plan_id, layout: plan });

  // 当前楼层的 items（多楼层时只显示当前层）
  const currentFloor = fp.floors.find(f=>f.id===project.current_floor_id);
  const currentItems = project.layout
    ? project.layout.items.filter(it=>it.floor_id===project.current_floor_id)
    : [];
  const sp = AH.STYLES.find(s=>s.id===project.requirement.style);

  // 编辑布局：素材库（演示家具）
  const [searchCat, setSearchCat] = useState('all');
  const editList = useMemo(()=>{
    if (!fp) return [];
    if (searchCat === 'all') return AH.CATALOG;
    return AH.CATALOG.filter(s=>s.category===searchCat);
  }, [searchCat, fp]);

  const addFurniture = (sku)=>{
    if (!project.layout || !currentFloor) return;
    const room = currentFloor.rooms[0];
    const cx = room.polygon_cm.reduce((s,p)=>s+p[0],0)/room.polygon_cm.length;
    const cy = room.polygon_cm.reduce((s,p)=>s+p[1],0)/room.polygon_cm.length;
    const item = {
      item_id: 'add_'+Date.now(), floor_id: currentFloor.id, room_id: room.id,
      category: sku.category, sku_id: sku.sku_id,
      position_cm:[cx,cy], rotation_deg:0,
      size_cm:[sku.width_cm, sku.depth_cm, sku.height_cm],
      color: sku.color, name: sku.name, img: sku.img
    };
    update({ layout: { ...project.layout, items:[...project.layout.items, item] }});
    notify('已添加 ' + sku.name);
  };

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' },
      React.createElement('h2', null, 'AI 布局'),
      React.createElement('p', null, (sp?sp.name:'现代')+' · '+AH.BUDGET_LABEL[project.requirement.budget_tier])),
    React.createElement('div', { className:'pb' },
      React.createElement('div', { className:'tabs' },
        React.createElement('button', { className: tab==='recommend'?'on':'', onClick:()=>setTab('recommend')}, '推荐布局'),
        React.createElement('button', { className: tab==='edit'?'on':'', onClick:()=>setTab('edit')}, '编辑布局')),
      tab==='recommend'
        ? React.createElement(React.Fragment, null,
            React.createElement('button', { className:'btn-ghost', style:{width:'100%', marginBottom:12 },
              onClick: generate }, '↻ 重新生成方案'),
            generating
              ? React.createElement('div', { style:{padding:30 }},
                  React.createElement('div', { className:'spin' }),
                  React.createElement('p', { className:'muted', style:{textAlign:'center', marginTop:12 }}, 'AI 布局中…'))
              : project.plans.map(plan=>React.createElement('div', {
                  key:plan.plan_id, className:'plan-card'+(project.selected_plan_id===plan.plan_id?' on':''),
                  onClick:()=>select(plan)
                },
                  React.createElement('div', { className:'thumb' },
                    React.createElement(PlanThumb, { floor: currentFloor, items: plan.items.filter(it=>it.floor_id===currentFloor.id) })),
                  project.selected_plan_id===plan.plan_id && React.createElement('div', { className:'check' }, '✓'),
                  React.createElement('div', { className:'meta' },
                    React.createElement('b', null, plan.label),
                    React.createElement('div', { className:'hl' }, plan.highlights.map((h,i)=>React.createElement('span', { key:i }, h))),
                    React.createElement('div', { className:'price' }, '家具 ¥'+plan.furniture_total.toLocaleString())))))
        : React.createElement(React.Fragment, null,
            React.createElement('p', { className:'muted', style:{fontSize:12, marginBottom:10 }}, '点击家具卡片即可添加到当前楼层'),
            React.createElement('div', { className:'chips', style:{marginBottom:14 }},
              [['all','全部'], ...AH.EDIT_CATEGORIES.slice(0,8).map(c=>[c.key, c.name])].map(([k,n])=>
                React.createElement('button', { key:k, className:'chip'+(searchCat===k?' on':''),
                  onClick:()=>setSearchCat(k)}, n))),
            React.createElement('div', { className:'sku-grid' },
              editList.slice(0,16).map(s=>React.createElement('div', {
                key:s.sku_id, className:'sku-card', onClick:()=>addFurniture(s)
              },
                React.createElement('div', { className:'sw', style:{ backgroundImage:`url(${s.img})`}}),
                React.createElement('div', { className:'info' },
                  React.createElement('b', null, s.name),
                  React.createElement('div', { className:'br' }, s.brand),
                  React.createElement('div', { className:'p' }, '¥'+s.price))))))));

  const center = React.createElement('div', { className:'canvas-2d', style:{position:'absolute', inset:0, padding:'20px 20px 76px'}},
    currentFloor && React.createElement(PlanCanvas2D, {
      floor: currentFloor,
      items: currentItems,
      key: currentFloor.id + '_' + (project.selected_plan_id||'') + '_' + currentItems.length
    }));

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' }, '方案对比'),
    React.createElement('div', { className:'pb' },
      React.createElement('table', { className:'quote', style:{fontSize:12 }},
        React.createElement('tbody', null,
          React.createElement('tr', null, React.createElement('td', { className:'muted' }, '维度'),
            project.plans.map(p=>React.createElement('td', { key:p.plan_id, style:{fontWeight:700 }},
              p.plan_id==='plan_a'?'方案 A':'方案 B'))),
          React.createElement('tr', null, React.createElement('td', { className:'muted' }, '风格'),
            project.plans.map(p=>React.createElement('td', { key:p.plan_id }, sp?sp.name:'现代'))),
          React.createElement('tr', null, React.createElement('td', { className:'muted' }, '布局'),
            project.plans.map(p=>React.createElement('td', { key:p.plan_id }, p.plan_id==='plan_a'?'对称':'镜像'))),
          React.createElement('tr', null, React.createElement('td', { className:'muted' }, '家具'),
            project.plans.map(p=>React.createElement('td', { key:p.plan_id, className:'num' },
              '¥'+(p.furniture_total/1000).toFixed(1)+'k'))))),
      React.createElement('small', { className:'note' }, '选中方案后可在下一步编辑家具位置。')));

  const floorSwitch = fp.floors.length>1 && React.createElement('div', { className:'floor-switch' },
    fp.floors.map(f=>React.createElement('button', {
      key:f.id, className: project.current_floor_id===f.id?'on':'',
      onClick: ()=>update({current_floor_id:f.id})
    }, f.name)));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, center, right, floorSwitch,
      hint:'已选 ' + (project.selected_plan_id==='plan_a'?'方案 A':'方案 B') }),
    React.createElement(StepFooter, { prev:'step2', next:'step4', nextDisabled: !project.layout }));
}

function PlanThumb({ floor, items }){
  const ref = useRef(null);
  useEffect(()=>{
    const c = ref.current; if(!c) return;
    c.width=280; c.height=210;
    AC.drawFloor(c, floor, { items, labels:false, grid:false, pad:16, dimensions:false });
  },[floor, items]);
  return React.createElement('canvas', { ref, style:{width:'100%', height:'100%', display:'block'}});
}

/* ====================== Step 4：手动编辑（可拖动） ====================== */
function Step4(){
  const { project, update, markStale, notify } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan;
  const layout = project.layout;
  const [sel, setSel] = useState(null);
  const [view, setView] = useState('2d');

  useEffect(()=>{ if (!layout) go('step3'); },[layout]);
  if (!layout) return null;

  const currentFloor = fp.floors.find(f=>f.id===project.current_floor_id);
  const currentItems = layout.items.filter(it=>it.floor_id===project.current_floor_id);

  const moveItem = (itemId, newPos)=>{
    const items = layout.items.map(it=> it.item_id===itemId? {...it, position_cm: newPos } : it);
    update({ layout:{ ...layout, items }});
    // 拖拽期间不 markStale，结束时再标记
  };
  const finishMove = ()=> markStale(['renders','panoramas','quotation']);

  const removeItem = (id)=>{
    const items = layout.items.filter(i=>i.item_id!==id);
    update({ layout:{ ...layout, items }});
    markStale(['renders','panoramas','quotation']);
    setSel(null); notify('已删除家具');
  };
  const rotateItem = (id)=>{
    const items = layout.items.map(i=>i.item_id===id?{...i, rotation_deg:(i.rotation_deg+90)%360 }:i);
    update({ layout:{ ...layout, items }});
    markStale(['renders','panoramas']);
  };
  const addFromCatalog = (sku)=>{
    const room = currentFloor.rooms[0];
    const cx = room.polygon_cm.reduce((s,p)=>s+p[0],0)/room.polygon_cm.length;
    const cy = room.polygon_cm.reduce((s,p)=>s+p[1],0)/room.polygon_cm.length;
    const item = {
      item_id: 'add_'+Date.now(), floor_id: currentFloor.id, room_id: room.id,
      category: sku.category, sku_id: sku.sku_id,
      position_cm:[cx,cy], rotation_deg:0,
      size_cm:[sku.width_cm, sku.depth_cm, sku.height_cm],
      color: sku.color, name: sku.name, img: sku.img
    };
    update({ layout:{ ...layout, items:[...layout.items, item] }});
    markStale(['renders','panoramas','quotation']);
    notify('已添加 ' + sku.name);
  };

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' },
      React.createElement('h2', null, '手动编辑'),
      React.createElement('p', null, '🖱 拖动家具 · 点选编辑 · 添加新品')),
    React.createElement('div', { className:'pb' },
      React.createElement('label', { style:{fontSize:11, color:'var(--ink-3)', textTransform:'uppercase', display:'block', marginBottom:8 }}, '快速添加'),
      React.createElement('div', { className:'sku-grid' },
        ['sofa','bed','dining_table','wardrobe','coffee_table','lamp','chair','desk'].map(cat=>{
          const s = AH.catalogByCategory(cat)[0];
          if (!s) return null;
          return React.createElement('div', { key:cat, className:'sku-card', onClick:()=>addFromCatalog(s) },
            React.createElement('div', { className:'sw', style:{ backgroundImage:`url(${s.img})`}}),
            React.createElement('div', { className:'info' },
              React.createElement('b', null, s.name),
              React.createElement('div', { className:'p' }, '¥'+s.price)));
        }))));

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' }, sel? '家具属性' : '布局清单（'+currentItems.length+'）'),
    React.createElement('div', { className:'pb' },
      sel
        ? React.createElement(React.Fragment, null,
            React.createElement('div', { className:'sku-card', style:{marginBottom:14 }},
              React.createElement('div', { className:'sw', style:{height:96, backgroundImage:`url(${sel.img||''})`, backgroundColor: sel.color }}),
              React.createElement('div', { className:'info' }, React.createElement('b', null, sel.name))),
            React.createElement('div', { className:'field-row' },
              React.createElement('span', { className:'muted' }, '尺寸'),
              React.createElement('span', { className:'v' }, sel.size_cm[0]+'×'+sel.size_cm[1]+' cm')),
            React.createElement('div', { className:'field-row' },
              React.createElement('span', { className:'muted' }, '朝向'),
              React.createElement('span', { className:'v' }, sel.rotation_deg+'°')),
            React.createElement('div', { className:'field-row' },
              React.createElement('span', { className:'muted' }, '坐标'),
              React.createElement('span', { className:'v', style:{fontSize:11 }},
                Math.round(sel.position_cm[0])+', '+Math.round(sel.position_cm[1]))),
            React.createElement('div', { style:{display:'flex', gap:8, marginTop:14 }},
              React.createElement('button', { className:'btn-ghost', style:{flex:1 },
                onClick:()=>rotateItem(sel.item_id)}, '↻ 旋转 90°'),
              React.createElement('button', { className:'btn-ghost', style:{flex:1, color:'var(--bad)'},
                onClick:()=>removeItem(sel.item_id)}, '🗑 删除')))
        : React.createElement(React.Fragment, null,
            currentItems.map(it=>React.createElement('div', {
              key:it.item_id, className:'field-row', style:{cursor:'pointer'},
              onClick:()=>setSel(it)
            },
              React.createElement('span', null, it.name),
              React.createElement('span', { className:'vn' }, it.category))),
            React.createElement('small', { className:'note', style:{marginTop:14 }},
              '点击清单或画布中的家具可编辑；拖动家具改变位置。'))));

  // 选中的实时对象（保证拖拽后属性面板的坐标更新）
  const selectedItem = sel && layout.items.find(it=>it.item_id===sel.item_id);

  const center = view==='2d'
    ? React.createElement('div', { className:'canvas-2d', style:{position:'absolute', inset:0, padding:'20px 20px 76px'}},
        currentFloor && React.createElement(PlanCanvas2D, {
          floor: currentFloor,
          items: currentItems,
          highlightId: sel?.item_id,
          onPick: setSel,
          onDrag: (id, pos)=>{ moveItem(id, pos); if (selectedItem) setSel({...selectedItem, position_cm: pos }); },
          draggable: true,
          key: currentFloor.id
        }))
    : React.createElement(Scene3DWrap, { floors:[currentFloor], items: currentItems });

  const vt = React.createElement('div', { className:'view-toggle' },
    React.createElement('button', { className: view==='2d'?'on':'', onClick:()=>setView('2d') }, '2D'),
    React.createElement('button', { className: view==='3d'?'on':'', onClick:()=>setView('3d') }, '3D'));

  const floorSwitch = fp.floors.length>1 && React.createElement('div', { className:'floor-switch' },
    fp.floors.map(f=>React.createElement('button', {
      key:f.id, className: project.current_floor_id===f.id?'on':'',
      onClick: ()=>{ update({current_floor_id:f.id}); setSel(null); }
    }, f.name)));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, right, center, viewToggle:vt, floorSwitch,
      hint: view==='2d'? '🖱 拖动家具 · 点击编辑 · 共 ' + currentItems.length + ' 件' : '3D 预览' }),
    React.createElement(StepFooter, { prev:'step3', next:'step5' }));
}

// 3D 包装
function Scene3DWrap({ floors, items }){
  const ref = useRef(null);
  useEffect(()=>{
    if (!ref.current) return;
    const inst = A3.createScene(ref.current, floors, items, {});
    return ()=>inst.dispose();
  },[floors, items]);
  return React.createElement('div', { ref, style:{position:'absolute', inset:0, paddingBottom:60 }});
}

/* ====================== Step 5：效果图（真实产品图） ====================== */
function Step5(){
  const { project, update, notify } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan;
  const styleObj = AH.STYLES.find(s=>s.id===project.requirement.style) || AH.STYLES[0];
  const [generating, setGenerating] = useState(!project.renders.length);
  const [selRender, setSelRender] = useState(0);

  useEffect(()=>{ if (!project.layout) go('step3'); },[project.layout]);

  // 为每个主要房间生成一张「效果图」（真实场景图）
  useEffect(()=>{
    if (project.renders.length) return;
    setGenerating(true);
    setTimeout(()=>{
      const renders = [];
      fp.floors.forEach(f=>{
        f.rooms.forEach(r=>{
          if (!['living_room','bedroom','kitchen','bathroom'].includes(r.type)) return;
          const baseImg = AH.ROOM_SCENES[r.type] || styleObj.scene;
          renders.push({
            id: f.id+'_'+r.id,
            room_name: r.name + (fp.floors.length>1? ' ('+f.name+')':''),
            room_id: r.id, floor_id: f.id, room_type: r.type,
            image: baseImg,
            style_id: styleObj.id,
            hotspots: r.type==='living_room' ? [
              { id:'h1', label:'沙发', cat:'sofa',         bbox:[0.18, 0.55, 0.38, 0.32] },
              { id:'h2', label:'茶几', cat:'coffee_table', bbox:[0.36, 0.72, 0.20, 0.16] },
              { id:'h3', label:'电视柜', cat:'tv_board',    bbox:[0.62, 0.58, 0.28, 0.20] },
            ] : r.type==='bedroom' ? [
              { id:'h1', label:'床',     cat:'bed',        bbox:[0.20, 0.45, 0.45, 0.40] },
              { id:'h2', label:'床头柜', cat:'nightstand', bbox:[0.66, 0.55, 0.14, 0.18] },
            ] : [],
          });
        });
      });
      update({ renders });
      setGenerating(false);
    }, 1200);
  },[]);

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' },
      React.createElement('h2', null, '效果图'),
      React.createElement('p', null, styleObj.name + ' · 真实场景参考')),
    React.createElement('div', { className:'pb' },
      React.createElement('label', { style:{fontSize:11, color:'var(--ink-3)', textTransform:'uppercase', display:'block', marginBottom:8 }}, '房间列表'),
      project.renders.map((r,i)=>React.createElement('div', {
        key:r.id, className:'plan-card'+(i===selRender?' on':''),
        onClick:()=>setSelRender(i), style:{marginBottom:8 }
      },
        React.createElement('div', { className:'thumb', style:{
          aspectRatio:'16/9', backgroundImage:`url(${r.image})`,
          backgroundSize:'cover', backgroundPosition:'center'
        }}),
        i===selRender && React.createElement('div', { className:'check' }, '✓'),
        React.createElement('div', { className:'meta' },
          React.createElement('b', null, r.room_name))))));

  const current = project.renders[selRender];
  const center = React.createElement('div', { className:'render-stage' },
    generating
      ? React.createElement('div', { style:{textAlign:'center'}},
          React.createElement('div', { className:'spin' }),
          React.createElement('p', { className:'muted', style:{marginTop:14 }}, '正在合成效果图…'))
      : current && React.createElement('div', {
          style:{
            position:'relative', width:'85%', maxWidth:1100, aspectRatio:'16/9',
            borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-lg)',
            backgroundImage:`url(${current.image})`,
            backgroundSize:'cover', backgroundPosition:'center'
          }
        },
          React.createElement('div', {
            style:{
              position:'absolute', top:14, left:14, background:'rgba(15,23,42,.7)',
              color:'#fff', padding:'5px 14px', borderRadius:14, fontSize:12, backdropFilter:'blur(8px)'
            }
          }, current.room_name + ' · ' + styleObj.name)));

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' }, '渲染参数'),
    React.createElement('div', { className:'pb' },
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '风格'),
        React.createElement('span', { className:'v' }, styleObj.name)),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '已生成'),
        React.createElement('span', { className:'v' }, project.renders.length + ' 张')),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '当前'),
        React.createElement('span', { className:'v' }, current? current.room_name : '—')),
      React.createElement('div', { className:'divider' }),
      React.createElement('button', { className:'btn-ghost', style:{width:'100%', marginBottom:8 },
        onClick:()=>{ update({ renders: []}); notify('已清空，重新生成中…'); }
      }, '↻ 重新生成'),
      React.createElement('button', { className:'btn-primary', style:{width:'100%'},
        onClick:()=>go('step55')
      }, '查看 720° 全景 →'),
      React.createElement('small', { className:'note' }, '※ 效果图来源于公开图库的同风格参考。生产版可接 AI 生图（Stable Diffusion / SDXL）。')));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, right, center,
      hint: project.renders.length + ' 张效果图 · 点击右栏按钮进入全景' }),
    React.createElement(StepFooter, { prev:'step4', next:'step55' }));
}

/* ====================== Step 5.5：720° 全景（真实全景 URL） ====================== */
const PANORAMA_URL = 'https://img.gbuilderchina.com/panorama/direct-86c6862f-b698-4fd0-893c-355d0ba0e4a4/tour.html';
const PANORAMA_ROOMS = [
  { id:'living',   name:'客厅' },
  { id:'entry',    name:'玄关' },
  { id:'bedroom',  name:'卧室' },
  { id:'kitchen',  name:'厨房' },
  { id:'bathroom', name:'卫生间' },
];

function Step55(){
  const { project, notify } = useContext(Store);
  const styleObj = AH.STYLES.find(s=>s.id===project.requirement.style) || AH.STYLES[0];
  const [currentRoom, setCurrentRoom] = useState('living');
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef(null);

  // 切换房间时重置加载状态（演示版所有房间用同一个全景）
  useEffect(()=>{
    setLoaded(false); setFailed(false);
    // 给 iframe 一定时间加载，超时还没加载成功就显示提示
    const timer = setTimeout(()=>{
      if (!loaded && !failed){
        // iframe load 事件没触发，可能被 X-Frame-Options 拒绝
        try {
          // 尝试读 iframe 内容，跨域会抛错（这是正常的，至少证明 iframe 加载了）
          // 真正失败时一般也读不到，所以用 contentWindow 是否存在简单判断
          if (iframeRef.current && !iframeRef.current.contentWindow){
            setFailed(true);
          }
        } catch(e){
          // 跨域读不到内容是正常的，不算失败
        }
      }
    }, 8000);
    return ()=> clearTimeout(timer);
  }, [currentRoom]);

  const currentRoomObj = PANORAMA_ROOMS.find(r=>r.id===currentRoom) || PANORAMA_ROOMS[0];

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' }, '720° 全景'),
    React.createElement('div', { className:'pb' },
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '当前视角'),
        React.createElement('span', { className:'v' }, currentRoomObj.name)),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '风格'),
        React.createElement('span', { className:'v' }, styleObj.name)),
      React.createElement('div', { className:'field-row' },
        React.createElement('span', { className:'muted' }, '控制'),
        React.createElement('span', { className:'v', style:{fontSize:11 }}, '🖱 拖动 · 滚轮缩放')),
      React.createElement('div', { className:'divider' }),
      React.createElement('label', { style:{fontSize:11, color:'var(--ink-3)', textTransform:'uppercase', display:'block', marginBottom:8 }}, '切换视角'),
      React.createElement('div', { className:'chips' },
        PANORAMA_ROOMS.map(r=>React.createElement('button', {
          key: r.id,
          className: 'chip' + (currentRoom===r.id ? ' on' : ''),
          onClick: ()=>setCurrentRoom(r.id)
        }, r.name))),
      React.createElement('div', { className:'divider' }),
      React.createElement('button', {
        className:'btn-ghost', style:{width:'100%'},
        onClick: ()=> window.open(PANORAMA_URL, '_blank')
      }, '⤴ 在新窗口打开全景'),
      React.createElement('small', { className:'note' }, '※ 演示版所有房间共用同一真实全景示例；生产版可为每个房间挂接专属全景 URL。')));

  // 全景容器：iframe + 加载提示 + 失败降级
  const center = React.createElement('div', {
    style:{ position:'absolute', inset:0, paddingBottom:60, background:'#1a2233' }
  },
    // 加载中遮罩
    !loaded && !failed && React.createElement('div', {
      style:{
        position:'absolute', inset:0, paddingBottom:60, display:'flex',
        flexDirection:'column', alignItems:'center', justifyContent:'center',
        background:'#1a2233', color:'#9fb0c0', zIndex:2
      }
    },
      React.createElement('div', { className:'spin' }),
      React.createElement('p', { style:{marginTop:14, fontSize:13 }}, '正在加载真实全景...'),
      React.createElement('small', { style:{marginTop:6, fontSize:11, opacity:.6 }}, '首次加载可能需要几秒')),

    // 失败降级提示
    failed && React.createElement('div', {
      style:{
        position:'absolute', inset:0, paddingBottom:60, display:'flex',
        flexDirection:'column', alignItems:'center', justifyContent:'center',
        background:'#1a2233', color:'#9fb0c0', textAlign:'center', padding:40, zIndex:2
      }
    },
      React.createElement('div', { style:{fontSize:42, marginBottom:12 }}, '🌐'),
      React.createElement('h3', { style:{color:'#fff', marginBottom:8 }}, '全景无法嵌入显示'),
      React.createElement('p', { style:{fontSize:13, marginBottom:18, maxWidth:420 }},
        '远程全景服务可能限制了 iframe 嵌入（X-Frame-Options），可在新窗口直接打开查看。'),
      React.createElement('button', {
        className:'btn-primary',
        onClick: ()=> window.open(PANORAMA_URL, '_blank')
      }, '⤴ 在新窗口打开全景')),

    // iframe 本体
    React.createElement('iframe', {
      ref: iframeRef,
      key: currentRoom,  // 切换房间时重新加载
      src: PANORAMA_URL,
      style:{
        position:'absolute', top:0, left:0, right:0, bottom:60,
        width:'100%', height:'calc(100% - 60px)',
        border:'none', display:'block'
      },
      allow:'fullscreen; accelerometer; gyroscope; magnetometer',
      allowFullScreen: true,
      onLoad: ()=> setLoaded(true),
      onError: ()=> setFailed(true)
    }));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { right, center,
      hint: '🖱 真实全景 · ' + currentRoomObj.name + ' · ' + styleObj.name }),
    React.createElement(StepFooter, { prev:'step5', next:'step6' }));
}

/* ====================== Step 6：换品 ====================== */
function Step6(){
  const { project, update, markStale, notify } = useContext(Store);
  const { go } = useRoute();
  const [selHot, setSelHot] = useState(null);
  const [selRender, setSelRender] = useState(0);
  const styleObj = AH.STYLES.find(s=>s.id===project.requirement.style) || AH.STYLES[0];

  useEffect(()=>{ if (!project.renders.length) go('step5'); },[project.renders.length]);

  const recs = useMemo(()=>{
    if (!selHot) return [];
    return AH.recommend(selHot.cat, styleObj.id).slice(0,6);
  },[selHot, styleObj]);

  if (!project.renders.length) return null;
  const render = project.renders[selRender];

  const swap = (newSku)=>{
    // 更新 layout 中匹配类别的家具
    if (!project.layout) return;
    let replaced = false;
    const items = project.layout.items.map(it=>{
      if (!replaced && it.floor_id===render.floor_id && it.room_id===render.room_id && it.category===selHot.cat){
        replaced = true;
        return { ...it, sku_id:newSku.sku_id, name:newSku.name, color:newSku.color, img:newSku.img,
          size_cm:[newSku.width_cm, newSku.depth_cm, newSku.height_cm] };
      }
      return it;
    });
    update({ layout:{ ...project.layout, items }});
    markStale(['quotation','panoramas']);
    notify('已换 ' + selHot.label + ' → ' + newSku.name);
    setSelHot(null);
  };

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' },
      React.createElement('h2', null, '换品'),
      React.createElement('p', null, '点击效果图上的家具更换')),
    React.createElement('div', { className:'pb' },
      React.createElement('label', { style:{fontSize:11, color:'var(--ink-3)', textTransform:'uppercase', display:'block', marginBottom:8 }}, '房间'),
      project.renders.map((r,i)=>React.createElement('div', {
        key:r.id, className:'plan-card'+(i===selRender?' on':''),
        onClick:()=>{ setSelRender(i); setSelHot(null); }, style:{marginBottom:8 }
      },
        React.createElement('div', { className:'thumb', style:{
          aspectRatio:'16/9', backgroundImage:`url(${r.image})`,
          backgroundSize:'cover', backgroundPosition:'center'
        }}),
        i===selRender && React.createElement('div', { className:'check' }, '✓'),
        React.createElement('div', { className:'meta' }, React.createElement('b', null, r.room_name))))));

  const right = selHot
    ? React.createElement(React.Fragment, null,
        React.createElement('div', { className:'ph' }, '替换：' + selHot.label),
        React.createElement('div', { className:'pb' },
          React.createElement('div', { className:'sku-grid' },
            recs.map(sku=>React.createElement('div', {
              key:sku.sku_id, className:'sku-card', onClick:()=>swap(sku)
            },
              React.createElement('div', { className:'sw', style:{ backgroundImage:`url(${sku.img})`}}),
              React.createElement('div', { className:'info' },
                React.createElement('b', null, sku.name),
                React.createElement('div', { className:'br' }, sku.brand),
                React.createElement('div', { className:'p' }, '¥'+sku.price)))))))
    : React.createElement(React.Fragment, null,
        React.createElement('div', { className:'ph' }, '操作提示'),
        React.createElement('div', { className:'pb' },
          React.createElement('p', { className:'muted', style:{fontSize:12, lineHeight:1.8 }},
            '1. 在左侧选择房间\n2. 点击图上黄色高亮区域\n3. 右侧出现推荐 SKU\n4. 点击 SKU 完成替换'),
          React.createElement('div', { className:'divider' }),
          React.createElement('label', { style:{fontSize:11, color:'var(--ink-3)', textTransform:'uppercase', display:'block', marginBottom:8 }}, '可替换区域'),
          (render.hotspots||[]).length
            ? render.hotspots.map(h=>React.createElement('div', { key:h.id, className:'field-row' },
                React.createElement('span', null, '· ' + h.label),
                React.createElement('span', { className:'vn' }, h.cat)))
            : React.createElement('div', { className:'empty' }, '此房间暂无可换品热区')));

  const center = React.createElement('div', { className:'render-stage' },
    React.createElement('div', {
      style:{
        position:'relative', width:'85%', maxWidth:1100, aspectRatio:'16/9',
        borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-lg)',
        backgroundImage:`url(${render.image})`,
        backgroundSize:'cover', backgroundPosition:'center'
      }
    },
      React.createElement('div', {
        style:{
          position:'absolute', top:14, left:14, background:'rgba(15,23,42,.7)',
          color:'#fff', padding:'5px 14px', borderRadius:14, fontSize:12, backdropFilter:'blur(8px)'
        }
      }, render.room_name + ' · 点击高亮区域换品'),
      (render.hotspots||[]).map(h=>React.createElement('div', {
        key:h.id, className:'hotspot',
        style:{
          left: (h.bbox[0]*100)+'%', top: (h.bbox[1]*100)+'%',
          width: (h.bbox[2]*100)+'%', height: (h.bbox[3]*100)+'%',
          borderColor: selHot && selHot.id===h.id ? '#2563eb':'#d97706',
          background: selHot && selHot.id===h.id ? 'rgba(37,99,235,.18)':'rgba(217,119,6,.08)',
        },
        onClick:()=>setSelHot(h)
      },
        React.createElement('div', { className:'tag' }, h.label)))));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, right, center,
      hint: selHot? '已选 ' + selHot.label + ' · 右侧点击 SKU 替换' : '点击图上黄色区域开始换品' }),
    React.createElement(StepFooter, { prev:'step55', next:'step7' }));
}

/* ====================== Step 7：报价 ====================== */
function Step7(){
  const { project, update, clearStale } = useContext(Store);
  const fp = project.floor_plan;
  const [laborRate, setLaborRate] = useState(0.3);

  useEffect(()=>{
    if (!project.layout) return;
    const q = AH.generateQuotation(fp, project.layout, laborRate);
    update({ quotation: q });
    clearStale('quotation');
  }, [project.layout, laborRate]);

  const q = project.quotation;
  if (!q) return React.createElement('div', { className:'empty' }, '请先生成布局');

  const byType = {
    furniture: q.line_items.filter(l=>l.type==='furniture'),
    material: q.line_items.filter(l=>l.type==='material'),
  };

  const exportCsv = ()=>{
    const rows = [['类型','项目','位置','数量','单位','单价','小计']];
    q.line_items.forEach(l=> rows.push([
      l.type==='furniture'?'家具':'材料', l.name, l.room, l.qty, l.unit, l.unit_price, l.subtotal ]));
    rows.push(['','','','','','人工费', q.summary.labor_cost]);
    rows.push(['','','','','','总价', q.summary.grand_total]);
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='报价单.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className:'ph' },
      React.createElement('h2', null, '智能报价'),
      React.createElement('p', null, fp.name)),
    React.createElement('div', { className:'pb' },
      React.createElement('div', { className:'group' },
        React.createElement('label', null, '人工费比例'),
        React.createElement('input', { className:'slider', type:'range', min:0.15, max:0.5, step:0.05,
          value: laborRate, onChange:e=>setLaborRate(+e.target.value )}),
        React.createElement('div', { className:'field-row' },
          React.createElement('span', { className:'muted' }, '当前'),
          React.createElement('span', { className:'v' }, (laborRate*100).toFixed(0)+'%'))),
      React.createElement('button', { className:'btn-primary', style:{width:'100%', marginBottom:8 },
        onClick: exportCsv }, '⬇ 导出 CSV'),
      React.createElement('small', { className:'note' }, q.disclaimer)));

  const center = React.createElement('div', {
    style:{position:'absolute', inset:0, overflowY:'auto', padding:'28px 36px 80px'}
  },
    React.createElement('div', { className:'fade-in', style:{maxWidth:1000, margin:'0 auto'}},
      React.createElement('div', { className:'quote-total' },
        React.createElement('div', null,
          React.createElement('div', { className:'lbl' }, '装修总价'),
          React.createElement('div', { className:'big' }, '¥' + q.summary.grand_total.toLocaleString())),
        React.createElement('div', null,
          React.createElement('div', { className:'lbl' }, '单价'),
          React.createElement('div', { className:'sub' }, '¥' + q.summary.cost_per_m2 + '/㎡')),
        React.createElement('div', null,
          React.createElement('div', { className:'lbl' }, '面积'),
          React.createElement('div', { className:'sub' }, q.summary.total_area_m2 + ' ㎡'))),
      React.createElement('h3', { style:{margin:'18px 0 10px', fontSize:14 }}, '家具 · ¥' + q.summary.furniture_total.toLocaleString()),
      React.createElement('table', { className:'quote' },
        React.createElement('colgroup', null,
          React.createElement('col', { style:{width:'38%'}}),
          React.createElement('col', { style:{width:'22%'}}),
          React.createElement('col', { style:{width:'10%'}}),
          React.createElement('col', { style:{width:'15%'}}),
          React.createElement('col', { style:{width:'15%'}})),
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', null, '项目'),
            React.createElement('th', null, '位置'),
            React.createElement('th', { className:'num' }, '数量'),
            React.createElement('th', { className:'num' }, '单价'),
            React.createElement('th', { className:'num' }, '小计'))),
        React.createElement('tbody', null,
          byType.furniture.map((l,i)=>React.createElement('tr', { key:i },
            React.createElement('td', null, React.createElement('span', { className:'cat-tag furniture' }, '家具'), ' ', l.name),
            React.createElement('td', { className:'muted' }, l.room),
            React.createElement('td', { className:'num' }, l.qty),
            React.createElement('td', { className:'num' }, '¥' + l.unit_price),
            React.createElement('td', { className:'num' }, '¥' + l.subtotal.toLocaleString()))))),
      React.createElement('h3', { style:{margin:'18px 0 10px', fontSize:14 }}, '材料 · ¥' + q.summary.material_total.toLocaleString()),
      React.createElement('table', { className:'quote' },
        React.createElement('colgroup', null,
          React.createElement('col', { style:{width:'38%'}}),
          React.createElement('col', { style:{width:'22%'}}),
          React.createElement('col', { style:{width:'10%'}}),
          React.createElement('col', { style:{width:'15%'}}),
          React.createElement('col', { style:{width:'15%'}})),
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', null, '项目'),
            React.createElement('th', null, '位置'),
            React.createElement('th', { className:'num' }, '数量'),
            React.createElement('th', { className:'num' }, '单价'),
            React.createElement('th', { className:'num' }, '小计'))),
        React.createElement('tbody', null,
          byType.material.map((l,i)=>React.createElement('tr', { key:i },
            React.createElement('td', null, React.createElement('span', { className:'cat-tag material' }, '材料'), ' ', l.name),
            React.createElement('td', { className:'muted' }, l.room),
            React.createElement('td', { className:'num' }, l.qty + ' ' + l.unit),
            React.createElement('td', { className:'num' }, '¥' + l.unit_price),
            React.createElement('td', { className:'num' }, '¥' + l.subtotal.toLocaleString()))))),
      React.createElement('div', { style:{
        marginTop:18, padding:'14px 20px', background:'var(--panel)',
        border:'1px solid var(--line)', borderRadius:8,
        display:'flex', justifyContent:'space-between', alignItems:'center'
      }},
        React.createElement('span', { className:'muted' }, '人工费（' + (laborRate*100).toFixed(0) + '% 比例）'),
        React.createElement('span', {
          className:'v', style:{fontFamily:'var(--mono)', fontSize:16, color:'var(--amber)', fontWeight:700 }
        }, '¥' + q.summary.labor_cost.toLocaleString()))));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, center,
      hint: '共 ' + q.line_items.length + ' 项 · 总价 ¥' + q.summary.grand_total.toLocaleString() }),
    React.createElement(StepFooter, { prev:'step6', hint:'演示流程完成 🎉',
      nextLabel:'返回首页', onNext: ()=>location.hash='/home' }));
}

/* ====================== 分享只读页 ====================== */
function SharePage(){
  const { project } = useContext(Store);
  return React.createElement('div', { className:'home fade-in' },
    React.createElement('h1', null, '🔗 协作分享'),
    React.createElement('p', null,
      '已生成只读分享链接。在生产环境中，访问者可查看方案、留言评论，但不能修改设计。'),
    React.createElement('div', { style:{
      background:'var(--panel)', padding:'18px 22px', borderRadius:8,
      border:'1px solid var(--line)', maxWidth:520, fontFamily:'var(--mono)', fontSize:12
    }},
      'Token: ' + (project.share_token || '—')),
    React.createElement('p', { style:{marginTop:24 }},
      React.createElement('button', { className:'btn-primary',
        onClick:()=>location.hash='/home' }, '返回首页')));
}

/* ====================== App 根组件 ====================== */
function App(){
  const store = useProvideStore();
  const { route } = useRoute();
  const [comingSoon, setComingSoon] = useState(null);

  let page;
  if (route === 'home' || !route)            page = React.createElement(HomePage, { onComingSoon: setComingSoon });
  else if (route === 'step0')                page = React.createElement(Step0);
  else if (route === 'step1')                page = React.createElement(Step1);
  else if (route === 'step2')                page = React.createElement(Step2);
  else if (route === 'step3')                page = React.createElement(Step3);
  else if (route === 'step4')                page = React.createElement(Step4);
  else if (route === 'step5')                page = React.createElement(Step5);
  else if (route === 'step55')               page = React.createElement(Step55);
  else if (route === 'step6')                page = React.createElement(Step6);
  else if (route === 'step7')                page = React.createElement(Step7);
  else if (route.startsWith('share/'))       page = React.createElement(SharePage);
  else                                       page = React.createElement(HomePage, { onComingSoon: setComingSoon });

  const showShell = route !== 'home' && !route.startsWith('share/');

  return React.createElement(Store.Provider, { value: store },
    showShell && React.createElement(TopBar, { onComingSoon: setComingSoon }),
    showShell && React.createElement(StepBar),
    showShell && React.createElement(StaleBanner),
    page,
    comingSoon && React.createElement(ComingSoonModal, {
      feature: comingSoon, onClose:()=>setComingSoon(null) }),
    store.toast && React.createElement('div', { className:'toast' }, store.toast));
}

/* ====================== 挂载 ====================== */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
