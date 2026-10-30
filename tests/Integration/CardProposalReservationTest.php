<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\CardProposalReservation;
use ProofPatch\Evidence\CanonicalJson;
use ProofPatch\GitHub\PublicCardPreview;
use ProofPatch\Models\LocalTaskCard;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;

final class CardProposalReservationTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();
    }

    protected function tearDown(): void
    {
        $this->teardownIsolatedDatabase();
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function card(): LocalTaskCard
    {
        $card = new LocalTaskCard();
        $card->github_user_id = 1;
        $card->repository = 'example/project';
        $card->title = 'Fix chart';
        $card->description = 'Fix its quantity.';
        $card->status = 'queued';
        $card->save();
        return $card;
    }

    private function snapshot(LocalTaskCard $card): array
    {
        return [
            'id' => (int) $card->id,
            'userId' => (int) $card->github_user_id,
            'repository' => $card->repository,
            'title' => $card->title,
            'description' => $card->description,
        ];
    }

    private function payload(): array
    {
        $wire = [
            'destination' => 'https://inference.baseten.co/v1/chat/completions',
            'body' => ['messages' => ['exact text']],
        ];
        return $wire + ['digest' => hash('sha256', CanonicalJson::encode($wire))];
    }

    public function testReservationStoresOnlyDigestsWithoutPlaintextPayloadAndAllowsEditsAfterCommit(): void
    {
        self::assertFalse(
            Schema::hasColumn('card_proposal_reservations', 'payload'),
            'card_proposal_reservations must never retain plaintext task payloads'
        );

        $card = $this->card();
        $snapshot = $this->snapshot($card);
        $payload = $this->payload();
        $reservation = new CardProposalReservation();
        $id = $reservation->reserve($snapshot, $payload, str_repeat('a', 64));

        // A second connection must be able to write immediately after reservation; no model call holds a transaction.
        $pdo = new \PDO('sqlite:'.config('database.connections.sqlite.database'));
        $pdo->exec('PRAGMA busy_timeout = 0');
        $pdo->exec("UPDATE local_task_cards SET description = 'Later edit' WHERE id = ".(int) $card->id);

        $stored = DB::table('card_proposal_reservations')->where('id', $id)->first();
        self::assertNotNull($stored);
        self::assertSame('reserved', $stored->status);
        self::assertSame(PublicCardPreview::cardVersion($snapshot), $stored->card_version);
        self::assertSame($payload['digest'], $stored->request_digest);
        self::assertSame(hash('sha256', str_repeat('a', 64)), $stored->approval_hash);
        self::assertObjectNotHasProperty('payload', $stored);

        $reservation->finish($id, 'completed');
        self::assertSame('completed', DB::table('card_proposal_reservations')->where('id', $id)->value('status'));
        self::assertSame('Later edit', $card->fresh()->description);
    }

    public function testChangedCardAndDuplicateApprovalCannotReserve(): void
    {
        $card = $this->card();
        $snapshot = $this->snapshot($card);
        $card->description = 'changed';
        $card->save();
        $reservation = new CardProposalReservation();
        try {
            $reservation->reserve($snapshot, $this->payload(), str_repeat('a', 64));
            self::fail('Stale card accepted.');
        } catch (\RuntimeException) {
            self::assertSame(0, DB::table('card_proposal_reservations')->count());
        }

        $reservation->reserve($this->snapshot($card), $this->payload(), str_repeat('a', 64));
        try {
            $reservation->reserve($this->snapshot($card), $this->payload(), str_repeat('a', 64));
            self::fail('Duplicate approval accepted.');
        } catch (\Throwable) {
            self::assertSame(1, DB::table('card_proposal_reservations')->count());
        }
    }
}
