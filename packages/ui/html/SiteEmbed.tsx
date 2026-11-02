/** Web-only primitive. Callers must validate the URL against their provider/host policy. */
export interface SiteEmbedProps {
  src: string;
  title: string;
  aspect?: '16:9' | '4:3' | '1:1' | '9:16';
  /** Only server-validated cross-origin documents may retain their origin in the sandbox. */
  crossOrigin: boolean;
}
export function SiteEmbed({ src, title, aspect = '16:9', crossOrigin }: SiteEmbedProps) {
  const ratios = { '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1', '9:16': '9 / 16' } as const;
  return <iframe src={src} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
    sandbox={crossOrigin ? 'allow-scripts allow-same-origin allow-presentation' : 'allow-scripts allow-presentation'}
    allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen
    style={{ display: 'block', width: '100%', aspectRatio: ratios[aspect], border: 0 }} />;
}
