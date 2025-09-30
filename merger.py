# /// script
# dependencies = [
#   "pyyaml",
#   "requests",
# ]
# ///

import argparse
import os
from typing import Union
import json

import requests
import yaml


def safe_load_yaml(file: str) -> dict:
    if len(file) == 0:
        return {}
    elif file.startswith("http"):
        content = requests.get(file).text
    elif os.path.exists(file):
        with open(file, "r") as f:
            content = f.read()
    else:
        content = file
    return yaml.safe_load(content)


def safe_dump_yaml(data: dict, file: str):
    with open(file, "w") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)


def load_json(file: str):
    with open(file, "r") as f:
        return json.load(f)


def merge_config_item(
    origin: dict, value: Union[dict, list, object], key: str, merge_keys: list
):
    if not (key in origin and key in merge_keys):
        origin[key] = value
        return
    if isinstance(value, dict):
        for k, v in value.items():
            merge_config_item(origin[key], v, k, merge_keys)
    elif isinstance(value, list):
        # require dedup?
        value.extend(origin[key])
        origin[key] = value
    else:
        origin[key] = value


def merge_config(config_file: str, rule_json: str, override_file: str) -> dict:
    config = safe_load_yaml(config_file)
    config_overrides = safe_load_yaml(override_file)
    rule_file = os.path.join(os.path.dirname(override_file), rule_json)
    with open(rule_file) as fd:
        rules = json.load(fd)
    config_overrides["rules"] = rules

    merge_keys = config_overrides.pop("merge_keys")
    for key, value in config_overrides.items():
        merge_config_item(config, value, key, merge_keys)
    return config


def get_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", type=str, help="remote config from url")
    parser.add_argument(
        "override", type=str, default="defaults.yaml", help="overrides in yaml"
    )
    parser.add_argument(
        "rules", type=str, default="definedRules.json", help="rules from json"
    )
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default="config.yaml",
        help="storage path for configs",
    )
    return parser.parse_args()


def update_config_with_defaults(url: str, rules: str, default: str, storage: str):
    config = merge_config(url, rules, default)
    safe_dump_yaml(config, storage)


if __name__ == "__main__":
    args = get_args()
    update_config_with_defaults(args.url, args.rules, args.override, args.output)
