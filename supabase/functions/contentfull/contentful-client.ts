// @ts-nocheck

const SPACE_ID = Deno.env.get("SPACE_ID");
const ACCESS_TOKEN = Deno.env.get("CONTENTFULL_ACCESS_TOKEN");
const PREVIEW_TOKEN = Deno.env.get("PREVIEW_TOKEN");

function getAssetUrl(assetId: string, includes: any) {
  const asset = includes?.Asset?.find((a) => a.sys.id === assetId);
  return asset?.fields?.file?.url ? `https:${asset.fields.file.url}` : null;
}

function getAssetsArray(assetLinks: any[], includes: any) {
  if (!assetLinks) return [];

  return assetLinks
    .map((asset) => getAssetUrl(asset.sys.id, includes))
    .filter(Boolean);
}

export async function getAllPosts({ contentType } = {}) {
  if (!contentType) {
    throw new Error("contentType is required");
  }

  console.log("📡 Fetching:", contentType);

  const url = `https://preview.contentful.com/spaces/${SPACE_ID}/environments/master/entries?access_token=${PREVIEW_TOKEN}&content_type=${contentType}&include=2`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.items.map((item: any) => {
    const fields = item.fields;

    return {
      id: item.sys.id,

      // 🧠 core
      title: fields.title || null,
      author: fields.author || null,
      url: fields.url || null,

      // 📝 new fields from igPost
      caption: fields.caption || null,
      summary: fields.summary || null,
      takeaways: fields.takeaways || null,
      tags: fields.tags || [],

      // 🖼️ images
      coverImage: fields.coverImage?.sys?.id
        ? getAssetUrl(fields.coverImage.sys.id, data.includes)
        : null,

      carousel: getAssetsArray(fields.carousel, data.includes),

      // 📱 social preview
      igPreview: fields.igPreview || null,

      // 🔗 optional
      source: fields.source || null,
    };
  });
}

export async function getPostByURL(urlParam: string, contentType = "igPost") {
  const url = `https://preview.contentful.com/spaces/${SPACE_ID}/environments/master/entries?access_token=${PREVIEW_TOKEN}&content_type=${encodeURIComponent(contentType)}&fields.url=${encodeURIComponent(urlParam)}&include=2`;

  console.log("🌐 GET POST BY URL:", url);

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  // pick the first matching entry
  const item = data.items[0];
  if (!item) return null;

  const fields = item.fields;

  return {
    id: item.sys.id,

    // 🧠 core fields
    title: fields.title || null,
    author: fields.author || null,
    url: fields.url || null,

    // 📝 post content
    caption: fields.caption || null,
    summary: fields.summary || null,
    takeaways: fields.takeaways || null,
    tags: fields.tags || [],

    // 🖼️ images
    coverImage: fields.coverImage?.sys?.id
      ? getAssetUrl(fields.coverImage.sys.id, data.includes)
      : null,
    carousel: getAssetsArray(fields.carousel, data.includes),

    // 📱 social preview
    igPreview: fields.igPreview || null,

    // 🔗 optional source field
    source: fields.source || null,
  };
}

/* -------------------------
   Helper to resolve asset URL
------------------------- */
// function getAssetUrl(assetId: string, includes: any) {
//   const asset = includes?.Asset?.find((a) => a.sys.id === assetId);
//   return asset?.fields?.file?.url
//     ? `https:${asset.fields.file.url}`
//     : null;
// }

/* -------------------------
   Helper for multiple assets
------------------------- */
// function getAssetsArray(assetLinks: any[], includes: any) {
//   if (!assetLinks) return [];
//   return assetLinks
//     .map((a) => getAssetUrl(a.sys.id, includes))
//     .filter(Boolean);
// }
