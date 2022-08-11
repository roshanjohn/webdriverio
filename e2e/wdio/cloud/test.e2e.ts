describe('this browser session', () => {
    it('should run in SL', () => {
        expect(browser.options.hostname).toContain('saucelabs.com');
        expect(browser.options.protocol).toEqual('https');
        expect(browser.options.user).toEqual(process.env.SAUCE_USERNAME);
        expect(browser.options.key).toEqual(process.env.SAUCE_ACCESS_KEY);
    })
})
