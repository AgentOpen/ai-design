/* =====================================================================
 * scene3d.js — Three.js 3D 场景（含门窗洞、多楼层）
 * 暴露：window.AIScene3D.createScene(mountEl, floors, items, opts)
 * ===================================================================== */
(function(global){
'use strict';

function createScene(mount, floors, items, opts){
  opts = opts || {};
  if (!global.THREE){ return { dispose:()=>{} }; }
  const THREE = global.THREE;

  const W = mount.clientWidth, H = mount.clientHeight;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfafbfc);
  scene.fog = new THREE.Fog(0xfafbfc, 1500, 4000);

  const camera = new THREE.PerspectiveCamera(50, W/H, 1, 10000);
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled = true;
  mount.innerHTML = ''; mount.appendChild(renderer.domElement);

  // 灯光
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xfff2e5, 0.85);
  dir.position.set(600, 1200, 400); dir.castShadow = true;
  dir.shadow.mapSize.set(1024,1024);
  dir.shadow.camera.left=-1200; dir.shadow.camera.right=1200;
  dir.shadow.camera.top=1200; dir.shadow.camera.bottom=-1200;
  scene.add(dir);
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0xe5e5e5, 0.5));

  // 计算总包围盒
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  floors.forEach(f=>f.rooms.forEach(r=>r.polygon_cm.forEach(([x,y])=>{
    if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
  })));
  const cx=(minX+maxX)/2, cz=(minY+maxY)/2;
  const span = Math.max(maxX-minX, maxY-minY);
  const toV = (x,z)=> new THREE.Vector3(x-cx, 0, z-cz);

  const root = new THREE.Group();

  // 累计楼层高度
  let floorBase = 0;
  floors.forEach((floor, fi)=>{
    const h = floor.height_cm || 280;
    const group = new THREE.Group();
    group.position.y = floorBase;

    // ===== 地板 =====
    floor.rooms.forEach(r=>{
      const shape = new THREE.Shape();
      r.polygon_cm.forEach((p,i)=>{ const v = toV(p[0],p[1]); i?shape.lineTo(v.x,v.z):shape.moveTo(v.x,v.z); });
      const geo = new THREE.ShapeGeometry(shape);
      const isWet = ['bathroom','kitchen'].includes(r.type);
      const isStairs = r.type==='stairs';
      const mat = new THREE.MeshStandardMaterial({
        color: isWet? 0xe0d8c8 : isStairs? 0xc9b896 : 0xd6c2a3,
        roughness:.9, side:THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI/2; mesh.position.y = 0.5;
      mesh.receiveShadow = true; group.add(mesh);
    });

    // ===== 墙（每条边一段，带门窗洞）=====
    const wallMat = new THREE.MeshStandardMaterial({ color:0xf5f4f0, roughness:.95 });
    const drawn = new Set();
    floor.rooms.forEach(r=>{
      const p = r.polygon_cm;
      for (let i=0; i<p.length; i++){
        const a = p[i], b = p[(i+1)%p.length];
        const key = [a.join(','),b.join(',')].sort().join('|');
        if (drawn.has(key)) continue; drawn.add(key);
        buildWallWithOpenings(group, a, b, h, floor.openings || [], wallMat, toV);
      }
    });

    // ===== 当前楼层的家具 =====
    if (items){
      items.filter(it=>it.floor_id === floor.id).forEach(it=>{
        const [w,d,hh] = it.size_cm;
        const geo = new THREE.BoxGeometry(w, hh, d);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(it.color||'#9aa7b0'), roughness:.7 });
        const m = new THREE.Mesh(geo, mat);
        const v = toV(it.position_cm[0], it.position_cm[1]);
        m.position.set(v.x, hh/2 + 0.5, v.z);
        m.rotation.y = -(it.rotation_deg||0) * Math.PI/180;
        m.castShadow = true; m.receiveShadow = true; group.add(m);
      });
    }

    root.add(group);
    floorBase += h + 30; // 楼层间隔
  });

  scene.add(root);

  // 相机
  let theta = -Math.PI/4, phi = 0.95, radius = span * 1.7;
  function updateCam(){
    camera.position.set(
      radius*Math.sin(phi)*Math.cos(theta),
      radius*Math.cos(phi) + (floors.length>1 ? floorBase/3 : 0),
      radius*Math.sin(phi)*Math.sin(theta)
    );
    camera.lookAt(0, floorBase/4, 0);
  }
  updateCam();

  // 交互
  let dragging=false, lx=0, ly=0, auto=true;
  const dom = renderer.domElement;
  const onDown = e=>{ dragging=true; lx=e.clientX; ly=e.clientY; auto=false; };
  const onUp = ()=> dragging=false;
  const onMove = e=>{
    if(!dragging) return;
    theta += (e.clientX-lx)*0.008;
    phi = Math.max(0.25, Math.min(1.4, phi + (e.clientY-ly)*0.006));
    lx=e.clientX; ly=e.clientY; updateCam();
  };
  const onWheel = e=>{
    e.preventDefault();
    radius = Math.max(span*0.7, Math.min(span*4, radius + e.deltaY*0.8));
    updateCam();
  };
  dom.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('mousemove', onMove);
  dom.addEventListener('wheel', onWheel, { passive:false });

  let raf;
  const loop = ()=>{
    raf = requestAnimationFrame(loop);
    if (auto && !dragging){ theta += 0.0015; updateCam(); }
    renderer.render(scene, camera);
  };
  loop();

  const onResize = ()=>{
    const w2=mount.clientWidth, h2=mount.clientHeight;
    camera.aspect = w2/h2; camera.updateProjectionMatrix(); renderer.setSize(w2,h2);
  };
  window.addEventListener('resize', onResize);

  return {
    dispose(){
      cancelAnimationFrame(raf);
      dom.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    }
  };
}

