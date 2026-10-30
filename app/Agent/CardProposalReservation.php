<?php

declare(strict_types=1);

namespace ProofPatch\Agent;

use Illuminate\Support\Facades\DB;
use ProofPatch\Evidence\CanonicalJson;
use ProofPatch\GitHub\PublicCardPreview;
use ProofPatch\Models\LocalTaskCard;

/** Durable single-use cutoff: an approved snapshot cannot be changed by a later card edit. */
final class CardProposalReservation
{
    public function reserve(array $card, array $payload, string $approvalToken): int
    {
        if (DB::connection()->getDriverName() !== 'sqlite' || !preg_match('/\A[a-f0-9]{64}\z/', $approvalToken)
            || !is_string($payload['digest'] ?? null) || !is_array($payload['body'] ?? null)
            || !is_string($payload['destination'] ?? null)) {
            throw new \RuntimeException('The request cannot be reserved.');
        }
        $wire = ['destination' => $payload['destination'], 'body' => $payload['body']];
        if (!hash_equals(hash('sha256', CanonicalJson::encode($wire)), $payload['digest'])) {
            throw new \RuntimeException('The request changed; review it again.');
        }
        $version = PublicCardPreview::cardVersion($card);
        return DB::transaction(function () use ($card, $payload, $approvalToken, $wire, $version): int {
            // Obtain a short SQLite write lock before reading and comparing the current row.
            DB::update('UPDATE local_task_cards SET updated_at = updated_at WHERE id = ?', [$card['id']]);
            $current = LocalTaskCard::whereKey($card['id'])->where('github_user_id', $card['userId'])->first();
            if ($current === null) throw new \RuntimeException('The task is unavailable.');
            $snapshot = ['id' => (int) $current->id, 'userId' => (int) $current->github_user_id,
                'repository' => $current->repository, 'title' => $current->title, 'description' => $current->description];
            if (!hash_equals($version, PublicCardPreview::cardVersion($snapshot))) {
                throw new \RuntimeException('The task changed; review it again.');
            }
            return (int) DB::table('card_proposal_reservations')->insertGetId([
                'github_user_id' => $card['userId'], 'card_id' => $card['id'], 'repository' => $card['repository'],
                'card_version' => $version, 'request_digest' => $payload['digest'],
                'approval_hash' => hash('sha256', $approvalToken), 'payload' => CanonicalJson::encode($wire),
                'status' => 'reserved', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }, 1);
    }

    public function finish(int $id, string $status): void
    {
        if (!in_array($status, ['completed', 'uncertain'], true)) {
            throw new \InvalidArgumentException('Invalid reservation outcome.');
        }
        DB::table('card_proposal_reservations')->where('id', $id)->where('status', 'reserved')
            ->update(['status' => $status, 'updated_at' => now()]);
    }
}
