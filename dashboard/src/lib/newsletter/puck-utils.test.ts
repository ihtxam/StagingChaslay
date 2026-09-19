/**
 * Newsletter Puck data helpers — run: npx tsx dashboard/src/lib/newsletter/puck-utils.test.ts
 */
import assert from 'node:assert/strict';
import { buildPuckNewsletterEmailHtml } from './puck-email-html';
import {
  defaultNewsletterPuckData,
  isSparseNewsletterPuckData,
  newsletterCopyFromT,
  newsletterPuckDataOrDefault,
  normalizePuckData,
} from './puck-utils';

{
  const normalized = normalizePuckData({
    content: [{ type: 'Heading', props: { text: 'Hi' } }],
  });
  const heading = normalized.content[0];
  assert.equal(heading.type, 'Heading');
  assert.equal(typeof heading.props.id, 'string');
  assert.ok(String(heading.props.id).length > 0);
  assert.equal(heading.props.text, 'Hi');
  assert.equal(heading.props.level, 'h1');
}

{
  const normalized = normalizePuckData({
    content: [
      { type: 'Heading', props: { text: 'Keep', level: 'h2' } },
      { type: 'NotABlock', props: { foo: 1 } },
      { type: 'Button', props: { label: 'Go', color: 'red' } },
    ],
  });
  assert.equal(normalized.content.length, 2);
  assert.equal(normalized.content[0].type, 'Heading');
  assert.equal(normalized.content[1].type, 'Button');
  assert.equal(normalized.content[1].props.color, '#0f766e');
  assert.equal(normalized.content[1].props.url, '{{shopUrl}}');
}

{
  const data = defaultNewsletterPuckData();
  const types = data.content.map((b) => b.type);
  assert.ok(types.includes('Heading'));
  assert.ok(types.includes('Text'));
  assert.ok(types.includes('Button'));
  assert.ok(types.includes('Spacer'));
  assert.ok(data.content.length >= 8);
  assert.ok(data.content.every((b) => typeof b.props.id === 'string' && b.props.id));
  const texts = data.content.map((b) => String(b.props.text || b.props.content || b.props.label || ''));
  assert.ok(texts.some((s) => s.includes('{{businessName}}')));
  assert.ok(texts.some((s) => s.includes('{{name}}')));
  assert.ok(texts.some((s) => /unsubscribe/i.test(s)));
  const cta = data.content.find((b) => b.type === 'Button');
  assert.equal(cta?.props.url, '{{shopUrl}}');
  assert.equal(isSparseNewsletterPuckData(data), false);
}

{
  const sparse = normalizePuckData({
    content: [
      { type: 'Heading', props: { text: 'Newsletter', level: 'h1' } },
      { type: 'Text', props: { content: '<p>Share news</p>' } },
      { type: 'Button', props: { label: 'Order online', url: '{{shopUrl}}', color: '#0f766e' } },
    ],
  });
  assert.equal(isSparseNewsletterPuckData(sparse), true);
  const upgraded = newsletterPuckDataOrDefault(sparse);
  assert.equal(isSparseNewsletterPuckData(upgraded), false);
  assert.ok(upgraded.content.length > 3);
}

{
  const custom = normalizePuckData({
    content: [
      { type: 'Heading', props: { text: 'Spring menu', level: 'h1' } },
      { type: 'Text', props: { content: '<p>Custom</p>' } },
      { type: 'Button', props: { label: 'Book', url: '{{shopUrl}}', color: '#0f766e' } },
    ],
  });
  assert.equal(isSparseNewsletterPuckData(custom), false);
  assert.equal(newsletterPuckDataOrDefault(custom).content[0].props.text, 'Spring menu');
}

{
  const html = buildPuckNewsletterEmailHtml(defaultNewsletterPuckData(), 'Test campaign');
  assert.match(html, /Hello \{\{name\}\}/);
  assert.match(html, /Order online/);
  assert.match(html, /unsubscribe/i);
  assert.match(html, /href="\{\{shopUrl\}\}"/);
  assert.match(html, /© \d{4} \{\{businessName\}\}/);
}

{
  const copy = newsletterCopyFromT((key) => {
    if (key === 'newsletterPuckHeaderTitle') return 'Café Test';
    if (key === 'newsletterPuckCta') return 'Commander';
    return key;
  });
  const data = defaultNewsletterPuckData(copy);
  assert.equal(data.content[0].props.text, 'Café Test');
  const cta = data.content.find((b) => b.type === 'Button');
  assert.equal(cta?.props.label, 'Commander');
}

console.log('puck-utils.test.ts ok');
