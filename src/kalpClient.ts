import elliptic from 'elliptic';
import { KEYUTIL } from 'jsrsasign';
import { Buffer } from 'buffer';

type NetworkConfig = {
  label: string;
  gatewayBaseUrl: string;
  channelName: string;
  chainCodeName: string;
};

export type KalpNetwork = 'DEVNET' | 'LOADNET' | 'PROD_TESTNET_NEW' | 'STAGENET';

export const NETWORK_CONFIG: Record<KalpNetwork, NetworkConfig> = {
  DEVNET: {
    label: 'Devnet',
    gatewayBaseUrl: 'https://dev-kalp-gateway.p2eppl.com/transaction/v1',
    channelName: 'kalp-devnet',
    chainCodeName: 'klp-f02611a93e2-cc',
  },
  LOADNET: {
    label: 'Loadnet',
    gatewayBaseUrl: 'https://loadnet-kalp-gateway.p2eppl.com/transaction/v1',
    channelName: 'kalp-loadnet',
    chainCodeName: 'klp-f02611a93e-cc',
  },
  PROD_TESTNET_NEW: {
    label: 'Prod Testnet',
    gatewayBaseUrl: 'https://rpc-mumbai-newtest.kalp.network/transaction/v1',
    channelName: 'kalptantra',
    chainCodeName: 'klp-f02611a93e-cc',
  },
  STAGENET: {
    label: 'Stagenet',
    gatewayBaseUrl: 'https://qa-kalp-gateway.p2eppl.com/transaction/v1',
    channelName: 'stage',
    chainCodeName: 'klp-f02611a93e-cc',
  },
};

const ec = new elliptic.ec('p256');

type SubmitArgs = {
  gatewayBaseUrl: string;
  enrollmentId: string;
  privateKey: string;
  cert: string;
  channelName: string;
  chainCodeName: string;
  transactionName: string;
  transactionParams: string[];
};

type EvaluateArgs = SubmitArgs;

type Credentials = {
  enrollmentId: string;
  privateKey: string;
  cert: string;
};

