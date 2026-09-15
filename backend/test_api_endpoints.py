"""Test FastAPI endpoints via TestClient."""
import sys
from pathlib import Path
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.main import app

def test_api():
    with TestClient(app) as client:
        # 1. Health
        print("Testing GET /health...")
        r = client.get("/health")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        health_data = r.json()
        print("Health response:", health_data)
        assert health_data["status"] == "healthy"
        assert health_data["models_count"] == 5

        # 2. Scenario List
        print("\nTesting GET /api/v1/scenario/list...")
        r = client.get("/api/v1/scenario/list")
        assert r.status_code == 200
        scenarios = r.json()["scenarios"]
        print(f"Found {len(scenarios)} scenarios.")

        # 3. POST /api/v1/scenario/run (NORMAL)
        print("\nTesting POST /api/v1/scenario/run (NORMAL)...")
        r = client.post("/api/v1/scenario/run", json={"scenario": "NORMAL"})
        assert r.status_code == 200
        res_normal = r.json()
        assert res_normal["final_decision"] == "ACCEPT_PLAN"
        assert res_normal["safe_operability_days"] == 10.79
        assert res_normal["cqrm_days"] == 0.49
        print("NORMAL response verified successfully.")

        # 4. POST /api/v1/scenario/run (RESUPPLY_DELAY_4D)
        print("\nTesting POST /api/v1/scenario/run (RESUPPLY_DELAY_4D)...")
        r = client.post("/api/v1/scenario/run", json={"scenario": "RESUPPLY_DELAY_4D"})
        assert r.status_code == 200
        res_delay = r.json()
        assert res_delay["final_decision"] == "REJECT_PLAN"
        assert res_delay["safety_status"] == "UNSAFE"
        assert res_delay["cqrm_days"] == -3.51
        assert res_delay["operator_intervention_required"] is True
        print("RESUPPLY_DELAY_4D response verified successfully.")

        print("\nALL FASTAPI API TESTS PASSED!")


if __name__ == "__main__":
    test_api()
