import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

function openDialog(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>('dialog[open]');
}

/** The modal <dialog> that is open right now (it sits in the browser's top layer), or null. */
export function useOpenDialog(): HTMLDialogElement | null {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(() => openDialog());
  useEffect(() => {
    const sync = () => setDialog(openDialog());
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    return () => mo.disconnect();
  }, []);
  return dialog;
}

/**
 * Effects that must be seen the instant they happen, even with the product view open: a modal
 * <dialog> is drawn in the top layer, above every z-index on the page, so these are rendered
 * inside it while it is open and back on the page once it closes.
 */
export function TopLayer({ children, stick = false }: { children: ReactNode; stick?: boolean }) {
  const dialog = useOpenDialog();
  // `stick`: stay where it started. A scene that began in the product view ends with it,
  // instead of playing again over the shop once the view is closed.
  const [home] = useState(() => openDialog());
  if (stick) {
    if (home && !(home.isConnected && home.open)) return null;
    return createPortal(children, home ?? document.body);
  }
  return createPortal(children, dialog ?? document.body);
}
