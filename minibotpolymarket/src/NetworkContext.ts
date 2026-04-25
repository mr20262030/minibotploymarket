import { createContext } from 'react'

export type Network = 'devnet' | 'mainnet'

export const NetworkContext = createContext<{
  network: Network
  setNetwork: (n: Network) => void
}>({
  network: 'devnet',
  setNetwork: () => {},
})
