<?php

declare(strict_types=1);

use ProofPatch\Agent\Credentials;
use ProofPatch\Agent\ModelProposal;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Evidence\Receipt;
use ProofPatch\Patch\CssPatch;
use ProofPatch\Verifier\CheckoutVerifier;
use Symfony\Component\HttpClient\HttpClient;

require dirname(__DIR__).'/vendor/autoload.php';

$project = dirname(__DIR__);
$runs = $project.'/artifacts/runs';
header("Content-Security-Policy: default-src 'self'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
header('X-Content-Type-Options: nosniff');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'path' => '/']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$escape = static fn(mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$runId = is_string($_GET['run'] ?? null) ? $_GET['run'] : '';
$validId = static fn(string $id): bool => (bool) preg_match('/\A\d{8}T\d{6}Z-[a-f0-9]{12}\z/', $id);
$runDirectory = static function (string $id) use ($runs, $validId): ?string {
    if (!$validId($id) || is_link($runs) || is_link($runs.'/'.$id)) {
        return null;
    }
    $base = realpath($runs);
    $path = realpath($runs.'/'.$id);
    return $base !== false && $path !== false && dirname($path) === $base && is_dir($path) ? $path : null;
};

if (isset($_GET['image'])) {
    $image = match ($_GET['image']) { 'before' => 'baseline', 'after' => 'candidate', default => null };
    $dir = $runDirectory($runId);
    $path = $image !== null && $dir !== null ? $dir.'/'.$image.'/checkout.png' : '';
    if ($path === '' || is_link(dirname($path)) || is_link($path) || !is_file($path)) {
        http_response_code(404);
        exit('Image unavailable.');
    }
    header('Content-Type: image/png');
    header('Cache-Control: no-store');
    readfile($path);
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!is_string($_POST['csrf'] ?? null) || !hash_equals($_SESSION['csrf'], $_POST['csrf'])) {
            throw new InvalidArgumentException('Session expired. Refresh and try again.');
        }
        if (($_POST['action'] ?? '') === 'propose') {
            $id = is_string($_POST['source_run'] ?? null) ? $_POST['source_run'] : '';
            $directory = $runDirectory($id);
            $home = getenv('HOME');
            if ($directory === null || !$home) {
                throw new InvalidArgumentException('Select a run with a reproduced baseline first.');
            }
            $agent = new ModelProposal($project, HttpClient::create(), new RequestBudget($home.'/.local/share/proofpatch/runtime'));
            $_SESSION['proposal'] = $agent->propose($directory, Credentials::baseten());
            header('Location: /?run='.rawurlencode($id), true, 303);
            exit;
        }
        $source = file_get_contents($project.'/'.CssPatch::FILE);
        if ($source === false) {
            throw new RuntimeException('The checkout fixture is unavailable.');
        }
        $patch = CssPatch::fromArray(['file' => CssPatch::FILE, 'baseSha256' => hash('sha256', $source),
            'find' => $_POST['find'] ?? null, 'replace' => $_POST['replace'] ?? null]);
        $generated = $_SESSION['proposal'] ?? null;
        $provenance = null;
        if (is_array($generated) && ($generated['patch'] ?? null) === $patch->toArray()
            && ($generated['sourceRunId'] ?? null) === ($_POST['source_run'] ?? null)) {
            $provenance = ['origin' => 'model', 'model' => $generated['model'], 'usage' => $generated['usage'],
                'sourceRunId' => $generated['sourceRunId'], 'sourceReceiptSha256' => $generated['sourceReceiptSha256']];
        }
        $report = (new CheckoutVerifier($project))->verify($patch, $provenance);
        header('Location: /?run='.rawurlencode($report['id']), true, 303);
        exit;
    } catch (Throwable $exception) {
        $error = $exception->getMessage();
        http_response_code(400);
    }
}

