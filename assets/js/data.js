/* =====================================================================
 * data.js — Mock 数据 & 引擎层 v2
 * 新增：多楼层（别墅/复式）、门窗（CAD 规范）、真实产品图 URL、扩展演示家具库
 * ===================================================================== */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. 门窗结构定义
   *    门：单开门(swing)、双开门(double)、推拉门(slide)
   *    窗：普通窗(window)、飘窗(bay)、落地窗(french)
   * ---------------------------------------------------------------- */
  // 在指定墙段上添加门/窗（位置为沿墙的距离，cm）
  function opening(type, wall_a, wall_b, offset_cm, width_cm, props) {
    return { type, a: wall_a, b: wall_b, offset_cm, width_cm, ...(props || {}) };
  }

  /* ------------------------------------------------------------------
   * 2. 户型库：单层公寓 + 双层别墅
   * ---------------------------------------------------------------- */

  // 户型 A：单层三室两厅（默认）
  const APT_3BR = {
    id: 'apt_3br',
    name: '三室两厅 · 97㎡',
    type: 'apartment',
    floors: [{
      id: 'F1', name: '1F', height_cm: 280,
      rooms: [
        { id: 'living',  type: 'living_room', name: '客餐厅', color: '#f5efe3',
          polygon_cm: [[470,360],[1010,360],[1010,1010],[470,1010]], area_m2: 35.1 },
        { id: 'master',  type: 'bedroom', name: '主卧', color: '#ecdfc7',
          polygon_cm: [[30,520],[470,520],[470,1010],[30,1010]], area_m2: 21.3 },
        { id: 'second',  type: 'bedroom', name: '次卧', color: '#ecdfc7',
          polygon_cm: [[230,160],[470,160],[470,520],[230,520]], area_m2: 8.6 },
        { id: 'study',   type: 'bedroom', name: '书房', color: '#ecdfc7',
          polygon_cm: [[470,160],[700,160],[700,360],[470,360]], area_m2: 4.6 },
        { id: 'kitchen', type: 'kitchen', name: '厨房', color: '#f3dad4',
          polygon_cm: [[700,160],[1010,160],[1010,360],[700,360]], area_m2: 9.0 },
        { id: 'bath1',   type: 'bathroom', name: '主卫', color: '#d6e6f0',
          polygon_cm: [[30,300],[230,300],[230,520],[30,520]], area_m2: 4.4 },
        { id: 'bath2',   type: 'bathroom', name: '客卫', color: '#d6e6f0',
          polygon_cm: [[30,160],[230,160],[230,300],[30,300]], area_m2: 3.2 },
      ],
      openings: [
        // 门
        { type: 'door_swing',  pos:[470,720], dir: 'h', width:90, swing:'in_right', room:'master' },     // 主卧入口
        { type: 'door_swing',  pos:[350,520], dir: 'v', width:80, swing:'in_down',  room:'second' },     // 次卧入口
        { type: 'door_swing',  pos:[585,360], dir: 'v', width:75, swing:'in_down',  room:'study' },      // 书房入口
        { type: 'door_swing',  pos:[230,400], dir: 'v', width:75, swing:'in_right', room:'bath1' },      // 主卫入口
        { type: 'door_swing',  pos:[230,230], dir: 'v', width:70, swing:'in_right', room:'bath2' },      // 客卫入口
        { type: 'door_slide',  pos:[855,360], dir: 'v', width:160, room:'kitchen' },                     // 厨房推拉门
        { type: 'door_double', pos:[740,1010],dir: 'h', width:160, swing:'out_up',  room:'entry' },      // 入户双开门
        // 窗
        { type: 'window',      pos:[250,1010],dir: 'h', width:180, room:'master' },                      // 主卧窗
        { type: 'window',      pos:[760,1010],dir: 'h', width:200, room:'living' },                      // 客厅窗
        { type: 'window',      pos:[345,160], dir: 'h', width:140, room:'second' },                      // 次卧窗
        { type: 'window_bay',  pos:[860,160], dir: 'h', width:240, room:'kitchen' },                     // 厨房飘窗
        { type: 'window',      pos:[30,420],  dir: 'v', width:80,  room:'bath1' },                       // 主卫窗
      ]
    }]
  };

  // 户型 B：双层别墅
  const VILLA_2F = {
    id: 'villa_2f',
    name: '双层别墅 · 220㎡',
    type: 'villa',
    floors: [
      {
        id: 'F1', name: '1F', height_cm: 320,
        rooms: [
          { id: 'living',  type: 'living_room', name: '客厅', color: '#f5efe3',
            polygon_cm: [[200,400],[800,400],[800,1000],[200,1000]], area_m2: 36.0 },
          { id: 'dining',  type: 'living_room', name: '餐厅', color: '#f5efe3',
            polygon_cm: [[800,400],[1200,400],[1200,700],[800,700]], area_m2: 12.0 },
          { id: 'kitchen', type: 'kitchen', name: '厨房', color: '#f3dad4',
            polygon_cm: [[800,200],[1200,200],[1200,400],[800,400]], area_m2: 8.0 },
          { id: 'guest',   type: 'bedroom', name: '客房', color: '#ecdfc7',
            polygon_cm: [[800,700],[1200,700],[1200,1000],[800,1000]], area_m2: 12.0 },
          { id: 'bath_g',  type: 'bathroom', name: '客卫', color: '#d6e6f0',
            polygon_cm: [[200,200],[400,200],[400,400],[200,400]], area_m2: 4.0 },
          { id: 'stairs1', type: 'stairs', name: '楼梯', color: '#e8e0d0',
            polygon_cm: [[400,200],[800,200],[800,400],[400,400]], area_m2: 16.0 },
        ],
        openings: [
          { type:'door_double', pos:[450,1000], dir:'h', width:180, swing:'out_up', room:'entry' },
          { type:'door_swing',  pos:[500,400],  dir:'h', width:90,  swing:'in_up',  room:'living' },
          { type:'door_swing',  pos:[1000,700], dir:'h', width:80,  swing:'in_up',  room:'guest' },
          { type:'door_slide',  pos:[1000,400], dir:'h', width:160, room:'kitchen' },
          { type:'door_swing',  pos:[300,400],  dir:'h', width:70,  swing:'in_up',  room:'bath_g' },
          { type:'window',      pos:[500,1000], dir:'h', width:300, room:'living' },
          { type:'window_french',pos:[1200,550],dir:'v', width:300, room:'dining' },
          { type:'window_bay',  pos:[1000,200], dir:'h', width:280, room:'kitchen' },
        ]
      },
      {
        id: 'F2', name: '2F', height_cm: 300,
        rooms: [
          { id: 'master', type: 'bedroom', name: '主卧', color: '#ecdfc7',
            polygon_cm: [[200,400],[700,400],[700,1000],[200,1000]], area_m2: 30.0 },
          { id: 'master_bath', type: 'bathroom', name: '主卫', color: '#d6e6f0',
            polygon_cm: [[200,200],[400,200],[400,400],[200,400]], area_m2: 4.0 },
          { id: 'child', type: 'bedroom', name: '儿童房', color: '#ecdfc7',
            polygon_cm: [[800,400],[1200,400],[1200,700],[800,700]], area_m2: 12.0 },
          { id: 'child_bath', type: 'bathroom', name: '儿童卫', color: '#d6e6f0',
            polygon_cm: [[800,700],[1000,700],[1000,1000],[800,1000]], area_m2: 6.0 },
          { id: 'study', type: 'bedroom', name: '书房', color: '#ecdfc7',
            polygon_cm: [[1000,700],[1200,700],[1200,1000],[1000,1000]], area_m2: 6.0 },
          { id: 'stairs2', type: 'stairs', name: '楼梯口', color: '#e8e0d0',
            polygon_cm: [[400,200],[800,200],[800,400],[400,400]], area_m2: 16.0 },
        ],
        openings: [
          { type:'door_swing', pos:[450,400], dir:'h', width:90, swing:'in_up', room:'master' },
          { type:'door_swing', pos:[300,400], dir:'h', width:70, swing:'in_up', room:'master_bath' },
          { type:'door_swing', pos:[1000,400],dir:'h', width:80, swing:'in_up', room:'child' },
          { type:'door_swing', pos:[1100,700],dir:'h', width:70, swing:'in_up', room:'study' },
          { type:'door_swing', pos:[900,700], dir:'h', width:70, swing:'in_up', room:'child_bath' },
          { type:'window',     pos:[450,1000],dir:'h', width:240, room:'master' },
          { type:'window_french',pos:[700,700],dir:'v', width:200, room:'master' },
          { type:'window',     pos:[1000,400],dir:'h', width:0, room:'child' },
          { type:'window',     pos:[1000,400],dir:'h', width:180, room:'child' },
        ]
      }
    ]
  };

  // 派生墙段（每条边一段，去重）
  function deriveWalls(floor){
    const segs = [];
    let wid = 0;
    const seen = new Set();
    floor.rooms.forEach(room => {
      const p = room.polygon_cm;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const key = [a.join(','),b.join(',')].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        segs.push({ id: 'wall_'+(wid++), a, b, thickness_cm: 24 });
      }
    });
    return segs;
  }
  // 给所有楼层补 walls
  [APT_3BR, VILLA_2F].forEach(fp => fp.floors.forEach(f => f.walls = deriveWalls(f)));

  /* ------------------------------------------------------------------
   * 3. 风格预设 + 风格效果图（用真实图床 URL）
   * ---------------------------------------------------------------- */
  // Unsplash 是公开图床，提供高质量免费图片（运行时浏览器加载）
  const STYLES = [
    { id:'modern', name:'现代简约', wall:'#eceae6', floor:'#cbb79a', accent:'#3a4a5a',
      img:'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
      scene:'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1280&q=85' },
    { id:'cream',  name:'奶油风',   wall:'#f5efe6', floor:'#d8c4a8', accent:'#c8a06a',
      img:'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&q=80',
      scene:'https://images.unsplash.com/photo-1616137466211-f939a420be84?w=1280&q=85' },
    { id:'wabi',   name:'侘寂',     wall:'#e6e1d8', floor:'#b6a285', accent:'#8a7a5c',
      img:'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=600&q=80',
      scene:'https://images.unsplash.com/photo-1615873968403-89e068629265?w=1280&q=85' },
    { id:'luxury', name:'轻奢',     wall:'#e9e6e2', floor:'#b9a888', accent:'#9a7b3c',
      img:'https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=600&q=80',
      scene:'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1280&q=85' },
    { id:'nordic', name:'北欧',     wall:'#f2f2ef', floor:'#d9c9b0', accent:'#6b8e9e',
      img:'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&q=80',
      scene:'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=1280&q=85' },
    { id:'japandi',name:'日式',     wall:'#e8e4da', floor:'#c2ab86', accent:'#7c6a4e',
      img:'https://images.unsplash.com/photo-1617104551722-3b2d51366400?w=600&q=80',
      scene:'https://images.unsplash.com/photo-1618220179428-22790b461013?w=1280&q=85' },
  ];

  /* ------------------------------------------------------------------
   * 4. 产品库种子（每件含真实图片 URL）
   * ---------------------------------------------------------------- */
  // 图片来源：Unsplash 公开图库，运行时由浏览器加载
  const CATALOG = [
    // 沙发
    sku('SOFA_01','三人布艺沙发','左右家私','sofa',3200,['modern','cream','nordic'],[220,90,85],'#9aa7b0',
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80'),
    sku('SOFA_02','意式极简真皮沙发','natuzzi','sofa',8800,['luxury','modern'],[240,95,82],'#6b6f76',
      'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80'),
    sku('SOFA_03','侘寂原木布沙发','造作','sofa',5200,['wabi','japandi'],[210,92,78],'#b7a98f',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400&q=80'),
    sku('SOFA_04','北欧小户型沙发','宜家','sofa',1800,['nordic'],[180,85,80],'#c7cdd2',
      'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=400&q=80'),
    // 床
    sku('BED_01','现代软包双人床','慕思','bed',4600,['modern'],[200,215,110],'#a89a86',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&q=80'),
    sku('BED_02','轻奢真皮床','顾家','bed',7200,['luxury'],[200,220,115],'#7d756a',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=80'),
    sku('BED_03','原木日式床','无印','bed',3200,['wabi','japandi'],[200,210,95],'#c2b29a',
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&q=80'),
    // 餐桌
    sku('TABLE_01','岩板餐桌6人','宜简','dining_table',3600,['modern','luxury'],[160,90,75],'#8d8d8d',
      'https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=400&q=80'),
    sku('TABLE_02','实木餐桌4人','源氏木语','dining_table',2200,['wabi','nordic'],[140,80,75],'#bfa987',
      'https://images.unsplash.com/photo-1604578762246-41134e37f9cc?w=400&q=80'),
    // 电视柜
    sku('TVB_01','悬浮岩板电视柜','全屋定制','tv_board',2400,['modern','luxury'],[220,40,45],'#777',
      'https://images.unsplash.com/photo-1601979031925-9d3aa6c2cb73?w=400&q=80'),
    sku('TVB_02','原木地柜','造作','tv_board',1600,['wabi','nordic'],[200,40,48],'#b7a07e',
      'https://images.unsplash.com/photo-1567538096621-38d2284b23ff?w=400&q=80'),
    // 衣柜
    sku('WD_01','到顶推拉衣柜','索菲亚','wardrobe',5800,['modern','luxury'],[260,60,270],'#d8ccb6',
      'https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=400&q=80'),
    sku('WD_02','简易衣柜','宜家','wardrobe',1900,['nordic'],[200,55,210],'#cdd3d8',
      'https://images.unsplash.com/photo-1558997519-c8c2e3c5a59c?w=400&q=80'),
    // 餐椅
    sku('CHAIR_01','餐椅·原木','造作','chair',400,['modern','nordic','wabi'],[45,50,90],'#9a9a9a',
      'https://images.unsplash.com/photo-1503602642458-232111445657?w=400&q=80'),
    sku('CHAIR_02','餐椅·绒布','宜简','chair',520,['cream','luxury'],[48,52,92],'#c8b39a',
      'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=400&q=80'),
    // 茶几
    sku('COFFEE_01','岩板茶几','宜简','coffee_table',1400,['modern','luxury'],[120,60,40],'#888',
      'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400&q=80'),
    sku('COFFEE_02','原木茶几','源氏木语','coffee_table',900,['wabi','nordic'],[110,55,42],'#bda884',
      'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=400&q=80'),
    // 灯
    sku('LAMP_01','落地灯','宜家','lamp',600,['modern','nordic','wabi'],[40,40,160],'#caa',
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&q=80'),
    sku('LAMP_02','吊灯','飞利浦','pendant',800,['modern','luxury'],[60,60,40],'#d4af7a',
      'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=400&q=80'),
    // 书桌
    sku('DESK_01','实木书桌','源氏木语','desk',1500,['wabi','nordic','modern'],[140,60,75],'#b09870',
      'https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=400&q=80'),
    // 床头柜
    sku('NIGHT_01','床头柜','源氏木语','nightstand',680,['modern','nordic','wabi'],[50,40,55],'#b8a586',
      'https://images.unsplash.com/photo-1551298370-9d3d53740c72?w=400&q=80'),
    // 餐边柜
    sku('SIDE_01','餐边柜','造作','sideboard',2200,['modern','nordic'],[160,40,80],'#a89880',
      'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=400&q=80'),
    // 地毯
    sku('RUG_01','客厅地毯','圣象','rug',1200,['modern','cream','nordic','wabi'],[200,140,2],'#c8b8a8',
      'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80'),
  ];
  function sku(id,name,brand,category,price,tags,size,color,img){
    return { sku_id:id, name, brand, category, price, style_tags:tags,
      width_cm:size[0], depth_cm:size[1], height_cm:size[2], color, img };
  }
  function catalogByCategory(cat){ return CATALOG.filter(s=>s.category===cat); }
  function recommend(category, style, excludeId){
    return CATALOG.filter(s=>s.category===category && s.sku_id!==excludeId)
      .sort((a,b)=> (b.style_tags.includes(style)?1:0)-(a.style_tags.includes(style)?1:0))
      .slice(0,8);
  }
  // 用于「编辑布局」素材库的展示分类
  const EDIT_CATEGORIES = [
    { key:'sofa', name:'沙发', icon:'🛋️' },
    { key:'bed', name:'床', icon:'🛏️' },
    { key:'dining_table', name:'餐桌', icon:'🪑' },
    { key:'chair', name:'椅子', icon:'🪑' },
    { key:'wardrobe', name:'衣柜', icon:'🚪' },
    { key:'tv_board', name:'电视柜', icon:'📺' },
    { key:'coffee_table', name:'茶几', icon:'🟫' },
    { key:'desk', name:'书桌', icon:'📚' },
    { key:'nightstand', name:'床头柜', icon:'🗄️' },
    { key:'sideboard', name:'餐边柜', icon:'🗄️' },
    { key:'lamp', name:'落地灯', icon:'💡' },
    { key:'pendant', name:'吊灯', icon:'💡' },
    { key:'rug', name:'地毯', icon:'🟫' },
  ];

  /* ------------------------------------------------------------------
   * 5. 布局引擎
   * ---------------------------------------------------------------- */
  const ROOM_FURNITURE = {
    living_room: ['sofa','coffee_table','tv_board','lamp','rug'],
    bedroom:     ['bed','wardrobe','nightstand'],
  };
  const STYLE_LABEL = { modern:'现代简约', cream:'奶油风', wabi:'侘寂', luxury:'轻奢', nordic:'北欧', japandi:'日式' };
  const BUDGET_LABEL = { economy:'经济', comfort:'舒适', luxury:'豪华' };

  function pickSku(category, style, budget, variant){
    let list = catalogByCategory(category);
    if (budget==='economy') list = list.slice().sort((a,b)=>a.price-b.price);
    else if (budget==='luxury') list = list.slice().sort((a,b)=>b.price-a.price);
    else list = list.slice();
    list = list.sort((a,b)=> (b.style_tags.includes(style)?1:0)-(a.style_tags.includes(style)?1:0));
    if (!list.length) return null;
    return list[Math.min(variant||0, list.length-1)] || list[0];
  }

  function placeRoom(room, style, budget, variant, floorId){
    const cats = ROOM_FURNITURE[room.type];
    if (!cats) return [];
    const poly = room.polygon_cm;
    const xs = poly.map(p=>p[0]), ys = poly.map(p=>p[1]);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    const items = [];
    cats.forEach((cat,idx)=>{
      const s = pickSku(cat, style, budget, variant);
      if (!s) return;
      let pos, rot=0;
      if (cat==='sofa'){ pos=[cx, maxY-70]; rot=0; }
      else if (cat==='coffee_table'){ pos=[cx, cy+10]; }
      else if (cat==='tv_board'){ pos=[cx, minY+30]; rot=0; }
      else if (cat==='lamp'){ pos=[variant? minX+50 : maxX-50, maxY-60]; }
      else if (cat==='rug'){ pos=[cx, cy+10]; }
      else if (cat==='bed'){ pos=[minX + s.width_cm/2 + 35, minY + s.depth_cm/2 + 35]; }
      else if (cat==='nightstand'){ pos=[minX + s.width_cm/2 + 30, minY + 55]; }
      else if (cat==='wardrobe'){ pos=[maxX - s.depth_cm/2 - 12, cy]; rot=90; }
      else { pos=[cx,cy]; }
      if (variant) pos = [ (minX+maxX) - pos[0], pos[1] ];
      items.push({
        item_id: floorId+'_'+room.id+'_'+cat+'_'+idx,
        floor_id: floorId,
        room_id: room.id, category: cat, sku_id: s.sku_id,
        position_cm: pos, rotation_deg: rot,
        size_cm: [s.width_cm, s.depth_cm, s.height_cm], color: s.color, name: s.name, img: s.img,
      });
    });
    return items;
  }

  function generateLayouts(floorplan, profile){
    const style = profile.style || 'modern';
    const budget = profile.budget_tier || 'comfort';
    const plans = [0,1].map(variant=>{
      let items=[];
      floorplan.floors.forEach(f=>{
        f.rooms.forEach(r=> items = items.concat(placeRoom(r, style, budget, variant, f.id)));
      });
      const total = items.reduce((s,it)=>{
        const sk = CATALOG.find(c=>c.sku_id===it.sku_id); return s + (sk?sk.price:0);
      },0);
      return {
        plan_id: 'plan_'+(variant?'b':'a'),
        style, budget_tier: budget,
        label: variant? '方案 B · 镜像布局' : '方案 A · 推荐布局',
        highlights: variant? ['沙发镜像','动线更顺','光照均衡'] : ['经典对称','电视墙居中','收纳充足'],
        furniture_total: total,
        items,
      };
    });
    return plans;
  }

  /* ------------------------------------------------------------------
   * 6. 报价引擎（支持多楼层）
   * ---------------------------------------------------------------- */
  function roomPerimeter(room){
    const p=room.polygon_cm; let per=0;
    for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];
      per+=Math.hypot(b[0]-a[0],b[1]-a[1]);}
    return per/100;
  }
  function generateQuotation(floorplan, plan, laborRate){
    const lines = [];
    plan.items.forEach(it=>{
      const sk = CATALOG.find(c=>c.sku_id===it.sku_id); if(!sk) return;
      const floor = floorplan.floors.find(f=>f.id===it.floor_id);
      const room = floor && floor.rooms.find(r=>r.id===it.room_id);
      lines.push({type:'furniture', name:sk.name, room: (room?room.name:'')+(floorplan.floors.length>1?' ('+(floor?floor.name:'')+')':''),
        qty:1, unit:'件', unit_price:sk.price, subtotal:sk.price});
    });
    floorplan.floors.forEach(f=>{
      f.rooms.forEach(r=>{
        if(['living_room','bedroom'].includes(r.type)){
          const qty=+(r.area_m2*1.08).toFixed(1);
          lines.push({type:'material', name:'强化木地板', room:r.name+(floorplan.floors.length>1?' ('+f.name+')':''), qty, unit:'m²', unit_price:180, subtotal:Math.round(qty*180)});
        }
      });
      let paint=0;
      f.rooms.forEach(r=>{ if(!['bathroom','kitchen','stairs'].includes(r.type)) paint+=roomPerimeter(r)*(f.height_cm/100);});
      paint=+(paint*1.1).toFixed(1);
      if(paint>0) lines.push({type:'material', name:'乳胶漆', room:'全屋'+(floorplan.floors.length>1?' ('+f.name+')':''), qty:paint, unit:'m²', unit_price:35, subtotal:Math.round(paint*35)});
      f.rooms.forEach(r=>{ if(['bathroom','kitchen'].includes(r.type)){
        const qty=+(r.area_m2*1.1).toFixed(1);
        lines.push({type:'material', name:'地砖', room:r.name+(floorplan.floors.length>1?' ('+f.name+')':''), qty, unit:'m²', unit_price:120, subtotal:Math.round(qty*120)});
      }});
    });
    const furniture_total = sum(lines.filter(l=>l.type==='furniture'));
    const material_total  = sum(lines.filter(l=>l.type==='material'));
    const labor_cost = Math.round((furniture_total+material_total)*laborRate);
    const grand_total = furniture_total+material_total+labor_cost;
    const total_area = +floorplan.floors.reduce((s,f)=>s+f.rooms.reduce((ss,r)=>ss+r.area_m2,0),0).toFixed(1);
    return { line_items:lines, summary:{
      furniture_total, material_total, labor_rate:laborRate, labor_cost, grand_total,
      total_area_m2: total_area, cost_per_m2: Math.round(grand_total/total_area)
    }, disclaimer:'演示报价，仅供参考，误差可能超过 ±15%' };
  }
  function sum(arr){return arr.reduce((s,l)=>s+l.subtotal,0);}

  /* ------------------------------------------------------------------
   * 7. 室内场景图：每个房间类型对应一张真实参考图
   * ---------------------------------------------------------------- */
  const ROOM_SCENES = {
    living_room: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1280&q=85',
    bedroom:     'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1280&q=85',
    kitchen:     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1280&q=85',
    bathroom:    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1280&q=85',
  };

  global.AIHome = {
    APT_3BR, VILLA_2F, CATALOG, STYLES, STYLE_LABEL, BUDGET_LABEL, ROOM_SCENES, EDIT_CATEGORIES,
    catalogByCategory, recommend, generateLayouts, generateQuotation, deriveWalls,
  };
})(window);
