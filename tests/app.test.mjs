import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { resolveSafePath } from '../server.js';
import { evaluateQuizQuestion } from '../quizScoring.mjs';
import {
  isMobileEnvironment,
  computeStageLayout,
  mapClientPointToStage,
  mapClientDeltaToStage,
  mapRectPointToCanvas,
  activateMobileFullscreenAndLandscape,
} from '../mobileLandscape.mjs';
import {
  PJ_DATA,
  HOTSPOTS_DATA,
  QUIZ_DATA,
  PROJECTS_DATA,
  SANGGAR_VALUES_STEP2,
} from '../culturalData.mjs';

const ROOT = process.cwd();
const BUNDLE_PATH = path.join(ROOT, 'assets', 'index-C0560NjH.js');
const HTML_PATH = path.join(ROOT, 'index.html');

test('server resolveSafePath blocks path traversal and resolves valid paths', () => {
  const rootFile = resolveSafePath('/', ROOT);
  assert.equal(rootFile, path.join(ROOT, 'index.html'));

  const assetFile = resolveSafePath('/assets/icons/lumi-icon.svg', ROOT);
  assert.equal(assetFile, path.join(ROOT, 'assets', 'icons', 'lumi-icon.svg'));

  const traversal = resolveSafePath('/../../etc/passwd', ROOT);
  assert.equal(traversal, null);
});

test('index.html has responsive viewport and no Fase C reference', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /fase\s*c/i);
});

test('bundle JS parses cleanly without syntax errors', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  assert.doesNotThrow(() => {
    new vm.Script(code);
  });
});

test('removed welcome buttons, home icon, fullscreen icon, and Fase C / Kelas text are absent', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  assert.equal(code.includes('icon_settings.png'), false, 'icon_settings.png should be removed');
  assert.equal(code.includes('icon_help.png'), false, 'icon_help.png should be removed');
  assert.equal(code.includes('Petunjuk & Informasi Pembelajaran'), false, 'help button should be removed');
  assert.equal(code.includes('Pengaturan Profil & Nama'), false, 'settings button should be removed');
  assert.equal(code.includes('EKPLORE 360° SENI RUPA FASE C'), false, 'old welcome badge should be replaced');
  assert.equal(code.includes('BUDAYA 360°'), true, 'new welcome badge BUDAYA 360° must exist');
  assert.equal(code.includes('Kembali ke Halaman Depan'), false, 'home button should be removed');
  assert.equal(code.includes('Masuk Layar Penuh'), false, 'manual fullscreen enter button should be removed');
  assert.equal(code.includes('Keluar Layar Penuh'), false, 'manual fullscreen exit button should be removed');
  assert.match(code, /BUDAYA 360°/);
  assert.equal(/fase\s*c/i.test(code), false, 'all Fase C text must be removed');
  assert.equal(/kelas/i.test(code), false, 'all Kelas text (including sekelas/kelasmu) must be removed');
});

test('all 6 islands are unlocked by default and lock messages are removed', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  assert.equal(code.includes('Terkunci (Selesaikan kuis dulu)'), false);
  assert.equal(code.includes('masih terkunci. Selesaikan pulau sebelumnya dulu ya!'), false);
  assert.equal(code.includes('masih terkunci. Selesaikan kuis dan tantangan pulau ini terlebih dahulu!'), false);
  assert.equal(
    code.includes('_n={batik:{unlocked:!0,completed:!1,hotspotsDiscovered:[],quizScore:0,artworkCreated:!1},wayang:{unlocked:!0,completed:!1,hotspotsDiscovered:[],quizScore:0,artworkCreated:!1},noken:{unlocked:!0,completed:!1,hotspotsDiscovered:[],quizScore:0,artworkCreated:!1},pinisi:{unlocked:!0,completed:!1,hotspotsDiscovered:[],quizScore:0,artworkCreated:!1},angklung:{unlocked:!0,completed:!1,hotspotsDiscovered:[],quizScore:0,artworkCreated:!1},sanggar:{unlocked:!0,completed:!1,hotspotsDiscovered:[],quizScore:0,artworkCreated:!1}}'),
    true,
    'all 6 zones in _n must have unlocked:!0'
  );
});

