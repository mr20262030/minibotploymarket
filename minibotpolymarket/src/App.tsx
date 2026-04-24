// Librerias de React y extras
import { Buffer } from 'buffer'
globalThis.Buffer = Buffer
import { useState, useEffect } from 'react'

// Librerias Web3
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  type AccountMeta as Web3AccountMeta,
} from '@solana/web3.js'
import { address } from '@solana/kit'
import type { Address, AccountMeta } from '@solana/kit'

// Instrucciones del Cliente generado
import { getIniciarBaulInstruction } from '../clients/js/src/generated/instructions/iniciarBaul'
import { getRegistrarOrdenInstruction } from '../clients/js/src/generated/instructions/registrarOrden'
import { getDepositarInstruction } from '../clients/js/src/generated/instructions/depositar'
import { getRetirarInstruction } from '../clients/js/src/generated/instructions/retirar'
import { getRetirarAWalletInstruction } from '../clients/js/src/generated/instructions/retirarAWallet'
import { BOT_POLYMARKET_PROGRAM_ADDRESS } from '../clients/js/src/generated/programs/botPolymarket'

function kitIxToWeb3Ix(ix: {
  programAddress: Address
  accounts: readonly AccountMeta[]
  data: Uint8Array
}): TransactionInstruction {
  const keys: Web3AccountMeta[] = ix.accounts.map((acc) => ({
    pubkey: new PublicKey(acc.address),
    isSigner: acc.role === 2 || acc.role === 3,
    isWritable: acc.role === 1 || acc.role === 3,
  }))
  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys,
    data: Buffer.from(ix.data),
  })
}

type TxRecord = {
  sig: string
  label: string
  timestamp: number
}

