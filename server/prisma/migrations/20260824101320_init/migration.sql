-- CreateEnum
CREATE TYPE "product_category" AS ENUM ('PENDANT_LIGHT', 'CEILING_LIGHT', 'CEILING_FAN', 'OTHER');

-- CreateEnum
CREATE TYPE "product_kind" AS ENUM ('SINGLE', 'VARIATION_PARENT', 'SET', 'COMPONENT');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('ACTIVE', 'HIDDEN', 'DISCONTINUED', 'DISCONTINUED_IN_STOCK', 'BACKORDER', 'RESERVE');

-- CreateEnum
CREATE TYPE "tax_type" AS ENUM ('TAX_INCLUDED', 'TAX_EXCLUDED');

-- CreateEnum
CREATE TYPE "image_type" AS ENUM ('MAIN', 'IMAGE', 'SIZE', 'FUNCTION', 'REMOTE', 'ACCESSORY', 'LIST', 'BANNER', 'AD', 'ORIGINAL', 'FEATURE');

-- CreateEnum
CREATE TYPE "component_role" AS ENUM ('BODY', 'FAN', 'LIGHT', 'PIPE', 'FLANGE', 'REMOTE', 'BLADE', 'OPTION', 'BULB', 'PRODUCT');

-- CreateEnum
CREATE TYPE "transfer_type" AS ENUM ('CSV', 'API', 'FTP');

-- CreateEnum
CREATE TYPE "charset" AS ENUM ('SHIFT_JIS', 'UTF8');

-- CreateEnum
CREATE TYPE "stock_sync_mode" AS ENUM ('QUANTITY', 'AVAILABILITY', 'NONE');

-- CreateEnum
CREATE TYPE "upsert_mode" AS ENUM ('EXPLICIT_NUD', 'PARTIAL_UPDATE', 'FULL_REPLACE');

-- CreateEnum
CREATE TYPE "reflect_mode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "verify_source" AS ENUM ('API_FETCH', 'FEED_REPORT', 'MAIL', 'NONE');

-- CreateEnum
CREATE TYPE "link_status" AS ENUM ('UNREGISTERED', 'REGISTERED', 'DISCONTINUED', 'DELETED');

-- CreateEnum
CREATE TYPE "diff_status" AS ENUM ('NONE', 'UNREGISTERED', 'LOCAL_CHANGED', 'REMOTE_DRIFT', 'BOTH');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('IDLE', 'PENDING', 'VERIFIED', 'ERROR');

-- CreateEnum
CREATE TYPE "sync_job_type" AS ENUM ('PRODUCT', 'PRICE', 'STOCK', 'IMAGE', 'DELETE');

-- CreateEnum
CREATE TYPE "sync_job_status" AS ENUM ('CREATED', 'SENT', 'PROCESSED_OK', 'PROCESSED_NG', 'PROCESSED_UNKNOWN', 'VERIFIED', 'VERIFY_FAILED');

-- CreateEnum
CREATE TYPE "nud_control" AS ENUM ('N', 'U', 'D');

-- CreateEnum
CREATE TYPE "sync_item_result" AS ENUM ('OK', 'ERROR', 'UNKNOWN');

