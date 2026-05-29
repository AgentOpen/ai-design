/* =====================================================================
 * app.js — AI 全屋装修设计平台（React 18 + Three.js, 纯前端 Mock）
 * 架构对应 PRD §7 路由 / §14 八步流程
 * ===================================================================== */
const { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } = React;
const AH = window.AIHome;

/* ====================== 全局 Store ====================== */
const Store = createContext(null);

function useProvideStore() {
  const [project, setProject] = useState(() => ({
    name: '我的家 · 演示项目',
    current_step: 0,
    floor_plan: null,            // Step1 确认后填充
    scale: null,
    requirement: {               // Step0
      budget_tier: 'comfort', budget_total: 200000,
      occupants: { count: 3, elderly: false, children: true, pets: false },
      style: 'modern', functions: ['storage'], confirmed: false,
    },
    plans: [],                   // Step3 多方案
    selected_plan_id: null,
    layout: null,                // Step4 当前编辑布局
    renders: [],                 // Step5
    panoramas: [],               // Step5.5
    quotation: null,             // Step7
    stale: {},                   // {layout,renders,panoramas,quotation}
    share_token: null,
    comments: [],
  }));

  const update = useCallback((patch) => {
    setProject(p => typeof patch === 'function' ? { ...p, ...patch(p) } : { ...p, ...patch });
  }, []);

  // stale 传播（PRD §2.2 / §14.2）
  const markStale = useCallback((keys) => {
    setProject(p => ({ ...p, stale: { ...p.stale, ...Object.fromEntries(keys.map(k => [k, true])) } }));
  }, []);
  const clearStale = useCallback((key) => {
    setProject(p => { const s = { ...p.stale }; delete s[key]; return { ...p, stale: s }; });
  }, []);

  const [toast, setToast] = useState(null);
  const notify = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(null), 2200);
  }, []);

  return { project, setProject, update, markStale, clearStale, toast, notify };
}

/* ====================== 路由（hash） ====================== */
const STEPS = [
  { key: 'home', n: '·', label: '首页', hidden: true },
  { key: 'step0', n: 0, label: '需求' },
  { key: 'step1', n: 1, label: '户型' },
  { key: 'step2', n: 2, label: '3D 墙体' },
  { key: 'step3', n: 3, label: 'AI 布局' },
  { key: 'step4', n: 4, label: '编辑' },
  { key: 'step5', n: 5, label: '效果图' },
  { key: 'step55', n: '5.5', label: '全景' },
  { key: 'step6', n: 6, label: '换品' },
  { key: 'step7', n: 7, label: '报价' },
];

