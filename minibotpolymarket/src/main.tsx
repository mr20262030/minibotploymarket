import React, { useState, useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import '@solana/wallet-adapter-react-ui/styles.css'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { NetworkContext } from './NetworkContext'   // solo importamos el contexto
import App from './App'
import './index.css'

type Network = 'devnet' | 'mainnet'   // definimos el tipo aquí

const wallets = [new PhantomWalletAdapter()]

function Root() {
  const [network, setNetwork] = useState<Network>('devnet')
  const endpoint = useMemo(() => clusterApiUrl(network), [network])

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <App />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
