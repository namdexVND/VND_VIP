


// =====================================================================
// ---- CẤU HÌNH: CHỈNH SỬA Ở ĐÂY ----
// =====================================================================
/*CONFIG*/

// Hỗ trợ dữ liệu ngoài (nếu có) qua window.dataCCD
const EXTRA = (window.dataCCD && window.dataCCD.data) || {};
const ringTexts = [...CONFIG.ringTexts, ...(EXTRA.ringTexts || [])];
let heartImages = [...(EXTRA.heartImages || []), ...CONFIG.images];
if (heartImages.length === 0) heartImages = Array(9).fill(null);

// =====================================================================
// ---- SCENE, CAMERA, RENDERER ----
// =====================================================================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.0015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.position.set(0, 20, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.enabled = false;
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.minDistance = 15;
controls.maxDistance = 300;
controls.zoomSpeed = 0.3;
controls.rotateSpeed = 0.3;
controls.update();

const maxAniso = renderer.capabilities.getMaxAnisotropy();

// Trạng thái chung (khai báo sớm để tránh lỗi dùng trước khi khai báo)
let introStarted = false;
let fadeOpacity = 0.1;

// =====================================================================
// ---- GLOW, TINH VÂN ----
// =====================================================================
function createGlowSprite(color, size = 128, opacity = 0.55) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Sprite(material);
}

const centralGlow = createGlowSprite('rgba(255,255,255,0.8)', 156, 0.25);
centralGlow.scale.set(8, 8, 1);
scene.add(centralGlow);

const nebulae = [];
for (let i = 0; i < 15; i++) {
  const hue = Math.random() * 360;
  const nebula = createGlowSprite(`hsla(${hue}, 80%, 50%, 0.6)`, 256);
  nebula.scale.set(100, 100, 1);
  nebula.position.set(
    (Math.random() - 0.5) * 175,
    (Math.random() - 0.5) * 175,
    (Math.random() - 0.5) * 175
  );
  scene.add(nebula);
  nebulae.push(nebula);
}

// =====================================================================
// ---- THIÊN HÀ ----
// =====================================================================
const galaxyParameters = {
  count: 100000,
  arms: 6,
  radius: 100,
  spin: 0.5,
  randomness: 0.2,
  randomnessPower: 20,
  insideColor: new THREE.Color(0xd63ed6),
  outsideColor: new THREE.Color(0x48b8b8)
};

const numGroups = heartImages.length;

// Chế độ ảnh: một số ít hạt trên các nhánh xoắn ốc biến thành ảnh thật (hiện sau khi đọc xong thư)
const photoMode = heartImages.some(Boolean);
const photoGroups = [];
let photoReveal = 0, photoRevealTarget = 0, photosRevealed = false;
const photoSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
const photoPerGroup = photoSmall ? 40 : 70;
const photoSize = photoSmall ? 10 : 11;

// Mật độ điểm mỗi nhóm ảnh (nội suy theo số ảnh)
const maxDensity = 50000;
const minDensity = 2000;
const maxGroupsForScale = 14;
let pointsPerGroup;
if (numGroups <= 1) {
  pointsPerGroup = maxDensity;
} else if (numGroups >= maxGroupsForScale) {
  pointsPerGroup = minDensity;
} else {
  const t = (numGroups - 1) / (maxGroupsForScale - 1);
  pointsPerGroup = Math.floor(maxDensity * (1 - t) + minDensity * t);
}
if (pointsPerGroup * numGroups > galaxyParameters.count) {
  pointsPerGroup = Math.floor(galaxyParameters.count / numGroups);
}

const positions = new Float32Array(galaxyParameters.count * 3);
const colors = new Float32Array(galaxyParameters.count * 3);
let pointIdx = 0;
for (let i = 0; i < galaxyParameters.count; i++) {
  const radius = Math.pow(Math.random(), galaxyParameters.randomnessPower) * galaxyParameters.radius;
  if (radius < 30 && Math.random() < 0.8) continue;

  const branchAngle = (i % galaxyParameters.arms) / galaxyParameters.arms * Math.PI * 2;
  const spinAngle = radius * galaxyParameters.spin;
  const randomX = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
  const randomY = (Math.random() - 0.5) * galaxyParameters.randomness * radius * 1.2;
  const randomZ = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
  const totalAngle = branchAngle + spinAngle;

  const i3 = pointIdx * 3;
  positions[i3] = Math.cos(totalAngle) * radius + randomX;
  positions[i3 + 1] = randomY;
  positions[i3 + 2] = Math.sin(totalAngle) * radius + randomZ;

  const mixedColor = new THREE.Color(0xff66ff);
  mixedColor.lerp(new THREE.Color(0x66ffff), radius / galaxyParameters.radius);
  mixedColor.multiplyScalar(0.7 + 0.3 * Math.random());
  colors[i3] = mixedColor.r;
  colors[i3 + 1] = mixedColor.g;
  colors[i3 + 2] = mixedColor.b;
  pointIdx++;
}

const galaxyGeometry = new THREE.BufferGeometry();
galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, pointIdx * 3), 3));
galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, pointIdx * 3), 3));

const galaxyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uSize: { value: 100.0 * renderer.getPixelRatio() },
    uOpacity: { value: 0.1 }
  },
  vertexShader: `
    uniform float uSize;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 viewPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = uSize / -viewPosition.z;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying vec3 vColor;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      gl_FragColor = vec4(vColor * uOpacity, 1.0);
    }
  `,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
  vertexColors: true
});
const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial);
scene.add(galaxy);

