# AI-Detective-K — Flare Blockchain Integration Plan

> **Goal:** Integrate Flare blockchain for immutable chain of custody and evidence integrity.
> **Strategy:** Dockerize first, then add Flare infrastructure incrementally.

---

## 📊 Current State Summary

| Component | Status |
|-----------|--------|
| Backend (FastAPI) | ✅ Working |
| Frontend (React + Vite) | ✅ Working |
| OAK-D Camera | 🟡 Wired, async bug |
| Database | ❌ None (in-memory) |
| Blockchain | ❌ Not started |
| Docker | ❌ Not started |

---

## 🎯 Implementation Phases

```
PHASE 1: Dockerize Everything        (Foundation)
    ↓
PHASE 2: Add Database Layer          (Persistence)
    ↓
PHASE 3: Deploy Smart Contract       (Blockchain)
    ↓
PHASE 4: Build Flare Service         (Integration)
    ↓
PHASE 5: Wire Into Main App          (4 Touch Points)
    ↓
PHASE 6: Frontend Verification UI    (User Display)
    ↓
PHASE 7: Testing & Deployment        (Production)
```

**Total Estimated Time:** 2-3 weeks

---

# PHASE 1: DOCKERIZE EVERYTHING

**Why first:** Docker makes adding blockchain services trivial. No more "works on my machine."

**Duration:** 2-3 days

## 1.1 Project Structure Reorganization

```
AI-Detective-K/
├── docker-compose.yml              ← NEW
├── docker-compose.dev.yml          ← NEW (dev overrides)
├── .env.example                    ← NEW
├── .env                            ← NEW (gitignored)
├── .dockerignore                   ← NEW
│
├── backend/
│   ├── Dockerfile                  ← NEW
│   ├── requirements.txt
│   ├── main.py
│   └── src/                        ← NEW (refactored structure)
│       ├── __init__.py
│       ├── api/                    ← Split main.py
│       │   ├── routes.py
│       │   └── websocket.py
│       ├── services/               ← Business logic
│       │   ├── event_service.py
│       │   ├── report_service.py
│       │   └── camera_service.py
│       ├── models/                 ← Data models
│       │   └── schemas.py
│       └── config.py               ← Settings
│
├── frontend/
│   ├── Dockerfile                  ← NEW
│   ├── nginx.conf                  ← NEW (for production)
│   ├── package.json
│   └── src/
│
├── blockchain/                     ← NEW FOLDER (Phase 3)
│   ├── Dockerfile
│   ├── contracts/
│   │   └── ForensicEvidence.sol
│   ├── scripts/
│   │   └── deploy.js
│   ├── hardhat.config.js
│   └── package.json
│
├── database/                       ← NEW FOLDER (Phase 2)
│   ├── init.sql
│   └── migrations/
│
└── README.md
```

## 1.2 Tasks

### Task 1.2.1 — Create Backend Dockerfile
```
File: backend/Dockerfile

Requirements:
- Python 3.11 base image
- Install system deps (libusb for OAK camera)
- Install Python dependencies
- Expose port 8000
- Run uvicorn with hot reload in dev
```

**⚠️ Camera challenge:** OAK-D needs USB access. Use `--privileged` mode or mount `/dev/bus/usb`.

### Task 1.2.2 — Create Frontend Dockerfile
```
File: frontend/Dockerfile

Multi-stage build:
- Stage 1: Node 20 alpine — build React app
- Stage 2: Nginx alpine — serve static files
```

### Task 1.2.3 — Create docker-compose.yml
```
Services:
- backend (FastAPI on port 8000)
- frontend (Nginx on port 5000)
- postgres (Phase 2, but scaffold now)
- hardhat (Phase 3, local blockchain)

Networks:
- app-network (bridge)

Volumes:
- postgres-data
- camera-data
```

### Task 1.2.4 — Create .env.example
```
# Server
BACKEND_PORT=8000
FRONTEND_PORT=5000

# Database (Phase 2)
DATABASE_URL=postgresql://user:password@postgres:5432/ai_detective_k

# Flare Blockchain (Phase 3+)
FLARE_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_CONTRACT_ADDRESS=
FLARE_PRIVATE_KEY=
FLARE_CHAIN_ID=114

# Camera
OAK_IR_BRIGHTNESS=500
```

### Task 1.2.5 — Test Docker Setup
```
Commands to verify:
- docker-compose build
- docker-compose up
- curl http://localhost:8000/api/status
- Open http://localhost:5000 in browser
- WebSocket connection works
- Camera USB access works (Linux only initially)
```

