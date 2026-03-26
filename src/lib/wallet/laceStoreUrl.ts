/** Lace extension store URL for the current browser. */
export function getLaceExtensionStoreUrl(): string {
  if (typeof navigator === 'undefined') {
    return 'https://chrome.google.com/webstore/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk';
  }
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) {
    return 'https://addons.mozilla.org/firefox/addon/lace-wallet/';
  }
  if (ua.includes('Edg/')) {
    return 'https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia';
  }
  return 'https://chrome.google.com/webstore/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk';
}
