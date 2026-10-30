import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);

function loadTsxModule(relativePath, customRequire = require) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { code } = transformSync(source, { loader: 'tsx', format: 'cjs' });
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', code)(mod.exports, customRequire, mod);
  return { exports: mod.exports, source };
}

const inertiaMock = {
  Link: ({ children, href, ...rest }) => React.createElement('a', { href, ...rest }, children),
  Head: ({ title }) => React.createElement('head', {}, React.createElement('title', {}, title)),
  usePage: () => ({
    url: '/issues',
    props: {
      notifications: [],
      githubConnection: {
        isConnected: false,
        user: null,
      },
    },
  }),
  useForm: (initial) => ({
    data: initial,
    setData: () => {},
    post: () => {},
    processing: false,
    reset: () => {},
  }),
  router: {
    post: () => {},
  },
};

const framerMotionMock = {
  motion: {
    div: ({ children, ...rest }) => React.createElement('div', rest, children),
  },
  AnimatePresence: ({ children }) => React.createElement(React.Fragment, {}, children),
};

const { exports: pfLogoModule } = loadTsxModule('../../resources/js/Components/ui/PfLogo.tsx');
const { exports: themeModule } = loadTsxModule('../../resources/js/Components/ThemeToggle.tsx');

const { exports: appLayoutModule } = loadTsxModule(
  '../../resources/js/Components/AppLayout.tsx',
  (id) => {
    if (id === '@inertiajs/react') return inertiaMock;
    if (id === 'framer-motion') return framerMotionMock;
    if (id === './ThemeToggle') return themeModule;
    if (id === './ui/PfLogo') return pfLogoModule;
    return require(id);
  }
);

