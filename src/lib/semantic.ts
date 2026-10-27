// Optional, experimental: on-device neural grading of free-text answers.
// Loads a small multilingual sentence-embedding model (~120 MB, downloaded
// once and cached by the browser) and compares the learner's answer with the
// model answer by meaning, so paraphrases that miss the exact keywords still
// get credit. Nothing is sent to a server; it runs in the browser (WASM).

const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

let loading: Promise<Extractor> | null = null;
let ready = false;

export function semanticReady(): boolean {
  return ready;
}

export function loadSemantic(onProgress?: (pct: number) => void): Promise<Extractor> {
  if (loading) return loading;
  loading = (async () => {
    const lib = await import(/* @vite-ignore */ LIB_URL);
    lib.env.allowLocalModels = false;
    const files = new Map<string, { loaded: number; total: number }>();
    const extractor = await lib.pipeline('feature-extraction', MODEL, {
      dtype: 'q8',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === 'progress' && p.file && p.total) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          let loaded = 0;
          let total = 0;
          files.forEach((f) => {
            loaded += f.loaded;
            total += f.total;
          });
          onProgress?.(total ? Math.round((loaded / total) * 100) : 0);
        }
      },
    });
    ready = true;
    return extractor as Extractor;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** Cosine similarity of two texts' meaning (0..1). */
export async function similarity(a: string, b: string): Promise<number> {
  const ex = await loadSemantic();
  const out = await ex([a, b], { pooling: 'mean', normalize: true });
  const [v1, v2] = out.tolist();
  let dot = 0;
  for (let i = 0; i < v1.length; i++) dot += v1[i] * v2[i];
  return Math.max(0, Math.min(1, dot));
}

/** Map raw similarity to a 0..1 grade (paraphrases typically score > 0.75). */
export function similarityToScore(sim: number): number {
  return Math.max(0, Math.min(1, (sim - 0.45) / 0.35));
}
