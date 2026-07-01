// @ts-nocheck

import { corsHeaders } from "../utils/headers.ts";
import { resolvePortalSchema } from "../utils/schema.ts";
import { downloadDocument } from "./downloadDocument.ts";
import { getStorageData } from "./fetch-storage-data.ts";
import { shareDocument } from "./shareDocument.ts";
import { deleteDocument } from "./delete-document.ts";
import { updateDocumentCategory } from "./update-document-category.ts";
import { updateStorageEntry } from "./update-storage-entry.ts";
import { uploadStorageData } from "./upload-storage-data.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const { pathname } = url;
    const schema = resolvePortalSchema(req);

    // 🔹 GET /storage
    if (req.method === "GET" && pathname === "/storage") {
      return await getStorageData(req, schema);
    }
    if (req.method === "GET" && pathname === "/storage/download") {
      return await downloadDocument(req, schema);
    }
    // 🔹 POST /storage
    if (req.method === "POST" && pathname === "/storage") {
      return await uploadStorageData(req, schema);
    }
    if (req.method === "POST" && pathname === "/storage/share") {
      return await shareDocument(req, schema);
    }
    if (req.method === "PATCH" && pathname === "/storage") {
      return await updateStorageEntry(req, schema);
    }
    if (req.method === "PUT" && pathname === "/storage") {
      return await updateDocumentCategory(req, schema);
    }
    if (req.method === "DELETE" && pathname === "/storage") {
      return await deleteDocument(req, schema);
    }

    // ❌ Not found
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Storage API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
