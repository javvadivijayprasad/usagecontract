# usagecontract for VS Code

Gate OpenAPI changes by **real per-consumer usage**, right inside the editor. This extension
wraps the [`@vijaypjavvadi/usagecontract`](https://www.npmjs.com/package/@vijaypjavvadi/usagecontract)
package: each consumer's contract is a *usage profile* derived from observed traffic, and a spec
change is breaking for a consumer only if it invalidates something that consumer actually uses.

## Features

- **Can I Deploy?** — pick a base spec, a candidate spec, and a profiles folder; see, per consumer,
  whether the change is safe or breaking (and exactly which dependency broke).
- **Coverage Report** — see how much of the spec each consumer's recorded profile actually exercises.
- **Check Active Spec** — flag breaking changes **inline** (red squiggles) on the OpenAPI file you're
  editing, computed against a configured baseline + profiles.

## Commands

| Command | What it does |
|---|---|
| `usagecontract: Can I Deploy?` | Gate a candidate spec against a base spec for every consumer profile. |
| `usagecontract: Coverage Report` | Per-consumer coverage of the spec's reachable fields. |
| `usagecontract: Check Active Spec for Breaking Changes` | Inline diagnostics on the active spec. |

## Settings

| Setting | Default | Description |
|---|---|---|
| `usagecontract.baselineSpec` | `""` | Path to the baseline OpenAPI spec (absolute or workspace-relative). |
| `usagecontract.profilesDir` | `profiles` | Folder of recorded consumer profiles (absolute or workspace-relative). |

## How profiles are produced

Record them from your consumer tests with the npm package (`record.install(spec)` →
`record.flush(name, { dir })`), commit the resulting `profiles/` folder, then point this extension
at it. See the [usagecontract docs](https://github.com/javvadivijayprasad/usagecontract#readme).

## Requirements

VS Code 1.75+. The extension bundles its runtime dependency; nothing else to install.

## License

MIT
