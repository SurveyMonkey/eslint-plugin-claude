// Each docs script runs `main` when it is the entry file. The other tests
// import the script, so they skip that guard. These tests set the process
// arguments and import the script again, so v8 coverage sees the guard. Each
// case gives arguments that make `main` fail before it runs a command or
// reaches the network. The docs-classify case fails on a path that is not there.
// A second case in each group gives the script as a symbolic link. The entry
// check follows the link, as `node` does.
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')
const script = (name: string) => path.join(ROOT, 'scripts', `${name}.ts`)

const missing = mkdtempSync(path.join(tmpdir(), 'docs-entry-'))
rmSync(missing, { recursive: true })

const cases: [string, string[], RegExp][] = [
  ['docs-classify', [missing], /ENOENT/],
  ['docs-issues', [], /^usage: docs-issues\.ts/],
  ['docs-verify', [], /^usage: docs-verify\.ts/],
  ['docs-watch', ['--bogus'], /^unknown option --bogus$/],
]

describe.each(cases)('%s as the entry file', (name, args, message) => {
  const argv = process.argv
  const exitCode = process.exitCode
  afterEach(() => {
    process.argv = argv
    process.exitCode = exitCode
    vi.restoreAllMocks()
  })

  it('runs main with the arguments after the file name, and sets the exit code', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    process.argv = [process.execPath, script(name), ...args]
    // The query makes a new module, so the entry check runs again.
    await import(`${script(name)}?entry`)
    expect(error).toHaveBeenCalledOnce()
    expect(String(error.mock.calls[0]?.[0])).toMatch(message)
    expect(process.exitCode).toBe(1)
  })

  it('runs main when the entry file is a symbolic link to the script', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dir = mkdtempSync(path.join(tmpdir(), 'docs-entry-link-'))
    try {
      const link = path.join(dir, `${name}.ts`)
      symlinkSync(script(name), link)
      process.argv = [process.execPath, link, ...args]
      await import(`${script(name)}?link`)
    } finally {
      rmSync(dir, { recursive: true })
    }
    expect(error).toHaveBeenCalledOnce()
    expect(String(error.mock.calls[0]?.[0])).toMatch(message)
    expect(process.exitCode).toBe(1)
  })

  it('does nothing when another file is the entry file', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    process.argv = [process.execPath, script(name === 'docs-watch' ? 'docs-issues' : 'docs-watch')]
    process.argv.push(...args)
    await import(`${script(name)}?not-entry`)
    expect(error).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(exitCode)
  })

  it('does nothing when the process has no script path', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    process.argv = [process.execPath]
    await import(`${script(name)}?no-argv`)
    expect(error).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(exitCode)
  })
})