const NETWORK_OVERRIDES: Partial<Record<KalpNetwork, Credentials>> = {
  DEVNET: {
    enrollmentId: '0b87970433b22494faff1cc7a819e71bddc7880c',
    privateKey:
      '-----BEGIN PRIVATE KEY-----\r\nMEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCCfT4cOgAMixovrMi/V\r\n2ZunH6Iqhw9IvCqZh+aBgWDFkQ==\r\n-----END PRIVATE KEY-----',
    cert: `-----BEGIN CERTIFICATE-----
MIIDXzCCAwagAwIBAgIUYVIFhJ0a7DCTRBmyAVFIw7Z+sSQwCgYIKoZIzj0EAwIw
gbIxCzAJBgNVBAYTAlVTMREwDwYDVQQIEwhEZWxhd2FyZTFQME4GA1UEBxNHUDJF
IExBQlMgTExDICAxMDA3IE4gT3JhbmdlIFN0LiA0dGggRmxvb3IgU3RlIDEzODIg
V2lsbWluZ3RvbiBVLlMgMTk4MDExETAPBgNVBAoTCE1BSSBMYWJzMQ8wDQYDVQQL
EwZjbGllbnQxGjAYBgNVBAMTEWV4YW1wbGUtaW50LWFkbWluMB4XDTI1MDMyNDEx
MTUwMFoXDTI2MDMyNDEzMzgwMFowgbwxCzAJBgNVBAYTAklOMRYwFAYDVQQIEw1Z
b3VyIFByb3ZpbmNlMRYwFAYDVQQHEw1Zb3VyIExvY2FsaXR5MRowGAYDVQQKExFZ
b3VyIE9yZ2FuaXphdGlvbjEuMAwGA1UECxMFYWRtaW4wDgYDVQQLEwdjbGllbnRz
MA4GA1UECxMHZXhhbXBsZTExMC8GA1UEAxMoMGI4Nzk3MDQzM2IyMjQ5NGZhZmYx
Y2M3YTgxOWU3MWJkZGM3ODgwYzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABAGY
vufqrpTwK9FyfEqQfQzWIWIGqitbdBsB+xmrgfq9QohpV5dxZm7PnwdGKm6W0DAb
e7tcOuOwNeBA17/guPCjge0wgeowDgYDVR0PAQH/BAQDAgeAMAwGA1UdEwEB/wQC
MAAwHQYDVR0OBBYEFAPHx9w+8ivIDTXLgfBs3rAy95n6MB8GA1UdIwQYMBaAFGY8
8h0o3yYDKirES5q6XcUOZzsqMIGJBggqAwQFBgcIAQR9eyJhdHRycyI6eyJoZi5B
ZmZpbGlhdGlvbiI6ImV4YW1wbGUuY2xpZW50cyIsImhmLkVucm9sbG1lbnRJRCI6
IjBiODc5NzA0MzNiMjI0OTRmYWZmMWNjN2E4MTllNzFiZGRjNzg4MGMiLCJoZi5U
eXBlIjoiYWRtaW4ifX0wCgYIKoZIzj0EAwIDRwAwRAIgN9lzLZqjuGrZw/wiA9qM
DcLbnM39pkIMbXahgaDtzX0CIDskTgSLszksciSN+fBsoEQNbFW+RzdLWByHOTbq
2zxO
-----END CERTIFICATE-----`,
  },
  LOADNET: {
    enrollmentId: '0b87970433b22494faff1cc7a819e71bddc7880c',
    privateKey:
      '-----BEGIN PRIVATE KEY-----\r\nMEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCCfT4cOgAMixovrMi/V\r\n2ZunH6Iqhw9IvCqZh+aBgWDFkQ==\r\n-----END PRIVATE KEY-----',
    cert: `-----BEGIN CERTIFICATE-----
MIIDYDCCAwagAwIBAgIUEJCcj0aOJUXKLtOi6XbjRQms0pQwCgYIKoZIzj0EAwIw
gbIxCzAJBgNVBAYTAlVTMREwDwYDVQQIEwhEZWxhd2FyZTFQME4GA1UEBxNHUDJF
IExBQlMgTExDICAxMDA3IE4gT3JhbmdlIFN0LiA0dGggRmxvb3IgU3RlIDEzODIg
V2lsbWluZ3RvbiBVLlMgMTk4MDExETAPBgNVBAoTCE1BSSBMYWJzMQ8wDQYDVQQL
EwZjbGllbnQxGjAYBgNVBAMTEWxvYWRuZXQtaW50LWFkbWluMB4XDTI1MDMyMTEx
NTQwMFoXDTI2MDMyNDExNTQwMFowgbwxCzAJBgNVBAYTAklOMRYwFAYDVQQIEw1Z
b3VyIFByb3ZpbmNlMRYwFAYDVQQHEw1Zb3VyIExvY2FsaXR5MRowGAYDVQQKExFZ
b3VyIE9yZ2FuaXphdGlvbjEuMAwGA1UECxMFYWRtaW4wDgYDVQQLEwdjbGllbnRz
MA4GA1UECxMHbG9hZG5ldDExMC8GA1UEAxMoMGI4Nzk3MDQzM2IyMjQ5NGZhZmYx
Y2M3YTgxOWU3MWJkZGM3ODgwYzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABAGY
vufqrpTwK9FyfEqQfQzWIWIGqitbdBsB+xmrgfq9QohpV5dxZm7PnwdGKm6W0DAb
e7tcOuOwNeBA17/guPCjge0wgeowDgYDVR0PAQH/BAQDAgeAMAwGA1UdEwEB/wQC
MAAwHQYDVR0OBBYEFAPHx9w+8ivIDTXLgfBs3rAy95n6MB8GA1UdIwQYMBaAFD2t
BYv5SxrtBCRbFk19bTllee7eMIGJBggqAwQFBgcIAQR9eyJhdHRycyI6eyJoZi5B
ZmZpbGlhdGlvbiI6ImxvYWRuZXQuY2xpZW50cyIsImhmLkVucm9sbG1lbnRJRCI6
IjBiODc5NzA0MzNiMjI0OTRmYWZmMWNjN2E4MTllNzFiZGRjNzg4MGMiLCJoZi5U
eXBlIjoiYWRtaW4ifX0wCgYIKoZIzj0EAwIDSAAwRQIhANJm5dOULGjxoPJxkoJO
RGxYr5c2JlGAtk9n6W5j3fSCAiAlc1hMQP/gRW/ncoZm4qFTBgGpRr4Bb08Kdu7q
sYr6NQ==
-----END CERTIFICATE-----`,
  },
  PROD_TESTNET_NEW: {
    enrollmentId: '0b87970433b22494faff1cc7a819e71bddc7880c',
    privateKey:
      '-----BEGIN PRIVATE KEY-----\r\nMEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCCfT4cOgAMixovrMi/V\r\n2ZunH6Iqhw9IvCqZh+aBgWDFkQ==\r\n-----END PRIVATE KEY-----',
    cert: `-----BEGIN CERTIFICATE-----
MIIDXzCCAwagAwIBAgIUEdyG5n04NiIN5Ivz8P0W7bed3T0wCgYIKoZIzj0EAwIw
gbIxCzAJBgNVBAYTAlVTMREwDwYDVQQIEwhEZWxhd2FyZTFQME4GA1UEBxNHUDJF
IExBQlMgTExDICAxMDA3IE4gT3JhbmdlIFN0LiA0dGggRmxvb3IgU3RlIDEzODIg
V2lsbWluZ3RvbiBVLlMgMTk4MDExETAPBgNVBAoTCE1BSSBMYWJzMQ8wDQYDVQQL
EwZjbGllbnQxGjAYBgNVBAMTEW1haWxhYnMtaW50LWFkbWluMB4XDTI1MDUwODEz
MDgwMFoXDTI2MDUxNDEzMzQwMFowgbwxCzAJBgNVBAYTAklOMRYwFAYDVQQIEw1Z
b3VyIFByb3ZpbmNlMRYwFAYDVQQHEw1Zb3VyIExvY2FsaXR5MRowGAYDVQQKExFZ
b3VyIE9yZ2FuaXphdGlvbjEuMAwGA1UECxMFYWRtaW4wDgYDVQQLEwdjbGllbnRz
MA4GA1UECxMHbWFpbGFiczExMC8GA1UEAxMoMGI4Nzk3MDQzM2IyMjQ5NGZhZmYx
Y2M3YTgxOWU3MWJkZGM3ODgwYzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABAGY
vufqrpTwK9FyfEqQfQzWIWIGqitbdBsB+xmrgfq9QohpV5dxZm7PnwdGKm6W0DAb
e7tcOuOwNeBA17/guPCjge0wgeowDgYDVR0PAQH/BAQDAgeAMAwGA1UdEwEB/wQC
MAAwHQYDVR0OBBYEFAPHx9w+8ivIDTXLgfBs3rAy95n6MB8GA1UdIwQYMBaAFOkE
lijqYLEag/4hKKdcz4UKagfaMIGJBggqAwQFBgcIAQR9eyJhdHRycyI6eyJoZi5B
ZmZpbGlhdGlvbiI6Im1haWxhYnMuY2xpZW50cyIsImhmLkVucm9sbG1lbnRJRCI6
IjBiODc5NzA0MzNiMjI0OTRmYWZmMWNjN2E4MTllNzFiZGRjNzg4MGMiLCJoZi5U
eXBlIjoiYWRtaW4ifX0wCgYIKoZIzj0EAwIDRwAwRAIgc86Y7yhrgNXTeugZ72xb
QNZt0ygAc8PmHDXXWN4slWACIBK7vV2e2fQWoEx48EY2RrxAFOIJLER/drIEnBJ5
OwGr
-----END CERTIFICATE-----`,
  },
  STAGENET: {
    enrollmentId: '0b87970433b22494faff1cc7a819e71bddc7880c',
    privateKey:
      '-----BEGIN PRIVATE KEY-----\r\nMEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCCfT4cOgAMixovrMi/V\r\n2ZunH6Iqhw9IvCqZh+aBgWDFkQ==\r\n-----END PRIVATE KEY-----',
    cert: `-----BEGIN CERTIFICATE-----
MIIDLzCCAtagAwIBAgIUDISjj/xQ3a9ka8ufV0OnwKiPNgUwCgYIKoZIzj0EAwIw
fzELMAkGA1UEBhMCSU4xFjAUBgNVBAgTDVV0dGFyIFByYWRlc2gxDjAMBgNVBAcT
BU5vaWRhMRowGAYDVQQKExFQMkUgUHJvIFB2dC4gTHRkLjEPMA0GA1UECxMGY2xp
ZW50MRswGQYDVQQDExJzdGFnZW5ldC1pbnQtYWRtaW4wIBcNMjYwMzE4MDgxMDAw
WhgPMjEyNjAzMTkwODEwMDBaMIG9MQswCQYDVQQGEwJJTjEWMBQGA1UECBMNWW91
ciBQcm92aW5jZTEWMBQGA1UEBxMNWW91ciBMb2NhbGl0eTEaMBgGA1UEChMRWW91
ciBPcmdhbml6YXRpb24xLzAMBgNVBAsTBWFkbWluMA4GA1UECxMHY2xpZW50czAP
BgNVBAsTCHN0YWdlbmV0MTEwLwYDVQQDEygwYjg3OTcwNDMzYjIyNDk0ZmFmZjFj
YzdhODE5ZTcxYmRkYzc4ODBjMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEAZi+
5+qulPAr0XJ8SpB9DNYhYgaqK1t0GwH7GauB+r1CiGlXl3Fmbs+fB0YqbpbQMBt7
u1w647A14EDXv+C48KOB7jCB6zAOBgNVHQ8BAf8EBAMCB4AwDAYDVR0TAQH/BAIw
ADAdBgNVHQ4EFgQUA8fH3D7yK8gNNcuB8GzesDL3mfowHwYDVR0jBBgwFoAUyxoK
se3UvvhLtpWiQ0vgmAC1820wgYoGCCoDBAUGBwgBBH57ImF0dHJzIjp7ImhmLkFm
ZmlsaWF0aW9uIjoic3RhZ2VuZXQuY2xpZW50cyIsImhmLkVucm9sbG1lbnRJRCI6
IjBiODc5NzA0MzNiMjI0OTRmYWZmMWNjN2E4MTllNzFiZGRjNzg4MGMiLCJoZi5U
eXBlIjoiYWRtaW4ifX0wCgYIKoZIzj0EAwIDRwAwRAIgeNNlbx3P1myYtD8RgCu2
Q/K7n8ZGh4cL7nOX2DnK7CECICYREdAXkyPFrFPYTTra8QTOO99Z4KIoUTWsLlDx
WE1R
-----END CERTIFICATE-----`,
  },
};

