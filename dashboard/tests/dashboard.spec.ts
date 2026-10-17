import { test, expect } from '@playwright/test'

test.describe('Expense Tracker Dashboard', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    await expect(page).toHaveTitle('Expense Tracker Dashboard')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('protected routes redirect to login', async ({ page }) => {
    const routes = ['/', '/transactions', '/goals', '/debts', '/settings', '/guide']
    for (const route of routes) {
      await page.goto(`http://localhost:3000${route}`)
      await expect(page).toHaveURL(/.*login/)
    }
  })

  test('logout redirects to login', async ({ page }) => {
    await page.goto('http://localhost:3000/logout')
    await expect(page).toHaveURL(/.*login/)
  })

  test('404 page works', async ({ page }) => {
    await page.goto('http://localhost:3000/nonexistent')
    await expect(page).toHaveTitle('Expense Tracker Dashboard')
  })

  test('login page has no sidebar links', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    await expect(page.locator('nav a')).toHaveCount(0)
  })
})