// 构造一段带门窗洞的墙
function buildWallWithOpenings(group, a, b, totalH, openings, wallMat, toV){
  const THREE = global.THREE;
  const va = toV(a[0], a[1]); const vb = toV(b[0], b[1]);
  const len = va.distanceTo(vb);
  if (len < 1) return;
  // 沿墙找该墙段上的门窗
  const segOps = openings.filter(op=>isOnSegment(op.pos, a, b));
  // 按沿墙距离排序
  segOps.sort((p,q)=>distAlong(p.pos, a, b) - distAlong(q.pos, a, b));
  // 把墙分成多段（被门窗切开）
  let cursor = 0;
  const segments = [];  // {start, end, type, height}
  segOps.forEach(op=>{
    const d = distAlong(op.pos, a, b);
    const w = op.width_cm;
    const s = d - w/2, e = d + w/2;
    if (s > cursor) segments.push({ start: cursor, end: s, type:'solid', height: totalH });
    // 门窗位置上的处理
    if (op.type.startsWith('window')){
      // 下方矮墙 + 上方过梁
      segments.push({ start: s, end: e, type:'window', height: totalH, sill: 90, lintel: totalH - 220 - 90 });
    } else if (op.type === 'door_swing' || op.type === 'door_double'){
      segments.push({ start: s, end: e, type:'door', height: totalH, doorH: 210 });
    } else if (op.type === 'door_slide'){
      segments.push({ start: s, end: e, type:'door', height: totalH, doorH: 230 });
    }
    cursor = e;
  });
  if (cursor < len) segments.push({ start: cursor, end: len, type:'solid', height: totalH });

  // 沿 a→b 方向单位向量与朝向
  const dirV = new THREE.Vector3().subVectors(vb, va).normalize();
  const yaw = -Math.atan2(vb.z - va.z, vb.x - va.x);

  segments.forEach(seg=>{
    const segLen = seg.end - seg.start;
    if (segLen < 1) return;
    const midDist = (seg.start + seg.end)/2;
    const midPos = new THREE.Vector3().addVectors(va, dirV.clone().multiplyScalar(midDist));

    if (seg.type === 'solid'){
      const wall = new THREE.Mesh(new THREE.BoxGeometry(segLen, totalH, 24), wallMat);
      wall.position.set(midPos.x, totalH/2, midPos.z);
      wall.rotation.y = yaw;
      wall.castShadow = true; wall.receiveShadow = true;
      group.add(wall);
    } else if (seg.type === 'window'){
      // 下方矮墙
      const sill = seg.sill || 90;
      const lintel = seg.lintel || 70;
      const m1 = new THREE.Mesh(new THREE.BoxGeometry(segLen, sill, 24), wallMat);
      m1.position.set(midPos.x, sill/2, midPos.z); m1.rotation.y = yaw;
      m1.castShadow = m1.receiveShadow = true; group.add(m1);
      // 上方过梁
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(segLen, lintel, 24), wallMat);
      m2.position.set(midPos.x, totalH - lintel/2, midPos.z); m2.rotation.y = yaw;
      group.add(m2);
      // 玻璃
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88bbdd, transparent:true, opacity:0.35, roughness:.1, metalness:.1
      });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(segLen-6, totalH-sill-lintel, 4), glassMat);
      glass.position.set(midPos.x, sill + (totalH-sill-lintel)/2, midPos.z); glass.rotation.y = yaw;
      group.add(glass);
      // 窗框
      const frameMat = new THREE.MeshStandardMaterial({ color:0x445566, roughness:.5 });
      [
        [segLen, 4, 4, 0, sill+2, 0],
        [segLen, 4, 4, 0, totalH-lintel-2, 0],
        [4, totalH-sill-lintel, 4, -segLen/2+2, sill + (totalH-sill-lintel)/2, 0],
        [4, totalH-sill-lintel, 4, segLen/2-2, sill + (totalH-sill-lintel)/2, 0],
      ].forEach(([fw,fh,fd,fx,fy,fz])=>{
        const f = new THREE.Mesh(new THREE.BoxGeometry(fw,fh,fd), frameMat);
        f.position.set(midPos.x + Math.cos(yaw)*fx, fy, midPos.z - Math.sin(yaw)*fx);
        f.rotation.y = yaw;
        group.add(f);
      });
    } else if (seg.type === 'door'){
      const doorH = seg.doorH || 210;
      const lintelH = totalH - doorH;
      // 仅过梁
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(segLen, lintelH, 24), wallMat);
      m2.position.set(midPos.x, totalH - lintelH/2, midPos.z); m2.rotation.y = yaw;
      group.add(m2);
      // 门板（视觉示意，开向不在 3D 体现）
      const doorMat = new THREE.MeshStandardMaterial({ color:0x8b6f47, roughness:.7 });
      const door = new THREE.Mesh(new THREE.BoxGeometry(segLen-6, doorH-2, 6), doorMat);
      door.position.set(midPos.x, doorH/2, midPos.z); door.rotation.y = yaw;
      group.add(door);
    }
  });
}

// 点 p 是否落在线段 ab 上（带容差）
function isOnSegment(p, a, b){
  const tol = 30;
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const len2 = dx*dx + dy*dy;
  if (len2 < 1) return false;
  const t = ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / len2;
  if (t < -0.02 || t > 1.02) return false;
  const px = a[0] + dx*t, py = a[1] + dy*t;
  return Math.hypot(p[0]-px, p[1]-py) < tol;
}
function distAlong(p, a, b){
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return 0;
  return ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / len;
}

global.AIScene3D = { createScene };
})(window);