function useRoute() {
  const [route, setRoute] = useState(() => (location.hash.replace('#/', '') || 'home'));
  useEffect(() => {
    const fn = () => setRoute(location.hash.replace('#/', '') || 'home');
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  const go = useCallback((k) => { location.hash = '/' + k; }, []);
  return { route, go };
}

/* ====================== 2D 户型渲染（Canvas） ====================== */
// 将 cm 坐标绘制到 canvas；可选叠加家具
function drawFloorPlan(canvas, fp, opts = {}) {
  if (!canvas || !fp) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // 计算包围盒
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  fp.rooms.forEach(r => r.polygon_cm.forEach(([x, y]) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }));
  const pad = opts.pad ?? 40;
  const sw = (maxX - minX), sh = (maxY - minY);
  const scale = Math.min((W - pad * 2) / sw, (H - pad * 2) / sh);
  const ox = (W - sw * scale) / 2 - minX * scale;
  const oy = (H - sh * scale) / 2 - minY * scale;
  const T = (x, y) => [x * scale + ox, y * scale + oy];

  // 背景网格（纸色）
  if (opts.grid !== false) {
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e7e1d4'; ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 26) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 26) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
  }

  // 房间填充
  fp.rooms.forEach(r => {
    ctx.beginPath();
    r.polygon_cm.forEach((p, i) => { const [x, y] = T(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.fillStyle = r.color || '#efe7d8'; ctx.fill();
  });

  // 墙（粗线）
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = Math.max(3, 18 * scale); ctx.lineJoin = 'round';
  fp.rooms.forEach(r => {
    ctx.beginPath();
    r.polygon_cm.forEach((p, i) => { const [x, y] = T(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.stroke();
  });

  // 家具
  if (opts.items) {
    opts.items.forEach(it => {
      const [cx, cy] = it.position_cm;
      const [w, d] = it.size_cm;
      const [sx, sy] = T(cx, cy);
      const ww = w * scale, dd = d * scale;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate((it.rotation_deg || 0) * Math.PI / 180);
      ctx.fillStyle = it.color || '#9aa7b0';
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.2;
      roundRect(ctx, -ww / 2, -dd / 2, ww, dd, Math.min(6, ww / 6));
      ctx.fill(); ctx.stroke();
      if (opts.highlightId === it.item_id) {
        ctx.strokeStyle = '#3d7eff'; ctx.lineWidth = 2.5; ctx.stroke();
      }
      ctx.restore();
    });
  }

  // 房间名 + 面积
  if (opts.labels !== false) {
    fp.rooms.forEach(r => {
      const cx = r.polygon_cm.reduce((s, p) => s + p[0], 0) / r.polygon_cm.length;
      const cy = r.polygon_cm.reduce((s, p) => s + p[1], 0) / r.polygon_cm.length;
      const [x, y] = T(cx, cy);
      ctx.fillStyle = '#4a4a4a'; ctx.textAlign = 'center';
      ctx.font = `600 ${Math.max(9, 12 * Math.min(scale * 6, 1.1))}px var(--sans, sans-serif)`;
      ctx.fillText(r.name, x, y - 4);
      ctx.font = `${Math.max(8, 10 * Math.min(scale * 6, 1.1))}px monospace`;
      ctx.fillStyle = '#7a7a7a';
      ctx.fillText(r.area_m2 + '㎡', x, y + 11);
    });
  }
  return { T, scale };
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* 自适应尺寸的 Canvas 组件 */
function PlanCanvas({ fp, items, highlightId, onPick, className, style }) {
  const ref = useRef(null);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState([600, 480]);
  const lastMap = useRef(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims([Math.max(200, width), Math.max(200, height)]);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = dims[0]; c.height = dims[1];
    lastMap.current = drawFloorPlan(c, fp, { items, highlightId });
  }, [fp, items, highlightId, dims]);

  const handleClick = (e) => {
    if (!onPick || !items || !lastMap.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (dims[0] / rect.width);
    const py = (e.clientY - rect.top) * (dims[1] / rect.height);
    const { T } = lastMap.current;
    // 命中检测（粗略 AABB）
    let hit = null;
    items.forEach(it => {
      const [sx, sy] = T(it.position_cm[0], it.position_cm[1]);
      const hw = it.size_cm[0] * lastMap.current.scale / 2 + 6;
      const hh = it.size_cm[1] * lastMap.current.scale / 2 + 6;
      if (Math.abs(px - sx) < hw && Math.abs(py - sy) < hh) hit = it;
    });
    onPick(hit);
  };

  return React.createElement('div', { ref: wrapRef, className, style: { width: '100%', height: '100%', ...style } },
    React.createElement('canvas', {
      ref, onClick: handleClick,
      style: { width: '100%', height: '100%', cursor: onPick ? 'pointer' : 'default', display: 'block' }
    })
  );
}

/* ====================== 3D 场景（Three.js） ====================== */
function Scene3D({ fp, items, mode }) {  // mode: 'shell' | 'furnished'
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    if (!fp || !mountRef.current || !window.THREE) return;
    const THREE = window.THREE;
    const mount = mountRef.current;
    const W = mount.clientWidth, H = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f141a);
    scene.fog = new THREE.Fog(0x0f141a, 1200, 3000);

    const camera = new THREE.PerspectiveCamera(50, W / H, 1, 8000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.innerHTML = ''; mount.appendChild(renderer.domElement);

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xfff2dd, 0.9);
    dir.position.set(400, 800, 300); dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -800; dir.shadow.camera.right = 800;
    dir.shadow.camera.top = 800; dir.shadow.camera.bottom = -800;
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x3a3a3a, 0.4));

    // 计算中心
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    fp.rooms.forEach(r => r.polygon_cm.forEach(([x, y]) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }));
    const cx = (minX + maxX) / 2, cz = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY);
    const h = fp.floor_height_cm || 280;

    const group = new THREE.Group();
    // 坐标：x→x, y(cm 向下)→z, 高度→y
    const toV = (x, z) => new THREE.Vector3(x - cx, 0, z - cz);

    // 地面 + 各房间地板
    fp.rooms.forEach(r => {
      const shape = new THREE.Shape();
      r.polygon_cm.forEach((p, i) => { const v = toV(p[0], p[1]); i ? shape.lineTo(v.x, v.z) : shape.moveTo(v.x, v.z); });
      const geo = new THREE.ShapeGeometry(shape);
      const isWet = ['bathroom', 'kitchen'].includes(r.type);
      const mat = new THREE.MeshStandardMaterial({
        color: isWet ? 0xd8d2c8 : 0xc9b596, roughness: .9, side: THREE.DoubleSide
      });
      const floor = new THREE.Mesh(geo, mat);
      floor.rotation.x = -Math.PI / 2; floor.position.y = 0.5;
      floor.receiveShadow = true; group.add(floor);
    });

    // 墙（每条边一段 box）
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: .95 });
    const drawn = new Set();
    fp.rooms.forEach(r => {
      const p = r.polygon_cm;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const key = [a.join(','), b.join(',')].sort().join('|');
        if (drawn.has(key)) continue; drawn.add(key);
        const va = toV(a[0], a[1]), vb = toV(b[0], b[1]);
        const len = va.distanceTo(vb); if (len < 1) continue;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, 20), wallMat);
        const mid = va.clone().add(vb).multiplyScalar(0.5);
        wall.position.set(mid.x, h / 2, mid.z);
        wall.rotation.y = -Math.atan2(vb.z - va.z, vb.x - va.x);
        wall.castShadow = true; wall.receiveShadow = true; group.add(wall);
      }
    });

    // 家具（box 占位）
    if (mode === 'furnished' && items) {
      items.forEach(it => {
        const [w, d, hh] = it.size_cm;
        const geo = new THREE.BoxGeometry(w, hh, d);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(it.color || '#9aa7b0'), roughness: .7 });
        const m = new THREE.Mesh(geo, mat);
        const v = toV(it.position_cm[0], it.position_cm[1]);
        m.position.set(v.x, hh / 2 + 0.5, v.z);
        m.rotation.y = -(it.rotation_deg || 0) * Math.PI / 180;
        m.castShadow = true; m.receiveShadow = true; group.add(m);
      });
    }

    scene.add(group);

    // 相机环绕
    let theta = -Math.PI / 4, phi = 0.95, radius = span * 1.5;
    function updateCam() {
      camera.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(0, h * 0.2, 0);
    }
    updateCam();

    // 交互
    let dragging = false, lx = 0, ly = 0;
    const dom = renderer.domElement;
    const onDown = e => { dragging = true; lx = e.clientX; ly = e.clientY; };
    const onUp = () => dragging = false;
    const onMove = e => {
      if (!dragging) return;
      theta += (e.clientX - lx) * 0.008;
      phi = Math.max(0.25, Math.min(1.4, phi + (e.clientY - ly) * 0.006));
      lx = e.clientX; ly = e.clientY; updateCam();
    };
    const onWheel = e => {
      e.preventDefault();
      radius = Math.max(span * 0.7, Math.min(span * 3, radius + e.deltaY * 0.6));
      updateCam();
    };
    dom.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    dom.addEventListener('wheel', onWheel, { passive: false });

    let raf, auto = true;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (auto && !dragging) { theta += 0.0015; updateCam(); }
      renderer.render(scene, camera);
    };
    loop();
    const stopAuto = () => auto = false;
    dom.addEventListener('mousedown', stopAuto);

    const onResize = () => {
      const w2 = mount.clientWidth, h2 = mount.clientHeight;
      camera.aspect = w2 / h2; camera.updateProjectionMatrix(); renderer.setSize(w2, h2);
    };
    window.addEventListener('resize', onResize);
    stateRef.current = { renderer, scene };

    return () => {
      cancelAnimationFrame(raf);
      dom.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [fp, items, mode]);

  return React.createElement('div', { ref: mountRef, style: { width: '100%', height: '100%' } },
    !window.THREE && React.createElement('div', { className: 'render-stage' },
      React.createElement('div', { className: 'empty' }, '3D 引擎加载中…\n（需联网加载 Three.js，离线时此处不显示）')));
}
function PanoramaViewer({ style, roomName }) {
  const mountRef = useRef(null);
  useEffect(() => {
    if (!mountRef.current || !window.THREE) return;
    const THREE = window.THREE;
    const mount = mountRef.current;
    const W = mount.clientWidth, H = mount.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    mount.innerHTML = ''; mount.appendChild(renderer.domElement);

    // 用程序生成的室内全景纹理（渐变 + 网格地面 + 墙），作为 cubemap 占位
    const sp = AH.STYLES.find(s => s.id === style) || AH.STYLES[0];
    function makeFace(kind) {
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      if (kind === 'floor') { g.fillStyle = sp.floor; g.fillRect(0, 0, 512, 512);
        g.strokeStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i <= 512; i += 42) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } }
      else if (kind === 'ceil') { g.fillStyle = '#f6f4f0'; g.fillRect(0, 0, 512, 512);
        const grd = g.createRadialGradient(256, 256, 20, 256, 256, 220); grd.addColorStop(0, '#fffef8'); grd.addColorStop(1, '#e8e4dc'); g.fillStyle = grd; g.beginPath(); g.arc(256, 256, 60, 0, 7); g.fill(); }
      else { // 墙面
        const grd = g.createLinearGradient(0, 0, 0, 512);
        grd.addColorStop(0, sp.wall); grd.addColorStop(1, shade(sp.wall, -12));
        g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
        // 装饰：踢脚 + 一块装饰色
        g.fillStyle = sp.accent; g.globalAlpha = .25; g.fillRect(40, 180, 180, 150); g.globalAlpha = 1;
        g.fillStyle = shade(sp.floor, -20); g.fillRect(0, 470, 512, 42);
      }
      return new THREE.CanvasTexture(c);
    }
    function shade(hex, amt) {
      const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, gg = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
      r = Math.max(0, Math.min(255, r)); gg = Math.max(0, Math.min(255, gg)); b = Math.max(0, Math.min(255, b));
      return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
    }
    const mats = ['wall', 'wall', 'ceil', 'floor', 'wall', 'wall'].map(k =>
      new THREE.MeshBasicMaterial({ map: makeFace(k), side: THREE.BackSide }));
    const box = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), mats);
    scene.add(box);

    let lon = 0, lat = 0, dragging = false, lx = 0, ly = 0;
    camera.position.set(0, 0, 0.1);
    function update() {
      const phi = THREE.MathUtils.degToRad(90 - lat), theta = THREE.MathUtils.degToRad(lon);
      camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta)
      );
    }
    const dom = renderer.domElement;
    dom.style.cursor = 'grab';
    const onDown = e => { dragging = true; lx = e.clientX; ly = e.clientY; dom.style.cursor = 'grabbing'; };
    const onUp = () => { dragging = false; dom.style.cursor = 'grab'; };
    const onMove = e => { if (!dragging) return; lon -= (e.clientX - lx) * 0.18; lat = Math.max(-75, Math.min(75, lat + (e.clientY - ly) * 0.18)); lx = e.clientX; ly = e.clientY; };
    dom.addEventListener('mousedown', onDown); window.addEventListener('mouseup', onUp); window.addEventListener('mousemove', onMove);

    let raf, auto = true;
    dom.addEventListener('mousedown', () => auto = false);
    const loop = () => { raf = requestAnimationFrame(loop); if (auto) lon += 0.04; update(); renderer.render(scene, camera); };
    loop();
    const onResize = () => { const w = mount.clientWidth, h = mount.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mouseup', onUp); window.removeEventListener('mousemove', onMove); window.removeEventListener('resize', onResize); renderer.dispose(); };
  }, [style]);
  return React.createElement('div', { ref: mountRef, style: { width: '100%', height: '100%' } });
}

