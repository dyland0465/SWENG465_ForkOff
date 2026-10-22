const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const esbuild = require('esbuild');

// Load TypeScript without starting the server or connecting to a database.
require.extensions['.ts'] = (mod, file) => mod._compile(
  esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs', target: 'node22' }).code, file,
);
const app = require('./src/app.ts').default;
const { Lobby } = require('./src/models/lobby.ts');

test('lobby routes validate requests and persist targeted updates', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/lobbies/abc123`;
  const originalFind = Lobby.findOne;
  const originalUpdate = Lobby.findOneAndUpdate;
  const userId = '507f1f77bcf86cd799439011';
  const lobby = { _id: 'lobby-id', members: [{ _id: userId, username: 'Sam' }], guestMembers: [{ guestId: 'guest-1', displayName: 'Guest' }], filters: { maxDistance: 10, minimumRating: 4 } };
  let updateCall;
  Lobby.findOne = filter => {
    assert.deepEqual(filter, { lobbyCode: 'ABC123' });
    const result = Promise.resolve(lobby);
    result.populate = (_path, fields) => { assert.equal(fields, 'username'); return result; };
    return result;
  };
  Lobby.findOneAndUpdate = async (...args) => { updateCall = args; return lobby; };
  async function request(path, method = 'GET', body) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  try {
    assert.deepEqual((await request('/members')).body.guestMembers, lobby.guestMembers);
    assert.deepEqual((await request('/filters')).body.filters, lobby.filters);
    assert.equal((await request('', 'PATCH', { name: ' Dinner ' })).status, 200);
    assert.deepEqual(updateCall[1], { $set: { name: 'Dinner' } });
    assert.equal((await request('/filters', 'PATCH', { maxDistance: 20 })).status, 200);
    assert.deepEqual(updateCall[1], { $set: { 'filters.maxDistance': 20 } });
    assert.equal(updateCall[2].runValidators, true);
    for (const body of [{}, { maxDistance: 0 }, { minimumRating: 6 }, { openNow: 'true' }, { categories: [3] }, { priceLevels: ['$$$$'] }, { dinnerAt: 'invalid' }, { hostID: userId }]) {
      assert.equal((await request('/filters', 'PATCH', body)).status, 400);
    }
    for (const body of [{}, { name: ' ' }, { status: 'invalid' }, { hostID: userId }]) {
      assert.equal((await request('', 'PATCH', body)).status, 400);
    }
    assert.equal((await request('/leave', 'POST', { userId, guestId: 'guest-1' })).status, 400);
    assert.equal((await request('/leave', 'POST', { guestId: 'guest-1' })).status, 200);
    assert.deepEqual(updateCall[1], { $pull: { guestMembers: { guestId: 'guest-1' } } });
    assert.equal((await request('/leave', 'POST', { userId })).status, 200);
    assert.deepEqual(updateCall[1], { $pull: { members: userId } });
    lobby.hostID = { equals: id => id === userId };
    assert.equal((await request('/leave', 'POST', { userId })).status, 409);
    Lobby.findOne = () => { const result = Promise.resolve(null); result.populate = () => result; return result; };
    Lobby.findOneAndUpdate = async () => null;
    for (const path of ['/members', '/filters']) assert.equal((await request(path)).status, 404);
    assert.equal((await request('', 'PATCH', { status: 'playing' })).status, 404);
    assert.equal((await request('/filters', 'PATCH', { openNow: false })).status, 404);
    assert.equal((await request('/leave', 'POST', { guestId: 'missing' })).status, 404);
  } finally {
    Lobby.findOne = originalFind;
    Lobby.findOneAndUpdate = originalUpdate;
    await new Promise(resolve => server.close(resolve));
  }
});
