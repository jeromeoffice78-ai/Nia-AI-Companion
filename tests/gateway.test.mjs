import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const client=readFileSync('src/niaGateway.ts','utf8');
const screen=readFileSync('app/index.tsx','utf8');
test('gateway uses HTTPS or explicit loopback',()=>{
 assert.match(client,/https:/);
 assert.match(client,/localhost\|127/);
 assert.match(client,/normalizeGatewayUrl/);
});
test('gateway requests have authorization and timeout',()=>{
 assert.match(client,/Authorization:'Bearer '/);
 assert.match(client,/AbortController/);
 assert.match(client,/clearTimeout/);
});
test('gateway request matches FastAPI contract',()=>{
 for(const field of ['messages:messages.slice(-40)','mode,flirty','result.answer','result.model'])assert.ok(client.includes(field),field);
});
test('Nia preserves direct provider fallback and stores gateway token securely',()=>{
 assert.match(screen,/if\(useGateway\)/);
 assert.match(screen,/chatWithGateway/);
 assert.match(screen,/SecureStore.setItemAsync\('nia_gateway_token'/);
 assert.match(screen,/fetch\(endpoint/);
});
