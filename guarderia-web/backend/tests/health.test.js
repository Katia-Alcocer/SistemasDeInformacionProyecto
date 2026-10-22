import {test} from 'vitest';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.js';
async function request(database,check) {
  const server=createApp(database,{secret:'test-only-secret-not-for-deployment-123456',secure:false,origin:'http://localhost:5173'}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try {await check(`http://127.0.0.1:${server.address().port}`);}
  finally {await new Promise(resolve=>server.close(resolve));}
}
test('health consulta la conexión',async()=>{
  let called=false;
  await request({query:async sql=>{assert.equal(sql,'SELECT 1');called=true;}},async url=>{
    const response=await fetch(`${url}/api/v1/health`);
    assert.equal(response.status,200);
    assert.equal((await response.json()).data.database,'connected');
  });
  assert.equal(called,true);
});
test('fallo SQL responde 503 sin filtrar secretos',async()=>{
  await request({query:async()=>{throw new Error('secreto');}},async url=>{
    const response=await fetch(`${url}/api/v1/health`);
    assert.equal(response.status,503);
    assert.equal((await response.text()).includes('secreto'),false);
  });
});
