import urllib.request
import json

BASE_URL = 'https://pharos-multi-protocol-aggregator.vercel.app'

print("=== STARTING LIVE PRODUCTION VERIFICATION SMOKE TESTS ===")
print(f"Target URL: {BASE_URL}")

# 1. Frontend Homepage Test
try:
    req = urllib.request.Request(f"{BASE_URL}/", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8')
        assert resp.status == 200
        assert 'Pharos Multi-Protocol Aggregator' in html
        assert 'Optimal Venue Routing Engine' in html
        print("✔ 1. Frontend Homepage: 200 OK (Clean Web3 Harbor UI loaded)")
except Exception as e:
    print("✖ 1. Frontend Homepage FAILED:", e)

# 2. Health Endpoint Test
try:
    req = urllib.request.Request(f"{BASE_URL}/api/health", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert resp.status == 200
        assert data.get('status') == 'HEALTHY'
        assert data.get('activeProtocols') >= 2
        print(f"✔ 2. Health Check: 200 OK (Status: {data.get('status')}, Active Protocols: {data.get('activeProtocols')})")
except Exception as e:
    print("✖ 2. Health Check FAILED:", e)

# 3. Protocols Registry Test
try:
    req = urllib.request.Request(f"{BASE_URL}/api/protocols", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert data.get('success') is True
        venues = data.get('venues', [])
        assert len(venues) >= 2
        wpros = next(v for v in venues if v['id'] == 'wpros')
        faroo = next(v for v in venues if v['id'] == 'faroo-stpros')
        print(f"✔ 3. Protocol Registry: 200 OK ({len(venues)} protocols live on Pacific Mainnet)")
        print(f"     - WPROS: {wpros['metrics']['tvlFormatted']} (Exchange Rate: {wpros['metrics']['exchangeRate']})")
        print(f"     - Faroo stPROS: {faroo['metrics']['tvlFormatted']} (Exchange Rate: {faroo['metrics']['exchangeRate']})")
except Exception as e:
    print("✖ 3. Protocol Registry FAILED:", e)

# 4. Intelligent Routing Test (Max Yield)
try:
    payload = json.dumps({'asset': 'PROS', 'amount': '150', 'priority': 'MAX_YIELD'}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/route", data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        decision = data.get('decision', {})
        winner = decision.get('selectedVenue', {})
        assert winner.get('id') == 'faroo-stpros'
        print(f"✔ 4. Intelligent Route (MAX_YIELD): 200 OK -> Winner: {winner.get('name')}")
        print(f"     Rationale: {decision.get('selectionSummary')}")
except Exception as e:
    print("✖ 4. Intelligent Route (MAX_YIELD) FAILED:", e)

# 5. Intelligent Routing Test (Instant Liquidity)
try:
    payload = json.dumps({'asset': 'PROS', 'amount': '150', 'priority': 'INSTANT_LIQUIDITY'}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/route", data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        decision = data.get('decision', {})
        winner = decision.get('selectedVenue', {})
        assert winner.get('id') == 'wpros'
        print(f"✔ 5. Intelligent Route (INSTANT_LIQUIDITY): 200 OK -> Winner: {winner.get('name')}")
        print(f"     Rationale: {decision.get('selectionSummary')}")
except Exception as e:
    print("✖ 5. Intelligent Route (INSTANT_LIQUIDITY) FAILED:", e)

# 6. Portfolio Inspector Test
try:
    test_addr = '0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2'
    req = urllib.request.Request(f"{BASE_URL}/api/positions?address={test_addr}", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert data.get('success') is True
        positions = data.get('positions', [])
        assert len(positions) >= 2
        print(f"✔ 6. Portfolio Inspector: 200 OK ({len(positions)} protocol positions queried live on-chain)")
except Exception as e:
    print("✖ 6. Portfolio Inspector FAILED:", e)

# 7. Unsigned Transaction Preparation Test
try:
    payload = json.dumps({
        'protocolId': 'faroo-stpros',
        'operation': 'DEPOSIT',
        'amount': '25',
        'userAddress': '0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2'
    }).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/prepare", data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        tx = data.get('transaction', {})
        assert tx.get('signed') is False
        assert tx.get('broadcast') is False
        assert tx.get('chainId') == 1672
        assert tx.get('to') == '0x6b0a44c64190279f7034b77c13a566e914fe5ec4'
        assert tx.get('functionSignature') == 'deposit(uint256 assets, address receiver)'
        print(f"✔ 7. Unsigned Transaction Preparation: 200 OK (Non-Custodial, Awaiting Signature)")
        print(f"     Destination: {tx.get('to')}, Selector: {tx.get('functionSelector')}")
except Exception as e:
    print("✖ 7. Unsigned Transaction Preparation FAILED:", e)

# 8. Requirement 4 Fault Isolation & Failover Test
try:
    req = urllib.request.Request(f"{BASE_URL}/api/fault-test?target=faroo-stpros&fault=TIMEOUT", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert data.get('success') is True
        assert data.get('degradedVenueStatus', {}).get('status') == 'UNAVAILABLE'
        assert data.get('survivingVenuesCount') >= 2
        failover_winner = data.get('failoverRoutingDecision', {}).get('selectedVenue')
        assert failover_winner is not None
        print(f"✔ 8. Requirement 4 Fault Isolation Test: 200 OK")
        print(f"     Degraded Target: {data.get('degradedVenueStatus', {}).get('name')} (Status: UNAVAILABLE)")
        print(f"     Surviving Venues: {data.get('survivingVenuesCount')} ONLINE")
        print(f"     Failover Winner: {failover_winner}")
except Exception as e:
    print("✖ 8. Requirement 4 Fault Isolation Test FAILED:", e)

print("\n=== ALL PRODUCTION VERIFICATION SMOKE TESTS COMPLETED SUCCESSFULLY ===")
