// 時間のかかる処理の「動いている」表示(スピナー・動く進捗バー・経過時間)
// 件数や%が変わらない間(ジョブの起動待ち・ブック解析・CSV生成など)も止まって見えないようにする
import { useCallback, useEffect, useState } from "react";

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

// 経過秒数。startedAt(ISO文字列 or epoch ms)からの秒数を1秒ごとに更新する。null のあいだは止まる
export function useElapsedSeconds(startedAt: string | number | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt == null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (startedAt == null) return 0;
  const start = typeof startedAt === "number" ? startedAt : new Date(startedAt).getTime();
  return Math.max(0, Math.floor((now - start) / 1000));
}

export function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${String(s).padStart(2, "0")}秒` : `${s}秒`;
}

// 進捗バー。percent が null なら不確定(左右に流れるバー)、数値なら%表示に縞模様のアニメーションを重ねる
export function ProgressBar({ percent, style }: { percent: number | null; style?: React.CSSProperties }) {
  if (percent == null) {
    return (
      <div className="progress-bar indeterminate" style={style} role="progressbar" aria-busy="true">
        <div className="progress-fill" />
      </div>
    );
  }
  return (
    <div className="progress-bar" style={style} role="progressbar" aria-valuenow={percent} aria-busy="true">
      <div className="progress-fill active" style={{ width: `${Math.max(percent, 2)}%` }} />
    </div>
  );
}

// スピナー + メッセージ + 経過時間
export function LoadingStatus({
  message,
  startedAt,
  note,
}: {
  message: string;
  startedAt?: string | number | null;
  note?: string;
}) {
  const elapsed = useElapsedSeconds(startedAt ?? null);
  return (
    <div className="loading-status">
      <Spinner />
      <span>{message}</span>
      {startedAt != null && <span className="muted">（経過 {formatElapsed(elapsed)}）</span>}
      {note && <div className="muted loading-note">{note}</div>}
    </div>
  );
}

// 一覧などのデータ取得中を追跡する。track(promise) で包むと、完了するまで loading=true。
// 複数の取得が重なっても、すべて終わるまで loading のまま。since は読み込みを始めた時刻(経過時間表示用)
export function useLoading() {
  const [count, setCount] = useState(0);
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => {
    if (count === 0) setSince(null);
  }, [count]);
  const track = useCallback(<T,>(p: Promise<T>): Promise<T> => {
    setCount((c) => c + 1);
    setSince((s) => s ?? Date.now());
    return p.finally(() => setCount((c) => c - 1));
  }, []);
  return { loading: count > 0, since, track };
}

// 一覧の読み込み中表示。初回(データなし)は「読み込み中」を表示し、再取得(絞り込み・ページ送り)のときは
// 表示中の一覧を薄くして上に流れるバーを出す(古い結果のまま止まって見えないようにする)
export function LoadingArea({
  loading,
  since,
  hasData,
  message = "読み込み中",
  children,
}: {
  loading: boolean;
  since?: number | null;
  hasData: boolean;
  message?: string;
  children: React.ReactNode;
}) {
  // 一瞬で終わる取得でちらつかないよう、0.3秒以上かかったときだけ表示する
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [loading]);
  const show = loading && visible;
  return (
    <div className={`loading-area${show && hasData ? " is-loading" : ""}`} aria-busy={loading}>
      {show && (
        <div className="loading-area-status">
          <ProgressBar percent={null} style={{ height: 4 }} />
          <LoadingStatus message={hasData ? "最新の内容を読み込んでいます" : message} startedAt={since ?? null} />
        </div>
      )}
      <div className="loading-area-body">{children}</div>
    </div>
  );
}
