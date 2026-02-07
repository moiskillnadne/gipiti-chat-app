/** biome-ignore-all lint/performance/noImgElement: Yandex Metrika tracking pixel requires img element */
/** biome-ignore-all lint/nursery/useImageSize: Yandex Metrika tracking pixel dimensions not needed */
"use client";

import Script from "next/script";

export function YandexMetrika() {
  return (
    <>
      <Script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for Yandex Metrika initialization script
        dangerouslySetInnerHTML={{
          __html: `
             (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
      })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=106642682', 'ym');

      ym(106642682, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`,
        }}
        id="yandex-metrika"
        strategy="afterInteractive"
      />
      <noscript>
        <div>
          <img
            alt=""
            src="https://mc.yandex.ru/watch/106642682"
            style={{ position: "absolute", left: "-9999px" }}
          />
        </div>
      </noscript>
    </>
  );
}
