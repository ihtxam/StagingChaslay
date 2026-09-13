/**
 * Platform message history pagination — run: npx tsx backend/src/services/platform-message.paginate.test.ts
 */
import assert from 'node:assert/strict';
import { PlatformMessageService } from './platform-message.service';

const items = Array.from({ length: 45 }, (_, i) => ({ id: String(i + 1) }));

{
  const page = PlatformMessageService.paginateHistory(items, 0, 20);
  assert.equal(page.offset, 0);
  assert.equal(page.limit, 20);
  assert.equal(page.total, 45);
  assert.equal(page.messages.length, 20);
  assert.equal(page.messages[0]?.id, '1');
  assert.equal(page.hasMore, true);
}

{
  const page = PlatformMessageService.paginateHistory(items, 40, 20);
  assert.equal(page.messages.length, 5);
  assert.equal(page.messages[0]?.id, '41');
  assert.equal(page.hasMore, false);
}

{
  const page = PlatformMessageService.paginateHistory(items, -8, 999);
  assert.equal(page.offset, 0);
  assert.equal(page.limit, 50);
  assert.equal(page.messages.length, 45);
  assert.equal(page.hasMore, false);
}

{
  const page = PlatformMessageService.paginateHistory(items, '20', undefined);
  assert.equal(page.offset, 20);
  assert.equal(page.limit, 20);
  assert.equal(page.messages[0]?.id, '21');
}

console.log('platform-message.paginate.test.ts: ok');
