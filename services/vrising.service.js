import { GameDig } from "gamedig";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("../config.json", import.meta.url), "utf8"),
);

export async function queryVRising({
  requestPlayers = false,
  requestRules = false,
} = {}) {
  return GameDig.query({
    type: "vrising",
    host: config.vrising.host,
    port: config.vrising.queryPort,
    givenPortOnly: true,

    socketTimeout: 8000,
    attemptTimeout: 20000,
    maxRetries: 1,

    requestPlayers,
    requestRules,

    requestPlayersRequired: false,
    requestRulesRequired: false,
  });
}
