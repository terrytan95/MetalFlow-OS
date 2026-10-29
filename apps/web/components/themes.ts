export const palettes = [
  {
    id: "foundry",
    en: "Foundry teal",
    zh: "经典青绿",
    colors: ["#176451", "#eaf3ee", "#f6f8f7"],
  },
  {
    id: "sage",
    en: "Morandi sage",
    zh: "鼠尾草绿",
    colors: ["#526650", "#dfe7dc", "#f5f6f2"],
  },
  {
    id: "slate",
    en: "Mist blue",
    zh: "雾霾蓝",
    colors: ["#4c6578", "#e1e8ef", "#f4f6f8"],
  },
  {
    id: "rose",
    en: "Dusty rose",
    zh: "豆沙粉",
    colors: ["#805c64", "#eee2e4", "#faf6f6"],
  },
  {
    id: "oat",
    en: "Oat & linen",
    zh: "燕麦米",
    colors: ["#746348", "#eee8dc", "#faf8f3"],
  },
  {
    id: "lavender",
    en: "Lavender gray",
    zh: "薰衣草灰",
    colors: ["#6d627f", "#e8e3ee", "#f7f5f9"],
  },
  {
    id: "mono",
    en: "Black · white · gray",
    zh: "黑白灰",
    colors: ["#333333", "#e9e9e9", "#f7f7f7"],
  },
] as const;
export type PaletteId = (typeof palettes)[number]["id"];
