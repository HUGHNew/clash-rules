// Global Script for ClashVergeRev

selfDefinedRules = [] // copy it from definedRules.json

function main(config, profileName) {
  config["rules"] = selfDefinedRules.concat(config["rules"]);
  return config;
}