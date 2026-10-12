import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { workbookToParsedSheet } from '../parseFile';
import type { ParsedSheet } from '../../types';

export function loadSample(): ParsedSheet {
  const text = readFileSync(resolve(__dirname, '../../../public/sample-orders.csv'), 'utf-8');
  return workbookToParsedSheet(XLSX, XLSX.read(text, { type: 'string', raw: true }), 'sample-orders.csv');
}
