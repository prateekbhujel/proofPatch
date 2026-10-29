<?php

declare(strict_types=1);

namespace ProofPatch\Support;

use Illuminate\Http\Request;

/**
 * Shared notification helper for user-facing toast and tray notifications.
 */
final class NotificationHelper
{
    /**
     * Adds a notification to the active session.
     */
    public static function add(
        ?Request $request,
        string $type,
        string $title,
        string $message,
        ?string $link = null
    ): void {
        $notification = [
            'id' => bin2hex(random_bytes(8)),
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'link' => $link,
            'timestamp' => gmdate(DATE_ATOM),
            'read' => false,
        ];

        if ($request !== null && $request->hasSession()) {
            $session = $request->session();
            $auth = $session->get('github_auth');
            $ownerId = is_array($auth) ? ($auth['user']['id'] ?? null) : null;
            $context = $session->get('issue_context');
            $repository = is_array($context) && empty($context['isSynthetic'])
                ? ($context['repository'] ?? null)
                : $session->get('selected_github_repo');
            $notification['githubUserId'] = is_int($ownerId) && $ownerId > 0 ? $ownerId : null;
            $notification['githubRepository'] = is_string($repository) ? $repository : null;
            $notification['isLocal'] = $notification['githubUserId'] === null && $notification['githubRepository'] === null;
            $notifications = $session->get('notifications', []);
            if (!is_array($notifications)) {
                $notifications = [];
            }
            array_unshift($notifications, $notification);
            if (count($notifications) > 20) {
                $notifications = array_slice($notifications, 0, 20);
            }
            $session->put('notifications', $notifications);
            return;
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            $notifications = $_SESSION['notifications'] ?? [];
            if (!is_array($notifications)) {
                $notifications = [];
            }
            array_unshift($notifications, $notification);
            if (count($notifications) > 20) {
                $notifications = array_slice($notifications, 0, 20);
            }
            $_SESSION['notifications'] = $notifications;
        }
    }
}