// =====================================================================
// ---- CÁC NHÓM ĐIỂM ẢNH (HÌNH TRÁI TIM / ẢNH CỦA BẠN) ----
// =====================================================================
function createNeonTexture(image, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const aspectRatio = image.width / image.height;
  let drawWidth, drawHeight, offsetX, offsetY;
  if (aspectRatio > 1) {
    drawWidth = size;
    drawHeight = size / aspectRatio;
    offsetX = 0;
    offsetY = (size - drawHeight) / 2;
  } else {
    drawHeight = size;
    drawWidth = size * aspectRatio;
    offsetX = (size - drawWidth) / 2;
    offsetY = 0;
  }
  const r = size * 0.1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(offsetX + r, offsetY);
  ctx.lineTo(offsetX + drawWidth - r, offsetY);
  ctx.arcTo(offsetX + drawWidth, offsetY, offsetX + drawWidth, offsetY + r, r);
  ctx.lineTo(offsetX + drawWidth, offsetY + drawHeight - r);
  ctx.arcTo(offsetX + drawWidth, offsetY + drawHeight, offsetX + drawWidth - r, offsetY + drawHeight, r);
  ctx.lineTo(offsetX + r, offsetY + drawHeight);
  ctx.arcTo(offsetX, offsetY + drawHeight, offsetX, offsetY + drawHeight - r, r);
  ctx.lineTo(offsetX, offsetY + r);
  ctx.arcTo(offsetX, offsetY, offsetX + r, offsetY, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Texture trái tim dự phòng khi không có ảnh / ảnh lỗi
function createHeartTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const s = size;
  const grad = ctx.createRadialGradient(s * 0.4, s * 0.35, s * 0.05, s / 2, s / 2, s * 0.5);
  grad.addColorStop(0, '#ffd6ec');
  grad.addColorStop(0.6, '#ff69b4');
  grad.addColorStop(1, '#d6246e');
  ctx.beginPath();
  ctx.moveTo(s / 2, s * 0.88);
  ctx.bezierCurveTo(s * 0.02, s * 0.55, s * 0.1, s * 0.08, s / 2, s * 0.3);
  ctx.bezierCurveTo(s * 0.9, s * 0.08, s * 0.98, s * 0.55, s / 2, s * 0.88);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function loadHeartTexture(src, callback) {
  if (!src) { callback(createHeartTexture()); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try { callback(createNeonTexture(img, 256)); }
    catch (e) { callback(createHeartTexture()); }
  };
  img.onerror = () => callback(createHeartTexture());
  img.src = src;
}

const heartObjects = [];

for (let group = 0; group < numGroups; group++) {
  const nPts = photoMode ? photoPerGroup : pointsPerGroup;
  const gPos = new Float32Array(nPts * 3);
  const gColNear = new Float32Array(nPts * 3);
  const gColFar = new Float32Array(nPts * 3);
  let valid = 0;

  for (let i = 0; i < nPts; i++) {
    // chế độ ảnh: rải đều dọc các nhánh (không dồn vào tâm) để thấy rõ từng tấm ảnh
    const radius = photoMode
      ? 32 + Math.pow(Math.random(), 1.1) * 62
      : Math.pow(Math.random(), galaxyParameters.randomnessPower) * galaxyParameters.radius;
    if (radius < 30) continue;

    const globalIdx = group * nPts + i;
    const branchAngle = (globalIdx % galaxyParameters.arms) / galaxyParameters.arms * Math.PI * 2;
    const spinAngle = radius * galaxyParameters.spin;
    const randomX = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
    const randomY = (Math.random() - 0.5) * galaxyParameters.randomness * radius * 0.5;
    const randomZ = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
    const totalAngle = branchAngle + spinAngle;

    const idx = valid * 3;
    gPos[idx] = Math.cos(totalAngle) * radius + randomX;
    gPos[idx + 1] = randomY;
    gPos[idx + 2] = Math.sin(totalAngle) * radius + randomZ;

    gColNear[idx] = gColNear[idx + 1] = gColNear[idx + 2] = 1;

    const colorFar = galaxyParameters.insideColor.clone();
    colorFar.lerp(galaxyParameters.outsideColor, radius / galaxyParameters.radius);
    colorFar.multiplyScalar(0.7 + 0.3 * Math.random());
    gColFar[idx] = colorFar.r;
    gColFar[idx + 1] = colorFar.g;
    gColFar[idx + 2] = colorFar.b;
    valid++;
  }
  if (valid === 0) continue;

  // Tâm nhóm
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < valid; i++) {
    cx += gPos[i * 3]; cy += gPos[i * 3 + 1]; cz += gPos[i * 3 + 2];
  }
  cx /= valid; cy /= valid; cz /= valid;

  const geometryNear = new THREE.BufferGeometry();
  geometryNear.setAttribute('position', new THREE.BufferAttribute(gPos.slice(0, valid * 3), 3));
  geometryNear.setAttribute('color', new THREE.BufferAttribute(gColNear.slice(0, valid * 3), 3));
  const geometryFar = new THREE.BufferGeometry();
  geometryFar.setAttribute('position', new THREE.BufferAttribute(gPos.slice(0, valid * 3), 3));
  geometryFar.setAttribute('color', new THREE.BufferAttribute(gColFar.slice(0, valid * 3), 3));
  geometryNear.translate(-cx, -cy, -cz);
  geometryFar.translate(-cx, -cy, -cz);

  loadHeartTexture(heartImages[group], texture => {
    if (photoMode) {
      const mat = new THREE.PointsMaterial({
        size: photoSize, map: texture, transparent: true, opacity: 0,
        alphaTest: 0.12, depthWrite: false, vertexColors: true, blending: THREE.NormalBlending
      });
      const pts = new THREE.Points(geometryNear, mat);
      pts.position.set(cx, cy, cz);
      pts.renderOrder = 5;
      pts.visible = false;
      scene.add(pts);
      photoGroups.push({ mat, pts });
      return;
    }
    const materialNear = new THREE.PointsMaterial({
      size: 1.8, map: texture, transparent: true, opacity: fadeOpacity,
      alphaTest: 0.2, depthWrite: true, depthTest: true,
      blending: THREE.NormalBlending, vertexColors: true
    });
    const materialFar = new THREE.PointsMaterial({
      size: 1.8, map: texture, transparent: true, opacity: fadeOpacity,
      alphaTest: 0.2, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true
    });

    const obj = new THREE.Points(geometryFar, materialFar);
    obj.position.set(cx, cy, cz);
    obj.userData = { materialNear, materialFar, geometryNear, geometryFar,
                     posArray: geometryFar.getAttribute('position').array };
    scene.add(obj);
    heartObjects.push(obj);
  });
}

// Chuyển giữa chế độ "gần" (ảnh rõ) và "xa" (ánh sáng neon)
function updateHeartLOD() {
  const px = camera.position.x, py = camera.position.y, pz = camera.position.z;
  for (const obj of heartObjects) {
    const arr = obj.userData.posArray;
    const ox = obj.position.x - px, oy = obj.position.y - py, oz = obj.position.z - pz;
    let isClose = false;
    for (let i = 0; i < arr.length; i += 3) {
      const dx = arr[i] + ox, dy = arr[i + 1] + oy, dz = arr[i + 2] + oz;
      if (dx * dx + dy * dy + dz * dz < 100) { isClose = true; break; }
    }
    const wantMat = isClose ? obj.userData.materialNear : obj.userData.materialFar;
    if (obj.material !== wantMat) {
      obj.material = wantMat;
      obj.geometry = isClose ? obj.userData.geometryNear : obj.userData.geometryFar;
    }
  }
}

// =====================================================================
// ---- ÁNH SÁNG, NỀN SAO ----
// =====================================================================
scene.add(new THREE.AmbientLight(0xffffff, 0.2));

const starCount = 20000;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 900;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff, size: 0.7, transparent: true, opacity: 1, depthWrite: false
});
const starField = new THREE.Points(starGeometry, starMaterial);
starField.name = 'starfield';
starField.renderOrder = 999;
scene.add(starField);
starGeometry.setDrawRange(0, Math.floor(starCount * 0.1)); // ban đầu chỉ hiện 10% sao

// =====================================================================
// ---- HÀNH TINH TRUNG TÂM ----
// =====================================================================
function createPlanetTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, size / 8, size / 2, size / 2, size / 2);
  gradient.addColorStop(0.00, '#f8bbd0');
  gradient.addColorStop(0.12, '#f48fb1');
  gradient.addColorStop(0.22, '#f06292');
  gradient.addColorStop(0.35, '#ffffff');
  gradient.addColorStop(0.50, '#e1aaff');
  gradient.addColorStop(0.62, '#a259f7');
  gradient.addColorStop(0.75, '#b2ff59');
  gradient.addColorStop(1.00, '#3fd8c7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const spotColors = ['#f8bbd0', '#f8bbd0', '#f48fb1', '#f48fb1', '#f06292', '#f06292', '#ffffff', '#e1aaff', '#a259f7', '#b2ff59'];
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 30 + Math.random() * 120;
    const color = spotColors[Math.floor(Math.random() * spotColors.length)];
    const sg = ctx.createRadialGradient(x, y, 0, x, y, radius);
    sg.addColorStop(0, color + 'cc');
    sg.addColorStop(1, color + '00');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, size, size);
  }

  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.bezierCurveTo(Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size);
    ctx.strokeStyle = 'rgba(180, 120, 200, ' + (0.12 + Math.random() * 0.18) + ')';
    ctx.lineWidth = 8 + Math.random() * 18;
    ctx.stroke();
  }

  if (ctx.filter !== undefined) {
    ctx.filter = 'blur(2px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }
  return new THREE.CanvasTexture(canvas);
}

