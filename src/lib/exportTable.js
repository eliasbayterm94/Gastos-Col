// Utilidades para exportar/copiar tablas (para pegar en el banco/Excel).
function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows, headers) {
  const head = headers.map((h) => esc(h.label)).join(',');
  const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(',')).join('\n');
  return `${head}\n${body}`;
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Copia tab-separado (se pega directo en Excel/Sheets/banco).
export async function copyTSV(rows, headers) {
  const line = (cells) => cells.map((c) => String(c ?? '').replace(/\t/g, ' ')).join('\t');
  const text = [line(headers.map((h) => h.label)), ...rows.map((r) => line(headers.map((h) => r[h.key])))].join('\n');
  await navigator.clipboard.writeText(text);
}
