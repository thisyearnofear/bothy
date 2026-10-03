// Structural environment type. `NodeJS.ProcessEnv` is augmented by Next with a
// required NODE_ENV, which would force every literal test/config object to carry
// a key it does not use.
export type Env = Record<string, string | undefined>;