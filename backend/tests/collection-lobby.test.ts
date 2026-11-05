import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import router from '../src/api_routes/lobbyRoutes'
import { RestaurantCollection } from '../src/db_models/saved'
import { Lobby } from '../src/db_models/lobby'
import { Restaurant } from '../src/db_models/restaurant'
import { findCollectionRestaurants } from '../src/services/lobbyRestaurants'

test('collection lobby checks ownership and snapshots a nonempty collection', async () => {
  const originalFind = RestaurantCollection.findOne, originalCreate = Lobby.create
  const owner = '507f1f77bcf86cd799439011', cid = '507f1f77bcf86cd799439013'
  const collection = { name: 'Pizza night', placeIds: ['place1', 'place2'] }
  let created: any
  RestaurantCollection.findOne = ((q: any) => ({ lean: async () => q.userId === owner && q._id === cid ? collection : null })) as any
  Lobby.create = (async (data: any) => { created = data; return { ...data, _id: cid } }) as any
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { if (req.headers['x-user']) req.identity = { key: `user:${req.headers['x-user']}`, userId: String(req.headers['x-user']), username: 'Sam', email: 'sam@example.test' }; next() }); app.use(router); app.use((err: any, _req: any, res: any, _next: any) => res.status(err.status ?? 500).json({ message: err.message }))
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}`
  const body = { location: 'Erie, PA', dinnerAt: new Date(Date.now() + 86400000).toISOString(), collectionId: cid }
  const call = (user?: string) => fetch(`${base}/api/lobbies`, { method: 'POST', headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, body: JSON.stringify(body) })
  try {
    assert.equal((await call()).status, 401)
    assert.equal((await call('507f1f77bcf86cd799439012')).status, 404)
    collection.placeIds = []
    assert.equal((await call(owner)).status, 400)
    collection.placeIds = ['place1', 'place2']
    const response = await call(owner)
    assert.equal(response.status, 201)
    assert.deepEqual((await response.json()).lobby.collectionSource, { name: 'Pizza night', count: 2 })
    collection.placeIds.push('place3')
    assert.deepEqual(created.collectionSource.placeIds, ['place1', 'place2'])
  } finally { RestaurantCollection.findOne = originalFind; Lobby.create = originalCreate; await new Promise<void>(resolve => server.close(() => resolve())) }
})

test('collection selection uses cached saved IDs and omits discovery results', async () => {
  const originalFind = Restaurant.find
  Restaurant.find = (() => ({ select: () => ({ lean: async () => [{ placeId: 'place1', cachedPlace: { id: 'place1', displayName: { text: 'Pizza' }, cachedPhoto: false } }] }) })) as any
  try {
    const { restaurants } = await findCollectionRestaurants({ placeIds: ['place1', 'place1'] })
    assert.deepEqual(restaurants.map(place => place.id), ['place1'])
    assert.equal(restaurants[0].name, 'Pizza')
  } finally { Restaurant.find = originalFind }
})
