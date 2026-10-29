export const palettes = [
  {
    id: "foundry",
    en: "Foundry teal",
    zh: "经典青绿",
    colors: ["#365c52", "#e8f0ec", "#f4f7f5"],
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
    id: "olive",
    en: "Muted olive",
    zh: "橄榄青",
    colors: ["#59644f", "#e9ece3", "#f5f6f1"],
  },
  {
    id: "clay",
    en: "Terracotta clay",
    zh: "陶土赭",
    colors: ["#7d5b51", "#efe5e1", "#f8f5f3"],
  },
  {
    id: "stone",
    en: "Warm stone",
    zh: "暖石灰",
    colors: ["#605c57", "#eceae6", "#f6f5f4"],
  },
  {
    id: "pine",
    en: "Nordic pine",
    zh: "墨松绿",
    colors: ["#445c58", "#e2ebe8", "#f3f6f5"],
  },
  {
    id: "sand",
    en: "Dune sand",
    zh: "灰沙褐",
    colors: ["#6e604b", "#eee7dc", "#f8f6f2"],
  },
  {
    id: "mauve",
    en: "Dusty mauve",
    zh: "烟紫灰",
    colors: ["#6c5966", "#eee3eb", "#f7f4f6"],
  },
  {
    id: "mono",
    en: "Black · white · gray",
    zh: "黑白灰",
    colors: ["#333333", "#e9e9e9", "#f7f7f7"],
  },
] as const;
export type PaletteId = (typeof palettes)[number]["id"];
