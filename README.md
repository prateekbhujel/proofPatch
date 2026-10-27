# ProofPatch

> Built during the **Meta Global AI Developer Hackathon 2026** (Indie Hacker Track).

Independent visual verification and evidence engine for pull requests.

ProofPatch verifies UI bug fixes against real browser baselines in isolated environments, capturing pixel diffs, interaction probes, and tamper-evident receipts before any patch is merged.

---

## Quickstart

### 1. Requirements
* PHP 8.4+ with `ext-gd` and `ext-json`
* Composer
* Node.js 20+ and npm
* Chrome / Chromium (for headless browser verification)

### 2. Setup
Install dependencies, build frontend assets, and prepare the local SQLite database:

```bash
composer install
npm install && npm run build
php artisan migrate
```

### 3. Run the Web Dashboard
Start the local server using standard Laravel Artisan:

```bash
php artisan serve
```

Open **http://127.0.0.1:8000** in your browser.

*(Alternatively, run `php artisan serve --port=8431`).*

---

## CLI Usage

### Inspect a GitHub Pull Request
Fetch pull request metadata, changed files, and check runs, saving an anchored snapshot. You can use shorthand handles, full URLs, or run interactively:

```bash
# Shorthand handle
php artisan review:inspect owner/repo#123

# Full URL
php artisan review:inspect https://github.com/owner/repo/pull/123

# Interactive prompt
php artisan review:inspect
```

### Record an Existing Local Snapshot
Record a saved snapshot in SQLite for review:

```bash
php artisan review:record <SNAPSHOT_ID>
```

### Inspect a Review via HTTP API
Query review status, repository metadata, and cryptographic digest anchors:

```bash
curl http://127.0.0.1:8000/reviews/<REVIEW_ID>
```

---

## Testing

Run the full PHPUnit test suite:

```bash
php artisan test
# or
./vendor/bin/phpunit
```

Run browser driver detection (if needed):

```bash
composer drivers
```

---

## Project Structure

```text
proofPatch/
├── artisan                 # Root Artisan CLI
├── bootstrap/              # Laravel bootstrap & command registration
├── config/                 # Application & SQLite database config
├── database/               # Database migrations & local SQLite store
│   └── migrations/
├── public/                 # Web root (CSS, static assets, index.php)
├── routes/                 # web.php & api.php routes
├── src/                    # Core verification engine & application code
│   ├── Agent/              # Model repair proposal & budgeting
│   ├── Application/        # Controllers & Artisan commands
│   ├── Browser/            # Headless browser probes (Panther)
│   ├── Evidence/           # Receipts & canonical JSON encoding
│   ├── GitHub/             # Pull request reader & snapshot store
│   ├── Patch/              # CSS patch manipulation & validation
│   └── Verifier/           # Worktree isolation & test verifier
├── storage/                # Framework cache, logs & sessions
└── tests/                  # Unit, Integration & Locked regression tests
```

