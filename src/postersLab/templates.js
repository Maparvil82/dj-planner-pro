// Directions for the beta, v1. All artwork is local SVG; no generation request.
export const templates = [
  { name: 'Forma Retro', bg: '#eee4cb', fg: '#173d32', accent: '#c65634', description: 'Geometría de los setenta, papel crema y letras rotundas.', references: [1], layout: 'top', prompt: 'Mid-century geometric music poster artwork, terracotta mustard forest green, warm cream paper, modular quarter circles, flat screen print. Clear upper and lower text areas. No text, letters, logos or watermarks.' },
  { name: 'Tropical Club', bg: '#073e3b', fg: '#fff0cf', accent: '#ff713d', description: 'Atardecer, hojas y energía cálida de club.', references: [2], layout: 'bottom', prompt: 'Tropical night club artwork, oversized palm leaves framing an amber sunset disc, dark teal and vivid orange, warm cinematic atmosphere. Clear lower text area. No text, letters, logos or watermarks.' },
  { name: 'Botánica Surreal', bg: '#173c5b', fg: '#fff4df', accent: '#ed998d', description: 'Portal geométrico, flores y atmósfera de ensueño.', references: [3], layout: 'center', prompt: 'Surreal botanical music artwork, peach diamond portal floating in deep blue rippling space, oversized coral flowers and jade foliage, sophisticated editorial collage. Clear central and bottom text areas. No text, letters, logos or watermarks.' },
  { name: 'Headliner', bg: '#202e2f', fg: '#dcff4b', accent: '#6d8b80', description: 'Nombre protagonista, verde ácido y composición de festival.', references: [4, 8, 9], layout: 'bottom', prompt: 'Contemporary headline DJ poster artwork, dark desaturated green studio atmosphere, stark side light, sculptural abstract central form, acid yellow accents, fine technical grid. Clear lower headline area. No text, letters, logos or watermarks.' },
  { name: 'Rave Digital', bg: '#090d0b', fg: '#39f18d', accent: '#135d39', description: 'Retícula técnica, verde fósforo y gráficos fragmentados.', references: [5], layout: 'top', prompt: 'Underground rave artwork, black and phosphor green, broken pixel scan lines, distorted circular signal, raw monochrome risograph, technical asymmetric grid. Clear upper and bottom text areas. No text, letters, logos or watermarks.' },
  { name: 'Neo Futuro', bg: '#032c32', fg: '#ff513b', accent: '#20b9ac', description: 'Visor rojo, simetría y estética electrónica futurista.', references: [6], layout: 'bottom', prompt: 'Futuristic electronic club artwork, dark teal, symmetrical chrome orbital sculpture with a vivid red luminous visor band, moody high contrast, premium sci-fi. Clear lower text area. No text, letters, logos or watermarks.' },
  { name: 'Groove Vintage', bg: '#f0d49a', fg: '#a62f22', accent: '#ed6334', description: 'Tinta cálida, vinilo y ritmo gráfico de jazz y soul.', references: [11, 12], layout: 'top', prompt: 'Vintage jazz soul music illustration, warm cream burnt orange burgundy, oversized vinyl record, expressive sweeping shapes, textured screen printed paper, lively hand cut collage. Clear upper and bottom text areas. No text, letters, logos or watermarks.' },
  { name: 'Editorial', bg: '#f1eddf', fg: '#171b19', accent: '#80968b', description: 'Marco de revista, paneles verticales y tipografía sobria.', references: [7, 10, 13], layout: 'bottom', prompt: 'Minimal editorial music artwork, three tall photographic-style architectural panels, monochrome sage and black, restrained warm ivory paper border, strong negative space, museum print aesthetic. Clear lower text area. No text, letters, logos or watermarks.' },
];

