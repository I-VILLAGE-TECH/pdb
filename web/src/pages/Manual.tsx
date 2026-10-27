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
          <li>
            パスワードは、サイドメニュー下の「パスワード変更」から自分で変更できます。変更すると、ほかの端末・ブラウザのログインは解除されます。
          </li>
          <li>パスワードを忘れたときは、管理者に「ユーザー管理」から再設定してもらってください。</li>
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
              <th>このシステムでの操作(CSV出力は「出力先」→「ファイル種別」)</th>
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
            <tr><td>FS_Spec(PL)・Original＆Spec(CF)</td><td>CSV出力の下の「HTML出力」(タブでペンダントライト/シーリングファンを選ぶ)</td></tr>
            <tr><td>FS_CopyIMG_FmodelName(PL・CF)</td><td><Link to="/images">画像</Link> →「futureshop 商品画像(PL / CF)」</td></tr>
            <tr><td>FS_ListIMG_syukusen_FmodelName(CF)</td><td>画像 →「商品一覧用 縮小画像(CF)」</td></tr>
            <tr><td>Yahoo画像リネーム(PL)・ChangeImageFileName_yahoo(CF)</td><td>画像 →「Yahoo 商品画像(PL / CF)」</td></tr>
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
        <h4>HTML出力(スペックページ等)</h4>
        <p>
          CSV出力ページの下の「HTML出力」で、現行の FS_Spec(ペンダントライト)・Original＆Spec(シーリングファン)と同じ HTML を ZIP でダウンロードします。
          ペンダントライトのタブでは <code>spec/</code>(ペンダントライト一覧)と <code>spec_other/</code>(その他別管理一覧FS)、
          シーリングファンのタブでは <code>original/</code>(製品画像)と <code>spec/</code> に分かれています。絞り込み(検索・状態・メーカー・★マーク)は CSV と共通です。
          データ不備で作れなかった商品は、ZIP 内の <code>errors.txt</code> に一覧があります。
        </p>
      </>
    ),
  },
  {
    id: "images",
    title: "6. 画像(アップロード・出力)",
    body: (
      <>
        <p>
          <Link to="/images">画像</Link> 画面では、商品画像の元ファイル(現行の画像フォルダ)をシステムに登録し、
          Excel の画像系ボタンと同じ名前・構成の画像を ZIP で出力します。
        </p>
        <h4>元画像のアップロード(管理者)</h4>
        <ol>
          <li>「ファイルを選択」で、現行の画像フォルダ(例: <code>img\cf_item_img</code>・<code>img\pl_item_img</code>)をフォルダごと選びます。</li>
          <li>システムに無い画像・中身が変わった画像の件数が表示されます。「アップロード」で、その分だけを送ります。</li>
          <li>途中で画面を閉じても、次回は残りだけを送ります。新しい画像を追加したときも、同じフォルダを選び直せば差分だけが送られます。</li>
        </ol>
        <ul>
          <li>画像はファイル名で商品に引き当てます(大文字小文字は区別しません)。Excel取込をやり直しても消えません。</li>
          <li>同じファイル名がメーカーのフォルダと common の両方にあるときは、メーカーのフォルダの方を使います(現行マクロと同じ)。</li>
          <li>画像の幅・高さはアップロード時に計測し、futureshop の商品CSV(画像サイズ)にも使われます。</li>
          <li>画面上部の「未アップロードの画像」で、商品で使っているのにまだ登録されていない画像を確認できます(CSV でダウンロードも可)。</li>
        </ul>
        <h4>画像ファイルの出力</h4>
        <ol>
          <li>「出力する画像」を選びます(futureshop 商品画像 / 商品一覧用 縮小画像 / Yahoo 商品画像。PL・CF 別)。</li>
          <li>Excel で範囲を選ぶ代わりに、商品コードの入力・★マーク・メーカー・更新日で対象を絞ります(空欄なら登録フラグ○の全商品)。</li>
          <li>「対象を確認」で件数と注意(元画像が無いなど)を確認し、「ZIP をダウンロード」します。</li>
        </ol>
        <ul>
          <li>ZIP 内のフォルダ・ファイル名は現行マクロの出力先と同じです(FutureshopIMG / feed / upload_image / list / YahooIMG)。</li>
          <li>元画像が無かったものなどは、ZIP 内の <code>_result.txt</code> に一覧があります。</li>
          <li>商品一覧用の縮小画像(200×200)は、現行の「縮専」の代わりにシステムで縮小します。</li>
          <li>全商品を出力すると数分かかります。新商品だけなど、絞って出力するのがおすすめです。</li>
        </ul>
      </>
    ),
  },
  {
    id: "imports",
    title: "7. Excel取込",
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
          <li>汎用マスタ(仕入先・本体カラーなど)は取込では変更されません。</li>
        </ul>
        <h4>取込後のマスタ確認</h4>
        <p>取込が完了すると、結果の下に「マスタ確認」が表示されます(取込履歴の「マスタ確認」欄の「未確認」からも開けます)。</p>
        <ul>
          <li>
            <b>マスタに無い値</b>: 取り込んだ商品にあって、汎用マスタ(商品登録・編集の選択肢)に無い値です。
            追加するものにチェックを入れて「マスタに追加」を押します。追加しなくても、取り込んだ商品の値はそのまま使えます。
          </li>
          <li>
            <b>新しく作ったメーカー</b>: 新しいメーカーコードは、商品の紐付けに必要なため取込時にメーカーマスタへ追加されます。
            名前や CF 用の表記を「マスタ管理」で確認してください。
          </li>
          <li>確認が終わったら「確認済みにする」を押します。残った値はマスタに追加しないものとして記録されます。</li>
        </ul>
        <p>商品画像の元ファイルは「画像」画面でアップロードします(「6. 画像」参照)。</p>
      </>
    ),
  },
  {
    id: "masters",
    title: "8. マスタ管理",
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
    title: "9. ユーザー管理",
    adminOnly: true,
    body: (
      <ul>
        <li>「ユーザー追加」でメールアドレス・氏名・パスワード・権限(管理者/編集者)を登録します。</li>
        <li>「PW再設定」で利用者のパスワードを再設定します。新しいパスワードは本人に安全な方法で伝え、ログイン後に「パスワード変更」で本人が変えるよう案内してください。</li>
        <li>退職などで使わなくなった利用者は「無効」にします(自分自身は無効にできません)。</li>
      </ul>
    ),
  },
  {
    id: "faq",
    title: "10. よくある質問・困ったとき",
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
    title: "11. 現時点の制限・確認中の事項",
    body: (
      <ul>
        <li>
          <b>futureshop の新規登録:</b> 商品CSVなどの「コントロールカラム」は現在すべて <code>u</code>(更新)で出力しています。
          futureshop に未登録の新商品を登録する場合は、ダウンロードしたCSVの該当行を <code>n</code> に変更してください(判定方法を確認中)。
        </li>
        <li>
          <b>楽天・Yahoo(ペンダントライト)・ネクストエンジン:</b> 現在の運用はスプレッドシートで出力しています。
          このシステムの出力は Excel マクロの処理をもとにしたもので、スプレッドシートの出力とはまだ照合していません。
          当面はこれまでどおりスプレッドシートで出力してください。
        </li>
        <li><b>Amazon:</b> 現在の運用では Excel・スプレッドシートのどちらからも出力していません。使い方を確認中です。</li>
        <li><b>在庫:</b> 各モールの在庫数は現行マクロと同じ固定値(99 など)で出力しています。</li>
        <li>
          <b>画像の出力:</b> 元画像をアップロードしたものだけが出力されます。最初に現行の画像フォルダをまとめてアップロードしてください。
        </li>
        <li>注文商品(xlsx)など、ほかの CSV 以外の出力はまだありません。</li>
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
