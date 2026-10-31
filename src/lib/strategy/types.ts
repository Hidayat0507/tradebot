export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const SOURCES = ['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3'] as const
export type SourceName = (typeof SOURCES)[number]
export const FUNCS = ['sma', 'ema', 'rsi', 'crossover', 'crossunder', 'atr', 'macd', 'macd_signal', 'macd_hist'] as const
/** Argument count per function; args after the first series are constant lengths (except crossover/crossunder). */
export const FUNC_ARITY: Record<FuncName, number> = { sma: 2, ema: 2, rsi: 2, crossover: 2, crossunder: 2, atr: 1, macd: 4, macd_signal: 4, macd_hist: 4 }
export type FuncName = (typeof FUNCS)[number]
export const BIN_OPS = ['+', '-', '*', '/', '>', '<', '>=', '<=', '==', '!=', 'and', 'or'] as const
export type BinOp = (typeof BIN_OPS)[number]

export type Expr =
  | { type: 'num'; value: number }
  | { type: 'bool'; value: boolean }
  | { type: 'src'; name: SourceName }
  | { type: 'ref'; name: string }
  | { type: 'call'; fn: FuncName; args: Expr[] }
  | { type: 'bin'; op: BinOp; left: Expr; right: Expr }
  | { type: 'not'; arg: Expr }
  | { type: 'neg'; arg: Expr }
  /** Pine history reference: arg[offset] */
  | { type: 'hist'; arg: Expr; offset: number }

export interface Rule {
  action: 'entry' | 'close' | 'close_all' | 'exit'
  id: string
  direction?: 'long' | 'short'
  when: Expr
  /** exit only: entry id to protect (undefined = any position) */
  fromEntry?: string
  /** exit only: stop-loss / take-profit price expressions */
  stop?: Expr
  limit?: Expr
}

export interface StrategyDefinition {
  version: 1
  name: string
  inputs: Record<string, number>
  /** Ordered variable definitions; may reference inputs and earlier vars. */
  vars: { name: string; expr: Expr }[]
  rules: Rule[]
}

export interface Signal {
  index: number
  time: number
  action: Rule['action']
  id: string
  direction?: 'long' | 'short'
  price: number
  fromEntry?: string
  stop?: number
  limit?: number
}

export const LIMITS = {
  maxSourceBytes: 20_000,
  maxNodes: 500,
  maxLength: 1000,
  maxCandles: 5000,
} as const