test('all referenced local assets exist on disk', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const matches = new Set(code.match(/\.\/assets\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|svg|mp3|webp|js|css)/g) || []);
  assert.ok(matches.size >= 10, 'expected local asset references');
  for (const rel of matches) {
    const cleanRel = rel.replace(/^\.\//, '');
    assert.equal(fs.existsSync(path.join(ROOT, cleanRel)), true, `Missing asset: ${cleanRel}`);
  }
});

test('all Seni Budaya text is replaced with Budaya Nusantara', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  assert.equal(/seni\s*budaya/i.test(code), false, 'all Seni Budaya occurrences must be removed');
  const matches = code.match(/budaya\s*nusantara/gi) || [];
  assert.ok(matches.length >= 6, 'expected Budaya Nusantara occurrences across UI and certificates');
});

test('Kembali ke Pulau Nusantara is replaced with Kembali ke depan pointing to welcome', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  assert.equal(code.includes('Kembali ke Pulau Nusantara'), false);
  const backFrontMatches = code.match(/Kembali ke depan/g) || [];
  assert.equal(backFrontMatches.length, 2, 'expected Kembali ke depan on island beacon and Sanggar page');
  assert.equal(code.includes('startNusantaraContinuousBgm(),o("welcome")'), true, 'nav-map beacon must route to welcome');
  assert.equal(code.includes('startNusantaraContinuousBgm(),e("welcome")'), true, 'Sanggar bottom button must route to welcome');
});

test('certificate profile defaults are empty and customizable without hardcoded student values', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  assert.equal(
    code.includes('PS={explorerName:"",schoolName:"",avatarIcon:"🧭",totalScore:0}'),
    true,
    'PS should default explorerName and schoolName to empty strings'
  );
  assert.equal(code.includes('SDN Nusantara'), false, 'hardcoded SDN Nusantara must be removed');
  assert.equal(code.includes('"Zaura"'), false, 'hardcoded student Zaura must be removed');
  assert.equal(code.includes('"Kak Sari"'), false, 'Kak Sari should be replaced with Kak Zaura');
  assert.equal(code.includes('Pemandu Ceria Nusantara'), false, 'Pemandu Ceria Nusantara subtext must be removed');
  assert.equal(code.includes('Pemandu Belajar'), false, 'Pemandu Belajar subtext must be removed');
  assert.equal(code.includes('Nama & Sekolah Sertifikat'), true);
  assert.equal(code.includes('Simpan & Lihat Sertifikat'), true);
});

test('island image enter animation is clean opacity fade-in without blur or desktop offset regression', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  assert.match(
    code,
    /@keyframes islandPhaseEntry \{\s*0% \{\s*opacity: 0;\s*\}\s*100% \{\s*opacity: 1;\s*\}\s*\}/
  );
  assert.equal(code.includes('filter: blur(2px)'), false);
});

test('Proyek Rupa Nusantara uses concise kid-friendly copy and accessible UI font sizes (>= 0.75rem)', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  for (const title of [
    'Wadah Gantung Tali Kertas',
    'Batik Cap Pelepah & Daun',
    'Wayang Karton Tokoh Cerita',
    'Miniatur Perahu Layar',
    'Tabung Nada Bambu & Karton',
    'Karya Budaya Daerahku',
  ]) {
    assert.equal(code.includes(title), true, `Missing concise project title: ${title}`);
  }
  const ojIdx = code.indexOf('oj=()=>{');
  assert.ok(ojIdx !== -1);
  const uiCode = code.slice(ojIdx);
  const smallUiFonts = [...uiCode.matchAll(/fontSize\s*:\s*"([0-9.]+rem)"/g)].filter(
    (m) => parseFloat(m[1]) < 0.75
  );
  assert.deepEqual(smallUiFonts, [], 'UI font sizes should be at least 0.75rem (12px)');
  const smallCssFonts = [...code.slice(0, 14000).matchAll(/font-size\s*:\s*([0-9.]+rem)/g)].filter(
    (m) => parseFloat(m[1]) < 0.75
  );
  assert.deepEqual(smallCssFonts, [], 'Mobile CSS font sizes should be at least 0.75rem (12px)');
});