/* ====================== 共享 UI：顶栏 / 步骤条 / 框架 ====================== */
function TopBar() {
  const { project, notify, update } = useContext(Store);
  const { go } = useRoute();
  const tools = [['💾', '保存'], ['↩', '撤销'], ['↪', '恢复'], ['◎', '显示'], ['⊹', '工具'], ['🖼', '图册']];
  const share = () => {
    const tok = project.share_token || Math.random().toString(36).slice(2, 9);
    update({ share_token: tok });
    navigator.clipboard?.writeText(location.href.split('#')[0] + '#/share/' + tok).catch(() => { });
    notify('分享链接已生成并复制（演示）：' + tok);
  };
  return React.createElement('div', { className: 'topbar' },
    React.createElement('div', { className: 'brand', onClick: () => go('home'), style: { cursor: 'pointer' } },
      React.createElement('div', { className: 'logo' }, '宅'),
      React.createElement('div', null, 'AI 全屋装修设计', React.createElement('small', { style: { display: 'block' } }, 'AI HOME DESIGN'))
    ),
    React.createElement('div', { className: 'tools' },
      tools.map(([ic, t]) => React.createElement('button', { key: t, className: 'tool-btn' },
        React.createElement('span', { className: 'ic' }, ic), t))
    ),
    React.createElement('div', { className: 'spacer' }),
    React.createElement('div', { className: 'right' },
      React.createElement('button', { className: 'pill', onClick: share }, '👥 协作分享'),
      React.createElement('button', { className: 'btn-ghost', onClick: () => go('home') }, '退出')
    )
  );
}

function StepBar() {
  const { project } = useContext(Store);
  const { route, go } = useRoute();
  const visible = STEPS.filter(s => !s.hidden);
  const idxOf = k => visible.findIndex(s => s.key === k);
  const cur = idxOf(route);
  return React.createElement('div', { className: 'steps' },
    visible.map((s, i) => {
      const done = i < cur, active = i === cur;
      const cls = 'step' + (active ? ' active' : done ? ' done' : '');
      return React.createElement(React.Fragment, { key: s.key },
        React.createElement('div', {
          className: cls, onClick: () => { if (done || active) go(s.key); }
        },
          React.createElement('span', { className: 'n' }, done ? '✓' : s.n),
          s.label),
        i < visible.length - 1 && React.createElement('span', { className: 'sep' }, '›')
      );
    })
  );
}

function StaleBanner() {
  const { project, clearStale } = useContext(Store);
  const keys = Object.keys(project.stale || {});
  if (!keys.length) return null;
  const map = { layout: '布局', renders: '效果图', panoramas: '全景', quotation: '报价' };
  return React.createElement('div', { className: 'stale-banner' },
    '⚠ 上游已修改，以下内容可能过期，请重新生成：' + keys.map(k => map[k] || k).join('、'),
    React.createElement('button', { onClick: () => keys.forEach(clearStale) }, '忽略')
  );
}

// 三栏框架壳
function Workspace({ rail, left, center, right, viewToggle, hint }) {
  const railItems = rail || [['◳', '户型', true], ['◰', '样板间'], ['☁', '云素材'], ['◫', '定制'], ['◈', '3D++'], ['☺', '我的']];
  return React.createElement('div', { className: 'workspace' },
    React.createElement('div', { className: 'rail' },
      railItems.map(([ic, t, on], i) => React.createElement('div', { key: i, className: 'rail-item' + (on ? ' on' : '') },
        React.createElement('span', { className: 'ic' }, ic), t))
    ),
    left && React.createElement('div', { className: 'lpanel' }, left),
    React.createElement('div', { className: 'canvas-wrap' },
      viewToggle, center,
      hint && React.createElement('div', { className: 'canvas-hint' }, hint)
    ),
    right && React.createElement('div', { className: 'rpanel' }, right)
  );
}

// 底部下一步条
function StepFooter({ prev, next, nextLabel, nextDisabled, onNext, onPrev }) {
  const { go } = useRoute();
  return React.createElement('div', {
    style: {
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 56, display: 'flex',
      alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
      background: 'var(--panel)', borderTop: '1px solid var(--line)', zIndex: 8
    }
  },
    React.createElement('button', { className: 'btn-ghost', disabled: !prev, onClick: () => onPrev ? onPrev() : go(prev) }, '← 上一步'),
    React.createElement('button', {
      className: 'btn-primary', disabled: nextDisabled,
      onClick: () => { if (onNext) onNext(); else go(next); }
    }, (nextLabel || '下一步') + ' →')
  );
}

/* ====================== 首页 ====================== */
function HomePage() {
  const { go } = useRoute();
  const { update } = useContext(Store);
  const flow = ['需求问询', '户型上传', '3D 墙体', 'AI 布局', '多方案对比', '手动编辑', '2D 效果图', '720°全景', '效果图换品', '空间报价'];
  const startDemo = () => {
    update({ floor_plan: AH.DEMO_FLOORPLAN, current_step: 0 });
    go('step0');
  };
  return React.createElement('div', { className: 'home fade-in' },
    React.createElement('h1', null, 'AI 全屋装修设计平台'),
    React.createElement('p', null, '从户型图到报价单的 8 步闭环演示：上传户型、标注比例、生成 3D 墙体、AI 自动布局并多方案对比、手动编辑、生成效果图与 720° 全景、效果图换品、按空间智能报价。'),
    React.createElement('div', { className: 'flow' }, flow.map((f, i) => React.createElement('span', { key: i }, (i + 1) + '. ' + f))),
    React.createElement('div', { className: 'cta' },
      React.createElement('button', { className: 'btn-primary', onClick: startDemo }, '▶ 用演示户型开始'),
      React.createElement('button', { className: 'btn-ghost', onClick: startDemo }, '上传我的户型')
    ),
    React.createElement('small', { className: 'note', style: { marginTop: 28, maxWidth: 520 } },
      '※ 本演示为纯前端实现，AI 识别/生图/换品均走 Mock 数据，3D 与全景为实时渲染。后端 API 按需求文档 §6 已定义，可后续对接。')
  );
}

