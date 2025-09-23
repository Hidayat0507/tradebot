import { BotBalance } from './bot-balance'

interface BitgetBalanceProps {
  botId: string
}

export function BitgetBalance({ botId }: BitgetBalanceProps) {
  return <BotBalance botId={botId} />
}
