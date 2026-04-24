// Librerias de React y extras
import { Buffer } from 'buffer'
globalThis.Buffer = Buffer
import { useState, useEffect, useRef, useCallback } from 'react'

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

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */
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

function parseMonto(value: string): bigint | null {
  if (!value.trim()) return null
  try {
    const parsed = BigInt(value)
    if (parsed < 0) return null
    return parsed
  } catch {
    return null
  }
}

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

/* ------------------------------------------------------------------ */
/*  Componentes auxiliares                                             */
/* ------------------------------------------------------------------ */
function SpinnerMini() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  const bg = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])
  return (
    <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white flex items-center gap-3 transition-all duration-300 ${bg}`}>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1">✕</button>
    </div>
  )
}

function ConfirmModal({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-gray-300 mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 transition-colors">Confirmar</button>
        </div>
      </div>
    </div>
  )
}

type TxRecord = { sig: string; label: string; timestamp: number }

/* ------------------------------------------------------------------ */
/*  Componente principal                                               */
/* ------------------------------------------------------------------ */
function App() {
  const { publicKey, connected, signTransaction, sendTransaction } = useWallet()
  const { connection } = useConnection()

  const [nombreBaul, setNombreBaul] = useState('')
  const [monto, setMonto] = useState('')
  const [mercadoId, setMercadoId] = useState('')
  const [tipoMov, setTipoMov] = useState<0 | 1>(0)
  const [cuentaDestino, setCuentaDestino] = useState('')
  const [vaultAddress, setVaultAddress] = useState('')

  const [loading, setLoading] = useState(false)
  const [txSig, setTxSig] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [txHistory, setTxHistory] = useState<TxRecord[]>([])
  const [copied, setCopied] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [vaultBalance, setVaultBalance] = useState<number | null>(null)
  const [showConfirm, setShowConfirm] = useState<{ action: () => void; title: string; message: string } | null>(null)

  // Balance wallet
  useEffect(() => {
    if (!publicKey || !connected) return
    connection.getBalance(publicKey).then(setBalance).catch(() => setBalance(null))
  }, [publicKey, connected, connection, txSig])

  // Balance vault
  useEffect(() => {
    if (!vaultAddress.trim()) { setVaultBalance(null); return }
    try {
      const pubkey = new PublicKey(vaultAddress)
      connection.getBalance(pubkey).then(setVaultBalance).catch(() => setVaultBalance(null))
    } catch { setVaultBalance(null) }
  }, [vaultAddress, connection, txSig])

  async function makeTransaction(web3Ix: TransactionInstruction, label: string, extraSigners?: Keypair[]) {
    setLoading(true)
    setToast(null)
    try {
      const { blockhash } = await connection.getLatestBlockhash()
      const tx = new Transaction()
      tx.recentBlockhash = blockhash
      tx.feePayer = publicKey!
      tx.add(web3Ix)
      if (extraSigners) tx.partialSign(...extraSigners)
      const sig = await sendTransaction(tx, connection)
      setTxSig(sig)
      setTxHistory(prev => [{ sig, label, timestamp: Date.now() }, ...prev.slice(0, 9)])
      setToast({ message: `✅ ${label} completada`, type: 'success' })
    } catch (e: any) {
      const msg = e?.message ?? JSON.stringify(e)
      setToast({ message: `❌ ${msg}`, type: 'error' })
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Handlers
  const handleIniciarBaul = useCallback(async () => {
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
    const ix = { programAddress: kitIx.programAddress, accounts, data: kitIx.data }
    await makeTransaction(kitIxToWeb3Ix(ix), '🏗️ Crear Baúl', [vaultKeypair])
    if (!toast || toast.type !== 'error') {
      setVaultAddress(vaultKeypair.publicKey.toBase58())
      setNombreBaul('')
    }
  }, [publicKey, signTransaction, nombreBaul])

  const handleRegistrarOrden = useCallback(async () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto || !mercadoId.trim()) return
    const montoBigInt = parseMonto(monto)
    if (montoBigInt === null) { setToast({ message: 'Monto inválido', type: 'error' }); return }
    const kitIx = getRegistrarOrdenInstruction({
      owner: address(publicKey.toBase58()),
      vault: address(vaultAddress.trim()),
      idMercado: mercadoId.trim(),
      monto: montoBigInt,
      tipoMov: tipoMov,
    } as any)
    const accounts: AccountMeta[] = []
    if (kitIx.accounts[0]) accounts.push({ ...kitIx.accounts[0], role: 3 })
    else accounts.push({ address: address(publicKey.toBase58()), role: 3 })
    if (kitIx.accounts[1]) accounts.push({ ...kitIx.accounts[1], role: 1 })
    else accounts.push({ address: address(vaultAddress.trim()), role: 1 })
    if (kitIx.accounts[2]) accounts.push({ ...kitIx.accounts[2], role: 0 })
    else accounts.push({ address: address('11111111111111111111111111111111'), role: 0 })
    const ix = { programAddress: kitIx.programAddress, accounts, data: kitIx.data }
    await makeTransaction(kitIxToWeb3Ix(ix), '📊 Registrar Orden')
    if (!toast || toast.type !== 'error') { setMonto(''); setMercadoId('') }
  }, [publicKey, signTransaction, vaultAddress, monto, mercadoId, tipoMov])

  const handleDepositar = useCallback(async () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto) return
    const montoBigInt = parseMonto(monto)
    if (montoBigInt === null) { setToast({ message: 'Monto inválido', type: 'error' }); return }
    const kitIx = getDepositarInstruction({
      owner: address(publicKey.toBase58()),
      vault: address(vaultAddress.trim()),
      monto: montoBigInt,
    } as any)
    const accounts = [...kitIx.accounts]
    if (accounts[0]) accounts[0] = { ...accounts[0], role: 3 }
    if (accounts[1]) accounts[1] = { ...accounts[1], role: 1 }
    if (accounts[2]) accounts[2] = { ...accounts[2], role: 0 }
    await makeTransaction(kitIxToWeb3Ix({ ...kitIx, accounts }), '💰 Depositar')
    if (!toast || toast.type !== 'error') setMonto('')
  }, [publicKey, signTransaction, vaultAddress, monto])

  const executeRetirar = useCallback(async () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto) return
    const montoBigInt = parseMonto(monto)
    if (montoBigInt === null) { setToast({ message: 'Monto inválido', type: 'error' }); return }
    const kitIx = getRetirarInstruction({
      owner: address(publicKey.toBase58()),
      vault: address(vaultAddress.trim()),
      monto: montoBigInt,
    } as any)
    const accounts = [...kitIx.accounts]
    if (accounts[0]) accounts[0] = { ...accounts[0], role: 3 }
    if (accounts[1]) accounts[1] = { ...accounts[1], role: 1 }
    if (accounts[2]) accounts[2] = { ...accounts[2], role: 0 }
    await makeTransaction(kitIxToWeb3Ix({ ...kitIx, accounts }), '🔙 Retirar')
    if (!toast || toast.type !== 'error') setMonto('')
  }, [publicKey, signTransaction, vaultAddress, monto])

  const handleRetirar = () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto) return
    setShowConfirm({
      title: 'Retirar a mi wallet',
      message: `¿Retirar ${monto} lamports hacia tu wallet conectada?`,
      action: executeRetirar,
    })
  }

  // *** CORRECCIÓN: Construcción manual robusta para retirarAWallet ***
  const executeRetirarAWallet = useCallback(async () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto || !cuentaDestino.trim()) return
    const montoBigInt = parseMonto(monto)
    if (montoBigInt === null) { setToast({ message: 'Monto inválido', type: 'error' }); return }
    // Validar destino
    let destinoPubkey: PublicKey
    try { destinoPubkey = new PublicKey(cuentaDestino.trim()) }
    catch { setToast({ message: 'Dirección destino inválida', type: 'error' }); return }

    // Verificar saldo del vault (opcional, pero útil)
    if (vaultBalance !== null && montoBigInt > vaultBalance) {
      setToast({ message: 'Saldo insuficiente en el vault', type: 'error' })
      return
    }

    try {
      const kitIx = getRetirarAWalletInstruction({
        owner: address(publicKey.toBase58()),
        cuentaDestino: address(cuentaDestino.trim()),
        vault: address(vaultAddress.trim()),
        monto: montoBigInt,
      } as any)

      console.log('retirarAWallet - data hex:', Buffer.from(kitIx.data).toString('hex'))
      console.log('retirarAWallet - programAddress:', kitIx.programAddress)

      // Construir manualmente las cuentas en el orden exacto del IDL:
      // 0: owner (writable+signer), 1: cuentaDestino (writable), 2: vault (writable), 3: systemProgram (readonly)
      const accounts: AccountMeta[] = [
        { address: address(publicKey.toBase58()), role: 3 },
        { address: address(destinoPubkey.toBase58()), role: 1 },
        { address: address(vaultAddress.trim()), role: 1 },
        { address: address('11111111111111111111111111111111'), role: 0 },
      ]

      const ix = { programAddress: kitIx.programAddress, accounts, data: kitIx.data }
      await makeTransaction(kitIxToWeb3Ix(ix), '🎯 Transferir')
      if (!toast || toast.type !== 'error') { setMonto(''); setCuentaDestino('') }
    } catch (e) {
      console.error(e)
      setToast({ message: 'Error inesperado', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [publicKey, signTransaction, vaultAddress, monto, cuentaDestino, vaultBalance])

  const handleRetirarAWallet = () => {
    if (!publicKey || !signTransaction || !vaultAddress.trim() || !monto || !cuentaDestino.trim()) return
    setShowConfirm({
      title: 'Transferir a wallet externa',
      message: `¿Enviar ${monto} lamports a ${cuentaDestino.slice(0, 6)}...?`,
      action: executeRetirarAWallet,
    })
  }

  const handleTestTransaction = async () => {
    if (!publicKey) return
    const memoMessage = `test-${Date.now()}`
    await makeTransaction(
      new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM_ID, data: Buffer.from(memoMessage, 'utf8') }),
      '🧪 TX de prueba'
    )
  }

  const copyToClipboard = () => {
    if (!vaultAddress) return
    navigator.clipboard.writeText(vaultAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    setToast({ message: '📋 Dirección copiada', type: 'info' })
  }

  const handleKeyDown = (callback: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') callback()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            🤖 Bot Polymarket
          </h1>
          <div className="flex flex-wrap items-center gap-4">
            {connected && balance !== null && (
              <span className="text-sm bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                💰 {(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL
              </span>
            )}
            <WalletMultiButton />
          </div>
        </header>

        {!connected ? (
          <div className="text-center mt-20 text-gray-400"><p className="text-xl">Conecta tu wallet para comenzar</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-gray-700/50">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  🏦 Gestión de Baúl
                  {vaultBalance !== null && (
                    <span className="text-sm font-normal text-gray-400 ml-auto">
                      Saldo: {(vaultBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
                    </span>
                  )}
                </h2>

                <div className="mb-6" onKeyDown={handleKeyDown(handleIniciarBaul)}>
                  <label className="text-sm font-medium mb-2 block">Crear nuevo baúl</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del baúl"
                      value={nombreBaul}
                      onChange={(e) => setNombreBaul(e.target.value)}
                      className="flex-1 p-3 rounded-xl bg-gray-700/70 border border-gray-600 focus:border-blue-500 focus:outline-none transition-colors text-white placeholder-gray-400"
                    />
                    <button
                      onClick={handleIniciarBaul}
                      disabled={loading || !nombreBaul.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-600/20"
                    >
                      {loading ? <SpinnerMini /> : 'Crear Baúl'}
                    </button>
                  </div>
                  {vaultAddress && (
                    <div className="mt-3 flex items-center gap-2 text-sm bg-gray-700/50 p-3 rounded-xl break-all border border-gray-600/50">
                      <span className="text-green-400 font-mono text-xs flex-1">{vaultAddress}</span>
                      <button onClick={copyToClipboard} className="text-blue-400 hover:underline shrink-0">
                        {copied ? '✅ Copiado' : '📋 Copiar'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-700 pt-5 space-y-5">
                  <label className="text-sm font-medium block">
                    Dirección del vault
                    <input
                      type="text"
                      placeholder="Pega la dirección"
                      value={vaultAddress}
                      onChange={(e) => setVaultAddress(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-gray-700/70 border border-gray-600 focus:border-purple-500 focus:outline-none transition-colors text-white placeholder-gray-400"
                    />
                  </label>

                  <div onKeyDown={handleKeyDown(handleDepositar)} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <input
                      type="number"
                      placeholder="Monto (lamports)"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className="flex-1 p-3 rounded-xl bg-gray-700/70 border border-gray-600 focus:border-green-500 focus:outline-none text-white placeholder-gray-400"
                    />
                    <button
                      onClick={handleDepositar}
                      disabled={loading || !vaultAddress.trim() || !monto}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-40 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
                    >
                      {loading ? <SpinnerMini /> : '💰 Depositar'}
                    </button>
                  </div>

                  <div onKeyDown={handleKeyDown(handleRetirar)} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <input
                      type="number"
                      placeholder="Monto (lamports)"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className="flex-1 p-3 rounded-xl bg-gray-700/70 border border-gray-600 focus:border-red-500 focus:outline-none text-white placeholder-gray-400"
                    />
                    <button
                      onClick={handleRetirar}
                      disabled={loading || !vaultAddress.trim() || !monto}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-40 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                    >
                      {loading ? <SpinnerMini /> : '🔙 Retirar'}
                    </button>
                  </div>

                  <div onKeyDown={handleKeyDown(handleRetirarAWallet)} className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Dirección destino"
                        value={cuentaDestino}
                        onChange={(e) => setCuentaDestino(e.target.value)}
                        className="flex-1 p-3 rounded-xl bg-gray-700/70 border border-gray-600 focus:border-purple-500 focus:outline-none text-white placeholder-gray-400"
                      />
                      <input
                        type="number"
                        placeholder="Monto"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        className="flex-1 p-3 rounded-xl bg-gray-700/70 border border-gray-600 focus:border-purple-500 focus:outline-none text-white placeholder-gray-400"
                      />
                    </div>
                    <button
                      onClick={handleRetirarAWallet}
                      disabled={loading || !vaultAddress.trim() || !monto || !cuentaDestino.trim()}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
                    >
                      {loading ? <SpinnerMini /> : '🎯 Transferir'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-gray-700/50">
                <h2 className="text-xl font-semibold mb-4">📈 Órdenes de Mercado</h2>
                <div onKeyDown={handleKeyDown(handleRegistrarOrden)} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    type="text"
                    placeholder="ID de Mercado"
                    value={mercadoId}
                    onChange={(e) => setMercadoId(e.target.value)}
                    className="flex-1 p-3 rounded-xl bg-gray-700/70 border border-gray-600 focus:border-orange-500 focus:outline-none text-white placeholder-gray-400"
                  />
                  <input
                    type="number"
                    placeholder="Monto"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="flex-1 p-3 rounded-xl bg-gray-700/70 border border-gray-600 focus:border-orange-500 focus:outline-none text-white placeholder-gray-400"
                  />
                  <div className="flex gap-2">
                    <select
                      value={tipoMov}
                      onChange={(e) => setTipoMov(Number(e.target.value) as 0 | 1)}
                      className="p-3 rounded-xl bg-gray-700/70 border border-gray-600 text-white"
                    >
                      <option value={0}>Compra</option>
                      <option value={1}>Venta</option>
                    </select>
                    <button
                      onClick={handleRegistrarOrden}
                      disabled={loading || !vaultAddress.trim() || !monto || !mercadoId.trim()}
                      className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
                    >
                      {loading ? <SpinnerMini /> : '📊 Registrar'}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800/80 backdrop-blur-sm p-5 rounded-2xl shadow-xl border border-gray-700/50">
                <h3 className="font-semibold mb-3">🔧 Diagnóstico</h3>
                <button
                  onClick={handleTestTransaction}
                  disabled={loading}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-yellow-600/20"
                >
                  {loading ? <SpinnerMini /> : '🧪 Probar conexión'}
                </button>
              </div>

              <div className="bg-gray-800/80 backdrop-blur-sm p-5 rounded-2xl shadow-xl border border-gray-700/50">
                <h3 className="font-semibold mb-3">📋 Últimas transacciones</h3>
                {txHistory.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin actividad</p>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {txHistory.map((tx, i) => (
                      <li key={i} className="text-sm bg-gray-700/50 p-3 rounded-xl flex justify-between items-center gap-2 hover:bg-gray-700 transition-colors">
                        <span className="truncate">{tx.label}</span>
                        <a
                          href={`https://explorer.solana.com/tx/${tx.sig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline text-xs shrink-0"
                        >
                          {tx.sig.slice(0, 8)}...
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      {showConfirm && (
        <ConfirmModal
          open={!!showConfirm}
          title={showConfirm.title}
          message={showConfirm.message}
          onConfirm={() => { showConfirm.action(); setShowConfirm(null) }}
          onCancel={() => setShowConfirm(null)}
        />
      )}
    </div>
  )
}

export default App
