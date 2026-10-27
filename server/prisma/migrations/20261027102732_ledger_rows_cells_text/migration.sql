-- ledger_rows.cells を JSON 文字列(text)で持つ(浮動小数点の最後の桁まで保つため)。既存の値は jsonb の文字列表現に変換する
ALTER TABLE "ledger_rows" ALTER COLUMN "cells" SET DATA TYPE TEXT USING "cells"::text;
