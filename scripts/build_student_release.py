"""Build a portable student-only ZIP; never include instructor solutions or local state."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import hashlib

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist' / 'AppliedStochasticProcesses-student.zip'
FILES = ['index.html', 'course-overview.html', 'project-guide.html', 'README.md',
         'requirements.txt', 'requirements-tested.txt', '.gitignore', '.nojekyll']
# Detailed QA reports and regression fixtures can contain assessed exercise answers.
# Publish only general-purpose validation/execution tools, not the private test suite.
FILES += ['scripts/check_course.py', 'scripts/check_math.cjs',
          'scripts/execute_notebook.py', 'scripts/build_student_release.py',
          'scripts/prepare_data.py']
FOLDERS = ['assets', 'data', 'modules', 'notebooks']
EXCLUDED = {'__pycache__', '.ipynb_checkpoints', '.DS_Store', 'instructor',
            'checks', 'templates'}

paths = [ROOT / name for name in FILES]
for folder in FOLDERS:
    paths.extend(p for p in (ROOT / folder).rglob('*') if p.is_file()
                 and not EXCLUDED.intersection(p.relative_to(ROOT).parts)
                 and p.suffix not in {'.pyc', '.pyo'})
paths = sorted(set(paths))
assert all(p.is_file() and not p.is_symlink() for p in paths)
assert len(list((ROOT / 'notebooks').glob('module*.ipynb'))) == 14
OUTPUT.parent.mkdir(exist_ok=True)
with ZipFile(OUTPUT, 'w', ZIP_DEFLATED) as archive:
    for source in paths:
        archive.write(source, source.relative_to(ROOT).as_posix())
with ZipFile(OUTPUT) as archive:
    names = archive.namelist()
    assert not any(EXCLUDED.intersection(Path(name).parts) for name in names)
    assert set(names) == {p.relative_to(ROOT).as_posix() for p in paths}
    assert archive.testzip() is None
    assert sum(n.startswith('notebooks/module') and n.endswith('.ipynb') for n in names) == 14
print(f'PASS: {len(paths)} files; 14 student notebooks; no instructor answers or private QA records.')
print(OUTPUT)
print('SHA-256:', hashlib.sha256(OUTPUT.read_bytes()).hexdigest())
