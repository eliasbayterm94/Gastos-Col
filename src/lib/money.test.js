// Runnable with: node --test  (zero dependencies)
// The same file is compatible with vitest once the frontend suite is set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCOP, parseCOP, saldoDireccion, anticipoSaldo, closurePreview, assertPesos,
} from './money.js';

test('formatCOP formatea en pesos colombianos', () => {
  assert.equal(formatCOP(0), '$ 0');
  assert.equal(formatCOP(1000), '$ 1.000');
  assert.equal(formatCOP(550000), '$ 550.000');
  assert.equal(formatCOP(1234567), '$ 1.234.567');
  assert.equal(formatCOP(-80000), '-$ 80.000');
});

test('parseCOP acepta formatos variados y rechaza no-dígitos', () => {
  assert.equal(parseCOP('$ 550.000'), 550000);
  assert.equal(parseCOP('550000'), 550000);
  assert.equal(parseCOP('550,000'), 550000);
  assert.equal(parseCOP('  1.234.567 '), 1234567);
  assert.equal(parseCOP('-80.000'), -80000);
  assert.equal(parseCOP(''), null);
  assert.equal(parseCOP('abc'), null);
  assert.equal(parseCOP(300000), 300000);
});

test('assertPesos rechaza floats y no-enteros', () => {
  assert.throws(() => assertPesos(100.5));
  assert.throws(() => assertPesos('100'));
  assert.throws(() => assertPesos(NaN));
  assert.equal(assertPesos(100), 100);
});

test('saldoDireccion clasifica correctamente', () => {
  assert.equal(saldoDireccion(50000), 'a_favor_operario');
  assert.equal(saldoDireccion(-80000), 'a_favor_forest');
  assert.equal(saldoDireccion(0), 'neutro');
});

test('anticipoSaldo = monto − gastos aplicados', () => {
  assert.equal(anticipoSaldo(500000, 0), 500000);
  assert.equal(anticipoSaldo(500000, 550000), -50000);
  assert.equal(anticipoSaldo(500000, 500000), 0);
});

test('closurePreview: gastos exceden anticipo (Forest reembolsa)', () => {
  const r = closurePreview([{ monto: 300000 }, { monto: 250000 }], 500000);
  assert.deepEqual(r, {
    totalGastos: 550000, anticipoAplicado: 500000, saldo: 50000, direccion: 'a_favor_operario',
  });
});

test('closurePreview: anticipo excede gastos (operario devuelve) — caso probado en DB', () => {
  const r = closurePreview([{ monto: 300000 }, { monto: 120000 }], 500000);
  assert.deepEqual(r, {
    totalGastos: 420000, anticipoAplicado: 500000, saldo: -80000, direccion: 'a_favor_forest',
  });
});

test('closurePreview: reembolso directo sin anticipo', () => {
  const r = closurePreview([{ monto: 120000 }, { monto: 30000 }], null);
  assert.deepEqual(r, {
    totalGastos: 150000, anticipoAplicado: 0, saldo: 150000, direccion: 'a_favor_operario',
  });
});

test('closurePreview: exige al menos un gasto y montos enteros', () => {
  assert.throws(() => closurePreview([], 100));
  assert.throws(() => closurePreview([{ monto: 100.5 }], null));
});

test('closurePreview reconcilia al peso con muchos gastos', () => {
  const gastos = Array.from({ length: 37 }, (_, i) => ({ monto: 1000 + i }));
  const suma = gastos.reduce((a, e) => a + e.monto, 0);
  const r = closurePreview(gastos, 20000);
  assert.equal(r.totalGastos, suma);
  assert.equal(r.saldo, suma - 20000);
});
