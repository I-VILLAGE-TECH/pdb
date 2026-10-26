// 少しずつ書き出す ZIP。画像・HTML を数千ファイルまとめても、メモリに全体を持たずにレスポンスへ流す。
// JPEG はこれ以上圧縮できないため無圧縮(stored)、HTML 等のテキストは deflate で格納する(add の deflate)。
// CRC とサイズはデータの後(データ記述子)に書く。
// ZIP64 には対応しないため、合計 4GB・65,535 件までに制限する(超える場合は呼び出し側で絞り込んでもらう)
import { crc32, deflateRawSync } from "node:zlib";
import type { Readable, Writable } from "node:stream";

const MAX_TOTAL = 0xffffffff;
const MAX_ENTRIES = 0xffff;

type Entry = {
  name: Buffer;
  method: number; // 0=stored / 8=deflate
  crc: number;
  compSize: number;
  size: number;
  offset: number;
  dosTime: number;
  dosDate: number;
};

function dosDateTime(d: Date): { dosTime: number; dosDate: number } {
  return {
    dosTime: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dosDate: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export class ZipStreamWriter {
  private offset = 0;
  private entries: Entry[] = [];

  constructor(private out: Writable) {}

  get count(): number {
    return this.entries.length;
  }

  private async write(buf: Buffer): Promise<void> {
    this.offset += buf.length;
    if (!this.out.write(buf)) {
      await new Promise<void>((resolve, reject) => {
        const onDrain = () => {
          this.out.off("error", onError);
          resolve();
        };
        const onError = (e: Error) => {
          this.out.off("drain", onDrain);
          reject(e);
        };
        this.out.once("drain", onDrain);
        this.out.once("error", onError);
      });
    }
  }

  /** ファイルを1件追加する。data は Buffer か読み出しストリーム。deflate は Buffer のときだけ有効(1ファイルずつ圧縮) */
  async add(fileName: string, data: Buffer | Readable, opts: { deflate?: boolean; mtime?: Date } = {}): Promise<void> {
    const mtime = opts.mtime ?? new Date();
    const deflate = !!opts.deflate && Buffer.isBuffer(data);
    const method = deflate ? 8 : 0;
    if (this.entries.length >= MAX_ENTRIES) throw new Error(`ZIP に入れられるのは ${MAX_ENTRIES} 件までです`);
    const name = Buffer.from(fileName, "utf8");
    const { dosTime, dosDate } = dosDateTime(mtime);
    const offset = this.offset;

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0808, 6); // bit3: データ記述子 / bit11: ファイル名UTF-8
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    // crc・サイズは 0(データ記述子に書く)
    header.writeUInt16LE(name.length, 26);
    await this.write(header);
    await this.write(name);

    let crc = 0;
    let size = 0;
    let compSize = 0;
    if (deflate) {
      const raw = data as Buffer;
      const comp = deflateRawSync(raw);
      crc = crc32(raw);
      size = raw.length;
      compSize = comp.length;
      await this.write(comp);
    }
    const chunks: Iterable<Buffer> | AsyncIterable<Buffer> = deflate
      ? []
      : Buffer.isBuffer(data)
        ? [data]
        : (data as AsyncIterable<Buffer>);
    for await (const chunk of chunks) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      crc = crc32(buf, crc);
      size += buf.length;
      compSize += buf.length;
      await this.write(buf);
    }
    if (this.offset > MAX_TOTAL) throw new Error("ZIP の合計サイズが 4GB を超えました。対象を絞り込んでください");

    const desc = Buffer.alloc(16);
    desc.writeUInt32LE(0x08074b50, 0);
    desc.writeUInt32LE(crc >>> 0, 4);
    desc.writeUInt32LE(compSize, 8);
    desc.writeUInt32LE(size, 12);
    await this.write(desc);

    this.entries.push({ name, method, crc: crc >>> 0, compSize, size, offset, dosTime, dosDate });
  }

  /** 中央ディレクトリを書いて閉じる(出力ストリームの end は呼び出し側) */
  async finish(): Promise<void> {
    const cdStart = this.offset;
    for (const e of this.entries) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0);
      h.writeUInt16LE(20, 4); // version made by
      h.writeUInt16LE(20, 6); // version needed
      h.writeUInt16LE(0x0808, 8);
      h.writeUInt16LE(e.method, 10);
      h.writeUInt16LE(e.dosTime, 12);
      h.writeUInt16LE(e.dosDate, 14);
      h.writeUInt32LE(e.crc, 16);
      h.writeUInt32LE(e.compSize, 20);
      h.writeUInt32LE(e.size, 24);
      h.writeUInt16LE(e.name.length, 28);
      h.writeUInt32LE(e.offset, 42);
      await this.write(h);
      await this.write(e.name);
    }
    const cdSize = this.offset - cdStart;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(cdSize, 12);
    end.writeUInt32LE(cdStart, 16);
    await this.write(end);
  }
}
