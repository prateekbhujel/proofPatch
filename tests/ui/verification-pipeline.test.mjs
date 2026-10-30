import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../../resources/js/Components/ui/VerificationPipeline.tsx', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'tsx', format: 'cjs' });
const module = { exports: {} };
new Function('exports', 'require', 'module', code)(module.exports, require, module);
const { VerificationPipeline } = module.exports;

const gates = Array.from({ length: 5 }, (_, index) => ({
  label: `Check ${index + 1}`,
  shortLabel: `Check ${index + 1}`,
  detail: 'Reported result',
  passed: true,
}));
const render = (props) => renderToStaticMarkup(React.createElement(VerificationPipeline, props));

test('a local fixture result does not claim production, model, or sandbox verification', () => {
  const html = render({ isRunning: false, decision: 'VERIFIED', gates, isSimulated: true });
  assert.match(html, /Fixture checks passed/);
  assert.match(html, /isolated sandbox was not verified/);
  assert.doesNotMatch(html, /github\.com|Muse|PROD CANDIDATE|Verified Co--Maintainer|5.Gate Verification: PASSED/i);
});

test('a non-simulated result remains scoped to the fixture', () => {
  const html = render({ isRunning: false, decision: 'VERIFIED', gates, isSimulated: false });
  assert.match(html, /These results apply to the known fixture/);
  assert.doesNotMatch(html, /production|github\.com|Muse/i);
});

test('a verified decision with missing or failing gates is not shown as passed', () => {
  for (const reportedGates of [null, gates.slice(0, 4), [{ ...gates[0], passed: false }, ...gates.slice(1)]]) {
    const html = render({ isRunning: false, decision: 'VERIFIED', gates: reportedGates, isSimulated: false });
    assert.match(html, /Results need review/);
    assert.doesNotMatch(html, /Fixture checks passed/);
  }
});

test('a running check does not present a previous result as current', () => {
  const html = render({ isRunning: true, decision: 'VERIFIED', gates, isSimulated: false });
  assert.match(html, /Running checks/);
  assert.doesNotMatch(html, /Fixture checks passed|Check results/);
});