const planetRadius = 10;
const planetMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0.0 },
    baseTexture: { value: createPlanetTexture() }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform sampler2D baseTexture;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      float angle = length(uv - vec2(0.5)) * 3.0;
      float twist = sin(angle * 3.0 + time) * 0.1;
      uv.x += twist * sin(time * 0.5);
      uv.y += twist * cos(time * 0.5);
      vec4 texColor = texture2D(baseTexture, uv);
      float noise = sin(uv.x * 10.0 + time) * sin(uv.y * 10.0 + time) * 0.1;
      texColor.rgb += noise * vec3(0.8, 0.4, 0.2);
      gl_FragColor = texColor;
    }
  `
});
const planet = new THREE.Mesh(new THREE.SphereGeometry(planetRadius, 48, 48), planetMaterial);
planet.name = 'main-planet';
centralGlow.name = 'main-glow';
scene.add(planet);

// Khí quyển quanh hành tinh
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(planetRadius * 1.05, 48, 48),
  new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(0xe0b3ff) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 glowColor;
      void main() {
        float intensity = pow(max(0.0, 0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
        gl_FragColor = vec4(glowColor, 1.0) * intensity;
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true
  })
);
planet.add(atmosphere);

// =====================================================================
// ---- CÁC VÒNG CHỮ QUAY QUANH HÀNH TINH ----
// =====================================================================
const textRings = [];
const RING_TEX_WIDTH = 4096;
const RING_HEIGHT = 2.5;

function createRingTexture(text, ringRadius) {
  const circumference = 2 * Math.PI * ringRadius;
  const W = RING_TEX_WIDTH;
  const H = Math.max(64, Math.round(W * RING_HEIGHT / circumference));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const segment = text + '   ';
  const baseFont = H * 0.62;
  ctx.font = `bold ${baseFont}px Arial, sans-serif`;
  const segWidth = ctx.measureText(segment).width;
  const repeat = Math.max(1, Math.ceil(W / segWidth));
  const fontSize = baseFont * (W / repeat) / segWidth; // vừa khít vòng tròn, không bị cắt
  const step = W / repeat;

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, fontSize * 0.05);

  for (let i = 0; i < repeat; i++) {
    const x = i * step;
    ctx.shadowColor = '#e0b3ff';
    ctx.shadowBlur = fontSize * 0.2;
    ctx.strokeStyle = '#fff';
    ctx.strokeText(segment, x, H / 2);
    ctx.shadowColor = '#ffb3de';
    ctx.shadowBlur = fontSize * 0.28;
    ctx.fillStyle = '#fff';
    ctx.fillText(segment, x, H / 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

(function createTextRings() {
  const numRings = ringTexts.length;
  const baseRingRadius = planetRadius * 1.1;
  const ringSpacing = 5;

  for (let i = 0; i < numRings; i++) {
    const ringRadius = baseRingRadius + i * ringSpacing;
    const material = new THREE.MeshBasicMaterial({
      map: createRingTexture(ringTexts[i], ringRadius),
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.01,
      opacity: 1,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(ringRadius, ringRadius, RING_HEIGHT, 128, 1, true),
      material
    );
    mesh.rotation.y = Math.PI / 2;

    const group = new THREE.Group();
    group.add(mesh);
    group.userData = {
      angleOffset: 0.15 * Math.PI * 0.5,
      speed: 0.00225,
      baseRotX: (i / numRings) * Math.PI
    };
    group.rotation.x = group.userData.baseRotX;
    scene.add(group);
    textRings.push(group);
  }
})();

function animatePlanetSystem(time) {
  textRings.forEach((ringGroup, index) => {
    const u = ringGroup.userData;
    u.angleOffset += u.speed;
    ringGroup.rotation.x = u.baseRotX;
    ringGroup.rotation.z = Math.PI / 6;
    ringGroup.rotation.y = u.angleOffset;

    const pulse = (Math.sin(time * 1.5 + index) + 1) / 2;
    ringGroup.children[0].material.opacity = 0.7 + pulse * 0.3;
  });
}

// =====================================================================
// ---- SAO BĂNG ----
// =====================================================================
const shootingStars = [];

function createRandomCurve() {
  const startPoint = new THREE.Vector3(-200 + Math.random() * 100, -100 + Math.random() * 200, -100 + Math.random() * 200);
  const endPoint = new THREE.Vector3(600 + Math.random() * 200, startPoint.y + (-100 + Math.random() * 200), startPoint.z + (-100 + Math.random() * 200));
  const c1 = new THREE.Vector3(startPoint.x + 200 + Math.random() * 100, startPoint.y + (-50 + Math.random() * 100), startPoint.z + (-50 + Math.random() * 100));
  const c2 = new THREE.Vector3(endPoint.x - 200 + Math.random() * 100, endPoint.y + (-50 + Math.random() * 100), endPoint.z + (-50 + Math.random() * 100));
  return new THREE.CubicBezierCurve3(startPoint, c1, c2, endPoint);
}

function createShootingStar() {
  const trailLength = 100;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending })
  );

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 16),
    new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform float time;
        void main() {
          float intensity = pow(max(0.0, 0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          gl_FragColor = vec4(1.0, 1.0, 1.0, intensity * (0.8 + sin(time * 5.0) * 0.2));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    })
  );
  head.add(glow);

  const curve = createRandomCurve();
  const trailPoints = [];
  for (let i = 0; i < trailLength; i++) {
    trailPoints.push(curve.getPoint(i / (trailLength - 1)));
  }
  const trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(trailPoints),
    new THREE.LineBasicMaterial({ color: 0x99eaff, transparent: true, opacity: 0.7 })
  );

  const group = new THREE.Group();
  group.add(head);
  group.add(trail);
  group.userData = {
    curve, progress: 0,
    speed: 0.001 + Math.random() * 0.001,
    head, glow, trail, trailLength, trailPoints
  };
  scene.add(group);
  shootingStars.push(group);
}

function updateShootingStars(time) {
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const star = shootingStars[i];
    const u = star.userData;
    u.progress += u.speed;

    if (u.progress >= 1) {
      scene.remove(star);
      u.head.geometry.dispose(); u.head.material.dispose();
      u.glow.geometry.dispose(); u.glow.material.dispose();
      u.trail.geometry.dispose(); u.trail.material.dispose();
      shootingStars.splice(i, 1);
      continue;
    }

    const opacity = Math.max(0, Math.min(1, u.progress / 0.05, (1 - u.progress) / 0.1));
    const currentPos = u.curve.getPoint(u.progress);
    star.position.copy(currentPos);
    u.head.material.opacity = opacity;
    u.glow.material.uniforms.time.value = time;

    // Đuôi: toạ độ tuyệt đối nằm trong group đã dịch chuyển -> trừ đi vị trí group
    u.trailPoints[0].copy(currentPos);
    for (let j = 1; j < u.trailLength; j++) {
      const p = Math.max(0, u.progress - j * 0.01);
      u.trailPoints[j].copy(u.curve.getPoint(p));
    }
    const attr = u.trail.geometry.getAttribute('position');
    for (let j = 0; j < u.trailLength; j++) {
      attr.setXYZ(j, u.trailPoints[j].x - currentPos.x, u.trailPoints[j].y - currentPos.y, u.trailPoints[j].z - currentPos.z);
    }
    attr.needsUpdate = true;
    u.trail.material.opacity = opacity * 0.7;
  }

  if (shootingStars.length < 3 && Math.random() < 0.02) createShootingStar();
}

// =====================================================================
// ---- ÂM NHẠC ----
// =====================================================================
let galaxyAudio = null;
if (CONFIG.music) {
  galaxyAudio = new Audio(CONFIG.music);
  galaxyAudio.loop = true;
  galaxyAudio.volume = 1.0;
  galaxyAudio.preload = 'auto';
}
function playGalaxyAudio() {
  if (galaxyAudio) {
    galaxyAudio.play().catch(err => console.warn('Không phát được nhạc:', err));
  }
}

// =====================================================================
// ---- ICON & CHỮ GỢI Ý "CHẠM VÀO TINH CẦU" ----
// =====================================================================
let hintIcon, hintText;

function createHintIcon() {
  hintIcon = new THREE.Group();
  hintIcon.name = 'hint-icon-group';
  scene.add(hintIcon);

  const cursorVisuals = new THREE.Group();
  const h = 1.5;
  const w = h * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-w * 0.4, -h * 0.7);
  shape.lineTo(-w * 0.25, -h * 0.7);
  shape.lineTo(-w * 0.5, -h);
  shape.lineTo(w * 0.5, -h);
  shape.lineTo(w * 0.25, -h * 0.7);
  shape.lineTo(w * 0.4, -h * 0.7);
  shape.closePath();

  const cursorMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  cursorVisuals.add(cursorMesh);
  cursorVisuals.position.y = h / 2;
  cursorVisuals.rotation.x = Math.PI / 2;

  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.0, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
  );
  ringMesh.rotation.x = Math.PI / 2;
  hintIcon.userData.ringMesh = ringMesh;

  hintIcon.add(cursorVisuals);
  hintIcon.add(ringMesh);
  hintIcon.position.set(1.5, 1.5, 15);
  hintIcon.scale.set(0.8, 0.8, 0.8);
  hintIcon.lookAt(planet.position);
  hintIcon.userData.initialPosition = hintIcon.position.clone();
}

function createHintText() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const text = CONFIG.hintText;
  ctx.font = 'bold 80px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;

  ctx.shadowColor = '#ffb3de';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(255, 200, 220, 0.8)';
  ctx.strokeText(text, 512, 256);
  ctx.shadowColor = '#e0b3ff';
  ctx.strokeStyle = 'rgba(220, 180, 255, 0.5)';
  ctx.strokeText(text, 512, 256);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  hintText = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 8),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  hintText.position.set(0, 15, 0);
  scene.add(hintText);
}

function animateHintIcon(time) {
  if (!hintIcon) return;

  if (!introStarted) {
    hintIcon.visible = true;
    const f = 2.5;
    const tapOffset = Math.sin(time * f) * 1.5;
    const direction = new THREE.Vector3();
    hintIcon.getWorldDirection(direction);
    hintIcon.position.copy(hintIcon.userData.initialPosition).addScaledVector(direction, -tapOffset);

    const ring = hintIcon.userData.ringMesh;
    const s = 1 + Math.sin(time * f) * 0.1;
    ring.scale.set(s, s, 1);
    ring.material.opacity = 0.5 + Math.sin(time * f) * 0.2;

    if (hintText) {
      hintText.visible = true;
      hintText.material.opacity = 0.7 + Math.sin(time * 3) * 0.3;
      hintText.position.y = 15 + Math.sin(time * 2) * 0.5;
      hintText.lookAt(camera.position);
    }
  } else {
    hintIcon.visible = false;
    if (hintText) hintText.visible = false;
  }
}

// =====================================================================
// ---- HỆ HẠT: TINH VÂN TRÁI TIM → TÊN → "ANH YÊU EM" ----
// =====================================================================
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  ('ontouchstart' in window && Math.min(screen.width, screen.height) < 800);
const PN = IS_MOBILE ? 12000 : 20000;      // số hạt
const RIG_DIST = 70;                        // hệ toạ độ chữ tính như nhìn từ khoảng cách này
const RIG_SCALE = 1.45;                     // phóng chữ vào không gian thật quanh hành tinh
const SANS = '"Be Vietnam Pro","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const SCRIPT = '"Pacifico","Brush Script MT","Segoe Script","Lucida Handwriting",cursive';

const PAL = {
  name2:   ['#ffc4e1', '#ff9ccd', '#ffe0c0'],
  loveTop: ['#ff5c9d', '#ff8fc0', '#ffc2da'],
  loveBot: ['#fff4f8', '#ffd9e8', '#ffe6cc']
};
const HC = {
  core: [1, 0.82, 0.93], pink: [1, 0.34, 0.62], magenta: [1, 0.4, 0.95],
  violet: [0.78, 0.55, 1], cyan: [0.4, 0.95, 1], white: [1, 0.92, 0.97], gold: [1, 0.86, 0.62]
};

const hexToRgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = x => Math.min(1, Math.max(0, x));
const randn = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
function gradientAt(stops, t) {
  const n = stops.length - 1;
  const f = Math.min(0.9999, clamp01(t)) * n;
  const i = Math.floor(f);
  return mix3(stops[i], stops[i + 1], f - i);
}
function splitBalanced(text) {
  const words = text.split(' ');
  if (words.length < 2) return [text];
  let best = [text], bestScore = 1e9;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const sc = Math.max(a.length, b.length);
    if (sc < bestScore) { bestScore = sc; best = [a, b]; }
  }
  return best;
}

// ---- Rig bám theo camera: chữ luôn nằm trước mặt, nền thiên hà xoay phía sau ----
const rig = new THREE.Group();
const swing = new THREE.Group();
rig.add(swing);
scene.add(rig);

// ---- Geometry + shader hạt (GPU lo chuyển hình) ----
const randArr = new Float32Array(PN * 4);
for (let i = 0; i < randArr.length; i++) randArr[i] = Math.random();

const pGeo = new THREE.BufferGeometry();
const attrFrom = new THREE.BufferAttribute(new Float32Array(PN * 3), 3);
const attrTo = new THREE.BufferAttribute(new Float32Array(PN * 3), 3);
const attrColFrom = new THREE.BufferAttribute(new Float32Array(PN * 3), 3);
const attrColTo = new THREE.BufferAttribute(new Float32Array(PN * 3), 3);
[attrFrom, attrTo, attrColFrom, attrColTo].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('position', attrFrom);
pGeo.setAttribute('aTo', attrTo);
pGeo.setAttribute('aColFrom', attrColFrom);
pGeo.setAttribute('aColTo', attrColTo);
pGeo.setAttribute('aRand', new THREE.BufferAttribute(randArr, 4));

const pMat = new THREE.ShaderMaterial({
  uniforms: {
    uMix: { value: 1 }, uTime: { value: 0 }, uScale: { value: 600 },
    uSizeFrom: { value: 0.6 }, uSizeTo: { value: 0.6 },
    uBeat: { value: 0 }, uTextBeat: { value: 0 },
    uHeartFrom: { value: 0 }, uHeartTo: { value: 0 },
    uAlpha: { value: 0 }
  },
  vertexShader: `
    attribute vec3 aTo;
    attribute vec3 aColFrom;
    attribute vec3 aColTo;
    attribute vec4 aRand;
    uniform float uMix, uTime, uScale, uSizeFrom, uSizeTo, uBeat, uTextBeat, uHeartFrom, uHeartTo;
    varying vec3 vColor;

    mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

    void main() {
      float delay = aRand.x * 0.42;
      float e = clamp((uMix - delay) / 0.58, 0.0, 1.0);
      e = e * e * e * (e * (e * 6.0 - 15.0) + 10.0);

      vec3 p = mix(position, aTo, e);

      // xoáy tròn + lệch chiều sâu trong lúc bay
      float arc = sin(3.14159265 * e);
      p.xy = rot(arc * (aRand.y - 0.5) * 5.0) * p.xy;
      p.z += arc * (aRand.z - 0.5) * 40.0;

      float hw = mix(uHeartFrom, uHeartTo, e);
      float tw = 1.0 - hw;

      // trái tim: xoay nhẹ + đập
      float yaw = sin(uTime * 0.55) * 0.5 * hw;
      p.xz = rot(yaw) * p.xz;
      p *= 1.0 + uBeat * 0.08 * hw;

      // chữ: gợn sóng chiều sâu + thở

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;

      float twinkle = 1.0;
      float size = mix(uSizeFrom, uSizeTo, e);
      gl_PointSize = max(1.0, size * twinkle * uScale / -mv.z);
      vColor = mix(aColFrom, aColTo, e);
    }
  `,
  fragmentShader: `
    uniform float uAlpha;
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
      if (d > 1.0) discard;
      float core = 1.0 - d;
      float a = pow(core, 1.6);
      vec3 col = vColor * (0.9 + 1.3 * pow(core, 3.0)) + vec3(0.9) * pow(core, 7.0);
      gl_FragColor = vec4(col, a * uAlpha);
    }
  `,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(pGeo, pMat);
particles.frustumCulled = false;
particles.renderOrder = 1000;
particles.visible = false;
swing.add(particles);

const aura = createGlowSprite('rgba(255,80,150,0.9)', 256, 0);
aura.material.depthTest = false;
aura.renderOrder = 998;
aura.position.z = -8;
swing.add(aura);

// ---- Mưa trái tim nhỏ cho màn cuối ----
const RAIN_COUNT = 70;
const rainPos = new Float32Array(RAIN_COUNT * 3);
const rainBaseX = new Float32Array(RAIN_COUNT);
const rainSpeed = new Float32Array(RAIN_COUNT);
const rainPhase = new Float32Array(RAIN_COUNT);
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.PointsMaterial({
  size: 5, map: createHeartTexture(128), color: 0xffb0dc,
  transparent: true, opacity: 0, alphaTest: 0.05,
  depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
});
const rainPoints = new THREE.Points(rainGeo, rainMat);
rainPoints.frustumCulled = false;
rainPoints.renderOrder = 1001;
rainPoints.visible = false;
swing.add(rainPoints);

// ---- Bố cục theo kích thước màn hình ----
const layout = { v: 100, w: 180, portrait: false };
let builtAspect = 0;
function computeLayout() {
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  layout.v = 2 * RIG_DIST * Math.tan(fovRad / 2);
  layout.w = layout.v * camera.aspect;
  layout.portrait = camera.aspect < 1.15;
}
function updateScaleUniform() {
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  pMat.uniforms.uScale.value = (renderer.domElement.height * 0.5) / Math.tan(fovRad / 2) * RIG_SCALE * 1.2;
}
function resetRain() {
  const { v, w } = layout;
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainBaseX[i] = (Math.random() - 0.5) * w * 0.95;
    rainSpeed[i] = 5 + Math.random() * 7;
    rainPhase[i] = Math.random() * Math.PI * 2;
    rainPos[i * 3] = rainBaseX[i];
    rainPos[i * 3 + 1] = (Math.random() - 0.5) * (v + 12);
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

// ---- Dựng các "trạng thái" hình dạng của hạt ----
const states = {};

function buildCloudState() {
  const { v, w } = layout;
  const R = Math.max(v, w) * 0.62;
  const pos = new Float32Array(PN * 3), col = new Float32Array(PN * 3);
  const keys = [HC.pink, HC.magenta, HC.violet, HC.gold, HC.core, HC.pink];
  for (let i = 0; i < PN; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.75) * R;
    const tw = a + r * 0.045;
    pos[i * 3] = Math.cos(tw) * r;
    pos[i * 3 + 1] = Math.sin(tw) * r * 0.62;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 80 - 15;
    const c = keys[Math.floor(Math.random() * keys.length)];
    const b = 0.45 + Math.random() * 0.4;
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
  }
  return { pos, col, size: 0.55, heart: false };
}

function buildHeartState() {
  const { v, w } = layout;
  const s = Math.min(Math.min(v * 0.6, w * 0.7) / 29, (w * 0.86) / 32);
  const cy = 2.5 * s;
  const pos = new Float32Array(PN * 3), col = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) {
    const m = Math.random();
    const t = Math.random() * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    let r, kind;
    if (m < 0.58) { r = Math.sqrt(Math.random()); kind = 0; }        // phần ruột
    else if (m < 0.88) { r = 1 + randn() * 0.04; kind = 1; }          // viền sáng
    else { r = 1.06 + Math.random() * 0.5; kind = 2; }               // quầng tinh vân
    const jit = kind === 2 ? 1.6 : 0.5;
    const x = hx * r + randn() * jit;
    const y = hy * r + randn() * jit;
    const depth = (kind === 2 ? 5 : 3.2) * (1.1 - Math.min(r, 1) * 0.6);
    const z = randn() * depth;
    pos[i * 3] = x * s; pos[i * 3 + 1] = y * s + cy; pos[i * 3 + 2] = z * s;

    let c;
    if (kind === 0) {
      c = mix3(HC.core, HC.pink, clamp01(r * r));
      if (Math.random() < 0.25) c = mix3(c, HC.magenta, 0.6);
    } else if (kind === 1) {
      c = mix3(HC.magenta, HC.white, Math.random() * 0.6);
    } else {
      const q = Math.random();
      c = q < 0.15 ? HC.gold : (q < 0.25 ? HC.cyan : (q < 0.6 ? HC.violet : HC.magenta));
      c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
    }
    const b = 0.78 + Math.random() * 0.32;
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
  }
  const area = 0.75 * (32 * s) * (29 * s);
  const size = Math.min(1.1, Math.max(0.3, 1.5 * Math.sqrt(area / PN)));
  return { pos, col, size, heart: true };
}

// Vẽ chữ lên canvas rồi lấy mẫu điểm sáng
function rasterBlock(spec) {
  const BASE = 150;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const fontStr = `${spec.weight} ${BASE}px ${spec.family}`;
  ctx.font = fontStr;
  let maxW = 1;
  for (const t of spec.lines) maxW = Math.max(maxW, ctx.measureText(t).width);
  const lineH = BASE * 1.35, pad = BASE * 0.35;
  const W = Math.ceil(maxW + pad * 2);
  const H = Math.ceil(lineH * spec.lines.length + pad * 2);
  c.width = W; c.height = H;
  ctx.font = fontStr;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  ctx.lineWidth = BASE * (spec.thick || 0.02);
  spec.lines.forEach((t, i) => {
    const y = pad + lineH * (i + 0.5);
    ctx.strokeText(t, W / 2, y);
    ctx.fillText(t, W / 2, y);
  });
  const data = ctx.getImageData(0, 0, W, H).data;
  const step = 2;
  const xs = [], ys = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 140) { xs.push(x); ys.push(y); }
    }
  }
  const s = spec.widthUnits / maxW;
  return {
    xs, ys, W, H, pad, maxW, s, step, count: xs.length,
    area: xs.length * step * step * s * s * (spec.areaWeight || 1),
    spec, stops: spec.palette.map(hexToRgb)
  };
}

function buildTextState(blocks) {
  const rb = blocks.map(rasterBlock).filter(b => b.count > 0);
  const pos = new Float32Array(PN * 3), col = new Float32Array(PN * 3);
  if (rb.length === 0) return { pos, col, size: 0.5, heart: false };
  const totalArea = rb.reduce((a, b) => a + b.area, 0);
  let k = 0;
  rb.forEach((b, bi) => {
    let n = bi === rb.length - 1 ? PN - k : Math.round(PN * b.area / totalArea);
    n = Math.max(0, Math.min(n, PN - k));
    const cnt = b.count;
    const idx = new Uint32Array(cnt);
    for (let i = 0; i < cnt; i++) idx[i] = i;
    for (let i = 0; i < n; i++) {
      let j;
      if (n <= cnt) {
        const r = i + Math.floor(Math.random() * (cnt - i));
        const tmp = idx[i]; idx[i] = idx[r]; idx[r] = tmp;
        j = idx[i];
      } else {
        j = Math.floor(Math.random() * cnt);
      }
      const px = b.xs[j] + (Math.random() - 0.5) * b.step * 1.2;
      const py = b.ys[j] + (Math.random() - 0.5) * b.step * 1.2;
      pos[k * 3] = (px - b.W / 2) * b.s;
      pos[k * 3 + 1] = b.spec.cy - (py - b.H / 2) * b.s;
      pos[k * 3 + 2] = (Math.random() - 0.5) * 1.6;
      const u = clamp01((px - b.pad) / b.maxW + (Math.random() - 0.5) * 0.08);
      const c = Math.random() < 0.07 ? HC.gold : gradientAt(b.stops, u);
      const br = 0.85 + Math.random() * 0.3;
      col[k * 3] = c[0] * br; col[k * 3 + 1] = c[1] * br; col[k * 3 + 2] = c[2] * br;
      k++;
    }
  });
  for (let i = k; i < PN; i++) {           // phòng khi còn thiếu do làm tròn
    const src = Math.floor(Math.random() * Math.max(1, k));
    for (let d = 0; d < 3; d++) { pos[i * 3 + d] = pos[src * 3 + d]; col[i * 3 + d] = col[src * 3 + d]; }
  }
  const size = Math.min(1.1, Math.max(0.3, 1.9 * Math.sqrt(totalArea / PN)));
  return { pos, col, size, heart: false };
}

function buildStates() {
  computeLayout();
  builtAspect = camera.aspect;
  const { v, w, portrait } = layout;
  const T = CONFIG.texts;
  const lines = txt => (portrait ? splitBalanced(txt) : [txt]);

  states.cloud = buildCloudState();
  states.heart = buildHeartState();

  states.t2 = buildTextState([{
    lines: lines(T.name2), family: SCRIPT, weight: 400, thick: 0.03, palette: PAL.name2, cy: 0,
    widthUnits: portrait ? w * 0.8 : Math.min(w * 0.8, v * 1.7)
  }]);

  // Màn cuối: "Anh yêu em" ở trên, tên ở dưới, chừa khoảng giữa cho hành tinh
  states.t3 = buildTextState([
    {
      lines: [T.love], family: SCRIPT, weight: 400, thick: 0.035, palette: PAL.loveTop, areaWeight: 1.3,
      widthUnits: portrait ? w * 0.86 : Math.min(w * 0.5, v * 1.0),
      cy: (portrait ? 0.2 : 0.23) * v
    },
    {
      lines: lines(T.lover), family: SCRIPT, weight: 400, thick: 0.03, palette: PAL.loveBot,
      widthUnits: portrait ? w * 0.82 : Math.min(w * 0.72, v * 1.5),
      cy: -(portrait ? 0.2 : 0.21) * v
    }
  ]);
}

// ---- Máy trạng thái chuyển hình ----
let curState = 'cloud';
let tr = null;
let statesReady = false;
let lastT = performance.now() * 0.001;
let alphaTarget = 0, alphaCur = 0;
let textBeatTarget = 0;
let rainTarget = 0;
let bgDim = 1, bgDimTarget = 1;

function applyBuffers() {
  const fromName = tr ? tr.from : curState;
  const toName = tr ? tr.to : curState;
  const A = states[fromName], B = states[toName];
  if (!A || !B) return;
  attrFrom.array.set(A.pos); attrTo.array.set(B.pos);
  attrColFrom.array.set(A.col); attrColTo.array.set(B.col);
  attrFrom.needsUpdate = attrTo.needsUpdate = attrColFrom.needsUpdate = attrColTo.needsUpdate = true;
  const u = pMat.uniforms;
  u.uSizeFrom.value = A.size; u.uSizeTo.value = B.size;
  u.uHeartFrom.value = A.heart ? 1 : 0; u.uHeartTo.value = B.heart ? 1 : 0;
}

function transitionTo(name, dur, onDone) {
  tr = { from: curState, to: name, start: performance.now() * 0.001, dur, onDone };
  pMat.uniforms.uMix.value = 0;
  applyBuffers();
}

function heartbeat(t) {
  const ph = (t * 1.15) % 1;
  return Math.exp(-Math.pow((ph - 0.10) / 0.055, 2)) + 0.65 * Math.exp(-Math.pow((ph - 0.30) / 0.07, 2));
}

const _lookM = new THREE.Matrix4();
const _tq = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
let rigInit = false;
function updateParticleSystem(time) {
  const dt = Math.min(0.1, Math.max(0, time - lastT));
  lastT = time;
  const u = pMat.uniforms;
  u.uTime.value = time;
  u.uBeat.value = heartbeat(time);

  if (tr) {
    const m = Math.min(1, (time - tr.start) / tr.dur);
    u.uMix.value = m;
    if (m >= 1) {
      const done = tr.onDone;
      curState = tr.to;
      tr = null;
      applyBuffers();
      u.uMix.value = 1;
      if (done) done();
    }
  }

  alphaCur += (alphaTarget - alphaCur) * Math.min(1, dt * 2.2);
  u.uAlpha.value = alphaCur;
  u.uTextBeat.value += (textBeatTarget - u.uTextBeat.value) * Math.min(1, dt * 1.5);
  bgDim += (bgDimTarget - bgDim) * Math.min(1, dt * 1.2);
  aura.scale.set(Math.min(layout.w * 0.95, 190), Math.min(layout.v * 0.85, 125), 1);
  aura.material.opacity = alphaCur * (0.2 + 0.1 * u.uBeat.value);

  // Chữ đặt giữa không gian, quanh hành tinh. Chỉ xoay mặt dần về phía camera
  // (có độ trễ) nên khi camera lia/xoay sẽ thấy chiều sâu và thị sai thật.
  rig.position.set(0, 0, 0);
  rig.scale.setScalar(RIG_SCALE);
  _lookM.lookAt(camera.position, rig.position, _up);
  _tq.setFromRotationMatrix(_lookM);
  if (!rigInit) { rig.quaternion.copy(_tq); rigInit = true; }
  rig.quaternion.slerp(_tq, 1 - Math.exp(-dt * 0.35));
  swing.rotation.set(0, 0, 0);

  // Mưa trái tim
  rainMat.opacity += (rainTarget - rainMat.opacity) * Math.min(1, dt * 1.2);
  if (rainMat.opacity > 0.01) {
    const { v } = layout;
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPos[i * 3 + 1] += rainSpeed[i] * dt;
      rainPos[i * 3] = rainBaseX[i] + Math.sin(time * 0.8 + rainPhase[i]) * 2.2;
      if (rainPos[i * 3 + 1] > v / 2 + 6) {
        rainPos[i * 3 + 1] = -v / 2 - 6;
        rainBaseX[i] = (Math.random() - 0.5) * layout.w * 0.95;
      }
    }
    rainGeo.attributes.position.needsUpdate = true;
    rainPoints.visible = true;
  } else {
    rainPoints.visible = false;
  }
}

function onResizeParticles() {
  updateScaleUniform();
  computeLayout();
  if (!statesReady) return;
  if (Math.abs(camera.aspect - builtAspect) / Math.max(0.01, builtAspect) < 0.02) return;
  clearTimeout(onResizeParticles._t);
  onResizeParticles._t = setTimeout(() => { buildStates(); applyBuffers(); resetRain(); }, 250);
}

// ---- Camera điện ảnh: lia theo cung cầu, mượt ở đầu và cuối ----
const camTween = { active: false };
const _sph1 = new THREE.Spherical();
const _tmpV = new THREE.Vector3();
function flyCamera(x, y, z, dur) {
  const s0 = new THREE.Spherical().setFromVector3(camera.position);
  _sph1.setFromVector3(_tmpV.set(x, y, z));
  let dTheta = _sph1.theta - s0.theta;
  dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));   // đi đường ngắn nhất
  Object.assign(camTween, {
    active: true, start: performance.now() * 0.001, dur,
    r0: s0.radius, p0: s0.phi, t0: s0.theta,
    r1: _sph1.radius, p1: _sph1.phi, dTheta
  });
  controls.enabled = false;
}
function updateCameraTween(now) {
  if (!camTween.active) return;
  const t = Math.min(1, (now - camTween.start) / camTween.dur);
  const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
  const r = camTween.r0 + (camTween.r1 - camTween.r0) * e;
  const phi = camTween.p0 + (camTween.p1 - camTween.p0) * e;
  const theta = camTween.t0 + camTween.dTheta * e;
  camera.position.setFromSphericalCoords(r, phi, theta);
  camera.lookAt(0, 0, 0);
  if (t >= 1) {
    camTween.active = false;
    controls.target.set(0, 0, 0);
    controls.enabled = true;
  }
}
const POSE_A = [-62, 58, 118];   // hạ thấp, nhìn rõ các nhánh xoắn ốc
const POSE_B = [70, 80, 85];     // lia sang phải, gần hơn
const POSE_C = [-14, 40, 92];    // dolly vào, góc nghiêng đẹp cho màn cuối

// ---- Kịch bản: tinh vân tụ thành tim → tên → chạm → tên mới → chạm → lời yêu ----
const tapBtn = document.getElementById('tap-btn');
const seq = { started: false, t0: 0 };
const elapsedSinceTap = () => (performance.now() - (seq.t0 || performance.now())) / 1000;
let canTap = false, tapStage = '';
const later = (sec, fn) => setTimeout(fn, sec * 1000);

function armTap(stage) {
  tapStage = stage;
  canTap = true;
  tapBtn.classList.add('show');
}

function startNebulaSequence() {
  if (seq.started) return;
  seq.started = true;
  const go = () => {
    particles.visible = true;
    alphaTarget = 1;
    bgDimTarget = 0.72;
    rainTarget = 0.4;
    // 1) tinh vân tụ thành trái tim
    transitionTo('heart', 3.8, () => {
      later(Math.max(0.4, CONFIG.nameDelay - elapsedSinceTap()), () => {
        // 2) trái tim ghép thành "Nguyễn Nam"
        flyCamera(POSE_A[0], POSE_A[1], POSE_A[2], 9);
        transitionTo('t2', 4.6, () => later(CONFIG.holdAfterName2, gotoLove));
      });
    });
  };
  if (statesReady) go(); else fontsReady.then(go);
}

function gotoLove() {
  transitionTo('heart', 2.2, () => later(0.8, () => {
    flyCamera(POSE_C[0], POSE_C[1], POSE_C[2], 11);
    transitionTo('t3', 5, () => {
      textBeatTarget = 0;         // chữ đứng yên, không rung
      rainTarget = 0.95;          // mưa trái tim dày hơn
      later(3, () => letterIcon.classList.add('show'));   // hiện thư trước, đọc xong mới tới điều ước
    });
  }));
}

function onTap() {
  if (!canTap) return;
  canTap = false;
  tapBtn.classList.remove('show');
  if (tapStage === 't2') gotoLove();
}

let downInfo = null;
window.addEventListener('pointerdown', e => {
  downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
});
window.addEventListener('pointerup', e => {
  if (!downInfo) return;
  const dx = e.clientX - downInfo.x, dy = e.clientY - downInfo.y;
  const dt = performance.now() - downInfo.t;
  downInfo = null;
  if (dx * dx + dy * dy < 18 * 18 && dt < 700) onTap();   // chỉ tính là chạm, không phải kéo xoay
});

// Chờ font tải xong rồi mới dựng hình chữ (có giới hạn thời gian)
const fontsReady = (async () => {
  try {
    if (document.readyState !== 'complete') {
      await new Promise(r => window.addEventListener('load', r, { once: true }));
    }
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([
          document.fonts.load('400 100px "Pacifico"', 'Anh yêu em Nguyễn Trọng Nam Đặng Vinh Hoa')
        ]),
        new Promise(r => setTimeout(r, 4000))
      ]);
    }
  } catch (e) { /* dùng font dự phòng */ }
  buildStates();
  statesReady = true;
  resetRain();
})();
updateScaleUniform();
computeLayout();

// =====================================================================
// ---- SAO BĂNG ƯỚC NGUYỆN: VIẾT 1 LỜI CHÚC → BAY LÊN TRỜI ----
// =====================================================================
const wishBtn = document.getElementById('wish-btn');
const wishPanel = document.getElementById('wish-panel');
const wishInput = document.getElementById('wish-input');
const wishSend = document.getElementById('wish-send');
const wishClose = document.getElementById('wish-close');
let wishStars = [];

// =====================================================================
// ---- ẢNH BAY LÊN LIÊN TỤC (vòng lặp vô tận qua các ảnh) ----
// =====================================================================
const riseBox = document.getElementById('photo-rise');
let riseOn = false, riseBag = [], riseSide = 0, riseLast = null;
function nextRisePhoto(srcs) {
  if (!riseBag.length) {
    riseBag = srcs.slice().sort(() => Math.random() - 0.5);
    if (riseBag.length > 1 && riseBag[riseBag.length - 1] === riseLast) riseBag.reverse();
  }
  riseLast = riseBag.pop();
  return riseLast;
}
function spawnRiseCard(srcs, prog = 0) {
  const portrait = window.innerWidth / window.innerHeight < 1.15;
  const depth = Math.random();                         // 0 = xa, 1 = gần
  const wv = portrait ? 21 + depth * 7 : 11 + depth * 5;   // chiều rộng (vw)
  const hv = wv * 1.28;
  const rnd = (a, b) => a + Math.random() * (b - a);
  // hai làn trái / phải, chừa giữa màn hình cho chữ
  const leftLane = (riseSide++ % 2 === 0);
  const laneW = portrait ? 14 : 26;
  const x = leftLane ? rnd(1, laneW) : 100 - wv - rnd(1, laneW);

  const dur = 20 - depth * 8;                          // 12–20 giây mỗi lượt bay
  const card = document.createElement('div');
  card.className = 'pr-card';
  card.style.cssText = `left:${x}vw;width:${wv}vw;height:${hv}vw;` +
    `--dur:${dur.toFixed(1)}s;--sc:${(0.8 + depth * 0.32).toFixed(2)};` +
    `animation-delay:${(-prog * dur).toFixed(2)}s;` +
    `--op:${(0.72 + depth * 0.28).toFixed(2)};--sw:${rnd(-4, 4).toFixed(1)}vw;` +
    `--r0:${rnd(-9, 9).toFixed(1)}deg;--r1:${rnd(-9, 9).toFixed(1)}deg;--sd:${rnd(0, 3).toFixed(1)}s;` +
    `filter:blur(${((1 - depth) * 1.4).toFixed(1)}px) drop-shadow(0 0 16px rgba(255,105,180,.6));`;
  const img = new Image();
  img.src = nextRisePhoto(srcs);
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.alt = '';
  img.addEventListener('error', () => {            // ảnh không tải được → vẫn giữ khung đẹp để hiệu ứng không biến mất
    console.warn('Không tải được ảnh:', img.src);
    const fb = document.createElement('div');
    fb.className = 'pr-fallback'; fb.textContent = '♥';
    img.replaceWith(fb);
  });
  card.appendChild(img);
  card.addEventListener('animationend', e => { if (e.animationName === 'prRise') card.remove(); });
  riseBox.appendChild(card);
}
function startPhotoRise() {
  if (riseOn) return;
  const srcs = heartImages.filter(Boolean);
  if (!srcs.length) return;
  riseOn = true;
  const tick = () => {
    if (!document.hidden && riseBox.childElementCount < 10) spawnRiseCard(srcs);
    setTimeout(tick, 1100 + Math.random() * 800);
  };
  for (let i = 0; i < 5; i++) spawnRiseCard(srcs, 0.12 + i * 0.16);   // lấp đầy màn hình ngay từ đầu
  setTimeout(tick, 1200);
}

// =====================================================================
// ---- THƯ ĐIỆN ẢNH: bấm biểu tượng → phong bì bay lên → mở → thư hiện từng chữ ----
// =====================================================================
const letterIcon = document.getElementById('letter-icon');
const lStage = document.getElementById('letter-stage');
const lEnv = document.getElementById('env');
const lPaper = document.getElementById('letter-paper');
const lFx = document.getElementById('letter-fx');
let letterOpen = false, letterToken = 0, letterSkip = false;
let letterDone = false, wishDone = false;
// Thứ tự: thư xong → điều ước xong → mới đến ảnh
function maybeRevealPhotos(delay = 0) {
  if (photosRevealed || !letterDone || !wishDone || letterOpen) return;
  photosRevealed = true;
  setTimeout(() => { photoRevealTarget = 1; startPhotoRise(); }, delay);
}
let lWords = [], lDoneBtn = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildLetterDOM() {
  lPaper.innerHTML = '';
  lWords = [];
  const title = document.createElement('div');
  title.className = 'lt-title'; title.textContent = CONFIG.letter.title;
  const orn = document.createElement('div');
  orn.className = 'lt-orn'; orn.textContent = '✦ ♡ ✦';
  lPaper.append(title, orn);
  CONFIG.letter.text.split('\n').forEach(line => {
    if (!line.trim()) { const g = document.createElement('div'); g.className = 'lt-gap'; lPaper.append(g); return; }
    const d = document.createElement('div');
    d.className = line.trim().startsWith('—') ? 'lt-sign' : 'lt-p';
    line.trim().split(/\s+/).forEach((w, i, arr) => {
      const sp = document.createElement('span');
      sp.className = 'lt-w'; sp.textContent = w;
      d.append(sp);
      if (i < arr.length - 1) d.append(document.createTextNode(' '));
      lWords.push(sp);
    });
    lPaper.append(d);
  });
  lDoneBtn = document.createElement('button');
  lDoneBtn.id = 'letter-done'; lDoneBtn.type = 'button'; lDoneBtn.textContent = 'Đóng thư ♡';
  lDoneBtn.addEventListener('click', closeLetter);
  lPaper.append(lDoneBtn);
}

// ---- Hạt trái tim / bụi sao bay lên phía sau thư ----
let fxRAF = 0;
function startLetterFx() {
  const ctx = lFx.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = lFx.width = Math.round(window.innerWidth * dpr);
  const H = lFx.height = Math.round(window.innerHeight * dpr);
  const parts = Array.from({ length: 46 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: (8 + Math.random() * 18) * dpr, v: (0.25 + Math.random() * 0.7) * dpr,
    ph: Math.random() * 6.28, heart: Math.random() < 0.55,
    c: ['255,143,200', '255,214,235', '224,179,255', '255,217,160'][Math.floor(Math.random() * 4)]
  }));
  cancelAnimationFrame(fxRAF);
  const loop = t => {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y -= p.v; p.x += Math.sin(t * 0.001 + p.ph) * 0.4 * dpr;
      if (p.y < -30) { p.y = H + 30; p.x = Math.random() * W; }
      const edge = Math.min(1, p.y / (H * 0.2), (H - p.y) / (H * 0.1));
      ctx.globalAlpha = Math.max(0, edge) * (p.heart ? 0.55 : 0.8) * (0.7 + 0.3 * Math.sin(t * 0.003 + p.ph));
      ctx.shadowColor = `rgba(${p.c},1)`; ctx.shadowBlur = p.s * 0.9;
      ctx.fillStyle = `rgba(${p.c},1)`;
      if (p.heart) { ctx.font = `${p.s}px serif`; ctx.textAlign = 'center'; ctx.fillText('♥', p.x, p.y); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.14, 0, 6.283); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    fxRAF = requestAnimationFrame(loop);
  };
  fxRAF = requestAnimationFrame(loop);
}

async function revealLetter(tok) {
  for (const w of lWords) {
    if (tok !== letterToken) return;
    if (letterSkip) break;
    w.classList.add('in');
    const r = w.getBoundingClientRect(), pr = lPaper.getBoundingClientRect();
    if (r.bottom > pr.bottom - 40) lPaper.scrollTo({ top: lPaper.scrollTop + 60, behavior: 'smooth' });
    const end = w.textContent.slice(-1);
    await sleep(/[.!?]/.test(end) ? 520 : /[,;:—]/.test(end) ? 300 : 130);
  }
  if (tok !== letterToken) return;
  lWords.forEach(w => w.classList.add('in'));
  await sleep(900);
  if (tok === letterToken) lDoneBtn.classList.add('in');
}

async function openLetter() {
  if (letterOpen) return;
  letterOpen = true; letterSkip = false;
  const tok = ++letterToken;
  letterIcon.classList.remove('show');
  wishBtn.classList.remove('show');
  wishPanel.classList.remove('open');
  wishInput.blur();
  buildLetterDOM();
  lEnv.className = ''; lPaper.classList.remove('show'); lPaper.scrollTop = 0;
  lStage.classList.add('on');
  startLetterFx();
  bgDimTarget = 0.3;                 // thiên hà phía sau tối dần
  controls.autoRotateSpeed = 1.4;    // camera lướt chậm phía sau
  await sleep(1000); if (tok !== letterToken) return;
  lEnv.classList.add('rise');        // phong bì bay lên giữa màn hình
  await sleep(2100); if (tok !== letterToken) return;
  lEnv.classList.add('open');        // nắp mở, thư trượt ra
  await sleep(550); if (tok !== letterToken) return;
  lEnv.classList.add('flap-back');
  await sleep(1900); if (tok !== letterToken) return;
  lEnv.classList.add('away');        // phong bì lùi xuống, tờ thư phóng to ra giữa
  lPaper.classList.add('show');
  await sleep(1700); if (tok !== letterToken) return;
  revealLetter(tok);                 // chữ hiện dần như đang viết
}

function closeLetter() {
  if (!letterOpen) return;
  letterOpen = false;
  letterToken++;
  letterDone = true;                // đã đọc thư → chờ gửi điều ước xong mới tới ảnh
  maybeRevealPhotos(900);
  lPaper.classList.remove('show');
  lStage.classList.remove('on');
  bgDimTarget = 0.72;
  controls.autoRotateSpeed = 0.5;
  setTimeout(() => {
    cancelAnimationFrame(fxRAF);
    lEnv.className = '';
    letterIcon.classList.add('show');
    wishBtn.classList.add('show');
  }, 1000);
}

letterIcon.addEventListener('click', openLetter);
document.getElementById('letter-x').addEventListener('click', closeLetter);
lPaper.addEventListener('click', () => { if (!letterSkip && lWords.length) { letterSkip = true; } });

const wishGlowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

function showWishBtn() {
  if (letterOpen) return;
  wishBtn.classList.add('show');
}
wishBtn.addEventListener('click', () => {
  wishBtn.classList.remove('show');
  wishPanel.classList.add('open');
  setTimeout(() => wishInput.focus(), 60);
});
wishClose.addEventListener('click', () => {
  wishPanel.classList.remove('open');
  wishInput.blur();
  wishBtn.classList.add('show');
});
wishSend.addEventListener('click', () => {
  const text = wishInput.value.replace(/\s+/g, ' ').trim();
  if (!text) { wishInput.focus(); return; }
  launchWish(text);
});

// Vẽ lời chúc thành nhãn chữ phát sáng
function makeWishLabel(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.font = `400 64px ${SCRIPT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > 900 && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 4);
  const lh = 84;
  const y0 = 256 - ((shown.length - 1) * lh) / 2;
  ctx.shadowColor = '#ff8fc8';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffe6f2';
  shown.forEach((l, i) => ctx.fillText(l, 512, y0 + i * lh));
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  shown.forEach((l, i) => ctx.fillText(l, 512, y0 + i * lh));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const MAX_STARS = 120;
const HALO_COLORS = [0xff8fc8, 0xffd9a0, 0xc9a6ff, 0xff8fc8];