test('top-left caption badge is removed across all pages and sound icon is hidden inside island', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const ypStart = code.indexOf('const yp=({currentScreen:e,title:t})');
  assert.ok(ypStart !== -1, 'yp should accept currentScreen and title');
  const ypBody = code.slice(ypStart, ypStart + 1200);
  assert.equal(ypBody.includes('if(e==="island")return null;'), true, 'sound icon must be hidden inside island');
  assert.equal(ypBody.includes('navbar-title-badge'), false, 'top-left navbar-title-badge must be removed');
  assert.equal(ypBody.includes('justifyContent:"flex-end"'), true, 'navbar should align only top-right control');
});

test('island HUD has no dialog/narration canvas, MLBB analog in bottom-left, Pulau + Zoom In + Zoom Out in bottom-right, smooth 360 auto-move, and scrollbar-free popups', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.equal(/seni\s*rupa/i.test(code), false, 'all Seni Rupa text in bundle must be replaced with Budaya Nusantara');
  assert.equal(/seni\s*rupa/i.test(html), false, 'all Seni Rupa text in index.html must be replaced with Budaya Nusantara');

  // 1. No narration card or reflection dialog inside u1
  const u1Idx = code.indexOf('u1=()=>{');
  const k1Idx = code.indexOf('k1=()=>{');
  const u1Body = code.slice(u1Idx, k1Idx);
  assert.equal(u1Body.includes('className:"voice-card-elem"'), false, 'voice-card-elem narration box must be removed from u1');
  assert.equal(u1Body.includes('Refleksi Budaya Daerah Sendiri'), false, 'reflection dialog box inside island drawing canvas must be removed');
  assert.equal(u1Body.includes('currentScreen:"island"'), false, 'sound icon component yp must not be rendered in u1');

  // 3. MLBB-style omnidirectional analog in bottom-left
  assert.equal(u1Body.includes('Analog Navigasi 360 MLBB: Geser ke segala arah'), true);
  assert.equal(u1Body.includes('className:"nav-analog-360",style:{position:"absolute",bottom:"24px",left:"24px"'), true);

  // 4. Bottom-right buttons: Pulau with icon, Zoom In icon, Zoom Out icon (no reset button)
  assert.equal(u1Body.includes('className:"nav-button-elem",style:{position:"absolute",bottom:"24px",right:"24px"'), true);
  assert.equal(u1Body.includes('children:"Pulau"'), true);
  assert.equal(u1Body.includes('"aria-label":"Zoom In"'), true);
  assert.equal(u1Body.includes('"aria-label":"Zoom Out"'), true);
  assert.equal(u1Body.includes('Kembalikan Pandangan Awal'), false, 'reset button removed from bottom-right');

  // 5. Smooth 360 auto-rotation
  assert.equal(u1Body.includes('else if(!It){tGt+=7.5*dt;dirty=!0}'), true, '360 panorama must auto-rotate smoothly when idle');

  // 6. Scrollbar-free popups that can still scroll vertically
  assert.equal(code.includes('.popup-scroll-clean::-webkit-scrollbar,[role="dialog"]::-webkit-scrollbar,[role="dialog"] *::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}'), true);
});

