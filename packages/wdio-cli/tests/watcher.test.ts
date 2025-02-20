import { vi, describe, it, expect, afterEach } from 'vitest'
import path from 'node:path'
import chokidar from 'chokidar'
import EventEmitter from 'node:events'
import type { Workers } from '@wdio/types'

import type { RunCommandArguments } from '../src/types'
import Watcher from '../src/watcher.js'

vi.mock('chokidar')
vi.mock('@wdio/logger', () => import(path.join(process.cwd(), '__mocks__', '@wdio/logger')))
vi.mock('@wdio/config', () => import(path.join(process.cwd(), '__mocks__', '@wdio/config')))
vi.mock('@wdio/utils', () => import(path.join(process.cwd(), '__mocks__', '@wdio/utils')))
vi.mock('../src/launcher', async () => {
    const { ConfigParser } = await import('@wdio/config')

    interface LauncherMockRunCommandArguments extends Omit<RunCommandArguments, 'configPath'> {
        isMultiremote?: boolean;
    }

    class LauncherMock {
        configParser = new ConfigParser()
        isMultiremote: boolean
        runner: any
        interface: any

        constructor (configFile: string, args: LauncherMockRunCommandArguments) {
            if ( this.configParser.autoCompile ) {
                this.configParser.autoCompile()
            }
            this.configParser.addConfigFile(configFile)
            this.configParser.merge(args)
            this.isMultiremote = args.isMultiremote || false
            this.runner = {}
            this.interface = {
                emit: vi.fn(),
                setup: vi.fn()
            }
        }
    }
    return { default: LauncherMock }
})

interface WorkerMockRunPayload extends Partial<Workers.WorkerRunPayload> {
    isBusy?: boolean;
    sessionId?: string;
    specs: string[];
}

class WorkerMock extends EventEmitter implements Workers.Worker {
    cid: string
    specs: string[]
    caps: WebDriver.DesiredCapabilities
    capabilities: WebDriver.DesiredCapabilities
    sessionId: string
    isBusy: boolean
    postMessage = vi.fn()

    constructor ({ cid, specs, sessionId, isBusy = false }: WorkerMockRunPayload) {
        super()
        this.cid = cid || `${Math.random()}`
        this.specs = specs
        this.caps = { browserName: 'chrome' }
        this.capabilities = this.caps
        this.sessionId = sessionId || `${Math.random()}`
        this.isBusy = isBusy
        this.on = vi.fn()
    }
}

