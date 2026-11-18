import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { SiteNav } from "@/components/SiteNav";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Cara fishook menangkap webhook, mengekstrak event type, membangun skema dari sampel, dan menghasilkan Go atau TypeScript.",
};

const sections = [
  ["mulai", "Mulai cepat"],
  ["url", "URL dan token"],
  ["event-type", "Tipe event"],
  ["inferensi", "Cara inferensi bekerja"],
  ["batas", "Batas dan retensi"],
  ["output", "Kode yang dihasilkan"],
  ["keamanan", "Keamanan dan data"],
] as const;

const quickstart = `curl -X POST https://your-host/api/h/<token> \\
  -H 'content-type: application/json' \\
  -H 'x-event-type: payment.succeeded' \\
  -d '{"id":"evt_1","amount":12000,"currency":"USD"}'`;

const goExample = `// fishook · payment.succeeded · 2 samples
type PaymentSucceeded struct {
    ID       string  \`json:"id"\`
    Amount   int64   \`json:"amount"\`
    Coupon   *string \`json:"coupon,omitempty"\` // nullable
    Refunded *bool   \`json:"refunded,omitempty"\` // optional, 1/2
}`;

const tsExample = `// fishook · payment.succeeded · 2 samples
export interface PaymentSucceeded {
  id: string;
  amount: number;
  coupon?: string | null; // nullable
  refunded?: boolean; // optional, 1/2
}`;

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[24px] font-semibold leading-8 tracking-[-0.01em] text-text-1">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-[15px] font-medium leading-6 text-text-1">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-[68ch] text-[13px] leading-[22px] text-text-2">{children}</p>;
}

