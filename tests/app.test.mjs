import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { resolveSafePath } from '../server.js';

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
  assert.equal(code.includes('requestFullscreen'), false, 'fullscreen toggle should be removed');
  assert.equal(code.includes('Masuk Layar Penuh'), false, 'fullscreen title should be removed');
  assert.equal(code.includes('Keluar Layar Penuh'), false, 'fullscreen exit title should be removed');
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
