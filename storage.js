/**
 * LocalStorage persistence & URL-hash single-patchbook sharing (100% client-side).
 */
(function () {
  const STORAGE_KEY = "arp_patch_notes_webapp_v1";
  const HASH_PREFIX = "#patchbook=";

  function bytesToBase64Url(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function base64UrlToBytes(b64url) {
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function compressString(str) {
    const rawBytes = new TextEncoder().encode(str);
    if (typeof CompressionStream === "function") {
      try {
        const cs = new CompressionStream("deflate-raw");
        const writer = cs.writable.getWriter();
        writer.write(rawBytes);
        writer.close();
        const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
        return "z." + bytesToBase64Url(compressed);
      } catch (err) {
        console.warn("CompressionStream failed, falling back to plain base64:", err);
      }
    }
    return "p." + bytesToBase64Url(rawBytes);
  }

  async function decompressString(encoded) {
    if (encoded.startsWith("z.") && typeof DecompressionStream === "function") {
      const bytes = base64UrlToBytes(encoded.slice(2));
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const raw = await new Response(ds.readable).arrayBuffer();
      return new TextDecoder().decode(raw);
    }
    const payload = encoded.startsWith("p.") ? encoded.slice(2) : encoded;
    const bytes = base64UrlToBytes(payload);
    return new TextDecoder().decode(bytes);
  }

  function normalizeState(parsed, fallbackState) {
    if (!parsed || typeof parsed !== "object") return fallbackState;

    const theme = parsed.theme === "paper" ? "light" : parsed.theme || fallbackState.theme;
    const templates = Array.isArray(parsed.templates) ? parsed.templates : fallbackState.templates;

    // v2 multi-book format
    if (Array.isArray(parsed.books) && parsed.books.length > 0) {
      const validBooks = parsed.books.filter(
        (b) => b && Array.isArray(b.patches) && b.patches.length > 0
      );
      if (validBooks.length > 0) {
        return {
          books: validBooks,
          activeBookId: parsed.activeBookId || validBooks[0].id,
          templates,
          theme,
        };
      }
    }

    // Migrate v1 single-book format seamlessly
    if (Array.isArray(parsed.patches) && parsed.patches.length > 0) {
      const migratedBook = {
        id: "book_1",
        name: "My Patchbook",
        activePatchId: parsed.activePatchId || parsed.patches[0].id,
        patches: parsed.patches,
      };
      return {
        books: [migratedBook],
        activeBookId: migratedBook.id,
        templates,
        theme,
      };
    }

    return fallbackState;
  }

  const PatchStorage = {
    hasLocalSave() {
      try {
        return Boolean(localStorage.getItem(STORAGE_KEY));
      } catch {
        return false;
      }
    },

    saveLocal(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (err) {
        console.warn("Failed to save to localStorage:", err);
        return false;
      }
    },

    loadLocal(fallbackState) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return normalizeState(JSON.parse(raw), fallbackState);
        }
      } catch (err) {
        console.warn("Failed to read localStorage, using defaults:", err);
      }
      return fallbackState;
    },

    async buildShareUrl(book) {
      const payload = {
        v: 2,
        book: {
          name: book.name,
          patches: book.patches,
        },
      };
      const encoded = await compressString(JSON.stringify(payload));
      const baseUrl = window.location.href.split("#")[0];
      return `${baseUrl}${HASH_PREFIX}${encoded}`;
    },

    async parseSharedFromUrl() {
      const hash = window.location.hash || "";
      if (!hash.startsWith(HASH_PREFIX)) return null;
      try {
        const encoded = hash.slice(HASH_PREFIX.length);
        const jsonStr = await decompressString(encoded);
        const parsed = JSON.parse(jsonStr);

        // v2 single-book payload
        if (parsed && parsed.book && Array.isArray(parsed.book.patches) && parsed.book.patches.length > 0) {
          return {
            name: parsed.book.name || "Shared Patchbook",
            patches: parsed.book.patches,
          };
        }
        // v1 legacy payload fallback
        if (parsed && Array.isArray(parsed.patches) && parsed.patches.length > 0) {
          return {
            name: "Shared Patchbook",
            patches: parsed.patches,
          };
        }
      } catch (err) {
        console.error("Could not decode shared patchbook URL:", err);
      }
      return null;
    },

    clearUrlHash() {
      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    },
  };

  window.PatchStorage = PatchStorage;
})();