test('fair quiz scoring logic awards proportional points for drag-drop and multiple-choice while keeping true-false and single-choice exact', () => {
  // 1. true-false & single-choice (all-or-nothing)
  const tfQ = { type: 'true-false', points: 15, correctAnswer: 'Benar' };
  assert.equal(evaluateQuizQuestion(tfQ, { selectedSingle: 'Benar' }).earnedPoints, 15);
  assert.equal(evaluateQuizQuestion(tfQ, { selectedSingle: 'Salah' }).earnedPoints, 0);

  const scQ = { type: 'single-choice', points: 25, correctAnswer: 'Empat elips simetris memusat' };
  assert.equal(evaluateQuizQuestion(scQ, { selectedSingle: 'Empat elips simetris memusat' }).earnedPoints, 25);
  assert.equal(evaluateQuizQuestion(scQ, { selectedSingle: 'Lingkaran acak tanpa pola' }).earnedPoints, 0);

  // 2. drag-drop (menjodohkan: 3 pairs, 30 points -> 10 pts per correct match)
  const ddQ = {
    type: 'drag-drop',
    points: 30,
    matchPairs: [
      { id: 'm1', leftText: 'Canting', rightText: 'Pena penoreh lilin malam' },
      { id: 'm2', leftText: 'Mori', rightText: 'Kain putih dasar batik' },
      { id: 'm3', leftText: 'Kawung', rightText: 'Motif empat elips simetris' },
    ],
  };
  // Only 1 correct match -> 10 points
  const dd1 = evaluateQuizQuestion(ddQ, {
    matchedPairs: {
      m1: 'Pena penoreh lilin malam',
      m2: 'Motif empat elips simetris',
      m3: 'Kain putih dasar batik',
    },
  });
  assert.equal(dd1.earnedPoints, 10);
  assert.equal(dd1.isPartial, true);
  assert.equal(dd1.correctCount, 1);

  // 2 correct matches -> 20 points
  const dd2 = evaluateQuizQuestion(ddQ, {
    matchedPairs: {
      m1: 'Pena penoreh lilin malam',
      m2: 'Kain putih dasar batik',
    },
  });
  assert.equal(dd2.earnedPoints, 20);
  assert.equal(dd2.isPartial, true);

  // All 3 correct matches -> 30 points
  const dd3 = evaluateQuizQuestion(ddQ, {
    matchedPairs: {
      m1: 'Pena penoreh lilin malam',
      m2: 'Kain putih dasar batik',
      m3: 'Motif empat elips simetris',
    },
  });
  assert.equal(dd3.earnedPoints, 30);
  assert.equal(dd3.isFullCorrect, true);

  // 0 correct matches -> 0 points
  const dd0 = evaluateQuizQuestion(ddQ, {
    matchedPairs: {
      m1: 'Kain putih dasar batik',
      m2: 'Motif empat elips simetris',
      m3: 'Pena penoreh lilin malam',
    },
  });
  assert.equal(dd0.earnedPoints, 0);

  // 3. multiple-choice (2 required correct answers, 30 points -> 15 pts per correct answer)
  const mcQ = {
    type: 'multiple-choice',
    points: 30,
    correctAnswer: ['Canting tembaga', 'Wajan lilin malam'],
  };
  // 1 correct, 0 wrong -> 15 points
  assert.equal(evaluateQuizQuestion(mcQ, { selectedMulti: ['Canting tembaga'] }).earnedPoints, 15);
  // 1 correct, 1 wrong -> 15 points
  assert.equal(evaluateQuizQuestion(mcQ, { selectedMulti: ['Canting tembaga', 'Kuas lukis cat air'] }).earnedPoints, 15);
  // 2 correct, 0 wrong -> 30 points
  assert.equal(evaluateQuizQuestion(mcQ, { selectedMulti: ['Canting tembaga', 'Wajan lilin malam'] }).earnedPoints, 30);
  // Selecting all 4 options -> 0 points
  assert.equal(
    evaluateQuizQuestion(mcQ, {
      selectedMulti: ['Canting tembaga', 'Wajan lilin malam', 'Kuas lukis cat air', 'Mesin cetak pabrik'],
    }).earnedPoints,
    0
  );
});