// Tạo một ngôi sao ước nguyện (có hoặc không có lời chúc)
function makeStar(o) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const mkGlow = (color, opacity) => new THREE.Sprite(new THREE.SpriteMaterial({
    map: wishGlowTex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false
  }));
  const small = !!o.small;
  const dim = small ? 0.5 : 1;                    // sao phụ mờ hơn sao chính
  const head = mkGlow(0xffffff, small ? 0.7 : 1);
  const halo = mkGlow(o.haloColor || 0xff8fc8, small ? 0.28 : 0.7);
  head.renderOrder = 1003;
  halo.renderOrder = 1002;
  group.add(halo);
  group.add(head);

  const N = small ? 26 : 90;                       // đuôi sao phụ ngắn
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    size: (small ? 2.2 : 3.4) * o.size, map: wishGlowTex, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, sizeAttenuation: true
  }));
  trail.frustumCulled = false;
  trail.renderOrder = 1001;
  group.add(trail);

  let label = null;
  if (o.text) {
    label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeWishLabel(o.text), transparent: true, opacity: 0, depthTest: false, depthWrite: false
    }));
    label.scale.set(46, 23, 1);
    label.renderOrder = 1004;
    group.add(label);
  }

  const star = {
    curve: o.curve, group, head, halo, trail, trailGeo, label, N,
    right: o.right, up: o.up, size: o.size, small, dim,
    start: performance.now() * 0.001, delay: o.delay || 0, dur: o.dur,
    phase: Math.random() * 6.28, labelGone: !label, trailDone: false
  };
  wishStars.push(star);
  while (wishStars.length > MAX_STARS) disposeStar(wishStars.shift());
  return star;
}