-- CreateTable
CREATE TABLE "makers" (
    "id" SERIAL NOT NULL,
    "maker_code" TEXT NOT NULL,
    "name_jp" TEXT NOT NULL,
    "name_en" TEXT,
    "img_folder" TEXT,
    "sort_level" INTEGER NOT NULL DEFAULT 999,
    "aliases" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "makers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "product_code" TEXT NOT NULL,
    "category" "product_category" NOT NULL,
    "product_kind" "product_kind" NOT NULL DEFAULT 'SINGLE',
    "maker_id" INTEGER,
    "series_code" TEXT,
    "genre_code" TEXT,
    "seq_no" INTEGER,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "model_number" TEXT,
    "combination_model" TEXT,
    "jan_code" TEXT,
    "status" "product_status" NOT NULL DEFAULT 'ACTIVE',
    "status_note" TEXT,
    "successor_model" TEXT,
    "release_date" TIMESTAMP(3),
    "cost" INTEGER,
    "cost_in_tax" INTEGER,
    "list_price_extax" INTEGER,
    "list_price_intax" INTEGER,
    "is_open_price" BOOLEAN NOT NULL DEFAULT false,
    "selling_price_extax" INTEGER,
    "selling_price" INTEGER,
    "total_price" INTEGER,
    "price_controlled" BOOLEAN NOT NULL DEFAULT false,
    "tax_type" "tax_type" NOT NULL DEFAULT 'TAX_INCLUDED',
    "point_rate" DECIMAL(5,2),
    "supplier" TEXT,
    "shipping_estimate" INTEGER,
    "width_mm" INTEGER,
    "depth_mm" INTEGER,
    "height_mm" INTEGER,
    "height2_mm" INTEGER,
    "total_height_min_mm" INTEGER,
    "total_height_max_mm" INTEGER,
    "weight_kg" DECIMAL(8,2),
    "warranty" TEXT,
    "money_back_days" INTEGER,
    "country_of_origin" TEXT,
    "good_design_year" INTEGER,
    "body_color" TEXT,
    "comment" TEXT,
    "detail" TEXT,
    "descriptions" JSONB,
    "videoHtmls" JSONB,
    "is_new" BOOLEAN NOT NULL DEFAULT false,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "is_same_day_shipping" BOOLEAN NOT NULL DEFAULT false,
    "flags" JSONB,
    "sort_no" INTEGER,
    "shipping_lead_time" TEXT,
    "fs_shipping_pattern" TEXT,
    "related_products" TEXT,
    "example_url" TEXT,
    "memo" TEXT,
    "extra" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_lighting_attrs" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "bulb_type" TEXT,
    "bulb_kind" TEXT,
    "initial_bulb_type" TEXT,
    "bulb_color" TEXT,
    "bulb_base" TEXT,
    "main_bulb_count" INTEGER,
    "sub_bulb" TEXT,
    "bulb_replacement" TEXT,
    "bundled_bulb_model" TEXT,
    "brightness_lm" TEXT,
    "color_temp_low" INTEGER,
    "color_temp_high" INTEGER,
    "ra_value" INTEGER,
    "watt_equivalent" TEXT,
    "watt_equivalent_table" TEXT,
    "dimming_method" TEXT,
    "step_switching" BOOLEAN NOT NULL DEFAULT false,
    "pull_switch" BOOLEAN NOT NULL DEFAULT false,
    "remote_included" BOOLEAN NOT NULL DEFAULT false,
    "installation_code" TEXT,
    "installation_type" TEXT,
    "inclined_ceiling" TEXT,
    "high_ceiling" BOOLEAN NOT NULL DEFAULT false,
    "cord_storage" TEXT,
    "attachable_count" INTEGER,
    "tatami" TEXT,
    "room_whole_lighting" BOOLEAN NOT NULL DEFAULT false,
    "material" TEXT,
    "tags" JSONB,

    CONSTRAINT "product_lighting_attrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_fan_attrs" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "motor_type" TEXT,
    "blade_count" INTEGER,
    "wind_speed" DECIMAL(6,2),
    "wind_volume" DECIMAL(8,2),
    "rotation_speed" INTEGER,
    "wind_levels" INTEGER,
    "power_consumption_w" DECIMAL(6,1),
    "extension_pipe" TEXT,
    "pipe_variation" TEXT,
    "mount_type" TEXT,
    "height_to_blade_mm" INTEGER,
    "light_count" INTEGER,
    "light_kind" TEXT,
    "light_color" TEXT,
    "blade_color1" TEXT,
    "blade_color2" TEXT,
    "color_category" TEXT,
    "rhythm_mode" BOOLEAN NOT NULL DEFAULT false,
    "dimming" TEXT,
    "remote_included" BOOLEAN NOT NULL DEFAULT false,
    "battery_type" TEXT,
    "battery_count" INTEGER,
    "brightness_lm" INTEGER,
    "watt_equivalent" TEXT,
    "tatami_from" INTEGER,
    "tatami_to" INTEGER,
    "angled_ceiling" TEXT,
    "fan_grade" TEXT,
    "install_video_type" TEXT,
    "installNotes" JSONB,

    CONSTRAINT "product_fan_attrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variations" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "variation_no" INTEGER NOT NULL,
    "sku_code" TEXT NOT NULL,
    "axis_name" TEXT,
    "option_value" TEXT,
    "model_number" TEXT,
    "jan_code" TEXT,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "price" INTEGER,
    "is_representative" BOOLEAN NOT NULL DEFAULT false,
    "sort_no" INTEGER,
    "additional_lead_time" TEXT,
    "image_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "image_type" "image_type" NOT NULL,
    "sort_no" INTEGER NOT NULL DEFAULT 1,
    "file_name" TEXT NOT NULL,
    "url" TEXT,
    "alt_text" TEXT,
    "link_url" TEXT,
    "title" TEXT,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_components" (
    "id" SERIAL NOT NULL,
    "set_product_id" INTEGER NOT NULL,
    "component_product_id" INTEGER,
    "component_model" TEXT NOT NULL,
    "role" "component_role" NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "sort_no" INTEGER,

    CONSTRAINT "set_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "product_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id","category_id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "transfer_type" "transfer_type" NOT NULL,
    "charset" "charset" NOT NULL DEFAULT 'UTF8',
    "stock_sync_mode" "stock_sync_mode" NOT NULL DEFAULT 'NONE',
    "price_source" TEXT NOT NULL DEFAULT 'total_price',
    "upsert_mode" "upsert_mode" NOT NULL DEFAULT 'FULL_REPLACE',
    "split_rows" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reflect_mode" "reflect_mode" NOT NULL DEFAULT 'MANUAL',
    "verify_source" "verify_source" NOT NULL DEFAULT 'NONE',
    "remote_fetch_schedule" TEXT,
    "secrets_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_field_maps" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "output_col_no" INTEGER NOT NULL,
    "output_header" TEXT NOT NULL,
    "source_expr" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "channel_field_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_category_maps" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "external_code" TEXT NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER,

    CONSTRAINT "channel_category_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_channel_prices" (
    "product_id" INTEGER NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "product_channel_prices_pkey" PRIMARY KEY ("product_id","channel_id")
);

-- CreateTable
CREATE TABLE "product_channel_links" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "variation_id" INTEGER NOT NULL,
    "external_code" TEXT,
    "link_status" "link_status" NOT NULL DEFAULT 'UNREGISTERED',
    "local_payload" JSONB,
    "local_hash" CHAR(64),
    "sent_payload" JSONB,
    "sent_hash" CHAR(64),
    "remote_payload" JSONB,
    "remote_fetched_at" TIMESTAMP(3),
    "diff_status" "diff_status" NOT NULL DEFAULT 'UNREGISTERED',
    "diff_fields" JSONB,
    "sync_status" "sync_status" NOT NULL DEFAULT 'IDLE',
    "last_sent_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_channel_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "job_type" "sync_job_type" NOT NULL,
    "triggered_by" TEXT,
    "transport_ref" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "status" "sync_job_status" NOT NULL DEFAULT 'CREATED',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_job_items" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "link_id" INTEGER NOT NULL,
    "control" "nud_control" NOT NULL,
    "payload_hash" CHAR(64),
    "result" "sync_item_result" NOT NULL DEFAULT 'UNKNOWN',
    "error_message" TEXT,

    CONSTRAINT "sync_job_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "makers_maker_code_key" ON "makers"("maker_code");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

-- CreateIndex
CREATE INDEX "products_category_status_idx" ON "products"("category", "status");

-- CreateIndex
CREATE INDEX "products_maker_id_idx" ON "products"("maker_id");

-- CreateIndex
CREATE INDEX "products_updated_at_idx" ON "products"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_lighting_attrs_product_id_key" ON "product_lighting_attrs"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_fan_attrs_product_id_key" ON "product_fan_attrs"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variations_sku_code_key" ON "product_variations"("sku_code");

-- CreateIndex
CREATE UNIQUE INDEX "product_variations_product_id_variation_no_key" ON "product_variations"("product_id", "variation_no");

-- CreateIndex
CREATE INDEX "product_images_product_id_image_type_idx" ON "product_images"("product_id", "image_type");

-- CreateIndex
CREATE INDEX "set_components_set_product_id_idx" ON "set_components"("set_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_path_key" ON "categories"("path");

-- CreateIndex
CREATE UNIQUE INDEX "channels_code_key" ON "channels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "channel_field_maps_channel_id_output_col_no_key" ON "channel_field_maps"("channel_id", "output_col_no");

-- CreateIndex
CREATE UNIQUE INDEX "channel_category_maps_channel_id_category_id_key" ON "channel_category_maps"("channel_id", "category_id");

-- CreateIndex
CREATE INDEX "product_channel_links_channel_id_diff_status_idx" ON "product_channel_links"("channel_id", "diff_status");

-- CreateIndex
CREATE UNIQUE INDEX "product_channel_links_channel_id_variation_id_key" ON "product_channel_links"("channel_id", "variation_id");

-- CreateIndex
CREATE INDEX "sync_jobs_channel_id_status_idx" ON "sync_jobs"("channel_id", "status");

-- CreateIndex
CREATE INDEX "sync_job_items_job_id_idx" ON "sync_job_items"("job_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_maker_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lighting_attrs" ADD CONSTRAINT "product_lighting_attrs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_fan_attrs" ADD CONSTRAINT "product_fan_attrs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_components" ADD CONSTRAINT "set_components_set_product_id_fkey" FOREIGN KEY ("set_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_components" ADD CONSTRAINT "set_components_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_field_maps" ADD CONSTRAINT "channel_field_maps_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_category_maps" ADD CONSTRAINT "channel_category_maps_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_category_maps" ADD CONSTRAINT "channel_category_maps_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_channel_prices" ADD CONSTRAINT "product_channel_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_channel_prices" ADD CONSTRAINT "product_channel_prices_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_channel_links" ADD CONSTRAINT "product_channel_links_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_channel_links" ADD CONSTRAINT "product_channel_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_channel_links" ADD CONSTRAINT "product_channel_links_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "product_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_job_items" ADD CONSTRAINT "sync_job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_job_items" ADD CONSTRAINT "sync_job_items_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "product_channel_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