## 1.3 Phase 1 Deliverables

- [ ] `backend/Dockerfile` created and working
- [ ] `frontend/Dockerfile` created and working
- [ ] `docker-compose.yml` runs both services
- [ ] `.env.example` with all variables documented
- [ ] `.dockerignore` excludes node_modules, __pycache__, etc.
- [ ] Camera still works inside Docker (Linux host)
- [ ] README updated with Docker instructions
- [ ] `docker-compose up` starts everything

---

# PHASE 2: ADD DATABASE LAYER

**Why before blockchain:** Need persistent `case_id` and event storage.

**Duration:** 2-3 days

## 2.1 Tasks

### Task 2.1.1 — Add PostgreSQL to docker-compose.yml
```
Service: postgres
Image: postgres:16-alpine
Volumes: Persistent data
Init script: database/init.sql
```

### Task 2.1.2 — Install SQLAlchemy + Alembic
```
File: backend/requirements.txt

Add:
- sqlalchemy>=2.0
- alembic>=1.13
- asyncpg>=0.29  (async driver)
- pydantic-settings>=2.0
```

### Task 2.1.3 — Create Database Models
```
File: backend/src/models/database.py

Tables to create (from existing report):
- cases
- events
- reports
- blockchain_records  (preparation for Phase 3)
```

### Task 2.1.4 — Refactor main.py to Use Database
```
Replace in-memory `events: list[dict]` with database operations.

Changes:
- Create case on "start" action
- Persist events during capture
- Store reports permanently
- Query historical data
```

### Task 2.1.5 — Add Alembic Migrations
```
Commands:
- alembic init migrations
- alembic revision --autogenerate -m "initial"
- alembic upgrade head
```

### Task 2.1.6 — New API Endpoints
```
Add routes:
- GET  /api/cases          (list all cases)
- GET  /api/cases/{id}     (get case details)
- GET  /api/cases/{id}/events  (get events)
- POST /api/cases/{id}/finalize  (prep for blockchain)
```

## 2.2 Phase 2 Deliverables

- [ ] PostgreSQL running in Docker
- [ ] SQLAlchemy models defined
- [ ] Alembic migrations working
- [ ] Events persist across restarts
- [ ] `case_id` stored and retrievable
- [ ] New REST endpoints functional
- [ ] Frontend updated to fetch from DB

---

# PHASE 3: DEPLOY SMART CONTRACT

**Goal:** Get a working smart contract on Flare Coston2 testnet.

**Duration:** 3-4 days

## 3.1 Smart Contract Design

### Contract: `ForensicEvidence.sol`

**Functions needed:**
```
1. createCase(caseId, metadataHash)
   - Called: When recording starts
   - Emits: CaseCreated event
   - Access: Only authorized investigators

2. recordSceneCapture(caseId, eventsHash, eventCount, sensorsUsed)
   - Called: After "stop" action, before report
   - Emits: SceneCaptured event

3. recordReportGeneration(caseId, reportHash, threatLevel, subjectCount)
   - Called: After report generated
   - Emits: ReportGenerated event

4. finalizeCase(caseId)
   - Called: When detective approves
   - Seals case - no more writes
   - Emits: CaseFinalized event

5. verifyHash(caseId, hash) → bool
   - Called: Anyone
   - Returns: True if hash matches any record
   - Read-only, no gas cost for callers

6. getChainOfCustody(caseId) → CustodyEntry[]
   - Returns: All transactions for this case
   - Read-only
```

**State variables:**
```
- mapping(string => Case) public cases
- mapping(string => CustodyEntry[]) public custody
- mapping(address => bool) public authorizedInvestigators
- address public admin
```

**Access control:**
```
- Only admin can add investigators
- Only authorized investigators can write
- Anyone can verify/read
- Sealed cases are immutable
```

## 3.2 Tasks

### Task 3.2.1 — Setup Hardhat Project
```
File: blockchain/hardhat.config.js

Configure:
- Solidity compiler version
- Flare Coston2 testnet network
- Flare mainnet network
- Private key from .env
```

### Task 3.2.2 — Write Smart Contract
```
File: blockchain/contracts/ForensicEvidence.sol

Implement all 6 functions above.
Add events for transparency.
Add modifiers for access control.
Keep gas costs minimal.
```

