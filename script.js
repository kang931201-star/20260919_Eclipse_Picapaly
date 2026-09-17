// 이클립스 x 피카플레이 이벤트 페이지
// 현재 인터랙션(QR 팝업 토글, 스텝 슬라이드)은 순수 CSS(체크박스 토글 + scroll-snap)로 동작하므로
// 별도 JS 로직은 필요 없습니다. 아래는 편의 기능만 추가합니다.

document.addEventListener('DOMContentLoaded', () => {
  // Esc 키로 QR 팝업 닫기
  const qrToggle = document.getElementById('qrToggle');
  if (qrToggle) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && qrToggle.checked) {
        qrToggle.checked = false;
      }
    });
  }

  // 마우스를 따라다니는 골드 글리터 커서
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!prefersReducedMotion && canHover) {
    let lastSpawn = 0;
    document.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if (now - lastSpawn < 35) return;
      lastSpawn = now;

      const particle = document.createElement('span');
      particle.className = 'glitter-particle';
      const size = 4 + Math.random() * 5;
      const offsetX = (Math.random() - 0.5) * 16;
      const offsetY = (Math.random() - 0.5) * 16;
      const drift = (Math.random() - 0.5) * 40;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${e.clientX + offsetX}px`;
      particle.style.top = `${e.clientY + offsetY}px`;
      particle.style.setProperty('--drift', `${drift}px`);
      document.body.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove());
    });
  }
});

// ============================================================================
// Ember Particle System — 헤더 배경 위 오버레이 (Canvas 2D, 외부 라이브러리 없음)
// 어두운 판타지 RPG 이벤트 페이지풍의 "선명한 코어 + 은은한 외곽 glow" 불씨.
// 아래 EMBER_CONFIG 값만 바꾸면 개수/속도/밝기/글로우/반짝임을 조절할 수 있습니다.
// ============================================================================
const EMBER_CONFIG = {
  count: 200,                // 데스크톱 기준 동시에 보이는 입자 수
  speed: 0.22,                // 전체 이동 속도 배율 (매우 느리게)
  baseOpacity: 0.45,           // 전체 밝기 배율
  brightParticleRatio: 0.18,   // 밝은 코어+glow로 그려지는 입자 비율
  foregroundRatio: 0.16,       // 전경(크고 밝은) 레이어 비율
  glowStrength: 0.65,          // 밝은 입자 외곽 glow 강도
  twinkleStrength: 0.35,       // 밝기가 오르내리는 트윙클 폭
  drift: 0.3,                  // 좌우 흔들림 / 공기 흐름 정도
  mobileBreakpoint: 640,       // 이 폭(px) 이하는 모바일로 간주
  mobileDensityScale: 0.55,    // 모바일에서 적용되는 개수 배율
  clusterCount: 7,             // 밀도를 고르지 않게 만드는 클러스터(밀집 구역) 수
  clusterSpread: 0.22,         // 클러스터 반경 (캔버스 크기 대비 비율)
  colors: ['#C97820', '#E9A12A', '#FFC54D', '#FFE08A'],       // 일반 입자 코어 색 (주황 → 골드)
  brightCoreColors: ['#FFF7D1', '#FFE69A', '#FFD05A'],        // 밝은 입자의 거의 흰색에 가까운 코어
  brightGlowColor: '255, 160, 30',                            // 밝은 입자 외곽 glow(rgb) — 중심보다 어두운 주황
};

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('emberCanvas');
  if (!canvas || !canvas.getContext) return;

  // 접근성: 모션 최소화 사용자는 그리지 않음 (기존 디자인/배경에 영향 없음)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;

  let width = 0;
  let height = 0;
  let embers = [];
  let clusters = [];
  let lastTime = performance.now();

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  // 0 부근으로 몰리는 삼각형 분포 난수 (클러스터 안쪽에 더 자주 배치되도록)
  const triRand = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  // a→b로 회전할 때 -π~π 범위의 최단 각도차 (359도→1도처럼 반대로 도는 것 방지)
  const angleDiff = (a, b) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  // 완전한 원(circle) 대신 쓰는 4가지 불씨 실루엣 — 비율: flame 35% / shard 25% / spark 25% / irregular 15%
  function pickShapeType() {
    const r = Math.random();
    if (r < 0.35) return 'emberFlame';
    if (r < 0.6) return 'emberShard';
    if (r < 0.85) return 'taperedSpark';
    return 'irregularEmber';
  }

  function makeClusters() {
    clusters = Array.from({ length: EMBER_CONFIG.clusterCount }, () => ({
      x: rand(0, width),
      y: rand(0, height),
      r: Math.max(width, height) * EMBER_CONFIG.clusterSpread * rand(0.6, 1.3),
    }));
  }

  // 균등 분포 대신 클러스터 주변에 몰아서 배치 → 밀집/여백이 자연스럽게 생김
  function samplePosition() {
    if (!clusters.length) return { x: rand(0, width), y: rand(0, height) };
    const c = pick(clusters);
    return {
      x: Math.min(width, Math.max(0, c.x + triRand() * c.r)),
      y: Math.min(height, Math.max(0, c.y + triRand() * c.r)),
    };
  }

  // 3단계 깊이: background(작고 어두움/느림) · middle(기본) · foreground(적은 수, 크고 밝음)
  function pickTier() {
    if (Math.random() < EMBER_CONFIG.foregroundRatio) {
      return { tier: 'fg', sizeMin: 1.8, sizeMax: 3.2, alphaMin: 0.85, alphaMax: 1, speedMul: 1.3 };
    }
    if (Math.random() < 0.45) {
      return { tier: 'bg', sizeMin: 0.8, sizeMax: 1.3, alphaMin: 0.15, alphaMax: 0.35, speedMul: 0.55 };
    }
    return { tier: 'mid', sizeMin: 1.2, sizeMax: 2.2, alphaMin: 0.4, alphaMax: 0.75, speedMul: 1 };
  }

  function makeEmber() {
    const t = pickTier();
    // 전경 입자이거나 랜덤 확률에 걸리면 "선명한 코어 + glow"로 렌더링되는 밝은 입자
    const isBright = t.tier === 'fg' || Math.random() < EMBER_CONFIG.brightParticleRatio;
    const baseAlpha = isBright ? rand(0.85, 1) : rand(t.alphaMin, t.alphaMax);
    const pos = samplePosition();
    const life = rand(9, 20); // 초 단위 생애주기 (생성 → 소멸 → 재생성)
    const vx = rand(-3, 3) * t.speedMul;
    const vy = -rand(2, 7) * t.speedMul;

    return {
      tier: t.tier,
      isBright,
      shapeType: pickShapeType(),
      x: pos.x,
      y: pos.y,
      size: rand(t.sizeMin, t.sizeMax),
      baseAlpha,
      coreColor: isBright ? pick(EMBER_CONFIG.brightCoreColors) : pick(EMBER_CONFIG.colors),
      // 아주 느린 상승/대각선 이동 + 개별 방향
      vx,
      vy,
      swayFreq: rand(0.15, 0.45),
      swayPhase: rand(0, Math.PI * 2),
      twinkleFreq: (Math.PI * 2) / rand(1, 3), // 1~3초 주기로 밝기 변화
      twinklePhase: rand(0, Math.PI * 2),
      // 실루엣을 매번 다르게 만드는 랜덤 값들 (같은 모양이 반복되어 보이지 않도록)
      rotation: Math.atan2(vy, vx || 0.0001), // 초기 회전을 실제 속도 방향에 맞춰 시작 (첫 프레임 스냅 방지)
      angleOffset: rand(-0.12, 0.12),  // flame/shard가 이동 방향에서 아주 살짝만 벗어나는 편차 (±약 7도)
      rotationSpeed: rand(-0.5, 0.5),  // tiny irregular ember(자유 회전)에만 사용
      stretch: rand(0.9, 1.7),
      asymmetry: rand(-0.35, 0.35),
      shardPoints: (() => {
        const n = 3 + ((Math.random() * 3) | 0); // 3~5개 점
        return Array.from({ length: n }, () => ({
          a: rand(0, Math.PI * 2),
          r: rand(0.55, 1.15),
        })).sort((a, b) => a.a - b.a);
      })(),
      life,
      age: rand(0, life), // 페이지 로드 시 서로 다른 위상에서 시작 (동시에 반짝이지 않도록)
    };
  }

  function respawn(p) {
    const fresh = makeEmber();
    Object.assign(p, fresh);
    p.age = 0;
  }

  // 생애주기 안에서의 페이드 인/아웃 + 개별 위상의 트윙클(크기 변화 없이 밝기만 변화)
  function lifecycleAlpha(p, life01, t) {
    let envelope;
    if (life01 < 0.12) envelope = life01 / 0.12;               // 희미하게 생성 → 서서히 밝아짐
    else if (life01 > 0.85) envelope = (1 - life01) / 0.15;    // 서서히 fade out
    else envelope = 1;

    const twinkle = 1 + EMBER_CONFIG.twinkleStrength * Math.sin(t * p.twinkleFreq + p.twinklePhase);
    return Math.max(0, envelope * twinkle);
  }

  // ---- Core silhouettes: 완벽한 원(circle) 금지 — 작은 불씨 조각 4종 ----
  // 호출 시점에는 이미 ctx.translate(p.x,p.y) + ctx.rotate(p.rotation)까지 끝난 상태(로컬 좌표 0,0 기준, +x가 진행 방향)

  // 1) Ember Flame — 아래는 둥글고 위로 갈수록 좁아지며 한쪽으로 살짝 휘어지는 불씨 (Bezier)
  function drawEmberFlame(p, size) {
    const w = size * 0.75 * (1 + p.asymmetry * 0.4);
    const h = size * 1.8 * p.stretch;
    const k = p.asymmetry; // 좌우 비대칭을 주는 계수 (완벽 대칭 방지)
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.bezierCurveTo(-w * 0.6, h * 0.2, -w * 0.45, -h * 0.2, -w * 0.1 + k * w * 0.3, -h * 0.5);
    ctx.bezierCurveTo(w * (0.15 + k * 0.15), -h * (0.75 + k * 0.1), w * 0.35, -h * 0.25, w * 0.42, h * 0.05);
    ctx.bezierCurveTo(w * 0.45, h * 0.3, w * 0.25, h * 0.5, 0, h * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // 2) Ember Shard — 3~5개 점을 부드럽게(quadratic) 이어 만든 불규칙한 금빛 파편
  function drawEmberShard(p, size) {
    const pts = p.shardPoints;
    const n = pts.length;
    const rx = size * 0.95 * p.stretch;
    const ry = size * 0.75;
    const world = pts.map(({ a, r }) => [Math.cos(a) * r * rx, Math.sin(a) * r * ry]);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const cur = world[i];
      const next = world[(i + 1) % n];
      const mx = (cur[0] + next[0]) / 2;
      const my = (cur[1] + next[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(cur[0], cur[1], mx, my);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 3) Tapered Spark — 진행 방향으로 길게 늘어나 한쪽 끝이 뾰족해지는 짧은 혜성 조각
  function drawTaperedSpark(p, size) {
    const len = size * (2.4 + p.stretch);
    const w = size * 0.55;
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.quadraticCurveTo(-len * 0.1, -w * (0.5 + p.asymmetry * 0.3), len * 0.5, 0);
    ctx.quadraticCurveTo(-len * 0.1, w * (0.5 - p.asymmetry * 0.3), -len * 0.5, 0);
    ctx.closePath();
    ctx.fill();
  }

  // 4) Tiny Irregular Ember — 가장 작은 입자용, 찌그러진 타원(circle 대체)
  function drawIrregularEmber(p, size) {
    const rx = Math.max(0.4, size * (0.75 + p.asymmetry * 0.35));
    const ry = Math.max(0.35, size * (0.5 - p.asymmetry * 0.2) * p.stretch * 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, p.asymmetry, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCoreShape(p, size) {
    switch (p.shapeType) {
      case 'emberShard': drawEmberShard(p, size); break;
      case 'taperedSpark': drawTaperedSpark(p, size); break;
      case 'irregularEmber': drawIrregularEmber(p, size); break;
      default: drawEmberFlame(p, size);
    }
  }

  function stepEmber(p, t, dt) {
    p.age += dt;
    if (p.age >= p.life) { respawn(p); return; }
    const life01 = p.age / p.life;

    // 공기 흐름을 타듯 방향이 아주 조금씩 변함(약한 turbulence) + 좌우 흔들림
    p.vx += (Math.random() - 0.5) * 0.06 * EMBER_CONFIG.drift;
    p.vx = Math.max(-4, Math.min(4, p.vx));
    const sway = Math.sin(p.age * p.swayFreq + p.swayPhase) * EMBER_CONFIG.drift;

    p.x += (p.vx + sway) * EMBER_CONFIG.speed * dt * 10;
    p.y += p.vy * EMBER_CONFIG.speed * dt * 10;

    if (p.x < -10) p.x = width + 10; else if (p.x > width + 10) p.x = -10;
    if (p.y < -10) { respawn(p); return; }

    const alpha = lifecycleAlpha(p, life01, t) * p.baseAlpha * EMBER_CONFIG.baseOpacity;
    if (alpha <= 0.01) return;

    // 실제 화면에서의 이동 벡터(sway 포함)를 기준으로 회전을 맞춘다 — 절대 랜덤 회전 X
    const effVx = p.vx + sway;
    const effVy = p.vy;
    const isTinyFree = p.shapeType === 'irregularEmber' && p.size < 2;

    if (isTinyFree) {
      // 1~2px짜리 아주 작은 ember는 방향성이 안 보이므로 자유롭게 회전해도 됨
      p.rotation += p.rotationSpeed * dt;
    } else {
      const movementAngle = Math.atan2(effVy, effVx || 0.0001);
      let targetRotation;
      if (p.shapeType === 'taperedSpark') {
        // drawTaperedSpark는 기본 방향이 +X축 → 이동 방향과 정확히 일치시킴 (오프셋 없음)
        targetRotation = movementAngle;
      } else if (p.shapeType === 'emberFlame') {
        // drawEmberFlame은 기본 방향이 -Y축(위쪽)이라 90도 보정 + 아주 작은 편차만 허용
        targetRotation = movementAngle + Math.PI / 2 + p.angleOffset;
      } else {
        // emberShard / 3px 이상 irregularEmber: 이동 방향 + 아주 미세한 편차
        targetRotation = movementAngle + p.angleOffset;
      }
      // 급격히 스냅되지 않도록 최단 각도차만큼 부드럽게 보간
      p.rotation += angleDiff(p.rotation, targetRotation) * 0.08;
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.isBright) {
      // A. Outer Glow — radialGradient로 부드럽게 퍼지는 은은한 빛 (blur 대신 그라디언트 사용)
      const glowR = p.size + rand(5, 10) * EMBER_CONFIG.glowStrength;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
      glow.addColorStop(0, `rgba(${EMBER_CONFIG.brightGlowColor}, ${(alpha * 0.4).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${EMBER_CONFIG.brightGlowColor}, 0)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      // B. Bright Core — 아주 선명한 중심점 (blur 없음), 이동 방향을 따라 회전
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = p.coreColor;
      ctx.shadowBlur = 0;
      ctx.rotate(p.rotation);
      drawCoreShape(p, p.size);
    } else {
      // 일반 입자: glow 없이 선명한 코어만 그린다
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = p.coreColor;
      ctx.shadowBlur = 0;
      ctx.rotate(p.rotation);
      drawCoreShape(p, p.size);
    }

    ctx.restore();
  }

  function targetCount() {
    const isMobile = width <= EMBER_CONFIG.mobileBreakpoint;
    return Math.round(EMBER_CONFIG.count * (isMobile ? EMBER_CONFIG.mobileDensityScale : 1));
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeClusters();
    embers = Array.from({ length: targetCount() }, makeEmber);
  }

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = now / 1000;

    ctx.clearRect(0, 0, width, height);
    // 밝은 입자가 실제로 발광하는 것처럼 겹쳐 밝아지도록 — 캔버스 레이어 안에서만 사용
    ctx.globalCompositeOperation = 'lighter';
    embers.forEach((p) => stepEmber(p, t, dt));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    requestAnimationFrame(frame);
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();
  lastTime = performance.now();
  requestAnimationFrame(frame);
});

