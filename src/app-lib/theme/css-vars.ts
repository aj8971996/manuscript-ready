/**
 * Derive CSS-variable declarations from tokens. Keeps tokens.ts as the
 * single source; NativeWind consumes the generated variables via global.css.
 *
 * Not consumed at runtime by app code — emitted into global.css by hand at
 * commit time, with this module as the derivation check. If global.css ever
 * drifts from tokens.ts, regenerate and commit.
 */
import { lightTokens, darkTokens, type TokenMap } from './tokens';

const toVarName = (token: string): string => `--color-${token}`;

export function toCssBlock(tokens: TokenMap): string {
  return Object.entries(tokens)
    .map(([k, v]) => `  ${toVarName(k)}: ${v};`)
    .join('\n');
}

export const lightCssBlock = toCssBlock(lightTokens);
export const darkCssBlock = toCssBlock(darkTokens);