function disposeStar(w) {
  scene.remove(w.group);
  w.trailGeo.dispose();
  w.trail.material.dispose();
  w.head.material.dispose();
  w.halo.material.dispose();
  if (w.label && !w.labelGone) { w.label.material.map.dispose(); w.label.material.dispose(); }
}

async function launchWish(text) {
  wishPanel.classList.remove('open');
  wishBtn.classList.remove('show');
  wishInput.blur();
  wishInput.value = '';

  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        document.fonts.load('400 64px "Pacifico"', text),
        new Promise(r => setTimeout(r, 1500))
      ]);
    }
  } catch (e) { /* dùng font dự phòng */ }

  // Dựng hệ trục theo góc nhìn hiện tại để sao bay "lên trời" đúng hướng màn hình
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const cam = camera.position.clone();
  const at = (f, u, r) => cam.clone().addScaledVector(fwd, f).addScaledVector(up, u).addScaledVector(right, r);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Ngôi sao mang lời chúc
  makeStar({
    curve: new THREE.CubicBezierCurve3(at(55, -36, -18), at(60, -5, -30), at(100, 20, 40), at(120, 68, 34)),
    text, right, up, delay: 0, dur: 7, size: 1
  });

  // Cả một đàn điều ước nhỏ bay lên theo
  const extra = 28;
  for (let i = 0; i < extra; i++) {
    const sx = rnd(-55, 55);
    makeStar({
      curve: new THREE.CubicBezierCurve3(
        at(rnd(50, 70), -38, sx * 0.6),
        at(60, rnd(-12, 0), sx + rnd(-20, 20)),
        at(90, rnd(10, 40), rnd(-50, 50)),
        at(rnd(100, 150), rnd(25, 85), rnd(-60, 60))
      ),
      right, up, small: true,
      delay: 0.6 + i * 0.2 + Math.random() * 0.35,
      dur: rnd(4.5, 8),
      size: rnd(0.22, 0.5),
      haloColor: HALO_COLORS[Math.floor(Math.random() * HALO_COLORS.length)]
    });
  }

  // Cho phép gửi thêm điều ước khác
  setTimeout(showWishBtn, 2500);
  setTimeout(() => { wishDone = true; maybeRevealPhotos(600); }, 9500);   // sao bay xong → ảnh xuất hiện
  setTimeout(() => { if (!letterOpen) letterIcon.classList.add('show'); }, 4800);   // sao bay xong → hiện biểu tượng thư
}

