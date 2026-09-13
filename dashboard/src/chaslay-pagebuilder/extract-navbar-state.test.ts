/**
 * Navbar extract — run: npx tsx dashboard/src/chaslay-pagebuilder/extract-navbar-state.test.ts
 */
import assert from 'node:assert/strict';
import { extractNavbarEditorState } from './extract-navbar-state';
import { buildTemplateEditorState } from './data/templates/build-template-state';

const full = buildTemplateEditorState({
  navbar: { component: 'NavbarClassic', props: { buttonText: 'Order Now', buttonLink: '/menu' } },
});

const navbarOnly = extractNavbarEditorState(full);
assert.ok(navbarOnly, 'expected navbar document');
const parsed = JSON.parse(navbarOnly);
assert.ok(parsed.ROOT);
assert.equal(parsed.ROOT.props.minHeight, 0);
assert.equal(parsed.ROOT.nodes.length, 1);
const navId = parsed.ROOT.nodes[0];
assert.equal(parsed[navId].type.resolvedName, 'NavbarClassic');
assert.equal(extractNavbarEditorState('{}'), null);
assert.equal(extractNavbarEditorState('not-json'), null);

console.log('extract-navbar-state tests passed');
