/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ════════════════════════════════════════════════════════════════════════════
// EmptyStateSurface · canonical re-export from components/system/EmptyState.jsx
//
// ⚠️  Naming note:
//   The legacy ui/index.jsx already exports a different `EmptyState` (older
//   API). To avoid breaking any consumer of the legacy export, the modern
//   system EmptyState is re-exported here under the name `EmptyStateSurface`.
//   New code should prefer this one. The legacy name will be migrated in a
//   later pass once all callers are converted.
// ════════════════════════════════════════════════════════════════════════════

export {
  default,
  EmptyState as EmptyStateSurface,
} from "../system/EmptyState"
