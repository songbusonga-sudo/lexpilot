import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { visitorSession } from '../server/visitor.js';

test('production visitor cookie is secure, HttpOnly, strict and credentials stay out of responses', () => {
  let saved;
  const req = { get: () => '' };
  const res = { set: (key, value) => assert.equal(value, 'private, no-store'), cookie: (...args) => { saved = args; } };
  visitorSession(true)(req, res, () => {});
  assert.equal(saved[0], '__Host-qingdun_visitor');
  assert.equal(saved[2].secure, true);
  assert.equal(saved[2].httpOnly, true);
  assert.equal(saved[2].sameSite, 'strict');
  assert.equal(saved[2].path, '/');
  assert.notEqual(saved[1], req.visitorId);
});

test('two visitors cannot read, change, download or delete each other’s data; restore, reset and restart preserve ownership', { timeout: 45000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'qingdun-isolation-'));
  const port = 19000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}/api`;
  let child;
  const start = async () => {
    child = spawn(process.execPath, ['server/index.js'], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dir, PUBLIC_ORIGIN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server startup timeout: ' + logs)), 10000);
      child.stderr.on('data', data => { logs += data; });
      child.stdout.on('data', data => { logs += data; if (logs.includes('青盾 API')) { clearTimeout(timer); resolve(); } });
      child.once('exit', code => { clearTimeout(timer); reject(Error('Server exited: ' + code + logs)); });
    });
  };
  const stop = async () => { const running = child; child = null; if (running && running.exitCode === null && running.signalCode === null) { const ended = once(running, 'exit'); running.kill(); await ended; } };
  const visitor = () => {
    let cookie;
    return async (route, method = 'GET', body) => {
      const headers = {};
      if (cookie) headers.cookie = cookie;
      if (body) headers['Content-Type'] = 'application/json';
      const response = await fetch(base + route, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return response;
    };
  };
  try {
    await start();
    const a = visitor(), b = visitor();
    const first = await a('/session');
    assert.match(first.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(first.headers.get('set-cookie'), /SameSite=Strict/i);
    assert.equal(first.headers.get('cache-control'), 'private, no-store');
    await b('/session');
    assert.deepEqual(await (await a('/cases')).json(), []);
    // Legacy records remain on disk, but no new visitor can claim them.
    assert.equal((await a('/cases/demo-rental')).status, 404);
    const c = await (await a('/cases', 'POST', { title: '我的押金', scene: 'rental', stage: '已经发生问题', owner: 'forged' })).json();
    assert.ok(c.id);
    assert.equal((await (await a('/cases')).json()).length, 1);
    assert.deepEqual(await (await b('/cases')).json(), []);
    const demo = await (await a('/demos/rental', 'POST', {})).json();
    const material = demo.materials.find(m => m.file);
    for (const [route, method, body] of [
      [`/cases/${c.id}`, 'GET'], [`/cases/${c.id}`, 'PATCH', { title: '篡改' }], [`/cases/${c.id}`, 'DELETE'],
      [`/cases/${demo.id}/report`, 'GET'], [`/cases/${demo.id}/backup`, 'GET'],
      [`/cases/${demo.id}/materials/${material.id}/file`, 'GET'],
      [`/cases/${demo.id}/materials/${material.id}/ocr`, 'POST', {}],
      [`/cases/${demo.id}/materials/${material.id}`, 'DELETE'],
      [`/cases/${demo.id}/analysis`, 'POST', {}], [`/cases/${demo.id}/reset-demo`, 'POST', {}],
      [`/cases/${demo.id}/events`, 'POST', {}], [`/cases/${demo.id}/materials`, 'POST', {}],
    ]) assert.equal((await b(route, method, body)).status, 404, method + ' ' + route);
    assert.equal((await a(`/cases/${demo.id}/materials/${material.id}/file`)).status, 200);
    const backup = await (await a(`/cases/${demo.id}/backup`)).json();
    assert.ok(!JSON.stringify(backup).includes('visitorId'));
    const restored = await (await b('/restore', 'POST', backup)).json();
    assert.ok(restored.id);
    assert.equal((await a(`/cases/${restored.id}`)).status, 404);
    assert.equal((await b(`/cases/${restored.id}`)).status, 200);
    assert.equal((await a(`/cases/${demo.id}/reset-demo`, 'POST', {})).status, 200);
    assert.equal((await b(`/cases/${demo.id}`)).status, 404);
    const bDemo = await (await b('/demos/rental', 'POST', {})).json();
    assert.notEqual(bDemo.id, demo.id);
    await stop();
    await start();
    assert.equal((await a(`/cases/${c.id}`)).status, 200);
    assert.equal((await b(`/cases/${c.id}`)).status, 404);
    assert.equal((await b(`/cases/${restored.id}`)).status, 200);
    assert.equal((await a(`/cases/${c.id}`, 'DELETE')).status, 200);
    await stop();
    const db = new DatabaseSync(path.join(dir, 'qingdun.sqlite'));
    assert.ok(db.prepare('SELECT id FROM cases WHERE id=?').get('demo-rental'));
    assert.equal(db.prepare('SELECT case_id FROM case_owners WHERE case_id=?').get(c.id), undefined);
    db.close();
  } finally {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