$history = [];
foreach (glob($runs.'/*/result.json') ?: [] as $file) {
    $id = basename(dirname($file));
    if ($runDirectory($id) === null || is_link($file) || filesize($file) > 1048576) {
        continue;
    }
    $record = json_decode((string) file_get_contents($file), true);
    if (is_array($record) && ($record['id'] ?? null) === $id && in_array($record['decision'] ?? null, ['VERIFIED', 'FAILED', 'INCONCLUSIVE'], true)) {
        $history[$id] = $record;
    }
}
krsort($history, SORT_STRING);
$history = array_slice($history, 0, 20, true);
if ($runId === '' && $history !== []) {
    $runId = array_key_first($history);
}
$report = $history[$runId] ?? null;
$home = getenv('HOME');
$ledgerPath = $home ? $home.'/.local/share/proofpatch/runtime/runtime-ledger.json' : '';
$pilotUsed = $ledgerPath !== '' && (file_exists($ledgerPath) || is_link($ledgerPath));
$proposal = $_SESSION['proposal'] ?? null;
if (!is_array($proposal) || ($proposal['sourceRunId'] ?? null) !== $runId) {
    $proposal = null;
}
$receipt = null;
$receiptError = null;
if ($report !== null) {
    try {
        $receipt = (new Receipt())->verify($runDirectory($runId));
    } catch (Throwable $exception) {
        $receiptError = $exception->getMessage();
    }
}
$imageUrl = static fn(string $type): string => '/?run='.rawurlencode($runId).'&image='.$type;
$gates = ['baselineReproduced' => 'Bug reproduced', 'protectedTestsPassed' => 'Protected checks',
    'outsideMaskPreserved' => 'Visual guard', 'authorityIntact' => 'Checks unchanged'];
