# Shortcut debt ledger

Read-only. List the shortcuts this skill left behind and say which ones have no way out.

1. Grep the repo (skip `node_modules`, build output, vendored code) for comments containing `shortcut:`.
2. For each hit, record file and line, the limit, and the upgrade trigger.
3. A hit with no "when to upgrade" part is `no-trigger`. List those first.
4. Group the rest by file. One line per shortcut.
5. End with one line: how many shortcuts, how many `no-trigger`.

Change no code. Write the ledger to a file only if the user asks, under `.planning/` in the target project.
