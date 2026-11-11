# Builds index.html from index.src.html (injects signature SVG + chart markup)
import re, pathlib
src = pathlib.Path('src/index.src.html').read_text()
sig = pathlib.Path('src/signature-animated.svg.html').read_text().replace('<svg class="sig"', '<svg class="sig" data-signature')
data = [  # share of commission turnover, % (SAB servis, 03/2026)
 (2021, [45.9, 34.6, 15.7, 3.0, 0.8]),
 (2022, [26.2, 49.7, 18.6, 4.1, 1.4]),
 (2023, [20.0, 49.7, 23.8, 4.9, 1.6]),
 (2024, [30.0, 41.6, 21.6, 4.1, 2.7]),
 (2025, [50.8, 28.6, 16.5, 2.4, 1.6]),
]
keys = ['u','z','n','i','o']
names = ['Úvěry a hypotéky','Životní pojištění','Neživotní pojištění','Investice','Ostatní']
rows = []
for r,(y,vals) in enumerate(data):
    segs = []
    for i,(k,v) in enumerate(zip(keys,vals)):
        flag = ' data-small' if v < 8 else (' data-mid' if v < 20 else '')
        lbl = f'{v:.0f} %'.replace('.', ',')
        segs.append(f'<span class="chart__seg c-{k}" data-k="{k}" data-name="{names[i]}" data-year="{y}" data-val="{str(v).replace(".",",")}" style="--w:{v}%;--i:{i};--r:{r}" tabindex="0"{flag}><span>{lbl}</span></span>')
    rows.append(f'<div class="chart__row"><span class="chart__year">{y}</span><div class="chart__bar">{"".join(segs)}</div></div>')
chart = '\n              '.join(rows)
th = ''.join(f'<th scope="col">{n}</th>' for n in names)
trs = ''.join(f'<tr><th scope="row">{y}</th>' + ''.join(f'<td>{str(v).replace(".",",")} %</td>' for v in vals) + '</tr>' for y,vals in data)
table = f'<table class="visually-hidden"><caption>Podíl produktových oblastí na provizním obratu (%)</caption><thead><tr><th scope="col">Rok</th>{th}</tr></thead><tbody>{trs}</tbody></table>'
out = src.replace('<!--SIGNATURE-->', sig).replace('<!--CHART-->', chart).replace('<!--CHARTTABLE-->', table)
pathlib.Path('index.html').write_text(out)
print('ok', len(out))
