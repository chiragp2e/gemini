import elliptic from 'elliptic';
import { KEYUTIL, KJUR } from 'jsrsasign';
import { ethers } from 'ethers';

import type { KalpNetwork } from './kalpClient';

const REGISTER_URL = '/pki/register';
const ENROLL_CSR_URL = '/pki/enrollCsr';
const AUTHORIZATION_KEY =
  'f5b1aca0717e01d0dbca408d281e9e5145250acb146ff9f0844d53e95aab30b5';
const MAX_ENROLLMENTS = '-1';

type NglConfig = {
  governanceBaseUrl: string;
  channelName: string;
};

const NGL_CONFIGS: Partial<Record<KalpNetwork, NglConfig>> = {
  PROD_TESTNET_NEW: {
    governanceBaseUrl: 'https://ngl-userreg-test.kalp.network/v1',
    channelName: 'prod-testnet',
  },
  STAGENET: {
    governanceBaseUrl: 'https://stg-userreg-gov.p2eppl.com/v1',
    channelName: 'kalpstagenet_new',
  },
};

export const NGL_SUPPORTED_NETWORKS = Object.keys(NGL_CONFIGS) as KalpNetwork[];

function getNglConfig(network: KalpNetwork): NglConfig {
  const config = NGL_CONFIGS[network];
  if (!config) {
    throw new Error(`NGL registration is not supported for network: ${network}`);
  }
  return config;
}

const UPPER_CASE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER_CASE_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz';
const SPECIAL_CHARACTERS = '!@#$%^&*+-=';
const NUMBERS = '0123456789';

const ec = new elliptic.ec('p256');

export async function getSeedPhrase(): Promise<string> {
  const wallet = ethers.Wallet.createRandom();
  return wallet.mnemonic!.phrase;
}

export async function getKeyPairFromSeedPhrase(
  seedPhrase: string,
): Promise<{ pemPrivateKey: string; pemPublicKey: string }> {
  const seed = ethers.utils.mnemonicToSeed(seedPhrase);
  const key = ec.keyFromPrivate(seed);
  const privateKeyHex = key.getPrivate('hex');
  const publicKeyHex = key.getPublic('hex');

  const convPrivateKey = KEYUTIL.getKey({ curve: 'secp256r1', d: privateKeyHex });
  const pemPrivateKey = KEYUTIL.getPEM(convPrivateKey, 'PKCS8PRV');
  const pemPublicKey = await convertPublicKeyHexToPem(publicKeyHex);

  return { pemPrivateKey, pemPublicKey };
}

async function convertPublicKeyHexToPem(pubKeyHex: string): Promise<string> {
  const publicKeyBuffer = new Uint8Array(pubKeyHex.length / 2);
  for (let i = 0; i < pubKeyHex.length; i += 2) {
    publicKeyBuffer[i / 2] = parseInt(pubKeyHex.substr(i, 2), 16);
  }

  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  );

  const exported = await crypto.subtle.exportKey('spki', publicKey);
  const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return `-----BEGIN PUBLIC KEY-----\n${base64Key}\n-----END PUBLIC KEY-----\n`;
}

export async function getEnrollmentId(publicKey: string): Promise<string> {
  const stripped = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----\r?\n|\r?\n?-----END PUBLIC KEY-----\r?\n?|\r?\n/g, '');
  const binaryString = atob(stripped);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = new Uint8Array(hashBuffer);
  const hexString = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hexString.slice(-40);
}

export function createCsr(
  enrollmentID: string,
  privateKeyPem: string,
  publicKeyPem: string,
): string {
  const csr = new KJUR.asn1.csr.CertificationRequest({
    subject: {
      str: `/CN=${enrollmentID}/O=Your Organization/postalCode=Your Postal Code/L=Your Locality/ST=Your Province/C=IN`,
    },
    sbjpubkey: publicKeyPem,
    sigalg: 'SHA256withECDSA',
    sbjprvkey: privateKeyPem,
  });
  return csr.getPEM();
}

export async function getSecret(enrollmentID: string): Promise<string> {
  const data = new TextEncoder().encode(enrollmentID);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const allCharacters =
    UPPER_CASE_CHARACTERS + LOWER_CASE_CHARACTERS + SPECIAL_CHARACTERS + NUMBERS;

  function getCharFromHash(h: string, index: number) {
    const charIndex = parseInt(h.slice(index * 2, index * 2 + 2), 16) % allCharacters.length;
    return allCharacters[charIndex];
  }

  let uniqueString = '';
  uniqueString += UPPER_CASE_CHARACTERS[parseInt(hash.slice(0, 2), 16) % UPPER_CASE_CHARACTERS.length];
  uniqueString += LOWER_CASE_CHARACTERS[parseInt(hash.slice(2, 4), 16) % LOWER_CASE_CHARACTERS.length];
  uniqueString += SPECIAL_CHARACTERS[parseInt(hash.slice(4, 6), 16) % SPECIAL_CHARACTERS.length];
  uniqueString += NUMBERS[parseInt(hash.slice(6, 8), 16) % NUMBERS.length];

  for (let i = 4; i < 16; i++) {
    uniqueString += getCharFromHash(hash, i);
  }
  return uniqueString;
}

export async function registerAndEnrollUser(
  network: KalpNetwork,
  enrollmentID: string,
  csr: string,
): Promise<string> {
  if (enrollmentID.length !== 40) {
    throw new Error('Invalid enrollment ID: Must be 40 characters long.');
  }

  const { governanceBaseUrl, channelName } = getNglConfig(network);
  const encryptedWord = await getSecret(enrollmentID);

  // Register
  const registerEndpoint = governanceBaseUrl + REGISTER_URL;
  const registerResponse = await fetch(registerEndpoint, {
    method: 'POST',
    headers: { Authorization: AUTHORIZATION_KEY },
    body: JSON.stringify({
      enrollmentid: enrollmentID,
      secret: encryptedWord,
      maxenrollments: MAX_ENROLLMENTS,
      channel: channelName,
    }),
  });

  if (!registerResponse.ok) {
    const errorData = await registerResponse.json();
    throw new Error('User registration failed: ' + JSON.stringify(errorData));
  }

  // Enroll CSR
  const enrollEndpoint = governanceBaseUrl + ENROLL_CSR_URL;
  const enrollResponse = await fetch(enrollEndpoint, {
    method: 'POST',
    headers: { Authorization: AUTHORIZATION_KEY },
    body: JSON.stringify({
      enrollmentid: enrollmentID,
      secret: encryptedWord,
      csr: csr,
      channel: channelName,
    }),
  });

  if (!enrollResponse.ok) {
    const errorData = await enrollResponse.json();
    throw new Error('CSR enrollment failed: ' + JSON.stringify(errorData));
  }

  const responseData = await enrollResponse.json();
  return responseData.response.pubcert;
}