// ============================================================================
// Hero Intro Sequence — 캐릭터 → 타이틀 → 서브카피 → CTA 순으로 겹치며 등장
// (ember particle 시스템/밝기/개수는 그대로 유지, 캔버스는 opacity만 별도로 페이드인)
// 실제 "숨김 상태" CSS와 전체 매커니즘은 style.css의 "Hero Intro Sequence" 섹션 참고.
// 여기서는 각 그룹의 등장 시점(delay)만 정의한다 — 순서를 바꾸려면 아래 delay 값만 조절하면 됨.
// ============================================================================
const INTRO_CONFIG = {
  bgDelay: 0,            // 배경(카메라 세틀링) 시작 시점 (ms)
  emberDelay: 150,       // ember 파티클 캔버스가 서서히 나타나기 시작하는 시점
  characterDelay: 150,   // 캐릭터가 아래에서 떠오르기 시작하는 시점
  titleDelay: 550,       // 타이틀 등장 시작 시점 — 캐릭터 애니메이션(1200ms)의 약 40~50% 지점
  subCopyDelay: 800,     // 서브카피(설명/기간) 등장 시작 시점
  ctaDelay: 1250,        // CTA 버튼 등장 시작 시점 — 전체 중 가장 마지막
  titleDuration: 900,    // 타이틀 transition 길이 — style.css의 .header__title transition과 반드시 일치시킬 것
};

