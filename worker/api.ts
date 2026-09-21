import { Hono } from 'hono'

const api = new Hono()

api.get('/hello', c => c.json({ message: 'Hello from Hono on Workers' }))

export default api
