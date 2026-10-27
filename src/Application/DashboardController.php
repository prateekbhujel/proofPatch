<?php

declare(strict_types=1);

namespace ProofPatch\Application;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use ProofPatch\Agent\Credentials;
use ProofPatch\Agent\ModelProposal;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Evidence\Receipt;
use ProofPatch\GitHub\PullRequestReader;
use ProofPatch\GitHub\PullRequestSnapshot;
use ProofPatch\Patch\CssPatch;
use ProofPatch\Support\LocalProcess;
use ProofPatch\Verifier\CheckoutVerifier;
use Symfony\Component\HttpClient\HttpClient;

final class DashboardController
{
    private string $project;
    private string $runsDir;
    private string $snapshotsDir;

    public function __construct()
    {
        $this->project = dirname(__DIR__, 2);
        $this->runsDir = $this->project.'/artifacts/runs';
        $this->snapshotsDir = getenv('PROOFPATCH_SNAPSHOT_DIR') ?: $this->project.'/artifacts/pull-requests';
        if (session_status() === PHP_SESSION_NONE) {
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'path' => '/']);
            @session_start();
        }
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    }

    public function overview(): InertiaResponse
    {
        $store = new PullRequestSnapshot($this->snapshotsDir);
        $files = glob($this->snapshotsDir.'/*.json') ?: [];
        rsort($files, SORT_STRING);
        $recent = [];
        $totalSnapshots = count($files);

        foreach (array_slice($files, 0, 50) as $file) {
            $id = basename($file, '.json');
            try {
                $saved = $store->load($id);
                $pull = $saved['snapshot']['pullRequest'] ?? null;
                if (!is_array($pull) || !is_string($pull['repository'] ?? null) || !is_int($pull['number'] ?? null)
                    || !is_string($pull['title'] ?? null) || !is_string($pull['state'] ?? null)
                    || !is_string($pull['headSha'] ?? null) || !is_string($saved['snapshot']['capturedAt'] ?? null)) {
                    continue;
                }
                $key = $pull['repository'].'#'.$pull['number'];
                $recent[$key] ??= ['id' => $id, 'pull' => $pull, 'capturedAt' => $saved['snapshot']['capturedAt']];
                if (count($recent) === 10) {
                    break;
                }
            } catch (\Throwable) {
                continue;
            }
        }

        $runFiles = glob($this->runsDir.'/*/result.json') ?: [];
        $totalRuns = count($runFiles);
        $verifiedRuns = 0;
        foreach ($runFiles as $rf) {
            $data = json_decode((string) file_get_contents($rf), true);
            if (($data['decision'] ?? null) === 'VERIFIED') {
                $verifiedRuns++;
            }
        }

        return Inertia::render('Overview', [
            'totalSnapshots' => $totalSnapshots,
            'totalRuns' => $totalRuns,
            'verifiedRuns' => $verifiedRuns,
            'recent' => array_values($recent),
        ]);
    }

    public function repositories(Request $request): InertiaResponse|\Illuminate\Http\RedirectResponse
    {
        $error = session('error');
        if ($request->isMethod('post')) {
            try {
                $url = (string) $request->input('url');
                if (strlen($url) > 512 || trim($url) === '') {
                    throw new \InvalidArgumentException('Enter a GitHub pull request URL or shorthand.');
                }
                $token = getenv('GITHUB_TOKEN');
                $pullRequest = (new PullRequestReader(HttpClient::create(), $token ?: null))->read($url);
                $snapshot = (new PullRequestSnapshot($this->snapshotsDir))->capture($pullRequest);
                $_SESSION['pullRequest'] = $pullRequest;
                $_SESSION['pullRequestSnapshot'] = $snapshot;

                return redirect('/repositories');
            } catch (\Throwable $exception) {
                return redirect('/repositories')->with('error', $exception->getMessage());
            }
        }

        $pull = $_SESSION['pullRequest'] ?? null;
        $snapshot = $_SESSION['pullRequestSnapshot'] ?? null;
        if ($request->has('snapshot')) {
            try {
                $snapshotId = (string) $request->query('snapshot');
                $saved = (new PullRequestSnapshot($this->snapshotsDir))->load($snapshotId);
                $pull = $saved['snapshot']['pullRequest'] ?? null;
                $snapshot = ['id' => $saved['snapshot']['id'], 'capturedAt' => $saved['snapshot']['capturedAt'], 'sha256' => $saved['sha256']];
            } catch (\Throwable) {
                $pull = null;
                $snapshot = null;
                $error = 'This saved pull-request snapshot is unavailable or invalid.';
            }
        }

        $triage = null;
        if ($pull !== null) {
            $policyFile = $this->project.'/.proofpatchrc.json';
            $policy = is_file($policyFile) ? json_decode((string) file_get_contents($policyFile), true) ?? [] : [];
            $analyzer = new \ProofPatch\GitHub\PrTriageAnalyzer($policy);
            $candidatePulls = [];
            foreach (glob($this->snapshotsDir.'/*.json') ?: [] as $candFile) {
                try {
                    $candData = (new PullRequestSnapshot($this->snapshotsDir))->load(basename($candFile, '.json'));
                    $candPull = $candData['snapshot']['pullRequest'] ?? null;
                    if (is_array($candPull) && (($candPull['number'] ?? null) !== ($pull['number'] ?? null) || ($candPull['repository'] ?? '') !== ($pull['repository'] ?? ''))) {
                        $candidatePulls[] = $candPull;
                    }
                } catch (\Throwable) {}
            }
            $triage = $analyzer->triage($pull, $candidatePulls);
        }

        return Inertia::render('Repositories', [
            'pull' => $pull,
            'snapshot' => $snapshot,
            'triage' => $triage,
            'error' => $error ?: null,
        ]);
    }

    public function checks(Request $request): InertiaResponse|\Illuminate\Http\RedirectResponse
    {
        $validId = static fn(string $id): bool => (bool) preg_match('/\A\d{8}T\d{6}Z-[a-f0-9]{12}\z/', $id);
        $runDir = function (string $id) use ($validId): ?string {
            if (!$validId($id) || is_link($this->runsDir) || is_link($this->runsDir.'/'.$id)) {
                return null;
            }
            $base = realpath($this->runsDir);
            $path = realpath($this->runsDir.'/'.$id);
            return $base !== false && $path !== false && dirname($path) === $base && is_dir($path) ? $path : null;
        };

        if ($request->isMethod('post')) {
            try {
                if ($request->input('action') === 'propose') {
                    $id = (string) $request->input('source_run', '');
                    $dir = $runDir($id);
                    $home = getenv('HOME');
                    if ($dir === null || !$home) {
                        throw new \InvalidArgumentException('Select a run with a reproduced baseline first.');
                    }
                    $sourceReport = json_decode((string) file_get_contents($dir.'/result.json'), true, 64, JSON_THROW_ON_ERROR);
                    if (($sourceReport['proposal']['file'] ?? null) !== $request->input('fixture')) {
                        throw new \InvalidArgumentException('Run the selected fixture first so the model sees its own baseline.');
                    }
                    $agent = new ModelProposal($this->project, HttpClient::create(), new RequestBudget($home.'/.local/share/proofpatch/runtime'));
                    $_SESSION['proposal'] = $agent->propose($dir, Credentials::baseten());

                    return redirect('/checks?run='.rawurlencode($id));
                }

                $fixture = (string) $request->input('fixture');
                if (!in_array($fixture, CssPatch::FILES, true)) {
                    throw new \InvalidArgumentException('Choose a supported checkout fixture.');
                }
                $source = file_get_contents($this->project.'/'.$fixture);
                if ($source === false) {
                    throw new \RuntimeException('The checkout fixture is unavailable.');
                }
                $patch = CssPatch::fromArray([
                    'file' => $fixture,
                    'baseSha256' => hash('sha256', $source),
                    'find' => $request->input('find'),
                    'replace' => $request->input('replace'),
                ]);
                $generated = $_SESSION['proposal'] ?? null;
                $provenance = null;
                if (is_array($generated) && ($generated['patch'] ?? null) === $patch->toArray()
                    && ($generated['sourceRunId'] ?? null) === $request->input('source_run')) {
                    $provenance = [
                        'origin' => 'model', 'model' => $generated['model'], 'usage' => $generated['usage'],
                        'sourceRunId' => $generated['sourceRunId'], 'sourceReceiptSha256' => $generated['sourceReceiptSha256'],
                    ];
                }
                $report = (new CheckoutVerifier($this->project))->verify($patch, $provenance);

                return redirect('/checks?run='.rawurlencode($report['id']));
            } catch (\Throwable $exception) {
                $currentRun = (string) $request->input('source_run', '');
                return redirect('/checks'.($currentRun ? '?run='.rawurlencode($currentRun) : ''))->with('error', $exception->getMessage());
            }
        }

        $runId = (string) $request->query('run', '');
        $history = [];
        foreach (glob($this->runsDir.'/*/result.json') ?: [] as $file) {
            $id = basename(dirname($file));
            if ($runDir($id) === null || is_link($file) || filesize($file) > 1048576) {
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
            foreach ($history as $id => $item) {
                if ($item['decision'] === 'VERIFIED') {
                    $runId = $id;
                    break;
                }
            }
            $runId = $runId ?: array_key_first($history);
        }
        $report = $history[$runId] ?? null;
        $currentHead = trim(LocalProcess::output(['git', '-C', $this->project, 'rev-parse', 'HEAD']));
        $baselineReady = $report !== null && ($report['baseCommit'] ?? null) === $currentHead
            && ($report['runs']['baseline']['exitCode'] ?? null) === 1;
        $home = getenv('HOME');
        $budgetStatus = null;
        try {
            if ($home) {
                $budgetStatus = (new RequestBudget($home.'/.local/share/proofpatch/runtime'))->status();
            }
        } catch (\Throwable) {}

        $proposal = $_SESSION['proposal'] ?? null;
        if (!is_array($proposal) || ($proposal['sourceRunId'] ?? null) !== $runId) {
            $proposal = null;
        }
        $fixture = $request->input('fixture') ?? $proposal['patch']['file'] ?? $report['proposal']['file'] ?? CssPatch::FILE;
        if (!is_string($fixture) || !in_array($fixture, CssPatch::FILES, true)) {
            $fixture = CssPatch::FILE;
        }
        $receipt = null;
        $receiptError = null;
        if ($report !== null && $runDir($runId) !== null) {
            try {
                $receipt = (new Receipt())->verify($runDir($runId));
            } catch (\Throwable $exception) {
                $receiptError = $exception->getMessage();
            }
        }

        return Inertia::render('Checks', [
            'runId' => $runId,
            'fixture' => $fixture,
            'report' => $report,
            'receipt' => $receipt,
            'receiptError' => $receiptError,
            'history' => $history,
            'budgetStatus' => $budgetStatus,
            'baselineReady' => $baselineReady,
            'proposal' => $proposal,
            'error' => session('error'),
        ]);
    }

    public function image(Request $request): Response
    {
        $runId = (string) $request->query('run', '');
        $imageType = (string) $request->query('image', '');

        return $this->serveImage($runId, $imageType);
    }

    public function imageByPath(string $runId, string $image): Response
    {
        return $this->serveImage($runId, $image);
    }

    private function serveImage(string $runId, string $imageType): Response
    {
        $validId = (bool) preg_match('/\A\d{8}T\d{6}Z-[a-f0-9]{12}\z/', $runId);
        $folder = match ($imageType) {
            'before', 'baseline' => 'baseline',
            'after', 'candidate' => 'candidate',
            default => null,
        };
        if (!$validId || $folder === null) {
            return response('Image unavailable.', 404);
        }
        $path = realpath($this->runsDir.'/'.$runId.'/'.$folder.'/checkout.png');
        $base = realpath($this->runsDir);
        if ($path === false || $base === false || !str_starts_with($path, $base) || !is_file($path)) {
            return response('Image unavailable.', 404);
        }

        return response(file_get_contents($path) ?: '', 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-store',
        ]);
    }
}
