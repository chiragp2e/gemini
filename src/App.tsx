import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  type KalpNetwork,
  NETWORK_CONFIG,
  NETWORK_OPTIONS,
  evaluateKalpBalance,
  evaluateKalpTransaction,
  submitKalpTransaction,
} from './kalpClient';
import {
  getSeedPhrase,
  getKeyPairFromSeedPhrase,
  getEnrollmentId,
  createCsr,
  registerAndEnrollUser,
  NGL_SUPPORTED_NETWORKS,
} from './nglKeyService';
import './App.css';

type AsyncState =
  | { status: 'idle'; message?: string }
  | { status: 'pending'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

const QUICK_AMOUNTS = ['0.1', '1', '10'] as const;
const idleState: AsyncState = { status: 'idle' };

const GINI_DECIMALS = 18;
const DEFAULT_KWALA_ADDRESS = '7605f78e515655ce92bc81a7311f730c2905c88c';

const parseTransactionParams = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // ignore parse error and fallback to comma-separated values
  }
  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeKwlId = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  const withoutPrefix = trimmed.startsWith('kwl-') ? trimmed.slice(4) : trimmed;
  const withoutSuffix = withoutPrefix.endsWith('-cc')
    ? withoutPrefix.slice(0, -3)
    : withoutPrefix;
  return `kwl-${withoutSuffix}-cc`;
};

const convertGiniToRawUnits = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const decimalMatch = /^(\d*)(?:\.(\d+))?$/.exec(trimmed);
  if (!decimalMatch || (decimalMatch[1] === '' && !decimalMatch[2])) {
    return '';
  }
  const whole = decimalMatch[1] || '0';
  const fraction = decimalMatch[2] ?? '';
  const paddedFraction = (fraction + '0'.repeat(GINI_DECIMALS)).slice(0, GINI_DECIMALS);
  const combined = `${whole}${paddedFraction}`.replace(/^0+/, '') || '0';
  return combined;
};

