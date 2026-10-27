// 自動生成(tools/gas-rakuten/generate-ts.py)。手で編集しない
// 楽天スプレッドシートの GAS「00_Constants.js」のうち、楽天出力で使う定数をそのまま写したもの
// (商品マスタDB・NE 用の定数は対象外)。列位置は楽天シートの列(CF は台帳の「ダクトレール取り付け」列が無い並び)
// GAS は同じキーを重ねて書いている箇所がある(JS では後勝ち)。TS ではエラーになるため型チェックを外す
// @ts-nocheck
export const CONFIG: any = {
  CSV: {
    RAKUTEN_FOLDER_ID: "1KToAGT4y2B1UTBlCYrE7o28PDoGUkCt1",   // 楽天CSV出力先フォルダ
    NE_FOLDER_ID: "1c8CifFp1aIMa9iSJH9Himbr3NxEkZWN7",   // NECSV出力先フォルダ
    BKUP_FOLDER_ID: "1r-rifpxB8SbNATmC825iYF4Df3N5Ayee",   // バックアップCSV出力先フォルダ
    ERROR_FILE_HEADER_COL: {
      NO: "行番号",
      ERROR_MESSAGE: "エラーメッセージ",
    }
  },
  COMMON_SHEET_ITEM: {
    OUTPUT_TARGET_LINE: 1, // 出力対象行
    OUTPUT_BKUPDATA_NON_TARGET_LINE: 3, // 出力対象以外行
    OUTPUT_NON_TARGET_LINE: 4, // 出力対象以外行
    OUTPUT_TARGET_RAKUTEN_CHECKBOX_POS: 3, // 出力対象楽天チェックボックスポジション
    OUTPUT_TARGET_NE_CHECKBOX_POS: 5, // 出力対象NEチェックボックスポジション
    OPERATION_SELECTBOX_POS: 7, // 操作内容セレクトボックスポジション
    OPERATION_VALUE_OUTPUT_NEW_PRODUCT: "新規商品登録CSV出力", // 操作内容セレクトボックス_新規商品登録CSV出力,
    OPERATION_VALUE_OUTPUT_UPDATE_PRICE: "価格更新CSV出力", // 操作内容セレクトボックス_価格更新CSV出力,
    OPERATION_VALUE_OUTPUT_CHANGE_STOCK: "在庫変更CSV出力", // 操作内容セレクトボックス_在庫変更CSV出力,
    OPERATION_VALUE_OUTPUT_EOL: "生産終了CSV出力", // 操作内容セレクトボックス_生産終了CSV出力,
  },
  CF_SHEET: {
    SHEET_NAME: "シーリングファン",   // シート名
    LISTITEM_IS_PRODUCT_REGISTRATION_POS: 0, // 一覧項目_商品登録フラグ（A列）,
    LISTITEM_SUCCESSOR_MODEL_POS: 3, // 一覧項目_後継機種（D列）,
    LISTITEM_AMAZON_DELETE_FLG_POS: 4, // 一覧項目_Amazon削除フラグ（E列）,
    LISTITEM_DIRECT_FIT_PIPE_POS: 10, // 一覧項目_直付パイプ（K列）,
   LISTITEM_SIKIBETU_NO_POS: 9, // 一覧項目_識別番号（J列）,
    LISTITEM_ID_SERIES_POS: 12, // 一覧項目_IDシリーズ（M列）,
    LISTITEM_ID_GENRE_POS: 13, // 一覧項目_IDジャンル（N列）,
    LISTITEM_ID_CD_NO_POS: 14, // 一覧項目_ID通番（O列）,
    LISTITEM_PRODUCT_MANAGE_ID_POS: 15, // 一覧項目_ID商品管理（P列）,
    LISTITEM_ID_CD_NO2_POS: 17, // 一覧項目_ID通番2（R列）,
    LISTITEM_PRODUCT_SUMMARY_POS: 18, // 一覧項目_ID通番2（S列）,
    LISTITEM_COMBI_MODEL_NUMBER_POS: 20, // 一覧項目_組み合わせ型番（U列）,
    LISTITEM_MODEL_NO_INTEGRATED_POS: 21, // 一覧項目_型番_一体型（V列）,
    LISTITEM_MODEL_NO_FAN_POS: 22, // 一覧項目_型番_ファン（W列）,
    LISTITEM_MODEL_NO_LIGHT_POS: 23, // 一覧項目_型番_ライト（X列）,
    LISTITEM_MODEL_NO_EXTPIPE_POS: 24, // 一覧項目_型番_延長パイプ（Y列）,
    LISTITEM_MODEL_NO_FLANGE_POS: 25, // 一覧項目_型番_フランジ_フレンジ（Z列）,
    LISTITEM_MODEL_NO_OPTIONAL_RC_POS: 26, // 一覧項目_型番_オプションリモコン（AA列）,
    LISTITEM_MODEL_NO_OPTIONAL_FEATHER_POS: 27, // 一覧項目_型番_オプション羽根（AB列）,
    LISTITEM_OPTIONAL_POS: 28, // 一覧項目_型番_オプション（AC列）,
    LISTITEM_MODEL_VARIATION1_POS: 29, // 一覧項目_型番_バリエーション1（AD列）,
    LISTITEM_MODEL_VARIATION2_POS: 30, // 一覧項目_型番_バリエーション2（AE列）,
    LISTITEM_MODEL_VARIATION3_POS: 31, // 一覧項目_型番_バリエーション3（AF列）,
    LISTITEM_JAN: 37, // 一覧項目_JANコード（AL列）
    LISTITEM_PURCHASE_SUPPLIER_POS: 42, // 一覧項目_仕入れ先（AQ列）,
    LISTITEM_PURCHASE_PRICE_INC_TAX_POS: 44, // 一覧項目_仕入れ値（税込）（AS列）,
    LISTITEM_SALE_PRICE1_INC_TAX_POS: 46, // 一覧項目_販売価格1(税込)（AU列）,
    LISTITEM_ELEC_CONSUMPTION_POS: 54, // 一覧項目_電気使用量_W（BC列）,    
    LISTITEM_FAN_NUM: 56, // 一覧項目_ファン枚数（BE列）,  
    LISTITEM_AIR_VOLUME_LEVEL_POS: 60, // 一覧項目_風量レベル（BI列）, 
    LISTITEM_EXTENSION_PIPE_POS: 61, // 一覧項目_延長パイプ（BJ列）, 
    LISTITEM_PIPE_VARI_POS: 62, // 一覧項目_パイプvari（BK列）, 
    LISTITEM_LIGHT_COUNT_POS: 63, // 一覧項目_照明の数（BL列）,
    LISTITEM_LIGHT_COLOR_POS: 65, // 一覧項目_光色（BN列）,
    LISTITEM_BODY_COLOR_POS: 67, // 一覧項目_本体カラー（BP列）, 
    LISTITEM_FEATHER_COLOR1_POS: 68, // 一覧項目_羽の色①（BQ列）,
    LISTITEM_FEATHER_COLOR2_POS: 69, // 一覧項目_羽の色②（BR列）, 
    LISTITEM_RHYTHM_OTATION_POS: 70, // 一覧項目_リズム回転（BS列）,  
    LISTITEM_BATTERIES_POS: 73, // 一覧項目_電池の有無（BV列）,     
    LISTITEM_INC_BATTERIES_NUM_POS: 74, // 一覧項目_付属電池の数（BW列）,       
    LISTITEM_BRIGHTNESS_N_W_POS: 75, // 一覧項目_明るさnW相当（BX列）,      
    LISTITEM_ILLUMINANCE_LUMEN_POS: 76, // 一覧項目_照度ルーメン（BY列）,      
    LISTITEM_ILLUMINANCE_FROM_POS: 77, // 一覧項目_照度ｎ畳から（BZ列）,       
    LISTITEM_WARRANTY_PERIOD_POS: 80, // 一覧項目_保証期間（CC列）,           
    LISTITEM_90DAY_CASHBACK_POS: 81, // 一覧項目_90日返金（CD列）,           
    LISTITEM_ROSETTE_EASY_INSTALL_POS: 105, // 一覧項目_ローゼット簡易取付（DB列）,            
    LISTITEM_PARTIAL_ELECTRICAL_WORK_POS: 106, // 一覧項目_一部電気工事（DC列）,            
    LISTITEM_ROSETTE_EASY_INSTALL_YOUWA_POS: 107, // 一覧項目_ローゼット簡易取付（DD列）,            
    LISTITEM_EXTENSION_PIPE_WORK_POS: 108, // 一覧項目_延長パイプ工事（DE列）,            
    LISTITEM_OTHER_WORK_POS: 109, // 一覧項目_その他工事（DF列）,            
    //玉置追加1
    LISTITEM_REGISTRATION_PRIORITY_POS: 1, // 一覧項目_商品登録優先度（B列）
    LISTITEM_ARRIVAL_SCHEDULE_POS: 2, // 一覧項目_入荷予定 (生産ステータス)（C列）
    LISTITEM_MANUFACTURER_ID_POS: 11, // 一覧項目_IDメーカー（L列）
    LISTITEM_MANUFACTURER_POS: 16, // 一覧項目_メーカー（Q列）
    LISTITEM_UNIT_PRODUCT_NAME_POS: 19, // 一覧項目_商品名（T列）
    LISTITEM_WIDTH_POS: 32, // 一覧項目_幅（AG列）
    LISTITEM_HEIGHT1_POS: 33, // 一覧項目_高さ1（AH列）
    LISTITEM_HEIGHT2_POS: 34, // 一覧項目_高さ2（AI列）
    LISTITEM_WEIGHT_POS: 36, // 一覧項目_重量（AK列）
    LISTITEM_HEIGHT_HANE: 35, // 一覧項目_羽根上高さ（AJ列）
    LISTITEM_PRICE_CONTROL_POS: 38, // 一覧項目_価格統制（AM列）
    LISTITEM_LIST_PRICE_INC_TAX_POS: 40, // 一覧項目_定価税込 10%（AO列）
    LISTITEM_SALE_PRICE1_EX_TAX_POS: 47, // 一覧項目_販売価格2Amazon (税込)
    LISTITEM_ACDC_POS: 55, // 一覧項目_ファン_ACDC（BD列）
    LISTITEM_AIR_VOLUME_POS: 58, // 一覧項目_風量（BG列）
    LISTITEM_AIR_VELOCITY_POS: 57, // 一覧項目_風速（BF列）
    LISTITEM_AIR_ROTATION_SPEED_POS: 59, // 一覧項目_回転数（BH列）
    LISTITEM_LIGHT_NUM_POS: 63, // 一覧項目_照明の数（BL列）
    LISTITEM_LIGHT_TYPE_POS: 64, // 一覧項目_照明の種類（BM列）
    LISTITEM_COLOR_TYPE_POS: 66, // 一覧項目_カラー種別（BO列）
    LISTITEM_COLOR_HONTAI_POS: 67, // 一覧項目_本体カラー（BP列）
    LISTITEM_DIMMER_POS: 71, // 一覧項目_調光_有無NG（BT列）
    LISTITEM_REMOTE_CTRL_POS: 72, // 一覧項目_リモコン有無（BU列）
    LISTITEM_ILLUMINANCE_TO_POS: 78, // 一覧項目_照度ｎ畳まで（CA列）
    LISTITEM_SLOPE_ATTACHABLE_POS: 79, // 一覧項目_斜め取り付け可否（CB列）
    LISTITEM_VARIATION1_ITEM_NAME_POS: 93, // 一覧項目_バリエーション１項目名（CP列）,
    LISTITEM_VARIATION1_OPTION1_POS: 94, // 一覧項目_バリエーション１選択肢(1)（CQ列）,
    LISTITEM_VARIATION1_OPTION2_POS: 95, // 一覧項目_バリエーション１選択肢(2)（CR列）,
    LISTITEM_VARIATION1_OPTION3_POS: 96, // 一覧項目_バリエーション１選択肢(3)（CS列）,
    //玉置追加1（ここまで）
    LISTITEM_GOOD_DESIGN: 83, // 一覧項目_Good Design賞（CF列)
    LISTITEM_MADE_COUNTRY: 82, // 一覧項目_生産国 (CE列)
    LISTITEM_WARRANTY_TERM: 80, // 一覧項目_保証期間(CC列)
    LISTITEM_BRIGHTNESS_W: 75, //一覧項目_明るさＷ相当(BX列)
    LISTITEM_BRIGHTNESS_LUMEN: 76, //一覧項目_明るさルーメン相当(BY列)
    LISTITEM_RITHM_ROTATE: 70, //一覧項目_リズム回転(BS列)
    LISTITEM_COLOR_BLADE1: 68, // 一覧項目_羽根の色１（BQ列)
    LISTITEM_COLOR_BLADE2: 69, // 一覧項目_羽根の色２（BR列)
    LISTITEM_TORITUKE1: 105, // 一覧項目_取り付け１（DB列)
    LISTITEM_TORITUKE2: 106, // 一覧項目_取り付け2（DC列)
    LISTITEM_TORITUKE3: 107, // 一覧項目_取り付け3（DE列)
    LISTITEM_TORITUKE4: 108, // 一覧項目_取り付け4（DF列)
    LISTITEM_TORITUKE5: 109,  // 一覧項目_取り付け5（DG列)
    LISTITEM_PIPE_POS: 10, //直付けパイプ(K列)
    LISTITEM_SETTIJIREI_PIC_POS: 142, //一覧項目_設置事例リンク(EM列)
    LISTITEM_SIZEPIC_POS: 128, //一覧項目_サイズ画像(DY列)
    LISTITEM_PIPE_LENGTH: 61, // 一覧項目_延長パイプ長さ
    LISTITEM_IMG_MAIN1: 111, // 一覧項目_メイン画像１（DH列)
    LISTITEM_IMG_MAIN2: 112, // 一覧項目_メイン画像２（DI列)
    LISTITEM_IMG_FEATURE1: 113, // 一覧項目_商品特徴照会（DJ列)
    LISTITEM_IMG_FS_FEATURE: 114, // 一覧項目_FS商品特徴照会（DK列)
    LISTITEM_IMG_I1: 118, // 一覧項目_全体イメージ画像1（DO列)
    LISTITEM_IMG_I2: 119, // 一覧項目_全体イメージ画像2（DP列)
    LISTITEM_IMG_I3: 120, // 一覧項目_全体イメージ画像3（DQ列)
    LISTITEM_IMG_I4: 121, // 一覧項目_全体イメージ画像4（DR列)
    LISTITEM_IMG_I5: 122, // 一覧項目_全体イメージ画像5（DS列)
    LISTITEM_IMG_I6: 123, // 一覧項目_全体イメージ画像6（DT列)
    LISTITEM_IMG_I7: 124, // 一覧項目_全体イメージ画像7（DU列)
    LISTITEM_IMG_I8: 125, // 一覧項目_全体イメージ画像8（DV列)
    LISTITEM_IMG_I9: 126, // 一覧項目_全体イメージ画像9（DW列)
    LISTITEM_IMG_I10: 127, // 一覧項目_全体イメージ画像10（DX列)
    LISTITEM_IMG_S1: 128, // 一覧項目_サイズ画像1（DY列)
    LISTITEM_IMG_S2: 129, // 一覧項目_サイズ画像2（DZ列)
    LISTITEM_IMG_F1: 130, // 一覧項目_機能イメージ画像1（EA列)
    LISTITEM_IMG_F2: 131, // 一覧項目_機能イメージ画像2（EB列)
    LISTITEM_IMG_F3: 132, // 一覧項目_機能イメージ画像3（EC列)
    LISTITEM_IMG_R1: 133, // 一覧項目_リモコン画像1（ED列)
    LISTITEM_IMG_E1: 134, // 一覧項目_付属画像1（EE列)
    LISTITEM_SUB_INTRODUCTION: 86, // 一覧小目_サブ紹介文1（CH列）
    LISTITEM_ARRIVAL_AWAITING_STOCK_MESSAGE: 6, //一覧項目_入荷待ち文言(G列)

    IMG_CF_MANAGE_SHEET_NAME: "画像管理(CF)" // シーリングファン画像管理用シート名
  },
  PL_SHEET: {
    SHEET_NAME: "ペンダントライト",   // シート名
    LISTITEM_ARRIVAL_SCHEDULE_POS: 3, // 一覧項目_入荷予定 (生産ステータス)（D列）
    LISTITEM_ARRIVAL_AWAITING_STOCK_MESSAGE: 5, //一覧項目_入荷待ち文言(F列)
    LISTITEM_ITEM_TYPE: 6,  //一覧項目_照明の種類(G列)
    LISTITEM_MAKER_ID_POS: 7, // メーカーＩＤ（H列)
    LISTITEM_IV_CD_NO_POS: 9,	//一覧項目_通番(入力不要)(J列)
    LISTITEM_IV_CD_SER_NO_POS: 11,	//一覧項目_シリーズ枝番（リンクつなぐ時に使用）(L列)
    LISTITEM_IV_CD_INSTALLATION_POS: 12,	//一覧項目_取付方法・E：簡易・W：電気工事・D：ﾀﾞｸﾄﾚｰﾙ・B：直付・埋込(M列)
    LISTITEM_IV_CD_COLOR_POS: 13,	//一覧項目_カラー(N列)
    LISTITEM_INSTALLATION_TYPE_POS: 14, //一覧項目_設置タイプ （O列）
    LISTITEM_IV_CD_SUFFIX_POS: 17,	//一覧項目_fazooバリエーション管理No(入力不要)(R列)
    LISTITEM_FAZOO_MANAGE_ID_POS: 18, // 一覧項目_fazoo管理型番(ユニーク)（S列）,
    LISTITEM_PRODUCT_MANAGE_ID_POS: 18, // 一覧項目_fazoo管理型番(ユニーク)（S列）
    LISTITEM_FAZOO_UNIQUE_NO_POS: 18, // 一覧項目_FAZOOユニーク型番(S列)
    LISTITEM_MAKER_JP_NAME_POS: 20, //メーカー名（ｶﾅ）(U列)
    LISTITEM_MANUFACTURER_NAME_EN_POS: 21, // 一覧項目_メーカー名(英字)（V列）
    LISTITEM_DISPLAY_MNP_POS: 23, //一覧項目_製品名（X列)
    LISTITEM_MAIN_MAKER_TYPE_POS: 24, // 一覧項目_本体　メーカー型番（Y列）,
    LISTITEM_MODEL_NO_MANUFACTURER_POS: 24, // 一覧項目_本体　メーカー型番（Y列）
    LISTITEM_MODEL_NO_INTEGRATED_POS: 24, // 重複定義
    LISTITEM_PURCHASE_SUPPLIER_POS: 25, // 一覧項目_仕入れ元（Z列）,
    LISTITEM_PURCHASE_PRICE_EXC_TAX_POS: 26, // 一覧項目_仕入れ値(税抜)（AA列）,
    LISTITEM_PURCHASE_PRICE_EX_TAX_POS: 26, // 一覧項目_仕入れ値(税抜)（AA列）
    LISTITEM_MODEL_NO_FAN_POS: 26,//重複定義
    LISTITEM_LIST_PRICE_INC_TAX_POS: 28, //定価税込10%（AC列）
    LISTITEM_SET_LIGHT_TYPE_POS: 30, // 一覧項目_組み合わせ電球型番（AE列）,
    LISTITEM_MODEL_NO_SET_LIGHT_POS: 30,  // 一覧項目_組み合わせ電球型番（AE列）
    LISTITEM_MODEL_NO_FAN_POS: 30, //　重複定義
    LISTITEM_SUM_SALE_PRICE_INC_SET_POS: 48, // 一覧項目_販売価格合計　(組み合わせ含めた合計金額)（AW列）,
    LISTITEM_TOTAL_SELL_PRICE_POS: 48,  // 一覧項目_販売価格合計　(組み合わせ含めた合計金額)（AW列）
    LISTITEM_MODEL_NO_LIGHT_POS: 48, //　重複定義
    LISTITEM_IS_LARGE_SIZE_POS: 49,	//AX列　:大サイズカテゴリフラグ
    LISTITEM_WIDTH_POS: 50, //一覧項目_照明幅（AY列）
    LISTITEM_DEPTH_POS: 51, //一覧項目_奥行(AZ列)
    LISTITEM_HEIGHT_POS: 52, //一覧項目_照明高さ(BA列)
    LISTITEM_WEIGHT_POS: 53, // 一覧項目_重さ(BB列)
    LISTITEM_MIN_HEIGHT: 54, // 一覧項目_全高(ケーブル含めた最低値)(BC列)
    LISTITEM_MAX_HEIGHT: 55, // 一覧項目_全高(ケーブル含めた最高値)(BD列)
    LISTITEM_CORD_STORAGE_LENGTH_POS: 56,	//BE列　:コード収納の有無数字：収納ある場合、　　　収納可能な長さを記載空欄：収納なし
    LISTITEM_MAX_SLOPE_ANGLE_POS: 57,	//BF列　:傾斜対応 (ｎ度)
    LISTITEM_IS_HIGH_CEILING_COMPATIBLE_POS: 58,	//BG列　:高所天井向け
    LISTITEM_LAMP_REPLACEMENT_TYPE_POS: 59,	//BH列　:電球交換・同梱電球・一体型・同梱電球無し
    LISTITEM_MAIN_LIGHT_CNT_POS: 60, // 一覧項目_メイン電球数（BI列）,
    LISTITEM_SUB_LAMP_COUNT_POS: 61,	//BJ列　:サブ電球※ナツメ球等
    LISTITEM_BULBBASE_POS: 62, // 一覧項目_口金(BK列)
    LISTITEM_RA_POS: 63,	//BL列　:Ra値
    LISTITEM_WATTAGE_EQUIVALENT_LAMP_POS: 64,	//BM列　:電球１球あたりW相当・25W・40W・60W・100W
    LISTITEM_WATTAGE_EQUIVALENT_TOTAL_POS: 65,	//BN列　:テーブルサイズ別用W相当・25W・40W・60W・100W
    LISTITEM_BRIGHTNESS_TO_JOO_POS: 66,	//BO列　:畳数BB列とセットで登録～4.5畳～6畳～8畳～10畳～12畳～14畳～16畳～18畳
    LISTITEM_IS_MAIN_LIGHTING_POS: 67,	//BP列　:部屋全体照明
    LISTITEM_HAS_PULL_SWITCH_POS: 68,	//BQ列　:○：プルスイッチ式
    LISTITEM_HAS_REMOTE_POS: 69,	//BR列　:○：リモコン付属
    LISTITEM_INITIAL_LAMP_TYPE_POS: 70,	//BS列　:初期電球種類LED電球LED一体型電球型蛍光灯ミニクリプトン球白熱灯etc…
    LISTITEM_LUMEN_POS: 71,	//BT列　:明るさ(lm)※調光対応時は　調光範囲を記載
    LISTITEM_COLOR_TEMPERATURE1_POS: 72,	//BU列　:色温度1ケルビン
    LISTITEM_COLOR_TEMPERATURE2_POS: 73,	//BV列　:色温度2ケルビン
    LISTITEM_LIGHT_TYPE_POS: 74, //一覧項目_電球(LED,白熱球)(BW列)
    LISTITEM_DIMMING_TYPE: 75, // 一覧項目_電球(BX列)（調光・非調光・・）
    LISTITEM_LIGHT_COLOR_POS: 76, // 一覧項目_電球色(BY列)
    LISTITEM_DIMMING_METHOD: 77, //一覧項目_調光方法(BZ列)
    LISTITEM_HAS_STEP_SWITCHING_POS: 78,	//CA列　:○：段階切替（1灯-3灯-全灯など）
    LISTITEM_INSTALLATION_TYPE_IMGNAME_POS: 79,	//CB列　:取付タイプ・ローゼット不可,簡易（木ネジ）・簡易（ネジ取り替え）・簡易（埋込ローゼットのみ）
    LISTITEM_OFFICIAL_COLOR_POS: 80,	//CC列　:基本情報メーカーカラー※メーカーのカラーを記載
    LISTITEM_MATERIAL_POS: 81,	//CD列　:基本情報素材
    LISTITEM_ASSOCIATION_NAME_POS: 82, //一覧項目_代表的なイメージ名（CE列）
    LISTITEM_CATEGORY_STYLE1_POS: 83,	//CF列　:カテゴリ（スタイル）1
    LISTITEM_CATEGORY_STYLE2_POS: 84,	//CG列　:カテゴリ（スタイル）2
    LISTITEM_CATEGORY_COLOR_POS: 85, //一覧項目_カテゴリ（カラー）（CH列）
    LISTITEM_CATEGORY_MATERIAL_1_POS: 87,	//CJ列　:カテゴリ（素材）1
    LISTITEM_CATEGORY_MATERIAL_2_POS: 88,	//CK列　:カテゴリ（素材）2
    LISTITEM_CATEGORY_SHAPE_POS: 89,	//CL列　:カテゴリ（形）
    LISTITEM_RELEASE_DATE_POS: 90,	//CM列　:発売日
    LISTITEM_JAN_POS: 91,	//CN列　:JANコード※8、12、13桁の半角数字
    LISTITEM_PRODUCT_COMMENT_POS: 92, // 一覧項目_商品コメント(CO列)
    LISTITEM_FUNCTION_DETAIL1_POS: 94, //一覧項目_機能詳細(CQ列)
    LISTITEM_FUNCTION_DETAIL2_POS: 95, //一覧項目_機能詳細(CR列)
    LISTITEM_FUNCTION_DETAIL3_POS: 96, //一覧項目_機能詳細(CS列)
    LISTITEM_FUNCTION_DETAIL4_POS: 97, //一覧項目_機能詳細(CT列)
    LISTITEM_IMG_MAIN1: 99,//一覧項目_メイン画像 M01メーカー名(英字)_型番_M01.jpg(CV 列)
    LISTITEM_IMG_I1: 101,//一覧項目_イメージ画像 I01メーカー名(英字)_型番_I01.jpg(CX 列)
    LISTITEM_IMG_I2: 102,//一覧項目_イメージ画像 I02(CY 列)
    LISTITEM_IMG_I3: 103,//一覧項目_イメージ画像 I03(CZ 列)
    LISTITEM_IMG_I4: 104,//一覧項目_イメージ画像 I04(DA 列)
    LISTITEM_IMG_I5: 105,//一覧項目_イメージ画像 I05(DB 列)
    LISTITEM_IMG_I6: 106,//一覧項目_イメージ画像 I06(DC 列)
    LISTITEM_IMG_I7: 107,//一覧項目_イメージ画像 I07(DD 列)
    LISTITEM_IMG_I8: 108,//一覧項目_イメージ画像 I08(DE 列)
    LISTITEM_IMG_I9: 109,//一覧項目_イメージ画像 I09(DF 列)
    LISTITEM_IMG_I10: 110,//一覧項目_イメージ画像 I10(DG 列)
    LISTITEM_IMG_I11: 111,//一覧項目_イメージ画像 I11(DH 列)
    LISTITEM_IMG_I12: 112,//一覧項目_イメージ画像 I12(DI 列)
    LISTITEM_IMG_I13: 113,//一覧項目_イメージ画像 I13(DJ 列)
    LISTITEM_IMG_I14: 114,//一覧項目_イメージ画像 I14(DK 列)
    LISTITEM_IMG_I15: 115,//一覧項目_イメージ画像 I15(DL 列)
    LISTITEM_IMG_S1: 116,//一覧項目_サイズ画像 S01メーカー名(英字)_型番_S01.jpg(DM 列)
    LISTITEM_IMG_S2: 117,//一覧項目_サイズ画像 S02メーカー名(英字)_型番_S02.jpg(DN 列)
    LISTITEM_IMG_F1: 119,//一覧項目_機能説明画像 F01メーカー名(英字)_型番_F01.jpg(DP 列)
    LISTITEM_IMG_F2: 120,//一覧項目_機能説明画像 F02(DQ 列)
    LISTITEM_IMG_F3: 121,//一覧項目_機能説明画像 F03(DR 列)
    LISTITEM_IMG_F4: 122,//一覧項目_機能説明画像 F04(DS 列)
    LISTITEM_IMG_F5: 123,//一覧項目_機能説明画像 F05(DT 列)
    LISTITEM_IMG_F6: 124, //一覧項目_機能説明画像 F06(DU 列)
    IMG_PL_MANAGE_SHEET_NAME: "画像管理(PL)" // ペンダントライト画像管理用シート名
  },
  //玉置追加2
  OUTPUT_PL_CSV_RAKUTEN_ITEM: {
    //商品レベル
    PRODUCT_MANAGE_NO: "商品管理番号（商品URL）",
    PRODUCT_NO: "商品番号",
    PRODUCT_NAME: "商品名",
    WAREHOUSE_CODE: "倉庫指定",
    SEARCH_DISP: "サーチ表示",
    TAX_FLG: "消費税",
    ORDER_BTN: "注文ボタン",
    INQUIRY_BTN: "商品問い合わせボタン",
    STOCK_DISP: "在庫表示",
    CASH_ON_DELIVERY_FEE: "代引料",
    GENRE_ID: "ジャンルID",
    CATCH_COPY: "キャッチコピー",
    PC_ITEM_DESC: "PC用商品説明文",
    PC_SALES_DESC: "PC用販売説明文",
    SMARTPHONE_ITEM_DESC:"スマートフォン用商品説明文",
    //画像数分の繰り返し
    ITEM_INFO_LAYOUT: "商品情報レイアウト",
    HDR_FTR_LNV: "ヘッダー・フッター・レフトナビ",
    DISP_ORDER: "表示項目の並び順",
    COMMON_DESC_S: "共通説明文（小）",
    FEATURED_PRODUCT: "目玉商品",
    COMMON_DESC_L: "共通説明文（大）",
    REVIEW_DISP: "レビュー本文表示",
    MAKER_INFO_DISP: "メーカー提供情報表示",
    SUBS_SETTING: "定期購入設定", //追加
    GROUP_SETTING: "頒布会設定", //追加
    VARIATION_ITEM_KEY: "バリエーション項目キー定義",
    VARIATION_ITEM_NAME: "バリエーション項目名定義",
    VARIATION1_OPTIONS: "バリエーション1選択肢定義",
    // オプションレベル
    PRODUCT_OPTION_TYPE: "選択肢タイプ",
    PRODUCT_OPTION_NAME: "商品オプション項目名",
    PRODUCT_OPTION1: "商品オプション選択肢1",
    PRODUCT_OPTION2: "商品オプション選択肢2",
    PRODUCT_OPTION3: "商品オプション選択肢3",
    PRODUCT_OPTION4: "商品オプション選択肢4",
    PRODUCT_OPTION_REQUIRED: "商品オプション選択必須",
    // SKUレベル
    SKU_MANAGE_NO: "SKU管理番号",
    SKU_SYNC_NO: "システム連携用SKU番号",
    VARIATION1_ITEM_KEY: "バリエーション項目キー1",
    VARIATION1_OPTION: "バリエーション項目選択肢1",
    REGULAR_PRICE: "通常購入販売価格",
    DISP_PRICE: "表示価格",
    DOUBLE_PRICE_NO: "二重価格文言管理番号", //追加
    RESTOCK_BUTTON: "再入荷お知らせボタン", //追加
    NOSHI_FLG: "のし対応", //追加
    STOCK_QTY: "在庫数",
    STOCK_REVERT: "在庫戻しフラグ", //追加
    OUT_OF_STOCK_ORDER: "在庫切れ時の注文受付",
    STOCK_IN_DELIVERY_NO: "在庫あり時納期管理番号", //追加
    OUT_OF_STOCK_DELIVERY_MNG_NO: "在庫切れ時納期管理番号",
    STOCK_IN_LEADTIME: "在庫あり時出荷リードタイム", //追加
    SKU_WAREHOUSE: "SKU倉庫指定",
    POSTAGE: "送料", //追加
    SINGLE_UNIT_DELIVERY: "単品配送設定使用",
    LEAVE_AT_DOOR_FLG: "置き配指定",
    NO_CATALOG_ID_REASON: "カタログIDなしの理由",
    ITEM_ATTR1_NAME: "商品属性（項目）1",
    ITEM_ATTR1_VAL: "商品属性（値）1",
    ITEM_ATTR2_NAME: "商品属性（項目）2",
    ITEM_ATTR2_VAL: "商品属性（値）2",
    ITEM_ATTR3_NAME: "商品属性（項目）3",
    ITEM_ATTR3_VAL: "商品属性（値）3",
    ITEM_ATTR4_NAME: "商品属性（項目）4",
    ITEM_ATTR4_VAL: "商品属性（値）4"
    //★★★PLは追加する必要あり?★★★
  },
  RAKUTEN_DICTIONARY: {
    MANUFACTURER_NAME_DIC: {
      "I": "ファズー",
      "A": "アグレッド",
      "N": "NEC",
      "O": "オーデリック",
      "R": "オーブ",
      "K": "コイズミ",
      "W": "ライフオンプロダクツ",
      "D": "ダイコー",
      "Z": "タキズミ",
      "L": "ダルトン",
      "M": "東京メタル工業",
      "T": "東芝",
      "J": "日本電興",
      "P": "パナソニック",
      "H": "ハモサ",
      "PH": "ファイテン",
      "MA": "マントラ",
      "E": "三菱電機",
      "X": "BRID[メルクロス]",
      "Y": "ユーワ",
      "IM": "ミンカエアー"
    },
    ILLUMINANCE_DIC: {
      [3]: "",
      [4]: "",
      [4.5]: "",
      [5.9]: "",
      [6]: "",
      [8]: "明るさ8畳",
      [10]: "明るさ10畳",
      [12]: "明るさ12畳",
      [14]: "明るさ14畳",
      [-1]: ""
    },
    SHRINK_PRODUCT_NAME_LIST: [
      "吹き抜け",
      "軽量",
      "ホワイト", "アイボリー",
      "明るさ8畳", "明るさ10畳", "明るさ12畳", "明るさ14畳",
      "簡易取付",
      //    "Modern Collection",
      "クラシック",
      //    "+LLD4000MLCE1 / ..." , "+LLD3020MLCE1 / ...",
      //    "(拡散)", "(集光)", "4灯灯具", "Ra90", "[美ルック]", "JAVALO ELF ",
      "小型",
      "薄型",
      /\d+灯/g
    ]
  },
  //玉置追加3ここまで
  RAKUTEN_CEILING_FAN_FIXED_VAL: {
    WAREHOUSE_CODE_FIXED_VAL: 0,
    SEARCH_DISP_FIXED_VAL: 1,
    TAX_FLG_FIXED_VAL: 1,
    ORDER_BTN_FIXED_VAL: 1,
    INQUIRY_BTN_FIXED_VAL: 1,
    STOCK_DISP_FIXED_VAL: 0,
    CASH_ON_DELIVERY_FEE_FIXED_VAL: 0,
    GENRE_ID_FIXED_VAL: 300452,
    ITEM_INFO_LAYOUT_FIXED_VAL: 1,
    HDR_FTR_LNV_FIXED_VAL: "自動選択",
    DISP_ORDER_FIXED_VAL: "自動選択",
    COMMON_DESC_S_FIXED_VAL: "自動選択",
    FEATURED_PRODUCT_FIXED_VAL: "自動選択",
    COMMON_DESC_L_FIXED_VAL: "自動選択",
    REVIEW_DISP_FIXED_VAL: 2,
    MAKER_INFO_DISP_FIXED_VAL: 0,
    PRODUCT_OPTION_TYPE_FIXED_VAL: "s",
    PRODUCT_OPTION_NAME_FIXED_VAL: "全国対応可能な専門店の取付工事について",
    PRODUCT_OPTION1_FIXED_VAL: "A：お客様ご自身で取付",
    PRODUCT_OPTION2_FIXED_VAL: "B：ファズーに工事依頼　見積希望",
    PRODUCT_OPTION3_FIXED_VAL: "C：ファズーに工事依頼　相談済み",
    PRODUCT_OPTION4_FIXED_VAL: "D：別の工事店を手配して取付",
    PRODUCT_OPTION_REQUIRED_FIXED_VAL: 0,
    STOCK_QTY_FIXED_VAL: 99,
    OUT_OF_STOCK_ORDER_FIXED_VAL: 1,
    OUT_OF_STOCK_DELIVERY_MNG_NO_FIXED_VAL: 4,
    SKU_WAREHOUSE_FIXED_VAL: 0,
    SINGLE_UNIT_DELIVERY_FIXED_VAL: 0,
    LEAVE_AT_DOOR_FLG_FIXED_VAL: 1,
    NO_CATALOG_ID_REASON_FIXED_VAL: 5,
    ITEM_ATTR1_NAME_FIXED_VAL: "ブランド名",
    ITEM_ATTR2_NAME_FIXED_VAL: "メーカー型番",
    ITEM_ATTR3_NAME_FIXED_VAL: "原産国／製造国",
    ITEM_ATTR3_VAL_FIXED_VAL: "中国",
    ITEM_ATTR4_NAME_FIXED_VAL: "代表カラー",
    ITEM_ATTR4_VAL_FIXED_VAL: "ホワイト"
  },
  MANUFACTURER_NAME_DIC: {
    "I": { "日本名": "ファズー", "画像フォルダ": "ivillage", "alt": "シーリングファンライト通販専門店ファズー fazoo", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib4/ivillage_logo.gif" } },
    "A": { "日本名": "アグレッド", "画像フォルダ": "agled" },
    "N": { "日本名": "NEC", "画像フォルダ": "nec" },
    "O": { "日本名": "オーデリック", "画像フォルダ": "odelic", "alt": "オーデリックのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/odelic_logo.gif" } },
    "R": { "日本名": "オーブ", "画像フォルダ": "orrb", "alt": "オーブのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/orrb_logo.gif" } },
    "K": { "日本名": "コイズミ", "画像フォルダ": "koizumi", "alt": "コイズミのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/koizumi_logo.gif" } },
    "W": { "日本名": "ライフオンプロダクツ", "画像フォルダ": "LifeOnProducts", "alt": "ライフオンプロダクツのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib4/lop_logo.gif" } },
    "D": { "日本名": "ダイコー", "画像フォルダ": "daiko", "alt": "ダイコーのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/daiko_logo.gif" } },
    "Z": { "日本名": "タキズミ", "画像フォルダ": "takizumi", "alt": "タキズミのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib3/takizumi_logo.gif" } },
    "L": { "日本名": "ダルトン", "画像フォルダ": "dulton", "alt": "DULTONのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/dulton_logo.gif" } },
    "M": { "日本名": "東京メタル工業", "画像フォルダ": "tokyometal", "alt": "東京メタルのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib3/tokyometal_logo.gif" } },
    "T": { "日本名": "東芝", "画像フォルダ": "toshiba" },
    "J": { "日本名": "日本電興", "画像フォルダ": "nihondenko", "alt": "日本電興のメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib4/nihondenko_logo.gif" } },
    "P": { "日本名": "パナソニック", "画像フォルダ": "panasonic", "alt": "パナソニックのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/panasonic_logo.gif" } },
    "H": { "日本名": "ハモサ", "画像フォルダ": "hermosa", "alt": "HERMOSAのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib4/hermosa_logo.gif" } },
    "PH": { "日本名": "ファイテン", "画像フォルダ": "phiten", "alt": "ファイテンのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/newceilingfan/imgrc0179043670.gif" } },
    "MA": { "日本名": "マントラ", "画像フォルダ": "mantra", "alt": "マントラのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib/mantra_logo.gif" } },
    "E": { "日本名": "三菱電機", "画像フォルダ": "mitsubishi", "alt": "三菱電機のメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib5/mitsubishi_logo.gif" } },
    "X": { "日本名": "BRID[メルクロス]", "画像フォルダ": "mercros", "alt": "メルクロスのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib3/mercros_logo.gif" } },
    "Y": { "日本名": "ユーワ", "画像フォルダ": "youwa", "alt": "ユーワのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib3/youwa_logo.gif" } },
    "IM": { "日本名": "ミンカエアー", "画像フォルダ": "minka-aire", "alt": "Minka Aireのメーカーロゴ", "楽天": { "画像URL": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/minka-aire_logo.gif" } }
  },
  PL_MAKER: {
    "AP": { "日本名": "アンバサンド", "英名": "AMPERSAND", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/ampersand.jpg" } },
    "AW": { "日本名": "アートワークスタジオ", "英名": "ARTWORKSTUDIO", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/artworkstudio.jpg" } },
    "DA": { "日本名": "ダイコー", "英名": "DAIKO", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/daiko.jpg" } },
    "DC": { "日本名": "ディクラッセ", "英名": "DI CLASSE", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/diclasse.jpg" } },
    "EX": { "日本名": "エルックス", "英名": "ELUX", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/elux.jpg" } },
    "GL": { "日本名": "後藤照明", "英名": "Gotoh Lighting Factory", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/gotoh.jpg" } },
    "HM": { "日本名": "ハモサ", "英名": "HERMOSA", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/hermosa.jpg" } },
    "IF": { "日本名": "インターフォルム", "英名": "INTERFORM", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/interform.jpg" } },
    "KO": { "日本名": "コイズミ", "英名": "KOIZUMI", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/koizumi.jpg" } },
    "MR": { "日本名": "メルクロス", "英名": "MERCROS", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/mercros.jpg" } },
    "MX": { "日本名": "マックスレイ", "英名": "MAXRAY", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/maxray.jpg" } },
    "OB": { "日本名": "オーブ", "英名": "ORRB", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/orrb.jpg" } },
    "OD": { "日本名": "オーデリック", "英名": "ODELIC", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/odelic.jpg" } },
    "PN": { "日本名": "パナソニック", "英名": "Panasonic", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/panasonic.jpg" } },
    "SW": { "日本名": "スワン電器", "英名": "SWAN", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/swan.jpg" } },
    "TM": { "日本名": "東京メタル工業", "英名": "TOKYO METAL", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/tome.jpg" } },
    "TO": { "日本名": "東芝", "英名": "TOSHIBA", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/toshiba.jpg" } },
    "TS": { "日本名": "トヨスター", "英名": "TOYOSTAR", "ロゴ": { "楽天": "" } },
    "GE": { "日本名": "グラムエイト", "英名": "grameight", "ロゴ": { "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/common/maker_logo/grameight.jpg" } }
  },
  TAX_RATE: 1.1
};

export const SHOP: any = {
  RAKUTEN: {
    MALL_NAME: "楽天", // モール名
    IMG_URL: "https://image.rakuten.co.jp/fazoo/cabinet/" //画像指定時のURL
  }
};

export const SHOP_DATA: any = {
  COMMON_PIC: { //複数の画面、サイトで使用する画像
    "fazooオリジナル延長パイプについて": { "alt": "fazooオリジナル延長パイプについて", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib2/item40cm-caution.gif" },
    "設置事例をもっと見る": { "alt": "事例写真をもっと見る", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib/jirei.gif" },
    "サイズ_ライト有り_直付け": { "alt": "サイズ寸法", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib2/fanlightsize-y.gif" },
    "サイズ_ライト無し_直付け": { "alt": "サイズ寸法", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/newceilingfan/fansize-y.gif" },
    "サイズ_ライト有り_短パイプ": { "alt": "サイズ寸法", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib/1/imgrc0179084744.gif" },
    "サイズ_ライト無し_短パイプ": { "alt": "サイズ寸法", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib5/fansize-15cm_over-y.gif" },
    "サイズ_ライト有り_長パイプ": { "alt": "サイズ寸法", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/newceilingfan/imgrc0179070697.gif" },
    "サイズ_ライト無し_長パイプ": { "alt": "サイズ寸法", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib4/fansize-30cm_over-y.gif" },
    "サーキュレーション効果": { "alt": "シーリングファンのサーキュレーション効果", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/circulation.gif" },
    "明るさイメージ": { "alt": "シーリングファンライト照明の明るさ選びについて", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/brightness1.jpg" },
    "簡易取付": { "alt": "簡易取り付けタイプ", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/installation/toritsuke_kani01.jpg" },
    "直付取付": { "alt": "直付取り付けタイプ", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/installation/toritsuke_kouji.jpg" },
    "レール取付": { "alt": "レール取付", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/installation/toritsuke_umekomi01.jpg" },
    "埋込・直付取付": { "alt": "埋込・直付取り付けタイプ", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/pl/installation/toritsuke_umekomi01.jpg" },
    "簡易取り付け_CF": { "alt": "こちらの商品は電気工事が不要な簡易取付タイプです。", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/installation_01.gif" },
    "簡易取付_YOWA_CF": { "alt": "こちらの商品は電気工事が不要な簡易取付タイプです。", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib3/installation_04.gif" },
    "一部電気工事_CF": { "alt": "こちらの商品は一部電気が必要なので、ご注意ください。", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/installation_03.gif" },
    "電気工事必須_CF": { "alt": "こちらの商品は電気工事が必要なので、ご注意ください。", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/etc/installation_02-02.gif" },
    "その他取付_CF": { "alt": "こちらの商品は電気工事が必要なので、ご注意ください。", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/installation_02.gif" },
    "入荷待ち": { "alt": "入荷待ち予約購入・受付中", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/lib1/shopping_reserve1.gif"
    ,"Yahoo":"https://shopping.c.yimg.jp/lib/fan-taro/shopping_reserve1.gif"}
  },
  FEATURE_ICON: { // 機能アイコン
    "3年保証アイコン": { "alt": "無料3年保証", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_iv36.gif" },
    "メーカー1年保証アイコン": { "alt": "メーカー１年保証", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_m12.gif" },
    "メーカー保証3年":{"alt":"メーカー保証3年"},
    "日本製アイコン": { "alt": "日本製", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_madeinjp_01.gif" },
    "組み合わせ商品アイコン": { "alt": "組み合わせ商品", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_combination.gif" },
    "DCモーターアイコン": { "alt": "DCモーター", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_dc.gif" },
    "ACモーターアイコン": { "alt": "ACモーター", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_ac.gif" },
    "LEDアイコン": { "alt": "LED照明", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_led.gif" },
    "照明の数アイコン": { "alt": "灯照明", "ファイル名": "icon_lightXX.gif", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/" }, //URLはフォルダ
    "明るさWアイコン": { "alt": "w相当", "ファイル名": "icon_lightXXw.gif", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/" }, //URLはフォルダ
    "明るさルーメンアイコン": { "alt": "lm", "ファイル名": "icon_lmXX.gif", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/" }, //URLはフォルダ
    "明るさ広さアイコン": { "alt": "明るさXX畳程度", "ファイル名": "icon_lightXXteido.gif", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/" }, //URLはフォルダ
    "調光アイコン": { "alt": "調光", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_choukou_lm.gif" },
    "無段階調光アイコン": { "alt": "無段階調光", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_tyoukou.gif" },
    "光色アイコン": { "alt": "光色切替・調色", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_kousyoku_lm.gif" },
    "電球3色アイコン": { "alt": "電球色、昼白色、昼光色から選択して購入", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_light_l-n-d.gif" },
    "電球2色アイコン_昼光色": { "alt": "電球色、昼光色から選択して購入", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_light_l-d.gif" },
    "電球2色アイコン_昼白色": { "alt": "電球色、昼白色から選択して購入", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_light_l-n.gif" },
    "リモコンアイコン": { "alt": "リモコン付属", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_remocon.gif" },
    "リモコン2chアイコン": { "alt": "リモコン付属チャンネル切替数2ch", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_remocon_2ch.gif" },
    "リモコン3chアイコン": { "alt": "リモコン付属チャンネル切替数3ch", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_remocon_3ch.gif" },
    "リモコンプルスイッチアイコン": { "alt": "プルスイッチタイプ", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_pull_switch.gif" },
    "風速アイコン": { "alt": "風速XXm", "ファイル名": "icon_windspeedXX.gif", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/" }, //URLはフォルダ
    "大風量アイコン": { "alt": "大風量", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_airflow_large1.gif" },
    "風量アイコン": { "alt": " 風量XXm3/min以上", "ファイル名": "icon_airflowXX.gif", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/" },
    "リズム回転アイコン": { "alt": "リズム機能付き", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_rhythm.gif" },
    "リバーシブルアイコン": { "alt": "羽根リバーシブル", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_hane.gif" },
    "傾斜アイコン": { "alt": "傾斜XX度まで対応", "ファイル名": "icon_degreesXX.gif", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/" },
    "傾斜不可アイコン": { "alt": "傾斜天井設置不可", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_degrees00.gif" },
    "軽量アイコン": { "alt": "軽量7kg未満", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_lightweight7.gif" },
    "簡易取付": { "alt": "簡易取付", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_easysetup.gif" },
    "一部電気工事": { "alt": "簡易取付、一部電気工事", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_const2.gif" },
    "電気工事取付": { "alt": "電気工事取付", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_const.gif" },
    "PSEアイコン": { "alt": "PSEマーク", "楽天": "https://image.rakuten.co.jp/fazoo/cabinet/products_detail/icon_pse-mark.gif" }
  }
};

export const CONFIG_RAKUTEN_CMN: any = {
  OUTPUT_CSV_RAKUTEN_ITEM: {
    PRODUCT_MANAGE_NO: "商品管理番号（商品URL）",
    PRODUCT_NO: "商品番号",
    PRODUCT_NAME: "商品名",
    WAREHOUSE_CODE: "倉庫指定",
    SEARCH_DISP: "サーチ表示",
    TAX_FLG: "消費税",
    ORDER_BTN: "注文ボタン",
    INQUIRY_BTN: "商品問い合わせボタン",
    STOCK_DISP: "在庫表示",
    CASH_ON_DELIVERY_FEE: "代引料",
    GENRE_ID: "ジャンルID",
    CATCH_COPY: "キャッチコピー",
    PC_ITEM_DESC: "PC用商品説明文",
    PC_SALES_DESC: "PC用販売説明文",
    SMARTPHONE_ITEM_DESC: "スマートフォン用商品説明文",
    //画像数分の繰り返し
    ITEM_INFO_LAYOUT: "商品情報レイアウト",
    HDR_FTR_LNV: "ヘッダー・フッター・レフトナビ",
    DISP_ORDER: "表示項目の並び順",
    COMMON_DESC_S: "共通説明文（小）",
    FEATURED_PRODUCT: "目玉商品",
    COMMON_DESC_L: "共通説明文（大）",
    REVIEW_DISP: "レビュー本文表示",
    MAKER_INFO_DISP: "メーカー提供情報表示",
    SUBS_SETTING: "定期購入設定", //追加
    GROUP_SETTING: "頒布会設定", //追加
    VARIATION_ITEM_KEY: "バリエーション項目キー定義",
    VARIATION_ITEM_NAME: "バリエーション項目名定義",
    VARIATION1_OPTIONS: "バリエーション1選択肢定義",
    IMG_TYPE1:"商品画像タイプ1",
    IMG_PATH1:"商品画像パス1",
    IMG_ALT1: "商品画像名（ALT）1",
    IMG_TYPE2: "商品画像タイプ2",
    IMG_PATH2: "商品画像パス2",
    IMG_ALT2: "商品画像名（ALT）2",
    IMG_TYPE3: "商品画像タイプ3",
    IMG_PATH3: "商品画像パス3",
    IMG_ALT3: "商品画像名（ALT）3",
    IMG_TYPE4: "商品画像タイプ4",
    IMG_PATH4: "商品画像パス4",
    IMG_ALT4: "商品画像名（ALT）4",
    IMG_TYPE5: "商品画像タイプ5",
    IMG_PATH5: "商品画像パス5",
    IMG_ALT5: "商品画像名（ALT）5",
    IMG_TYPE6: "商品画像タイプ6",
    IMG_PATH6: "商品画像パス6",
    IMG_ALT6: "商品画像名（ALT）6",
    IMG_TYPE7: "商品画像タイプ7",
    IMG_PATH7: "商品画像パス7",
    IMG_ALT7: "商品画像名（ALT）7",
    IMG_TYPE8: "商品画像タイプ8",
    IMG_PATH8: "商品画像パス8",
    IMG_ALT8: "商品画像名（ALT）8",
    IMG_TYPE9: "商品画像タイプ9",
    IMG_PATH9: "商品画像パス9",
    IMG_ALT9: "商品画像名（ALT）9",
    IMG_TYPE10: "商品画像タイプ10",
    IMG_PATH10: "商品画像パス10",
    IMG_ALT10: "商品画像名（ALT）10",
    IMG_TYPE11: "商品画像タイプ11",
    IMG_PATH11: "商品画像パス11",
    IMG_ALT11: "商品画像名（ALT）11",
    IMG_TYPE12: "商品画像タイプ12",
    IMG_PATH12: "商品画像パス12",
    IMG_ALT12: "商品画像名（ALT）12",
    IMG_TYPE13: "商品画像タイプ13",
    IMG_PATH13: "商品画像パス13",
    IMG_ALT13: "商品画像名（ALT）13",
    IMG_TYPE14: "商品画像タイプ14",
    IMG_PATH14: "商品画像パス14",
    IMG_ALT14: "商品画像名（ALT）14",
    IMG_TYPE15: "商品画像タイプ15",
    IMG_PATH15: "商品画像パス15",
    IMG_ALT15: "商品画像名（ALT）15",
    // オプションレベル
    PRODUCT_OPTION_TYPE: "選択肢タイプ",
    PRODUCT_OPTION_NAME: "商品オプション項目名",
    PRODUCT_OPTION1: "商品オプション選択肢1",
    PRODUCT_OPTION2: "商品オプション選択肢2",
    PRODUCT_OPTION3: "商品オプション選択肢3",
    PRODUCT_OPTION4: "商品オプション選択肢4",
    PRODUCT_OPTION_REQUIRED: "商品オプション選択必須",
    // SKUレベル
    SKU_MANAGE_NO: "SKU管理番号",
    SKU_SYNC_NO: "システム連携用SKU番号",
    VARIATION1_ITEM_KEY: "バリエーション項目キー1",
    VARIATION1_OPTION: "バリエーション項目選択肢1",
    REGULAR_PRICE: "通常購入販売価格",
    DISP_PRICE: "表示価格",
    DOUBLE_PRICE_NO: "二重価格文言管理番号", //追加
    RESTOCK_BUTTON: "再入荷お知らせボタン", //追加
    NOSHI_FLG: "のし対応", //追加
    STOCK_QTY: "在庫数",
    STOCK_REVERT: "在庫戻しフラグ", //追加
    OUT_OF_STOCK_ORDER: "在庫切れ時の注文受付",
    STOCK_IN_DELIVERY_NO: "在庫あり時納期管理番号", //追加
    OUT_OF_STOCK_DELIVERY_MNG_NO: "在庫切れ時納期管理番号",
    STOCK_IN_LEADTIME: "在庫あり時出荷リードタイム", //追加
    SKU_WAREHOUSE: "SKU倉庫指定",
    POSTAGE: "送料", //追加
    SINGLE_UNIT_DELIVERY: "単品配送設定使用",
    LEAVE_AT_DOOR_FLG: "置き配指定",
    NO_CATALOG_ID_REASON: "カタログIDなしの理由",
    ITEM_ATTR1_NAME: "商品属性（項目）1",
    ITEM_ATTR1_VAL: "商品属性（値）1",
    ITEM_ATTR2_NAME: "商品属性（項目）2",
    ITEM_ATTR2_VAL: "商品属性（値）2",
    ITEM_ATTR3_NAME: "商品属性（項目）3",
    ITEM_ATTR3_VAL: "商品属性（値）3",
    ITEM_ATTR4_NAME: "商品属性（項目）4",
    ITEM_ATTR4_VAL: "商品属性（値）4"
  }
}

export const CONFIG_RAKUTEN: any = {
  OUTPUT_CSV_RAKUTEN_FILE_NAME: {
    PE_NEW_PRODUCT: `normal-item`,
    CF_NEW_PRODUCT: `normal-item`,
    PE_NEW_PRODUCT: `normal-item`,
    CF_NEW_PRODUCT: `normal-item`,
  },
  HEADER_ITEM: {
    NEW_CF_PROCUCT_HEADER: [
      // 商品レベル↓
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_MANAGE_NO, //商品管理番号(URL)
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_NO, //商品番号
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_NAME, //商品名
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.WAREHOUSE_CODE, // 倉庫指定
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SEARCH_DISP, // サーチ表示
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.TAX_FLG, // 消費税
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ORDER_BTN, // 注文ボタン
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.INQUIRY_BTN, //商品問い合わせボタン
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.STOCK_DISP, // 在庫表示
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.CASH_ON_DELIVERY_FEE, //代引料
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.GENRE_ID, // ジャンルID
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.CATCH_COPY, // キャッチコピー
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PC_ITEM_DESC, // PC用商品説明文
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PC_SALES_DESC, // PC販売用説明文
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SMARTPHONE_ITEM_DESC, //スマートフォン用商品説明文
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_INFO_LAYOUT,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.HDR_FTR_LNV,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.DISP_ORDER,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.COMMON_DESC_S,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.FEATURED_PRODUCT,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.COMMON_DESC_L,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.REVIEW_DISP,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.MAKER_INFO_DISP,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.VARIATION_ITEM_KEY,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.VARIATION_ITEM_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.VARIATION1_OPTIONS,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE1,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH1,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT1,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE2,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH2,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT2,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE3,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH3,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT3,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE4,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH4,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT4,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE5,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH5,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT5,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE6,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH6,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT6,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE7,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH7,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT7,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE8,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH8,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT8,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE9,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH9,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT9,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE10,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH10,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT10,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE11,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH11,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT11,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE12,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH12,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT12,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE13,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH13,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT13,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE14,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH14,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT14,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE15,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH15,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT15,
      // 商品レベル↑
      //SKUレベル
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SKU_MANAGE_NO,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SKU_SYNC_NO,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.VARIATION1_ITEM_KEY,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.VARIATION1_OPTION,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.REGULAR_PRICE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.DISP_PRICE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.STOCK_QTY,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.OUT_OF_STOCK_ORDER,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.OUT_OF_STOCK_DELIVERY_MNG_NO,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SKU_WAREHOUSE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SINGLE_UNIT_DELIVERY,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.LEAVE_AT_DOOR_FLG,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.NO_CATALOG_ID_REASON,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR1_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR1_VAL,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR2_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR2_VAL,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR3_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR3_VAL,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR4_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR4_VAL,
      // ↑SKUレベル↑

      // オプションレベル↓
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION_TYPE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION1,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION2,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION3,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION4,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION_REQUIRED
      // オプションレベル↑
    ],
    CFPL_UPDATE_PRICE_HEADER:[ // 価格更新用ヘッダ(シーリングファン)
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_MANAGE_NO, //商品管理番号(URL)
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_NO, //商品番号
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SKU_MANAGE_NO, //SKU管理番号
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.REGULAR_PRICE, //通常販売価格
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.DISP_PRICE // 定価税込み10%
    ],
    NEW_PL_PRODUCT_HEADER: [ //新規登録用CSVヘッダ(ペンダントライト)
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_MANAGE_NO, //商品管理番号(URL)
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_NO,  // 商品番号
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_NAME, // 商品名
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.WAREHOUSE_CODE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SEARCH_DISP,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.TAX_FLG,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ORDER_BTN,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.INQUIRY_BTN,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.STOCK_DISP,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.CASH_ON_DELIVERY_FEE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.GENRE_ID,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.CATCH_COPY, // キャッチコピー
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PC_ITEM_DESC, // PC用商品説明文
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SMARTPHONE_ITEM_DESC, // スマートフォン用商品説明文
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_INFO_LAYOUT,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.HDR_FTR_LNV,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.DISP_ORDER,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.COMMON_DESC_S,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.FEATURED_PRODUCT,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.COMMON_DESC_L,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.REVIEW_DISP,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.MAKER_INFO_DISP,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SUBS_SETTING,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.GROUP_SETTING,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE1,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH1,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT1,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE2,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH2,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT2,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE3,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH3,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT3,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE4,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH4,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT4,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE5,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH5,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT5,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE6,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH6,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT6,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE7,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH7,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT7,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE8,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH8,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT8,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE9,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH9,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT9,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE10,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH10,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT10,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE11,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH11,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT11,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE12,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH12,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT12,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE13,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH13,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT13,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE14,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH14,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT14,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_TYPE15,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_PATH15,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.IMG_ALT15,
      // ↑商品レベル↑↑

      // SKUレベル↓↓
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SKU_MANAGE_NO,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.REGULAR_PRICE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.DISP_PRICE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.DOUBLE_PRICE_NO,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.RESTOCK_BUTTON,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.NOSHI_FLG,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.STOCK_QTY,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.STOCK_REVERT,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.OUT_OF_STOCK_ORDER,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.STOCK_IN_DELIVERY_NO,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.OUT_OF_STOCK_DELIVERY_MNG_NO,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.STOCK_IN_LEADTIME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SKU_WAREHOUSE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.POSTAGE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.SINGLE_UNIT_DELIVERY,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.LEAVE_AT_DOOR_FLG,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.NO_CATALOG_ID_REASON,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR1_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR1_VAL,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR2_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR2_VAL,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR3_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR3_VAL,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR4_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.ITEM_ATTR4_VAL,
      // ↑ SKUレベル
      // オプションレベル↓↓
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION_TYPE,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION_NAME,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION1,
      CONFIG_RAKUTEN_CMN.OUTPUT_CSV_RAKUTEN_ITEM.PRODUCT_OPTION_REQUIRED,
      // オプションレベル↑↑


    ]
  },
  // 平田追加：楽天CSV出力固定値（ペンダントライト）
  RAKUTEN_PENDANT_LIGHT_FIXED_VAL: {
    WAREHOUSE_CODE_FIXED_VAL: 0,
    SEARCH_DISP_FIXED_VAL: 1,
    TAX_FLG_FIXED_VAL: 1,
    ORDER_BTN_FIXED_VAL: 1,
    INQUIRY_BTN_FIXED_VAL: 1,
    STOCK_DISP_FIXED_VAL: 0,
    CASH_ON_DELIVERY_FEE_FIXED: 0,
    GENRE_ID_FIXED_VAL: 300456,
    IMAGE_TYPE1_FIXED_VAL: "CABINET",
    ITEM_INFO_LAYOUT_FIXED_VAL: 1,
    HDR_FTR_LNV_FIXED_VAL: "自動選択",
    DISP_ORDER_FIXED_VAL: "自動選択",
    COMMON_DESC_S_FIXED_VAL: "自動選択",
    FEATURED_PRODUCT_FIXED_VAL: "自動選択",
    COMMON_DESC_L_FIXED_VAL: "自動選択",
    REVIEW_DISP_FIXED_VAL: 2,
    MAKER_INFO_DISP_FIXED_VAL: 1,
    SUBS_SETTING_FIXED_VAL: 0,
    GROUP_SETTING_FIXED_VAL: 0,
    PRODUCT_OPTION_TYPE_FIXED_VAL: "s",
    PRODUCT_OPTION_NAME1_FIXED_VAL: "ペンダントライトは開封・未使用問わず返品交換不可です",
    PRODUCT_OPTION_NAME2_FIXED_VAL: "破損・品違いは到着7日以内にご連絡下さい",
    PRODUCT_OPTION1_FIXED_VAL: "理解した",
    PRODUCT_OPTION_REQUIRED_FIXED_VAL: 1,
    DOUBLE_PRICE_NO_FIXED_VAL: 0,
    RESTOCK_BUTTON_FIXED_VAL: 0,
    NOSHI_FLG_FIXED_VAL: 0,
    STOCK_QTY_FIXED_VAL: 99,
    STOCK_REVERT_FIXED_VAL: 0,
    OUT_OF_STOCK_ORDER_FIXED_VAL: 1,//在庫切れ時に注文を受け付ける
    OUT_OF_STOCK_ORDER_NOT_ACCEPTED_FIXED_VAL: 0, // 在庫切れ時に注文を受け付けない
    STOCK_IN_DELIVERY_NO_FIXED_VAL: 1,
    OUT_OF_STOCK_DELIVERY_MNG_NO_FIXED_VAL: 4,
    STOCK_IN_LEADTIME_FIXED_VAL: "2-3営業日以内に発送",
    SKU_WAREHOUSE_FIXED_VAL: 0,
    POSTAGE_FIXED_VAL: 1,
    SINGLE_UNIT_DELIVERY_FIXED_VAL: 0,
    LEAVE_AT_DOOR_FLG_FIXED_VAL: 1,
    NO_CATALOG_ID_REASON_FIXED_VAL: 5,
    ITEM_ATTR1_NAME_FIXED_VAL: "ブランド名",
    ITEM_ATTR2_NAME_FIXED_VAL: "メーカー型番",
    ITEM_ATTR3_NAME_FIXED_VAL: "原産国／製造国",
    ITEM_ATTR3_VAL_FIXED_VAL: "-",
    ITEM_ATTR4_NAME_FIXED_VAL: "代表カラー"
  },
  OUTPUT_CEILING_FAN_CSV_RAKUTEN_ITEM: {
    //商品レベル
    WAREHOUSE_CODE_FIXED_VAL: 0,
    SEARCH_DISP_FIXED_VAL: 1,
    TAX_FLG_FIXED_VAL: 1,
    ORDER_BTN_FIXED_VAL: 1,
    INQUIRY_BTN_FIXED_VAL: 1,
    STOCK_DISP_FIXED_VAL: 0,
    CASH_ON_DELIVERY_FEE_FIXED_VAL: 0,
    GENRE_ID_FIXED_VAL: 300452,
    //画像数分の繰り返し
    ITEM_INFO_LAYOUT_FIXED_VAL: 1,
    HDR_FTR_LNV_FIXED_VAL: "自動選択",
    DISP_ORDER_FIXED_VAL: "自動選択",
    COMMON_DESC_S_FIXED_VAL: "自動選択",
    FEATURED_PRODUCT_FIXED_VAL: "自動選択",
    COMMON_DESC_L_FIXED_VAL: "自動選択",
    REVIEW_DISP_FIXED_VAL: 2,
    MAKER_INFO_DISP_FIXED_VAL: 0,
    // オプションレベル
    PRODUCT_OPTION_TYPE_FIXED_VAL: "s",
    PRODUCT_OPTION_NAME_FIXED_VAL: "全国対応可能な専門店の取付工事について",
    PRODUCT_OPTION1_FIXED_VAL: "A：お客様ご自身で取付",
    PRODUCT_OPTION2_FIXED_VAL: "B：ファズーに工事依頼　見積希望",
    PRODUCT_OPTION3_FIXED_VAL: "C：ファズーに工事依頼　相談済み",
    PRODUCT_OPTION4_FIXED_VAL: "D：別の工事店を手配して取付",
    PRODUCT_OPTION_REQUIRED_FIXED_VAL: 0,
    // SKUレベル
    STOCK_QTY_FIXED_VAL: 99, // 在庫数
    OUT_OF_STOCK_ORDER_FIXED_VAL: 1,
    OUT_OF_STOCK_DELIVERY_MNG_NO_FIXED_VAL: 4,
    SKU_WAREHOUSE_FIXED_VAL: 0,
    SINGLE_UNIT_DELIVERY_FIXED_VAL: 0,
    LEAVE_AT_DOOR_FLG_FIXED_VAL: 1,
    NO_CATALOG_ID_REASON_FIXED_VAL: 5,
    ITEM_ATTR1_NAME_FIXED_VAL: "ブランド名",
    ITEM_ATTR2_NAME_FIXED_VAL: "メーカー型番",
    ITEM_ATTR3_NAME_FIXED_VAL: "原産国／製造国",
    ITEM_ATTR3_VAL_FIXED_VAL: "中国",
    ITEM_ATTR4_NAME_FIXED_VAL: "代表カラー",
    ITEM_ATTR4_VAL_FIXED_VAL: "ホワイト"
  },
  IMG: {
    IMG_FOLDER: "img",
    CF_ORIGINAL_FOLDER: "cf_item_img", // 元画像配置先（CF)
    PL_ORIGINAL_FOLDER: "pl_item_img", // 元画像配置先（PL)
    CF_FOLDER1: "cf_img_rakuten",// リネーム後の配置先(CF)１
    PL_FORDER1: "pl_img_rakuten", // リネーム後の配置先(PL)１
    LIB_FOLDER: "lib" // リネーム後の配置先２（PL/CF）・・親フォルダは別
  },
  ITEM_ATTR4_ENABLE_COLORS: [ // 商品属性（値）4 に設定可能なカラー一覧（楽天規定）
    "ブラック",
    "グレー",
    "ホワイト",
    "ブラウン",
    "ベージュ",
    "カーキグリーン",
    "ピンク",
    "ワインレッド",
    "レッド",
    "オレンジ",
    "イエロー",
    "グリーン",
    "ブルー",
    "ネイビー",
    "パープル",
    "ゴールド",
    "シルバー",
    "透明",
    "マルチカラー"
  ],
  IMG_PL_POS_LIST: [ // リネーム対象画像リスト（PL）
    CONFIG.PL_SHEET.LISTITEM_IMG_MAIN1,
    CONFIG.PL_SHEET.LISTITEM_IMG_I1,
    CONFIG.PL_SHEET.LISTITEM_IMG_I2,
    CONFIG.PL_SHEET.LISTITEM_IMG_I3,
    CONFIG.PL_SHEET.LISTITEM_IMG_I4,
    CONFIG.PL_SHEET.LISTITEM_IMG_I5,
    CONFIG.PL_SHEET.LISTITEM_IMG_I6,
    CONFIG.PL_SHEET.LISTITEM_IMG_I7,
    CONFIG.PL_SHEET.LISTITEM_IMG_I8,
    CONFIG.PL_SHEET.LISTITEM_IMG_I9,
    CONFIG.PL_SHEET.LISTITEM_IMG_I10,
    CONFIG.PL_SHEET.LISTITEM_IMG_I11,
    CONFIG.PL_SHEET.LISTITEM_IMG_I12,
    CONFIG.PL_SHEET.LISTITEM_IMG_I13,
    CONFIG.PL_SHEET.LISTITEM_IMG_I14,
    CONFIG.PL_SHEET.LISTITEM_IMG_I15,
    CONFIG.PL_SHEET.LISTITEM_IMG_S1,
    CONFIG.PL_SHEET.LISTITEM_IMG_S2,
    CONFIG.PL_SHEET.LISTITEM_IMG_F1,
    CONFIG.PL_SHEET.LISTITEM_IMG_F2,
    CONFIG.PL_SHEET.LISTITEM_IMG_F3,
    CONFIG.PL_SHEET.LISTITEM_IMG_F4,
    CONFIG.PL_SHEET.LISTITEM_IMG_F5,
    CONFIG.PL_SHEET.LISTITEM_IMG_F6
  ],
  IMG_PL_SYS_POS_LIST:[ // 商品画像のリスト（PL）CSVの画像１～１５の項目に相当
    CONFIG.PL_SHEET.LISTITEM_IMG_MAIN1,
    CONFIG.PL_SHEET.LISTITEM_IMG_I1,
    CONFIG.PL_SHEET.LISTITEM_IMG_I2,
    CONFIG.PL_SHEET.LISTITEM_IMG_I3,
    CONFIG.PL_SHEET.LISTITEM_IMG_I4,
    CONFIG.PL_SHEET.LISTITEM_IMG_I5,
    CONFIG.PL_SHEET.LISTITEM_IMG_I6,
    CONFIG.PL_SHEET.LISTITEM_IMG_I7,
    CONFIG.PL_SHEET.LISTITEM_IMG_I8,
    CONFIG.PL_SHEET.LISTITEM_IMG_I9,
    CONFIG.PL_SHEET.LISTITEM_IMG_I10,
    CONFIG.PL_SHEET.LISTITEM_IMG_I11,
    CONFIG.PL_SHEET.LISTITEM_IMG_I12,
    CONFIG.PL_SHEET.LISTITEM_IMG_I13,
    CONFIG.PL_SHEET.LISTITEM_IMG_I14,
    CONFIG.PL_SHEET.LISTITEM_IMG_I15
  ],
  IMG_CF_POS_LIST: [
    CONFIG.CF_SHEET.LISTITEM_IMG_MAIN1,
    CONFIG.CF_SHEET.LISTITEM_IMG_MAIN2,
    CONFIG.CF_SHEET.LISTITEM_IMG_FEATURE1,
    CONFIG.CF_SHEET.LISTITEM_IMG_FS_FEATURE,
    CONFIG.CF_SHEET.LISTITEM_IMG_I1,
    CONFIG.CF_SHEET.LISTITEM_IMG_I2,
    CONFIG.CF_SHEET.LISTITEM_IMG_I3,
    CONFIG.CF_SHEET.LISTITEM_IMG_I4,
    CONFIG.CF_SHEET.LISTITEM_IMG_I5,
    CONFIG.CF_SHEET.LISTITEM_IMG_I6,
    CONFIG.CF_SHEET.LISTITEM_IMG_I7,
    CONFIG.CF_SHEET.LISTITEM_IMG_I8,
    CONFIG.CF_SHEET.LISTITEM_IMG_I9,
    CONFIG.CF_SHEET.LISTITEM_IMG_I10,
    CONFIG.CF_SHEET.LISTITEM_IMG_S1,
    CONFIG.CF_SHEET.LISTITEM_IMG_S2,
    CONFIG.CF_SHEET.LISTITEM_IMG_F1,
    CONFIG.CF_SHEET.LISTITEM_IMG_F2,
    CONFIG.CF_SHEET.LISTITEM_IMG_F3,
    CONFIG.CF_SHEET.LISTITEM_IMG_R1,
    CONFIG.CF_SHEET.LISTITEM_IMG_E1
  ],
  ILLUMINANCE_DIC: {
    [3]: "",
    [4]: "",
    [4.5]: "",
    [5.9]: "",
    [6]: "",
    [8]: "明るさ8畳",
    [10]: "明るさ10畳",
    [12]: "明るさ12畳",
    [14]: "明るさ14畳",
    [-1]: ""
  }
}
