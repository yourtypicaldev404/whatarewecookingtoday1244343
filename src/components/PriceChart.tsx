'use client';
import { useEffect, useRef } from 'react';

export default function PriceChart({ ticker }: { ticker: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let chart: any;

    import('lightweight-charts').then(({ createChart, ColorType, LineStyle }) => {
      chart = createChart(ref.current!, {
        width:  ref.current!.clientWidth,
        height: 280,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255,255,255,0.4)',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
          horzLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
        },
        crosshair: { vertLine: { color: '#4ed16b' }, horzLine: { color: '#4ed16b' } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
      });

      const series = chart.addAreaSeries({
        lineColor: '#4ed16b',
        topColor: 'rgba(78,209,107,0.2)',
        bottomColor: 'rgba(78,209,107,0.0)',
        lineWidth: 2,
      });

      // Mock price data — replace with real indexer data
      const now = Math.floor(Date.now() / 1000);
      const data = Array.from({ length: 50 }, (_, i) => ({
        time: (now - (50 - i) * 300) as any,
        value: 0.000001 * (1 + Math.random() * 0.5 + i * 0.02),
      }));
      series.setData(data);
      chart.timeScale().fitContent();
    });

    return () => chart?.remove();
  }, [ticker]);

  return <div ref={ref} style={{ width: '100%', height: 280 }} />;
}
