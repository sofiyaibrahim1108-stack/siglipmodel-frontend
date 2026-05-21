import React, { useState, useRef } from "react";

const API = "http://localhost:5000";

export default function App() {
  const [text, setText]           = useState("");
  const [searchImage, setSearchImage] = useState(null);
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage]     = useState("");
  const [searched, setSearched]   = useState(false);
  const [threshold, setThreshold] = useState(70); // Default 70%

  const uploadInputRef = useRef(null);

  // ── Upload & Vectorize ────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setUploading(true);
      setMessage("Generating embedding...");

      const response = await fetch(`${API}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) setMessage("✅ Data point added to MongoDB.");
      else setMessage(`❌ ${data.error || "Upload failed."}`);
    } catch {
      setMessage("❌ Network error.");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  // ── Search ────────────────────────────────────────────────────────────────
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
    formData.append("threshold", threshold); // ✅ Send threshold to backend

    try {
      const response = await fetch(`${API}/search`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Search failed.");

      setResults(data);
      setSearched(true);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#f0f6fc] font-sans selection:bg-blue-500/30">

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside className="w-80 bg-[#161b22] border-r border-[#30363d] p-8 flex flex-col gap-10 overflow-y-auto">

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

        {/* ── Search Parameters ─────────────────────────────────────────── */}
        <div className="space-y-6">
          <h3 className="text-xs uppercase tracking-wider text-[#8b949e] font-bold">
            Search Parameters
          </h3>

          <form onSubmit={handleSearch} className="space-y-5">

            {/* Text query */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#f0f6fc]">
                Text Query
              </label>
              <input
                type="text"
                placeholder="Describe what you're looking for..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {/* Image reference */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#f0f6fc]">
                Image Reference
              </label>
              <input
                type="file"
                accept="image/*"
                className="w-full text-xs text-[#8b949e] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600/10 file:text-blue-500 hover:file:bg-blue-600/20 cursor-pointer"
                onChange={(e) => setSearchImage(e.target.files[0])}
              />
            </div>

            {/* ✅ Confidence Threshold Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[13px] font-medium text-[#f0f6fc]">
                  Confidence Threshold
                </label>
                <span className="text-sm font-black text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md">
                  {threshold}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500 bg-[#30363d]"
              />
              <div className="flex justify-between text-[10px] text-[#8b949e]">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
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

        {/* ── Upload & Vectorize ─────────────────────────────────────────── */}
        <div className="mt-auto p-5 rounded-2xl bg-blue-600/5 border border-blue-500/20 group hover:border-blue-500/40 transition-colors">
          <h4 className="text-sm font-semibold mb-2">New Data Entry</h4>
          <p className="text-[11px] text-[#8b949e] leading-relaxed mb-4">
            Vectorize new assets into your MongoDB collection automatically.
          </p>
          <input
            ref={uploadInputRef}
            type="file"
            id="idx-upload"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <label
            htmlFor="idx-upload"
            className="block text-center border border-blue-600/40 text-blue-500 py-2 rounded-lg cursor-pointer font-bold text-xs hover:bg-blue-600 hover:text-white transition-all shadow-sm group-hover:shadow-blue-500/10"
          >
            {uploading ? "Generating Embedding..." : "Upload & Vectorize"}
          </label>
          {message && (
            <p className="text-[10px] text-center mt-3 font-medium">{message}</p>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-end border-b border-[#30363d] pb-8 mb-10">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Semantic Matches</h2>
            <p className="text-[#8b949e] text-sm mt-1">
              Cross-modal similarity results from Atlas Vector Search.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* AND mode badge */}
            {searched && text.trim() && searchImage && (
              <div className="px-3 py-1.5 bg-purple-600/10 rounded-full border border-purple-500/30 text-xs font-bold text-purple-400">
                AND mode
              </div>
            )}
            {/* Active threshold badge */}
            {searched && (
              <div className="px-3 py-1.5 bg-blue-600/10 rounded-full border border-blue-500/30 text-xs font-bold text-blue-400">
                ≥ {threshold}% threshold
              </div>
            )}
            <div className="px-4 py-1.5 bg-[#21262d] rounded-full border border-[#30363d] text-sm font-bold shadow-sm">
              {results.length}{" "}
              <span className="text-[#8b949e] font-normal">Items found</span>
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
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={`${API}/${item.imagePath.replace(/\\/g, "/")}`}
                    alt="Search Result"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/10 text-[10px] font-bold tracking-widest text-white uppercase">
                    Atlas Match
                  </div>
                </div>
                <div className="p-4 flex justify-between items-center bg-gradient-to-b from-transparent to-black/10">
                  <span className="text-[11px] text-[#8b949e] font-bold uppercase tracking-wider">
                    Confidence Score
                  </span>
                  <span className="text-sm font-black text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
                    {item.confidence}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-40">
            <div className="text-7xl mb-6 grayscale group-hover:grayscale-0 transition-all duration-700 animate-pulse">
              📡
            </div>
            <h3 className="text-xl font-bold">
              {searched ? `No matches found above ${threshold}% threshold` : "Waiting for Vector Query"}
            </h3>
            <p className="text-sm max-w-xs mt-2 leading-relaxed">
              {searched
                ? "Try lowering the threshold or use a more specific description."
                : "Adjust your filters or upload a reference image to begin scanning your database."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}