function resolveCredentials(network: KalpNetwork): Credentials {
  const override = NETWORK_OVERRIDES[network];
  if (override) {
    return override;
  }
  return getStoredCredentials();
}

export const NETWORK_OPTIONS = (Object.keys(NETWORK_CONFIG) as KalpNetwork[]).map(
  (key) => ({
    id: key,
    label: NETWORK_CONFIG[key].label,
  }),
);

export async function writeKalpTransaction(options: {
  network: KalpNetwork;
  toAddress: string;
  amount: string;
}) {
  const { enrollmentId, privateKey, cert } = resolveCredentials(options.network);
  const config = NETWORK_CONFIG[options.network];
  return submitTransaction({
    gatewayBaseUrl: config.gatewayBaseUrl,
    enrollmentId,
    privateKey,
    cert,
    channelName: config.channelName,
    chainCodeName: config.chainCodeName,
    transactionName: 'Transfer',
    transactionParams: [options.toAddress, options.amount],
  });
}

export async function evaluateKalpBalance(options: {
  network: KalpNetwork;
  address: string;
}) {
  const { enrollmentId, privateKey, cert } = resolveCredentials(options.network);
  const config = NETWORK_CONFIG[options.network];
  return evaluateTransaction({
    gatewayBaseUrl: config.gatewayBaseUrl,
    enrollmentId,
    privateKey,
    cert,
    channelName: config.channelName,
    chainCodeName: config.chainCodeName,
    transactionName: 'BalanceOf',
    transactionParams: [options.address],
  });
}

