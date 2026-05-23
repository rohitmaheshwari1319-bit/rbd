import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export function Barcode({ value, height = 50, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, String(value), {
        format: 'CODE128',
        height,
        width: 1.6,
        displayValue: true,
        fontSize: 12,
        margin: 4,
        background: 'transparent',
        lineColor: '#111827'
      });
    } catch { /* ignore invalid values */ }
  }, [value, height]);
  return <svg ref={ref} className={className} />;
}

export function QR({ value, size = 96, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(ref.current, String(value), { width: size, margin: 1, color: { dark: '#111827', light: '#00000000' } });
  }, [value, size]);
  return <canvas ref={ref} className={className} />;
}