test('PfLogo renders tasteful original cursive vector monogram with Pf calligraphic paths', () => {
  const html = renderToStaticMarkup(React.createElement(pfLogoModule.PfLogo, { size: 32, badge: true }));
  assert.match(html, /<svg[^>]*width="32"[^>]*height="32"/);
  assert.match(html, /d="M 9\.5 9 C 9\.5 12/); // P stem & bowl
  assert.match(html, /d="M 17 15 C 19 14\.5/); // cursive f ascender
  assert.match(html, /d="M 18\.5 15\.2 Q 22 14\.8 25\.5 15"/); // cursive f crossbar
});

test('AppLayout renders compact application sidebar without a top horizontal navbar', () => {
  const html = renderToStaticMarkup(
    React.createElement(appLayoutModule.AppLayout, { activeNav: 'issues' }, React.createElement('div', {}, 'Workbench Body'))
  );

  // Desktop sidebar exists with sticky full height
  assert.match(html, /<aside class="hidden md:flex w-64 shrink-0/);

  // Top navigation bar was removed
  assert.doesNotMatch(html, /<header class="sticky top-0 z-40 bg-white/);

  // Cursive ProofPatcher brand mark in sidebar header
  assert.match(html, /font-semibold text-slate-900/);
  assert.match(html, /ProofPatcher/);

  // Primary navigation links
  assert.match(html, /href="\/issues"[^>]*>.*Issues &amp; Tasks/s);
  assert.match(html, /href="\/repositories"[^>]*>.*Pull Requests/s);
  assert.match(html, /href="\/"[^>]*>.*Overview/s);
  assert.match(html, /href="\/settings"[^>]*>.*Settings/s);
  assert.match(html, /href="\/docs"[^>]*>.*Docs/s);

  // Bottom account card and theme toggle
  assert.match(html, /GitHub not connected/);
  assert.match(html, /aria-label="Color theme"/);

  // Content rendered inside edge-to-edge main
  assert.match(html, /<main class="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 overflow-y-auto">.*Workbench Body.*<\/main>/s);
});

test('Disconnected Issues screen displays full-screen GitHub onboarding and honest credit metrics without synthetic shortcuts', () => {
  const issuesSource = [
    readFileSync(new URL('../../resources/js/Pages/Issues.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../resources/js/Components/workbench/DisconnectedOnboardingView.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../resources/js/Components/workbench/WorkbenchSidebar.tsx', import.meta.url), 'utf8'),
  ].join('\n');

  // Must check connection and branch to disconnected onboarding view
  assert.match(issuesSource, /if \(!isConnected\)/);
  assert.match(issuesSource, /Connect your GitHub account/);
  assert.match(issuesSource, /GitHub OAuth Device Flow \(RFC 8628\)/);

  // Must display honest usage and allowances
  assert.match(issuesSource, /Meta Muse API/);
  assert.match(issuesSource, /\$15\.00/);
  assert.match(issuesSource, /Baseten Credits/);
  assert.match(issuesSource, /\$100\.00/);
  assert.match(issuesSource, /Live Provider API/);
  assert.match(issuesSource, /Unavailable/);
  assert.match(issuesSource, /Not exposed via completion API/);

  // Must not render synthetic shortcuts in standard view
  assert.doesNotMatch(issuesSource, /OrderTotal Bug \(#101 · Offline Fixture\)/);
  assert.doesNotMatch(issuesSource, /Dedicated Test Repo Issue \(#1\)/);
});

test('Settings page exposes user-configurable Maintainer Automation Rules and honest credit balances', () => {
  const settingsSource = readFileSync(new URL('../../resources/js/Pages/Settings.tsx', import.meta.url), 'utf8');

  // Automation rules
  assert.match(settingsSource, /Maintainer Automation Rules/);
  assert.match(settingsSource, /Automated Issue Triage/);
  assert.match(settingsSource, /Automated 5-Gate Verifier/);
  assert.match(settingsSource, /Require Maintainer Approval Before Model Requests/);
  assert.match(settingsSource, /Anti-Slop Code Quality Filter/);
  assert.match(settingsSource, /Maximum Diff Line Threshold/);

  // Honest allowance reporting
  assert.match(settingsSource, /\$15\.00/);
  assert.match(settingsSource, /Meta Muse Allowance/);
  assert.match(settingsSource, /\$100\.00/);
  assert.match(settingsSource, /Baseten Credits/);
  assert.match(settingsSource, /Unavailable/);
  assert.match(settingsSource, /Not exposed via chat completion API/);

  // 3-Pillar & Global Provider Matrix
  assert.match(settingsSource, /Global Provider &amp; Sandbox Architecture/);
  assert.match(settingsSource, /Modal gVisor Sandbox/);
  assert.match(settingsSource, /block_network=True/);
});

test('Issues workbench includes 3-Pillar architecture explainability, 4-step guided flow bar, Repo Context Memory, and bot attribution', () => {
  const issuesSource = [
    readFileSync(new URL('../../resources/js/Pages/Issues.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../resources/js/Components/workbench/DisconnectedOnboardingView.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../resources/js/Components/workbench/WorkbenchSidebar.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../resources/js/Components/workbench/GuidedStepBar.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../resources/js/Components/workbench/IssueHeaderCard.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../resources/js/Components/workbench/ProposalDiffCard.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../resources/js/Components/workbench/VerificationPipelineCard.tsx', import.meta.url), 'utf8'),
  ].join('\n');

  // 3-Pillar Architecture Cards on Landing Screen
  assert.match(issuesSource, /1\. Meta Muse Spark/);
  assert.match(issuesSource, /2\. Baseten Inference/);
  assert.match(issuesSource, /3\. Modal gVisor Sandbox/);
  assert.match(issuesSource, /1-Click: Launch Interactive 5-Gate Flow/);

  // 4-Step Guided Co-Maintainer Flow Bar
  assert.match(issuesSource, /1\. Context Loaded/);
  assert.match(issuesSource, /2\. Single-Use Approval/);
  assert.match(issuesSource, /3\. 5-Gate Verifier/);
  assert.match(issuesSource, /4\. Receipt &amp; PR Response/);

  // Repository Context Memory auto-fill & Issue Media/GIF inspector
  assert.match(issuesSource, /Repo Context Memory/);
  assert.match(issuesSource, /proofpatch-repo-memory/);
  assert.match(issuesSource, /Visual Media \/ GIF Detected/);
  assert.match(issuesSource, /GitHub Co-Maintainer Response Attribution/);
  assert.match(issuesSource, /proofpatcher\[bot\]/);
});
