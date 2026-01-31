import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe('Complete Payment & Tipping Flow', () => {
  test('Full performer onboarding to tip acceptance flow', async ({ page }) => {
    // Step 1: Navigate to performer onboarding
    await page.goto(`${BASE_URL}/onboard`)

    // Step 2: Fill in performer profile
    await page.fill('input[placeholder*="first"]', 'Jane')
    await page.fill('input[placeholder*="last"]', 'Smith')
    await page.fill('input[placeholder*="email"]', 'jane@example.com')
    await page.fill('textarea[placeholder*="bio"]', 'Singer and musician')

    // Step 3: Submit profile
    await page.click('button:has-text("Next")')
    await page.waitForURL('**/onboard/stripe')

    // Step 4: Initiate Stripe Connect
    await page.click('button:has-text("Connect Stripe Account")')

    // Step 5: Simulate Stripe OAuth callback
    await page.goto(`${BASE_URL}/onboard/stripe?code=sk_test_123`)
    await expect(page.locator('text=Account Connected')).toBeVisible()

    // Step 6: Enable tipping
    const tippingToggle = page.locator('input[type="checkbox"]')
    await tippingToggle.check()

    // Step 7: Verify QR code appears
    await expect(page.locator('img[alt*="QR"]')).toBeVisible()

    // Step 8: Download QR code
    const downloadPromise = page.waitForEvent('popup')
    await page.click('button:has-text("Download QR Code")')

    // Step 9: Register device
    await page.fill('input[placeholder*="device"]', 'Main Stage Device')
    await page.click('button:has-text("Register Device")')

    // Step 10: Verify device registered
    await expect(page.locator('text=Device Registered')).toBeVisible()

    // Step 11: Upload songs
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('frontend/e2e/fixtures/sample-songs.csv')

    await expect(page.locator('text=Your Love Is King')).toBeVisible()
    await expect(page.locator('text=Smooth Criminal')).toBeVisible()

    // Step 12: Complete onboarding
    await page.click('button:has-text("Finish Setup")')
    await page.waitForURL('**/dashboard')
  })

  test('Customer scans QR and completes payment flow', async ({ browser }) => {
    const performerContext = await browser.newContext()
    const performerPage = await performerContext.newPage()

    const customerContext = await browser.newContext()
    const customerPage = await customerContext.newPage()

    // Performer: Setup complete with tipping enabled
    await performerPage.goto(`${BASE_URL}/dashboard`)

    // Get QR code value (device UUID)
    const qrImage = performerPage.locator('img[alt*="QR"]')
    const qrSrc = await qrImage.getAttribute('src')
    const deviceUuid = new URL(qrSrc).searchParams.get('data')

    // Customer: Navigate to tipping interface via QR code
    await customerPage.goto(`${BASE_URL}/tip/${deviceUuid}`)

    // Step 1: Verify performer info displays
    await expect(customerPage.locator('text=Jane Smith')).toBeVisible()

    // Step 2: Verify songs are displayed
    await expect(customerPage.locator('text=Your Love Is King')).toBeVisible()
    await expect(customerPage.locator('text=Smooth Criminal')).toBeVisible()

    // Step 3: Select preset tip amount
    await customerPage.click('button:has-text("$5.00")')

    // Step 4: Verify amount is selected
    const amountInput = customerPage.locator('input[placeholder*="amount"]')
    await expect(amountInput).toHaveValue('500')

    // Step 5: Click to pay
    await customerPage.click('button:has-text("Complete Payment")')

    // Step 6: Complete Stripe payment (mock)
    await customerPage.waitForSelector('iframe[src*="stripe"]', { timeout: 5000 })

    // Step 7: Enter card details in iframe
    const cardFrame = customerPage.frameLocator('iframe[src*="stripe"]').first()
    await cardFrame.locator('input[name="cardnumber"]').fill('4242424242424242')
    await cardFrame.locator('input[name="exp-date"]').fill('12/25')
    await cardFrame.locator('input[name="cvc"]').fill('123')

    // Step 8: Submit payment
    await customerPage.click('button:has-text("Pay")')

    // Step 9: Verify confirmation
    await expect(customerPage.locator('text=Thank You')).toBeVisible({ timeout: 10000 })
    await expect(customerPage.locator('text=$5.00')).toBeVisible()
    await expect(customerPage.locator('text=Jane Smith')).toBeVisible()

    // Step 10: Optional - select song request
    const songRequest = customerPage.locator('button:has-text("Request Song")').first()
    if (await songRequest.isVisible()) {
      await songRequest.click()
      await expect(customerPage.locator('text=Song Requested')).toBeVisible()
    }

    // Performer: Verify tip appears in dashboard
    await performerPage.goto(`${BASE_URL}/dashboard/tips`)
    await expect(performerPage.locator('text=Jane Smith')).toBeVisible()
    await expect(performerPage.locator('text=$5.00')).toBeVisible()

    // Performer: Verify total balance updated
    await expect(performerPage.locator('text=/\\$.*balance/')).toBeVisible()

    await performerContext.close()
    await customerContext.close()
  })

  test('Multiple customers can tip same performer', async ({ browser }) => {
    const performerContext = await browser.newContext()
    const performerPage = await performerContext.newPage()

    // Setup performer with tipping enabled
    await performerPage.goto(`${BASE_URL}/dashboard`)
    const qrImage = performerPage.locator('img[alt*="QR"]')
    const qrSrc = await qrImage.getAttribute('src')
    const deviceUuid = new URL(qrSrc).searchParams.get('data')

    // Customer 1: Tip $10
    const customer1Context = await browser.newContext()
    const customer1Page = await customer1Context.newPage()
    await customer1Page.goto(`${BASE_URL}/tip/${deviceUuid}`)
    await customer1Page.click('button:has-text("$10.00")')
    await customer1Page.click('button:has-text("Complete Payment")')
    await expect(customer1Page.locator('text=Thank You')).toBeVisible({ timeout: 10000 })

    // Customer 2: Tip $25
    const customer2Context = await browser.newContext()
    const customer2Page = await customer2Context.newPage()
    await customer2Page.goto(`${BASE_URL}/tip/${deviceUuid}`)
    await customer2Page.click('button:has-text("$25.00")')
    await customer2Page.click('button:has-text("Complete Payment")')
    await expect(customer2Page.locator('text=Thank You')).toBeVisible({ timeout: 10000 })

    // Customer 3: Tip custom amount $7.50
    const customer3Context = await browser.newContext()
    const customer3Page = await customer3Context.newPage()
    await customer3Page.goto(`${BASE_URL}/tip/${deviceUuid}`)
    const customAmountInput = customer3Page.locator('input[placeholder*="custom"]')
    await customAmountInput.fill('750')
    await customer3Page.click('button:has-text("Complete Payment")')
    await expect(customer3Page.locator('text=Thank You')).toBeVisible({ timeout: 10000 })

    // Performer: Verify all tips show in dashboard
    await performerPage.goto(`${BASE_URL}/dashboard/tips`)

    // Check total tips (should be $42.50 total)
    const totalText = performerPage.locator('text=/\\$42\\.50/')
    await expect(totalText).toBeVisible()

    // Check individual tips appear
    const tips = performerPage.locator('[data-testid="tip-row"]')
    const count = await tips.count()
    expect(count).toBe(3)

    await performerContext.close()
    await customer1Context.close()
    await customer2Context.close()
    await customer3Context.close()
  })

  test('Handles failed payment gracefully', async ({ page }) => {
    // Navigate to tipping interface
    await page.goto(`${BASE_URL}/tip/device-123`)

    // Select tip amount
    await page.click('button:has-text("$5.00")')

    // Attempt payment
    await page.click('button:has-text("Complete Payment")')

    // Use declined card to trigger failure
    const cardFrame = page.frameLocator('iframe[src*="stripe"]').first()
    await cardFrame.locator('input[name="cardnumber"]').fill('4000000000000002')
    await cardFrame.locator('input[name="exp-date"]').fill('12/25')
    await cardFrame.locator('input[name="cvc"]').fill('123')

    await page.click('button:has-text("Pay")')

    // Verify error message
    await expect(page.locator('text=Payment Failed|Card Declined')).toBeVisible({ timeout: 5000 })

    // Verify user can retry
    const retryButton = page.locator('button:has-text("Try Again")')
    await expect(retryButton).toBeVisible()
  })

  test('Performer can view tip statistics', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/tips`)

    // Verify statistics panel displays
    await expect(page.locator('text=/Total Tips|Total Revenue/')).toBeVisible()
    await expect(page.locator('text=/Average Tip|Total Customers/')).toBeVisible()

    // Verify tip list with details
    const tipRows = page.locator('[data-testid="tip-row"]')
    const count = await tipRows.count()
    expect(count).toBeGreaterThan(0)

    // Click on a tip to see details
    const firstTip = tipRows.first()
    await firstTip.click()

    // Verify detail modal opens
    await expect(page.locator('text=Tip Details|Amount|Customer')).toBeVisible()

    // Verify export functionality
    const exportButton = page.locator('button:has-text("Export|Download")')
    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/\.csv|\.json/)
    }
  })

  test('Song request functionality with tipping', async ({ page }) => {
    // Navigate to tipping interface
    await page.goto(`${BASE_URL}/tip/device-123`)

    // Select song first (if interface requires)
    const songCards = page.locator('[data-testid="song-card"]')
    const firstSong = songCards.first()
    const songTitle = await firstSong.locator('text').first().textContent()

    await firstSong.click('button:has-text("Select|Choose")')

    // Select tip amount
    await page.click('button:has-text("$10.00")')

    // Complete payment
    await page.click('button:has-text("Complete Payment")')

    // Verify confirmation includes song info
    await expect(page.locator(`text=${songTitle}`)).toBeVisible()
    await expect(page.locator('text=$10.00')).toBeVisible()

    // Performer receives notification
    // (In real app, would use WebSocket or polling)
  })

  test('QR code scanning with mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Navigate to device with QR
    await page.goto(`${BASE_URL}/tip/device-123`)

    // Verify interface is mobile responsive
    const mainContainer = page.locator('[data-testid="tipping-container"]')
    const boundingBox = await mainContainer.boundingBox()

    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(375)
    }

    // Verify buttons are touch-friendly (min 48px)
    const buttons = page.locator('button')
    const count = await buttons.count()

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i)
      const box = await button.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(48)
        expect(box.width).toBeGreaterThanOrEqual(48)
      }
    }
  })
})
