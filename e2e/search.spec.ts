import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'TestPassword123!'

test.describe('Song Search E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(`${BASE_URL}/dashboard`)
    
    // Login if not already authenticated
    const isLoggedIn = await page.evaluate(() => !!localStorage.getItem('token'))
    
    if (!isLoggedIn) {
      // Perform login
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_EMAIL)
      await page.fill('input[type="password"]', TEST_PASSWORD)
      await page.click('button:has-text("Sign In")')
      await page.waitForURL(`${BASE_URL}/dashboard`)
    }
  })

  test('Search for "Your Love Is King" by Sade', async ({ page }) => {
    // Navigate to songs section
    await page.click('button:has-text("songs")')
    
    // Click on Search Songs tab
    await page.click('button:has-text("Search Songs")')
    
    // Fill in search fields
    await page.fill('input[placeholder*="Your Love Is King"]', 'Your Love Is King')
    await page.fill('input[placeholder*="Sade"]', 'Sade')
    
    // Click search button
    await page.click('button:has-text("Search")')
    
    // Wait for results
    await page.waitForSelector('text=Your Love Is King')
    
    // Verify result is displayed
    const resultTitle = await page.locator('text=Your Love Is King').first()
    await expect(resultTitle).toBeVisible()
    
    // Verify artist is displayed
    const resultArtist = await page.locator('text=Sade').first()
    await expect(resultArtist).toBeVisible()
  })

  test('Add song from search to catalog', async ({ page }) => {
    // Navigate to songs section and search
    await page.click('button:has-text("songs")')
    await page.click('button:has-text("Search Songs")')
    await page.fill('input[placeholder*="Your Love Is King"]', 'Your Love Is King')
    await page.click('button:has-text("Search")')
    
    // Wait for results
    await page.waitForSelector('text=Your Love Is King')
    
    // Click "Add" button
    const addButton = await page.locator('button:has-text("Add")').first()
    await addButton.click()
    
    // Verify success notification
    await page.waitForSelector('text=Added')
    
    // Navigate to My Catalog
    await page.click('button:has-text("My Catalog")')
    
    // Verify song appears in catalog
    await page.waitForSelector('text=Your Love Is King')
    const catalogSong = await page.locator('text=Your Love Is King').first()
    await expect(catalogSong).toBeVisible()
  })

  test('Filter catalog search', async ({ page }) => {
    // Navigate to My Catalog
    await page.click('button:has-text("songs")')
    await page.click('button:has-text("My Catalog")')
    
    // Fill in filter field
    await page.fill('input[placeholder*="Search your catalog"]', 'Sade')
    
    // Click filter button
    await page.click('button:has-text("Filter")')
    
    // Results should contain only Sade songs
    const results = await page.locator('text=by Sade').count()
    expect(results).toBeGreaterThan(0)
  })

  test('Remove song from catalog', async ({ page }) => {
    // Navigate to My Catalog
    await page.click('button:has-text("songs")')
    await page.click('button:has-text("My Catalog")')
    
    // Wait for catalog to load
    await page.waitForSelector('button:has-text("Remove")')
    
    // Get initial count
    const initialCount = await page.locator('button:has-text("My Catalog")').textContent()
    
    // Click remove on first song
    const removeButton = await page.locator('button:has-text("Remove")').first()
    await removeButton.click()
    
    // Verify success notification
    await page.waitForSelector('text=removed')
    
    // Verify song is removed from list (optimistic update)
    const catalogItems = await page.locator('[class*="border"][class*="gray"]').count()
    const finalCount = await page.locator('button:has-text("My Catalog")').textContent()
    
    expect(finalCount).not.toEqual(initialCount)
  })

  test('Bulk remove songs from catalog', async ({ page }) => {
    // Navigate to My Catalog
    await page.click('button:has-text("songs")')
    await page.click('button:has-text("My Catalog")')
    
    // Wait for catalog to load
    await page.waitForSelector('input[type="checkbox"]')
    
    // Select multiple songs
    const checkboxes = await page.locator('input[type="checkbox"]').all()
    
    // Check first 2 checkboxes (skip the main header checkbox)
    if (checkboxes.length >= 3) {
      await checkboxes[1].click()
      await checkboxes[2].click()
    }
    
    // Click "Remove Selected" button
    await page.click('button:has-text("Remove Selected")')
    
    // Verify success notification
    await page.waitForSelector('text=Removed')
    
    // Verify songs are removed
    const remainingItems = await page.locator('[class*="border"][class*="gray"]').count()
    expect(remainingItems).toBeLessThan(checkboxes.length - 1)
  })
})

test.describe('Upload E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    const isLoggedIn = await page.evaluate(() => !!localStorage.getItem('token'))
    if (!isLoggedIn) {
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_EMAIL)
      await page.fill('input[type="password"]', TEST_PASSWORD)
      await page.click('button:has-text("Sign In")')
      await page.waitForURL(`${BASE_URL}/dashboard`)
    }
  })

  test('Upload CSV with songs', async ({ page }) => {
    // Navigate to songs section
    await page.click('button:has-text("songs")')
    
    // Click Upload Songs tab
    await page.click('button:has-text("Upload Songs")')
    
    // Create a test CSV file
    const csvContent = `title,artist,album,genre
Your Love Is King,Sade,Diamond Life,Soul
Bohemian Rhapsody,Queen,A Night at the Opera,Rock`
    
    const fileBuffer = Buffer.from(csvContent)
    
    // Upload file
    await page.setInputFiles('input[type="file"]', {
      name: 'songs.csv',
      mimeType: 'text/csv',
      buffer: fileBuffer
    })
    
    // Verify file is shown
    await page.waitForSelector('text=songs.csv')
    
    // Click Confirm Upload
    await page.click('button:has-text("Confirm Upload")')
    
    // Wait for upload to complete
    await page.waitForSelector('text=Upload Complete')
    
    // Verify success counts
    const successCount = await page.locator('text=/Added|Successfully/').first()
    await expect(successCount).toBeVisible()
  })
})
