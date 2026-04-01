export default async function handler(req, res) {
  // CORS 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url 파라미터 필요" });

  // korea.kr RSS만 허용
  if (!url.startsWith("https://www.korea.kr/rss/")) {
    return res.status(403).json({ error: "허용되지 않은 URL" });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RSSReader/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `RSS 서버 응답 오류: ${response.status}` });
    }

    const xml = await response.text();

    // XML 파싱 — 제목·링크·날짜·설명 추출
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const get = (tag) => {
        const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? (m[1] || m[2] || "").trim() : "";
      };
      const title   = get("title");
      const link    = get("link") || get("guid");
      const pubDate = get("pubDate");
      const desc    = get("description").replace(/<[^>]+>/g, "").trim().slice(0, 120);

      if (title) {
        items.push({
          title,
          url: link,
          date: pubDate ? pubDate.slice(0, 16) : "",
          summary: desc,
          source: "정책브리핑",
        });
      }
    }

    // 채널 제목
    const chanMatch = xml.match(/<channel>[\s\S]*?<title[^>]*><!?\[?CDATA\[?([\s\S]*?)\]?\]?><\/title>/);
    const channelTitle = chanMatch ? chanMatch[1].replace(/<!?\[CDATA\[|\]\]>/g, "").trim() : "korea.kr";

    return res.status(200).json({ channelTitle, items, total: items.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