function App() {
  const { publicKey, connected, signTransaction, sendTransaction } = useWallet()
  const { connection } = useConnection()

  // Estados
  const [nombreBaul, setNombreBaul] = useState('')
  const [monto, setMonto] = useState('')
  const [mercadoId, setMercadoId] = useState('')
  const [tipoMov, setTipoMov] = useState<0 | 1>(0)
  const [cuentaDestino, setCuentaDestino] = useState('')
  const [vaultAddress, setVaultAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [txSig, setTxSig] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHistory, setTxHistory] = useState<TxRecord[]>([])
  const [copied, setCopied] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)

  // Obtener balance de la wallet conectada
  useEffect(() => {
    if (!publicKey || !connected) return
    connection.getBalance(publicKey).then(setBalance).catch(() => setBalance(null))
  }, [publicKey, connected, connection, txSig]) // actualizar tras cada tx

  // Enviar transacción
  async function makeTransaction(web3Ix: TransactionInstruction, label: string, extraSigners?: Keypair[]) {
    setLoading(true)
    setError(null)
    setTxSig(null)
    try {
      const { blockhash } = await connection.getLatestBlockhash()
      const tx = new Transaction()
      tx.recentBlockhash = blockhash
      tx.feePayer = publicKey!
      tx.add(web3Ix)
      if (extraSigners) tx.partialSign(...extraSigners)
      const sig = await sendTransaction(tx, connection)
      setTxSig(sig)
      setTxHistory(prev => [{ sig, label, timestamp: Date.now() }, ...prev.slice(0, 9)]) // max 10
    } catch (e: any) {
      const msg = e?.message ?? JSON.stringify(e)
      setError(msg)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Transacción de prueba
  const handleTestTransaction = async () => {
    if (!publicKey) return
    await makeTransaction(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey('11111111111111111111111111111111'),
        data: Buffer.alloc(0),
      }),
      '🧪 TX de prueba',
    )
  }

  // Handlers con validación y roles corregidos (misma lógica que antes)
  const handleIniciarBaul = async () => {
    if (!publicKey || !signTransaction || !nombreBaul.trim()) return
    const vaultKeypair = Keypair.generate()
    const kitIx = getIniciarBaulInstruction({
      owner: address(publicKey.toBase58()),
      vault: address(vaultKeypair.publicKey.toBase58()),
      nombre: nombreBaul.trim(),
    } as any)
    const accounts = [...kitIx.accounts]
    if (accounts[0]) accounts[0] = { ...accounts[0], role: 3 }
    if (accounts[1]) accounts[1] = { ...accounts[1], role: 3 }
    if (accounts[2]) accounts[2] = { ...accounts[2], role: 0 }
    const web3Ix = kitIxToWeb3Ix({ programAddress: kitIx.programAddress, accounts, data: kitIx.data })
    await makeTransaction(web3Ix, '🏗️ Crear Baúl', [vaultKeypair])
    if (!error) setVaultAddress(vaultKeypair.publicKey.toBase58())
  }

  const handleRegistrarOrden = async () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto || !mercadoId.trim()) return
    const kitIx = getRegistrarOrdenInstruction({
      owner: address(publicKey.toBase58()),
      vault: address(vaultAddress.trim()),
      idMercado: mercadoId.trim(),
      monto: BigInt(monto),
      tipoMov: tipoMov,
    } as any)
    const accounts = [...kitIx.accounts]
    if (accounts[0]) accounts[0] = { ...accounts[0], role: 3 }
    if (accounts[1]) accounts[1] = { ...accounts[1], role: 1 }
    if (accounts[2]) accounts[2] = { ...accounts[2], role: 0 }
    await makeTransaction(kitIxToWeb3Ix({ ...kitIx, accounts }), '📊 Registrar Orden')
  }

  const handleDepositar = async () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto) return
    const kitIx = getDepositarInstruction({
      owner: address(publicKey.toBase58()),
      vault: address(vaultAddress.trim()),
      monto: BigInt(monto),
    } as any)
    const accounts = [...kitIx.accounts]
    if (accounts[0]) accounts[0] = { ...accounts[0], role: 3 }
    if (accounts[1]) accounts[1] = { ...accounts[1], role: 1 }
    if (accounts[2]) accounts[2] = { ...accounts[2], role: 0 }
    await makeTransaction(kitIxToWeb3Ix({ ...kitIx, accounts }), '💰 Depositar')
  }

  const handleRetirar = async () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto) return
    const kitIx = getRetirarInstruction({
      owner: address(publicKey.toBase58()),
      vault: address(vaultAddress.trim()),
      monto: BigInt(monto),
    } as any)
    const accounts = [...kitIx.accounts]
    if (accounts[0]) accounts[0] = { ...accounts[0], role: 3 }
    if (accounts[1]) accounts[1] = { ...accounts[1], role: 1 }
    if (accounts[2]) accounts[2] = { ...accounts[2], role: 0 }
    await makeTransaction(kitIxToWeb3Ix({ ...kitIx, accounts }), '🔙 Retirar')
  }

  const handleRetirarAWallet = async () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto || !cuentaDestino.trim()) return
    const kitIx = getRetirarAWalletInstruction({
      owner: address(publicKey.toBase58()),
      cuentaDestino: address(cuentaDestino.trim()),
      vault: address(vaultAddress.trim()),
      monto: BigInt(monto),
    } as any)
    const accounts = [...kitIx.accounts]
    if (accounts[0]) accounts[0] = { ...accounts[0], role: 3 }
    if (accounts[1]) accounts[1] = { ...accounts[1], role: 1 }
    if (accounts[2]) accounts[2] = { ...accounts[2], role: 1 }
    if (accounts[3]) accounts[3] = { ...accounts[3], role: 0 }
    await makeTransaction(kitIxToWeb3Ix({ ...kitIx, accounts }), '🎯 Transferir')
  }

  // Copiar al portapapeles
  const copyToClipboard = () => {
    if (!vaultAddress) return
    navigator.clipboard.writeText(vaultAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Renderizado
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-center sm:text-left">🤖 Bot Polymarket</h1>
          <div className="flex items-center gap-4">
            {connected && balance !== null && (
              <span className="text-sm bg-gray-800 px-3 py-1 rounded-full">
                💰 { (balance / LAMPORTS_PER_SOL).toFixed(2) } SOL
              </span>
            )}
            <WalletMultiButton />
          </div>
        </div>

        {!connected ? (
          <p className="text-center text-gray-400 mt-10">Conecta tu wallet para empezar</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel Principal: Gestión de Baúl */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-gray-800 p-5 rounded-xl">
                <h2 className="text-xl font-bold mb-4">🏦 Gestión de Baúl</h2>

                {/* Iniciar Baúl */}
                <div className="mb-5">
                  <h3 className="font-semibold mb-2">Crear nuevo baúl</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del baúl"
                      value={nombreBaul}
                      onChange={(e) => setNombreBaul(e.target.value)}
                      className={`flex-1 p-2 rounded bg-gray-700 border ${!nombreBaul.trim() ? 'border-gray-600' : 'border-blue-500'} text-white placeholder-gray-400`}
                    />
                    <button
                      onClick={handleIniciarBaul}
                      disabled={loading || !nombreBaul.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded flex items-center gap-2"
                    >
                      {loading ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : 'Crear Baúl'}
                    </button>
                  </div>
                  {vaultAddress && (
                    <div className="mt-2 flex items-center gap-2 text-sm bg-gray-700 p-2 rounded break-all">
                      <span className="text-green-400 font-mono">{vaultAddress}</span>
                      <button onClick={copyToClipboard} className="text-blue-400 hover:underline">
                        {copied ? '✅ Copiado' : '📋 Copiar'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Operaciones con vault existente */}
                <div className="border-t border-gray-700 pt-4 space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Operar con vault</h3>
                    <input
                      type="text"
                      placeholder="Dirección del vault"
                      value={vaultAddress}
                      onChange={(e) => setVaultAddress(e.target.value)}
                      className={`w-full p-2 rounded bg-gray-700 border ${!vaultAddress.trim() ? 'border-red-500' : 'border-gray-600'} text-white placeholder-gray-400 mb-2`}
                    />
                  </div>

                  {/* Depositar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <input
                      type="number"
                      placeholder="Monto (lamports)"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className={`p-2 rounded bg-gray-700 border ${!monto ? 'border-gray-600' : 'border-green-500'} text-white placeholder-gray-400`}
                    />
                    <button
                      onClick={handleDepositar}
                      disabled={loading || !vaultAddress.trim() || !monto}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2"
                    >
                      {loading ? <SpinnerMini /> : '💰 Depositar'}
                    </button>
                  </div>

                  {/* Retirar a wallet conectada */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <input
                      type="number"
                      placeholder="Monto (lamports)"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className="p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400"
                    />
                    <button
                      onClick={handleRetirar}
                      disabled={loading || !vaultAddress.trim() || !monto}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2"
                    >
                      {loading ? <SpinnerMini /> : '🔙 Retirar a mi wallet'}
                    </button>
                  </div>

                  {/* Retirar a otra wallet */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <input
                      type="text"
                      placeholder="Dirección destino"
                      value={cuentaDestino}
                      onChange={(e) => setCuentaDestino(e.target.value)}
                      className="p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400"
                    />
                    <input
                      type="number"
                      placeholder="Monto (lamports)"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className="p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400"
                    />
                    <button
                      onClick={handleRetirarAWallet}
                      disabled={loading || !vaultAddress.trim() || !monto || !cuentaDestino.trim()}
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2"
                    >
                      {loading ? <SpinnerMini /> : '🎯 Transferir'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel de Órdenes */}
              <div className="bg-gray-800 p-5 rounded-xl">
                <h2 className="text-xl font-bold mb-4">📈 Órdenes de Mercado</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <input
                    type="text"
                    placeholder="ID de Mercado"
                    value={mercadoId}
                    onChange={(e) => setMercadoId(e.target.value)}
                    className="p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400"
                  />
                  <input
                    type="number"
                    placeholder="Monto (lamports)"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400"
                  />
                  <div className="flex gap-2">
                    <select
                      value={tipoMov}
                      onChange={(e) => setTipoMov(Number(e.target.value) as 0 | 1)}
                      className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-white"
                    >
                      <option value={0}>Compra</option>
                      <option value={1}>Venta</option>
                    </select>
                    <button
                      onClick={handleRegistrarOrden}
                      disabled={loading || !vaultAddress.trim() || !monto || !mercadoId.trim()}
                      className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2"
                    >
                      {loading ? <SpinnerMini /> : '📊 Registrar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Lateral: Historial y Estado */}
            <div className="space-y-4">
              {/* Transacción de prueba */}
              <div className="bg-gray-800 p-5 rounded-xl">
                <h3 className="font-semibold mb-2">🔧 Diagnóstico</h3>
                <button
                  onClick={handleTestTransaction}
                  disabled={loading}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2"
                >
                  {loading ? <SpinnerMini /> : '🧪 Probar TX simple'}
                </button>
              </div>

              {/* Historial de transacciones */}
              <div className="bg-gray-800 p-5 rounded-xl">
                <h3 className="font-semibold mb-2">📋 Últimas transacciones</h3>
                {txHistory.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin transacciones recientes</p>
                ) : (
                  <ul className="space-y-2">
                    {txHistory.map((tx, i) => (
                      <li key={i} className="text-sm bg-gray-700 p-2 rounded flex justify-between items-center gap-2">
                        <span className="truncate">{tx.label}</span>
                        <a
                          href={`https://explorer.solana.com/tx/${tx.sig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline text-xs"
                        >
                          {tx.sig.slice(0, 8)}...
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Mensaje de error */}
              {error && (
                <div className="bg-red-900/80 p-4 rounded-xl text-sm relative">
                  <strong className="block mb-1">❌ Error</strong>
                  <p className="break-all">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="absolute top-2 right-2 text-gray-300 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Componente auxiliar de spinner mini
function SpinnerMini() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

export default App
