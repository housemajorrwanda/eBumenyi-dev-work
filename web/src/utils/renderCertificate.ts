import QRCode from "qrcode";

const CANVAS_W = 1056;
const CANVAS_H = 816;

const TOKEN_KEY_MAP: Record<string, string> = {
  "cert-code":       "{{certificateCode}}",
  "date":            "{{currentDate}}",
  "course-name":     "{{courseName}}",
  "details":         "{{courseDetails}}",
  "progress":        "{{progress}}",
  "duration":        "{{courseDuration}}",
  "start-date":      "{{startDate}}",
  "end-date":        "{{endDate}}",
  "student-name":    "{{studentName}}",
  "student-code":    "{{studentCode}}",
  "instructor-name": "{{instructorName}}",
};

/**
 * Renders a Fabric.js canvas JSON to a PDF Blob URL using StaticCanvas and
 * jsPDF — fully client-side, preserving all fonts and styles exactly as
 * designed in the editor.
 *
 * @param canvasJson  Stored Fabric.js canvas JSON from the template
 * @param tokenValues Map of {{token}} keys to their replacement values
 * @param certId      Certificate UUID used to generate the QR code URL
 * @returns           Blob URL string pointing to the rendered PDF
 */
export async function renderCertificateFromCanvas(
  canvasJson: unknown,
  tokenValues: Record<string, string>,
  certId: string,
): Promise<string> {
  const verifyUrl = `${window.location.origin}/verify/${certId}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1 });

  const cloned = JSON.parse(JSON.stringify(canvasJson)) as {
    objects?: Record<string, unknown>[];
    [key: string]: unknown;
  };

  for (const obj of cloned.objects ?? []) {
    const tokenKey = obj.tokenKey as string | undefined;
    const token    = obj.token    as string | undefined;

    if (tokenKey === "qr") {
      obj.src = qrDataUrl;
      continue;
    }

    const value =
      (token    ? tokenValues[token]                                  : undefined) ??
      (tokenKey ? tokenValues[TOKEN_KEY_MAP[tokenKey] ?? ""] : undefined);

    if (value !== undefined) {
      obj.text = value;
    }
  }

  const { StaticCanvas } = await import("fabric");
  const el = document.createElement("canvas");
  document.body.appendChild(el);

  const tmp = new StaticCanvas(el, { width: CANVAS_W, height: CANVAS_H });
  await tmp.loadFromJSON(cloned);
  tmp.setZoom(1);
  tmp.setDimensions({ width: CANVAS_W, height: CANVAS_H });
  tmp.renderAll();

  const pngDataUrl = tmp.toDataURL({ format: "png", multiplier: 2 });
  tmp.dispose();
  document.body.removeChild(el);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [CANVAS_W, CANVAS_H],
  });
  pdf.addImage(pngDataUrl, "PNG", 0, 0, CANVAS_W, CANVAS_H);

  const blob = pdf.output("blob");
  return URL.createObjectURL(blob);
}

/**
 * Same as renderCertificateFromCanvas but returns a base64 data URI string
 * suitable for sending to the backend (store-pdf endpoint).
 */
export async function renderCertificateToBase64(
  canvasJson: unknown,
  tokenValues: Record<string, string>,
  certId: string,
): Promise<string> {
  const verifyUrl = `${window.location.origin}/verify/${certId}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1 });

  const cloned = JSON.parse(JSON.stringify(canvasJson)) as {
    objects?: Record<string, unknown>[];
    [key: string]: unknown;
  };

  for (const obj of cloned.objects ?? []) {
    const tokenKey = obj.tokenKey as string | undefined;
    const token    = obj.token    as string | undefined;

    if (tokenKey === "qr") {
      obj.src = qrDataUrl;
      continue;
    }

    const value =
      (token    ? tokenValues[token]                                  : undefined) ??
      (tokenKey ? tokenValues[TOKEN_KEY_MAP[tokenKey] ?? ""] : undefined);

    if (value !== undefined) {
      obj.text = value;
    }
  }

  const { StaticCanvas } = await import("fabric");
  const el = document.createElement("canvas");
  document.body.appendChild(el);

  const tmp = new StaticCanvas(el, { width: CANVAS_W, height: CANVAS_H });
  await tmp.loadFromJSON(cloned);
  tmp.setZoom(1);
  tmp.setDimensions({ width: CANVAS_W, height: CANVAS_H });
  tmp.renderAll();

  const pngDataUrl = tmp.toDataURL({ format: "png", multiplier: 2 });
  tmp.dispose();
  document.body.removeChild(el);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [CANVAS_W, CANVAS_H],
  });
  pdf.addImage(pngDataUrl, "PNG", 0, 0, CANVAS_W, CANVAS_H);

  return pdf.output("datauristring");
}
