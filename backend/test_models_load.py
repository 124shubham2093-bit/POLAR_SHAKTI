import joblib
from pathlib import Path

for p in Path('models').glob('*.joblib'):
    try:
        obj = joblib.load(p)
        print(f"SUCCESS: {p.name} -> {type(obj)}")
    except Exception as e:
        print(f"FAILED: {p.name} -> {e}")
