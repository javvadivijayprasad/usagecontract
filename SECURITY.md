# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for a suspected security vulnerability.

Instead, email **jvijayprasad@gmail.com** with:

- a description of the issue and its potential impact,
- steps to reproduce (a minimal proof of concept if possible),
- the package version (`npm ls @vijaypjavvadi/usagecontract`) and your Node version.

You'll get an acknowledgement as soon as possible. Once the issue is confirmed and a fix is
ready, a patched version will be released and the report credited (unless you prefer to remain
anonymous).

## Scope

usagecontract is a developer tool that reads OpenAPI specs and recorded usage profiles from the
local filesystem. It does not run a network service by default. Reports most relevant to this
project include: parsing untrusted spec/profile input in a way that could crash or hang a CI job,
or the `mock` server exposing more than the intended fake responses.

## Supported versions

Fixes are made against the latest published version on npm. Please upgrade before reporting.