### Task 3.2.3 — Write Deployment Script
```
File: blockchain/scripts/deploy.js

- Deploy contract to Coston2
- Save deployed address to .env
- Save ABI to backend/src/blockchain/contract_abi.json
- Verify contract on Flare explorer
```

### Task 3.2.4 — Get Testnet Tokens
```
Steps:
1. Create wallet (MetaMask)
2. Add Coston2 network
3. Get test FLR from faucet: https://faucet.flare.network
4. Add private key to .env (NEVER commit)
```

### Task 3.2.5 — Write Contract Tests
```
File: blockchain/test/ForensicEvidence.test.js

Test cases:
- Create case successfully
- Reject unauthorized writers
- Seal case prevents further writes
- Verify hash returns correct result
- Chain of custody retrieval works
```

### Task 3.2.6 — Deploy to Coston2 Testnet
```
Commands:
- npx hardhat compile
- npx hardhat test
- npx hardhat run scripts/deploy.js --network coston2
- Verify on https://coston2-explorer.flare.network
```

## 3.3 Phase 3 Deliverables

- [ ] Hardhat project configured
- [ ] Smart contract written and tested
- [ ] Contract deployed to Coston2 testnet
- [ ] Contract address saved in .env
- [ ] ABI exported for backend use
- [ ] Deployment documented

---

# PHASE 4: BUILD FLARE SERVICE

**Goal:** Python service to interact with deployed contract.

**Duration:** 3-4 days

## 4.1 Architecture

```
backend/src/blockchain/
├── __init__.py
├── flare_service.py        ← Main service class
├── hash_service.py         ← SHA-256 hashing utilities
├── contract_abi.json       ← From deployment
├── exceptions.py           ← Custom exceptions
└── config.py               ← Blockchain settings
```

## 4.2 Tasks

### Task 4.2.1 — Install Dependencies
```
Add to backend/requirements.txt:
- web3>=6.15.0
- eth-account>=0.11.0
- eth-utils>=4.0.0
```

### Task 4.2.2 — Create Hash Service
```
File: backend/src/blockchain/hash_service.py

Functions:
- hash_string(data: str) → bytes32
- hash_dict(data: dict) → bytes32  (deterministic)
- hash_file(path: str) → bytes32
- hash_events(events: list) → bytes32  (events_hash for Point 2)
```

### Task 4.2.3 — Create Flare Service
```
File: backend/src/blockchain/flare_service.py

Class: FlareBlockchainService

Methods (all async):
- __init__(rpc_url, contract_address, private_key)
- create_case(case_id, metadata) → TxResult
- record_scene_capture(case_id, events, sensors) → TxResult
- record_report(case_id, report) → TxResult
- finalize_case(case_id) → TxResult
- verify_hash(case_id, hash) → bool
- get_chain_of_custody(case_id) → list
- _send_transaction(function_call) → TxResult  (internal)
- _wait_for_receipt(tx_hash) → Receipt  (internal)
```

### Task 4.2.4 — Handle Transaction Errors
```
Edge cases:
- Network timeout → Retry with exponential backoff
- Insufficient gas → Log + alert
- Nonce conflicts → Refresh nonce, retry
- Contract reverted → Parse revert reason
- RPC down → Queue for later submission
```

### Task 4.2.5 — Add Database Integration
```
After each blockchain call:
- Save tx_hash to blockchain_records table
- Link to case_id
- Store block_number and timestamp
- Mark status (pending/confirmed/failed)
```

### Task 4.2.6 — Create Standalone Test Script
```
File: backend/tests/test_flare_service.py

Before integrating into main.py:
- Test each method in isolation
- Verify transactions on explorer
- Check error handling
```

## 4.3 Phase 4 Deliverables

- [ ] `flare_service.py` complete with all methods
- [ ] `hash_service.py` with tested utilities
- [ ] Error handling + retry logic
- [ ] Database integration for tx tracking
- [ ] Standalone tests passing
- [ ] Real transactions visible on Coston2 explorer

---

# PHASE 5: WIRE INTO MAIN APP

**Goal:** Connect Flare service to the 4 touch points identified.

**Duration:** 2-3 days

## 5.1 Integration Points

### Touch Point 1: Case Creation
```
Location: backend/main.py, "start" action handler

Before:
    recording = True
    events = []

After:
    recording = True
    events = []
    case_id = generate_case_id()
    
    # Save to database
    await db.create_case(case_id)
    
    # Record on Flare
    tx = await flare.create_case(case_id, {
        "sensors": ["rgb", "thermal", "depth"],
        "location": "Crime Scene"
    })
    
    # Save tx hash
    await db.save_blockchain_record(case_id, "case_created", tx)
    
    # Send to frontend
    await ws.send_json({
        "type": "case_created",
        "case_id": case_id,
        "blockchain_tx": tx.hash
    })
```

