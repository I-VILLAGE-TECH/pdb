// オンラインマニュアル(利用者向けの操作説明)
// 画面の追加・変更をしたら、この内容も合わせて更新する
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

type Section = { id: string; title: string; adminOnly?: boolean; body: React.ReactNode };

const AdminBadge = () => <span className="badge" style={{ marginLeft: 6 }}>管理者のみ</span>;

const SECTIONS: Section[] = [
  {
    id: "intro",
    title: "1. はじめに",
    body: (
      <>
        <p>
          商品管理システムは、ペンダントライト(PL)とシーリングファン(CF)の商品データを1か所で管理し、
          futureshop・Yahoo!ショッピング・楽天・Amazon 向けのCSVを作るためのシステムです。
          これまで Excel のマクロ(ボタン)で作っていたCSVを、このシステムから出力します。
        </p>
        <div className="notice">
          <b>現在の運用:</b> 商品データの入力・修正は、これまでどおり <b>Excel(ペンダントライト一覧・シーリングファン一覧)が正</b>です。
          Excel を更新したら「Excel取込」でシステムに取り込み、「CSV出力」で各モール向けのCSVを作ります。
          システムの画面で商品を直しても、次の Excel取込で Excel の内容に戻ります。
        </div>
        <h4>ログインと権限</h4>
        <ul>
          <li>メールアドレスとパスワードでログインします。7日間ログインしたままになります。</li>
          <li>
            権限は2種類です。<b>管理者</b>はすべての操作ができます。<b>編集者</b>は Excel取込・ユーザー管理以外の操作ができます。
          </li>
          <li>パスワードを忘れた・変えたいときは、管理者に「ユーザー管理」から再設定してもらってください。</li>
        </ul>
      </>
    ),
  },
  {
    id: "flow",
    title: "2. 基本の流れ(Excel マクロからの置き換え)",
    body: (
      <>
        <ol>
          <li>Excel(ペンダントライト一覧 .xlsm / シーリングファン一覧 .xlsb)を更新して保存する</li>
          <li>
            <Link to="/imports">Excel取込</Link> でブックをアップロードする(管理者)
          </li>
          <li>
            <Link to="/exports">CSV出力</Link> で出力先とファイル種別を選び、ダウンロードする
          </li>
          <li>ダウンロードしたCSVを、これまでどおり各モールの管理画面からアップロードする</li>
        </ol>
        <h4>Excel のボタンとの対応</h4>
        <table>
          <thead>
            <tr>
              <th>Excel のボタン</th>
              <th>このシステムでの操作(CSV出力の「出力先」→「ファイル種別」)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>FS_ccGoods商品CSV</td><td>futureshop →「商品CSV(FS_ccGoods)」</td></tr>
            <tr><td>FS_categoryグループ</td><td>futureshop →「グループひもづけ」</td></tr>
            <tr><td>FS_goodsVariation NewItem / Update</td><td>futureshop →「バリエーション NewItem / Update」</td></tr>
            <tr><td>FS_goodsOptionPrice(オプション)</td><td>futureshop →「オプション」</td></tr>
            <tr><td>FS_GoodsTag商品タグ(CF)</td><td>futureshop(シーリングファンのタブ)→「商品タグ」</td></tr>
            <tr><td>FS_ccGoodsImage画像ALT(CF)</td><td>futureshop(シーリングファンのタブ)→「商品画像ALT」</td></tr>
            <tr><td>独自コメント16(CF)</td><td>futureshop(シーリングファンのタブ)→「独自コメント16のみ更新」</td></tr>
            <tr><td>CSV_yahoo(CF)</td><td>Yahoo!ショッピング(シーリングファンのタブ)→「CF CSV_yahoo」</td></tr>
            <tr><td>Yahoo 在庫変更/生産終了・販売価格変更(PL)</td><td>Yahoo!ショッピング(ペンダントライトのタブ)→「PL 在庫変更/生産終了」「PL 価格データ」</td></tr>
            <tr><td>CSV_楽天(CF)・楽天(PL)</td><td>楽天 →「CSV_楽天」「楽天(PL)」</td></tr>
            <tr><td>CSV_Amazon(CF)</td><td>Amazon(シーリングファンのタブ)→「CSV_Amazon」</td></tr>
          </tbody>
        </table>
        <p className="muted">
          Excel では選択した行だけが出力されましたが、このシステムでは条件に合う商品(登録フラグ○の商品)がすべて出力されます。
          一部だけ出したいときは、商品一覧で★マークを付けて「★マーク付きのみ出力」にするか、更新日時で絞り込みます。
        </p>
      </>
    ),
  },
  {
    id: "products",
    title: "3. 商品一覧",
    body: (
      <>
        <ul>
          <li>上の「ペンダントライト / シーリングファン」のタブで、表示する商品の種類を切り替えます。</li>
          <li>各列の見出しの下の欄で絞り込みができます(文字の部分一致、選択肢、範囲)。「絞り込み解除」ですべて解除します。</li>
          <li>列の見出しをクリックすると並べ替えます(昇順 → 降順 → 解除)。</li>
          <li>「表示項目」で表示する列を選べます。列の見出しをドラッグすると並び順を変えられます。設定は利用者ごとに保存されます。</li>
          <li>
            行の左端の ☆ をクリックすると★マークが付きます。「★のみ」で★の商品だけを表示し、
            CSV出力でも「★マーク付きのみ出力」に使えます。★は利用者ごと・ブラウザごとに保存されます。
          </li>
          <li>「子SKUも表示」で、バリエーション(電球の種類違い・光色違いなど)を展開して表示します。行の ▸ をクリックするとその商品だけ展開します。</li>
          <li>読み込み中は上にバーが流れ、経過時間が表示されます。</li>
        </ul>
      </>
    ),
  },
  {
    id: "product-detail",
    title: "4. 商品の詳細・編集・登録",
    body: (
      <>
        <ul>
          <li>商品一覧で商品コードをクリックすると詳細画面を開きます。「編集」で項目を変更できます。</li>
          <li>バリエーション(SKU)の追加・在庫数の変更・画像のアップロードも詳細画面で行います。</li>
          <li>「＋ 商品登録」で新しい商品を登録できます。登録すると代表のSKUが自動で作られます。</li>
          <li>「シート編集」では、表計算のように複数商品をまとめて編集し、「保存」で一括保存できます。</li>
        </ul>
        <div className="notice">
          Excel が入力の正のあいだは、画面での変更は次の Excel取込で上書きされます。恒久的な修正は Excel 側で行ってください。
        </div>
      </>
    ),
  },
  {
    id: "exports",
    title: "5. CSV出力",
    body: (
      <>
        <ol>
          <li>上のタブで「ペンダントライト」か「シーリングファン」を選びます(ブックごとに出力するファイルが違うため)。</li>
          <li>「出力先」で連携先を選びます。「汎用(マスタ形式)」は全項目の確認用CSVです。</li>
          <li>「絞り込み」でファイル種別を選びます。ステータス・更新日時・★マーク付きのみ で対象を絞れます。</li>
          <li>「プレビュー」で先頭の数行を確認できます(複数ファイルをまとめる種別はプレビューできません)。</li>
          <li>「CSVダウンロード」でファイルを作成してダウンロードします。作成中は経過時間が表示されます(数秒〜数十秒)。</li>
        </ol>
        <h4>ファイル種別</h4>
        <table>
          <thead>
            <tr><th>出力先</th><th>ペンダントライト</th><th>シーリングファン</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>futureshop</td>
              <td>商品CSV / オプション / バリエーション NewItem・Update / グループひもづけ</td>
              <td>商品CSV / 独自コメント16のみ更新 / グループひもづけ / オプション(取付工事) / 商品タグ / バリエーション NewItem・Update / 商品画像ALT</td>
            </tr>
            <tr>
              <td>Yahoo!ショッピング</td>
              <td>在庫変更/生産終了(在庫+削除) / 在庫 / 削除 / 価格</td>
              <td>CSV_yahoo(商品+在庫+削除) / 商品 / 在庫 / 削除</td>
            </tr>
            <tr>
              <td>楽天</td>
              <td>楽天(削除+生産終了用更新+商品更新) / 各単体</td>
              <td>CSV_楽天(バリエーション在庫+単品) / 各単体</td>
            </tr>
            <tr>
              <td>Amazon</td>
              <td>—</td>
              <td>CSV_Amazon(IV・SD更新用) / IV / SD</td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li>複数ファイルをまとめる種別(Excel のボタン1回分)は ZIP でダウンロードされます。</li>
          <li>行数が多いファイルは、現行マクロと同じ件数で <code>_1, _2…</code> に分割され ZIP になります(futureshop 商品CSVは700行など)。</li>
          <li>文字コードは現行どおり(主に Shift_JIS)です。ファイル名も現行マクロに合わせています。</li>
        </ul>
      </>
    ),
  },
  {
    id: "imports",
    title: "6. Excel取込",
    adminOnly: true,
    body: (
      <>
        <ol>
          <li>ブック(.xlsm / .xlsb / .xlsx)を選びます。種類(ペンダントライト/シーリングファン)はシート名から自動で判定します。</li>
          <li>
            取込モードを選びます。<b>差分更新</b>: ファイルの商品を追加・更新し、ファイルに無い商品はそのまま。
            <b>全入れ替え</b>: 取込後、同じブックの商品のうちファイルに無いものを削除(非表示)にします。
          </li>
          <li>「取込を実行」を押すと、アップロード → 起動待ち → 解析中 → 取込中 → 完了 と進みます。全件で数分かかります。</li>
        </ol>
        <ul>
          <li>取込中は画面を閉じても処理は続きます。結果は「取込履歴」で確認できます。</li>
          <li>取込中に次の取込は実行できません(「取込が実行中です」と表示されます)。</li>
          <li>新しいメーカーコードがあると、メーカーマスタに自動で追加されます。名前などは「マスタ管理」で確認してください。</li>
          <li>汎用マスタ(仕入先・本体カラーなど)は取込では変更されません。</li>
        </ul>
        <h4>画像一括アップロード</h4>
        <p>
          Excel に登録された画像ファイル名と同じ名前の画像をまとめてアップロードすると、該当する商品画像に自動で紐付きます(大文字小文字は無視)。
          1ファイル20MBまで、一度に50ファイルまでです。
        </p>
      </>
    ),
  },
  {
    id: "masters",
    title: "7. マスタ管理",
    body: (
      <>
        <h4>メーカー</h4>
        <ul>
          <li>メーカー名・英字名・画像フォルダなどを管理します。</li>
          <li>
            メーカー名などを変更すると、連携先CSV(futureshop の商品名・ページ名、Yahoo・Amazon の商品名など)の内容が変わります。
            Excel 側の表記と合わせて変更してください。
          </li>
          <li>
            シーリングファン(CF)は、用途ごとに別の表記(カテゴリ用・Description用・ロゴ画像・検索キーワードなど)を使います。
            メーカーの編集画面の「シーリングファン(CF)用の表記」で設定します。空欄の項目はCSVでも空になります。
          </li>
          <li>新しいメーカーを追加したときは、CF用の表記も入力してください。</li>
        </ul>
        <h4>汎用マスタ(仕入先・取付タイプ・本体カラーなど)</h4>
        <p>商品の登録・編集画面の選択肢として使います。連携先CSVの出力には使いません。</p>
      </>
    ),
  },
  {
    id: "users",
    title: "8. ユーザー管理",
    adminOnly: true,
    body: (
      <ul>
        <li>「ユーザー追加」でメールアドレス・氏名・パスワード・権限(管理者/編集者)を登録します。</li>
        <li>「PW再設定」で利用者のパスワードを再設定します。新しいパスワードは本人に安全な方法で伝えてください。</li>
        <li>退職などで使わなくなった利用者は「無効」にします(自分自身は無効にできません)。</li>
      </ul>
    ),
  },
  {
    id: "faq",
    title: "9. よくある質問・困ったとき",
    body: (
      <dl className="manual-faq">
        <dt>CSVに出てほしい商品が出てこない</dt>
        <dd>
          Excel の登録フラグ(A列)が○の商品だけが出力されます。Excel を確認し、更新した場合は Excel取込をやり直してください。
          ★マーク付きのみ出力・更新日時・ステータスの絞り込みが残っていないかも確認してください。
        </dd>
        <dt>Excel取込が「起動待ち」のまま進まない</dt>
        <dd>起動に数十秒かかることがあります。数分たっても進まない場合は管理者(システム担当)に連絡してください。</dd>
        <dt>Excel取込が「エラー: 時間切れ」になった</dt>
        <dd>処理が途中で止まりました。もう一度実行してください。繰り返す場合はシステム担当に連絡してください。</dd>
        <dt>画面がなかなか表示されない</dt>
        <dd>しばらく使われていなかったときは、最初の表示に数秒〜十数秒かかることがあります。読み込み中はバーと経過時間が表示されます。</dd>
        <dt>画面で直した内容が元に戻った</dt>
        <dd>Excel取込で Excel の内容に戻ります。Excel 側を修正してください(「1. はじめに」参照)。</dd>
      </dl>
    ),
  },
  {
    id: "limits",
    title: "10. 現時点の制限・確認中の事項",
    body: (
      <ul>
        <li>
          <b>futureshop の新規登録:</b> 商品CSVなどの「コントロールカラム」は現在すべて <code>u</code>(更新)で出力しています。
          futureshop に未登録の新商品を登録する場合は、ダウンロードしたCSVの該当行を <code>n</code> に変更してください(判定方法を確認中)。
        </li>
        <li><b>楽天:</b> 現行マクロの出力との照合が済んでいません。アップロード前に内容を確認してください。</li>
        <li>
          <b>楽天(ペンダントライト):</b> 全件出力すると販売終了の商品がすべて削除CSVに入ります。★マークで対象を絞って出力してください。
        </li>
        <li><b>Amazon:</b> 現行の運用で除外していた商品(パーツ類など)も出力されます。対象の絞り方を確認中です。</li>
        <li><b>在庫:</b> 各モールの在庫数は現行マクロと同じ固定値(99 など)で出力しています。</li>
        <li>SPEC・Original の HTML、画像のリネームコピーなど、CSV 以外の出力はまだありません。</li>
      </ul>
    ),
  },
];

export function Manual() {
  const location = useLocation();
  // #見出しID でリンクされたときはその節へスクロール
  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  return (
    <div className="manual">
      <h2>操作マニュアル</h2>
      <p className="muted">商品管理システムの使い方です。左の目次から各項目へ移動できます。</p>
      <div className="manual-layout">
        <nav className="manual-toc" aria-label="目次">
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title.replace(/^\d+\.\s*/, "")}</a>
                {s.adminOnly && <span className="muted" style={{ fontSize: 11 }}>(管理者)</span>}
              </li>
            ))}
          </ol>
        </nav>
        <div className="manual-body">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="panel manual-section">
              <h3 style={{ marginTop: 0 }}>
                {s.title}
                {s.adminOnly && <AdminBadge />}
              </h3>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