/* ====================== Step0：需求问询 ====================== */
function Step0() {
  const { project, update } = useContext(Store);
  const { go } = useRoute();
  const r = project.requirement;
  const setR = patch => update(p => ({ requirement: { ...p.requirement, ...patch } }));
  const budgets = [['economy', '经济', '8–15 万'], ['comfort', '舒适', '15–25 万'], ['luxury', '豪华', '25 万+']];
  const occ = r.occupants;
  const setOcc = patch => setR({ occupants: { ...occ, ...patch } });
  const funcs = [['study', '书房'], ['guest', '客卧'], ['storage', '储物'], ['tea', '茶室'], ['office', '居家办公']];

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' },
      React.createElement('h2', null, '需求问询'),
      React.createElement('p', null, '告诉我们你的偏好，AI 布局更精准')),
    React.createElement('div', { className: 'pb' },
      React.createElement('small', { className: 'note', style: { marginTop: 0 } }, '画像将注入布局、选品与报价（PRD §15）。可跳过用默认值。'))
  );

  const center = React.createElement('div', {
    style: { position: 'absolute', inset: 0, overflowY: 'auto', padding: '32px 48px 80px' }
  },
    React.createElement('div', { className: 'fade-in', style: { maxWidth: 720, margin: '0 auto' } },
      // 预算
      React.createElement('div', { className: 'group' },
        React.createElement('label', null, '装修预算'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 } },
          budgets.map(([id, nm, range]) => React.createElement('div', {
            key: id, className: 'plan-card' + (r.budget_tier === id ? ' on' : ''),
            onClick: () => setR({ budget_tier: id }), style: { margin: 0 }
          },
            React.createElement('div', { className: 'meta', style: { textAlign: 'center', padding: '18px 12px' } },
              r.budget_tier === id && React.createElement('div', { className: 'check' }, '✓'),
              React.createElement('b', { style: { fontSize: 16 } }, nm),
              React.createElement('div', { className: 'price', style: { marginTop: 6 } }, range))
          ))
        )
      ),
      // 风格图片选择
      React.createElement('div', { className: 'group' },
        React.createElement('label', null, '风格偏好（点图选择）'),
        React.createElement('div', { className: 'style-grid' },
          AH.STYLES.map(s => React.createElement('div', {
            key: s.id, className: 'style-card' + (r.style === s.id ? ' on' : ''),
            onClick: () => setR({ style: s.id })
          },
            React.createElement('div', {
              className: 'sw', style: {
                background: `linear-gradient(135deg, ${s.wall}, ${s.floor})`,
                position: 'relative'
              }
            }, React.createElement('div', {
              style: { position: 'absolute', right: 10, bottom: 10, width: 26, height: 26, borderRadius: 6, background: s.accent }
            })),
            React.createElement('div', { className: 'nm' }, s.name)))
        )
      ),
      // 人口
      React.createElement('div', { className: 'group' },
        React.createElement('label', null, '居住人口'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 } },
          React.createElement('span', { className: 'muted' }, '人数'),
          React.createElement('button', { className: 'btn-ghost', onClick: () => setOcc({ count: Math.max(1, occ.count - 1) }) }, '−'),
          React.createElement('span', { style: { fontFamily: 'var(--mono)', fontSize: 18, minWidth: 24, textAlign: 'center' } }, occ.count),
          React.createElement('button', { className: 'btn-ghost', onClick: () => setOcc({ count: occ.count + 1 }) }, '+')
        ),
        React.createElement('div', { className: 'chips' },
          [['elderly', '有老人'], ['children', '有小孩'], ['pets', '养宠物']].map(([k, t]) =>
            React.createElement('button', { key: k, className: 'chip' + (occ[k] ? ' on' : ''), onClick: () => setOcc({ [k]: !occ[k] }) }, t))
        )
      ),
      // 功能
      React.createElement('div', { className: 'group' },
        React.createElement('label', null, '功能需求（多选）'),
        React.createElement('div', { className: 'chips' },
          funcs.map(([k, t]) => React.createElement('button', {
            key: k, className: 'chip' + (r.functions.includes(k) ? ' on' : ''),
            onClick: () => setR({ functions: r.functions.includes(k) ? r.functions.filter(x => x !== k) : [...r.functions, k] })
          }, t))
        )
      )
    )
  );

  const next = () => { setR({ confirmed: true }); go('step1'); };
  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, center }),
    React.createElement(StepFooter, { prev: 'home', next: 'step1', onNext: next, nextLabel: '保存并进入户型' })
  );
}

/* ====================== Step1：户型上传 + 比例标注 ====================== */
function Step1() {
  const { project, update, notify } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan || AH.DEMO_FLOORPLAN;
  const [scaleSet, setScaleSet] = useState(!!project.scale);

  useEffect(() => { if (!project.floor_plan) update({ floor_plan: AH.DEMO_FLOORPLAN }); }, []);

  const totalArea = fp.rooms.reduce((s, r) => s + r.area_m2, 0).toFixed(1);
  const applyScale = () => { update({ scale: { pixels_per_cm: 2.45, method: 'manual' } }); setScaleSet(true); notify('已按 5.5m 基准线换算全屋比例'); };

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, React.createElement('h2', null, '户型'),
      React.createElement('p', null, '导入图纸 / CAD，标注比例')),
    React.createElement('div', { className: 'pb' },
      React.createElement('div', { className: 'upload-zone', onClick: () => notify('演示模式：已载入内置三室两厅户型') },
        React.createElement('div', { className: 'ic' }, '⬆'),
        React.createElement('div', { style: { fontWeight: 600 } }, '导入户型图 / CAD'),
        React.createElement('small', { className: 'note' }, '支持 JPG / PNG / PDF / DXF（DWG 请转 DXF）')),
      React.createElement('div', { className: 'divider' }),
      React.createElement('div', { className: 'group' },
        React.createElement('label', null, '比例标注'),
        React.createElement('p', { className: 'muted', style: { fontSize: 12, marginBottom: 10 } },
          '在底图上画一条已知长度的墙，输入真实尺寸，系统换算全屋。'),
        React.createElement('button', {
          className: scaleSet ? 'btn-ghost' : 'btn-primary',
          style: { width: '100%' }, onClick: applyScale
        }, scaleSet ? '✓ 已标定 5.5m 基准' : '标定基准线（5.5m）')),
      React.createElement('div', { className: 'group' },
        React.createElement('label', null, '画墙工具'),
        React.createElement('div', { className: 'chips' },
          ['直墙', '弧形墙', '矩形墙', '单开门', '推拉门', '窗'].map(t =>
            React.createElement('button', { key: t, className: 'chip' }, t))))
    )
  );

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, '楼层属性'),
    React.createElement('div', { className: 'pb' },
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '房屋使用面积'),
        React.createElement('span', { className: 'v' }, totalArea, React.createElement('span', { className: 'vn' }, 'm²'))),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '房间数量'),
        React.createElement('span', { className: 'v' }, fp.rooms.length)),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '当前层高'),
        React.createElement('span', { className: 'v' }, fp.floor_height_cm * 10, React.createElement('span', { className: 'vn' }, 'mm'))),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '外墙厚度'),
        React.createElement('span', { className: 'v' }, '240', React.createElement('span', { className: 'vn' }, 'mm'))),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '比例状态'),
        React.createElement('span', { className: 'v', style: { color: scaleSet ? 'var(--good)' : 'var(--warn)' } }, scaleSet ? '已标定' : '未标定')),
      React.createElement('div', { className: 'divider' }),
      React.createElement('label', { style: { fontSize: 11, color: 'var(--ink-3)' } }, '房间列表'),
      fp.rooms.map(r => React.createElement('div', { key: r.id, className: 'field-row' },
        React.createElement('span', null, r.name), React.createElement('span', { className: 'v' }, r.area_m2, React.createElement('span', { className: 'vn' }, 'm²'))))
    )
  );

  const center = React.createElement('div', { style: { position: 'absolute', inset: 0, padding: '20px 20px 76px' } },
    React.createElement(PlanCanvas, { fp, style: { borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,.4)' } }));

  const vt = React.createElement('div', { className: 'view-toggle' },
    React.createElement('button', { className: 'on' }, '2D'),
    React.createElement('button', { onClick: () => go('step2') }, '3D'));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, right, center, viewToggle: vt, hint: '演示户型 · 三室两厅 · ' + totalArea + '㎡' }),
    React.createElement(StepFooter, {
      prev: 'step0', next: 'step2', nextDisabled: !scaleSet,
      onNext: () => { if (!scaleSet) { notify('请先标注比例尺'); return; } go('step2'); }
    })
  );
}

