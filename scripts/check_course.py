"""Check local navigation, data integrity, and executed student notebook outputs."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import csv
import hashlib
import json
import re
import nbformat

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.ids, self.links, self.tags = [], [], []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for field in ('href', 'src'):
            if field in attrs:
                self.links.append(attrs[field])


pages = {p: Page(p.read_text()) for p in ROOT.rglob('*.html')
         if not {'vendor', '.venv', 'dist', 'build', '.git'}.intersection(p.relative_to(ROOT).parts)}
errors = []
allowed_tags = set('a article aside b body br button caption code dd desc details div dl dt em '
                   'figcaption figure footer h1 h2 h3 h4 h5 h6 head header hr html i img input '
                   'label li link main meta nav noscript ol option output p pre script section '
                   'select small span strong style sub summary sup svg table tbody td textarea '
                   'th thead title tr ul path line circle rect text g defs clipPath'.lower().split())


def exact_case(target):
    """Catch links that work on a case-insensitive Mac but fail on static hosting."""
    try:
        parts = target.relative_to(ROOT).parts
    except ValueError:
        return False
    current = ROOT
    for part in parts:
        if part not in {child.name for child in current.iterdir()}:
            return False
        current = current / part
    return True


for path, page in pages.items():
    unknown = set(page.tags) - allowed_tags
    if unknown:
        errors.append(f'{path.name}: unexpected HTML tags {unknown}; escape math inequalities')
    if len(page.ids) != len(set(page.ids)):
        errors.append(f'{path.name}: duplicate IDs')
    for link in page.links:
        u = urlsplit(link)
        if u.scheme or u.netloc:
            continue
        target = (path.parent / unquote(u.path)).resolve() if u.path else path
        if not target.exists():
            errors.append(f'{path.relative_to(ROOT)}: missing {link}')
        elif not exact_case(target):
            errors.append(f'{path.relative_to(ROOT)}: path case mismatch or outside-course link {link}')
        elif u.fragment and target.suffix == '.html':
            other = pages.get(target) or Page(target.read_text())
            if unquote(u.fragment) not in other.ids:
                errors.append(f'{path.relative_to(ROOT)}: missing anchor {link}')

csv_path = ROOT / 'data/bike_daily_2011.csv'
rows = list(csv.DictReader(csv_path.open()))
assert len(rows) == 365
dates = [r['dteday'] for r in rows]
assert dates == sorted(set(dates))
js = (ROOT / 'data/bike_daily_2011.js').read_text()
browser_rows = json.loads(js.split('window.COURSE_BIKE_DATA =', 1)[1].strip().rstrip(';'))
assert [(r['dteday'], int(r['cnt']), int(r['workingday'])) for r in rows] == [(r['dteday'], r['cnt'], r['workingday']) for r in browser_rows]
metadata = json.loads((ROOT / 'data/source_metadata.json').read_text())
assert hashlib.sha256(csv_path.read_bytes()).hexdigest() in json.dumps(metadata)

total_code = 0
for name, expected_figures in [('module01_stochastic_models.ipynb', 5),
                               ('module02_markov_chains.ipynb', 5),
                               ('module03_stationarity_hitting.ipynb', 6),
                               ('module04_monte_carlo.ipynb', 6),
                               ('module05_mcmc.ipynb', 6),
                               ('module06_branching.ipynb', 6),
                               ('module07_poisson.ipynb', 6),
                               ('module08_renewal_ctmc.ipynb', 6),
                               ('module09_queueing.ipynb', 6),
                               ('module10_brownian_dynamics.ipynb', 6),
                               ('module11_gaussian_processes.ipynb', 6),
                               ('module12_validation_sensitivity.ipynb', 6),
                               ('module13_reproducibility_verification.ipynb', 6),
                               ('module14_presentations_explanations.ipynb', 4)]:
    nb = nbformat.read(ROOT / 'notebooks' / name, as_version=4)
    nbformat.validate(nb)
    code = [c for c in nb.cells if c.cell_type == 'code']
    total_code += len(code)
    assert all(c.execution_count is not None for c in code), f'{name}: unexecuted code cell'
    assert not any(o.output_type == 'error' for c in code for o in c.outputs)
    assert [c.execution_count for c in code] == list(range(1, len(code) + 1)), name
    assert all(len(c.source.splitlines()) <= 16 for c in code), f'{name}: long code cell'
    assert sum('image/png' in o.get('data', {}) for c in code for o in c.outputs) == expected_figures, f'{name}: missing figures'
    for cell in nb.cells:
        if cell.cell_type == 'markdown':
            for link in re.findall(r'\]\(([^)]+)\)', cell.source):
                if not urlsplit(link).scheme:
                    assert (ROOT / 'notebooks' / link.split('#')[0]).exists(), link
                    assert 'instructor/' not in link, f'{name}: instructor solution link'
# Student-facing links must never expose the instructor directory.
for path, page in pages.items():
    if 'templates' not in path.parts:
        assert not any('instructor/' in u for u in page.links)

# CSS fonts and images must also resolve offline, with exact filename case.
for stylesheet in (ROOT / 'assets').rglob('*.css'):
    for link in re.findall(r'url\([\'\"]?([^\)\'\"]+)', stylesheet.read_text()):
        if urlsplit(link).scheme or link.startswith('#'):
            continue
        target = (stylesheet.parent / unquote(urlsplit(link).path)).resolve()
        if not target.exists() or not exact_case(target):
            errors.append(f'{stylesheet.name}: missing or case-mismatched CSS asset {link}')

instructor_count = 0
for target in sorted((ROOT / 'instructor').glob('module*_solutions.ipynb')):
    nb = nbformat.read(target, as_version=4)
    nbformat.validate(nb)
    code = [c for c in nb.cells if c.cell_type == 'code']
    assert [c.execution_count for c in code] == list(range(1, len(code) + 1)), target.name
    assert all(len(c.source.splitlines()) <= 16 for c in code), target.name
    assert not any(o.output_type == 'error' for c in code for o in c.outputs), target.name
    instructor_count += 1
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} HTML pages, local links/anchors, 365 matching CSV/JS rows, checksum, '
      f'{total_code} executed student code cells across 14 notebooks, {instructor_count} instructor notebooks, '
      'short sequential code cells, CSS assets, exact filename case, no notebook errors or instructor navigation.')
