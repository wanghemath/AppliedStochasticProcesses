"""Execute the student notebook from a clean kernel, retaining outputs only on success."""
import os
import argparse
from pathlib import Path
import tempfile
import nbformat
from nbclient import NotebookClient

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--module', type=int, choices=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], default=1)
args = parser.parse_args()
notebooks = {1: ('module01_stochastic_models.ipynb', 5),
             2: ('module02_markov_chains.ipynb', 5),
             3: ('module03_stationarity_hitting.ipynb', 6),
             4: ('module04_monte_carlo.ipynb', 6),
             5: ('module05_mcmc.ipynb', 6),
             6: ('module06_branching.ipynb', 6),
             7: ('module07_poisson.ipynb', 6),
             8: ('module08_renewal_ctmc.ipynb', 6),
             9: ('module09_queueing.ipynb', 6),
             10: ('module10_brownian_dynamics.ipynb', 6),
             11: ('module11_gaussian_processes.ipynb', 6),
             12: ('module12_validation_sensitivity.ipynb', 6),
             13: ('module13_reproducibility_verification.ipynb', 6),
             14: ('module14_presentations_explanations.ipynb', 4)}
name, expected_figures = notebooks[args.module]
target = root / 'notebooks' / name
with tempfile.TemporaryDirectory(prefix='stochastic-course-') as temp:
    os.environ.setdefault('MPLCONFIGDIR', str(Path(temp) / 'matplotlib'))
    os.environ.setdefault('JUPYTER_RUNTIME_DIR', str(Path(temp) / 'jupyter'))
    os.environ['MPLBACKEND'] = 'module://matplotlib_inline.backend_inline'
    nb = nbformat.read(target, as_version=4)
    for cell in nb.cells:
        if cell.cell_type == 'code':
            cell.outputs = []
            cell.execution_count = None
    client = NotebookClient(nb, timeout=120, kernel_name='python3',
                            resources={'metadata': {'path': str(target.parent)}})
    client.execute()
    nbformat.validate(nb)
    images = sum("image/png" in out.get("data", {}) for cell in nb.cells if cell.cell_type == "code" for out in cell.outputs)
    assert images == expected_figures, f"Expected {expected_figures} embedded figures, got {images}"
    nbformat.write(nb, target)
    print(f'PASS: fresh-kernel execution of {target.name}; {len(nb.cells)} cells.')
