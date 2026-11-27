import { canonicalUrl } from './radar.mjs';

const projects = [
  [/^(?:www\.)?99freelas\.com\.br$/, /^\/project\/[^/]+/],
  [/^(?:www\.)?workana\.com$/, /^\/(?:pt\/|en\/|es\/)?(?:job|proyecto|projeto)\/[^/]+/],
  [/^(?:www\.)?upwork\.com$/, /^\/freelance-jobs\/apply\/[^/]+/],
  [/^(?:www\.)?freelancer\.com\.br$/, /^\/projetos\/.+\/.+/]
];

export function radarEmailDiscoveries(feed, knownRows) {
  const seen = new Set(knownRows.map((row) => canonicalUrl(row.url)).filter(Boolean));
  const discoveries = [];
  for (const alert of feed) {
    if (alert?.kind !== 'new_opportunity' || !alert.subject) continue;
    let link;
    try { link = new URL(alert.opportunityUrl); } catch { continue; }
    if (link.protocol !== 'https:' || link.username || link.password || link.port
      || !projects.some(([host, path]) => host.test(link.hostname) && path.test(link.pathname))) continue;
    // Keep the project path and discard recipient-specific tracking parameters.
    const url = canonicalUrl(link.origin + link.pathname);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const received = Date.parse(alert.receivedAt || alert.emailTs || '');
    discoveries.push({
      url,
      title: String(alert.subject).slice(0, 180),
      platform: link.hostname.replace(/^www\./, ''),
      source: 'Alerta de e-mail',
      sourceKind: 'email_alert',
      verification: 'email_alert_unverified',
      observedAt: Number.isFinite(received) ? new Date(received).toISOString() : '',
      budget: 'desconhecido',
      status: 'Alerta importado. Conferir disponibilidade na página original.'
    });
  }
  return discoveries;
}
