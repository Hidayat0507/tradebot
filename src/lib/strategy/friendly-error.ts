/** Supported Pine subset, shown in the UI (single source, keep in sync with the parser). */
export const SUPPORTED_PINE = {
  indicators: ['ta.sma', 'ta.ema', 'ta.rsi', 'ta.atr', 'ta.macd', 'ta.crossover', 'ta.crossunder'],
  orders: ['strategy.entry', 'strategy.close', 'strategy.close_all', 'strategy.exit (stop/limit)'],
  other: ['input / input.int / input.float', 'history x[1]', 'if blocks', 'and / or / not'],
} as const

export interface FriendlyError {
  title: string
  hint: string
  line?: number
  lineText?: string
}

const SUPPORTED_SHORT = SUPPORTED_PINE.indicators.join(', ')

/** Turns parser / API errors into plain-language guidance with the offending line. */
export function friendlyPineError(raw: string, source = '', status?: number): FriendlyError {
  if (status === 401) return { title: 'You are signed out', hint: 'Sign in again, then retry.' }
  if (status === 429) return { title: 'Too many requests', hint: 'Wait a few seconds and try again.' }
  if (status === 400) return { title: 'Some settings are invalid', hint: 'Check the exchange, symbol (like BTC/USDT) and timeframe.' }
  if (status && status >= 500) return { title: 'Something went wrong on our side', hint: 'Try again. If it keeps happening, try sample candles.' }

  const m = /^line (\d+): ([\s\S]*)$/.exec(raw)
  const line = m ? Number(m[1]) : undefined
  const msg = m ? m[2] : raw
  const lineText = line ? source.split(/\r?\n/)[line - 1]?.trim() : undefined
  const at = { line, lineText }
  let r: RegExpExecArray | null

  if ((r = /unsupported (?:function|identifier) (\S+)/.exec(msg))) {
    const name = r[1]
    if (name === 'ta.macd' || /use \[m, s, h\]/.test(msg))
      return { title: 'Write ta.macd as a tuple', hint: 'Use [macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9).', ...at }
    if (name.startsWith('request.')) return { title: `${name} isn't supported`, hint: 'Other symbols or timeframes are not supported yet. Use data from this chart only.', ...at }
    return { title: `${name} isn't supported yet`, hint: `Supported indicators: ${SUPPORTED_SHORT}.`, ...at }
  }
  if (/indicator scripts are not strategies/.test(msg))
    return { title: 'This is an indicator, not a strategy', hint: 'Paste a script that starts with strategy("Name") and uses strategy.entry.', ...at }
  if (/missing strategy\(/.test(msg))
    return { title: 'No strategy(...) line found', hint: 'Add strategy("My strategy") near the top of the script.', ...at }
  if (/no strategy\.entry/.test(msg))
    return { title: 'No entries found', hint: 'Add at least one strategy.entry("Long", strategy.long) or strategy.close(...).', ...at }
  if (/var \/ := not supported/.test(msg))
    return { title: 'var and := are not supported yet', hint: 'Rewrite as plain assignments (x = ...). Values that build up over bars are not supported yet.', ...at }
  if (/history offset must be an integer/.test(msg))
    return { title: 'History needs a fixed number', hint: 'Use close[1] or close[2], not close[n].', ...at }
  if (/nested if/.test(msg)) return { title: 'Nested if is not supported', hint: 'Combine conditions with "and" in one if.', ...at }
  if (/strategy\.exit .*not supported|strategy\.exit needs/.test(msg))
    return { title: 'strategy.exit needs price levels', hint: 'Use stop = close * 0.98 and/or limit = close * 1.04. profit=/loss= ticks are not supported yet.', ...at }
  if (/length must be a constant/.test(msg))
    return { title: 'Indicator length must be a number or input', hint: 'For example ta.ema(close, 20) or ta.ema(close, len) where len = input.int(20).', ...at }
  if (/unexpected indentation/.test(msg))
    return { title: 'Unexpected indentation', hint: 'Only lines inside an if block should be indented.', ...at }
  if (/AI conversion is not enabled/.test(msg))
    return { title: 'This script needs features that aren\'t supported yet', hint: `Supported: ${SUPPORTED_SHORT}.`, ...at }
  return { title: "We couldn't read this script", hint: msg, ...at }
}
