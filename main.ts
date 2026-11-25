Deno.serve(async (request: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const reqUrl = new URL(request.url);

  // Acepta tanto /?url=http... como /http%3A%2F%2F...
  let destino = reqUrl.searchParams.get("url");
  if (!destino && reqUrl.pathname.length > 1) {
    destino = decodeURIComponent(reqUrl.pathname.slice(1));
  }

  if (!destino || !destino.startsWith("http")) {
    return new Response("Puente TV Deno activo", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const respuesta = await fetch(destino, {
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        "Accept": "*/*",
      },
      redirect: "follow",
    });

    const headers = new Headers(respuesta.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));

    const contentType = headers.get("content-type") || "";

    // Reescribir manifiestos .m3u8 y .m3u
    if (destino.includes(".m3u") || contentType.includes("mpegurl")) {
      const texto = await respuesta.text();
      const baseDestino = new URL(respuesta.url);
      const origenProxy = `${reqUrl.origin}/?url=`;

      const reescrito = texto
        .split(/\r?\n/)
        .map((linea) => {
          const l = linea.trim();
          if (!l || l.startsWith("#")) return linea;
          const urlAbsoluta = new URL(l, baseDestino).href;
          return origenProxy + encodeURIComponent(urlAbsoluta);
        })
        .join("\n");

      headers.delete("content-length");
      return new Response(reescrito, { status: respuesta.status, headers });
    }

    return new Response(respuesta.body, { status: respuesta.status, headers });
  } catch (err) {
    return new Response(`Error conectando al origen: ${(err as Error).message}`, {
      status: 502,
      headers: corsHeaders,
    });
  }
});