document.addEventListener('DOMContentLoaded', () => {
  const html = document.documentElement;
  // 부트스트랩 인라인 스크립트가 intro-run을 안 붙였다면(모션 최소화 사용자 등) 아무것도 하지 않는다 —
  // 이미 최종 상태로 보이고 있으므로 그대로 둔다.
  if (!html.classList.contains('intro-run')) return;

  const setDelay = (selector, ms) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.transitionDelay = `${ms}ms`;
    });
  };

  setDelay('.header__bg, .header__glow', INTRO_CONFIG.bgDelay);
  setDelay('.header__embers', INTRO_CONFIG.emberDelay);
  setDelay('.header__character-stage', INTRO_CONFIG.characterDelay);
  setDelay('.header__lockup, .header__title', INTRO_CONFIG.titleDelay);
  setDelay('.header__sub, .header__period', INTRO_CONFIG.subCopyDelay);
  setDelay('.header__cta', INTRO_CONFIG.ctaDelay);

  // 한 프레임 건너뛰고 intro-run을 제거해야 transition이 걸린다.
  // (delay 지정과 클래스 제거를 같은 틱에서 하면 브라우저가 두 변화를 하나로 합쳐 애니메이션을 건너뛸 수 있음)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      html.classList.remove('intro-run');

      // 타이틀이 자리를 잡은 직후 한 번, 아주 약한 라이트 리빌(밝기 펄스)을 준다
      const title = document.querySelector('.header__title');
      if (title) {
        setTimeout(() => {
          title.classList.add('intro-flash');
          title.addEventListener('animationend', () => title.classList.remove('intro-flash'), { once: true });
        }, INTRO_CONFIG.titleDelay + INTRO_CONFIG.titleDuration);
      }
    });
  });
});

