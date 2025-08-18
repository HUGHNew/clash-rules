# ClashMerger

Merger for clash rules (yaml)

Usage:
```bash
uv run merger.py <subscription-url-or-local-file> defaults.yaml <merge-file>
```


Specific field for merge control. The script will merge the specific fields instead of update.
```yaml
# meta value for merge
merge_keys:
  - dns
  - rules
```

For example, the `<merge-file>` will prepend the `rules` instead of using the `rules` in defaults.yaml only.