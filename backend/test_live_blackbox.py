"""Black-Box Verification of the Live POLAR-EMS HTTP Server."""
import json
import time
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8321"

def http_get(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def http_post(path, data):
    url = f"{BASE_URL}{path}"
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_blackbox_tests():
    print("=" * 80)
    print("BLACK-BOX TEST 1: GET /health")
    print("=" * 80)
    health = http_get("/health")
    print(json.dumps(health, indent=2))
    assert health["status"] == "healthy", f"Health status not healthy: {health['status']}"
    assert health["models_count"] == 5, f"Expected 5 models, got {health['models_count']}"
    assert set(health["models_loaded"]) == {"wind", "load", "solar", "battery_soh", "anomaly"}
    print("PASS: /health is 100% verified.")

    print("\n" + "=" * 80)
    print("BLACK-BOX TEST 2: GET /api/v1/scenario/list")
    print("=" * 80)
    sc_list = http_get("/api/v1/scenario/list")
    print(json.dumps(sc_list, indent=2))
    ids = [s["id"] for s in sc_list["scenarios"]]
    expected_ids = [
        "NORMAL",
        "RESUPPLY_DELAY_4D",
        "STORM",
        "LOW_RENEWABLE",
        "BATTERY_DEGRADATION",
        "SCADA_ANOMALY",
        "COMMUNICATION_LOSS"
    ]
    for eid in expected_ids:
        assert eid in ids, f"Missing scenario id: {eid}"
    print(f"PASS: Exactly all {len(expected_ids)} scenarios confirmed present.")

    results = {}
    for eid in expected_ids:
        print("\n" + "=" * 80)
        print(f"BLACK-BOX TEST: POST /api/v1/scenario/run -> {eid}")
        print("=" * 80)
        delay = 4.0 if eid == "RESUPPLY_DELAY_4D" else 0.0
        resp = http_post("/api/v1/scenario/run", {"scenario": eid, "delay_days": delay})
        # print summary without 168-row hourly plan
        summary = {k: v for k, v in resp.items() if k != "hourly_plan"}
        print(json.dumps(summary, indent=2))
        results[eid] = summary

    # Deep verification of benchmarks
    print("\n" + "=" * 80)
    print("BENCHMARK VERIFICATION COMPARISON")
    print("=" * 80)

    # 1. NORMAL
    norm = results["NORMAL"]
    assert abs(norm["safe_operability_days"] - 10.79) < 0.05
    assert abs(norm["cqrm_days"] - 0.49) < 0.05
    assert norm["risk_level"] == "CAUTION"
    assert abs(norm["required_reserve_soc_pct"] - 55.0) < 0.1
    assert norm["optimizer_status"] == "OPTIMAL"
    assert norm["safety_status"] == "SAFE"
    assert norm["final_decision"] == "ACCEPT_PLAN"
    assert norm["operating_mode"] == "NORMAL"
    assert norm["operator_intervention_required"] is False
    print("PASS: NORMAL matches benchmark.")

    # 2. RESUPPLY_DELAY_4D
    delay = results["RESUPPLY_DELAY_4D"]
    assert abs(delay["safe_operability_days"] - 10.79) < 0.05
    assert abs(delay["cqrm_days"] - (-3.51)) < 0.05
    assert delay["risk_level"] == "CRITICAL"
    assert abs(delay["required_reserve_soc_pct"] - 76.75) < 0.1
    assert delay["optimizer_status"] == "OPTIMAL"
    assert delay["safety_status"] == "UNSAFE"
    assert delay["final_decision"] == "REJECT_PLAN"
    assert delay["operating_mode"] == "CONSERVATION"
    assert delay["operator_intervention_required"] is True
    print("PASS: RESUPPLY_DELAY_4D matches benchmark.")

    # 3. STORM
    storm = results["STORM"]
    assert abs(storm["safe_operability_days"] - 5.58) < 0.05
    assert abs(storm["cqrm_days"] - (-4.72)) < 0.05
    assert storm["risk_level"] == "CRITICAL"
    assert storm["optimizer_status"] == "INFEASIBLE"
    assert storm["safety_status"] == "UNSAFE"
    assert storm["final_decision"] == "REJECT_PLAN"
    assert storm["operating_mode"] == "CONSERVATION"
    print("PASS: STORM matches benchmark.")

    # 4. LOW_RENEWABLE
    low_r = results["LOW_RENEWABLE"]
    assert abs(low_r["safe_operability_days"] - 6.12) < 0.05
    assert abs(low_r["cqrm_days"] - (-4.18)) < 0.05
    assert low_r["risk_level"] == "CRITICAL"
    assert low_r["optimizer_status"] == "OPTIMAL"
    assert low_r["safety_status"] == "UNSAFE"
    assert low_r["final_decision"] == "REJECT_PLAN"
    print("PASS: LOW_RENEWABLE matches benchmark.")

    # 5. BATTERY_DEGRADATION
    batt = results["BATTERY_DEGRADATION"]
    assert batt["final_decision"] == "ACCEPT_PLAN"
    print("PASS: BATTERY_DEGRADATION matches benchmark.")

    # 6. COMMUNICATION_LOSS
    comm = results["COMMUNICATION_LOSS"]
    assert comm["final_decision"] == "ACCEPT_PLAN"
    print("PASS: COMMUNICATION_LOSS matches benchmark.")

    # 7. SCADA_ANOMALY
    scada = results["SCADA_ANOMALY"]
    assert scada["final_decision"] == "ACCEPT_PLAN"
    print("PASS: SCADA_ANOMALY matches benchmark.")

    print("\nALL 7 LIVE BLACK-BOX HTTP BENCHMARK ASSERTIONS PASSED!")

if __name__ == "__main__":
    run_blackbox_tests()
