# ProofPatch owned review case

A deliberately faulty, self-contained, checked-in test repository for developing and evaluating ProofPatch. Prices and totals use integer minor currency units.

Issue: An item with quantity zero is charged once. It should contribute zero to an order total, while normal quantities still calculate correctly.

Run the checks with `php tests/order_total.php`. The baseline is expected to fail until the bug is repaired. This case is synthetic; it is not a production issue or a GitHub pull request.
