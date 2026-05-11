import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { newApp } from '../app';

function freshApp() {
   process.env['NODE_ENV'] = 'test';
   process.env['DB_PATH'] = ':memory:';
   return newApp().app;
}

test('health check', async () => {
   const res = await request(freshApp()).get('/health');
   assert.equal(res.status, 200);
   assert.deepEqual(res.body, { ok: true });
});

test('CRUD operations', async () => {
   const app = freshApp();

   const created = await request(app).post('/items').send({ name: 'first' }).expect(201);
   assert.equal(created.body.name, 'first');
   const id: number = created.body.id;

   const got = await request(app).get(`/items/${id}`).expect(200);
   assert.equal(got.body.id, id);

   const updated = await request(app)
      .put(`/items/${id}`)
      .send({ name: 'renamed' })
      .expect(200);
   assert.equal(updated.body.item.name, 'renamed');

   await request(app).delete(`/items/${id}`).expect(200);
   await request(app).get(`/items/${id}`).expect(404);
});

test('list with name filter and pagination', async () => {
   const app = freshApp();
   await request(app).post('/items').send({ name: 'apple pie' });
   await request(app).post('/items').send({ name: 'banana bread' });
   await request(app).post('/items').send({ name: 'old apple' });

   const all = await request(app).get('/items').expect(200);
   assert.equal(all.body.total, 3);

   const search = await request(app).get('/items?q=apple').expect(200);
   assert.equal(search.body.total, 2);

   const page = await request(app).get('/items?limit=1&page=2').expect(200);
   assert.equal(page.body.data.length, 1);
   assert.equal(page.body.total, 3);
   assert.equal(page.body.limit, 1);
   assert.equal(page.body.page, 2);
   assert.equal(page.body.totalPages, 3);
});

test('validation errors', async () => {
   const app = freshApp();

   const missingName = await request(app).post('/items').send({}).expect(400);
   assert.equal(missingName.body.error.code, 'ValidationError');

   await request(app).post('/items').send({ name: '' }).expect(400);

   // empty update body is rejected
   const c = await request(app).post('/items').send({ name: 'y' }).expect(201);
   await request(app).put(`/items/${c.body.id}`).send({}).expect(400);
});