export async function evaluateKalpTransaction(options: {
  network: KalpNetwork;
  chainCodeName: string;
  transactionName: string;
  transactionParams: string[];
}) {
  const { enrollmentId, privateKey, cert } = resolveCredentials(options.network);
  const config = NETWORK_CONFIG[options.network];
  return evaluateTransaction({
    gatewayBaseUrl: config.gatewayBaseUrl,
    enrollmentId,
    privateKey,
    cert,
    channelName: config.channelName,
    chainCodeName: options.chainCodeName,
    transactionName: options.transactionName,
    transactionParams: options.transactionParams,
  });
}

export async function submitKalpTransaction(options: {
  network: KalpNetwork;
  chainCodeName: string;
  transactionName: string;
  transactionParams: string[];
}) {
  const { enrollmentId, privateKey, cert } = resolveCredentials(options.network);
  const config = NETWORK_CONFIG[options.network];
  return submitTransaction({
    gatewayBaseUrl: config.gatewayBaseUrl,
    enrollmentId,
    privateKey,
    cert,
    channelName: config.channelName,
    chainCodeName: options.chainCodeName,
    transactionName: options.transactionName,
    transactionParams: options.transactionParams,
  });
}

export function getStoredCredentials(): Credentials {
  const enrollmentId = localStorage.getItem('enrollmentId')?.trim();
  const privateKey = localStorage.getItem('privateKey')?.trim();
  const cert = localStorage.getItem('cert')?.trim();

  if (!enrollmentId || !privateKey || !cert) {
    throw new Error('Missing enrollmentId/privateKey/cert in localStorage.');
  }
  return { enrollmentId, privateKey, cert };
}

