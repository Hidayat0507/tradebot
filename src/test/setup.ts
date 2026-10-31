import { vi } from 'vitest'

// Simulation is the harness default; live-path tests must mock every exchange call.
vi.stubEnv('TRADING_MODE', 'paper')