/* ====================== Step2：3D 墙体 ====================== */
function Step2() {
  const { project } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan || AH.DEMO_FLOORPLAN;
  const [view, setView] = useState('3d');

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, '楼层属性'),
    React.createElement('div', { className: 'pb' },
      React.createElement('div', { className: 'group' },
        React.createElement('label', null, '层高 (mm)'),
        React.createElement('input', { className: 'slider', type: 'range', min: 2400, max: 3200, step: 100, defaultValue: fp.floor_height_cm * 10, disabled: true }),
        React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '当前'), React.createElement('span', { className: 'v' }, fp.floor_height_cm * 10, ' mm'))),
      React.createElement('small', { className: 'note' }, '拖动旋转查看 · 滚轮缩放 · 自动环绕'),
      React.createElement('div', { className: 'divider' }),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '墙体段数'), React.createElement('span', { className: 'v' }, AH.deriveWalls(fp).length)),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '地面块'), React.createElement('span', { className: 'v' }, fp.rooms.length))
    )
  );

  const center = view === '3d'
    ? React.createElement(Scene3D, { fp, mode: 'shell' })
    : React.createElement('div', { style: { position: 'absolute', inset: 0, padding: 20 } }, React.createElement(PlanCanvas, { fp }));

  const vt = React.createElement('div', { className: 'view-toggle' },
    React.createElement('button', { className: view === '2d' ? 'on' : '', onClick: () => setView('2d') }, '2D'),
    React.createElement('button', { className: view === '3d' ? 'on' : '', onClick: () => setView('3d') }, '3D'));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { right, center, viewToggle: vt, hint: view === '3d' ? '🖱 拖动旋转 · 滚轮缩放' : '2D 平面视图' }),
    React.createElement(StepFooter, { prev: 'step1', next: 'step3' })
  );
}

/* ====================== Step3：AI 布局 + 多方案对比 ====================== */
function Step3() {
  const { project, update, notify } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan || AH.DEMO_FLOORPLAN;
  const [tab, setTab] = useState('recommend');
  const [generating, setGenerating] = useState(false);
  const [focusRoom, setFocusRoom] = useState('all');

  const generate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      const plans = AH.generateLayouts(fp, project.requirement);
      update({ plans, selected_plan_id: plans[0].plan_id, layout: plans[0] });
      setGenerating(false);
    }, 900);
  }, [fp, project.requirement]);

  useEffect(() => { if (!project.plans.length) generate(); }, []);

  const select = (plan) => { update({ selected_plan_id: plan.plan_id, layout: plan }); };
  const sp = AH.STYLES.find(s => s.id === project.requirement.style);

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' },
      React.createElement('h2', null, 'AI 布局'),
      React.createElement('p', null, (sp ? sp.name : '现代') + ' · ' + AH.BUDGET_LABEL[project.requirement.budget_tier])),
    React.createElement('div', { className: 'pb' },
      React.createElement('div', { className: 'tabs' },
        React.createElement('button', { className: tab === 'recommend' ? 'on' : '', onClick: () => setTab('recommend') }, '推荐布局'),
        React.createElement('button', { className: tab === 'edit' ? 'on' : '', onClick: () => { setTab('edit'); } }, '编辑布局')),
      tab === 'recommend'
        ? React.createElement(React.Fragment, null,
          React.createElement('button', { className: 'btn-ghost', style: { width: '100%', marginBottom: 12 }, onClick: generate }, '↻ 重新生成方案'),
          generating
            ? React.createElement('div', { style: { padding: 30 } }, React.createElement('div', { className: 'spin' }), React.createElement('p', { className: 'muted', style: { textAlign: 'center', marginTop: 12 } }, 'AI 布局中…'))
            : project.plans.map(plan => React.createElement('div', {
              key: plan.plan_id, className: 'plan-card' + (project.selected_plan_id === plan.plan_id ? ' on' : ''),
              onClick: () => select(plan)
            },
              React.createElement('div', { className: 'thumb' }, React.createElement(PlanThumb, { fp, items: plan.items })),
              project.selected_plan_id === plan.plan_id && React.createElement('div', { className: 'check' }, '✓'),
              React.createElement('div', { className: 'meta' },
                React.createElement('b', null, plan.label),
                React.createElement('div', { className: 'hl' }, plan.highlights.map((h, i) => React.createElement('span', { key: i }, h))),
                React.createElement('div', { className: 'price' }, '家具 ¥' + plan.furniture_total.toLocaleString())))
            ))
        : React.createElement(React.Fragment, null,
          React.createElement('input', { className: 'text-input', placeholder: '🔍 搜索素材…', style: { marginBottom: 12 } }),
          React.createElement('div', { className: 'chips', style: { marginBottom: 14 } },
            ['组合', '家具', '卫浴', '橱柜', '灯饰', '影音', '定制', '装饰', '电器'].map(t => React.createElement('button', { key: t, className: 'chip' }, t))),
          React.createElement('p', { className: 'muted', style: { fontSize: 12 } }, '可在「编辑」步骤拖拽增删家具（演示见 Step4）。'))
    )
  );

  // 空间导航
  const rail = [['全', '全屋', focusRoom === 'all']].concat(
    fp.rooms.slice(0, 6).map(r => [r.name[0], r.name, focusRoom === r.id]));

  const center = React.createElement('div', { style: { position: 'absolute', inset: 0, padding: '20px 20px 76px' } },
    project.layout
      ? React.createElement(PlanCanvas, { fp, items: project.layout.items, style: { borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,.4)' } })
      : React.createElement('div', { className: 'empty' }, '生成中…'));

  const vt = React.createElement('div', { className: 'view-toggle' },
    React.createElement('button', { className: 'on' }, '2D 布局'),
    React.createElement('button', { onClick: () => notify('3D 布局预览见 Step4 编辑') }, '3D'));

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, '方案对比'),
    React.createElement('div', { className: 'pb' },
      React.createElement('table', { className: 'quote', style: { fontSize: 12 } },
        React.createElement('tbody', null,
          React.createElement('tr', null, React.createElement('td', { className: 'muted' }, '维度'),
            project.plans.map(p => React.createElement('td', { key: p.plan_id, style: { fontWeight: 700 } }, p.plan_id === 'plan_a' ? 'A' : 'B'))),
          React.createElement('tr', null, React.createElement('td', { className: 'muted' }, '风格'),
            project.plans.map(p => React.createElement('td', { key: p.plan_id }, sp ? sp.name : '现代'))),
          React.createElement('tr', null, React.createElement('td', { className: 'muted' }, '布局'),
            project.plans.map(p => React.createElement('td', { key: p.plan_id }, p.plan_id === 'plan_a' ? '对称' : '镜像'))),
          React.createElement('tr', null, React.createElement('td', { className: 'muted' }, '家具'),
            project.plans.map(p => React.createElement('td', { key: p.plan_id, className: 'num' }, '¥' + (p.furniture_total / 1000).toFixed(1) + 'k')))
        )),
      React.createElement('small', { className: 'note' }, '选中方案将进入编辑与后续渲染。')
    )
  );

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { rail, left, center, right, viewToggle: vt, hint: '已选 ' + (project.selected_plan_id === 'plan_a' ? '方案 A' : '方案 B') }),
    React.createElement(StepFooter, { prev: 'step2', next: 'step4', nextDisabled: !project.layout })
  );
}

