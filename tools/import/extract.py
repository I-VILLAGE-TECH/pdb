#!/usr/bin/env python3
"""現行2ブック（ペンダントライト一覧.xlsm / シーリングファン一覧.xlsb）から
商品データを抽出して JSON に正規化する初期移行スクリプト。

出力: tools/import/out/pl_products.json / cf_products.json / makers.json
投入: server/ で `npm run db:import`

使い方:
  python3 extract.py --pl <ペンダントライト一覧.xlsm> --cf <シーリングファン一覧.xlsb>
"""

import argparse
import json
import re
from pathlib import Path

OUT_DIR = Path(__file__).parent / "out"


# ---------- ユーティリティ ----------

def s(v):
    """セル値→文字列（空はNone）"""
    if v is None:
        return None
    text = str(v).strip()
    return text or None


def num_int(v):
    if v is None or v == "":
        return None
    try:
        return int(round(float(v)))
    except (ValueError, TypeError):
        return None


def num_float(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def flag(v):
    return s(v) in ("○", "◎", "Y", "y", "True", "TRUE", "あり")


def iso_date(v):
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        return v.isoformat()
    m = re.match(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", str(v))
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}T00:00:00"
    return None


# ---------- ペンダントライト（.xlsm） ----------

PL_SHEET = "ペンダントライト一覧"

# 画像列: (開始列, 種別, 枚数)
PL_IMAGE_COLS = [
    (99, "MAIN", 2),
    (101, "IMAGE", 15),
    (116, "SIZE", 2),
    (119, "FUNCTION", 6),
]


def pl_status(row):
    if s(row[145]):  # データ削除
        return "HIDDEN"
    end = s(row[4])  # 販売終了 ○終了 / △終了在庫有
    if end == "○":
        return "DISCONTINUED"
    if end == "△":
        return "DISCONTINUED_IN_STOCK"
    if s(row[3]):  # 入荷待ち
        return "BACKORDER"
    return "ACTIVE"


def extract_pl(path):
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[PL_SHEET]

    makers = {}
    groups = {}  # parentCode -> {"parent": row, "children": [row]}

    for row in ws.iter_rows(min_row=4, values_only=True):
        row = list(row) + [None] * (170 - len(row))
        sku = s(row[18])  # fazoo管理型番(ユニーク)
        parent_code = s(row[16])  # fazoo管理型番 親
        if not sku or not parent_code:
            continue
        maker_code = s(row[7])
        if maker_code and maker_code not in makers:
            makers[maker_code] = {
                "makerCode": maker_code,
                "nameJp": s(row[20]) or maker_code,
                "nameEn": s(row[21]),
                "imgFolder": s(row[131]),
            }
        g = groups.setdefault(parent_code, {"parent": None, "children": []})
        kind = s(row[15])  # 単品 / 親バリエーション / 子バリエーション
        if kind in ("単品", "親バリエーション") and g["parent"] is None:
            g["parent"] = row
        else:
            g["children"].append(row)

    products = []
    for parent_code, g in groups.items():
        p = g["parent"] or (g["children"][0] if g["children"] else None)
        if p is None:
            continue
        kind = s(p[15])
        rows = [p] + g["children"]

        category = {"PL": "PENDANT_LIGHT", "CL": "CEILING_LIGHT", "CF": "CEILING_FAN"}.get(
            s(p[6]) or "PL", "OTHER"
        )

        images = []
        for start, image_type, count in PL_IMAGE_COLS:
            for i in range(count):
                fn = s(p[start + i])
                if fn:
                    images.append({"imageType": image_type, "sortNo": i + 1, "fileName": fn})
        if s(p[125]):
            images.append(
                {
                    "imageType": "BANNER",
                    "sortNo": 1,
                    "fileName": s(p[125]),
                    "linkUrl": s(p[126]),
                    "title": s(p[127]),
                }
            )

        descriptions = []
        for idx, label in [(94, "機能詳細1"), (95, "機能詳細2"), (96, "機能詳細3"), (97, "機能詳細4"), (98, "機能詳細5")]:
            if s(p[idx]):
                descriptions.append({"label": label, "body": s(p[idx])})

        variations = []
        for r in rows:
            vno = num_int(r[17]) or (len(variations) + 1)
            variations.append(
                {
                    "variationNo": vno,
                    "skuCode": s(r[18]),
                    "axisName": "電球",
                    "optionValue": s(r[154]) or s(r[76]),
                    "modelNumber": s(r[24]),
                    "janCode": s(r[91]),
                    "price": num_int(r[48]) or num_int(r[29]),
                    "isRepresentative": r is p,
                    "sortNo": num_int(r[19]),
                }
            )

        # 組み合わせ電球/製品 → set_components（型番のみ・引当は投入時）
        set_components = []
        if s(p[30]):
            set_components.append({"componentModel": s(p[30]), "role": "BULB", "qty": num_int(p[60]) or 1})
        for col, role in [(36, "PRODUCT"), (42, "PRODUCT")]:
            if s(p[col]):
                set_components.append({"componentModel": s(p[col]), "role": role, "qty": 1})

        products.append(
            {
                "productCode": parent_code,
                "category": category,
                "productKind": "SINGLE" if kind == "単品" and not g["children"] else "VARIATION_PARENT",
                "makerCode": s(p[7]),
                "seriesCode": s(p[10]),
                "genreCode": s(p[12]),
                "seqNo": num_int(p[9]),
                "name": s(p[82]) or s(p[23]) or parent_code,  # 代表イメージ商品名 / 掲載用型番
                "summary": s(p[22]),  # メイングループ名
                "modelNumber": s(p[24]),
                "janCode": s(p[91]),
                "status": pl_status(p),
                "statusNote": s(p[5]),
                "successorModel": s(p[133]),
                "releaseDate": iso_date(p[90]),
                "cost": num_int(p[26]),
                "listPriceExTax": num_int(p[27]),
                "listPriceInTax": num_int(p[28]),
                "sellingPrice": num_int(p[29]),
                "totalPrice": num_int(p[48]),
                "supplier": s(p[25]),
                "widthMm": num_int(p[50]),
                "depthMm": num_int(p[51]),
                "heightMm": num_int(p[52]),
                "weightKg": num_float(p[53]),
                "totalHeightMinMm": num_int(p[54]),
                "totalHeightMaxMm": num_int(p[55]),
                "bodyColor": s(p[80]) or s(p[13]),
                "comment": s(p[92]),
                "detail": s(p[93]),
                "descriptions": descriptions or None,
                "isNew": flag(p[1]),
                "isRecommended": flag(p[2]),
                "memo": s(p[146]) or s(p[135]),
                "extra": {
                    "yahooRakutenPublished": s(p[136]),
                    "catalog": s(p[148]),
                    "shopserveModel": s(p[134]),
                    "autoKeywords": s(p[129]),
                    "manualKeywords": s(p[130]),
                    "attachableCount": num_int(p[157]),
                },
                "lightingAttrs": {
                    "bulbType": s(p[75]),
                    "bulbKind": s(p[74]),
                    "initialBulbType": s(p[70]),
                    "bulbColor": s(p[76]),
                    "bulbBase": s(p[62]),
                    "mainBulbCount": num_int(p[60]),
                    "subBulb": s(p[61]),
                    "bulbReplacement": s(p[59]),
                    "bundledBulbModel": s(p[30]),
                    "brightnessLm": s(p[71]),
                    "colorTempLow": num_int(p[72]),
                    "colorTempHigh": num_int(p[73]),
                    "raValue": num_int(p[63]),
                    "wattEquivalent": s(p[64]),
                    "wattEquivalentTable": s(p[65]),
                    "dimmingMethod": s(p[77]),
                    "stepSwitching": flag(p[78]),
                    "pullSwitch": flag(p[68]),
                    "remoteIncluded": flag(p[69]),
                    "installationCode": s(p[12]),
                    "installationType": s(p[14]) or s(p[79]),
                    "inclinedCeiling": s(p[57]),
                    "highCeiling": flag(p[58]),
                    "cordStorage": s(p[56]),
                    "attachableCount": num_int(p[157]),
                    "tatami": s(p[66]),
                    "roomWholeLighting": flag(p[67]),
                    "material": s(p[81]),
                    "tags": {
                        "style1": s(p[83]),
                        "style2": s(p[84]),
                        "color": s(p[85]),
                        "type": s(p[86]),
                        "material1": s(p[87]),
                        "material2": s(p[88]),
                        "shape": s(p[89]),
                    },
                },
                "images": images,
                "variations": variations,
                "setComponents": set_components,
            }
        )

    wb.close()
    return products, makers


# ---------- シーリングファン（.xlsb） ----------

CF_SHEET = "シーリングファンデータ"

CF_SET_MODEL_COLS = [
    (21, "BODY"),
    (22, "FAN"),
    (23, "LIGHT"),
    (24, "PIPE"),
    (25, "FLANGE"),
    (26, "REMOTE"),
    (27, "BLADE"),
    (28, "OPTION"),
]

CF_IMAGE_COLS = (
    [(111, "MAIN", 1), (112, "MAIN", 2)]
    + [(118 + i, "IMAGE", i + 1) for i in range(10)]
    + [(128, "SIZE", 1), (129, "SIZE", 2)]
    + [(130 + i, "FUNCTION", i + 1) for i in range(3)]
    + [(133, "REMOTE", 1), (134, "ACCESSORY", 1)]
    + [(135 + i, "LIST", i + 1) for i in range(4)]
    + [(139, "AD", 1), (140, "AD", 2), (141, "ORIGINAL", 1)]
)


def cf_status(row):
    st = s(row[2]) or ""  # 入荷予定(生産ステータス)
    ident = num_int(row[9])  # 1:予約 2:セール 3:入荷予定
    if "生産終了" in st or "販売終了" in st or "廃番" in st:
        return "DISCONTINUED"
    if ident == 1:
        return "RESERVE"
    if ident == 3 or "入荷" in st and "即日" not in st:
        return "BACKORDER"
    return "ACTIVE"


def extract_cf(path):
    from pyxlsb import open_workbook

    makers = {}
    products = []

    with open_workbook(path) as wb:
        with wb.get_sheet(CF_SHEET) as sheet:
            for ri, raw in enumerate(sheet.rows()):
                if ri == 0:
                    continue  # ヘッダー
                row = [None] * 170
                for c in raw:
                    if c.c < 170:
                        row[c.c] = c.v

                code = s(row[15])  # ID商品管理
                name = s(row[18]) or s(row[19])
                # 末尾の作業用行（型番だけの残骸）を除外
                if not code or not name or not re.match(r"^[A-Z]{2,4}\d+", code):
                    continue

                maker_code = s(row[11])
                if maker_code and maker_code not in makers:
                    makers[maker_code] = {
                        "makerCode": maker_code,
                        "nameJp": s(row[16]) or maker_code,
                        "nameEn": None,
                        "imgFolder": None,
                    }

                set_components = []
                for col, role in CF_SET_MODEL_COLS:
                    if role == "BODY":
                        continue  # 一体型は本体型番として扱う
                    model = s(row[col])
                    if model:
                        set_components.append({"componentModel": model, "role": role, "qty": 1})

                images = []
                for col, image_type, sort_no in CF_IMAGE_COLS:
                    fn = s(row[col])
                    if fn:
                        images.append({"imageType": image_type, "sortNo": sort_no, "fileName": fn})
                if s(row[113]):
                    images.append({"imageType": "FEATURE", "sortNo": 1, "fileName": s(row[113])})
                if s(row[114]):
                    images.append({"imageType": "FEATURE", "sortNo": 2, "fileName": s(row[114])})

                # バリエーション（型番_バリエーション1-3 × 選択肢）
                variations = []
                axis = s(row[93])  # バリエーション1項目名
                for i in range(3):
                    vmodel = s(row[29 + i])
                    opt = s(row[94 + i])
                    if vmodel or opt:
                        variations.append(
                            {
                                "variationNo": i + 1,
                                "skuCode": f"{code}v{i + 1}",
                                "axisName": axis,
                                "optionValue": opt,
                                "modelNumber": vmodel,
                                "isRepresentative": i == 0,
                                "additionalLeadTime": s(row[99 + i]),
                                "imageName": s(row[102]) if i == 0 else None,
                            }
                        )
                if not variations:
                    variations.append(
                        {
                            "variationNo": 1,
                            "skuCode": f"{code}v1",
                            "modelNumber": s(row[21]) or s(row[20]),
                            "isRepresentative": True,
                        }
                    )

                descriptions = []
                for idx, label in [(85, "サブ紹介文_個別"), (87, "サブ紹介文2")]:
                    if s(row[idx]):
                        descriptions.append({"label": label, "body": s(row[idx])})

                good_design = s(row[83])

                products.append(
                    {
                        "productCode": code,
                        "category": "CEILING_FAN",
                        "productKind": "SET" if set_components else "SINGLE",
                        "makerCode": maker_code,
                        "seriesCode": s(row[12]),
                        "genreCode": s(row[13]),
                        "seqNo": num_int(row[14]),
                        "name": name,
                        "summary": s(row[19]) if s(row[18]) else None,
                        "modelNumber": s(row[21]),
                        "combinationModel": s(row[20]),
                        "janCode": s(row[37]),
                        "status": cf_status(row),
                        "statusNote": s(row[2]),
                        "successorModel": s(row[3]),
                        "cost": num_int(row[43]),
                        "costInTax": num_int(row[44]),
                        "listPriceExTax": num_int(row[39]),
                        "listPriceInTax": num_int(row[40]),
                        "sellingPriceExTax": num_int(row[45]),
                        "sellingPrice": num_int(row[46]),
                        "totalPrice": num_int(row[46]),
                        "priceControlled": flag(row[38]),
                        "taxType": "TAX_INCLUDED" if s(row[49]) == "税込" else "TAX_EXCLUDED",
                        "pointRate": num_float(row[50]),
                        "supplier": s(row[42]),
                        "shippingEstimate": num_int(row[51]),
                        "widthMm": num_int(row[32]),
                        "heightMm": num_int(row[33]),
                        "height2Mm": num_int(row[34]),
                        "weightKg": num_float(row[36]),
                        "warranty": s(row[80]),
                        "moneyBackDays": 90 if flag(row[81]) else None,
                        "countryOfOrigin": s(row[82]),
                        "goodDesignYear": num_int(good_design),
                        "bodyColor": s(row[67]),
                        "comment": s(row[84]),
                        "detail": s(row[86]),
                        "descriptions": descriptions or None,
                        "videoHtmls": {
                            "fs": s(row[115]),
                            "yahoo": s(row[116]),
                            "rakuten": s(row[117]),
                        }
                        if (s(row[115]) or s(row[116]) or s(row[117]))
                        else None,
                        "isNew": s(row[88]) == "Y",
                        "isRecommended": flag(row[89]),
                        "isSameDayShipping": "即日" in (s(row[2]) or ""),
                        "flags": {"misc": s(row[90])} if s(row[90]) else None,
                        "sortNo": num_int(row[91]),
                        "shippingLeadTime": s(row[98]),
                        "fsShippingPattern": s(row[97]),
                        "relatedProducts": s(row[92]),
                        "exampleUrl": s(row[142]),
                        "memo": s(row[5]) or s(row[103]),
                        "extra": {
                            "priority": s(row[1]),
                            "amazonDeleteFlag": s(row[4]),
                            "denaPrice": num_int(row[48]),
                            "yahooListPriceUrl": s(row[143]),
                            "series": s(row[147]),
                            "singleFlag": s(row[145]),
                        },
                        "channelPrices": (
                            [{"channelCode": "amazon", "price": num_int(row[47])}]
                            if num_int(row[47])
                            else []
                        ),
                        "fanAttrs": {
                            "motorType": s(row[55]),
                            "bladeCount": num_int(row[56]),
                            "windSpeed": num_float(row[57]),
                            "windVolume": num_float(row[58]),
                            "rotationSpeed": num_int(row[59]),
                            "windLevels": num_int(row[60]),
                            "powerConsumptionW": num_float(row[54]),
                            "extensionPipe": s(row[61]),
                            "pipeVariation": s(row[62]),
                            "mountType": s(row[10]),
                            "heightToBladeMm": num_int(row[35]),
                            "lightCount": num_int(row[63]),
                            "lightKind": s(row[64]),
                            "lightColor": s(row[65]),
                            "bladeColor1": s(row[68]),
                            "bladeColor2": s(row[69]),
                            "colorCategory": s(row[66]),
                            "rhythmMode": flag(row[70]),
                            "dimming": s(row[71]),
                            "remoteIncluded": flag(row[72]),
                            "batteryType": s(row[73]),
                            "batteryCount": num_int(row[74]),
                            "brightnessLm": num_int(row[76]),
                            "wattEquivalent": s(row[75]),
                            "tatamiFrom": num_int(row[77]),
                            "tatamiTo": num_int(row[78]),
                            "angledCeiling": s(row[79]),
                            "fanGrade": s(row[104]),
                            "installVideoType": s(row[104]),
                            "installNotes": {
                                "rosette": s(row[105]),
                                "partialElectric": s(row[106]),
                                "rosette2": s(row[107]),
                                "boltFixing": s(row[108]),
                                "other": s(row[109]),
                                "note": s(row[110]),
                            },
                        },
                        "images": images,
                        "variations": variations,
                        "setComponents": set_components,
                    }
                )

    return products, makers


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pl", help="ペンダントライト一覧 .xlsm のパス")
    ap.add_argument("--cf", help="シーリングファン一覧 .xlsb のパス")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_makers = {}

    if args.pl:
        pl_products, pl_makers = extract_pl(args.pl)
        (OUT_DIR / "pl_products.json").write_text(
            json.dumps(pl_products, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        all_makers.update(pl_makers)
        print(f"PL: {len(pl_products)} products")

    if args.cf:
        cf_products, cf_makers = extract_cf(args.cf)
        (OUT_DIR / "cf_products.json").write_text(
            json.dumps(cf_products, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        all_makers.update(cf_makers)
        print(f"CF: {len(cf_products)} products")

    (OUT_DIR / "makers.json").write_text(
        json.dumps(list(all_makers.values()), ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"makers: {len(all_makers)}")


if __name__ == "__main__":
    main()