### Touch Point 2: Scene Capture
```
Location: backend/main.py, "stop" action handler (before report)

Add:
    # Hash all events
    events_data = await db.get_events(case_id)
    events_hash = hash_service.hash_events(events_data)
    
    # Record on Flare
    tx = await flare.record_scene_capture(
        case_id=case_id,
        events_hash=events_hash,
        event_count=len(events_data),
        sensors_used=["rgb", "thermal", "depth"]
    )
    
    await db.save_blockchain_record(case_id, "scene_captured", tx)
```

### Touch Point 3: Report Generation
```
Location: backend/main.py, after generate_incident_report()

Add:
    report_hash = hash_service.hash_dict(report)
    
    tx = await flare.record_report(
        case_id=case_id,
        report_hash=report_hash,
        threat_level=report["threat_assessment"]["level"],
        subject_count=len(report["subject_profiles"])
    )
    
    report["blockchain"] = {
        "tx_hash": tx.hash,
        "block_number": tx.block_number,
        "timestamp": tx.timestamp,
        "verified": True
    }
    
    await db.save_report(report)
    await db.save_blockchain_record(case_id, "report_generated", tx)
```

### Touch Point 4: Case Finalization
```
Location: backend/src/api/routes.py (new endpoint)

POST /api/cases/{case_id}/finalize

Logic:
    # Verify case exists and is not already sealed
    case = await db.get_case(case_id)
    if case.sealed:
        raise HTTPException(400, "Case already sealed")
    
    # Seal on blockchain
    tx = await flare.finalize_case(case_id)
    
    # Update database
    await db.seal_case(case_id, tx.hash)
    
    return {
        "case_id": case_id,
        "status": "sealed",
        "blockchain_tx": tx.hash,
        "block_number": tx.block_number
    }
```

## 5.2 Tasks

### Task 5.2.1 — Add hashlib import and case_id tracking
### Task 5.2.2 — Integrate Touch Point 1
### Task 5.2.3 — Integrate Touch Point 2
### Task 5.2.4 — Integrate Touch Point 3
### Task 5.2.5 — Create finalize endpoint (Touch Point 4)
### Task 5.2.6 — End-to-end test (start → stop → finalize)

## 5.3 Phase 5 Deliverables

- [ ] All 4 touch points integrated
- [ ] Case flow works start to finish
- [ ] Every case gets 4 blockchain transactions
- [ ] All tx hashes stored in database
- [ ] Frontend receives blockchain data
- [ ] No errors in 10 consecutive test runs

---

# PHASE 6: FRONTEND VERIFICATION UI

**Goal:** Show blockchain status to users.

**Duration:** 2-3 days

## 6.1 Tasks

### Task 6.1.1 — Blockchain Status Badge
```
Component: BlockchainBadge.jsx

Shows:
- Green checkmark if verified
- Red X if tampered
- Loading spinner while verifying
- Tx hash with copy button
- Link to Flare explorer
```

### Task 6.1.2 — Update IncidentReport.jsx
```
Add sections:
- Blockchain attestation header
- Chain of custody timeline
- QR code for mobile verification
- "Verify on Flare" button
```

### Task 6.1.3 — Finalize Case Button
```
Component: FinalizeCaseButton.jsx

States:
- Idle: "Finalize Case" (enabled)
- Loading: "Sealing on blockchain..."
- Success: "✓ Case sealed"
- Error: "Failed - retry?"
```

### Task 6.1.4 — Verification Page
```
Route: /verify

Features:
- Upload file (PDF/JSON)
- Calculates hash client-side
- Checks against Flare blockchain
- Shows verified/tampered status
- Displays full chain of custody
```

### Task 6.1.5 — Cases List Page
```
Route: /cases

Features:
- Table of all cases
- Status indicator (active/sealed)
- Blockchain verification status
- Click to view full report
```

## 6.2 Phase 6 Deliverables

- [ ] Blockchain badge on every report
- [ ] Chain of custody visible
- [ ] Finalize button working
- [ ] Verification page functional
- [ ] Cases list with blockchain status
- [ ] Mobile responsive

---

# PHASE 7: TESTING & DEPLOYMENT

