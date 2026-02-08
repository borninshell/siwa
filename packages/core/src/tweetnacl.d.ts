declare module 'tweetnacl' {
  export interface SignKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  export const sign: {
    keyPair(): SignKeyPair;
    detached: {
      (message: Uint8Array, secretKey: Uint8Array): Uint8Array;
      verify: (message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) => boolean;
    };
  };

  export function randomBytes(n: number): Uint8Array;
}