function Code({ code, lang }: { code: string; lang: "go" | "ts" | "json" }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface-0">
      <CodeBlock code={code} lang={lang} />
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-dvh bg-surface-0">
      <SiteNav github={site.github} />

      <main id="main" lang="id" className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,680px)] xl:grid-cols-[200px_minmax(0,680px)_180px] xl:gap-12">
          <nav aria-label="Docs" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="fk-micro text-text-3">Docs</p>
              <ul className="mt-3 flex flex-col gap-1">
                {sections.map(([id, label]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="block rounded-sm py-1 text-[12px] leading-[18px] text-text-2 hover:text-text-1"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="min-w-0">
            <header>
              <p className="fk-micro text-text-3">fishook docs</p>
              <h1 className="fk-display mt-2 max-w-[20ch] text-text-1">
                Dari payload yang masuk ke tipe yang bisa dipakai.
              </h1>
              <p className="mt-3 max-w-[60ch] text-[14px] leading-[22px] text-text-2">
                fishook adalah receiver webhook. Dia menyimpan body apa adanya, menghitung skema
                per event type dari semua sampel, lalu menghasilkan Go atau TypeScript. Tidak ada
                spec yang diimpor dan tidak ada payload yang diteruskan ke API kamu.
              </p>
            </header>

            <nav aria-label="Daftar isi" className="mt-6 rounded-lg border border-line bg-surface-1 p-3 lg:hidden">
              <p className="fk-micro text-text-3">Daftar isi</p>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {sections.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-[12px] leading-[18px] text-text-2">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <section id="mulai" className="mt-10 scroll-mt-24 border-t border-divider pt-10">
              <H2>Mulai cepat</H2>
              <ol className="mt-4 flex flex-col gap-3">
                {[
                  "Buka /app. Satu endpoint dibuat untuk browser ini, tanpa akun.",
                  "Salin webhook URL dari bar di atas stream.",
                  "Kirim satu event dari sandbox provider, atau pakai curl di bawah.",
                  "Pilih event type di panel Generate, lalu salin atau unduh filenya.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="fk-mono-data fk-nums mt-0.5 text-[11px] leading-4 text-primary">
                      0{index + 1}
                    </span>
                    <span className="text-[13px] leading-[20px] text-text-1">{step}</span>
                  </li>
                ))}
              </ol>
              <Code code={quickstart} lang="json" />
              <P>
                Respons sukses adalah <code className="fk-mono-data text-text-1">202</code> dengan
                header <code className="fk-mono-data text-text-1">X-Fishook-Seq</code>. Seq adalah
                urutan global, bukan urutan per endpoint. Baris baru muncul di stream lewat
                server-sent events dalam sekitar satu detik.
              </P>
            </section>

            <section id="url" className="mt-10 scroll-mt-24 border-t border-divider pt-10">
              <H2>URL dan token</H2>
              <P>
                Ada dua kredensial dengan hak yang berbeda. Token tulis ada di URL webhook dan
                hanya bisa menulis. Cookie baca disimpan oleh browser dan hanya bisa membaca.
                Database tidak menyimpan token asli, hanya SHA-256 dan empat karakter terakhir.
              </P>
              <div className="mt-4 overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
                  <thead className="bg-surface-1 text-text-3">
                    <tr>
                      <th className="px-3 py-2 font-medium">Kredensial</th>
                      <th className="px-3 py-2 font-medium">Bentuk</th>
                      <th className="px-3 py-2 font-medium">Hak</th>
                      <th className="px-3 py-2 font-medium">Umur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider text-text-2">
                    <tr>
                      <td className="px-3 py-2 text-text-1">Token webhook</td>
                      <td className="fk-mono-data px-3 py-2">16 byte, base64url</td>
                      <td className="px-3 py-2">tulis</td>
                      <td className="px-3 py-2">sampai dirotasi</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-text-1">Cookie baca</td>
                      <td className="fk-mono-data px-3 py-2">endpoint_id + token + HMAC</td>
                      <td className="px-3 py-2">baca</td>
                      <td className="px-3 py-2">1 tahun, sliding</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <P>
                Cookie juga membawa token tulis di dalam payload yang ditandatangani, supaya URL
                webhook bisa ditampilkan lagi saat kamu kembali. Jangan bagikan cookie ini; cookie
                yang bocor setara dengan URL yang bocor. Karena itu rotasi URL tetap berguna.
              </P>
              <H3>Rotasi</H3>
              <P>
                Rotate URL membuat token baru dan langsung mematikan URL lama. Payload yang sudah
                masuk tetap ada, dan cookie tidak berubah, jadi kamu tidak ter-logout. URL lama
                yang sudah terlanjur masuk access log hosting sebaiknya dianggap bocor setelah
                rotasi.
              </P>
              <H3>Tanpa akun</H3>
              <P>
                Endpoint hidup selama cookie browser masih ada. Menghapus cookie atau memakai
                browser lain berarti memulai endpoint baru. Hapus endpoint dari menu di header
                kalau ingin menghapus payload dan model sekaligus.
              </P>
            </section>

            <section id="event-type" className="mt-10 scroll-mt-24 border-t border-divider pt-10">
              <H2>Tipe event</H2>
              <P>
                Event type dipakai sebagai kunci pengelompokan sampel. Urutan pembacaannya:
              </P>
              <ol className="mt-3 flex flex-col gap-1.5 text-[13px] leading-[20px] text-text-2">
                {[
                  "Header x-github-event",
                  "Header x-event-type",
                  "Header x-webhook-event",
                  "Root body: type, event, event_type, lalu action",
                  "Tidak ada yang cocok: _unknown",
                ].map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <span className="fk-mono-data fk-nums text-[11px] leading-5 text-text-3">
                      {index + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
              <P>
                Nilai dipotong di 120 karakter. inferensi berjalan per event type, bukan per
                endpoint. Dua event dengan bentuk berbeda tidak saling mengotori kalau event
                type-nya berbeda.
              </P>
            </section>

            <section id="inferensi" className="mt-10 scroll-mt-24 border-t border-divider pt-10">
              <H2>Cara inferensi bekerja</H2>
              <P>
                Setiap kali event baru masuk, fishook menghitung ulang skema untuk event type itu
                dari semua sampel yang masih tersimpan. Hasilnya idempoten dan ditulis sebagai
                upsert. Tidak ada version dan tidak ada migrasi skema.
              </P>
              <div className="mt-4 overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
                  <thead className="bg-surface-1 text-text-3">
                    <tr>
                      <th className="px-3 py-2 font-medium">Kasus</th>
                      <th className="px-3 py-2 font-medium">Hasil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider text-text-2">
                    {[
                      ["Field ada di semua sampel", "required"],
                      ["Field hilang di sebagian sampel", "optional"],
                      ["Field bernilai null di sebagian sampel", "nullable"],
                      ["int + float", "float, bukan conflict"],
                      ["Tipe lain bentrok", "conflict, escape hatch di output"],
                      ["Array kosong", "elemen unknown, diberi catatan"],
                      ["Angka di atas 2^53", "precision risk, diberi catatan"],
                      ["Object lebih dalam dari 8 level", "berhenti, tidak menebak"],
                    ].map(([term, detail]) => (
                      <tr key={term}>
                        <td className="px-3 py-2 text-text-1">{term}</td>
                        <td className="px-3 py-2">{detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <H3>Satu sampel</H3>
              <P>
                Dengan satu sampel, semua field terlihat required. Itu bukan bukti. Panel kode
                menampilkan banner, dan file hasil generate memuat komentar yang sama. Kirim
                minimal dua payload dengan bentuk berbeda sebelum memakai tipenya.
              </P>
              <H3>Duplikat</H3>
              <P>
                Provider sering mengirim ulang event yang sama. fishook menyimpannya, menandainya{" "}
                <code className="fk-mono-data text-text-1">dup</code>, dan menautkannya ke event
                asal. Duplikat tidak dibuang karena perilaku retry provider justru perlu dilihat.
                Provider event id dibaca dari header x-github-delivery, x-event-id, x-webhook-id,
                x-request-id, lalu root event_id atau id.
              </P>
              <H3>Root yang tidak didukung</H3>
              <P>
                Root object menjadi sumber skema. Root array disimpan dan elemennya diinferensi,
                tetapi UI memberi catatan bahwa root bukan object. Root scalar disimpan mentah
                dan tidak masuk skema.
              </P>
            </section>

            <section id="batas" className="mt-10 scroll-mt-24 border-t border-divider pt-10">
              <H2>Batas dan retensi</H2>
              <div className="mt-4 overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[480px] border-collapse text-left text-[12px]">
                  <tbody className="divide-y divide-divider">
                    {[
                      ["Body", "256 KB, dicek dari Content-Length dan jumlah byte saat dibaca"],
                      ["Rate limit", "60 request per menit per token"],
                      ["Token tidak dikenal", "20 request per menit per IP"],
                      ["Event per endpoint", "2.000. Event ke-2001 menghapus yang tertua"],
                      ["Retensi", "72 jam, dihapus oleh job berkala"],
                      ["Endpoint", "Tidak kedaluwarsa sampai dihapus"],
                    ].map(([term, detail]) => (
                      <tr key={term}>
                        <td className="w-[160px] px-3 py-2 text-text-3">{term}</td>
                        <td className="px-3 py-2 text-text-1">{detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <P>
                Payload yang ditolak karena terlalu besar atau rate limit tidak disimpan, tetapi
                dihitung di menu endpoint sebagai rejected request dalam satu jam terakhir.
              </P>
            </section>

            <section id="output" className="mt-10 scroll-mt-24 border-t border-divider pt-10">
              <H2>Kode yang dihasilkan</H2>
              <P>
                Nama model diambil dari event type: payment.succeeded menjadi PaymentSucceeded,
                dan _unknown menjadi UnknownEvent. Key asli selalu dipakai sebagai tag JSON atau
                nama properti. Nama yang bukan identifier disanitasi di nama field, bukan di tag.
              </P>
              <Code code={goExample} lang="go" />
              <Code code={tsExample} lang="ts" />
              <P>
                Go memakai int64 untuk integer dan float64 untuk float. TypeScript memakai number
                untuk keduanya. Field conflict memakai json.RawMessage di Go dan union di
                TypeScript. Go tidak bisa membedakan field yang hilang dari field yang bernilai
                null dengan *T, dan batas itu ditulis di komentar file.
              </P>
              <P>
                Download menghasilkan file .go atau .ts. File Go menyertakan komentar{" "}
                <code className="fk-mono-data text-text-1">import &quot;encoding/json&quot;</code>{" "}
                kalau ada json.RawMessage. Keduanya tetap perlu direview sebelum dipakai.
              </P>
            </section>

            <section id="keamanan" className="mt-10 scroll-mt-24 border-t border-divider pt-10">
              <H2>Keamanan dan data</H2>
              <P>
                Token tulis ada di path URL, jadi hosting access log bisa melihatnya. fishook
                tidak mengirim path itu ke analytics. Kalau log bocor, rotate URL dan URL lama
                langsung mati.
              </P>
              <P>
                Header authorization, cookie, set-cookie, dan x-api-key disamarkan di UI sampai
                kamu menekan reveal. Raw body dan headers tetap utuh di database karena keutuhan
                itu yang membuat payload bisa diperiksa. Payload dihapus setelah 72 jam, dan
                endpoint bisa dihapus kapan saja dari menu.
              </P>
              <p className="mt-4 text-[12px] leading-[18px] text-text-3">
                Detail data yang disimpan ada di{" "}
                <Link href="/privacy" className="text-text-2 underline hover:text-text-1">
                  halaman privacy
                </Link>
                .
              </p>
            </section>
          </article>

          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <p className="fk-micro text-text-3">Di halaman ini</p>
              <ul className="mt-3 flex flex-col gap-1">
                {sections.map(([id, label]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="block py-0.5 text-[11px] leading-4 text-text-3 hover:text-text-1"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
