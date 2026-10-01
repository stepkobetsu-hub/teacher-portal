/** 完成版の重複を上から整理する。元の打刻・フォーム回答は変更しない。 */
function deduplicateCompletedRows_(rows) {
  const exactSeen = new Set();
  const daySeen = new Set();
  const kept = [];
  const originalIndexes = [];
  let removedExact = 0;
  let removedSameDay = 0;
  const cellKey = value => value === null || value === undefined ? '' :
    value instanceof Date ? String(value.getTime()) : String(value).trim();
  rows.forEach((row, index) => {
    const code = cellKey(row[0]);
    const date = cellKey(row[2]);
    if (!code || !date) {
      kept.push(row); originalIndexes.push(index); return;
    }
    const exactKey = JSON.stringify([0, 1, 2, 19, 20, 21, 22].map(i => cellKey(row[i])));
    if (exactSeen.has(exactKey)) { removedExact++; return; }
    exactSeen.add(exactKey);
    const dayKey = JSON.stringify([code, date, cellKey(row[22])]);
    if (daySeen.has(dayKey)) { removedSameDay++; return; }
    daySeen.add(dayKey);
    kept.push(row);
    originalIndexes.push(index);
  });
  return { rows: kept, originalIndexes, removedExact, removedSameDay };
}
