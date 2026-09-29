export type User = { id: number, email: string, name: string }

export type AppEnv = { Bindings: Env, Variables: { user: User } }