const downloadKeysFile = (keys: { enrollmentId: string; publicKey: string; privateKey: string; cert: string }) => {
  const content = `Enrollment ID:\n${keys.enrollmentId}\n\nPublic Key:\n${keys.publicKey}\nPrivate Key:\n${keys.privateKey}\nCertificate:\n${keys.cert}\n`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `keys-${keys.enrollmentId.slice(0, 8)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

function App() {
  const [network, setNetwork] = useState<KalpNetwork>('DEVNET');
  const [isNetworkMenuOpen, setNetworkMenuOpen] = useState(false);

  const networkMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (networkMenuRef.current && !networkMenuRef.current.contains(event.target as Node)) {
        setNetworkMenuOpen(false);
      }
    };

    if (isNetworkMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isNetworkMenuOpen]);

  const handleNetworkSelect = (value: KalpNetwork) => {
    setNetwork(value);
    setNetworkMenuOpen(false);
  };

  return (
    <div className="app">
      <header className="nav-bar">
        <div className="brand">
          <img
            className="brand-logo"
            src="https://kwala.network/assets/kwala-logo-white_1753635477000-CV_cNclZ.png"
            alt="Kwala"
          />
          
        </div>
       
        <div className="nav-actions">
          <div className="network-card-wrapper" ref={networkMenuRef}>
            <button
              type="button"
              className="network-toggle"
              onClick={() => setNetworkMenuOpen((prev) => !prev)}
            >
              <strong>{NETWORK_CONFIG[network].label}</strong>
              <small>Active</small>
            </button>
            {isNetworkMenuOpen ? (
              <div className="network-card-menu">
                {NETWORK_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`network-card-option ${
                      network === option.id ? 'active' : ''
                    }`}
                    onClick={() => handleNetworkSelect(option.id)}
                  >
                    <div className="option-header">
                      <span>{option.label}</span>
                      {network === option.id && <small>Active</small>}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
      </div>
          <button className="connect-btn" type="button">
            Connect
        </button>
        </div>
      </header>

      <main className="cards-grid">
        <CreateKeysCard />
        <WriteTransactionCard network={network} />
        <EvaluateTransactionCard network={network} />
        <CustomSubmitCard network={network} />
        <CustomEvaluateCard network={network} />
      </main>

      <footer className="footnote">
        <p>
          Need different chaincodes or channels? Update them in{' '}
          <code>src/kalpClient.ts</code>. Keep credential strings safe—this UI pulls
          them directly from your browser storage.
        </p>
      </footer>
    </div>
  );
}

type WriteTransactionCardProps = {
  network: KalpNetwork;
};

function WriteTransactionCard({ network }: WriteTransactionCardProps) {
  const [writeAddress, setWriteAddress] = useState(DEFAULT_KWALA_ADDRESS);
  const [writeAmount, setWriteAmount] = useState('');
  const [writeState, setWriteState] = useState<AsyncState>(idleState);

  const handleQuickAmount = (value: string) => {
    setWriteAmount(value);
  };

  const handleWriteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWriteState({ status: 'idle' });

    const normalizedAddress = writeAddress.trim().toLowerCase();
    const rawAmount = convertGiniToRawUnits(writeAmount);

    if (!normalizedAddress || !rawAmount) {
      setWriteState({ status: 'error', message: 'Address and amount are required.' });
      return;
    }

    try {
      setWriteState({ status: 'pending', message: 'Submitting transaction...' });
      const txId = await submitKalpTransaction({
        network,
        chainCodeName: NETWORK_CONFIG[network].chainCodeName,
        transactionName: 'MintToKwalaAccountOnBehalfOfKawalaAdmin',
        transactionParams: [normalizedAddress, rawAmount],
      });
      setWriteState({
        status: 'success',
        message: `Transaction committed with id ${txId}`,
      });
    } catch (error) {
      setWriteState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to submit transaction.',
      });
    }
  };

  const networkMeta = NETWORK_CONFIG[network];

  return (
    <section className="card-panel">
      <div className="panel-header">
        <h2>Write transaction</h2>
        <p>Transfer funds via {networkMeta.chainCodeName}</p>
      </div>
      <form className="form" onSubmit={handleWriteSubmit}>
        <label className="field">
          <span>Kwala address (lowercase)</span>
          <input
            autoComplete="off"
            inputMode="text"
            placeholder="7605f78e5156..."
            value={writeAddress}
            onChange={(event) => setWriteAddress(event.target.value)}
          />
          <small>Automatically normalized to lowercase.</small>
        </label>
        <label className="field">
          <span>Number of Kwala</span>
          <input
            autoComplete="off"
            inputMode="decimal"
            placeholder="e.g. 0.01"
            value={writeAmount}
            onChange={(event) => setWriteAmount(event.target.value)}
          />
          <small>Automatically converted to raw units (×10¹⁸).</small>
        </label>
        <div className="quick-amounts">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              className={amount === writeAmount ? 'active' : ''}
              onClick={() => handleQuickAmount(amount)}
            >
              ${amount}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Recipient address</span>
          <input
            autoComplete="off"
            inputMode="text"
            placeholder="0x..."
            value={writeAddress}
            onChange={(event) => setWriteAddress(event.target.value)}
          />
        </label>
        <button type="submit" disabled={writeState.status === 'pending'}>
          {writeState.status === 'pending' ? 'Submitting...' : 'Write transaction'}
        </button>
        <ResultBox state={writeState} />
      </form>
    </section>
  );
}

type EvaluateTransactionCardProps = {
  network: KalpNetwork;
};

function EvaluateTransactionCard({ network }: EvaluateTransactionCardProps) {
  const [activeTab, setActiveTab] = useState<'wallet' | 'gini' | 'kwala'>('wallet');
  const [walletAddress, setWalletAddress] = useState('');
  const [giniWalletId, setGiniWalletId] = useState('');
  const [kwalaWalletId, setKwalaWalletId] = useState('');
  const [evaluateState, setEvaluateState] = useState<AsyncState>(idleState);

  const handleEvaluateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEvaluateState({ status: 'idle' });

    const targetAddress =
      activeTab === 'wallet'
        ? walletAddress.trim()
        : activeTab === 'gini'
          ? (giniWalletId)
          : normalizeKwlId(kwalaWalletId);

    if (!targetAddress) {
      setEvaluateState({ status: 'error', message: 'Please enter an address.' });
      return;
    }

    try {
      setEvaluateState({ status: 'pending', message: 'Evaluating transaction...' });
      const result = await evaluateKalpBalance({
        network,
        address: targetAddress,
      });
      setEvaluateState({
        status: 'success',
        message: `Balance: ${result}`,
      });
    } catch (error) {
      setEvaluateState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to evaluate transaction.',
      });
    }
  };

  const networkMeta = NETWORK_CONFIG[network];

  return (
    <section className="card-panel">
      <div className="panel-header">
        <h2>Evaluate transaction</h2>
        <p>Read BalanceOf on {networkMeta.chainCodeName}</p>
      </div>
      <div className="tab-switcher">
               <button
          type="button"
          className={activeTab === 'gini' ? 'active' : ''}
          onClick={() => setActiveTab('gini')}
        >
          Gini
        </button>
        <button
          type="button"
          className={activeTab === 'kwala' ? 'active' : ''}
          onClick={() => setActiveTab('kwala')}
        >
          Kwala
        </button>
      </div>
      <form className="form" onSubmit={handleEvaluateSubmit}>
        {activeTab === 'wallet' && (
          <label className="field">
            <span>Wallet address</span>
            <input
              autoComplete="off"
              inputMode="text"
              placeholder="0x..."
              value={walletAddress}
              onChange={(event) => setWalletAddress(event.target.value)}
            />
          </label>
        )}
        {activeTab === 'gini' && (
          <label className="field">
            <span>Gini wallet ID</span>
            <input
              autoComplete="off"
              inputMode="text"
              placeholder="kwl-your-id-cc"
              value={giniWalletId}
              onChange={(event) => setGiniWalletId(event.target.value)}
            />
            <small>Automatically normalized to kwl-id-cc (lowercase).</small>
          </label>
        )}
        {activeTab === 'kwala' && (
          <label className="field">
            <span>Kwala wallet ID</span>
            <input
              autoComplete="off"
              inputMode="text"
              placeholder="kwala-wallet-id"
              value={kwalaWalletId}
              onChange={(event) => setKwalaWalletId(event.target.value)}
            />
          </label>
        )}
        <button type="submit" disabled={evaluateState.status === 'pending'}>
          {evaluateState.status === 'pending' ? 'Evaluating...' : 'Evaluate transaction'}
        </button>
        <ResultBox state={evaluateState} />
      </form>
    </section>
  );
}

type CustomSubmitCardProps = {
  network: KalpNetwork;
};

function CustomSubmitCard({ network }: CustomSubmitCardProps) {
  const [chainCodeName, setChainCodeName] = useState('');
  const [transactionName, setTransactionName] = useState('');
  const [transactionParams, setTransactionParams] = useState('');
  const [customState, setCustomState] = useState<AsyncState>(idleState);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomState({ status: 'idle' });

    if (!chainCodeName.trim() || !transactionName.trim()) {
      setCustomState({
        status: 'error',
        message: 'Chaincode name and transaction name are required.',
      });
      return;
    }

    const params = parseTransactionParams(transactionParams);

    try {
      setCustomState({ status: 'pending', message: 'Submitting transaction...' });
      const txId = await submitKalpTransaction({
        network,
        chainCodeName: chainCodeName.trim(),
        transactionName: transactionName.trim(),
        transactionParams: params,
      });
      setCustomState({
        status: 'success',
        message: `Transaction ID: ${txId}`,
      });
    } catch (error) {
      setCustomState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to submit transaction.',
      });
    }
  };

  return (
    <section className="card-panel">
      <div className="panel-header">
        <h2>Custom submit</h2>
        <p>Send a transaction with custom parameters.</p>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Chaincode name</span>
          <input
            autoComplete="off"
            inputMode="text"
            placeholder="klp-f02611a93e-cc"
            value={chainCodeName}
            onChange={(event) => setChainCodeName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Transaction name</span>
          <input
            autoComplete="off"
            inputMode="text"
            placeholder="Transfer"
            value={transactionName}
            onChange={(event) => setTransactionName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Transaction params</span>
          <textarea
            placeholder='Comma separated values or JSON array, e.g. ["0xabc...","1000"]'
            value={transactionParams}
            onChange={(event) => setTransactionParams(event.target.value)}
          />
        </label>
        <button type="submit" disabled={customState.status === 'pending'}>
          {customState.status === 'pending' ? 'Submitting...' : 'Submit transaction'}
        </button>
        <ResultBox state={customState} />
      </form>
    </section>
  );
}

type CustomEvaluateCardProps = {
  network: KalpNetwork;
};

function CustomEvaluateCard({ network }: CustomEvaluateCardProps) {
  const [chainCodeName, setChainCodeName] = useState('');
  const [transactionName, setTransactionName] = useState('');
  const [transactionParams, setTransactionParams] = useState('');
  const [customState, setCustomState] = useState<AsyncState>(idleState);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomState({ status: 'idle' });

    if (!chainCodeName.trim() || !transactionName.trim()) {
      setCustomState({
        status: 'error',
        message: 'Chaincode name and transaction name are required.',
      });
      return;
    }

    const params = parseTransactionParams(transactionParams);

    try {
      setCustomState({ status: 'pending', message: 'Evaluating transaction...' });
      const result = await evaluateKalpTransaction({
        network,
        chainCodeName: chainCodeName.trim(),
        transactionName: transactionName.trim(),
        transactionParams: params,
      });
      setCustomState({
        status: 'success',
        message: `Response: ${result}`,
      });
    } catch (error) {
      setCustomState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to evaluate transaction.',
      });
    }
  };

  return (
    <section className="card-panel">
      <div className="panel-header">
        <h2>Custom evaluate</h2>
        <p>Run any read-only transaction by specifying its details.</p>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Chaincode name</span>
          <input
            autoComplete="off"
            inputMode="text"
            placeholder="klp-f02611a93e-cc"
            value={chainCodeName}
            onChange={(event) => setChainCodeName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Transaction name</span>
          <input
            autoComplete="off"
            inputMode="text"
            placeholder="BalanceOf"
            value={transactionName}
            onChange={(event) => setTransactionName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Transaction params</span>
          <textarea
            placeholder='Comma separated values or JSON array, e.g. ["0xabc..."]'
            value={transactionParams}
            onChange={(event) => setTransactionParams(event.target.value)}
          />
        </label>
        <button type="submit" disabled={customState.status === 'pending'}>
          {customState.status === 'pending' ? 'Evaluating...' : 'Evaluate transaction'}
        </button>
        <ResultBox state={customState} />
      </form>
    </section>
  );
}

type KeysResult = {
  enrollmentId: string;
  publicKey: string;
  privateKey: string;
  cert: string;
};

function CreateKeysCard() {
  const [nglNetwork, setNglNetwork] = useState<KalpNetwork>(NGL_SUPPORTED_NETWORKS[0]);
  const [createKeysState, setCreateKeysState] = useState<AsyncState>(idleState);
  const [keysResult, setKeysResult] = useState<KeysResult | null>(null);

  const handleClickCreateKeys = async () => {
    try {
      setKeysResult(null);
      setCreateKeysState({ status: 'pending', message: 'Generating seed phrase and key pair...' });

      const seed = await getSeedPhrase();
      const { pemPublicKey, pemPrivateKey } = await getKeyPairFromSeedPhrase(seed);

      setCreateKeysState({ status: 'pending', message: 'Computing enrollment ID and CSR...' });

      const enrollmentID = await getEnrollmentId(pemPublicKey);
      const csrPem = createCsr(enrollmentID, pemPrivateKey, pemPublicKey);

      localStorage.setItem('enrollmentId', enrollmentID);
      localStorage.setItem('csr', csrPem);
      localStorage.setItem('privateKey', pemPrivateKey);
      localStorage.setItem('publicKey', pemPublicKey);

      const networkLabel = NETWORK_CONFIG[nglNetwork].label;
      setCreateKeysState({ status: 'pending', message: `Registering and enrolling on ${networkLabel}...` });

      const certificate = await registerAndEnrollUser(nglNetwork, enrollmentID, csrPem);
      localStorage.setItem('cert', certificate);

      setKeysResult({
        enrollmentId: enrollmentID,
        publicKey: pemPublicKey,
        privateKey: pemPrivateKey,
        cert: certificate,
      });
      setCreateKeysState({
        status: 'success',
        message: `Keys created and registered on ${networkLabel}.`,
      });
    } catch (error) {
      setCreateKeysState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create and register keys.',
      });
    }
  };

  return (
    <section className="card-panel">
      <div className="panel-header">
        <h2>Create &amp; Register Keys (NGL)</h2>
        <p>Generate a key pair and register on the NGL governance layer.</p>
      </div>
      <div className="form">
        <label className="field">
          <span>Network</span>
          <div className="tab-switcher">
            {NGL_SUPPORTED_NETWORKS.map((net) => (
              <button
                key={net}
                type="button"
                className={nglNetwork === net ? 'active' : ''}
                onClick={() => setNglNetwork(net)}
              >
                {NETWORK_CONFIG[net].label}
              </button>
            ))}
          </div>
        </label>
        <button
          type="button"
          onClick={handleClickCreateKeys}
          disabled={createKeysState.status === 'pending'}
        >
          {createKeysState.status === 'pending' ? 'Creating...' : 'Create and Register Keys'}
        </button>
        <ResultBox state={createKeysState} />
        {keysResult && (
          <div className="keys-output">
            <CopyField label="Enrollment ID" value={keysResult.enrollmentId} />
            <CopyField label="Public Key" value={keysResult.publicKey} />
            <CopyField label="Private Key" value={keysResult.privateKey} />
            <CopyField label="Certificate" value={keysResult.cert} />
            <button
              type="button"
              className="ghost"
              onClick={() => downloadKeysFile(keysResult)}
            >
              Download All
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="copy-field">
      <div className="copy-field-header">
        <span className="copy-field-label">{label}</span>
        <button type="button" className="copy-btn" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="copy-field-value">{value}</pre>
    </div>
  );
}

function ResultBox({ state }: { state: AsyncState }) {
  if (state.status === 'idle') {
    return null;
  }

  return (
    <div className={`result-box result-box--${state.status}`} role="status" aria-live="polite">
      <strong>{state.status === 'success' ? 'Success' : state.status === 'error' ? 'Error' : 'Working'}</strong>
      <p>{state.message}</p>
    </div>
  );
}

export default App;
