// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * ForensicEvidence — immutable chain-of-custody registry for AI-Detective-K.
 *
 * Role model:
 *   DEFAULT_ADMIN_ROLE  — can grant/revoke INVESTIGATOR_ROLE
 *   INVESTIGATOR_ROLE   — can create cases, record captures/reports, finalize
 *   Anyone              — can verify hashes and read custody entries
 */
contract ForensicEvidence is AccessControl, ReentrancyGuard {
    bytes32 public constant INVESTIGATOR_ROLE = keccak256("INVESTIGATOR_ROLE");

    // ─── Data structures ────────────────────────────────────────────────────

    struct Case {
        bool exists;
        bool isSealed;
        uint256 createdAt;
        uint256 finalizedAt;
        address investigator;
    }

    struct CustodyEntry {
        uint256 timestamp;
        string  eventType;
        bytes32 dataHash;
        address actor;
    }

    // ─── Storage ────────────────────────────────────────────────────────────

    mapping(string => Case)           public cases;
    mapping(string => CustodyEntry[]) private _custody;
    // Track every hash ever recorded for a case for O(1) verifyHash
    mapping(string => mapping(bytes32 => bool)) private _knownHashes;

    // ─── Events ─────────────────────────────────────────────────────────────

    event CaseCreated(
        string  indexed caseId,
        bytes32         metadataHash,
        address         investigator,
        uint256         timestamp
    );
    event SceneCaptured(
        string  indexed caseId,
        bytes32         eventsHash,
        uint256         eventCount,
        uint256         timestamp
    );
    event ReportGenerated(
        string  indexed caseId,
        bytes32         reportHash,
        string          threatLevel,
        uint256         subjectCount,
        uint256         timestamp
    );
    event CaseFinalized(string indexed caseId, uint256 timestamp);
    event InvestigatorAuthorized(address indexed investigator, address indexed admin);
    event InvestigatorRevoked(address indexed investigator, address indexed admin);

    // ─── Errors ─────────────────────────────────────────────────────────────

    error EmptyString();
    error CaseAlreadyExists(string caseId);
    error CaseNotFound(string caseId);
    error CaseAlreadySealed(string caseId);
    error ZeroAddress();

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier notEmpty(string calldata s) {
        if (bytes(s).length == 0) revert EmptyString();
        _;
    }

    modifier caseExists(string calldata caseId) {
        if (!cases[caseId].exists) revert CaseNotFound(caseId);
        _;
    }

    modifier notSealed(string calldata caseId) {
        if (cases[caseId].isSealed) revert CaseAlreadySealed(caseId);
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // Admin is also first investigator so they can test immediately after deploy
        _grantRole(INVESTIGATOR_ROLE, msg.sender);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function authorizeInvestigator(address investigator)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (investigator == address(0)) revert ZeroAddress();
        _grantRole(INVESTIGATOR_ROLE, investigator);
        emit InvestigatorAuthorized(investigator, msg.sender);
    }

    function revokeInvestigator(address investigator)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (investigator == address(0)) revert ZeroAddress();
        _revokeRole(INVESTIGATOR_ROLE, investigator);
        emit InvestigatorRevoked(investigator, msg.sender);
    }

    // ─── Write functions (investigators only) ───────────────────────────────

    /**
     * createCase — called when recording starts.
     * @param caseId       Unique case identifier, e.g. "DK-20260418-000001"
     * @param metadataHash keccak256 hash of case metadata JSON
     */
    function createCase(string calldata caseId, bytes32 metadataHash)
        external
        nonReentrant
        onlyRole(INVESTIGATOR_ROLE)
        notEmpty(caseId)
    {
        if (cases[caseId].exists) revert CaseAlreadyExists(caseId);
        require(metadataHash != bytes32(0), "ForensicEvidence: zero hash");

        cases[caseId] = Case({
            exists:       true,
            isSealed:     false,
            createdAt:    block.timestamp,
            finalizedAt:  0,
            investigator: msg.sender
        });

        _appendCustody(caseId, "CASE_CREATED", metadataHash);
        _knownHashes[caseId][metadataHash] = true;

        emit CaseCreated(caseId, metadataHash, msg.sender, block.timestamp);
    }

    /**
     * recordSceneCapture — called after stop-recording, before report generation.
     * @param caseId      Case identifier
     * @param eventsHash  keccak256 hash of all captured events JSON
     * @param eventCount  Number of individual events captured
     * @param sensors     List of active sensor names (e.g. ["rgb","thermal"])
     */
    function recordSceneCapture(
        string   calldata   caseId,
        bytes32             eventsHash,
        uint256             eventCount,
        string[] calldata   sensors
    )
        external
        nonReentrant
        onlyRole(INVESTIGATOR_ROLE)
        notEmpty(caseId)
        caseExists(caseId)
        notSealed(caseId)
    {
        require(eventsHash != bytes32(0), "ForensicEvidence: zero hash");
        require(sensors.length > 0, "ForensicEvidence: no sensors");

        _appendCustody(caseId, "SCENE_CAPTURED", eventsHash);
        _knownHashes[caseId][eventsHash] = true;

        emit SceneCaptured(caseId, eventsHash, eventCount, block.timestamp);
    }

    /**
     * recordReportGeneration — called after AI report is generated.
     * @param caseId       Case identifier
     * @param reportHash   keccak256 hash of the full report JSON
     * @param threatLevel  Threat classification string (e.g. "high")
     * @param subjectCount Number of detected subjects
     */
    function recordReportGeneration(
        string  calldata caseId,
        bytes32          reportHash,
        string  calldata threatLevel,
        uint256          subjectCount
    )
        external
        nonReentrant
        onlyRole(INVESTIGATOR_ROLE)
        notEmpty(caseId)
        notEmpty(threatLevel)
        caseExists(caseId)
        notSealed(caseId)
    {
        require(reportHash != bytes32(0), "ForensicEvidence: zero hash");

        _appendCustody(caseId, "REPORT_GENERATED", reportHash);
        _knownHashes[caseId][reportHash] = true;

        emit ReportGenerated(caseId, reportHash, threatLevel, subjectCount, block.timestamp);
    }

    /**
     * finalizeCase — permanently seals the case; no further writes allowed.
     */
    function finalizeCase(string calldata caseId)
        external
        nonReentrant
        onlyRole(INVESTIGATOR_ROLE)
        notEmpty(caseId)
        caseExists(caseId)
        notSealed(caseId)
    {
        cases[caseId].isSealed    = true;
        cases[caseId].finalizedAt = block.timestamp;

        bytes32 finalHash = keccak256(abi.encodePacked(caseId, block.timestamp));
        _appendCustody(caseId, "CASE_FINALIZED", finalHash);

        emit CaseFinalized(caseId, block.timestamp);
    }

    // ─── Read functions (public, no gas for off-chain callers) ──────────────

    /**
     * verifyHash — returns true if `hash` was ever recorded for this case.
     */
    function verifyHash(string calldata caseId, bytes32 hash)
        external
        view
        returns (bool)
    {
        if (!cases[caseId].exists) return false;
        return _knownHashes[caseId][hash];
    }

    /**
     * getChainOfCustody — returns all custody entries for a case.
     */
    function getChainOfCustody(string calldata caseId)
        external
        view
        caseExists(caseId)
        returns (CustodyEntry[] memory)
    {
        return _custody[caseId];
    }

    // ─── Internal helpers ───────────────────────────────────────────────────

    function _appendCustody(
        string memory caseId,
        string memory eventType,
        bytes32       dataHash
    ) internal {
        _custody[caseId].push(CustodyEntry({
            timestamp: block.timestamp,
            eventType: eventType,
            dataHash:  dataHash,
            actor:     msg.sender
        }));
    }
}
