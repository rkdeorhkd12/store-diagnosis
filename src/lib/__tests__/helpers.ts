import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { workbookToParsedSheet } from '../parseFile';
import type { ParsedSheet } from '../../types';

export function loadCsv(fileName: string): ParsedSheet {
  const text = readFileSync(resolve(__dirname, '../../../public', fileName), 'utf-8');
  return workbookToParsedSheet(XLSX, XLSX.read(text, { type: 'string', raw: true }), fileName);
}

export const loadSample = () => loadCsv('sample-orders.csv');
