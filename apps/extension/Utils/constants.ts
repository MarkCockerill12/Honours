// Default filter presets
export const FILTER_PRESETS = {
  violence: {
    blockTerm: "violence",
    exceptWhen: "news report",
  },
  profanity: {
    blockTerm: "profanity",
    exceptWhen: "",
  },
  politics: {
    blockTerm: "political",
    exceptWhen: "educational",
  },
  spoilers: {
    blockTerm: "spoiler",
    exceptWhen: "",
  },
  nsfw: {
    blockTerm: "nsfw",
    exceptWhen: "",
  },
}