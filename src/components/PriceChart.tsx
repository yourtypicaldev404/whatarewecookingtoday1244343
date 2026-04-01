'use client';
import { useEffect, useRef } from 'react';

export type PricePoint = { time: number; value: number };

export default function PriceChart({ ticker, data }: { ticker: string; data?: PricePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!data || data.length === 0) return;

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

      series.setData(data.map(d => ({ time: d.time as any, value: d.value })));
      chart.timeScale().fitContent();
    });

    return () => chart?.remove();
  }, [ticker, data]);

  if (!data || data.length === 0) {
    return (
      <div ref={ref} style={{ width: '100%', height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-tertiary)' }}>
          No price data yet
        </span>
      </div>
    );
  }

  return <div ref={ref} style={{ width: '100%', height: 280 }} />;
}
