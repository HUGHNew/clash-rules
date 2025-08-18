# /// script
# dependencies = [
#   "pyyaml",
#   "requests",
# ]
# ///

import argparse
import os
from typing import Union

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
        value.extend(origin[key])
        origin[key] = value
    else:
        origin[key] = value


def merge_config(config_file: str, override_file: str) -> dict:
    config = safe_load_yaml(config_file)
    config_overrides = safe_load_yaml(override_file)

    merge_keys = config_overrides.pop("merge_keys")
    for key, value in config_overrides.items():
        merge_config_item(config, value, key, merge_keys)
    return config


def get_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", type=str, help="remote config from url")
    parser.add_argument(
        "override", type=str, default="", help="overrides to merge with config"
    )
    parser.add_argument(
        "storage",
        type=str,
        help="storage path for configs",
    )
    return parser.parse_args()


def update_config_with_defaults(url: str, default: str, storage: str):
    config = merge_config(url, default)
    safe_dump_yaml(config, storage)


if __name__ == "__main__":
    args = get_args()
    update_config_with_defaults(args.url, args.override, args.storage)