// 方案缩略图（小 canvas）
function PlanThumb({ fp, items }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = 280; c.height = 210;
    drawFloorPlan(c, fp, { items, labels: false, grid: false, pad: 16 });
  }, [fp, items]);
  return React.createElement('canvas', { ref, style: { width: '100%', height: '100%', display: 'block' } });
}

/* ====================== Step4：手动编辑 ====================== */
function Step4() {
  const { project, update, markStale, notify } = useContext(Store);
  const { go } = useRoute();
  const fp = project.floor_plan || AH.DEMO_FLOORPLAN;
  const layout = project.layout;
  const [sel, setSel] = useState(null);
  const [view, setView] = useState('2d');

  useEffect(() => { if (!layout) go('step3'); }, [layout]);
  if (!layout) return null;

  const removeItem = (id) => {
    const items = layout.items.filter(i => i.item_id !== id);
    update({ layout: { ...layout, items } }); markStale(['renders', 'panoramas', 'quotation']);
    setSel(null); notify('已删除家具');
  };
  const rotateItem = (id) => {
    const items = layout.items.map(i => i.item_id === id ? { ...i, rotation_deg: (i.rotation_deg + 90) % 360 } : i);
    update({ layout: { ...layout, items } }); markStale(['renders', 'panoramas']);
  };
  const addItem = (cat) => {
    const list = AH.catalogByCategory(cat); if (!list.length) return;
    const s = list[0];
    const item = {
      item_id: cat + '_' + Date.now(), room_id: 'living', category: cat, sku_id: s.sku_id,
      position_cm: [700, 700], rotation_deg: 0, size_cm: [s.width_cm, s.depth_cm, s.height_cm], color: s.color, name: s.name
    };
    update({ layout: { ...layout, items: [...layout.items, item] } });
    markStale(['renders', 'panoramas', 'quotation']); notify('已添加 ' + s.name);
  };

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, React.createElement('h2', null, '手动编辑'),
      React.createElement('p', null, '点选家具 · 拖拽 · 旋转 · 删除')),
    React.createElement('div', { className: 'pb' },
      React.createElement('label', { style: { fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 8 } }, '从素材库添加'),
      React.createElement('div', { className: 'sku-grid' },
        ['sofa', 'bed', 'dining_table', 'wardrobe', 'coffee_table', 'lamp'].map(cat => {
          const s = AH.catalogByCategory(cat)[0];
          return React.createElement('div', { key: cat, className: 'sku-card', onClick: () => addItem(cat) },
            React.createElement('div', { className: 'sw', style: { background: s.color } }),
            React.createElement('div', { className: 'info' }, React.createElement('b', null, s.name),
              React.createElement('div', { className: 'p' }, '¥' + s.price)));
        })))
  );

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, sel ? '家具属性' : '布局清单'),
    React.createElement('div', { className: 'pb' },
      sel
        ? React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'sku-card', style: { marginBottom: 14 } },
            React.createElement('div', { className: 'sw', style: { background: sel.color, height: 80 } }),
            React.createElement('div', { className: 'info' }, React.createElement('b', null, sel.name))),
          React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '尺寸'),
            React.createElement('span', { className: 'v' }, sel.size_cm[0] + '×' + sel.size_cm[1] + ' cm')),
          React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '朝向'),
            React.createElement('span', { className: 'v' }, sel.rotation_deg + '°')),
          React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 14 } },
            React.createElement('button', { className: 'btn-ghost', style: { flex: 1 }, onClick: () => rotateItem(sel.item_id) }, '↻ 旋转 90°'),
            React.createElement('button', { className: 'btn-ghost', style: { flex: 1, color: 'var(--bad)' }, onClick: () => removeItem(sel.item_id) }, '🗑 删除')))
        : React.createElement(React.Fragment, null,
          layout.items.map(it => React.createElement('div', {
            key: it.item_id, className: 'field-row', style: { cursor: 'pointer' }, onClick: () => setSel(it)
          }, React.createElement('span', null, it.name),
            React.createElement('span', { className: 'vn' }, AH.STYLE_LABEL ? '' : '', it.category))),
          React.createElement('small', { className: 'note' }, '点击清单或画布中的家具可编辑。'))
    )
  );

  const center = view === '2d'
    ? React.createElement('div', { style: { position: 'absolute', inset: 0, padding: '20px 20px 76px' } },
      React.createElement(PlanCanvas, {
        fp, items: layout.items, highlightId: sel?.item_id, onPick: setSel,
        style: { borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,.4)' }
      }))
    : React.createElement(Scene3D, { fp, items: layout.items, mode: 'furnished' });

  const vt = React.createElement('div', { className: 'view-toggle' },
    React.createElement('button', { className: view === '2d' ? 'on' : '', onClick: () => setView('2d') }, '2D'),
    React.createElement('button', { className: view === '3d' ? 'on' : '', onClick: () => setView('3d') }, '3D'));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, right, center, viewToggle: vt, hint: view === '2d' ? '点击家具编辑 · 共 ' + layout.items.length + ' 件' : '🖱 拖动旋转查看 3D 布局' }),
    React.createElement(StepFooter, { prev: 'step3', next: 'step5' })
  );
}

