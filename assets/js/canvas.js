/* =====================================================================
 * canvas.js — 2D 户型 Canvas 渲染器（CAD 风格）
 * 含：墙、门（单开/双开/推拉，带弧线开向）、窗（双线/飘窗/落地窗）、家具、拖拽命中
 * ===================================================================== */
(function(global){
'use strict';

function drawFloor(canvas, floor, opts){
  opts = opts || {};
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // 计算包围盒 + 缩放
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  floor.rooms.forEach(r=>r.polygon_cm.forEach(([x,y])=>{
    if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
  }));
  const pad = opts.pad || 40;
  const sw = maxX-minX, sh = maxY-minY;
  const scale = Math.min((W-pad*2)/sw, (H-pad*2)/sh);
  const ox = (W-sw*scale)/2 - minX*scale;
  const oy = (H-sh*scale)/2 - minY*scale;
  const T = (x,y)=>[x*scale+ox, y*scale+oy];

  // === 背景：CAD 网格（浅色） ===
  if (opts.grid !== false){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = '#eef0f3'; ctx.lineWidth = 1;
    const gridStep = 26;
    for (let gx=ox%gridStep; gx<W; gx+=gridStep){ ctx.beginPath(); ctx.moveTo(gx+.5,0); ctx.lineTo(gx+.5,H); ctx.stroke(); }
    for (let gy=oy%gridStep; gy<H; gy+=gridStep){ ctx.beginPath(); ctx.moveTo(0,gy+.5); ctx.lineTo(W,gy+.5); ctx.stroke(); }
    // 主网格（每 5 格）
    ctx.strokeStyle = '#d4dae3';
    for (let gx=ox%gridStep; gx<W; gx+=gridStep*5){ ctx.beginPath(); ctx.moveTo(gx+.5,0); ctx.lineTo(gx+.5,H); ctx.stroke(); }
    for (let gy=oy%gridStep; gy<H; gy+=gridStep*5){ ctx.beginPath(); ctx.moveTo(0,gy+.5); ctx.lineTo(W,gy+.5); ctx.stroke(); }
  }

  // === 房间填充 ===
  floor.rooms.forEach(r=>{
    ctx.beginPath();
    r.polygon_cm.forEach((p,i)=>{ const [x,y]=T(p[0],p[1]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.closePath();
    ctx.fillStyle = r.color || '#f5efe3';
    ctx.fill();
  });

  // === 墙（粗黑线，CAD 规范） ===
  const wallTh = Math.max(3, 22*scale);
  ctx.strokeStyle = '#1a2233'; ctx.lineWidth = wallTh; ctx.lineJoin = 'round'; ctx.lineCap='round';
  floor.rooms.forEach(r=>{
    ctx.beginPath();
    r.polygon_cm.forEach((p,i)=>{ const [x,y]=T(p[0],p[1]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.closePath(); ctx.stroke();
  });

  // === 门窗（在墙上「挖洞」+ 绘制符号） ===
  if (floor.openings){
    floor.openings.forEach(op=>{
      drawOpening(ctx, op, T, scale, wallTh);
    });
  }

  // === 家具 ===
  if (opts.items){
    opts.items.forEach(it=>{
      drawItem(ctx, it, T, scale, opts.highlightId===it.item_id);
    });
  }

  // === 房间名 + 面积 ===
  if (opts.labels !== false){
    floor.rooms.forEach(r=>{
      const cxs = r.polygon_cm.reduce((s,p)=>s+p[0],0)/r.polygon_cm.length;
      const cys = r.polygon_cm.reduce((s,p)=>s+p[1],0)/r.polygon_cm.length;
      const [x,y] = T(cxs,cys);
      ctx.fillStyle = '#1a2233'; ctx.textAlign = 'center';
      ctx.font = `600 ${Math.max(10, 13*Math.min(scale*7,1.1))}px var(--sans, sans-serif)`;
      ctx.fillText(r.name, x, y-4);
      ctx.font = `${Math.max(9, 11*Math.min(scale*7,1.1))}px var(--mono, monospace)`;
      ctx.fillStyle = '#5a6678';
      ctx.fillText(r.area_m2+'m²', x, y+13);
    });
  }

  // === 尺寸标注（外侧）===
  if (opts.dimensions !== false){
    drawDimensions(ctx, floor, T, scale, minX, minY, maxX, maxY);
  }

  return { T, scale, ox, oy };
}

// 门窗符号绘制（CAD 规范）
function drawOpening(ctx, op, T, scale, wallTh){
  const [cx, cy] = op.pos;
  const w = op.width_cm * scale;
  const isH = op.dir === 'h';  // h: 水平墙（开口沿 x 方向）
  const [px, py] = T(cx, cy);

  // 1) 先「擦除」墙体留口（用白色覆盖一段）
  ctx.save();
  ctx.fillStyle = '#ffffff';
  if (isH){
    ctx.fillRect(px - w/2, py - wallTh/2 - 1, w, wallTh + 2);
  } else {
    ctx.fillRect(px - wallTh/2 - 1, py - w/2, wallTh + 2, w);
  }
  ctx.restore();

  // 2) 绘制门/窗符号
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#1a2233';

  if (op.type === 'window' || op.type === 'window_french'){
    // 窗：CAD 双线
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.6;
    if (isH){
      const y1 = py - wallTh/2 + 1, y2 = py + wallTh/2 - 1;
      ctx.beginPath(); ctx.moveTo(px-w/2, y1); ctx.lineTo(px+w/2, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px-w/2, y2); ctx.lineTo(px+w/2, y2); ctx.stroke();
      // 中间细线
      ctx.lineWidth = 0.8; ctx.strokeStyle = '#5a6678';
      ctx.beginPath(); ctx.moveTo(px-w/2, py); ctx.lineTo(px+w/2, py); ctx.stroke();
      // 两端封边
      ctx.lineWidth = 1.6; ctx.strokeStyle = '#1a2233';
      ctx.beginPath(); ctx.moveTo(px-w/2, y1); ctx.lineTo(px-w/2, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px+w/2, y1); ctx.lineTo(px+w/2, y2); ctx.stroke();
    } else {
      const x1 = px - wallTh/2 + 1, x2 = px + wallTh/2 - 1;
      ctx.beginPath(); ctx.moveTo(x1, py-w/2); ctx.lineTo(x1, py+w/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, py-w/2); ctx.lineTo(x2, py+w/2); ctx.stroke();
      ctx.lineWidth = 0.8; ctx.strokeStyle = '#5a6678';
      ctx.beginPath(); ctx.moveTo(px, py-w/2); ctx.lineTo(px, py+w/2); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = '#1a2233';
      ctx.beginPath(); ctx.moveTo(x1, py-w/2); ctx.lineTo(x2, py-w/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, py+w/2); ctx.lineTo(x2, py+w/2); ctx.stroke();
    }
  } else if (op.type === 'window_bay'){
    // 飘窗：外突的矩形 + 双线
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.6;
    const bay = wallTh * 1.5;
    if (isH){
      const y1 = py - wallTh/2, y2 = py + wallTh/2;
      // 假设外突向下（这里简化）
      ctx.beginPath();
      ctx.moveTo(px-w/2, y1);
      ctx.lineTo(px-w/2, y1-bay);
      ctx.lineTo(px+w/2, y1-bay);
      ctx.lineTo(px+w/2, y1);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px-w/2, y1); ctx.lineTo(px+w/2, y1); ctx.stroke();
    } else {
      const x1 = px - wallTh/2;
      const bay2 = wallTh * 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, py-w/2);
      ctx.lineTo(x1-bay2, py-w/2);
      ctx.lineTo(x1-bay2, py+w/2);
      ctx.lineTo(x1, py+w/2);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, py-w/2); ctx.lineTo(x1, py+w/2); ctx.stroke();
    }
  } else if (op.type === 'door_swing'){
    // 单开门：直线 + 90° 弧
    ctx.strokeStyle = '#1a2233';
    ctx.lineWidth = 1.4;
    let hx, hy, dx, dy, ang0;
    if (isH){
      // 沿 x 方向开口，门轴在左或右
      const leftHinge = op.swing && op.swing.includes('left');
      hx = leftHinge ? px - w/2 : px + w/2;
      hy = py;
      // 门板线（从轴向开口方向）
      const dir = op.swing && op.swing.includes('down') ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + w*dir); ctx.stroke();
      ang0 = leftHinge ? (dir>0? 0 : -Math.PI/2) : (dir>0? Math.PI : Math.PI/2);
      ctx.beginPath();
      ctx.arc(hx, hy, w, leftHinge?(dir>0?0:-Math.PI/2):(dir>0?Math.PI/2:Math.PI),
                       leftHinge?(dir>0?Math.PI/2:0):(dir>0?Math.PI:Math.PI*1.5));
      ctx.stroke();
    } else {
      // 沿 y 方向开口
      const topHinge = op.swing && op.swing.includes('up');
      hx = px;
      hy = topHinge ? py - w/2 : py + w/2;
      const dir = op.swing && op.swing.includes('right') ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + w*dir, hy); ctx.stroke();
      ctx.beginPath();
      if (topHinge && dir>0)        ctx.arc(hx, hy, w, 0, Math.PI/2);
      else if (topHinge && dir<0)   ctx.arc(hx, hy, w, Math.PI/2, Math.PI);
      else if (!topHinge && dir>0)  ctx.arc(hx, hy, w, -Math.PI/2, 0);
      else                          ctx.arc(hx, hy, w, Math.PI, Math.PI*1.5);
      ctx.stroke();
    }
  } else if (op.type === 'door_double'){
    // 双开门：两扇对开
    ctx.strokeStyle = '#1a2233';
    ctx.lineWidth = 1.4;
    const halfW = w/2;
    if (isH){
      const dir = op.swing && op.swing.includes('up') ? -1 : 1;
      // 左扇
      ctx.beginPath(); ctx.moveTo(px-w/2, py); ctx.lineTo(px-w/2, py + halfW*dir); ctx.stroke();
      ctx.beginPath();
      ctx.arc(px-w/2, py, halfW, dir>0?0:-Math.PI/2, dir>0?Math.PI/2:0);
      ctx.stroke();
      // 右扇
      ctx.beginPath(); ctx.moveTo(px+w/2, py); ctx.lineTo(px+w/2, py + halfW*dir); ctx.stroke();
      ctx.beginPath();
      ctx.arc(px+w/2, py, halfW, dir>0?Math.PI/2:Math.PI, dir>0?Math.PI:Math.PI*1.5);
      ctx.stroke();
    } else {
      const dir = 1;
      ctx.beginPath(); ctx.moveTo(px, py-w/2); ctx.lineTo(px + halfW*dir, py-w/2); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py-w/2, halfW, -Math.PI/2, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py+w/2); ctx.lineTo(px + halfW*dir, py+w/2); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py+w/2, halfW, 0, Math.PI/2); ctx.stroke();
    }
  } else if (op.type === 'door_slide'){
    // 推拉门：两条平行虚线 + 实线
    ctx.strokeStyle = '#1a2233';
    ctx.lineWidth = 1.5;
    if (isH){
      ctx.beginPath(); ctx.moveTo(px-w/2, py-2); ctx.lineTo(px+w/2, py-2); ctx.stroke();
      ctx.setLineDash([4,3]); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px-w/2, py+2); ctx.lineTo(px+w/2, py+2); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.beginPath(); ctx.moveTo(px-2, py-w/2); ctx.lineTo(px-2, py+w/2); ctx.stroke();
      ctx.setLineDash([4,3]); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px+2, py-w/2); ctx.lineTo(px+2, py+w/2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

// 家具绘制
function drawItem(ctx, it, T, scale, highlight){
  const [cx,cy] = it.position_cm;
  const [w,d] = it.size_cm;
  const [sx,sy] = T(cx, cy);
  const ww = w*scale, dd = d*scale;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((it.rotation_deg||0) * Math.PI/180);
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,.05)';
  roundRect(ctx, -ww/2+2, -dd/2+2, ww, dd, Math.min(8, ww/8));
  ctx.fill();
  // 主体
  ctx.fillStyle = it.color || '#9aa7b0';
  roundRect(ctx, -ww/2, -dd/2, ww, dd, Math.min(8, ww/8));
  ctx.fill();
  ctx.strokeStyle = highlight ? '#2563eb' : 'rgba(0,0,0,.25)';
  ctx.lineWidth = highlight ? 2.5 : 1;
  ctx.stroke();
  // 类别图标提示
  if (ww > 30){
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = `${Math.min(11, ww/4)}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    const iconMap = { sofa:'沙', bed:'床', dining_table:'桌', chair:'椅', wardrobe:'柜',
      tv_board:'TV', coffee_table:'几', desk:'桌', nightstand:'柜', sideboard:'柜',
      lamp:'灯', pendant:'灯', rug:'毯' };
    ctx.fillText(iconMap[it.category] || '·', 0, 0);
  }
  ctx.restore();
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

// 外轮廓尺寸标注
function drawDimensions(ctx, floor, T, scale, minX, minY, maxX, maxY){
  ctx.save();
  ctx.strokeStyle = '#5a6678';
  ctx.fillStyle = '#5a6678';
  ctx.lineWidth = 0.8;
  ctx.font = '10px var(--mono, monospace)';
  ctx.textAlign = 'center';

  const off = 18;
  // 顶部总宽
  const [x1, y1] = T(minX, minY);
  const [x2, y2] = T(maxX, minY);
  const ty = y1 - off;
  ctx.beginPath();
  ctx.moveTo(x1, ty); ctx.lineTo(x2, ty);
  // 端点小竖线
  ctx.moveTo(x1, ty-4); ctx.lineTo(x1, ty+4);
  ctx.moveTo(x2, ty-4); ctx.lineTo(x2, ty+4);
  ctx.stroke();
  ctx.fillText(((maxX-minX)*10).toFixed(0), (x1+x2)/2, ty-4);

  // 左侧总高
  const [lx1, ly1] = T(minX, minY);
  const [lx2, ly2] = T(minX, maxY);
  const tx = lx1 - off;
  ctx.beginPath();
  ctx.moveTo(tx, ly1); ctx.lineTo(tx, ly2);
  ctx.moveTo(tx-4, ly1); ctx.lineTo(tx+4, ly1);
  ctx.moveTo(tx-4, ly2); ctx.lineTo(tx+4, ly2);
  ctx.stroke();
  ctx.save();
  ctx.translate(tx-4, (ly1+ly2)/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillText(((maxY-minY)*10).toFixed(0), 0, 0);
  ctx.restore();

  ctx.restore();
}

// 命中检测：返回 (item, dx, dy)，dx/dy 是点击位置与家具中心的偏移（用于拖拽）
function hitItem(items, px, py, mapInfo){
  if (!items || !mapInfo) return null;
  const { T, scale } = mapInfo;
  let hit = null, hitDx = 0, hitDy = 0;
  items.forEach(it=>{
    const [sx, sy] = T(it.position_cm[0], it.position_cm[1]);
    const hw = it.size_cm[0]*scale/2 + 4;
    const hh = it.size_cm[1]*scale/2 + 4;
    if (Math.abs(px-sx)<hw && Math.abs(py-sy)<hh){
      hit = it; hitDx = px - sx; hitDy = py - sy;
    }
  });
  return hit ? { item: hit, dx: hitDx, dy: hitDy } : null;
}

// 反向转换：屏幕坐标 → cm
function screenToCm(px, py, mapInfo){
  const { scale, ox, oy } = mapInfo;
  return [(px - ox)/scale, (py - oy)/scale];
}

global.AICanvas = { drawFloor, hitItem, screenToCm, roundRect };
})(window);
