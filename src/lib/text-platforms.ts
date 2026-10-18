export const TEXT_PLATFORMS = [
  { id: "sendblue", label: "Sendblue" },
  { id: "twilio", label: "Twilio" },
  { id: "simpletexting", label: "SimpleTexting" },
] as const;

export type TextPlatform = (typeof TEXT_PLATFORMS)[number]["id"];

export function textFieldCopy(platform: TextPlatform | "") {
  if (platform === "twilio") {
    return {
      account: "Account SID",
      secret: "Auth token",
      from: "Twilio phone number",
      hint: "On the Twilio console homepage, copy the Account SID, Auth Token, and your Twilio phone number.",
    };
  }
  if (platform === "simpletexting") {
    return {
      account: "",
      secret: "API token",
      from: "Account phone, if you have more than one",
      hint: "In SimpleTexting, open Settings and copy the API token. Leave the phone blank to use the primary number.",
    };
  }
  if (platform === "sendblue") {
    return {
      account: "API key id",
      secret: "API secret",
      from: "Sendblue phone number",
      hint: "In Sendblue, open API keys and copy the key id, secret, and the line texts should come from.",
    };
  }
  return {
    account: "",
    secret: "",
    from: "",
    hint: "Pick Sendblue, Twilio, or SimpleTexting. Choose Not connected and save to disconnect.",
  };
}