/* ====================== 伪效果图渲染（L2 合成） ====================== */
function renderInterior(canvas, style, items, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const sp = AH.STYLES.find(s => s.id === style) || AH.STYLES[0];
  // 墙渐变
  const wg = ctx.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, sp.wall); wg.addColorStop(1, shadeHex(sp.wall, -10));
  ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
  // 透视地板（梯形）
  const horizon = H * 0.52;
  ctx.fillStyle = sp.floor;
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W * 0.72, horizon); ctx.lineTo(W * 0.28, horizon); ctx.closePath(); ctx.fill();
  // 地板纹理线
  ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) { const t = i / 8; const y = horizon + (H - horizon) * t * t;
    const lx = W * 0.28 - (W * 0.28) * (y - horizon) / (H - horizon);
    const rx = W * 0.72 + (W * 0.28) * (y - horizon) / (H - horizon);
    ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.stroke(); }
  // 侧墙阴影
  const sg = ctx.createLinearGradient(0, 0, W * 0.28, 0);
  sg.addColorStop(0, 'rgba(0,0,0,.18)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W * 0.28, horizon);
  const sg2 = ctx.createLinearGradient(W, 0, W * 0.72, 0);
  sg2.addColorStop(0, 'rgba(0,0,0,.18)'); sg2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg2; ctx.fillRect(W * 0.72, 0, W * 0.28, horizon);
  // 窗
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(W * 0.42, horizon * 0.3, W * 0.16, horizon * 0.45);
  ctx.strokeStyle = sp.accent; ctx.lineWidth = 3; ctx.strokeRect(W * 0.42, horizon * 0.3, W * 0.16, horizon * 0.45);
  // 装饰挂画
  ctx.fillStyle = sp.accent; ctx.globalAlpha = .8; ctx.fillRect(W * 0.12, horizon * 0.35, W * 0.1, horizon * 0.35); ctx.globalAlpha = 1;

  // 家具（透视摆放，靠下）—— 返回热区
  const hotspots = [];
  const placeable = (items || []).filter(it => ['sofa', 'coffee_table', 'tv_board', 'bed', 'lamp'].includes(it.category)).slice(0, 4);
  placeable.forEach((it, i) => {
    const bw = W * (0.18 + (it.size_cm[0] / 260) * 0.14);
    const bh = H * (0.12 + (it.size_cm[2] / 110) * 0.13);
    const bx = W * (0.2 + i * 0.2) - bw / 2;
    const by = H * 0.72 - bh;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath();
    ctx.ellipse(bx + bw / 2, by + bh + 6, bw / 2, 8, 0, 0, 7); ctx.fill();
    // 主体
    const fg = ctx.createLinearGradient(0, by, 0, by + bh);
    fg.addColorStop(0, shadeHex(it.color, 18)); fg.addColorStop(1, it.color);
    ctx.fillStyle = fg; roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1.5; ctx.stroke();
    hotspots.push({ item_id: it.item_id, category: it.category, name: it.name,
      bbox_norm: [bx / W, by / H, (bx + bw) / W, (by + bh) / H] });
  });
  // 暗角
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  return hotspots;
}
function shadeHex(hex, amt) {
  if (!hex || hex[0] !== '#') hex = '#999999';
  const n = parseInt(hex.slice(1), 16);
  let r = Math.max(0, Math.min(255, (n >> 16) + amt));
  let g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  let b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ====================== Step5：效果图 ====================== */
function Step5() {
  const { project, update, clearStale, notify } = useContext(Store);
  const fp = project.floor_plan, layout = project.layout;
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const style = project.requirement.style;

  const gen = () => {
    setBusy(true);
    setTimeout(() => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      const hs = renderInterior(c, style, layout.items);
      const url = c.toDataURL('image/jpeg', 0.9);
      setImg(url); setHotspots(hs);
      update({ renders: [{ id: 'r_' + Date.now(), image: url, hotspots: hs, style }] });
      clearStale('renders'); setBusy(false);
    }, 1400);
  };
  useEffect(() => { if (project.renders.length) { setImg(project.renders[0].image); setHotspots(project.renders[0].hotspots); } else gen(); }, []);

  const sp = AH.STYLES.find(s => s.id === style);
  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, React.createElement('h2', null, '效果图'),
      React.createElement('p', null, 'AI 渲染 2D 装修效果图')),
    React.createElement('div', { className: 'pb' },
      React.createElement('div', { className: 'group' }, React.createElement('label', null, '渲染风格'),
        React.createElement('div', { className: 'style-grid' }, AH.STYLES.slice(0, 6).map(s =>
          React.createElement('div', { key: s.id, className: 'style-card' + (style === s.id ? ' on' : ''), onClick: () => update(p => ({ requirement: { ...p.requirement, style: s.id } })) },
            React.createElement('div', { className: 'sw', style: { background: `linear-gradient(135deg,${s.wall},${s.floor})` } }),
            React.createElement('div', { className: 'nm', style: { fontSize: 11, padding: '5px' } }, s.name))))),
      React.createElement('div', { className: 'group' }, React.createElement('label', null, '相机视角'),
        React.createElement('div', { className: 'seg' },
          React.createElement('button', { className: 'on' }, '客厅 45°'),
          React.createElement('button', null, '正视'))),
      React.createElement('button', { className: 'btn-primary', style: { width: '100%' }, onClick: gen }, busy ? '渲染中…' : '↻ 重新渲染'))
  );

  const center = React.createElement('div', { className: 'render-stage', style: { padding: '20px 20px 76px' } },
    busy
      ? React.createElement('div', { style: { textAlign: 'center' } }, React.createElement('div', { className: 'spin' }), React.createElement('p', { className: 'muted', style: { marginTop: 14 } }, 'AI 渲染中（' + (sp ? sp.name : '') + '）…'))
      : img && React.createElement('div', { style: { position: 'relative', maxWidth: '100%', maxHeight: '100%', boxShadow: '0 12px 50px rgba(0,0,0,.5)', borderRadius: 8, overflow: 'hidden' } },
        React.createElement('img', { src: img, style: { display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 260px)' } })));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, center, hint: '效果图为 L2 合成演示 · 接入 Replicate 可升级为照片级' }),
    React.createElement(StepFooter, { prev: 'step4', next: 'step55' })
  );
}

/* ====================== Step5.5：720° 全景 ====================== */
function Step55() {
  const { project, notify } = useContext(Store);
  const [busy, setBusy] = useState(true);
  const [room, setRoom] = useState('living');
  const style = project.requirement.style;
  const fp = project.floor_plan;
  useEffect(() => { const t = setTimeout(() => setBusy(false), 1200); return () => clearTimeout(t); }, [room]);

  const center = busy
    ? React.createElement('div', { className: 'render-stage' }, React.createElement('div', { style: { textAlign: 'center' } },
      React.createElement('div', { className: 'spin' }), React.createElement('p', { className: 'muted', style: { marginTop: 14 } }, '生成 720° 全景中…')))
    : React.createElement(PanoramaViewer, { style, roomName: room });

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, React.createElement('h2', null, '720° 全景'),
      React.createElement('p', null, '沉浸式漫游，可发给家人')),
    React.createElement('div', { className: 'pb' },
      React.createElement('label', { style: { fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 8 } }, '选择房间'),
      fp.rooms.filter(r => ['living_room', 'bedroom'].includes(r.type)).map(r =>
        React.createElement('button', { key: r.id, className: 'chip' + (room === r.id ? ' on' : ''), style: { display: 'block', width: '100%', marginBottom: 8, textAlign: 'left' }, onClick: () => { setRoom(r.id); setBusy(true); } }, r.name)),
      React.createElement('div', { className: 'divider' }),
      React.createElement('button', { className: 'pill', style: { width: '100%', justifyContent: 'center' }, onClick: () => notify('全景分享链接已复制（演示）') }, '🔗 分享全景'),
      React.createElement('small', { className: 'note' }, 'Demo 用 cubemap 实时生成（PRD §17 L2）。拖动查看，自动旋转。'))
  );

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, center, hint: busy ? '' : '🖱 拖动环视 · 自动旋转' }),
    React.createElement(StepFooter, { prev: 'step5', next: 'step6' })
  );
}

/* ====================== Step6：效果图换品 ====================== */
function Step6() {
  const { project, update, markStale, notify } = useContext(Store);
  const { go } = useRoute();
  const render = project.renders[0];
  const layout = project.layout;
  const [sel, setSel] = useState(null);
  const [img, setImg] = useState(render?.image);
  const [hotspots, setHotspots] = useState(render?.hotspots || []);
  const style = project.requirement.style;

  useEffect(() => { if (!render) go('step5'); }, [render]);
  if (!render) return null;

  const swap = (newSku) => {
    // 更新 layout 中对应 item 的 sku，重渲染
    const items = layout.items.map(it => it.item_id === sel.item_id
      ? { ...it, sku_id: newSku.sku_id, color: newSku.color, name: newSku.name, size_cm: [newSku.width_cm, newSku.depth_cm, newSku.height_cm] }
      : it);
    const newLayout = { ...layout, items };
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const hs = renderInterior(c, style, items);
    const url = c.toDataURL('image/jpeg', 0.9);
    setImg(url); setHotspots(hs);
    update({ layout: newLayout, renders: [{ ...render, image: url, hotspots: hs }] });
    markStale(['quotation', 'panoramas']);
    notify('已换为 ' + newSku.name + '，报价将同步更新');
    setSel(null);
  };

  const recs = sel ? AH.recommend(sel.category, style, layout.items.find(i => i.item_id === sel.item_id)?.sku_id) : [];

  const center = React.createElement('div', { className: 'render-stage', style: { padding: '20px 20px 76px' } },
    React.createElement('div', { style: { position: 'relative', maxWidth: '100%', boxShadow: '0 12px 50px rgba(0,0,0,.5)', borderRadius: 8, overflow: 'hidden' } },
      React.createElement('img', { src: img, style: { display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 260px)' } }),
      // 热区
      React.createElement('div', { style: { position: 'absolute', inset: 0 } },
        hotspots.map(hs => {
          const [x1, y1, x2, y2] = hs.bbox_norm;
          return React.createElement('div', {
            key: hs.item_id, className: 'hotspot',
            style: { left: x1 * 100 + '%', top: y1 * 100 + '%', width: (x2 - x1) * 100 + '%', height: (y2 - y1) * 100 + '%' },
            onClick: () => setSel(hs)
          }, React.createElement('span', { className: 'tag' }, '点击换 ' + hs.name));
        })))
  );

  const right = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, sel ? '替换：' + sel.name : '效果图换品'),
    React.createElement('div', { className: 'pb' },
      sel
        ? React.createElement(React.Fragment, null,
          React.createElement('p', { className: 'muted', style: { fontSize: 12, marginBottom: 12 } }, '选择同类商品替换（连接产品库）：'),
          React.createElement('div', { className: 'sku-grid' },
            recs.map(s => React.createElement('div', { key: s.sku_id, className: 'sku-card', onClick: () => swap(s) },
              React.createElement('div', { className: 'sw', style: { background: s.color } }),
              React.createElement('div', { className: 'info' },
                React.createElement('b', null, s.name),
                React.createElement('div', { className: 'br' }, s.brand),
                React.createElement('div', { className: 'p' }, '¥' + s.price.toLocaleString()))))))
        : React.createElement('div', { className: 'empty' }, '点击效果图中高亮的家具\n选择替换商品'))
  );

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { center, right, hint: '点击图中琥珀色热区即可换品（连接产品库）' }),
    React.createElement(StepFooter, { prev: 'step55', next: 'step7' })
  );
}

