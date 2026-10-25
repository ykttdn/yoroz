// Kept apart from validators.ts, which builds its Zod schemas on import, so the app's form can share these limits
// without bundling Zod
export const MAX_AMOUNT = 1_000_000
export const MAX_MEMO_LENGTH = 200
