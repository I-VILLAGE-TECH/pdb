// 商品マーク（★）の管理
// ローカルストレージにユーザーIDごとのキーで保存する（他ユーザー・他端末には影響しない）

function storageKey(userId: number): string {
  return `product-marks:${userId}`;
}

export function getMarks(userId: number): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function toggleMark(userId: number, productCode: string): Set<string> {
  const marks = getMarks(userId);
  if (marks.has(productCode)) marks.delete(productCode);
  else marks.add(productCode);
  localStorage.setItem(storageKey(userId), JSON.stringify([...marks]));
  return marks;
}

export function clearMarks(userId: number): Set<string> {
  localStorage.removeItem(storageKey(userId));
  return new Set();
}
