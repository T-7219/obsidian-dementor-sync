declare module 'argon2-browser' {
    export interface Options {
        pass: string;
        salt: Uint8Array;
        time?: number;
        mem?: number;
        hashLen?: number;
        parallelism?: number;
        type?: number;
    }

    export interface Result {
        hash: Uint8Array;
        hashHex: string;
        encoded: string;
    }

    export const argon2id: number;
    export const argon2i: number;
    export const argon2d: number;

    export function hash(options: Options): Promise<Result>;
}