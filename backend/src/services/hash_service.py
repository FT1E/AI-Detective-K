from web3 import Web3
import json


def hash_dict(data: dict) -> bytes:
    """Create deterministic keccak256 hash of a dictionary."""
    json_str = json.dumps(data, sort_keys=True, default=str)
    return Web3.keccak(text=json_str)


def hash_events(events: list) -> bytes:
    """Create keccak256 hash of an event list."""
    return hash_dict({"events": events})
