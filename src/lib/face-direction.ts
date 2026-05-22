/**
 * Detecção da direcção facial com MediaPipe FaceLandmarker.
 *
 * Porquê FaceLandmarker (e não FaceDetector/BlazeFace): o BlazeFace
 * short-range falha em fotos de corpo inteiro / cara pequena no frame
 * (típico de fotos de jogadores) → devolvia sempre 0 caras → "unknown"
 * → parecia que a IA não fazia nada. O FaceLandmarker é bem mais robusto.
 *
 * Heurística de direcção: posição horizontal da ponta do nariz vs o ponto
 * médio entre os cantos externos dos olhos, escalada pela distância entre
 * olhos (≈ largura da cara). Índices canónicos do face mesh:
 *   1   ponta do nariz
 *   33  canto externo olho direito (do sujeito)
 *   263 canto externo olho esquerdo
 */
export type Facing = "left" | "right" | "unknown";

export interface FacingResult {
  facing: Facing | "error";
  /** Texto curto para mostrar ao operador (diagnóstico). */
  detail: string;
}

// Versão fixa = versão instalada. CDN sem versão quebra a ABI WASM↔modelo.
const VER = "0.10.35";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise:
  | Promise<import("@mediapipe/tasks-vision").FaceLandmarker>
  | null = null;

async function getLandmarker() {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const { FilesetResolver, FaceLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const vision = await FilesetResolver.forVisionTasks(WASM);
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })();
  return landmarkerPromise;
}

function loadBitmap(src: Blob | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem inválida"));
    };
    img.src = url;
  });
}

export async function detectFacing(src: Blob | File): Promise<FacingResult> {
  let landmarker: import("@mediapipe/tasks-vision").FaceLandmarker;
  try {
    landmarker = await getLandmarker();
  } catch (e) {
    landmarkerPromise = null; // permite retry numa próxima foto
    return {
      facing: "error",
      detail:
        "IA não carregou o modelo (sem internet no PC?) — usa o modo Manual. " +
        (e instanceof Error ? e.message : ""),
    };
  }

  let img: HTMLImageElement;
  try {
    img = await loadBitmap(src);
  } catch {
    return { facing: "error", detail: "Falha a abrir a imagem." };
  }

  let res: import("@mediapipe/tasks-vision").FaceLandmarkerResult;
  try {
    res = landmarker.detect(img);
  } catch (e) {
    return {
      facing: "error",
      detail: "Erro na detecção: " + (e instanceof Error ? e.message : ""),
    };
  }

  const lm = res.faceLandmarks?.[0];
  if (!lm || lm.length < 264) {
    return {
      facing: "unknown",
      detail: "IA não encontrou cara nesta foto (frontal/longe?).",
    };
  }

  const nose = lm[1];
  const eyeR = lm[33];
  const eyeL = lm[263];
  const eyesMidX = (eyeR.x + eyeL.x) / 2;
  const eyeSpan = Math.abs(eyeL.x - eyeR.x) || 0.0001;
  const offset = (nose.x - eyesMidX) / eyeSpan;

  const TH = 0.12;
  const pct = Math.round(offset * 100);
  if (offset > TH) {
    return { facing: "right", detail: `Virado à DIREITA (offset ${pct}%).` };
  }
  if (offset < -TH) {
    return { facing: "left", detail: `Virado à ESQUERDA (offset ${pct}%).` };
  }
  return {
    facing: "unknown",
    detail: `Quase frontal (offset ${pct}%) — confirma manualmente.`,
  };
}
