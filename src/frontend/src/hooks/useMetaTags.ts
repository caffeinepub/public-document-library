import { useEffect } from "react";

interface MetaTagsOptions {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image";
}

export function useMetaTags({
  title,
  description,
  ogImage,
  ogType = "website",
  twitterCard,
}: MetaTagsOptions) {
  useEffect(() => {
    // Title
    document.title = title;

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(
        `meta[${attr}="${name}"]`,
      ) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", description);
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", ogType, true);
    if (ogImage) {
      const absoluteImage = ogImage.startsWith("http")
        ? ogImage
        : `${window.location.origin}${ogImage}`;
      setMeta("og:image", absoluteImage, true);
      setMeta("twitter:card", "summary_large_image");
      setMeta("twitter:image", absoluteImage);
    } else {
      setMeta("twitter:card", twitterCard ?? "summary");
    }
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
  }, [title, description, ogImage, ogType, twitterCard]);
}