export const templateNames = templates.map(t => t.name);
export function getTemplate(name) { return templates.find(t => t.name === name) || templates[0]; }
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function wrap(value, length, limit) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > length) { lines.push(line); line = word; }
    else line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  if (lines.length > limit) return [...lines.slice(0, limit - 1), lines.slice(limit - 1).join(' ')];
  return lines;
}
function text(value, x, y, size, fill, options = '') {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="800" ${options}>${escape(value)}</text>`;
}
function block(value, x, y, size, fill, width, limit = 3) {
  const lines = wrap(value, Math.floor(width / (size * .64)), limit);
  return lines.map((line, i) => text(line, x, y + i * size * 1.03, size, fill, `textLength="${Math.min(width, line.length * size * .64)}" lengthAdjust="spacingAndGlyphs"`)).join('');
}
const leaf = (x, y, rotation, color, scale = 1) => `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 0 Q-95 -85 0 -230 Q95 -85 0 0Z" fill="${color}"/><path d="M0 -8V-212" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/></g>`;

function artwork(index, h, t) {
  const cy = h * .49;
  if (index === 0) {
    const colors = ['#d29843', '#c65634', '#70806b', '#173d32'];
    return Array.from({ length: 12 }, (_, i) => {
      const x = 36 + i % 4 * 132, y = h * .34 + Math.floor(i / 4) * 98;
      return `<g><rect x="${x}" y="${y}" width="132" height="98" fill="${colors[i % 4]}"/><path d="M${x} ${y}h132v98A132 98 0 0 1 ${x} ${y}" fill="${colors[(i + 1 + Math.floor(i / 4)) % 4]}"/></g>`;
    }).join('');
  }
  if (index === 1) return `<circle cx="300" cy="${h * .37}" r="213" fill="url(#sun)"/>${Array.from({ length: 8 }, (_, i) => leaf(i % 2 ? 620 : -20, h * .2 + i * 44, i % 2 ? -42 - i * 6 : 40 + i * 6, i % 3 ? '#126754' : '#e45e35', 1.35)).join('')}<path d="M0 ${h * .62}Q300 ${h * .47} 600 ${h * .62}V${h}H0Z" fill="${t.bg}"/>`;
  if (index === 2) return `${Array.from({ length: 10 }, (_, i) => `<ellipse cx="300" cy="${cy}" rx="${90 + i * 33}" ry="${130 + i * 39}" fill="none" stroke="#6bafb0" stroke-opacity=".16" stroke-width="3"/>`).join('')}<path d="M300 ${cy - 230}L493 ${cy} 300 ${cy + 230} 107 ${cy}Z" fill="url(#portal)"/>${[0, 1, 2, 3].map((i) => leaf(i % 2 ? 570 : 30, h * .75 + i * 18, i % 2 ? -40 : 40, '#477f64', .9)).join('')}${[85, 515].map(x => `<g transform="translate(${x} ${h * .72})">${Array.from({length: 7}, (_, i) => `<ellipse cx="0" cy="-38" rx="22" ry="56" fill="${i % 2 ? '#c95864' : '#ed998d'}" transform="rotate(${i * 51.43})"/>`).join('')}<circle r="23" fill="#e6c28c"/></g>`).join('')}`;
  if (index === 3) return `<path d="M36 140H564M36 ${h * .65}H564M88 100V${h - 160}M512 100V${h - 160}" stroke="#dcff4b" stroke-opacity=".2"/>${Array.from({length: 8}, (_, i) => `<ellipse cx="${278 + i * 5}" cy="${h * .38 + i * 13}" rx="${164 - i * 12}" ry="${185 - i * 10}" fill="${i % 2 ? '#202e2f' : '#6d8b80'}" transform="rotate(-24 300 ${h * .4})"/>`).join('')}<circle cx="487" cy="138" r="28" fill="none" stroke="${t.fg}"/>${text('+', 475, 149, 30, t.fg)}`;
  if (index === 4) return `<path d="M30 28V${h - 28}H570V28Z" stroke="${t.accent}" fill="none"/><g>${Array.from({length: 48}, (_, i) => {
    const y = cy - 105 + i * 5; const width = Math.sqrt(Math.max(0, 1 - ((i - 24) / 25) ** 2)) * 410;
    return `<rect x="${300 - width / 2 + (i % 5 - 2) * 12}" y="${y}" width="${width}" height="${i % 3 ? 3 : 5}" fill="${t.fg}" opacity="${i % 4 ? '.8' : '.35'}"/>`;
  }).join('')}</g><path d="M53 ${h * .31}H547M53 ${h * .73}H547M80 45V${h - 45}" stroke="${t.fg}" stroke-width="1" opacity=".5"/>`;
  if (index === 5) return `${Array.from({length: 7}, (_, i) => `<ellipse cx="300" cy="${h * .36}" rx="${182 - i * 16}" ry="${215 - i * 18}" fill="none" stroke="${i % 2 ? '#043b41' : '#20b9ac'}" stroke-width="14" transform="rotate(${i * 9 - 25} 300 ${h * .36})"/>`).join('')}<path d="M104 ${h * .32}Q300 ${h * .26} 496 ${h * .32}L484 ${h * .37}Q300 ${h * .32} 116 ${h * .37}Z" fill="#ff513b"/><path d="M110 ${h * .33}Q300 ${h * .27} 490 ${h * .33}" stroke="#ffc58a" stroke-width="5" fill="none"/><path d="M50 80V50H110M490 50H550V80M50 ${h - 90}V${h - 60}H110M490 ${h - 60}H550V${h - 90}" stroke="#20b9ac" fill="none"/>`;
  if (index === 6) return `<path d="M0 ${h * .38}Q300 ${h * .2} 600 ${h * .46}V${h * .8}Q270 ${h * .6} 0 ${h * .85}Z" fill="${t.accent}"/><circle cx="320" cy="${h * .54}" r="170" fill="#852c29"/>${Array.from({length: 7}, (_, i) => `<circle cx="320" cy="${h * .54}" r="${65 + i * 14}" fill="none" stroke="#f0d49a" stroke-opacity=".3" stroke-width="2"/>`).join('')}<circle cx="320" cy="${h * .54}" r="47" fill="#f0d49a"/><circle cx="320" cy="${h * .54}" r="8" fill="#852c29"/><path d="M105 ${h * .7}Q30 ${h * .49} 150 ${h * .37}" fill="none" stroke="#f0d49a" stroke-width="28"/>`;
  return [0, 1, 2].map((i) => `<g><rect x="${36 + i * 180}" y="60" width="168" height="${h * .56}" fill="${['#aab6a5', '#647b70', '#253e36'][i]}"/><path d="M${36 + i * 180} ${h * .52}L${204 + i * 180} 100V${h * .56 + 60}H${36 + i * 180}Z" fill="#171b19"/><circle cx="${120 + i * 180}" cy="${h * .29}" r="62" fill="none" stroke="#f1eddf" stroke-opacity=".6" stroke-width="2"/></g>`).join('');
}

export function posterSvg(data, { showPhotos = true } = {}) {
  const t = getTemplate(data.style); const index = templates.indexOf(t);
  const h = data.format === 'Historia' ? 1067 : data.format === 'Cuadrado' ? 600 : 900;
  const title = String(data.title || 'LIVE SESSION').toUpperCase();
  const djs = (data.djs || []).join(' / ');
  const top = t.layout === 'top'; const center = t.layout === 'center';
  const titleY = top ? 126 : center ? h * .43 : h * (h === 600 ? .65 : .71);
  const baseSize = h === 600 ? 44 : index === 7 ? 49 : 60;
  const estimatedLines = wrap(title, Math.floor(528 / (baseSize * .64)), 3).length;
  const size = top || center ? baseSize : Math.min(baseSize, (h - 151 - titleY) / Math.max(1, (estimatedLines - 1) * 1.03));
  const titleLines = wrap(title, Math.floor(528 / (size * .64)), 3).length;
  const artistY = Math.min(h - 135, titleY + titleLines * size * 1.03 + 20);
  const photos = showPhotos ? (data.djs || []).map(name => ({ name, uri: data.photos?.[name] })).filter(p => p.uri).slice(0, 4) : [];
  const photoY = top ? h * .43 : h * .23;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="600" height="${h}" viewBox="0 0 600 ${h}" role="img" aria-label="${escape(t.name + ': ' + title)}"><defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffc76d"/><stop offset="1" stop-color="#f05b34"/></linearGradient><linearGradient id="portal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8cd9d"/><stop offset="1" stop-color="#ce6481"/></linearGradient>${photos.map((p, i) => `<clipPath id="portrait${i}"><rect x="${300 - photos.length * 56 + i * 112}" y="${photoY}" width="104" height="150" rx="${index === 7 ? 0 : 4}"/></clipPath>`).join('')}</defs><rect width="600" height="${h}" fill="${t.bg}"/>${artwork(index, h, t)}${photos.map((p, i) => `<image x="${300 - photos.length * 56 + i * 112}" y="${photoY}" width="104" height="150" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait${i})" xlink:href="${escape(p.uri)}"/>`).join('')}${top ? `<rect x="24" y="70" width="552" height="${artistY - 44}" fill="${t.bg}" fill-opacity=".96"/>` : center ? '' : `<rect x="24" y="${titleY - 63}" width="552" height="${h - titleY + 40}" fill="${t.bg}" fill-opacity=".96"/>`}${text(data.date, 36, top ? 49 : h - 60, 18, t.fg, 'letter-spacing="2"')}${block(title, 36, titleY, size, t.fg, 528)}${block(djs, 36, artistY, h === 600 ? 18 : 23, t.fg, 528, 2)}<path d="M36 ${h - 90}H564" stroke="${t.fg}" stroke-opacity=".45"/>${block(data.venue, 36, h - 33, 15, t.fg, 420, 1)}${text(data.time, 564, h - 33, 18, t.fg, 'text-anchor="end"')}${text('DJ PLANNER / LIVE', 564, top ? 49 : 38, 10, t.fg, 'text-anchor="end" letter-spacing="1"')}</svg>`;
}