test('mobile detection and auto-landscape stage layout work accurately for mobile vs desktop', () => {
  // Desktop 1440x900: never treated as mobile and never auto-rotated
  const desktopMobile = isMobileEnvironment({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    maxTouchPoints: 0,
    innerWidth: 1440,
    innerHeight: 900,
    hasCoarsePointer: false,
  });
  assert.equal(desktopMobile, false);
  assert.deepEqual(
    computeStageLayout({ innerWidth: 1440, innerHeight: 900, isMobile: desktopMobile }),
    {
      isMobile: false,
      isPortrait: false,
      autoRotateLandscape: false,
      isMobileLandscape: false,
      stageWidth: 1440,
      stageHeight: 900,
    }
  );

  // Mobile portrait 390x844: detected as mobile and auto-rotated to 844x390 landscape stage
  const phonePortrait = isMobileEnvironment({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
    maxTouchPoints: 5,
    innerWidth: 390,
    innerHeight: 844,
    hasCoarsePointer: true,
  });
  assert.equal(phonePortrait, true);
  assert.deepEqual(
    computeStageLayout({ innerWidth: 390, innerHeight: 844, isMobile: phonePortrait }),
    {
      isMobile: true,
      isPortrait: true,
      autoRotateLandscape: true,
      isMobileLandscape: false,
      stageWidth: 844,
      stageHeight: 390,
    }
  );

  // Mobile landscape 844x390 (or coarse touch viewport without mobile UA): stays unrotated landscape mobile
  const phoneLandscape = isMobileEnvironment({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    maxTouchPoints: 5,
    innerWidth: 844,
    innerHeight: 390,
    hasCoarsePointer: true,
  });
  assert.equal(phoneLandscape, true);
  assert.deepEqual(
    computeStageLayout({ innerWidth: 844, innerHeight: 390, isMobile: phoneLandscape }),
    {
      isMobile: true,
      isPortrait: false,
      autoRotateLandscape: false,
      isMobileLandscape: true,
      stageWidth: 844,
      stageHeight: 390,
    }
  );
});

test('rotated landscape pointer, analog delta, and drawing canvas coordinate mappings are exact', () => {
  // Portrait viewport 390x844 rotated 90deg clockwise into 844x390 stage
  // Top-left of landscape stage sits at physical (390, 0)
  assert.deepEqual(
    mapClientPointToStage(390, 0, { autoRotateLandscape: true, viewportWidth: 390 }),
    { x: 0, y: 0 }
  );
  // Bottom-right of landscape stage sits at physical (0, 844)
  assert.deepEqual(
    mapClientPointToStage(0, 844, { autoRotateLandscape: true, viewportWidth: 390 }),
    { x: 844, y: 390 }
  );

  // Analog delta: dragging physically DOWN (+dy) moves RIGHT (+dx) in rotated landscape;
  // dragging physically RIGHT (+dx) moves UP (-dy) in rotated landscape.
  assert.deepEqual(mapClientDeltaToStage(0, 30, { autoRotateLandscape: true }), { dx: 30, dy: -0 });
  assert.deepEqual(mapClientDeltaToStage(30, 0, { autoRotateLandscape: true }), { dx: 0, dy: -30 });

  // Rotated 16:9 canvas bounding rect (physical screen width=270, height=480)
  const rotatedRect = { left: 60, right: 330, top: 180, bottom: 660, width: 270, height: 480 };
  // Top-left of landscape canvas is physical (right=330, top=180)
  assert.deepEqual(
    mapRectPointToCanvas(330, 180, rotatedRect, 1280, 720, { autoRotateLandscape: true }),
    { x: 0, y: 0 }
  );
  // Center of landscape canvas
  assert.deepEqual(
    mapRectPointToCanvas(195, 420, rotatedRect, 1280, 720, { autoRotateLandscape: true }),
    { x: 640, y: 360 }
  );
});

test('activateMobileFullscreenAndLandscape handles browser rejections safely without throwing', async () => {
  let fsCalled = false;
  let lockCalled = false;
  const res = await activateMobileFullscreenAndLandscape({
    doc: {
      fullscreenElement: null,
      documentElement: {
        requestFullscreen: () => {
          fsCalled = true;
          return Promise.reject(new Error('NotAllowedError'));
        },
      },
    },
    win: {
      screen: {
        orientation: {
          lock: () => {
            lockCalled = true;
            return Promise.reject(new Error('NotSupportedError'));
          },
        },
      },
    },
  });
  assert.equal(fsCalled, true);
  assert.equal(lockCalled, true);
  assert.equal(res.fullscreenAttempted, true);
  assert.equal(res.orientationAttempted, true);
});

