# minibotpolymarket

**Asistente de trading para Polymarket sobre Solana**

Interfaz descentralizada (dApp) para gestionar *baúles* (vaults) de inversión en Polymarket utilizando la red Solana. Diseñada para que un bot de Python (o cualquier cliente externo) pueda distribuir capital y registrar operaciones de compra/venta de forma directa, eficiente y rápida.

## 🚀 Características

- **Creación de baúles (vaults)** personalizados con un nombre único.
- **Depósitos y retiros** de SOL desde/hacia la wallet conectada.
- **Transferencias a wallets externas** para repartir utilidades.
- **Registro de órdenes de mercado** (compra/venta) vinculadas a un identificador de mercado de Polymarket.
- **Visualización del saldo** de la wallet y del baúl en tiempo real.
- **Historial de transacciones** recientes con enlaces al explorador de Solana.
- **Modal de confirmación** para operaciones sensibles.
- **Notificaciones toast** de éxito/error.
- **Atajos de teclado** (Enter) para agilizar el uso.
- **Interfaz moderna** con Tailwind CSS, responsiva y con feedback visual.

## 🛠️ Tecnologías

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) como bundler
- [Tailwind CSS](https://tailwindcss.com/) para los estilos
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) y [Wallet Adapter](https://github.com/anza-xyz/wallet-adapter)
- [@solana/kit](https://github.com/solana-labs/solana-kit) para tipos y utilidades
- [Anchor](https://www.anchor-lang.com/) (programa on‑chain desplegado en devnet)

## 📋 Requisitos previos

- Node.js (v18 o superior)
- npm (v9 o superior)
- Una wallet de Solana con fondos en **devnet** (puedes obtener SOL de prueba en [faucet.solana.com](https://faucet.solana.com/))
- Extensión del navegador para Solana (Phantom, Solflare, etc.) configurada en modo **Devnet**

## ⚙️ Instalación

```bash
# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd minibotpolymarket/minibotpolymarket   # Ajusta la ruta si es necesario

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm run dev
La aplicación se abrirá en http://localhost:5173 (o el puerto que indique Vite).

📖 Uso
Conecta tu wallet usando el botón Select Wallet (arriba a la derecha).

Crea un baúl introduciendo un nombre y pulsando Crear Baúl.

Se generará una nueva cuenta (vault) y se mostrará su dirección.

Copia la dirección del vault (botón 📋) y pégala en el campo Dirección del vault para las siguientes operaciones.

Depositar: ingresa un monto en lamports y haz clic en 💰 Depositar.

Retirar a mi wallet: introduce un monto y pulsa 🔙 Retirar (requiere confirmación).

Transferir a otra wallet: escribe la dirección destino, el monto y confirma la operación.

Registrar Orden: rellena el ID de mercado, el monto y el tipo (Compra/Venta), luego 📊 Registrar.

El historial de transacciones aparece en el panel derecho. Puedes explorar cada transacción en Solana Explorer.

📁 Estructura del proyecto
text
minibotpolymarket/
├── src/
│   ├── App.tsx                # Componente principal con toda la lógica y UI
│   ├── App.css                # Estilos residuales (opcional si usas Tailwind)
│   ├── index.css              # Directiva de Tailwind
│   └── main.tsx               # Punto de entrada, proveedores de wallet y red
├── clients/
│   └── js/                    # Cliente generado por Solana Kit/Anchor
│       └── src/generated/
│           ├── instructions/  # Funciones para cada instrucción del programa
│           └── programs/      # Dirección del programa
├── vite.config.ts             # Configuración de Vite + polyfills
├── tailwind.config.js         # Configuración de Tailwind (solo si usas v3)
├── index.html
├── package.json
└── README.md
🔗 Programa Solana
El programa on‑chain se encuentra desplegado en devnet con el ID:

text
7GKNK8JhFEeL9AuSioSzQdRQAoCmMq5nd6NZBGJdqknW
Incluye las siguientes instrucciones:

Instrucción	Descripción
iniciarBaul	Crea un nuevo baúl (vault) asociado al propietario.
registrarOrden	Registra una orden de compra/venta y actualiza el saldo del baúl.
depositar	Deposita SOL desde la wallet del propietario al baúl.
retirar	Retira SOL del baúl hacia la wallet del propietario.
retirarAWallet	Transfiere SOL del baúl a cualquier wallet externa.
🤖 Integración con bot de Python
Este proyecto está diseñado para ser la interfaz visual de un bot de trading en Python. El bot puede firmar y enviar transacciones utilizando las mismas instrucciones del programa, ya sea a través de Anchor Py, Solana.py o llamadas RPC directas. La dApp facilita la administración manual de los baúles y la verificación de operaciones.

📝 Notas
La aplicación está configurada para devnet. Si deseas usarla en mainnet, cambia el endpoint en main.tsx y asegúrate de tener el programa desplegado en mainnet.

Los baúles son cuentas comunes (no PDAs) firmadas por una keypair generada localmente al crearlas.

El polyfill de Buffer se incluye para compatibilidad con el navegador.

📄 Licencia
Este proyecto está bajo la Licencia MIT. Siéntete libre de usarlo y modificarlo.

