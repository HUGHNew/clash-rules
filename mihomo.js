// Global Script for ClashVergeRev

selfDefinedRules = [] // copy it from definedRules.json
selfDefinedGroups = {
  "Codex": ["🇸🇬", "🇺🇸"],
  "Gemini": ["🇺🇸"],
  // "Claude": ["🇸🇬", "🇺🇸"], // ignore it
}

function main(config, profileName) {
  groupProxiesBy(config);
  addRules(config);
  return config;
}

function addRules(config, definedRules = selfDefinedRules) {
  config["rules"] = definedRules.concat(config["rules"]);
  return config
}

// Return the first Unicode character of the string if it is a region/country
// (flag) emoji; otherwise return null.
function get_region_emoji(str) {
  if (!str) return null;
  const chars = Array.from(str);
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0);
    if (cp >= 0x1f1e6 && cp <= 0x1f1ff) {
      const next = chars[i + 1];
      if (next) {
        const cp2 = next.codePointAt(0);
        if (cp2 >= 0x1f1e6 && cp2 <= 0x1f1ff) return chars[i] + next;
      }
      return null; // lone Regional Indicator, not a full flag
    }
  }
  return null;
}

// Extract a region name from a proxy name.
// Handles patterns like:
//   '🇸🇬|新加坡-中转 02'  -> '新加坡'
//   '🇯🇵|日本-IEPL 01'    -> '日本'
//   '🇺🇸 美国01'          -> '美国'
//   '🇺🇸 美国-01'         -> '美国'
// Returns null if no region name can be derived.
function get_region_name(str) {
  if (!str) return null;

  let rest = str;

  // Strip a leading region/flag emoji if present.
  const flag = get_region_emoji(str);
  if (flag) {
    rest = str.slice(flag.length);
  }

  // Trim leading separators / whitespace: |, ｜, -, _, space, etc.
  rest = rest.replace(/^[\s|｜\-_·•:：]+/, "");

  // Cut at the first separator or a trailing digit sequence.
  // Separators include | ｜ - _ · • : ： and whitespace.
  // Also stop before digits so '美国01' -> '美国'.
  const match = rest.match(/^[^|\-–—_·•:：\s\d]+/);
  if (!match) return null;

  const name = match[0].trim();
  return name || null;
}

// Generic grouping function.
// grouper: (proxyName: string) => string | null
//   - return a non-empty string as the group name
//   - return null / empty string to skip the proxy
// definedGroup: Map<string, string[]> of fixed groups to be appended first.
//   Entries whose name conflicts with an existing group are ignored.
function groupProxiesBy(config, grouper = get_region_emoji, definedGroups = selfDefinedGroups) {
  const proxies = (config && config["proxies"]) || [];
  const proxyGroups = (config && config["proxy-groups"]) || [];

  const existingNames = collectExistingNames(proxyGroups);

  const fixedAdded = appendFixedGroups(proxyGroups, definedGroups, existingNames);
  const autoAdded = appendAutoGroups(proxyGroups, proxies, grouper, existingNames);

  mergeSmallGroupsIntoOthers(proxyGroups, autoAdded);

  ensureProxiesGroupFirst(proxyGroups, fixedAdded, autoAdded);

  return config;
}

function collectExistingNames(proxyGroups) {
  const names = new Set();
  for (const g of proxyGroups) {
    if (g && g.name) names.add(g.name);
  }
  return names;
}


function appendFixedGroups(proxyGroups, definedGroups, existingNames) {
  const fixed = definedGroups instanceof Map
    ? definedGroups
    : new Map(Object.entries(definedGroups || {}));

  const added = [];
  for (const [name, names] of fixed) {
    if (!name || existingNames.has(name)) continue;
    existingNames.add(name);
    const group = {
      name,
      type: "select",
      proxies: Array.isArray(names) ? names.slice() : [],
    };
    proxyGroups.push(group);
    added.push(group);
  }
  return added;
}



function appendAutoGroups(proxyGroups, proxies, grouper, existingNames) {
  const groups = groupProxiesByName(proxies, grouper);

  const added = [];
  for (const [groupName, names] of groups) {
    if (existingNames.has(groupName)) continue;
    existingNames.add(groupName);
    const group = {
      name: groupName,
      type: "select",
      proxies: names,
    };
    proxyGroups.push(group);
    added.push(group);
  }
  return added;
}

function groupProxiesByName(proxies, grouper) {
  const groups = new Map();
  for (const proxy of proxies) {
    if (!proxy || !proxy.name) continue;
    const groupName = grouper(proxy.name);
    if (!groupName) continue;
    let list = groups.get(groupName);
    if (!list) groups.set(groupName, (list = []));
    list.push(proxy.name);
  }
  return groups;
}



function mergeSmallGroupsIntoOthers(proxyGroups, autoAdded, threshold = 5) {
  const smallGroups = autoAdded.filter(g => g.proxies.length < threshold);
  if (smallGroups.length === 0) return;

  const smallNames = new Set(smallGroups.map(g => g.name));

  // 一次性移除小分组（smallNames 只含自动组，天然不动 fixed 组）
  for (let i = proxyGroups.length - 1; i >= 0; i--) {
    if (smallNames.has(proxyGroups[i].name)) proxyGroups.splice(i, 1);
  }

  // 收集小分组的代理名，保序去重
  const othersProxies = [];
  const seen = new Set();
  for (const g of smallGroups) {
    for (const n of g.proxies) {
      if (seen.has(n)) continue;
      seen.add(n);
      othersProxies.push(n);
    }
  }

  // 复用已有 "Others"，否则新建
  const existingOthers = proxyGroups.find(g => g.name === "Others");
  if (existingOthers) {
    const merged = new Set(existingOthers.proxies);
    for (const n of othersProxies) {
      if (merged.has(n)) continue;
      merged.add(n);
      existingOthers.proxies.push(n);
    }
  } else {
    proxyGroups.push({
      name: "Others",
      type: "select",
      proxies: othersProxies,
    });
  }
}


function ensureProxiesGroupFirst(proxyGroups, fixedAdded, autoAdded) {
  const idx = proxyGroups.findIndex(g => g.name === "Proxies");

  if (idx === -1) {
    proxyGroups.unshift({
      name: "Proxies",
      type: "select",
      proxies: buildManagedCandidates(proxyGroups, fixedAdded, autoAdded),
    });
  } else if (idx !== 0) {
    // 已存在：只调整位置，保留内容
    const [existing] = proxyGroups.splice(idx, 1);
    proxyGroups.unshift(existing);
  }
}


function buildManagedCandidates(proxyGroups, fixedAdded, autoAdded) {
  const managedSet = new Set();
  for (const g of fixedAdded) managedSet.add(g.name);
  for (const g of autoAdded) managedSet.add(g.name);
  managedSet.add("Others");

  const managed = proxyGroups
    .filter(g => g.name !== "Proxies" && managedSet.has(g.name))
    .map(g => g.name);

  if (managed.length > 0) return managed;
  return proxyGroups.filter(g => g.name !== "Proxies").map(g => g.name);
}
