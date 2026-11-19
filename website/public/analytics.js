// Initialize the supplied Google tag before loading its container asynchronously.
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
window.gtag('js', new Date());

const googleTagManager = document.createElement('script');
googleTagManager.async = true;
googleTagManager.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-MNLR38BD';
document.head.appendChild(googleTagManager);