**Duration:** 2-3 days

## 7.1 Testing Checklist

### Integration Tests
- [ ] Full flow: start → capture → stop → report → finalize
- [ ] Handles network failures gracefully
- [ ] Rejects tampered files correctly
- [ ] Multiple concurrent cases work
- [ ] Restart preserves all data

### Security Tests
- [ ] Private keys never in logs
- [ ] Unauthorized wallets rejected
- [ ] Sealed cases cannot be modified
- [ ] SQL injection prevented
- [ ] XSS prevented

### Performance Tests
- [ ] Transaction time <10 seconds
- [ ] Database handles 1000+ cases
- [ ] Frontend responsive with 100+ events
- [ ] Camera feed stable at 30fps

## 7.2 Documentation

### Required Docs
- [ ] README.md - Setup instructions
- [ ] DEPLOYMENT.md - Production deployment
- [ ] ARCHITECTURE.md - System design
- [ ] BLOCKCHAIN.md - Flare integration details
- [ ] API.md - All endpoints documented
- [ ] SECURITY.md - Key management, best practices

## 7.3 Production Deployment

### Infrastructure
- [ ] Production Docker images built
- [ ] Deploy to server (AWS/Azure/on-prem)
- [ ] PostgreSQL production instance
- [ ] HTTPS certificates (Let's Encrypt)
- [ ] Domain configured
- [ ] Monitoring (logs, metrics)

### Blockchain
- [ ] Deploy contract to Flare mainnet
- [ ] Fund production wallet
- [ ] Update .env with mainnet details
- [ ] Test one real transaction
- [ ] Setup contract monitoring

---

# 🎯 Key Decisions Needed

Before starting, confirm these with your team:

1. **Testnet vs Mainnet for MVP?**
   - Recommendation: Start with Coston2 testnet
   - Move to mainnet only for production

2. **Single wallet vs per-investigator wallets?**
   - MVP: Single agency wallet
   - Production: Per-investigator wallets

3. **Smart contract upgradability?**
   - Recommendation: Non-upgradable for MVP (simpler, more secure)
   - Use proxy pattern only if needed

4. **Private key storage?**
   - MVP: .env file
   - Production: AWS KMS / Azure Key Vault / Hardware wallet

5. **PostgreSQL vs MongoDB?**
   - Recommendation: PostgreSQL (relational data)

6. **Camera in Docker?**
   - Linux: Yes (USB passthrough)
   - Windows/Mac dev: Run camera service outside Docker

---

# 📋 Quick Start Order

For the impatient:

```
Week 1: Phase 1 (Docker) + Phase 2 (Database)
Week 2: Phase 3 (Contract) + Phase 4 (Service)
Week 3: Phase 5 (Integration) + Phase 6 (Frontend) + Phase 7 (Testing)
```

---

# 🚨 Critical Warnings

1. **NEVER commit private keys** - Use .env and .gitignore
2. **NEVER skip testing on Coston2** before mainnet
3. **NEVER store large files on blockchain** - Only hashes
4. **ALWAYS hash deterministically** - Sort keys in JSON
5. **ALWAYS handle transaction failures** - Retry logic essential
6. **ALWAYS verify contract address** - Phishing attacks exist

---

# 📚 Resources

## Flare Network
- Main Docs: https://docs.flare.network/
- Coston2 Faucet: https://faucet.flare.network
- Coston2 Explorer: https://coston2-explorer.flare.network
- Mainnet Explorer: https://flare-explorer.flare.network

## Smart Contracts
- Hardhat Docs: https://hardhat.org/docs
- Solidity Docs: https://docs.soliditylang.org/
- OpenZeppelin: https://docs.openzeppelin.com/contracts

## Web3 Python
- web3.py: https://web3py.readthedocs.io/
- eth-account: https://eth-account.readthedocs.io/

## Docker
- Docker Compose: https://docs.docker.com/compose/
- Python Docker: https://docs.docker.com/language/python/
- Node Docker: https://docs.docker.com/language/nodejs/

---

# ✅ Completion Criteria

The integration is complete when:

- [ ] Every case creates 4 blockchain transactions
- [ ] All files can be verified against blockchain
- [ ] Chain of custody is complete and visible
- [ ] System works entirely in Docker
- [ ] Documentation is comprehensive
- [ ] Tests pass consistently
- [ ] Production deployment documented

---

**Next Step:** Start with Phase 1 (Dockerization). Once Docker is working, everything else becomes easier.