/* ====================== Step7：报价 ====================== */
function Step7() {
  const { project, update, clearStale, notify } = useContext(Store);
  const fp = project.floor_plan, layout = project.layout;
  const [labor, setLabor] = useState(0.3);
  const quote = useMemo(() => AH.generateQuotation(fp, layout, labor), [fp, layout, labor]);
  useEffect(() => clearStale('quotation'), [quote]);
  const s = quote.summary;

  const exportCsv = () => {
    let csv = '类别,名称,空间,数量,单位,单价,小计\n';
    quote.line_items.forEach(l => csv += `${l.type === 'furniture' ? '家具' : '主材'},${l.name},${l.room},${l.qty},${l.unit},${l.unit_price},${l.subtotal}\n`);
    csv += `,,,,,人工(${(labor * 100).toFixed(0)}%),${s.labor_cost}\n,,,,,合计,${s.grand_total}\n`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '装修报价单.csv'; a.click();
    notify('报价单已导出 CSV');
  };

  const left = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'ph' }, React.createElement('h2', null, '空间报价'),
      React.createElement('p', null, '按面积 + 清单智能核算')),
    React.createElement('div', { className: 'pb' },
      React.createElement('div', { className: 'group' }, React.createElement('label', null, '人工费率 ' + (labor * 100).toFixed(0) + '%'),
        React.createElement('input', { className: 'slider', type: 'range', min: 0.1, max: 0.5, step: 0.05, value: labor, onChange: e => setLabor(+e.target.value) })),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '家具合计'), React.createElement('span', { className: 'v' }, '¥' + s.furniture_total.toLocaleString())),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '主材合计'), React.createElement('span', { className: 'v' }, '¥' + s.material_total.toLocaleString())),
      React.createElement('div', { className: 'field-row' }, React.createElement('span', { className: 'muted' }, '人工'), React.createElement('span', { className: 'v' }, '¥' + s.labor_cost.toLocaleString())),
      React.createElement('div', { className: 'divider' }),
      React.createElement('button', { className: 'btn-primary', style: { width: '100%', marginBottom: 8 }, onClick: exportCsv }, '⬇ 导出报价单 CSV'),
      React.createElement('button', { className: 'pill', style: { width: '100%', justifyContent: 'center' }, onClick: () => notify('完整方案链接已复制（含效果图/全景/报价）') }, '🔗 分享完整方案'))
  );

  const center = React.createElement('div', { style: { position: 'absolute', inset: 0, overflowY: 'auto', padding: '24px 32px 80px' } },
    React.createElement('div', { className: 'fade-in', style: { maxWidth: 820, margin: '0 auto' } },
      React.createElement('div', { className: 'quote-total' },
        React.createElement('div', null, React.createElement('div', { className: 'lbl' }, '预估总价'),
          React.createElement('div', { className: 'big' }, '¥' + s.grand_total.toLocaleString())),
        React.createElement('div', null, React.createElement('div', { className: 'lbl' }, '每平米'),
          React.createElement('div', { className: 'sub' }, '¥' + s.cost_per_m2 + '/㎡')),
        React.createElement('div', null, React.createElement('div', { className: 'lbl' }, '建筑面积'),
          React.createElement('div', { className: 'sub' }, s.total_area_m2 + ' ㎡'))),
      React.createElement('table', { className: 'quote' },
        React.createElement('thead', null, React.createElement('tr', null,
          ['类别', '名称', '空间', '数量', '单价', '小计'].map(h => React.createElement('th', { key: h, className: h === '数量' || h === '单价' || h === '小计' ? 'num' : '' }, h)))),
        React.createElement('tbody', null,
          quote.line_items.map((l, i) => React.createElement('tr', { key: i },
            React.createElement('td', null, React.createElement('span', { className: 'cat-tag ' + l.type }, l.type === 'furniture' ? '家具' : '主材')),
            React.createElement('td', null, l.name),
            React.createElement('td', { className: 'muted' }, l.room),
            React.createElement('td', { className: 'num' }, l.qty + ' ' + l.unit),
            React.createElement('td', { className: 'num' }, '¥' + l.unit_price),
            React.createElement('td', { className: 'num' }, '¥' + l.subtotal.toLocaleString()))))),
      React.createElement('small', { className: 'note', style: { marginTop: 16 } }, quote.disclaimer)
    ));

  return React.createElement(React.Fragment, null,
    React.createElement(Workspace, { left, center, hint: '报价随布局/换品实时联动（PRD §5.7）' }),
    React.createElement(StepFooter, { prev: 'step6', next: 'home', nextLabel: '完成' })
  );
}

/* ====================== 分享只读页 ====================== */
function SharePage() {
  const { project } = useContext(Store);
  return React.createElement('div', { className: 'home fade-in' },
    React.createElement('h1', { style: { fontSize: 26 } }, '📤 方案分享（只读）'),
    React.createElement('p', null, '这是分享给家人/设计师的只读视图，含效果图、全景与报价摘要。无需登录即可查看（演示）。'),
    project.renders[0] && React.createElement('img', { src: project.renders[0].image, style: { maxWidth: 600, borderRadius: 12, boxShadow: '0 12px 50px rgba(0,0,0,.5)', marginBottom: 24 } }),
    React.createElement('button', { className: 'btn-primary', onClick: () => location.hash = '/home' }, '返回编辑'))
}

/* ====================== 根组件 ====================== */
function App() {
  const store = useProvideStore();
  const { route } = useRoute();
  const isShare = route.startsWith('share');
  const page = (() => {
    if (route === 'home' || route === '') return React.createElement(HomePage);
    if (isShare) return React.createElement(SharePage);
    const map = { step0: Step0, step1: Step1, step2: Step2, step3: Step3, step4: Step4, step5: Step5, step55: Step55, step6: Step6, step7: Step7 };
    const C = map[route]; return C ? React.createElement(C) : React.createElement(HomePage);
  })();
  const showChrome = route !== 'home' && route !== '' && !isShare;

  return React.createElement(Store.Provider, { value: store },
    React.createElement(TopBar),
    showChrome && React.createElement(StepBar),
    showChrome && React.createElement(StaleBanner),
    React.createElement('div', { style: { height: showChrome ? 'auto' : 'calc(100% - var(--topbar-h))', flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' } }, page),
    store.toast && React.createElement('div', { className: 'toast' }, store.toast)
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
