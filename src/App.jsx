import React, { useState, useRef } from "react";

const API        = "http://localhost:5000";
const PYTHON_API = "http://localhost:8000";

// ── Unique colour per class name ──────────────────────────────
const CLASS_COLORS = {};
const PALETTE = [
  "#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6",
  "#f97316","#06b6d4","#ec4899","#84cc16","#14b8a6"
];
function colorForClass(cls) {
  if (!CLASS_COLORS[cls]) {
    const idx = Object.keys(CLASS_COLORS).length % PALETTE.length;
    CLASS_COLORS[cls] = PALETTE[idx];
  }
  return CLASS_COLORS[cls];
}

// ── SVG Bounding Box Overlay ──────────────────────────────────
// Draws boxes scaled to the rendered <img> size using original image dimensions.
function BBoxOverlay({ detections, imageWidth, imageHeight }) {
  if (!detections || detections.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      {detections.map((det, i) => {
        if (!det.bbox || det.bbox.length < 4) return null;
        const [x1, y1, x2, y2] = det.bbox;
        const w     = x2 - x1;
        const h     = y2 - y1;
        const color = colorForClass(det.class);
        const label = `${det.class} ${Math.round((det.confidence || 0) * 100)}%`;

        // Font size relative to image size so it scales properly
        const fontSize  = Math.max(imageHeight * 0.025, 10);
        const padX      = fontSize * 0.4;
        const padY      = fontSize * 0.3;
        const labelW    = label.length * fontSize * 0.6 + padX * 2;
        const labelH    = fontSize + padY * 2;
        const labelY    = y1 - labelH < 0 ? y2 : y1 - labelH;

        return (
          <g key={i}>
            {/* Bounding box rect */}
            <rect
              x={x1} y={y1} width={w} height={h}
              fill="none"
              stroke={color}
              strokeWidth={Math.max(imageWidth * 0.003, 2)}
              rx="3"
            />
            {/* Corner accents — top-left */}
            <line x1={x1} y1={y1 + h * 0.15} x2={x1} y2={y1} stroke={color} strokeWidth={Math.max(imageWidth * 0.005, 3)} />
            <line x1={x1} y1={y1} x2={x1 + w * 0.15} y2={y1} stroke={color} strokeWidth={Math.max(imageWidth * 0.005, 3)} />
            {/* Corner accents — bottom-right */}
            <line x1={x2} y1={y2 - h * 0.15} x2={x2} y2={y2} stroke={color} strokeWidth={Math.max(imageWidth * 0.005, 3)} />
            <line x1={x2} y1={y2} x2={x2 - w * 0.15} y2={y2} stroke={color} strokeWidth={Math.max(imageWidth * 0.005, 3)} />
            {/* Label background */}
            <rect
              x={x1} y={labelY}
              width={labelW} height={labelH}
              fill={color}
              rx="3"
            />
            {/* Label text */}
            <text
              x={x1 + padX}
              y={labelY + padY + fontSize * 0.8}
              fontSize={fontSize}
              fontFamily="monospace"
              fontWeight="bold"
              fill="white"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Single Crop Box Overlay (object mode) ─────────────────────
function CropBBoxOverlay({ bbox, detectionClass, detectionConf, imageWidth, imageHeight }) {
  if (!bbox || bbox.length < 4) return null;

  const det = {
    bbox,
    class:      detectionClass,
    confidence: detectionConf
  };

  return (
    <BBoxOverlay
      detections={[det]}
      imageWidth={imageWidth}
      imageHeight={imageHeight}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────

export default function App() {
  const [text, setText]               = useState("");
  const [searchImage, setSearchImage] = useState(null);
  const [results, setResults]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [message, setMessage]         = useState("");
  const [searched, setSearched]       = useState(false);
  const [threshold, setThreshold]     = useState(70);
  const [mode, setMode]               = useState("full");
  const [uploadPreview, setUploadPreview] = useState(null);

  const uploadInputRef = useRef(null);

  // ── Upload → calls Python /detect ──────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setUploading(true);
      setMessage("🔍 Running YOLO detection + SigLIP embedding...");
      setUploadPreview(null);

      const response = await fetch(`${API}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(
          `✅ Stored! Found ${data.total_detections} object${data.total_detections !== 1 ? "s" : ""} — full image + crop embeddings saved.`
        );
        if (data.annotated_url) setUploadPreview(data.annotated_url);
      } else {
        setMessage(`❌ ${data.error || "Upload failed."}`);
      }
    } catch {
      setMessage("❌ Network error.");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  // ── Search ─────────────────────────────────────────────────
  const handleSearch = async (e) => {
    e.preventDefault();

    const hasText  = text.trim().length > 0;
    const hasImage = !!searchImage;

    if (!hasText && !hasImage) {
      setMessage("❌ Enter text or select a reference image.");
      return;
    }

    setLoading(true);
    setMessage("");
    setResults([]);

    const formData = new FormData();
    if (hasText)  formData.append("text", text.trim());
    if (hasImage) formData.append("image", searchImage);
    formData.append("threshold", threshold);
    formData.append("mode", hasImage ? "full" : mode);

    try {
      const response = await fetch(`${API}/search`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed.");

      setResults(data.results || data);
      setSearched(true);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Image src helper ───────────────────────────────────────
  const getImageSrc = (item) => {
    if (item.type === "crop" && item.cropImage) {
      return `${PYTHON_API}/${item.cropImage.replace(/\\/g, "/")}`;
    }
    return `${PYTHON_API}/${item.imagePath.replace(/\\/g, "/")}`;
  };

  const activeMode = searchImage ? "full" : mode;

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#f0f6fc] font-sans selection:bg-blue-500/30">

      {/* ── SIDEBAR ────────────────────────────────────────────── */}
      <aside className="w-80 bg-[#161b22] border-r border-[#30363d] p-8 flex flex-col gap-8 overflow-y-auto">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-600/20">
            S2
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">SigLIP Studio</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#8b949e] font-semibold">
              Vector Engine
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <h3 className="text-xs uppercase tracking-wider text-[#8b949e] font-bold">
            Search Parameters
          </h3>

          <form onSubmit={handleSearch} className="space-y-5">

            {/* Mode toggle */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#f0f6fc]">Search Mode</label>
              <div className="flex rounded-lg overflow-hidden border border-[#30363d] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode("full")}
                  className={`flex-1 py-2.5 transition-all ${
                    mode === "full"
                      ? "bg-blue-600 text-white"
                      : "bg-[#0d1117] text-[#8b949e] hover:text-white"
                  }`}
                >
                  🖼 Full Image
                </button>
                <button
                  type="button"
                  onClick={() => setMode("object")}
                  disabled={!!searchImage}
                  className={`flex-1 py-2.5 transition-all ${
                    mode === "object" && !searchImage
                      ? "bg-purple-600 text-white"
                      : "bg-[#0d1117] text-[#8b949e] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  🔍 Object
                </button>
              </div>
              <p className="text-[10px] text-[#8b949e] leading-relaxed">
                {searchImage
                  ? "Image search always uses Full Image mode."
                  : mode === "full"
                  ? "Scene search — e.g. \"people walking on road\""
                  : "Object search — e.g. \"blue bag\", \"red car\""}
              </p>
            </div>

            {/* Text query */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Text Query</label>
              <input
                type="text"
                placeholder={mode === "object" ? "e.g. blue bag..." : "e.g. people walking..."}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {/* Image reference */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Image Reference</label>
              <input
                type="file"
                accept="image/*"
                className="w-full text-xs text-[#8b949e] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600/10 file:text-blue-500 hover:file:bg-blue-600/20 cursor-pointer"
                onChange={(e) => {
                  setSearchImage(e.target.files[0]);
                  if (e.target.files[0]) setMode("full");
                }}
              />
              {searchImage && (
                <p className="text-[10px] text-yellow-400">⚡ Image selected — mode locked to Full Image</p>
              )}
            </div>

            {/* Threshold */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[13px] font-medium">Confidence Threshold</label>
                <span className="text-sm font-black text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md">
                  {threshold}%
                </span>
              </div>
              <input
                type="range" min={0} max={100} step={1} value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500 bg-[#30363d]"
              />
              <div className="flex justify-between text-[10px] text-[#8b949e]">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold py-3 rounded-lg text-sm transition-all shadow-lg shadow-blue-600/10 active:scale-[0.98]"
            >
              {loading ? "Analyzing Vectors..." : "Run Search"}
            </button>
          </form>
        </div>

        {/* Upload & Detect */}
        <div className="mt-auto p-5 rounded-2xl bg-blue-600/5 border border-blue-500/20 group hover:border-blue-500/40 transition-colors">
          <h4 className="text-sm font-semibold mb-1">New Data Entry</h4>
          <p className="text-[11px] text-[#8b949e] leading-relaxed mb-3">
            YOLO detects objects → SigLIP embeds full image + each crop → saved to MongoDB.
          </p>

          {uploadPreview && (
            <div className="mb-3 rounded-lg overflow-hidden border border-blue-500/30">
              <img src={uploadPreview} alt="YOLO annotated" className="w-full object-cover" />
              <p className="text-[10px] text-center text-[#8b949e] py-1 bg-black/30">
                YOLO Detection Preview
              </p>
            </div>
          )}

          <input
            ref={uploadInputRef}
            type="file" id="idx-upload" accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <label
            htmlFor="idx-upload"
            className="block text-center border border-blue-600/40 text-blue-500 py-2 rounded-lg cursor-pointer font-bold text-xs hover:bg-blue-600 hover:text-white transition-all"
          >
            {uploading ? "Detecting & Embedding..." : "Upload & Detect"}
          </label>

          {message && (
            <p className="text-[10px] text-center mt-3 font-medium leading-relaxed">{message}</p>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-end border-b border-[#30363d] pb-8 mb-10">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Semantic Matches</h2>
            <p className="text-[#8b949e] text-sm mt-1">
              {activeMode === "object"
                ? "Object-level crop matches from YOLO detections."
                : "Full scene similarity results from vector search."}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {searched && text.trim() && searchImage && (
              <div className="px-3 py-1.5 bg-purple-600/10 rounded-full border border-purple-500/30 text-xs font-bold text-purple-400">
                AND mode
              </div>
            )}
            {searched && (
              <div className={`px-3 py-1.5 rounded-full border text-xs font-bold ${
                activeMode === "object"
                  ? "bg-purple-600/10 border-purple-500/30 text-purple-400"
                  : "bg-blue-600/10 border-blue-500/30 text-blue-400"
              }`}>
                {activeMode === "object" ? "🔍 Object Mode" : "🖼 Full Image Mode"}
              </div>
            )}
            {searched && (
              <div className="px-3 py-1.5 bg-blue-600/10 rounded-full border border-blue-500/30 text-xs font-bold text-blue-400">
                ≥ {threshold}% threshold
              </div>
            )}
            <div className="px-4 py-1.5 bg-[#21262d] rounded-full border border-[#30363d] text-sm font-bold shadow-sm">
              {results.length} <span className="text-[#8b949e] font-normal">Items found</span>
            </div>
          </div>
        </header>

        {results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {results.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#21262d] rounded-2xl border border-[#30363d] overflow-hidden group hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/5"
              >
                {/* ── Image + SVG overlay ───────────────────── */}
                <div className="relative aspect-video overflow-hidden bg-black">
                  <img
                    src={getImageSrc(item)}
                    alt="Result"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Full image mode — draw ALL detection boxes */}
                  {item.type === "full" && item.detections?.length > 0 && (
                    <BBoxOverlay
                      detections={item.detections}
                      imageWidth={item.imageWidth}
                      imageHeight={item.imageHeight}
                    />
                  )}

                  {/* Mode badge */}
                  <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/10 text-[10px] font-bold tracking-widest text-white uppercase">
                    {item.type === "crop" ? "🔍 Crop" : "🖼 Full"}
                  </div>
                </div>

                {/* ── Card info ─────────────────────────────── */}
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-[#8b949e] font-bold uppercase tracking-wider">
                      Confidence
                    </span>
                    <span className="text-sm font-black text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
                      {item.confidence}%
                    </span>
                  </div>

                  {/* Detection count for full mode */}
                  {item.type === "full" && item.detections?.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#8b949e] font-bold uppercase tracking-wider">
                        Objects
                      </span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {[...new Set(item.detections.map(d => d.class))].map((cls, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: colorForClass(cls) + "22",
                              color: colorForClass(cls),
                              border: `1px solid ${colorForClass(cls)}44`
                            }}
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Crop info for object mode */}
                  {item.type === "crop" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#8b949e] font-bold uppercase tracking-wider">
                          Class
                        </span>
                        <span
                          className="text-[11px] font-bold px-2 py-1 rounded-md capitalize"
                          style={{
                            backgroundColor: colorForClass(item.detectionClass) + "22",
                            color: colorForClass(item.detectionClass),
                            border: `1px solid ${colorForClass(item.detectionClass)}44`
                          }}
                        >
                          {item.detectionClass}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#8b949e] font-bold uppercase tracking-wider">
                          YOLO Conf
                        </span>
                        <span className="text-[11px] font-bold text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">
                          {Math.round((item.detectionConf || 0) * 100)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8b949e] truncate pt-1 border-t border-[#30363d]">
                        📁 {item.imagePath?.split("/").pop()}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-40">
            <div className="text-7xl mb-6 grayscale animate-pulse">
              {mode === "object" ? "🔍" : "📡"}
            </div>
            <h3 className="text-xl font-bold">
              {searched ? `No matches found above ${threshold}% threshold` : "Waiting for Vector Query"}
            </h3>
            <p className="text-sm max-w-xs mt-2 leading-relaxed">
              {searched
                ? "Try lowering the threshold or switching search mode."
                : mode === "object"
                ? "Switch to Object mode and search for specific items like \"blue bag\"."
                : "Adjust filters or upload a reference image to scan your database."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}