function updateWishStar(time) {
  for (const w of wishStars) updateOneStar(w, time);
}

function updateOneStar(w, time) {
  const age = time - w.start - w.delay;
  if (age < 0) { w.group.visible = false; return; }
  w.group.visible = true;

  const t = Math.min(1, age / w.dur);
  const p = Math.pow(t, 1.6);                         // bắt đầu chậm rồi tăng tốc như sao băng
  const pos = w.curve.getPoint(p);
  w.head.position.copy(pos);
  w.halo.position.copy(pos);

  const pulse = 1 + 0.15 * Math.sin(time * (t < 1 ? 9 : 2.5) + w.phase);
  w.head.scale.setScalar(8 * w.size * pulse);
  w.halo.scale.setScalar((w.small ? 14 : 26) * w.size * pulse);
  if (t >= 1) w.head.material.opacity = (0.8 + 0.2 * Math.sin(time * 2.2 + w.phase)) * (w.small ? 0.65 : 1);   // lấp lánh khi đã về chỗ

  // Đuôi sao: lấy mẫu dọc đường bay, ngắn dần khi sao đã về chỗ
  const rest = Math.max(0, age - w.dur);
  if (!w.trailDone) {
    const shrink = t < 1 ? 1 : Math.max(0, 1 - rest / 1.5);
    const posA = w.trailGeo.attributes.position.array;
    const colA = w.trailGeo.attributes.color.array;
    for (let i = 0; i < w.N; i++) {
      const q = Math.max(0, p - i * 0.0075 * shrink);
      const pt = w.curve.getPoint(q);
      posA[i * 3] = pt.x; posA[i * 3 + 1] = pt.y; posA[i * 3 + 2] = pt.z;
      const f = 1 - i / w.N;
      const k = f * f;
      const d = w.dim * k;
      colA[i * 3] = d;
      colA[i * 3 + 1] = d * (0.7 + 0.3 * f);
      colA[i * 3 + 2] = d * (0.85 + 0.15 * f);
    }
    w.trailGeo.attributes.position.needsUpdate = true;
    w.trailGeo.attributes.color.needsUpdate = true;
    if (rest > 1.5) { w.trail.visible = false; w.trailDone = true; }
  }

  // Lời chúc đi cùng sao, ở bên trái đường bay, mờ dần sau khi sao đã về chỗ
  if (!w.labelGone) {
    let op = Math.min(1, age / 0.8) * 0.95;
    const fadeStart = w.dur + 3;
    if (age > fadeStart) op *= Math.max(0, 1 - (age - fadeStart) / 2);
    w.label.material.opacity = op;
    w.label.position.copy(pos).addScaledVector(w.right, -27).addScaledVector(w.up, 2);
    if (age > fadeStart + 2) {
      w.labelGone = true;
      w.group.remove(w.label);
      w.label.material.map.dispose();
      w.label.material.dispose();
    }
  }
}

