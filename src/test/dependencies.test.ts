import { describe, expect, it } from 'vitest'
import manifest from '../../package.json'

describe('dependency security configuration', () => {
  it('keeps Next 15 and its lint and WASM packages aligned', () => {
    expect(manifest.dependencies.next).toMatch(/^15\./)
    expect(manifest.devDependencies['eslint-config-next']).toBe(manifest.dependencies.next)
    expect(manifest.devDependencies['@next/swc-wasm-nodejs']).toBe(manifest.dependencies.next)
  })

  it.each(['protobufjs', 'crypto-js', 'http-proxy-agent', 'https-proxy-agent', 'socks-proxy-agent', 'express', 'body-parser'])(
    'does not directly depend on unused %s', (name) => {
      expect(manifest.dependencies).not.toHaveProperty(name)
      expect(manifest.devDependencies).not.toHaveProperty(name)
    },
  )
})
