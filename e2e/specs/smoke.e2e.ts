/**
 * Smoke test: app launches and shows either Login screen (unauthenticated)
 * or Home screen (authenticated). Uses testID as accessibility id.
 */
describe('Smart Pantry smoke', () => {
  it('should launch and show Login or Home', async () => {
    const loginTitle = $('~login-title');
    const homeTitle = $('~home-title');

    // Wait until either screen is visible (app may show loading spinner first)
    await browser.waitUntil(
      async () => (await loginTitle.isDisplayed()) || (await homeTitle.isDisplayed()),
      { timeout: 25000, interval: 500 }
    );

    const loginVisible = await loginTitle.isDisplayed();
    const homeVisible = await homeTitle.isDisplayed();
    expect(loginVisible || homeVisible).toBe(true);
  });
});
