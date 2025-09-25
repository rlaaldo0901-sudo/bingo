import React, { useEffect, useMemo, useState } from "react";

/* ================= QR: 라이브러리 없으면 이미지 백업 ================= */
function QRCodeBox({ value, size = 160 }: { value: string; size?: number }) {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const mod: any = await import("qrcode.react");
        const C = mod?.QRCodeCanvas || mod?.QRCodeSVG || null;
        if (ok) setComp(() => C);
      } catch {
        if (ok) setComp(null);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);
  if (Comp) return <Comp value={value} size={size} includeMargin />;
  const src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    value
  )}&size=${size}x${size}`;
  return <img alt="QR" src={src} width={size} height={size} />;
}

/* ================= Types & Const ================= */
type Cats = Record<string, string[]>;
type Config = {
  cats: Cats;
  size: number;
  lines: number;
  ord?: string[];
  updatedAt?: string;
  error?: string;
};
type Settings = { dataUrl: string }; // 항상 고정 모드

const SIZE = 4;
const REQUIRED_LINES = 3;

const LS_CATS = "bingo_cats_v1";
const LS_DRAFTS = "bingo_drafts_v1";
const LS_ORDER = "bingo_order_v1";
const LS_SETTINGS = "bingo_settings_v1";

/* ================= Utils ================= */
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitWords(text: string): string[] {
  // 쉼표/줄바꿈으로 분리 (스페이스 허용, 정규식 한 줄!)
  return text
    .split(/[\n,\r]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function generateCard(words: string[]): string[][] {
  const need = SIZE * SIZE;
  if (words.length < need)
    throw new Error(
      `단어 풀이 부족합니다. (필요: ${need}, 제공: ${words.length})`
    );
  const pick = shuffle(words).slice(0, need);
  const g: string[][] = [];
  let k = 0;
  for (let r = 0; r < SIZE; r++) {
    const row: string[] = [];
    for (let c = 0; c < SIZE; c++) row.push(pick[k++]);
    g.push(row);
  }
  return g;
}

function countLines(m: boolean[][]) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) if (m[r].every(Boolean)) n++;
  for (let c = 0; c < SIZE; c++) {
    let ok = true;
    for (let r = 0; r < SIZE; r++) if (!m[r][c]) ok = false;
    if (ok) n++;
  }
  let d1 = true,
    d2 = true;
  for (let i = 0; i < SIZE; i++) {
    if (!m[i][i]) d1 = false;
    if (!m[i][SIZE - 1 - i]) d2 = false;
  }
  if (d1) n++;
  if (d2) n++;
  return n;
}

function baseUrl() {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return origin + pathname;
}
function normalizeUrl(u?: string | null) {
  const s = (u || "").trim();
  if (!s) return "";
  try {
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//"))
      return (
        (typeof window !== "undefined" ? window.location.protocol : "https:") +
        s
      );
    if (typeof window !== "undefined")
      return new URL(s, window.location.origin).href;
    return s;
  } catch {
    return s;
  }
}

function getParams() {
  const q = window.location.search;
  const h = window.location.hash;
  const u = new URLSearchParams(q.startsWith("?") ? q.slice(1) : q);
  if (h.includes("?")) {
    const hs = new URLSearchParams(h.split("?")[1]);
    hs.forEach((v, k) => u.set(k, v));
  }
  return u;
}
function isPlayerRoute(): boolean {
  const s = window.location.search;
  return /(?:^|[?&])view=player(?:=|&|$)/.test(s) || /(?:^|[?&])src=/.test(s);
}

/* ================= Card ================= */
function Card({ grid }: { grid: string[][] }) {
  const [m, setM] = useState<boolean[][]>(grid.map((r) => r.map(() => false)));
  useEffect(() => {
    setM(grid.map((r) => r.map(() => false)));
  }, [grid]);
  const lines = countLines(m);
  const bingo = lines >= REQUIRED_LINES;
  return (
    <div style={{ maxWidth: 480 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 6,
        }}
      >
        {grid.flatMap((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() =>
                setM((cur) =>
                  cur.map((rr, ri) =>
                    rr.map((v, ci) => (ri === r && ci === c ? !v : v))
                  )
                )
              }
              style={{
                aspectRatio: "1/1",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 8,
                background: m[r][c] ? "#dcfce7" : "#fff",
                textDecoration: m[r][c] ? "line-through" : "none",
              }}
            >
              {cell}
            </button>
          ))
        )}
      </div>
      <div style={{ marginTop: 8, textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: 999,
            background: bingo ? "#10b981" : "#e5e7eb",
            color: bingo ? "#fff" : "#374151",
            fontWeight: 600,
          }}
        >
          {bingo
            ? `BINGO! (${lines}줄)`
            : `완성 줄: ${lines} / ${REQUIRED_LINES}`}
        </span>
      </div>
    </div>
  );
}

/* ================= Player ================= */
function PlayerBase({ data }: { data: Config | null }) {
  const cats = data?.cats || {};
  const ord = Array.isArray(data?.ord)
    ? data!.ord!.filter((n) => (cats as Cats)[n])
    : null;
  const catNames = ord && ord.length ? ord : Object.keys(cats);
  const [sel, setSel] = useState<string>("");
  const [grid, setGrid] = useState<string[][] | null>(null);

  if (!data)
    return (
      <p style={{ padding: 24, color: "#ef4444" }}>
        데이터가 없습니다. (src 확인)
      </p>
    );
  if (data.error)
    return <p style={{ padding: 24, color: "#ef4444" }}>오류: {data.error}</p>;
  if (catNames.length === 0)
    return (
      <p style={{ padding: 24, color: "#ef4444" }}>cats가 비어 있습니다.</p>
    );

  const pick = (name: string) => {
    setSel(name);
    try {
      setGrid(generateCard((cats as Cats)[name] || []));
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {!sel ? (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            달빛캠프 · 카테고리 선택
          </h1>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: 8,
            }}
          >
            {catNames.map((n) => (
              <button
                key={n}
                onClick={() => pick(n)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "8px 12px",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 600 }}>{n}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  단어 {(cats as Cats)[n].length}개
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontWeight: 600 }}>{sel} BINGO</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setGrid(generateCard((cats as Cats)[sel]))}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "8px 12px",
                }}
              >
                새 카드
              </button>
              <button
                onClick={() => setSel("")}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "8px 12px",
                }}
              >
                카테고리 변경
              </button>
            </div>
          </div>
          {grid ? (
            <Card grid={grid} />
          ) : (
            <p style={{ color: "#64748b" }}>카드를 생성하세요.</p>
          )}
        </>
      )}
    </div>
  );
}

function PlayerPage() {
  const params = getParams();
  const src = normalizeUrl(params.get("src"));
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!src) {
        on &&
          setCfg({
            cats: {},
            size: SIZE,
            lines: REQUIRED_LINES,
            error: "src가 없습니다",
          });
        return;
      }
      try {
        const bust = `${src}${src.includes("?") ? "&" : "?"}_ts=${Date.now()}`;
        const res = await fetch(bust, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const txt = await res.text();
        const type = res.headers.get("content-type") || "";
        if (!/json/i.test(type) && !/^\s*\{[\s\S]*\}\s*$/.test(txt))
          throw new Error(
            "JSON이 아닌 응답입니다. Raw JSON 주소인지 확인하세요."
          );
        const json = JSON.parse(txt) as Config;
        if (!json.cats || typeof json.cats !== "object")
          throw new Error("JSON에 cats 키가 없습니다.");
        if (on) setCfg(json);
      } catch (e: any) {
        on &&
          setCfg({
            cats: {},
            size: SIZE,
            lines: REQUIRED_LINES,
            error: String(e.message || e),
          });
      }
    })();
    return () => {
      on = false;
    };
  }, [src]);

  return <PlayerBase data={cfg} />;
}

/* ================= Editor ================= */
export default function App() {
  const [cats, setCats] = useState<Cats>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  const [sel, setSel] = useState("");
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [settings, setSettings] = useState<Settings>({ dataUrl: "" });

  // load
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(LS_CATS) || "{}") as Cats;
      const d = JSON.parse(localStorage.getItem(LS_DRAFTS) || "{}") as Record<
        string,
        string
      >;
      const o = JSON.parse(localStorage.getItem(LS_ORDER) || "[]") as string[];
      const s = JSON.parse(
        localStorage.getItem(LS_SETTINGS) || "{}"
      ) as Settings;
      setCats(c);
      setDrafts(d);
      setOrder(o);
      setSettings({ dataUrl: s?.dataUrl || "" });
      setSel(Object.keys(c)[0] || "");
    } catch {}
  }, []);
  // persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_CATS, JSON.stringify(cats));
    } catch {}
  }, [cats]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_DRAFTS, JSON.stringify(drafts));
    } catch {}
  }, [drafts]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_ORDER, JSON.stringify(order));
    } catch {}
  }, [order]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // player 미리보기 라우팅
  if (typeof window !== "undefined" && isPlayerRoute()) return <PlayerPage />;

  const abs = baseUrl();
  const fixedSrc = normalizeUrl(settings.dataUrl);
  const playerLink = fixedSrc
    ? `${abs}?view=player&src=${encodeURIComponent(fixedSrc)}`
    : "";

  const names = order.length ? order : Object.keys(cats);

  function addCat() {
    const name = newCat.trim();
    if (!name) return;
    if (cats[name]) {
      alert("이미 있음");
      return;
    }
    setCats((c) => ({ ...c, [name]: [] }));
    setDrafts((d) => ({ ...d, [name]: "" }));
    setOrder((o) => [...o, name]);
    setSel(name);
    setNewCat("");
  }
  function delCat(n: string) {
    if (!confirm(`'${n}' 삭제할까요?`)) return;
    setCats((c) => {
      const x = { ...c } as any;
      delete x[n];
      return x;
    });
    setDrafts((d) => {
      const x = { ...d } as any;
      delete x[n];
      return x;
    });
    setOrder((o) => o.filter((v) => v !== n));
    setSel((s) => (s === n ? "" : s));
  }
  function move(n: string, delta: number) {
    setOrder((o) => {
      const i = o.indexOf(n);
      if (i < 0) return o;
      const ni = i + delta;
      if (ni < 0 || ni >= o.length) return o;
      const a = [...o];
      [a[i], a[ni]] = [a[ni], a[i]];
      return a;
    });
  }
  function save(n: string) {
    const words = splitWords(drafts[n] || "");
    setCats((c) => ({ ...c, [n]: words }));
    alert(`${n} 단어 ${words.length}개 저장`);
  }
  function preview(n: string) {
    try {
      setGrid(generateCard(cats[n] || []));
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 16,
        }}
      >
        {/* 사이드바 */}
        <aside
          style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}
        >
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>카테고리</h2>
          <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            {names.map((n) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "6px 8px",
                  background: sel === n ? "#0f172a" : "#fff",
                  color: sel === n ? "#fff" : "#111827",
                }}
              >
                <button
                  onClick={() => setSel(n)}
                  style={{ flex: 1, textAlign: "left" }}
                >
                  <div style={{ fontWeight: 600 }}>{n}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    단어 {cats[n]?.length || 0}개
                  </div>
                </button>
                <button onClick={() => move(n, -1)}>↑</button>
                <button onClick={() => move(n, +1)}>↓</button>
                <button onClick={() => delCat(n)} style={{ color: "#dc2626" }}>
                  삭제
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="새 카테고리"
              style={{
                flex: 1,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 8,
              }}
            />
            <button
              onClick={addCat}
              style={{
                border: 0,
                borderRadius: 12,
                padding: "8px 12px",
                background: "#10b981",
                color: "#fff",
              }}
            >
              추가
            </button>
          </div>

          {/* 배포/QR */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              배포용 링크 (고정)
            </h3>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  참여자 바로가기
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                  }}
                >
                  <QRCodeBox
                    value={
                      playerLink ||
                      "https://example.com?view=player&src=입력필요"
                    }
                  />
                </div>
                <input
                  value={playerLink}
                  readOnly
                  placeholder="(dataUrl 입력 시 자동 생성)"
                  style={{
                    width: "100%",
                    marginTop: 8,
                    fontSize: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 6,
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  편집자 링크
                </div>
                <input
                  value={baseUrl()}
                  readOnly
                  style={{
                    width: "100%",
                    fontSize: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 6,
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <h3 style={{ fontWeight: 700, fontSize: 14 }}>고정 데이터 URL</h3>
              <input
                value={settings.dataUrl}
                onChange={(e) => setSettings({ dataUrl: e.target.value })}
                placeholder="예: https://xxxxx.csb.app/bingo.json"
                style={{
                  width: "100%",
                  fontSize: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                }}
              />
              <button
                onClick={() => {
                  const body = JSON.stringify(
                    {
                      cats,
                      size: SIZE,
                      lines: REQUIRED_LINES,
                      ord: names,
                      updatedAt: new Date().toISOString(),
                    },
                    null,
                    2
                  );
                  navigator.clipboard
                    .writeText(body)
                    .then(() =>
                      alert(
                        "현재 구성을 복사했습니다. public/bingo.json에 붙여넣어 저장하세요."
                      )
                    );
                }}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "8px 12px",
                  fontSize: 12,
                }}
              >
                현재 구성 JSON 복사
              </button>
            </div>
          </div>
        </aside>

        {/* 에디터 */}
        <main
          style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h1 style={{ fontWeight: 700, fontSize: 20 }}>
              달빛캠프 · 빙고 편집자 페이지
            </h1>
            <a
              href={`${baseUrl()}?view=player&src=${encodeURIComponent(
                normalizeUrl(settings.dataUrl)
              )}`}
              target="_blank"
              rel="noreferrer"
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "8px 12px",
              }}
            >
              참여자 페이지 미리보기
            </a>
          </div>
          {!sel ? (
            <p style={{ color: "#64748b" }}>
              왼쪽에서 카테고리를 선택하거나 추가하세요.
            </p>
          ) : (
            <>
              <h2 style={{ fontWeight: 600, marginBottom: 8 }}>
                단어 입력 – {sel}
              </h2>
              <textarea
                value={drafts[sel] ?? (cats[sel]?.join(", ") || "")}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [sel]: e.target.value }))
                }
                rows={8}
                placeholder="쉼표 또는 줄바꿈으로 구분"
                style={{
                  width: "100%",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => save(sel)}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "8px 12px",
                  }}
                >
                  저장
                </button>
                <button
                  onClick={() => preview(sel)}
                  style={{
                    border: 0,
                    borderRadius: 12,
                    padding: "8px 12px",
                    background: "#10b981",
                    color: "#fff",
                  }}
                >
                  빙고 생성(미리보기)
                </button>
              </div>
              {grid && (
                <div style={{ marginTop: 12 }}>
                  <Card grid={grid} />
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => preview(sel)}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: "8px 12px",
                      }}
                    >
                      다시 섞기
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