// =====================================================================
// ---- VÒNG LẶP ANIMATE ----
// =====================================================================
let frame = 0;

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now() * 0.001;
  frame++;

  animateHintIcon(time);
  updateCameraTween(time);
  controls.update();
  updateParticleSystem(time);
  updateWishStar(time);
  planetMaterial.uniforms.time.value = time * 0.5;

  // Độ sáng toàn cảnh: mờ (0.1) trước khi bấm, sáng dần (tới 1) sau khi bấm
  if (introStarted && fadeOpacity < 1) {
    fadeOpacity = Math.min(1, fadeOpacity + 0.025);
  }
  galaxyMaterial.uniforms.uOpacity.value = fadeOpacity * bgDim;
  for (const n of nebulae) n.material.opacity = fadeOpacity * 0.6 * bgDim;
  for (const obj of heartObjects) {
    obj.userData.materialNear.opacity = fadeOpacity;
    obj.userData.materialFar.opacity = fadeOpacity;
  }

  // Hạt thiên hà "nở" thành ảnh sau khi đọc xong thư
  photoReveal += (photoRevealTarget - photoReveal) * 0.022;
  if (photoReveal > 0.001 || photoRevealTarget > 0) {
    const pe = photoReveal * photoReveal * (3 - 2 * photoReveal);
    for (const g of photoGroups) {
      g.mat.opacity = pe * Math.min(1, fadeOpacity);
      g.mat.size = photoSize * (0.15 + 0.85 * pe);
      g.pts.visible = pe > 0.01;
    }
  }

  updateShootingStars(time);
  if (frame % 5 === 0) updateHeartLOD();

  planet.lookAt(camera.position);
  animatePlanetSystem(time);

  renderer.render(scene, camera);
}