describe('watcher', () => {
    it('should initialise properly', async () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        expect(watcher['_specs']).toEqual([
            './tests/test1.js',
            './tests/test2.js'
        ])
    })

    it('should initialise properly in Multiremote', async () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, { isMultiremote: true } as any)
        expect(watcher['_specs']).toEqual([
            './tests/test1.js',
        ])
    })

    it('should run initial suite when starting watching', async () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        watcher['_launcher'] = {
            run: vi.fn(),
            interface: {
                finalise: vi.fn()
            },
            configParser: {
                getConfig: vi.fn().mockReturnValue({ filesToWatch: [] })
            },
            runner: {
                workerPool: {
                    '0-0': new WorkerMock({ specs: ['./tests/test1.js'] })
                }
            }
        } as any
        await watcher.watch()

        expect(chokidar.watch).toHaveBeenCalledTimes(1)
    })

    it('should run initial suite when starting watching with grouped specs', async () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        watcher['_launcher'] = {
            run: vi.fn(),
            interface: {
                finalise: vi.fn()
            },
            configParser: {
                getConfig: vi.fn().mockReturnValue({ filesToWatch: [] })
            },
            runner: {
                workerPool: {
                    '0-0': new WorkerMock(<WorkerMockRunPayload>{ specs: ['/a.js', ['/b.js', '/c.js', '/d.js'], 'e.js'] })
                }
            }
        } as any
        await watcher.watch()

        expect(chokidar.watch).toHaveBeenCalledTimes(1)
    })

    it('should run also watch `filesToWatch` files', async () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        watcher['_launcher'] = {
            run: vi.fn(),
            interface: {
                finalise: vi.fn()
            },
            configParser: {
                getConfig: vi.fn().mockReturnValue({ filesToWatch: ['/foo/bar'] })
            },
            runner: {
                workerPool: {
                    '0-0': new WorkerMock({ specs: ['./tests/test1.js'] })
                }
            }
        } as any
        await watcher.watch()

        expect(chokidar.watch).toHaveBeenCalledTimes(2)

        const worker = watcher['_launcher'].runner!.workerPool['0-0']
        expect(worker.on).toBeCalledTimes(1)

        const eventHandler = worker.on.mock.calls[0][1]
        expect(watcher['_launcher'].interface!.finalise).toBeCalledTimes(0)
        worker.isBusy = true
        eventHandler()
        expect(watcher['_launcher'].interface!.finalise).toBeCalledTimes(0)
        worker.isBusy = false
        eventHandler()
        expect(watcher['_launcher'].interface!.finalise).toBeCalledTimes(1)
    })

    it('should call run with modifed path when a new file was changed or added', async () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        watcher['_launcher'] = {
            run: vi.fn(),
            interface: {
                finalise: vi.fn()
            },
            configParser: {
                getConfig: vi.fn().mockReturnValue({ filesToWatch: ['/foo/bar'] })
            },
            runner: {
                workerPool: {
                    '0-0': new WorkerMock({ specs: ['./tests/test1.js'] })
                }
            }
        } as any
        watcher.run = vi.fn()
        await watcher.watch()

        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[0][1]('/some/path.js')
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[1][1]('/some/other/path.js')
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[2][1]('/some/another/path.js')
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[3][1]('/some/another/path.js')
        expect(watcher.run).toHaveBeenNthCalledWith(1, { spec: '/some/path.js' })
        expect(watcher.run).toHaveBeenNthCalledWith(2, { spec: '/some/other/path.js' })
        expect(watcher.run).toHaveBeenNthCalledWith(3, {})
        expect(watcher.run).toHaveBeenNthCalledWith(4, {})
    })

    it('should get workers by pickBy function', () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        const workerPool = {
            '0-0': new WorkerMock({ cid: '0-0', specs: ['/foo/bar.js'] }),
            '0-1': new WorkerMock({ cid: '0-1', specs: ['/foo/bar2.js'], isBusy: true }),
            '1-0': new WorkerMock({ cid: '1-0', specs: ['/bar/foo.js'] })
        }
        watcher['_launcher'].runner!.workerPool = workerPool

        expect(watcher.getWorkers(null, true)).toEqual(workerPool)
        expect(watcher.getWorkers()).toEqual({
            '0-0': workerPool['0-0'],
            '1-0': workerPool['1-0']
        })
        expect(watcher.getWorkers(
            (worker: Workers.Worker) => worker.specs.includes('/bar/foo.js'))
        ).toEqual({ '1-0': workerPool['1-0'] })
    })

    it('should run workers on existing session', () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        watcher['_launcher'].runner!.workerPool = {
            // @ts-ignore mock feature
            '0-0': new WorkerMock({ cid: '0-0', specs: ['/foo/bar.js'] }),
            '0-1': new WorkerMock({ cid: '0-1', specs: ['/foo/bar2.js'], isBusy: true }),
            // @ts-ignore mock feature
            '1-0': new WorkerMock({ cid: '1-0', specs: ['/bar/foo.js'] })
        }
        watcher['_launcher'].interface!.emit = vi.fn()
        watcher.run({ spec: '/foo/bar.js' } as any)
        expect(watcher['_launcher'].interface!.emit).toHaveBeenCalledWith('job:start', {
            cid: '0-0',
            caps: { browserName: 'chrome' },
            specs: ['/foo/bar.js']
        })

        const { postMessage, sessionId } = watcher['_launcher'].runner!.workerPool['0-0']
        expect(postMessage).toHaveBeenCalledWith('run', { sessionId, spec: '/foo/bar.js' })
        expect(watcher['_launcher'].interface!.totalWorkerCnt).toBe(1)
    })

    it('should not clean if no watcher is running', () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        watcher['_launcher'].runner!.workerPool = {
            // @ts-ignore mock feature
            '0-0': new WorkerMock({ cid: '0-0', specs: ['/foo/bar.js'] }),
            '0-1': new WorkerMock({ cid: '0-1', specs: ['/foo/bar2.js'], isBusy: true }),
            // @ts-ignore mock feature
            '1-0': new WorkerMock({ cid: '1-0', specs: ['/bar/foo.js'] })
        }
        watcher['_launcher'].interface!.emit = vi.fn()
        watcher.run({ spec: '/foo/bar2.js' } as any)
        expect(watcher['_launcher'].interface!.emit).toHaveBeenCalledTimes(0)
    })

    it('should run all tests if `filesToWatch` entry was changed', () => {
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        watcher['_launcher'].interface!.totalWorkerCnt = 1
        watcher.cleanUp = vi.fn()
        watcher['_launcher'].runner!.workerPool = {
            // @ts-ignore mock feature
            '0-0': new WorkerMock({ cid: '0-0', specs: ['/foo/bar.js'] }),
            '0-1': new WorkerMock({ cid: '0-1', specs: ['/foo/bar2.js'], isBusy: true }),
            // @ts-ignore mock feature
            '1-0': new WorkerMock({ cid: '1-0', specs: ['/bar/foo.js'] })
        }
        watcher.run()

        expect(watcher['_launcher'].interface!.totalWorkerCnt).toBe(2)

        const worker00 = watcher['_launcher'].runner!.workerPool['0-0']
        expect(worker00.postMessage).toHaveBeenCalledWith(
            'run',
            { sessionId: worker00.sessionId })
        expect(watcher['_launcher'].interface!.emit).toHaveBeenCalledWith('job:start', {
            cid: '0-0',
            caps: { browserName: 'chrome' },
            specs: ['/foo/bar.js'] })

        const worker10 = watcher['_launcher'].runner!.workerPool['0-0']
        expect(worker10.postMessage).toHaveBeenCalledWith(
            'run',
            { sessionId: worker10.sessionId })
        expect(watcher['_launcher'].interface!.emit).toHaveBeenCalledWith('job:start', {
            cid: '1-0',
            caps: { browserName: 'chrome' },
            specs: ['/bar/foo.js'] })
    })

    it('should re-run all specs when the --spec command line option is set and a filesToWatch file is added or changed', async () => {
        const spec = ['/some/path.js', '/some/other/path.js']
        const someOtherExcludedPath = '/some/other/excluded/path.js'
        const filesToWatch = ['/some/another/path.js']
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        watcher['_launcher'] = {
            __args: { spec },
            run: vi.fn(),
            interface: {
                emit: vi.fn(),
                finalise: vi.fn()
            },
            configParser: {
                getConfig: vi.fn().mockReturnValue({ filesToWatch })
            },
            runner: {
                workerPool: {
                    '0-0': new WorkerMock({ cid: '0-0', specs: [spec[0]] }),
                    '0-1': new WorkerMock({ cid: '0-1', specs: [spec[1]] })
                }
            }
        } as any
        const runSpy = vi.spyOn(watcher, 'run')
        const emitSpy = watcher['_launcher'].interface!.emit
        watcher.cleanUp = vi.fn()
        await watcher.watch()

        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[0][1](spec[0])
        expect(runSpy).toHaveBeenNthCalledWith(1, { spec: spec[0] })
        expect(emitSpy).toHaveBeenCalledTimes(1) // Only one Worker called

        vi.mocked(emitSpy).mockClear()
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[1][1](someOtherExcludedPath)
        expect(runSpy).toHaveBeenNthCalledWith(2, { spec: someOtherExcludedPath })
        expect(emitSpy).not.toHaveBeenCalled() // No Workers called

        vi.mocked(emitSpy).mockClear()
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[2][1](filesToWatch[0])
        expect(runSpy).toHaveBeenNthCalledWith(3, {})
        expect(emitSpy).toHaveBeenCalledTimes(2) // Both Workers called

        vi.mocked(emitSpy).mockClear()
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[3][1](filesToWatch[0])
        expect(runSpy).toHaveBeenNthCalledWith(4, {})
        expect(emitSpy).toHaveBeenCalledTimes(2) // Both Workers called
    })

    it('should re-run all specs, with grouped specs, when the --spec command line option is set and a filesToWatch file is added or changed', async () => {
        const spec = ['/a.js', ['/b.js', '/c.js', '/d.js']]
        const someOtherExcludedPath = '/some/other/excluded/path.js'
        const filesToWatch = ['/some/another/path.js']
        const wdioConf = path.join(__dirname, '__fixtures__', 'wdio.conf')
        const watcher = new Watcher(wdioConf, {})
        // @ts-ignore
        watcher['_launcher'] = {
            __args: { spec },
            run: vi.fn(),
            interface: {
                emit: vi.fn(),
                finalise: vi.fn()
            },
            configParser: {
                getConfig: vi.fn().mockReturnValue({ filesToWatch })
            },
            runner: {
                workerPool: {
                    '0-0': new WorkerMock({ cid: '0-0', specs: [spec[0] as any] }),
                    '0-1': new WorkerMock({ cid: '0-1', specs: [spec[1] as any] })
                }
            }
        } as any
        const runSpy = vi.spyOn(watcher, 'run')
        const emitSpy = watcher['_launcher'].interface!.emit
        watcher.cleanUp = vi.fn()
        await watcher.watch()

        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[0][1](spec[0])
        expect(runSpy).toHaveBeenNthCalledWith(1, { spec: spec[0] })
        expect(emitSpy).toHaveBeenCalledTimes(1) // Only one Worker called

        vi.mocked(emitSpy).mockClear()
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[1][1](someOtherExcludedPath)
        expect(runSpy).toHaveBeenNthCalledWith(2, { spec: someOtherExcludedPath })
        expect(emitSpy).not.toHaveBeenCalled() // No Workers called

        vi.mocked(emitSpy).mockClear()
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[2][1](filesToWatch[0])
        expect(runSpy).toHaveBeenNthCalledWith(3, {})
        expect(emitSpy).toHaveBeenCalledTimes(2) // Both Workers called

        vi.mocked(emitSpy).mockClear()
        // @ts-ignore mock feature
        vi.mocked(chokidar.on).mock.calls[3][1](filesToWatch[0])
        expect(runSpy).toHaveBeenNthCalledWith(4, {})
        expect(emitSpy).toHaveBeenCalledTimes(2) // Both Workers called
    })

    afterEach(() => {
        vi.mocked(chokidar.watch).mockClear()
        // @ts-ignore mock feature
        chokidar.on.mockClear()
    })
})
