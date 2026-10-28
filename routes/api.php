<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use ProofPatch\Http\Controllers\ReviewJobController;

Route::get('/reviews/{reviewId}', [ReviewJobController::class, 'show'])->whereNumber('reviewId');
