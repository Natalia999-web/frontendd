import { useState, useEffect } from 'react';

export default function DateRangeFilter({ desde: pDesde = '', hasta: pHasta = '', onApply = () => {}, onClear = () => {}, label = 'Filtrar por fecha' }) {
  const [desde, setDesde] = useState(pDesde || '');
  const [hasta, setHasta] = useState(pHasta || '');

  useEffect(() => {
    setDesde(pDesde || '');
    setHasta(pHasta || '');
  }, [pDesde, pHasta]);

  const handleApply = () => {
    onApply({ desde: desde || null, hasta: hasta || null });
  };
  const handleClear = () => {
    setDesde(''); setHasta('');
    onClear();
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#616161' }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0' }} />
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button className="report-btn" onClick={handleApply} style={{ minHeight: 38, padding: '8px 12px' }}>Aplicar</button>
        <button className="btn-ghost" onClick={handleClear} style={{ minHeight: 38, padding: '8px 12px' }}>Limpiar</button>
      </div>
    </div>
  );
}
