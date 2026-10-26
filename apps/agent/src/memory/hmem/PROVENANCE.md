Vendored from Meterless H-MEM reference implementation
(https://github.com/Meterless/Meterless, engines/hmem/reference/src, Apache-2.0).
Imported verbatim so behaviour can be diffed against upstream and scored by the
spec's conformance suite (engines/hmem/conformance/runner.ts with
HMEM_IMPL=<this dir>/index.ts). Kept under src/memory/ rather than node_modules
because the upstream repo ships specs, not a package.