test('bundle implements #landscape-stage auto-rotation, mobile fullscreen gesture hook, and --app-w/--app-h layout', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(html, /mobile-web-app-capable/);
  assert.match(html, /index-C0560NjH\.js\?v=8/);
  assert.equal(code.includes('id:"landscape-stage"'), true, 'root must render #landscape-stage');
  assert.equal(code.includes('requestFullscreen'), true, 'auto mobile fullscreen hook must be present');
  assert.equal(code.includes('orientation.lock("landscape")'), true, 'auto landscape lock must be present');
  assert.equal(code.includes('--app-w'), true, 'stage CSS custom properties must be used');
  assert.equal(code.includes('__stageAutoLandscape'), true, 'rotated coordinate mapping flag must exist');
});

test('culturalData and bundle contain credible UNESCO heritage facts, interactive hotspot challenges, and 100% Budaya Nusantara quizzes', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const zones = ['batik', 'wayang', 'noken', 'pinisi', 'angklung'];
  assert.equal(PJ_DATA.length, 5);
  assert.equal(SANGGAR_VALUES_STEP2.length, 5);
  assert.equal(PROJECTS_DATA.length, 6);

  // Check credible UNESCO dates across the 5 islands
  for (const unescoDate of [
    '2 Oktober 2009',
    '7 November 2003',
    '4 Desember 2012',
    '7 Desember 2017',
    '16 November 2010',
  ]) {
    assert.equal(code.includes(unescoDate), true, `Bundle must include credible UNESCO date: ${unescoDate}`);
  }

  for (const z of zones) {
    const hsList = HOTSPOTS_DATA[z];
    assert.equal(hsList.length, 3, `Zone ${z} must have 3 hotspots`);
    for (const hs of hsList) {
      assert.ok(hs.shortDesc.length > 40);
      assert.ok(hs.culturalMeaning.length > 30);
      assert.ok(hs.interactiveQuestion.length > 20);
      assert.equal(Array.isArray(hs.interactiveOptions), true);
      assert.equal(hs.interactiveOptions.length, 2);
      assert.equal(hs.interactiveAnswer, 0);
      assert.ok(hs.interactiveFeedback.length > 30);
    }

    const qz = QUIZ_DATA[z];
    assert.ok(qz, `Quiz for ${z} must exist`);
    const totalPts = qz.questions.reduce((acc, q) => acc + q.points, 0);
    assert.equal(totalPts, 100, `Quiz for ${z} must sum to 100 points`);
  }

  const sanggarPts = QUIZ_DATA.sanggar.questions.reduce((acc, q) => acc + q.points, 0);
  assert.equal(sanggarPts, 100, 'Sanggar quiz must sum to 100 points');
  assert.equal(code.includes('Tantangan Interaktif Sahabat Budaya'), true);
  assert.equal(code.includes('Khazanah & Wawasan Budaya Nusantara'), true);
  assert.equal(code.includes('Nilai luhur budaya Nusantara mana yang paling menginspirasimu?'), true);
});

test('island 360 engine uses 60fps direct DOM translate3d marker projection and exponential smoothing without React setState thrashing', () => {
  const code = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const u1Idx = code.indexOf('u1=()=>{');
  const k1Idx = code.indexOf('k1=()=>{');
  const u1Body = code.slice(u1Idx, k1Idx);

  assert.equal(u1Body.includes('1-Math.exp(-16*dt)'), true, 'must use frame-rate-independent exponential smoothing');
  assert.equal(u1Body.includes('new us(500,60,40)'), true, 'must use smooth 60x40 sphere geometry');
  assert.equal(u1Body.includes('mkRef.current'), true, 'must project 3D markers directly via mkRef DOM nodes');
  assert.equal(u1Body.includes('syncKnob'), true, 'must update MLBB analog knob directly via DOM ref without setState');
  assert.equal(u1Body.includes('now-lastSync>42'), false, 'old 23fps throttled React setState loop must be removed');
});
