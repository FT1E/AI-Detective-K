import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

load_dotenv()

CONTRACT_ABI_PATH = Path(__file__).parent.parent.parent / "contracts" / "ForensicEvidence.json"



class FlareService:
    def __init__(self):
        self.enabled = False
        self.rpc_url = os.getenv("FLARE_RPC_URL", "https://coston2-api.flare.network/ext/C/rpc")
        self.contract_address = os.getenv("FLARE_CONTRACT_ADDRESS")
        self.private_key = os.getenv("FLARE_PRIVATE_KEY")

        if not self.contract_address or not self.private_key:
            print("WARNING: FLARE_CONTRACT_ADDRESS or FLARE_PRIVATE_KEY not set — blockchain disabled")
            return

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if not self.w3.is_connected():
            print(f"WARNING: Could not connect to Flare RPC at {self.rpc_url} — blockchain disabled")
            return

        self.account = Account.from_key(self.private_key)

        with open(CONTRACT_ABI_PATH) as f:
            contract_json = json.load(f)

        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.contract_address),
            abi=contract_json["abi"],
        )
        self.enabled = True
        print(f"Flare service connected — account: {self.account.address}")

    def _assert_enabled(self):
        if not self.enabled:
            raise RuntimeError("Blockchain service is not initialized — check FLARE_CONTRACT_ADDRESS and FLARE_PRIVATE_KEY")

    def _build_and_send(self, fn) -> dict:
        """Build, sign, send a contract transaction and wait for receipt (blocking)."""
        tx = fn.build_transaction({
            "from": self.account.address,
            "nonce": self.w3.eth.get_transaction_count(self.account.address),
            "gas": 300000,
            "gasPrice": self.w3.eth.gas_price,
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "tx_hash": receipt["transactionHash"].hex(),
            "block_number": receipt["blockNumber"],
            "gas_used": receipt["gasUsed"],
        }

    async def create_case(self, case_id: str, metadata: dict) -> dict:
        self._assert_enabled()
        metadata_hash = Web3.keccak(text=json.dumps(metadata, sort_keys=True))
        fn = self.contract.functions.createCase(case_id, metadata_hash)
        return await asyncio.to_thread(self._build_and_send, fn)

    async def record_scene_capture(
        self, case_id: str, events_hash: bytes, event_count: int, sensors: list
    ) -> dict:
        self._assert_enabled()
        fn = self.contract.functions.recordSceneCapture(
            case_id, events_hash, event_count, sensors
        )
        return await asyncio.to_thread(self._build_and_send, fn)

    async def record_report_generation(
        self, case_id: str, report_hash: bytes, threat_level: str, subject_count: int
    ) -> dict:
        self._assert_enabled()
        fn = self.contract.functions.recordReportGeneration(
            case_id, report_hash, threat_level, subject_count
        )
        return await asyncio.to_thread(self._build_and_send, fn)

    async def finalize_case(self, case_id: str) -> dict:
        self._assert_enabled()
        fn = self.contract.functions.finalizeCase(case_id)
        return await asyncio.to_thread(self._build_and_send, fn)

    async def verify_hash(self, case_id: str, data_hash: bytes) -> bool:
        self._assert_enabled()
        return await asyncio.to_thread(
            self.contract.functions.verifyHash(case_id, data_hash).call
        )

    async def get_chain_of_custody(self, case_id: str) -> list:
        self._assert_enabled()
        custody = await asyncio.to_thread(
            self.contract.functions.getChainOfCustody(case_id).call
        )
        return [
            {
                "timestamp": entry[0],
                "event_type": entry[1],
                "data_hash": entry[2].hex(),
                "actor": entry[3],
            }
            for entry in custody
        ]


flare_service = FlareService()