?>
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ProofPatch — Repair workbench</title><link rel="stylesheet" href="/workbench.css"></head>
<body>
<header class="topbar"><a class="brand" href="/"><span class="brand-mark">P</span><span>ProofPatch<small>REPAIR WORKBENCH</small></span></a><span class="local-pill"><i></i> Local workspace</span></header>
<main class="shell">
  <div class="intro"><div><div class="eyebrow">CHECKOUT / INTERACTION REPAIR</div><h1>Fix with evidence.</h1><p>Test a focused CSS change against the broken checkout, then review the result before applying it.</p></div><div class="intro-index">01 <span>/ 01</span><small>ACTIVE CASE</small></div></div>
  <?php if ($error !== ''): ?><div class="alert" role="alert"><?= $escape($error) ?></div><?php endif; ?>
  <div class="workspace">
    <section class="card proposal"><div class="section-label"><span>01 / CANDIDATE</span><span class="quiet"><?= $proposal ? 'MUSE PROPOSAL' : 'MANUAL INPUT' ?></span></div><h2>Propose a change</h2><p class="muted">Change one unique section of the fixture’s inline CSS. The original file stays untouched.</p>
      <form method="post"><input type="hidden" name="csrf" value="<?= $escape($_SESSION['csrf']) ?>"><input type="hidden" name="source_run" value="<?= $escape($runId) ?>">
        <label for="find">FIND <span>Existing CSS</span></label><textarea id="find" name="find" required maxlength="4096" spellcheck="false"><?= $escape($_POST['find'] ?? $proposal['patch']['find'] ?? 'pointer-events: auto;') ?></textarea>
        <label for="replace">REPLACE WITH <span>Candidate CSS</span></label><textarea id="replace" name="replace" required maxlength="4096" spellcheck="false"><?= $escape($_POST['replace'] ?? $proposal['patch']['replace'] ?? 'pointer-events: none;') ?></textarea>
        <button type="submit" name="action" value="verify">Run verification <span aria-hidden="true">↗</span></button>
        <button class="secondary" type="submit" name="action" value="propose" formnovalidate <?= $report === null || $pilotUsed ? 'disabled' : '' ?>>Generate with Muse <span aria-hidden="true">✦</span></button>
        <p class="model-note"><?= $pilotUsed ? 'The single-request pilot has been used. Existing results remain available for review.' : 'Uses a single bounded Baseten request from a reproduced baseline. Review the proposal before verification.' ?></p>
      </form><div class="detail"><span>Fixture</span><strong>checkout.html</strong></div><div class="detail"><span>Review</span><strong>Human approval required</strong></div>
    </section>
    <section class="card result"><div class="section-label"><span>02 / EVIDENCE</span><span class="quiet">SELECTED RUN</span></div>
      <?php if ($report === null): ?><div class="empty"><span class="empty-icon">↗</span><h2>Ready when you are.</h2><p>Run a candidate to see the protected checks, screenshots and receipt here.</p></div>
      <?php else: ?><div class="result-head"><div><h2>Verification result</h2><p class="muted run-id"><?= $escape($runId) ?></p></div><span class="badge <?= strtolower($escape($report['decision'])) ?>"><?= $escape($report['decision']) ?></span></div>
        <?php if (isset($report['proposalEvidence']['model'])): ?><p class="model-note">Proposal source: <?= $escape($report['proposalEvidence']['model']) ?> · independently checked</p><?php endif; ?>
        <div class="gates"><?php foreach ($gates as $key => $label): $state = $report['gates'][$key] ?? null; ?><div class="gate"><span class="gate-icon <?= $state === true ? 'pass' : ($state === false ? 'fail' : 'pending') ?>"><?= $state === true ? '✓' : ($state === false ? '×' : '–') ?></span><span><?= $escape($label) ?></span></div><?php endforeach; ?></div>
        <?php if (isset($report['reason'])): ?><p class="reason"><?= $escape($report['reason']) ?></p><?php endif; ?>
        <div class="image-grid"><?php foreach (['before' => 'BEFORE', 'after' => 'CANDIDATE'] as $key => $label): ?><figure><figcaption><?= $escape($label) ?><span><?= $key === 'before' ? 'BASELINE' : 'ISOLATED WORKTREE' ?></span></figcaption><?php if (isset($report['runs'][$key === 'before' ? 'baseline' : 'candidate'])): ?><img src="<?= $escape($imageUrl($key)) ?>" alt="<?= $escape($label) ?> checkout screenshot"><?php else: ?><div class="no-image">No screenshot available</div><?php endif; ?></figure><?php endforeach; ?></div>
        <details class="tested-change"><summary>View tested change</summary><span>FIND</span><pre><?= $escape($report['proposal']['find'] ?? '') ?></pre><span>REPLACE WITH</span><pre><?= $escape($report['proposal']['replace'] ?? '') ?></pre></details>
        <div class="receipt"><div><span class="receipt-icon">◇</span><div><strong>Evidence receipt</strong><p><?= $receipt ? 'Files match the saved manifest.' : 'Receipt unavailable or integrity check failed.' ?></p></div></div><span class="receipt-status <?= $receipt ? 'good' : 'bad' ?>"><?= $receipt ? 'INTEGRITY OK' : 'CHECK NEEDED' ?></span></div>
        <?php if ($receipt): ?><p class="hash">SHA-256 <code><?= $escape($receipt['sha256']) ?></code><br><span>Unsigned; retain the digest independently to detect a rewritten receipt.</span></p><?php elseif ($receiptError): ?><p class="hash"><?= $escape($receiptError) ?></p><?php endif; ?>
      <?php endif; ?>
    </section>
  </div>
  <section class="history"><div class="section-label"><span>03 / RUN HISTORY</span><span class="quiet"><?= count($history) ?> RECENT RUNS</span></div><?php if (!$history): ?><p class="muted">Your verification runs will appear here.</p><?php else: ?><div class="history-list"><?php foreach ($history as $id => $item): ?><a class="history-row" href="/?run=<?= $escape(rawurlencode($id)) ?>"><span><?= $escape($id) ?></span><span class="history-status <?= strtolower($escape($item['decision'])) ?>"><?= $escape($item['decision']) ?></span><span aria-hidden="true">↗</span></a><?php endforeach; ?></div><?php endif; ?></section>
  <footer>PROOFPATCH <span>Focused change. Independent checks. Human decision.</span></footer>
</main></body></html>
