import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildReorderWorkbook, reorderFileName, reorderHeaders, reorderRows } from '../exportReorder';
import { guessInventoryMapping } from '../guessMapping';
import { buildInventory, DEFAULT_CRITERIA, judgeInventory } from '../inventory';
import { loadCsv } from './helpers';

const sheet = loadCsv('sample-inventory.csv');
const items = judgeInventory(buildInventory(sheet, guessInventoryMapping(sheet.headers)).items, DEFAULT_CRITERIA).items;

describe('reorderRows', () => {
  it('리오더 우선만, 예상 소진일 짧은 순으로', () => {
    const rows = reorderRows(items, DEFAULT_CRITERIA);
    expect(rows.map((r) => [r[0], r[1], r[2]])).toEqual([
      [1, '베이직 반팔 티셔츠', '화이트/M'],
      [2, '베이직 반팔 티셔츠', '블랙/M'],
      [3, '코튼 양말 3종', '블랙/FREE'],
    ]);
  });

  it('숫자는 숫자로, 소진일은 소수 한 자리, 부족 수량은 2주치 − 재고 (올림)', () => {
    const [first] = reorderRows(items, DEFAULT_CRITERIA);
    // 화이트/M: 판매 72(5위), 재고 9, 주간 19 → 9÷19×7 = 3.3일, 19×2−9 = 29개
    expect(first.slice(3, 10)).toEqual(['A-01-03', 72, 5, 9, 19, 3.3, 29]);
  });

  it('부족 수량은 기준 주수를 따른다', () => {
    const c = { ...DEFAULT_CRITERIA, soonWeeks: 3 };
    const judged = judgeInventory(buildInventory(sheet, guessInventoryMapping(sheet.headers)).items, c).items;
    expect(reorderHeaders(c)[9]).toBe('3주치까지 부족 수량(참고)');
    expect(reorderRows(judged, c)[0][9]).toBe(19 * 3 - 9);
  });

  it('리오더 우선이 없으면 빈 목록', () => {
    const none = judgeInventory(buildInventory(sheet, guessInventoryMapping(sheet.headers)).items, {
      ...DEFAULT_CRITERIA,
      topPercent: 0,
    }).items;
    expect(reorderRows(none, DEFAULT_CRITERIA)).toEqual([]);
  });
});

describe('buildReorderWorkbook', () => {
  it('xlsx로 저장했다가 다시 읽어도 내용이 같다', () => {
    const wb = buildReorderWorkbook(XLSX, items, DEFAULT_CRITERIA, {
      sourceFile: 'sample-inventory.csv',
      now: new Date(2026, 9, 12, 15, 30),
    });
    const back = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    expect(back.SheetNames).toEqual(['리오더 우선', '판정 기준']);

    const list = XLSX.utils.sheet_to_json<unknown[]>(back.Sheets['리오더 우선'], { header: 1 });
    expect(list[0]).toEqual(reorderHeaders(DEFAULT_CRITERIA));
    expect(list).toHaveLength(4);
    expect(typeof list[1][6]).toBe('number'); // 현재 재고가 숫자 셀

    const info = XLSX.utils.sheet_to_json<string[]>(back.Sheets['판정 기준'], { header: 1 });
    expect(info).toContainEqual(['내려받은 시각', '2026-10-12 15:30']);
    expect(info).toContainEqual(['리오더 우선 옵션 수', 3]);
  });
});

describe('reorderFileName', () => {
  it('날짜를 붙인다', () => {
    expect(reorderFileName(new Date(2026, 0, 5))).toBe('리오더우선_20260105.xlsx');
  });
});