// =====================================================================
// ---- SỰ KIỆN: CLICK, RESIZE, MOBILE ----
// =====================================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function requestFullScreen() {
  const elem = document.documentElement;
  try {
    const fn = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
    if (fn) {
      const p = fn.call(elem);
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { /* bỏ qua */ }
}

function startCameraAnimation(onNear) {
  let nearFired = false;
  const startPos = camera.position.clone();
  const midPos1 = { x: startPos.x, y: 0, z: startPos.z };
  const midPos2 = { x: startPos.x, y: 0, z: 160 };
  const endPos = { x: -40, y: 100, z: 100 };
  const d1 = 0.2, d2 = 0.55, d3 = 0.4;
  let progress = 0;

  controls.enabled = false;

  function step() {
    progress += 0.0025;
    if (!nearFired && progress > 0.8) {
      nearFired = true;
      if (onNear) onNear();
    }
    let p;
    if (progress < d1) {
      const t = progress / d1;
      p = {
        x: startPos.x + (midPos1.x - startPos.x) * t,
        y: startPos.y + (midPos1.y - startPos.y) * t,
        z: startPos.z + (midPos1.z - startPos.z) * t
      };
    } else if (progress < d1 + d2) {
      const t = (progress - d1) / d2;
      p = {
        x: midPos1.x + (midPos2.x - midPos1.x) * t,
        y: midPos1.y + (midPos2.y - midPos1.y) * t,
        z: midPos1.z + (midPos2.z - midPos1.z) * t
      };
    } else if (progress < d1 + d2 + d3) {
      const t = (progress - d1 - d2) / d3;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
      p = {
        x: midPos2.x + (endPos.x - midPos2.x) * e,
        y: midPos2.y + (endPos.y - midPos2.y) * e,
        z: midPos2.z + (endPos.z - midPos2.z) * e
      };
    } else {
      camera.position.set(endPos.x, endPos.y, endPos.z);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.enabled = true;
      controls.update();
      return;
    }
    camera.position.set(p.x, p.y, p.z);
    camera.lookAt(0, 0, 0);
    requestAnimationFrame(step);
  }
  step();
}

function onCanvasClick(event) {
  if (introStarted) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if (raycaster.intersectObject(planet).length > 0) {
    requestFullScreen();
    introStarted = true;
    seq.t0 = performance.now();
    document.body.classList.add('intro-started');
    playGalaxyAudio();
    startCameraAnimation(startNebulaSequence);
    starGeometry.setDrawRange(0, starCount);
  }
}
renderer.domElement.addEventListener('click', onCanvasClick);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  checkOrientation();
  onResizeParticles();
}

function checkOrientation() {
  const isMobilePortrait = window.innerHeight > window.innerWidth && 'ontouchstart' in window;
  document.body.classList.toggle('portrait-mode', isMobilePortrait);
}

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 300));
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('#letter-paper')) e.preventDefault(); }, { passive: false });
checkOrientation();

// =====================================================================
// ---- KHỞI ĐỘNG ----
// =====================================================================
createShootingStar();
createHintIcon();
createHintText();
animate();
