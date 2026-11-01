import { Hono } from 'hono'

import { db } from '../db'
import type { AppEnv } from '../types'
import { createCategory, createTransaction, deleteTransaction, isDuplicateCategoryName, listCategories, listTransactions, renameCategory, updateTransaction } from './repository'
import { createCategoryBodyValidator, idParamValidator, jsonValidator, monthQueryValidator, renameCategoryBodyValidator, transactionBodyValidator } from './validators'

const DUPLICATE_CATEGORY_NAME_ERROR = 'A category with this name already exists'

const finances = new Hono<AppEnv>()
  .get('/transactions', monthQueryValidator, async (c) => {
    const transactions = await listTransactions(db, c.get('user').id, c.req.valid('query').month)
    return c.json(transactions)
  })
  .post('/transactions', jsonValidator, transactionBodyValidator, async (c) => {
    const transaction = await createTransaction(db, c.get('user').id, c.req.valid('json'))
    return c.json(transaction, 201)
  })
  .put('/transactions/:id', idParamValidator, jsonValidator, transactionBodyValidator, async (c) => {
    const transaction = await updateTransaction(db, c.get('user').id, c.req.valid('param').id, c.req.valid('json'))
    if (!transaction) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.json(transaction)
  })
  .delete('/transactions/:id', idParamValidator, async (c) => {
    const deleted = await deleteTransaction(db, c.get('user').id, c.req.valid('param').id)
    if (!deleted) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.body(null, 204)
  })
  .get('/categories', async (c) => {
    const userCategories = await listCategories(db, c.get('user').id)
    return c.json(userCategories)
  })
  .post('/categories', jsonValidator, createCategoryBodyValidator, async (c) => {
    try {
      const category = await createCategory(db, c.get('user').id, c.req.valid('json'))
      return c.json(category, 201)
    } catch (error) {
      if (isDuplicateCategoryName(error)) {
        return c.json({ error: DUPLICATE_CATEGORY_NAME_ERROR }, 409)
      }
      throw error
    }
  })
  .put('/categories/:id', idParamValidator, jsonValidator, renameCategoryBodyValidator, async (c) => {
    try {
      const category = await renameCategory(db, c.get('user').id, c.req.valid('param').id, c.req.valid('json').name)
      if (!category) {
        return c.json({ error: 'Not found' }, 404)
      }
      return c.json(category)
    } catch (error) {
      if (isDuplicateCategoryName(error)) {
        return c.json({ error: DUPLICATE_CATEGORY_NAME_ERROR }, 409)
      }
      throw error
    }
  })

export default finances
