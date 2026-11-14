import fs from 'node:fs/promises';
import path from 'node:path';
const modulePath = new URL('../src/postersLab/templates.js', import.meta.url);
const { templates, posterSvg } = await import('data:text/javascript;base64,' + Buffer.from(await fs.readFile(modulePath, 'utf8')).toString('base64'));
const output = path.resolve(process.argv[2] || '../outputs/DJPlannerPro/carteles-beta');
await fs.mkdir(output, { recursive: true });
const data = { title: 'MIDNIGHT SESSION', djs: ['ALEX NOVA', 'LUNA'], date: '24 OCT 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID', format: 'Cartel' };
const cards = [];
for (const [index, t] of templates.entries()) {
  const svg = posterSvg({ ...data, style: t.name });
  await fs.writeFile(path.join(output, `${index + 1}.svg`), svg);
  cards.push(`<article><img src="${index + 1}.svg" alt="${t.name}"><div><small>0${index + 1} / BETA</small><h2>${t.name}</h2><p>${t.description}</p></div></article>`);
}
await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DJ Planner · 8 estilos de carteles</title><style>*{box-sizing:border-box}body{margin:0;background:#111415;color:#f4f0e7;font-family:Arial,sans-serif;padding:44px}header{max-width:1100px;margin:0 auto 32px}header small{color:#bedb91;letter-spacing:3px;font-size:11px}h1{font-size:38px;margin:14px 0 10px;letter-spacing:-1px}header p{color:#aaa;font-size:15px;line-height:1.6;max-width:780px}.grid{max-width:1100px;margin:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:24px 20px}article{min-width:0}article img{display:block;width:100%;aspect-ratio:2/3;background:#222}article div{padding:16px 0 8px}small{font-size:10px;letter-spacing:2px;color:#8b9690}h2{font-size:18px;margin:8px 0}article p{color:#aeb4b0;font-size:12px;line-height:1.5;margin:0}footer{max-width:1100px;margin:28px auto 0;color:#8b9690;font-size:12px}@media(max-width:700px){body{padding:24px}.grid{grid-template-columns:repeat(2,1fr);gap:20px 14px}h1{font-size:30px}}</style><header><small>DJ PLANNER PRO / DIRECCIÓN VISUAL 01</small><h1>Ocho estilos. Una misma sesión.</h1><p>Primeras propuestas de composición para la beta, basadas en tus referencias. Arte vectorial local; la fotografía y los fondos generados con IA se trabajarán después de elegir la dirección.</p></header><main class="grid">${cards.join('')}</main><footer>24 OCT 2026 · ALEX NOVA / LUNA · SALA ÓRBITA, MADRID — Datos ficticios · Sin consumo de IA</footer></html>`);
console.log(output);
