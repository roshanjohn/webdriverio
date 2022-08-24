import assert from 'node:assert'

describe('my feature', () => {
    beforeEach(() => {})
    afterEach(() => {})

    it('should do stuff', async () => {
        assert.equal(await browser.getTitle(), 'Mock Page Title')
    })

    it('should fail', async () => {
        assert.equal(await browser.getTitle()).toBe('Oh, no!')
    })
})
