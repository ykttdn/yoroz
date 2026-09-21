export type User = { sub: string, email: string, name: string }

export type AppEnv = { Bindings: Env, Variables: { user: User } }