async function submitTransaction(args: SubmitArgs) {
  const proposalUrl = `${args.gatewayBaseUrl}/proposal`;
  const endorseUrl = `${args.gatewayBaseUrl}/endorse`;
  const submitUrl = `${args.gatewayBaseUrl}/submit`;
  const commitUrl = `${args.gatewayBaseUrl}/commitstatus`;

  const transaction = buildTransactionPayload(args);
  const proposalData = await restCall<{ message: { proposal: string } }>(
    proposalUrl,
    transaction,
  );

  const signedProposal = await signPayload({
    privateKey: args.privateKey,
    payloadBase64: proposalData.message.proposal,
    payloadKey: 'proposal',
  });

  const endorseData = await restCall<{ message: { endorse: string } }>(
    endorseUrl,
    signedProposal,
  );

  const signedEndorse = await signPayload({
    privateKey: args.privateKey,
    payloadBase64: endorseData.message.endorse,
    payloadKey: 'endorse',
  });

  const submitData = await restCall<{ message: { submit: string } }>(
    submitUrl,
    signedEndorse,
  );

  const signedCommit = await signPayload({
    privateKey: args.privateKey,
    payloadBase64: submitData.message.submit,
    payloadKey: 'submit',
  });

  const commitResponse = await restCall<{ message: { transaction_id: string } }>(
    commitUrl,
    signedCommit,
  );

  return commitResponse.message.transaction_id;
}

async function evaluateTransaction(args: EvaluateArgs) {
  const proposalUrl = `${args.gatewayBaseUrl}/proposal`;
  const evaluateUrl = `${args.gatewayBaseUrl}/evaluate`;

  const transaction = buildTransactionPayload(args);

  const result = await evaluateSignedTransaction({
    privateKey: args.privateKey,
    proposalUrl,
    evaluateUrl,
    transaction,
  });

  return result;
}

function buildTransactionPayload(args: SubmitArgs) {
  return {
    enrollmentID: args.enrollmentId,
    cert: args.cert,
    channelName: args.channelName,
    chainCodeName: args.chainCodeName,
    transactionName: args.transactionName,
    transactionParams: args.transactionParams,
  };
}

async function evaluateSignedTransaction({
  privateKey,
  proposalUrl,
  evaluateUrl,
  transaction,
}: {
  privateKey: string;
  proposalUrl: string;
  evaluateUrl: string;
  transaction: ReturnType<typeof buildTransactionPayload>;
}) {
  const proposalData = await restCall<{ message: { proposal: string } }>(
    proposalUrl,
    transaction,
  );

  const signedProposal = await signPayload({
    privateKey,
    payloadBase64: proposalData.message.proposal,
    payloadKey: 'proposal',
  });

  const evaluateData = await restCall<{ message: { evaluate: string } }>(
    evaluateUrl,
    signedProposal,
  );

  return evaluateData.message.evaluate;
}

async function signPayload({
  privateKey,
  payloadBase64,
  payloadKey,
}: {
  privateKey: string;
  payloadBase64: string;
  payloadKey: 'proposal' | 'endorse' | 'submit';
}) {
  const payloadBytes = decodeBase64String(payloadBase64);
  const { r, s } = signUsingElliptic(privateKey, payloadBytes);
  return {
    signedR: r,
    signedS: s,
    [payloadKey]: payloadBase64,
  };
}

function decodeBase64String(value: string) {
  if (typeof window === 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function signUsingElliptic(privateKeyString: string, bytes: Uint8Array) {
  const parsedKey = KEYUTIL.getKey(privateKeyString) as { prvKeyHex?: string };
  if (typeof parsedKey?.prvKeyHex !== 'string') {
    throw new Error('Unable to parse private key for signing.');
  }
  const key = ec.keyFromPrivate(parsedKey.prvKeyHex, 'hex');
  const signature = key.sign(Buffer.from(bytes));

  return {
    r: signature.r.toString(),
    s: signature.s.toString(),
  };
}

async function restCall<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // no-op
  }

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null
        ? JSON.stringify(parsed)
        : response.statusText;
    throw new Error(`RPC call failed for ${url}: ${message}`);
  }

  return parsed as T;
}

