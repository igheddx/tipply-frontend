import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe('Complete Authentication & Additional Features E2E', () => {
  test.describe('Forgot Password Flow', () => {
    test('complete forgot password and reset flow', async ({ page }) => {
      // Navigate to forgot password page
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Enter email
      await page.fill('input[type="email"]', 'user@example.com')

      // Submit
      await page.click('button:has-text("Send Reset Link")')

      // Verify confirmation message
      await expect(page.locator('text=Check your email')).toBeVisible()

      // Simulate clicking reset link in email (in real scenario)
      // Navigate to reset page with token
      await page.goto(`${BASE_URL}/auth/reset-password?token=test_reset_token_123`)

      // Enter new password
      await page.fill('input[placeholder*="new password"]', 'NewSecurePassword123!')
      await page.fill('input[placeholder*="confirm"]', 'NewSecurePassword123!')

      // Submit
      await page.click('button:has-text("Reset Password")')

      // Verify success
      await expect(page.locator('text=Password reset successfully')).toBeVisible()

      // Should redirect to login
      await page.waitForURL('**/auth/login')
    })

    test('shows error for non-existent email', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      await page.fill('input[type="email"]', 'nonexistent@example.com')
      await page.click('button:has-text("Send Reset Link")')

      await expect(page.locator('text=Email not found')).toBeVisible()
    })

    test('allows resending reset email', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      await page.fill('input[type="email"]', 'user@example.com')
      await page.click('button:has-text("Send Reset Link")')

      await expect(page.locator('text=Check your email')).toBeVisible()

      // Click resend
      await page.click('button:has-text("Resend")')

      await expect(page.locator('text=Email sent again')).toBeVisible()
    })

    test('prevents password reset with weak password', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/reset-password?token=test_token`)

      await page.fill('input[placeholder*="new password"]', 'weak')
      await page.fill('input[placeholder*="confirm"]', 'weak')

      const submitButton = page.locator('button:has-text("Reset Password")')
      await expect(submitButton).toBeDisabled()

      await expect(page.locator('text=Password must contain')).toBeVisible()
    })
  })

  test.describe('Email Verification Flow', () => {
    test('complete signup with email verification', async ({ page }) => {
      // Go to signup page
      await page.goto(`${BASE_URL}/auth/signup`)

      // Fill form
      await page.fill('input[placeholder*="first name"]', 'John')
      await page.fill('input[placeholder*="last name"]', 'Doe')
      await page.fill('input[type="email"]', 'john@example.com')
      await page.fill('input[type="password"]', 'SecurePassword123!')

      // Submit signup
      await page.click('button:has-text("Sign Up")')

      // Should show verification code input
      await expect(page.locator('text=Verify your email')).toBeVisible()
      await expect(page.locator('text=john@example.com')).toBeVisible()

      // Enter verification code
      await page.fill('input[placeholder*="code"]', '123456')

      // Submit
      await page.click('button:has-text("Verify")')

      // Should show success
      await expect(page.locator('text=Email verified')).toBeVisible()

      // Should redirect to dashboard/next step
      await page.waitForURL('**/dashboard|onboard')
    })

    test('shows error for invalid verification code', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/verify-email?email=user@example.com`)

      await page.fill('input[placeholder*="code"]', '000000')
      await page.click('button:has-text("Verify")')

      await expect(page.locator('text=Invalid code')).toBeVisible()
    })

    test('allows resending verification code', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/verify-email?email=user@example.com`)

      // Resend button should be visible
      const resendButton = page.locator('button:has-text("Resend")')
      await expect(resendButton).toBeVisible()

      await resendButton.click()

      await expect(page.locator('text=Code sent')).toBeVisible()
    })

    test('shows countdown timer for resend button', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/verify-email?email=user@example.com`)

      // First submit
      await page.fill('input[placeholder*="code"]', '000000')
      await page.click('button:has-text("Verify")')

      // Resend button should be disabled with timer
      const resendButton = page.locator('button:has-text("Resend")')
      
      if (await resendButton.isDisabled()) {
        await expect(resendButton).toContainText(/\d+/)
      }
    })
  })

  test.describe('Batch Processing - Song Upload', () => {
    test('complete batch CSV upload flow', async ({ page }) => {
      // Login first (assuming logged in)
      await page.goto(`${BASE_URL}/dashboard`)

      // Navigate to batch upload
      await page.click('button:has-text("Batch Upload")')

      // Upload CSV file
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles('frontend/e2e/fixtures/large-songs.csv')

      // Verify file selected
      await expect(page.locator('text=large-songs.csv')).toBeVisible()

      // Click upload
      await page.click('button:has-text("Upload")')

      // Verify progress bar
      await expect(page.locator('[role="progressbar"]')).toBeVisible()

      // Wait for completion
      await page.waitForSelector('text=Upload Complete', { timeout: 30000 })

      // Verify songs added
      await expect(page.locator('text=100 songs added')).toBeVisible()
    })

    test('handles CSV with duplicate songs', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)
      await page.click('button:has-text("Batch Upload")')

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles('frontend/e2e/fixtures/duplicates.csv')

      await page.click('button:has-text("Upload")')

      await page.waitForSelector('text=Upload Complete', { timeout: 30000 })

      // Should show deduplication summary
      await expect(page.locator('text=Duplicates removed|10 duplicates')).toBeVisible()
    })

    test('batch remove multiple songs', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/catalog`)

      // Select multiple songs using checkboxes
      const checkboxes = page.locator('input[type="checkbox"]')
      await checkboxes.first().check()
      await checkboxes.nth(1).check()
      await checkboxes.nth(2).check()

      // Click bulk delete
      await page.click('button:has-text("Remove Selected")')

      // Confirm deletion
      await page.click('button:has-text("Confirm|Yes")')

      // Verify songs removed
      await page.waitForSelector('text=3 songs removed', { timeout: 5000 })
    })
  })

  test.describe('Song Request Monitoring', () => {
    test('performer monitors song requests in real-time', async ({ browser }) => {
      const performerContext = await browser.newContext()
      const performerPage = await performerContext.newPage()
      const customerContext = await browser.newContext()
      const customerPage = await customerContext.newPage()

      // Performer: Go to request monitoring dashboard
      await performerPage.goto(`${BASE_URL}/dashboard/requests`)

      // Verify request queue is displayed
      await expect(performerPage.locator('text=Pending Requests')).toBeVisible()

      // Customer: Make a song request with tip
      await customerPage.goto(`${BASE_URL}/tip/device-uuid`)
      await customerPage.click('button:has-text("$10.00")')
      await customerPage.click('button:has-text("Complete Payment")')

      // Select song to request
      await customerPage.click('[data-testid="song-card"]')
      await customerPage.click('button:has-text("Confirm Request")')

      // Performer: Should see new request appear
      await performerPage.waitForSelector('text=New Request', { timeout: 5000 })

      // Verify request details
      await expect(performerPage.locator('text=$10')).toBeVisible()

      // Performer: Mark as completed
      await performerPage.click('button:has-text("Mark Played")')

      // Verify status updated
      await expect(performerPage.locator('text=Completed')).toBeVisible()

      await performerContext.close()
      await customerContext.close()
    })

    test('performer filters and sorts requests', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/requests`)

      // Filter by pending
      await page.click('select:has-option("Pending")')
      await page.selectOption('select', 'pending')

      // Verify only pending shown
      const rows = page.locator('[data-testid="request-row"]')
      const count = await rows.count()
      expect(count).toBeGreaterThan(0)

      // Sort by tip amount (highest first)
      await page.click('button:has-text("Sort by Amount")')

      // Verify sorted correctly (first amount >= second amount)
      const firstAmount = await rows.first().locator('[data-testid="tip-amount"]').textContent()
      const secondAmount = await rows.nth(1).locator('[data-testid="tip-amount"]').textContent()

      expect(parseFloat(firstAmount || '0')).toBeGreaterThanOrEqual(parseFloat(secondAmount || '0'))
    })

    test('performer views request statistics', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/requests`)

      // Verify statistics displayed
      await expect(page.locator('text=/Total Requests|\\d+/')).toBeVisible()
      await expect(page.locator('text=/Completion Rate|\\d+%/')).toBeVisible()
      await expect(page.locator('text=/Most Requested/')).toBeVisible()

      // Verify export button
      const exportButton = page.locator('button:has-text("Export")')
      await expect(exportButton).toBeVisible()

      // Click export
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()

      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/\.csv|\.json/)
    })
  })

  test.describe('QR Code Scanning - Complete Flow', () => {
    test('customer scans QR code and completes full flow', async ({ page }) => {
      // Simulate QR code scanner (in real app, camera input)
      const deviceUuid = 'test-device-uuid-123'

      // Navigate via QR code link
      await page.goto(`${BASE_URL}/tip/${deviceUuid}`)

      // Verify landing page loaded
      await expect(page.locator('text=Tip')).toBeVisible()
      await expect(page.locator('[data-testid="performer-info"]')).toBeVisible()

      // Select tip amount
      await page.click('button:has-text("$5.00")')

      // See catalog
      await expect(page.locator('text=Song')).toBeVisible()

      // Optional: select song
      await page.click('[data-testid="song-card"]')

      // Proceed to payment
      await page.click('button:has-text("Pay|Complete")')

      // Verify payment modal
      await expect(page.locator('text=Card Details|Payment')).toBeVisible()

      // Fill card details (in test environment)
      const cardFrame = page.frameLocator('iframe[src*="stripe"]').first()
      await cardFrame.locator('input[name="cardnumber"]').fill('4242424242424242')

      // Submit
      await page.click('button:has-text("Pay|Submit")')

      // Verify success
      await expect(page.locator('text=Thank You')).toBeVisible()
    })

    test('QR code works on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      const deviceUuid = 'test-device-uuid-123'
      await page.goto(`${BASE_URL}/tip/${deviceUuid}`)

      // Verify mobile-friendly layout
      const mainContainer = page.locator('[data-testid="tipping-container"]')
      const boundingBox = await mainContainer.boundingBox()

      expect(boundingBox?.width).toBeLessThanOrEqual(375)

      // Verify buttons are touch-friendly
      const buttons = page.locator('button')
      const firstButton = buttons.first()
      const buttonBox = await firstButton.boundingBox()

      expect(buttonBox?.height).toBeGreaterThanOrEqual(44)
    })
  })

  test.describe('Performer Onboarding - Complete Flow', () => {
    test('end-to-end performer onboarding from signup to live', async ({ browser }) => {
      const context = await browser.newContext()
      const page = await context.newPage()

      // Step 1: Signup as performer
      await page.goto(`${BASE_URL}/auth/signup?type=performer`)

      await page.fill('input[placeholder*="first"]', 'Jane')
      await page.fill('input[placeholder*="last"]', 'Smith')
      await page.fill('input[type="email"]', 'jane@example.com')
      await page.fill('input[type="password"]', 'SecurePassword123!')

      await page.click('button:has-text("Sign Up")')

      // Step 2: Email verification
      await expect(page.locator('text=Verify your email')).toBeVisible()
      await page.fill('input[placeholder*="code"]', '123456')
      await page.click('button:has-text("Verify")')

      // Step 3: Profile information
      await page.fill('input[placeholder*="bio"]', 'Singer and musician')
      await page.click('button:has-text("Next|Continue")')

      // Step 4: Stripe Connect
      await expect(page.locator('button:has-text("Connect Stripe")')).toBeVisible()
      await page.click('button:has-text("Connect Stripe")')

      // Simulate Stripe callback
      await page.goto(`${BASE_URL}/onboard?code=sk_test_123`)

      // Step 5: Enable tipping
      const tippingToggle = page.locator('input[type="checkbox"]')
      await tippingToggle.check()

      // Step 6: QR code appears
      await expect(page.locator('img[alt*="QR"]')).toBeVisible()

      // Step 7: Register device
      await page.fill('input[placeholder*="device"]', 'Main Stage')
      await page.click('button:has-text("Register")')

      // Step 8: Upload songs
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles('frontend/e2e/fixtures/sample-songs.csv')

      await page.click('button:has-text("Upload")')

      // Step 9: Completion
      await page.click('button:has-text("Finish")')

      // Verify redirect to dashboard
      await page.waitForURL('**/dashboard')

      await expect(page.locator('text=Welcome|Dashboard')).toBeVisible()

      await context.close()
    })
  })
})
