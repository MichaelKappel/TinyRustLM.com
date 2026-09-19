"use strict";

const maximumJsonBytes = 16 * 1024 * 1024;
const maximumTextBytes = 1024 * 1024;

/** Keep transport failures distinct from a candidate's license, shape or quality. */
class MetadataReadError extends Error {
  constructor(code, label) {
    super(`${label}: ${code}`);
    this.name = "MetadataReadError";
    this.code = code;
  }
}

/** Cancel without allowing a broken stream's cancellation to extend the deadline. */
function cancelBody(body) {
  if (body) Promise.resolve(body.cancel()).catch(() => {});
}

/** Create sequential evidence readers; each deadline covers headers and the entire body. */
function createMetadataReader(fetchImpl, timeoutMs = 30_000) {
  if (typeof fetchImpl !== "function" || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error("metadata fetch implementation or request timeout is invalid");
  }

  /** Bound decoded response bytes before copying or parsing; preserve exact valid UTF-8 text. */
  async function text(url, label, maximumBytes = maximumTextBytes) {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > maximumJsonBytes) {
      throw new Error("metadata byte limit is invalid");
    }
    const controller = new AbortController();
    let response;
    let reader;
    let complete = false;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new MetadataReadError("metadata_timeout", label);
        reject(error);
        controller.abort(error);
      }, timeoutMs);
    });
    const reading = (async () => {
      response = await fetchImpl(url, { method: "GET", redirect: "follow", signal: controller.signal });
      if (controller.signal.aborted) {
        cancelBody(response?.body);
        throw controller.signal.reason;
      }
      if (!response?.ok) throw new MetadataReadError("metadata_http_error", label);
      const length = response.headers.get("content-length");
      if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
        throw new MetadataReadError("metadata_invalid_response", label);
      }
      if (length !== null && Number(length) > maximumBytes) {
        throw new MetadataReadError("metadata_oversized", label);
      }
      if (!response.body) throw new MetadataReadError("metadata_invalid_response", label);
      reader = response.body.getReader();
      // One bounded buffer avoids retaining millions of tiny chunk objects.
      const bytes = Buffer.allocUnsafe(maximumBytes);
      let used = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (controller.signal.aborted) throw controller.signal.reason;
        if (done) { complete = true; break; }
        if (!(value instanceof Uint8Array)) throw new MetadataReadError("metadata_invalid_response", label);
        if (value.byteLength > maximumBytes - used) throw new MetadataReadError("metadata_oversized", label);
        bytes.set(value, used);
        used += value.byteLength;
      }
      try {
        return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, used));
      } catch (_error) {
        throw new MetadataReadError("metadata_invalid_utf8", label);
      }
    })();
    try {
      return await Promise.race([reading, deadline]);
    } catch (error) {
      if (error instanceof MetadataReadError) throw error;
      throw new MetadataReadError("metadata_request_failed", label);
    } finally {
      clearTimeout(timer);
      if (!complete) {
        controller.abort();
        cancelBody(reader || response?.body);
      }
      reader?.releaseLock();
    }
  }

  /** Parse only after the original response, including whitespace, passed its byte bound. */
  async function json(url, label) {
    const value = await text(url, label, maximumJsonBytes);
    try {
      return JSON.parse(value);
    } catch (_error) {
      throw new MetadataReadError("metadata_invalid_json", label);
    }
  }

  return Object.freeze({ json, text });
}

module.exports = Object.freeze({ createMetadataReader, MetadataReadError });