// ============================================================================
// Reward Coupon Reveal — 스크롤로 01·REWARD 섹션의 골드 쿠폰이 화면에 들어올 때 한 번 강조 등장
// (박스/캐릭터는 애니메이션 없이 항상 그대로 있고, 쿠폰만 스크롤 진입 시 페이드+슬라이드업 된다)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.querySelector('.reward-kv__coupon-wrap');
  if (!wrap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return; // 미지원 환경은 그냥 기본 상태로 보여줌(fallback)

  wrap.classList.add('reveal-pending');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      wrap.classList.remove('reveal-pending');
      io.unobserve(wrap);

      const onRevealEnd = () => {
        wrap.removeEventListener('transitionend', onRevealEnd);
        // 등장 완료 직전에 아주 작은 scale 강조만 (glow는 제거)
        wrap.classList.add('coupon-pop');
        setTimeout(() => wrap.classList.remove('coupon-pop'), 800);
      };
      wrap.addEventListener('transitionend', onRevealEnd);
    });
  }, { threshold: 0.3 });

  io.observe(wrap);
});

// ============================================================================
// Section Scroll Reveal — 02/03 섹션, FAQ, 유의사항 등 "하단 섹션"들을 스크롤로 만날 때
// 위 리워드 쿠폰과 같은 방식(페이드+슬라이드업)으로 한 번씩 등장시킨다.
// 대상은 HTML에 data-reveal 속성만 붙이면 되고, 여러 개를 순서대로 겹치고 싶으면
// data-reveal-delay="100" 처럼 ms 단위 추가 지연을 함께 준다 (예: STEP 카드, FAQ 항목).
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return; // 미지원 환경은 그냥 기본 상태로 보여줌(fallback)

  targets.forEach((el) => {
    el.classList.add('reveal-pending');
    const extraDelay = parseInt(el.dataset.revealDelay || '0', 10);
    if (extraDelay) el.style.transitionDelay = `${extraDelay}ms`;
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('reveal-pending');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  targets.forEach((el) => io.observe(el));
});

// ============================================================================
// Step Carousel Pagination — 모바일에서 스와이프로 넘어가는 STEP 카드에 맞춰
// 하단 점(dot) 표시를 실제로 동기화한다(기존에는 첫 번째 점에 active가 고정되어 있었음).
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const track = document.querySelector('.step-track');
  const dots = document.querySelectorAll('.step-pagination img');
  const cards = document.querySelectorAll('.step-card');
  if (!track || !dots.length || !cards.length) return;
  if (!('IntersectionObserver' in window)) return;

  const setActive = (index) => {
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
      const index = Array.from(cards).indexOf(entry.target);
      if (index !== -1) setActive(index);
    });
  }, { root: track, threshold: [0.6] });

  cards.forEach((card) => io.observe(card));
});
