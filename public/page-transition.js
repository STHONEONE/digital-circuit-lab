(() => {
  const leaveMs = 260;
  const enterMs = 320;
  const navigateDelayMs = 360;
  let isLeaving = false;

  const style = document.createElement("style");
  style.textContent = `
    body.page-leave {
      opacity: 0;
      transform: scale(0.985);
      transition: opacity ${leaveMs}ms ease, transform ${leaveMs}ms ease;
      will-change: opacity, transform;
    }

    body.page-enter {
      opacity: 0;
      transform: translateY(12px);
      will-change: opacity, transform;
    }

    body.page-enter-active {
      opacity: 1;
      transform: translateY(0);
      transition: opacity ${enterMs}ms ease, transform ${enterMs}ms ease;
      will-change: opacity, transform;
    }

    .transition-flash {
      position: fixed;
      left: 50%;
      top: 50%;
      z-index: 9999;
      width: 130px;
      height: 130px;
      border: 1px solid rgba(0, 209, 255, .8);
      border-radius: 50%;
      opacity: 0;
      pointer-events: none;
      transform: translate(-50%, -50%) scale(.65);
      will-change: opacity, transform;
      box-shadow:
        0 0 24px rgba(0, 209, 255, .55),
        inset 0 0 18px rgba(77, 246, 194, .22);
    }

    .transition-flash::before,
    .transition-flash::after {
      position: absolute;
      inset: 16px;
      border: 1px solid rgba(77, 246, 194, .45);
      border-radius: 50%;
      content: "";
    }

    .transition-flash::after {
      inset: 34px;
      border-color: rgba(124, 108, 255, .45);
    }

    .transition-flash.active {
      animation: flashPulse 360ms ease-out forwards;
    }

    @keyframes flashPulse {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(.65);
      }
      35% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1.45);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      body.page-leave,
      body.page-enter,
      body.page-enter-active {
        opacity: 1;
        transform: none;
        transition: none;
      }

      .transition-flash.active {
        animation: none;
      }
    }
  `;
  document.head.appendChild(style);

  const flash = document.createElement("div");
  flash.className = "transition-flash";
  flash.setAttribute("aria-hidden", "true");
  document.body.appendChild(flash);

  document.body.classList.add("page-enter");
  requestAnimationFrame(() => {
    document.body.classList.add("page-enter-active");
    window.setTimeout(() => {
      document.body.classList.remove("page-enter", "page-enter-active");
    }, enterMs + 40);
  });

  function shouldHandleLink(link, event) {
    if (!link || event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download") || link.dataset.noTransition === "true") return false;

    const nextUrl = new URL(link.href, window.location.href);
    if (nextUrl.origin !== window.location.origin) return false;

    const currentUrl = new URL(window.location.href);
    const sameDocument = nextUrl.pathname === currentUrl.pathname
      && nextUrl.search === currentUrl.search;
    if (sameDocument && nextUrl.hash) return false;

    return true;
  }

  function navigateWithLightTransition(url) {
    if (isLeaving) return;
    isLeaving = true;
    flash.classList.remove("active");
    void flash.offsetWidth;
    flash.classList.add("active");
    document.body.classList.remove("page-enter", "page-enter-active");
    document.body.classList.add("page-leave");
    window.setTimeout(() => {
      window.location.href = url;
    }, navigateDelayMs);
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!shouldHandleLink(link, event)) return;
    event.preventDefault();
    navigateWithLightTransition(link.href);
  }, true);

  window.circuitPageTransition = {
    go: navigateWithLightTransition
  };
})();
