// Transaction stubs — use executeTradeWithWallet in contractWiring.ts (Lace + /api/trade).
export async function executeBuy(_params: any) {
  throw new Error('Use executeTradeWithWallet in contractWiring.ts');
}
export async function executeSell(_params: any) {
  throw new Error('Use executeTradeWithWallet in contractWiring.ts');
}
export async function launchToken(_params: any) {
  throw new Error('Use contractWiring.ts for browser transactions');
}
