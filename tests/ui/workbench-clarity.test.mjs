import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
function component(path, customRequire = require) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { code } = transformSync(source, { loader: 'tsx', format: 'cjs' });
  const module = { exports: {} };
  new Function('exports', 'require', 'module', code)(module.exports, customRequire, module);
  return module.exports;
}
const { IssueHeaderCard } = component('../../resources/js/Components/workbench/IssueHeaderCard.tsx');
const { GuidedStepBar } = component('../../resources/js/Components/workbench/GuidedStepBar.tsx');
const { PrReviewCommentsTab } = component('../../resources/js/Components/repositories/PrReviewCommentsTab.tsx',
  (id) => id === '@inertiajs/react' ? { router: { post() {} } } : require(id));
const { AutoReviewPanel } = component('../../resources/js/Components/settings/AutoReviewPanel.tsx');
const render = (type, props) => renderToStaticMarkup(React.createElement(type, props));

const context = { title: 'An issue', body: 'A description', issueNumber: 1, issueUrl: 'https://github.com/owner/repo/issues/1',
  path: 'src/example.php', source: '<?php', sourceSha256: 'a'.repeat(64) };

test('a dedicated private test issue is not described as public or as a synthetic issue', () => {
  const html = render(IssueHeaderCard, { context, isOwnedFixture: true, isDedicatedTestRepo: true, detectedIssueMedia: [] });
  assert.match(html, /GitHub issue/);
  assert.doesNotMatch(html, /Public GitHub Issue|Example issue/);
  assert.match(html, /<summary[^>]*>View source file<\/summary>/);
});

test('issue attachments are not represented as being understood by Muse', () => {
  const html = render(IssueHeaderCard, { context, isOwnedFixture: false, isDedicatedTestRepo: false,
    detectedIssueMedia: [{ alt: 'Screenshot', url: 'https://example.com/image.png', isGif: false }] });
  assert.match(html, /Muse cannot read these attachments yet/);
});

test('progress does not show checks as done when a reported gate failed', () => {
  const report = { decision: 'VERIFIED', gates: { baselineReproduced: true, negativeControlCaught: true,
    candidatePassed: false, candidateStaticSafetyPassed: true, allowlistIntegrityIntact: true } };
  const html = render(GuidedStepBar, { context, suggestion: {}, verificationReport: report, hasPublishedPr: false });
  assert.match(html, /aria-current="step"[^>]*>.*Checks/);
});

test('draft comments remain visible and unsupported full review submission is labeled', () => {
  const props = { drafts: [{ id: '1', path: 'a.php', line: 4, side: 'RIGHT', comment: 'Please check this.' }],
    commentApprovals: {}, commentToPost: null, postingComment: false, clearDraftsProcessing: false,
    githubConnection: null, setCommentToPost() {}, setPostingComment() {}, handleClearAllDrafts() {} };
  const html = render(PrReviewCommentsTab, props);
  assert.match(html, /Please check this/);
  assert.match(html, /Posting it is not available/);
  assert.match(html, /Coming soon/);
  assert.doesNotMatch(html, /proofpatcher\[bot\]|Post comment<\/button>/);
  const approved = render(PrReviewCommentsTab, { ...props, commentApprovals: { 1: 'digest' }, githubConnection: { user: { login: 'owner' } } });
  assert.match(approved, /as @owner/);
  assert.match(approved, /Post comment/);
});

test('automatic reviews show the real worker state and only enable public repositories', () => {
  const repositories = [
    { fullName: 'owner/public', isPrivate: false },
    { fullName: 'owner/private', isPrivate: true },
  ];
  const props = { connected: true, repositories, pendingRepo: null, error: null, onToggle() {}, onRefresh() {},
    autoReview: { worker: { isLive: false, status: 'offline' }, settings: {}, publicOnly: true } };
  const html = render(AutoReviewPanel, props);
  assert.match(html, /Worker offline/);
  assert.match(html, /php artisan review:poll --daemon/);
  assert.match(html, /Automatic review for owner\/private[^>]*disabled/);
  assert.match(html, /not posted to GitHub automatically/);
  const running = render(AutoReviewPanel, { ...props, autoReview: {
    worker: { isLive: true, status: 'running' }, settings: { 'owner/public': { repository: 'owner/public', enabled: true } }, publicOnly: true,
  } });
  assert.match(running, /Worker running/);
  assert.match(running, /Automatic review for owner\/public[^>]*checked/);
  assert.doesNotMatch(running, /Start the local worker/);
});
