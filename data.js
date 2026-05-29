/* =====================================================================
 * data.js — Mock 数据 & 引擎层
 * 对应 PRD: §4 数据模型 / §5.3 布局引擎 / §5.7 报价引擎 / §9 产品库种子
 * 全部纯前端、无后端、无联网。
 * ===================================================================== */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. 内置演示户型（FloorPlan）—— 参考截图三室两厅
   *    坐标单位 cm，原点左上，X 向右，Y 向下。
   * ---------------------------------------------------------------- */
  const DEMO_FLOORPLAN = {
    source_type: 'demo',
    name: '演示户型 · 三室两厅 97㎡',
    image_size_px: [1060, 1170],
    floor_height_cm: 280,
    // 房间多边形（cm）
    rooms: [
      { id: 'living',  type: 'living_room', name: '客餐厅', color: '#efe7d8',
        polygon_cm: [[470,360],[1010,360],[1010,1010],[470,1010]], area_m2: 35.1 },
      { id: 'master',  type: 'bedroom', name: '主卧', color: '#e7dccb',
        polygon_cm: [[30,520],[470,520],[470,1010],[30,1010]], area_m2: 21.3 },
      { id: 'second',  type: 'bedroom', name: '次卧', color: '#e7dccb',
        polygon_cm: [[230,160],[470,160],[470,520],[230,520]], area_m2: 8.6 },
      { id: 'study',   type: 'bedroom', name: '卧室', color: '#e7dccb',
        polygon_cm: [[470,160],[700,160],[700,360],[470,360]], area_m2: 4.6 },
      { id: 'kitchen', type: 'kitchen', name: '厨房', color: '#f3d9d4',
        polygon_cm: [[700,160],[1010,160],[1010,360],[700,360]], area_m2: 9.0 },
      { id: 'bath1',   type: 'bathroom', name: '卫生间', color: '#cfe3ef',
        polygon_cm: [[30,300],[230,300],[230,520],[30,520]], area_m2: 4.4 },
      { id: 'bath2',   type: 'bathroom', name: '卫生间2', color: '#cfe3ef',
        polygon_cm: [[230,160],[230,160],[230,300],[30,300]], area_m2: 3.2,
        polygon_cm_fix: [[30,160],[230,160],[230,300],[30,300]] },
    ],
    // 外轮廓墙（用于 3D 挤出，简化为矩形段集合）
    walls: [],
    openings: [],
    warnings: [],
  };
  // 修正 bath2 多边形
  DEMO_FLOORPLAN.rooms.forEach(r => { if (r.polygon_cm_fix) r.polygon_cm = r.polygon_cm_fix; });

  // 由房间多边形自动派生墙段（每条边一段墙）
  function deriveWalls(fp) {
    const segs = [];
    let wid = 0;
    const seen = new Set();
    fp.rooms.forEach(room => {
      const p = room.polygon_cm;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const key = [a, b].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        segs.push({ id: 'wall_' + (wid++), a, b, thickness_cm: 20 });
      }
    });
    return segs;
  }
  DEMO_FLOORPLAN.walls = deriveWalls(DEMO_FLOORPLAN);

  /* ------------------------------------------------------------------
   * 2. 产品库种子（catalog）—— PRD §9，精简到核心品类，每类多档位
   * ---------------------------------------------------------------- */
  const CATALOG = [
    // 沙发
    sku('SOFA_01','三人布艺沙发','左右家私','sofa',3200,['modern','cream'],[220,90,85],'#9aa7b0'),
    sku('SOFA_02','意式极简真皮沙发','natuzzi','sofa',8800,['luxury','modern'],[240,95,82],'#6b6f76'),
    sku('SOFA_03','侘寂原木布沙发','造作','sofa',5200,['wabi','japandi'],[210,92,78],'#b7a98f'),
    sku('SOFA_04','北欧小户型沙发','宜家','sofa',1800,['economy','nordic'],[180,85,80],'#c7cdd2'),
    // 床
    sku('BED_01','现代软包双人床','慕思','bed',4600,['modern'],[200,215,110],'#a89a86'),
    sku('BED_02','轻奢真皮床','顾家','bed',7200,['luxury'],[200,220,115],'#7d756a'),
    sku('BED_03','原木日式床','无印','bed',3200,['wabi','japandi','economy'],[200,210,95],'#c2b29a'),
    // 餐桌
    sku('TABLE_01','岩板餐桌6人','宜简','dining_table',3600,['modern','luxury'],[160,90,75],'#8d8d8d'),
    sku('TABLE_02','实木餐桌4人','源氏木语','dining_table',2200,['wabi','nordic','economy'],[140,80,75],'#bfa987'),
    // 电视柜
    sku('TVB_01','悬浮岩板电视柜','全屋定制','tv_board',2400,['modern','luxury'],[220,40,45],'#777'),
    sku('TVB_02','原木地柜','造作','tv_board',1600,['wabi','nordic','economy'],[200,40,48],'#b7a07e'),
    // 衣柜
    sku('WD_01','到顶推拉衣柜','索菲亚','wardrobe',5800,['modern','luxury'],[260,60,270],'#d8ccb6'),
    sku('WD_02','简易衣柜','宜家','wardrobe',1900,['economy','nordic'],[200,55,210],'#cdd3d8'),
    // 餐椅 / 茶几 / 灯
    sku('CHAIR_01','餐椅×4','造作','chair',1600,['modern','nordic','wabi'],[45,50,90],'#9a9a9a'),
    sku('COFFEE_01','岩板茶几','宜简','coffee_table',1400,['modern','luxury'],[120,60,40],'#888'),
    sku('COFFEE_02','原木茶几','源氏木语','coffee_table',900,['wabi','economy','nordic'],[110,55,42],'#bda884'),
    sku('LAMP_01','落地灯','宜家','lamp',600,['modern','nordic','wabi'],[40,40,160],'#caa'),
  ];
  function sku(id,name,brand,category,price,tags,size,color){
    return { sku_id:id, name, brand, category, price,
      style_tags:tags, width_cm:size[0], depth_cm:size[1], height_cm:size[2],
      color, thumbnail:null };
  }
  function catalogByCategory(cat){ return CATALOG.filter(s=>s.category===cat); }
  function recommend(category, style, excludeId){
    return CATALOG.filter(s=>s.category===category && s.sku_id!==excludeId)
      .sort((a,b)=> (b.style_tags.includes(style)?1:0)-(a.style_tags.includes(style)?1:0))
      .slice(0,8);
  }

  /* ------------------------------------------------------------------
   * 3. 布局引擎 layout_engine_v1（PRD §5.3.3）模板 + 约束放置
   * ---------------------------------------------------------------- */
  const ROOM_FURNITURE = {
    living_room: ['sofa','coffee_table','tv_board','lamp'],
    bedroom:     ['bed','wardrobe'],
    // 厨房卫生间演示版不放家具
  };
  const STYLE_LABEL = { modern:'现代简约', cream:'奶油风', wabi:'侘寂', luxury:'轻奢', nordic:'北欧', japandi:'日式' };
  const BUDGET_LABEL = { economy:'经济', comfort:'舒适', luxury:'豪华' };

  function pickSku(category, style, budget, variant){
    let list = catalogByCategory(category);
    // 预算过滤
    if (budget==='economy') list = list.sort((a,b)=>a.price-b.price);
    else if (budget==='luxury') list = list.sort((a,b)=>b.price-a.price);
    // 风格优先
    list = list.sort((a,b)=> (b.style_tags.includes(style)?1:0)-(a.style_tags.includes(style)?1:0));
    if (!list.length) return null;
    return list[Math.min(variant, list.length-1)] || list[0];
  }

  // 在房间内沿最长墙/角落放置家具，返回 items
  function placeRoom(room, style, budget, variant){
    const cats = ROOM_FURNITURE[room.type];
    if (!cats) return [];
    const poly = room.polygon_cm;
    const xs = poly.map(p=>p[0]), ys = poly.map(p=>p[1]);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2, w=maxX-minX, h=maxY-minY;
    const items = [];
    cats.forEach((cat,idx)=>{
      const s = pickSku(cat, style, budget, variant);
      if (!s) return;
      let pos, rot=0;
      if (cat==='sofa'){ pos=[cx + (variant? 0:0), maxY-60]; rot=0; }
      else if (cat==='coffee_table'){ pos=[cx, cy+20]; }
      else if (cat==='tv_board'){ pos=[cx, minY+30]; rot=0; }
      else if (cat==='lamp'){ pos=[variant? minX+50 : maxX-50, maxY-50]; }
      else if (cat==='bed'){ pos=[minX + s.width_cm/2 + 30, minY + s.depth_cm/2 + 30]; }
      else if (cat==='wardrobe'){ pos=[maxX - s.depth_cm/2 - 10, cy]; rot=90; }
      else { pos=[cx,cy]; }
      // variant 镜像
      if (variant) pos = [ (minX+maxX) - pos[0], pos[1] ];
      items.push({
        item_id: room.id+'_'+cat,
        room_id: room.id, category: cat, sku_id: s.sku_id,
        position_cm: pos, rotation_deg: rot,
        size_cm: [s.width_cm, s.depth_cm, s.height_cm], color: s.color, name: s.name,
      });
    });
    return items;
  }

  function generateLayouts(fp, profile){
    const style = profile.style || 'modern';
    const budget = profile.budget_tier || 'comfort';
    // 两套：A 标准，B 镜像/换档
    const plans = [0,1].map(variant=>{
      let items=[];
      fp.rooms.forEach(r=> items = items.concat(placeRoom(r, style, budget, variant)));
      const total = items.reduce((s,it)=>{
        const sk = CATALOG.find(c=>c.sku_id===it.sku_id); return s + (sk?sk.price:0);
      },0);
      return {
        plan_id: 'plan_'+(variant?'b':'a'),
        style, budget_tier: budget,
        label: variant? '方案 B · 镜像布局' : '方案 A · 推荐布局',
        highlights: variant? ['沙发镜像','动线更顺','次主卧采光'] : ['经典对称','电视墙居中','收纳充足'],
        furniture_total: total,
        items,
      };
    });
    return plans;
  }

  /* ------------------------------------------------------------------
   * 4. 报价引擎（PRD §5.7.3）
   * ---------------------------------------------------------------- */
  function roomWallArea(room, h){
    const p=room.polygon_cm; let per=0;
    for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];
      per+=Math.hypot(b[0]-a[0],b[1]-a[1]);}
    return (per/100) * (h/100); // m²
  }
  function generateQuotation(fp, plan, laborRate){
    const h = fp.floor_height_cm || 280;
    const lines = [];
    // 家具
    plan.items.forEach(it=>{
      const sk = CATALOG.find(c=>c.sku_id===it.sku_id); if(!sk) return;
      lines.push({type:'furniture', name:sk.name, room: roomName(fp,it.room_id),
        qty:1, unit:'件', unit_price:sk.price, subtotal:sk.price});
    });
    // 地板（客厅+卧室）
    fp.rooms.forEach(r=>{
      if(['living_room','bedroom'].includes(r.type)){
        const qty=+(r.area_m2*1.08).toFixed(1);
        lines.push({type:'material', name:'强化木地板', room:r.name, qty, unit:'m²', unit_price:180, subtotal:Math.round(qty*180)});
      }
    });
    // 墙漆（除厨卫）
    let paint=0; fp.rooms.forEach(r=>{ if(!['bathroom','kitchen'].includes(r.type)) paint+=roomWallArea(r,h);});
    paint=+(paint*1.1).toFixed(1);
    lines.push({type:'material', name:'乳胶漆', room:'全屋', qty:paint, unit:'m²', unit_price:35, subtotal:Math.round(paint*35)});
    // 瓷砖（厨卫地面）
    fp.rooms.forEach(r=>{ if(['bathroom','kitchen'].includes(r.type)){
      const qty=+(r.area_m2*1.1).toFixed(1);
      lines.push({type:'material', name:'地砖', room:r.name, qty, unit:'m²', unit_price:120, subtotal:Math.round(qty*120)});
    }});
    const furniture_total = sum(lines.filter(l=>l.type==='furniture'));
    const material_total  = sum(lines.filter(l=>l.type==='material'));
    const labor_cost = Math.round((furniture_total+material_total)*laborRate);
    const grand_total = furniture_total+material_total+labor_cost;
    const total_area = +fp.rooms.reduce((s,r)=>s+r.area_m2,0).toFixed(1);
    return { line_items:lines, summary:{
      furniture_total, material_total, labor_rate:laborRate, labor_cost, grand_total,
      total_area_m2: total_area, cost_per_m2: Math.round(grand_total/total_area)
    }, disclaimer:'演示报价，仅供参考，误差可能超过 ±15%' };
  }
  function sum(arr){return arr.reduce((s,l)=>s+l.subtotal,0);}
  function roomName(fp,id){const r=fp.rooms.find(x=>x.id===id);return r?r.name:'';}

  /* ------------------------------------------------------------------
   * 5. 风格预设（用于 Step0 图片化选择 / 渲染色调）
   * ---------------------------------------------------------------- */
  const STYLES = [
    { id:'modern', name:'现代简约', wall:'#eceae6', floor:'#cbb79a', accent:'#3a4a5a' },
    { id:'cream',  name:'奶油风',   wall:'#f5efe6', floor:'#d8c4a8', accent:'#c8a06a' },
    { id:'wabi',   name:'侘寂',     wall:'#e6e1d8', floor:'#b6a285', accent:'#8a7a5c' },
    { id:'luxury', name:'轻奢',     wall:'#e9e6e2', floor:'#b9a888', accent:'#9a7b3c' },
    { id:'nordic', name:'北欧',     wall:'#f2f2ef', floor:'#d9c9b0', accent:'#6b8e9e' },
    { id:'japandi',name:'日式',     wall:'#e8e4da', floor:'#c2ab86', accent:'#7c6a4e' },
  ];

  global.AIHome = {
    DEMO_FLOORPLAN, CATALOG, STYLES, STYLE_LABEL, BUDGET_LABEL,
    catalogByCategory, recommend, generateLayouts, generateQuotation,
    deriveWalls,
  };
})(window);
